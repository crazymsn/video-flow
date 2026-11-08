const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const encode = (value) => new TextEncoder().encode(value);

// Loads the real background.js. Timers fire at once (and record their delay),
// so a retry pause costs nothing in the test.
function loadBackground({ fetchImpl }) {
  const delays = [];
  const listeners = { addListener() {} };
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    AbortController,
    fetch: fetchImpl,
    setTimeout: (callback, delay) => {
      delays.push(delay);
      // The long request timeouts must not fire; only short retry pauses do.
      if (delay <= 20_000) queueMicrotask(callback);
      return delays.length;
    },
    clearTimeout: () => {},
    importScripts() {},
    chrome: {
      storage: {
        local: {
          setAccessLevel: () => Promise.resolve(),
          get: async (key) => ({
            [key]: {
              provider: "openai-compatible",
              aiApiKey: "key",
              aiModel: "model",
            },
          }),
          set: async () => {},
          remove: async () => {},
        },
      },
      action: { onClicked: listeners },
      sidePanel: { setPanelBehavior() {}, setOptions: () => Promise.resolve() },
      runtime: {
        onInstalled: listeners,
        onMessage: listeners,
        openOptionsPage() {},
        getURL: (resourcePath) => `chrome-extension://test/${resourcePath}`,
        sendMessage: () => Promise.resolve({ success: true }),
      },
      tabs: { onUpdated: listeners, onActivated: listeners },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("settings.js"), sandbox);
  vm.runInContext(read("bilibili.js"), sandbox);
  vm.runInContext(read("background.js"), sandbox);
  return { api: sandbox.__YTD_TRANSLATION_TESTING__, delays };
}

const body = (status, payload, headers = {}) => ({
  ok: status < 400,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  body: {
    getReader() {
      let sent = false;
      return {
        async read() {
          if (sent) return { done: true };
          sent = true;
          return { done: false, value: encode(payload) };
        },
        async cancel() {},
      };
    },
  },
});

const promptResponse = (url) => ({
  ok: true,
  status: 200,
  text: async () => read(String(url).replace("chrome-extension://test/", "")),
});

const goodReply = (id, text) =>
  body(
    200,
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ segments: [{ id, text }] }) } }],
    }),
  );

const source = { segments: [{ id: "a", text: "A sentence that needs a Chinese translation." }] };

test("a rate-limited translation batch is retried and then succeeds", async () => {
  let calls = 0;
  const { api, delays } = loadBackground({
    fetchImpl: async (url) => {
      if (String(url).startsWith("chrome-extension://")) return promptResponse(url);
      calls += 1;
      if (calls <= 2) {
        return body(429, JSON.stringify({ error: { message: "slow down" } }), {
          "retry-after": "2",
        });
      }
      return goodReply("a", "一个需要中文翻译的句子。");
    },
  });
  const result = await api.handleTranslateContent(source, "transcriptBatch", "zh", "T");
  assert.equal(result.success, true);
  assert.equal(calls, 3);
  // The gateway's Retry-After hint (2 seconds) is honored on the first pause.
  assert.ok(delays.some((delay) => delay >= 2000 && delay < 2500));
});

test("a 502 with an HTML body is retried instead of failing on invalid JSON", async () => {
  let calls = 0;
  const { api } = loadBackground({
    fetchImpl: async (url) => {
      if (String(url).startsWith("chrome-extension://")) return promptResponse(url);
      calls += 1;
      if (calls === 1) return body(502, "<html><body>Bad Gateway</body></html>");
      return goodReply("a", "一个需要中文翻译的句子。");
    },
  });
  const result = await api.handleTranslateContent(source, "transcriptBatch", "zh", "T");
  assert.equal(result.success, true);
  assert.equal(calls, 2);
});

test("retries stop after three pauses and report the real error", async () => {
  let calls = 0;
  const { api } = loadBackground({
    fetchImpl: async (url) => {
      if (String(url).startsWith("chrome-extension://")) return promptResponse(url);
      calls += 1;
      return body(503, JSON.stringify({ error: { message: "overloaded" } }));
    },
  });
  const result = await api.handleTranslateContent(source, "transcriptBatch", "zh", "T");
  assert.equal(result.success, false);
  assert.equal(calls, 4);
  assert.match(result.error, /overloaded/);
});

test("errors a new request cannot fix are not retried", async () => {
  for (const status of [400, 401, 403, 404]) {
    let calls = 0;
    const { api } = loadBackground({
      fetchImpl: async (url) => {
        if (String(url).startsWith("chrome-extension://")) return promptResponse(url);
        calls += 1;
        return body(status, JSON.stringify({ error: { message: `status ${status}` } }));
      },
    });
    const result = await api.handleTranslateContent(source, "transcriptBatch", "zh", "T");
    assert.equal(result.success, false);
    assert.equal(calls, 1, `HTTP ${status} must not be retried`);
  }
});

test("a dropped connection is retried", async () => {
  let calls = 0;
  const { api } = loadBackground({
    fetchImpl: async (url) => {
      if (String(url).startsWith("chrome-extension://")) return promptResponse(url);
      calls += 1;
      if (calls === 1) throw new TypeError("Failed to fetch");
      return goodReply("a", "一个需要中文翻译的句子。");
    },
  });
  const result = await api.handleTranslateContent(source, "transcriptBatch", "zh", "T");
  assert.equal(result.success, true);
  assert.equal(calls, 2);
});

test("many batches started together all finish and share one prompt download", async () => {
  let promptDownloads = 0;
  let chatCalls = 0;
  const { api } = loadBackground({
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("chrome-extension://")) {
        promptDownloads += 1;
        await new Promise((resolve) => setImmediate(resolve));
        return promptResponse(url);
      }
      chatCalls += 1;
      const sent = JSON.parse(options.body);
      const id = JSON.parse(sent.messages[1].content).segments[0].id;
      return goodReply(id, "一个需要中文翻译的句子。");
    },
  });
  const results = await Promise.all(
    Array.from({ length: 50 }, (_, index) =>
      api.handleTranslateContent(
        { segments: [{ id: `s${index}`, text: "A sentence that needs a Chinese translation." }] },
        "transcriptBatch",
        "zh",
        "T",
      ),
    ),
  );
  assert.equal(results.every((result) => result.success), true);
  assert.equal(chatCalls, 50);
  // translation.md is read once, however many requests arrive together.
  assert.equal(promptDownloads, 1);
});

test("a batch that lands after the panel moved on is kept, not thrown away", () => {
  const js = read("sidepanel.js");
  // Transcript batches: stale replies are stored under the language they were asked for.
  assert.match(js, /if \(isStale\) \{[\s\S]*?keepFinishedTranslation\(sourceBatch, result, videoId, requestTarget\);\s*return;/);
  assert.match(js, /`\$\{videoId\}:\$\{target\}:semantic:\$\{sourceBatch\[index\]\.id\}`/);
  // Overview and Notes batches do the same with the key built at send time.
  assert.match(js, /stale = true;[\s\S]*?interfaceTranslationCache\.set\(batch\[index\]\.cacheKey, item\.text\)/);
  // A stale reply never touches what is on screen.
  const keep = js.match(/function keepFinishedTranslation[\s\S]*?\n}\n/)?.[0] || "";
  assert.doesNotMatch(keep, /document\.|innerHTML|updateTranslatedRow/);
});

test("the panel merges cache writes and keeps 50 batches in flight", () => {
  const js = read("sidepanel.js");
  assert.match(js, /const TRANSLATION_CONCURRENCY = 50/);
  // One timer merges many finished batches into a single save.
  assert.match(js, /function updateCache\(\)\s*\{[\s\S]*?cacheSaveTimer === null[\s\S]*?setTimeout/);
  assert.match(js, /window\.addEventListener\("pagehide"[\s\S]*?flushCacheNow\(\)/);
  assert.match(js, /if \(videoChanged && currentVideoId\) await flushCacheNow\(\);/);
  // The whole transcript is queued at once, in reading order from the screen.
  assert.match(js, /order\.forEach\(\(index\) => enqueue\(index\)\)/);
  // The microtask that starts workers is scheduled once per turn.
  assert.match(js, /if \(!startScheduled\) \{\s*startScheduled = true;/);
  // Overview and Notes failures offer Retry and do not also seek the video.
  assert.match(js, /data-retry-surface="\$\{escapeHtml\(surface\)\}">Retry/);
  assert.match(js, /retryInterfaceTranslation\(button\.dataset\.retrySurface\);\s*\}, true\);/);
});
