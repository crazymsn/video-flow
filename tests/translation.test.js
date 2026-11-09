const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadSidepanelHelpers({
  sendMessage = () => Promise.resolve({}),
  setTimeoutImpl = () => 0,
  clearTimeoutImpl = () => {},
} = {}) {
  const listeners = { addListener() {} };
  const sessionStorage = {};
  const localStorage = {};
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    setInterval() {},
    clearInterval() {},
    IntersectionObserver: class {},
    CSS: { escape: (value) => value },
    window: { getSelection: () => null, close() {} },
    document: {
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => {
        let value = "";
        return {
          set textContent(text) {
            value = String(text);
          },
          get innerHTML() {
            return value
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;");
          },
        };
      },
    },
    chrome: {
      runtime: { onMessage: listeners, sendMessage },
      storage: {
        local: {
          get: async (key) => ({ [key]: localStorage[key] }),
          set: async (values) => Object.assign(localStorage, values),
        },
        session: {
          get: async (key) => ({ [key]: sessionStorage[key] }),
          set: async (values) => Object.assign(sessionStorage, values),
        },
      },
      windows: { getCurrent: () => Promise.resolve({ id: 1 }) },
      tabs: { onUpdated: listeners, onActivated: listeners },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("settings.js"), sandbox);
  vm.runInContext(read("sidepanel.js"), sandbox);
  return sandbox.__YTD_TRANSCRIPT_TESTING__;
}

function loadBackgroundHelpers({
  settings = {
    provider: "openai-compatible",
    aiApiKey: "test-key",
    aiBaseUrl: "https://api.meding.site",
    aiModel: "test-model",
  },
  fetchImpl = fetch,
  setTimeoutImpl = () => 0,
  clearTimeoutImpl = () => {},
  sidePanel = {
    setPanelBehavior() {},
    setOptions: () => Promise.resolve(),
  },
} = {}) {
  const listeners = { addListener() {} };
  const localStorage = { ytd_settings: settings };
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    fetch: fetchImpl,
    AbortController,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    importScripts() {},
    chrome: {
      storage: {
        local: {
          setAccessLevel: () => Promise.resolve(),
          get: async (key) => {
            if (key === null) return { ...localStorage };
            if (Array.isArray(key)) {
              return Object.fromEntries(key.map((item) => [item, localStorage[item]]));
            }
            return { [key]: localStorage[key] };
          },
          set: async (values) => Object.assign(localStorage, values),
          remove: async (keys) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              delete localStorage[key];
            }
          },
        },
      },
      action: { onClicked: listeners },
      sidePanel,
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
  // Run the real shared modules, exactly as importScripts() does in Chrome.
  vm.runInContext(read("settings.js"), sandbox);
  vm.runInContext(read("bilibili.js"), sandbox);
  vm.runInContext(read("background.js"), sandbox);
  return sandbox.__YTD_TRANSLATION_TESTING__;
}

test("non-YouTube tabs explicitly close before their panel is disabled", async () => {
  const calls = [];
  const background = loadBackgroundHelpers({
    sidePanel: {
      setPanelBehavior() {},
      close: async (options) => calls.push(["close", options]),
      setOptions: async (options) => calls.push(["setOptions", options]),
    },
  });

  await background.updatePanelForTab(17, "https://example.com/page", 4);

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["close", { tabId: 17 }],
    ["setOptions", { tabId: 17, enabled: false }],
  ]);
});

test("a global panel closes by window when the tab close is rejected", async () => {
  const calls = [];
  const background = loadBackgroundHelpers({
    sidePanel: {
      setPanelBehavior() {},
      close: async (options) => {
        calls.push(["close", options]);
        if (options.tabId) throw new Error("Global panel");
      },
      setOptions: async (options) => calls.push(["setOptions", options]),
    },
  });

  await background.updatePanelForTab(17, "https://example.com/page", 4);

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["close", { tabId: 17 }],
    ["close", { windowId: 4 }],
    ["setOptions", { tabId: 17, enabled: false }],
  ]);
});

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay, active: true });
      return id;
    },
    clearTimeout(id) {
      const timer = timers.get(id);
      if (timer) timer.active = false;
    },
    fireActive(delay) {
      const match = [...timers.entries()].find(
        ([, timer]) => timer.active && timer.delay === delay,
      );
      assert.ok(match, `Expected an active ${delay}ms timer`);
      match[1].active = false;
      match[1].callback();
    },
    activeCount(delay) {
      return [...timers.values()].filter(
        (timer) => timer.active && timer.delay === delay,
      ).length;
    },
    createdCount(delay) {
      return [...timers.values()].filter((timer) => timer.delay === delay).length;
    },
  };
}

function streamingResponse(chunks, { ok = true, status = 200 } = {}) {
  let index = 0;
  return {
    ok,
    status,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true };
            return { done: false, value: chunks[index++] };
          },
          async cancel() {},
        };
      },
    },
  };
}

const encode = (value) => new TextEncoder().encode(value);
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test("the header exposes one universal language control for all result tabs", () => {
  const html = read("sidepanel.html");
  const js = read("sidepanel.js");
  assert.match(html, /id="transcriptModeControl"[\s\S]*aria-label="Content language"/);
  assert.match(html, /id="transcriptModeControl"[\s\S]*id="tabsNav"/);
  assert.match(html, /data-transcript-mode="original"[\s\S]*?>Original</);
  assert.match(html, /data-transcript-mode="zh"[\s\S]*?>\u4e2d\u6587</);
  assert.match(html, /data-transcript-mode="bilingual"[\s\S]*?>\u53cc\u8bed</);
  assert.match(js, /handleDisplayLanguageModeChange\(button\.dataset\.transcriptMode\)/);
  assert.match(js, /contentType: "transcriptBatch"/);
  assert.match(js, /contentType: "interfaceBatch"/);
  assert.match(js, /translateOverviewContent/);
  assert.match(js, /translateNotesContent/);
  assert.doesNotMatch(js, /English \+ Chinese/);
  assert.doesNotMatch(`${html}\n${js}`, /From video subtitles/);
});

test("new videos default to Original while returning videos restore their choice", async () => {
  const { loadDisplayLanguageMode, saveDisplayLanguageMode } =
    loadSidepanelHelpers();

  await saveDisplayLanguageMode("video-a", "bilingual");
  assert.equal(await loadDisplayLanguageMode("video-a"), "bilingual");
  assert.equal(await loadDisplayLanguageMode("unseen-video"), "original");
});

test("Overview shares the Transcript batch generation and retries when opened", () => {
  const js = read("sidepanel.js");
  const transcriptFunction = js.match(
    /async function translateTranscript\(\)[\s\S]*?\r?\n}\r?\n\r?\nfunction setTranslatingSpinner/,
  )?.[0];

  assert.ok(transcriptFunction);
  assert.doesNotMatch(transcriptFunction, /translationGeneration \+= 1/);
  assert.match(js, /const TRANSLATION_BATCH_SIZE = 3/);
  // Overview and Notes use larger batches and a few parallel workers, but each
  // batch is still shown and saved as soon as it returns.
  assert.match(js, /const INTERFACE_BATCH_SIZE = 4/);
  assert.match(js, /const TRANSLATION_CONCURRENCY = 50/);
  assert.match(js, /const INTERFACE_BATCH_CONCURRENCY = TRANSLATION_CONCURRENCY/);
  assert.match(js, /const TRANSCRIPT_BATCH_CONCURRENCY = TRANSLATION_CONCURRENCY/);
  assert.match(
    js,
    /missing\.slice\(at, at \+ INTERFACE_BATCH_SIZE\)[\s\S]*?rerender\(\);[\s\S]*?await updateCache\(\)/,
  );
  assert.match(
    js,
    /tabName === "overview"[\s\S]*?currentAnalysis[\s\S]*?currentTranscriptMode !== "original"[\s\S]*?translateOverviewContent\(\)/,
  );
  assert.match(
    js,
    /Translate only the visible tab[\s\S]*?tabName === "notes"[\s\S]*?translateNotesContent\(\)/,
  );
  assert.match(
    js,
    /activeTabName === "overview"[\s\S]*?translateOverviewContent\(\)[\s\S]*?activeTabName === "notes"[\s\S]*?translateNotesContent\(\)[\s\S]*?activeTabName === "transcript"[\s\S]*?translateTranscript\(\)/,
  );
});

test("transcript reading position survives a side panel close", async () => {
  const { saveTranscriptViewState, loadTranscriptViewState } =
    loadSidepanelHelpers();

  await saveTranscriptViewState("video-a", 427.5);
  const restored = await loadTranscriptViewState("video-a");

  assert.deepEqual(JSON.parse(JSON.stringify(restored)), {
    videoId: "video-a",
    scrollTop: 427.5,
  });
});

test("selected transcript notes keep exact text and row timestamp", async () => {
  const providerMustNotRun = async () => {
    throw new Error("Selected note must not call a provider");
  };
  const { handleSaveNote } = loadBackgroundHelpers({
    fetchImpl: providerMustNotRun,
  });

  const result = await handleSaveNote(
    "video123",
    92.9,
    "Test video",
    "Test channel",
    "  The selected words stay exact.  ",
  );

  assert.equal(result.success, true);
  assert.equal(result.note.text, "The selected words stay exact.");
  assert.equal(result.note.rawText, "The selected words stay exact.");
  assert.equal(result.note.timestamp, "1:32");
  assert.equal(result.note.timestampSeconds, 92);
  assert.equal(
    result.note.timestampedUrl,
    "https://www.youtube.com/watch?v=video123&t=92s",
  );
});

test("Bilibili notes deep link to the right part and second", async () => {
  const { handleSaveNote } = loadBackgroundHelpers({
    fetchImpl: async () => {
      throw new Error("Selected note must not call a provider");
    },
  });

  const first = await handleSaveNote(
    "BV1GJ411x7h7",
    95,
    "Part one",
    "Uploader",
    "Selected words.",
  );
  assert.equal(
    first.note.timestampedUrl,
    "https://www.bilibili.com/video/BV1GJ411x7h7?t=95",
  );

  const second = await handleSaveNote(
    "BV1GJ411x7h7_p3",
    95,
    "Part three",
    "Uploader",
    "Selected words.",
  );
  assert.equal(
    second.note.timestampedUrl,
    "https://www.bilibili.com/video/BV1GJ411x7h7?p=3&t=95",
  );
});

test("semantic segmentation rebuilds sentences across caption boundaries", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const segments = groupTranscriptEntries(
    [
      { start: 0, text: "Caption boundaries should" },
      { start: 2, text: "not break a complete sentence." },
      { start: 5, text: "The next thought also" },
      { start: 7, text: "stays together!" },
    ],
    { minChars: 1, idealChars: 100, maxChars: 320, maxSeconds: 20 },
  );
  assert.equal(segments.length, 2);
  assert.equal(
    segments[0].text,
    "Caption boundaries should not break a complete sentence.",
  );
  assert.equal(segments[0].start, 0);
  assert.equal(segments[1].text, "The next thought also stays together!");
  assert.equal(segments[1].start, 5);
});

test("a huge raw Supadata entry is split into seekable bounded segments", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const text = Array.from({ length: 900 }, (_, index) => `word${index}`).join(" ");
  const segments = groupTranscriptEntries([
    { start: 12, duration: 90, text },
  ]);
  assert.ok(segments.length > 8);
  assert.ok(segments.every((segment) => segment.text.length <= 384));
  assert.equal(segments[0].start, 12);
  assert.ok(segments.at(-1).start > segments[0].start);
  assert.ok(segments.every((segment) => /^segment-\d+-\d+$/.test(segment.id)));
});

test("Chinese sentence and clause punctuation creates semantic guardrails", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const segments = groupTranscriptEntries(
    [
      { start: 0, text: "这是一个被字幕切开的" },
      { start: 2, text: "完整句子。这是第二个想法，" },
      { start: 5, text: "也应该保持语义完整！" },
    ],
    { minChars: 1, idealChars: 100, maxChars: 320, maxSeconds: 20 },
  );
  assert.equal(segments.length, 2);
  assert.equal(segments[0].text, "这是一个被字幕切开的完整句子。");
  assert.equal(segments[1].text, "这是第二个想法，也应该保持语义完整！");
});

test("structured translation batches align by stable ID and expose missing fallback", () => {
  const sidepanel = loadSidepanelHelpers();
  const background = loadBackgroundHelpers();
  const source = [
    { id: "segment-0-0", text: "A complete first sentence." },
    { id: "segment-1-5000", text: "A complete second sentence." },
  ];
  assert.deepEqual(
    JSON.parse(JSON.stringify(background.validateTranscriptBatchRequest({ segments: source }))),
    source,
  );

  const normalized = background.normalizeTranslatedSegmentBatch(
    {
      segments: [
        { id: "unknown", text: "\u5ffd\u7565" },
        { id: "segment-1-5000", text: "\u7b2c\u4e8c\u4e2a\u5b8c\u6574\u53e5\u5b50\u3002" },
      ],
    },
    source,
  );
  const aligned = sidepanel.alignTranslatedSegmentBatch(
    source,
    normalized.segments,
  );
  assert.equal(aligned[0].id, source[0].id);
  assert.equal(aligned[0].text, "");
  assert.match(aligned[0].error, /unavailable/i);
  assert.equal(aligned[1].text, "\u7b2c\u4e8c\u4e2a\u5b8c\u6574\u53e5\u5b50\u3002");
});

test("translated-only omits English while bilingual renders aligned English and Chinese", () => {
  const { renderTranscriptSegmentContent } = loadSidepanelHelpers();
  const segment = { id: "segment-0-0", text: "Original English sentence." };
  const translatedOnly = renderTranscriptSegmentContent(
    segment,
    "zh",
    "\u4e2d\u6587\u8bd1\u6587\u3002",
    "",
  );
  const bilingual = renderTranscriptSegmentContent(
    segment,
    "bilingual",
    "\u4e2d\u6587\u8bd1\u6587\u3002",
    "",
  );
  assert.doesNotMatch(translatedOnly, /Original English sentence/);
  assert.match(translatedOnly, /\u4e2d\u6587\u8bd1\u6587/);
  assert.match(bilingual, /transcript-original/);
  assert.match(bilingual, /Original English sentence/);
  assert.match(bilingual, /\u4e2d\u6587\u8bd1\u6587/);
});

test("subtitle formatting tags render in original and translated segment text", () => {
  const { renderTranscriptSegmentContent } = loadSidepanelHelpers();
  const html = renderTranscriptSegmentContent(
    {
      id: "segment-0-0",
      text: "Think <i>deeply</i>, <b>carefully</b>, and <u>clearly</u>.<br>Next line.",
    },
    "bilingual",
    "\u5b57\u5730<i>\u601d\u8003</i>\u7684\u3002<strong>\u91cd\u70b9</strong>",
    "",
  );

  assert.match(html, /Think <i>deeply<\/i>/);
  assert.match(html, /<b>carefully<\/b>/);
  assert.match(html, /<u>clearly<\/u>\.<br>Next line/);
  assert.match(html, /\u5b57\u5730<i>\u601d\u8003<\/i>\u7684\u3002<strong>\u91cd\u70b9<\/strong>/);
});

test("subtitle markup renderer keeps attributed and arbitrary HTML escaped", () => {
  const { renderSubtitleInlineMarkup } = loadSidepanelHelpers();
  const html = renderSubtitleInlineMarkup(
    '<img src=x onerror="alert(1)"><i onclick="alert(2)">unsafe</i><script>alert(3)</script>',
  );

  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;i onclick=&quot;alert\(2\)&quot;&gt;unsafe<\/i>/);
  assert.match(html, /&lt;script&gt;alert\(3\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img\b|<i\s+onclick|<script\b/);
});

test("background rejects unsupported language fallthrough and malformed batches", () => {
  const source = read("background.js");
  const { validateTranscriptBatchRequest } = loadBackgroundHelpers();
  // Only the listed targets (Chinese, and English for Chinese subtitles) pass.
  assert.match(source, /TRANSLATION_TARGETS\[targetLanguage\]/);
  assert.match(source, /\["transcriptBatch", "interfaceBatch"\]/);
  assert.throws(
    () => validateTranscriptBatchRequest({ segments: [] }),
    /1 to 4 segments/,
  );
  assert.throws(
    () =>
      validateTranscriptBatchRequest({
        segments: [
          { id: "duplicate", text: "first" },
          { id: "duplicate", text: "second" },
        ],
      }),
    /unique and stable/,
  );
});

test("all AI product requests use the OpenAI-compatible fixed gateway", async () => {
  const deepSeekRequests = [];
  const requestUrls = [];
  const requestHeaders = [];
  const successfulFetch = (requests) => async (url, options) => {
    requestUrls.push(url);
    requestHeaders.push(options.headers);
    requests.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "translated" } }],
      }),
    };
  };

  const deepSeek = loadBackgroundHelpers({
    fetchImpl: successfulFetch(deepSeekRequests),
  });
  const deepSeekResult = await deepSeek.requestAiCompletion({
    maxTokens: 128,
    responseFormat: { type: "json_object" },
    messages: [{ role: "user", content: "Hello." }],
  });
  assert.equal(deepSeekResult.text, "translated");
  assert.deepEqual(requestUrls, [
    "https://api.meding.site/v1/chat/completions",
  ]);
  assert.equal(requestHeaders[0].Authorization, "Bearer test-key");
  assert.equal(deepSeekRequests[0].model, "test-model");
  // Provider-specific fields from the old DeepSeek integration are gone.
  assert.equal(Object.hasOwn(deepSeekRequests[0], "thinking"), false);
  assert.deepEqual(deepSeekRequests[0].response_format, {
    type: "json_object",
  });

  const backgroundSource = read("background.js");
  assert.equal(
    (backgroundSource.match(/await requestAiCompletion\(\{/g) || []).length,
    4,
  );
  assert.doesNotMatch(backgroundSource, /disableThinking/);
  for (const callPath of [
    "handleAnalyzeTranscript",
    "cleanupNoteText",
    "handleExplainSelection",
    "callAiTranslation",
  ]) {
    assert.match(
      backgroundSource,
      new RegExp(`async function ${callPath}\\([\\s\\S]*?requestAiCompletion\\(\\{`),
    );
  }
});

test("blank-line chunks reset provider idle timeout and valid JSON succeeds", async () => {
  const timers = createFakeTimers();
  const helpers = loadBackgroundHelpers({
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    fetchImpl: async () =>
      streamingResponse([
        encode("\n"),
        encode("\n"),
        encode('{"choices":[{"message":{"content":"translated"}}]}'),
      ]),
  });

  const result = await helpers.callAiTranslation("Translate.", "Hello.");
  assert.equal(result.success, true);
  assert.equal(result.text, "translated");
  assert.equal(timers.createdCount(50_000), 5);
  assert.equal(timers.activeCount(50_000), 0);
  assert.equal(timers.activeCount(120_000), 0);
});

test("provider idle silence aborts with a distinct Retry-able error", async () => {
  const timers = createFakeTimers();
  const helpers = loadBackgroundHelpers({
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    fetchImpl: async (_url, { signal }) => ({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: () =>
            new Promise((_resolve, reject) => {
              signal.addEventListener("abort", () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              });
            }),
        }),
      },
    }),
  });

  const request = helpers.callAiTranslation("Translate.", "Hello.");
  await nextTurn();
  timers.fireActive(50_000);
  const result = await request;
  assert.equal(result.success, false);
  assert.equal(result.code, "AI_IDLE_TIMEOUT");
  assert.match(result.error, /inactive for 50 seconds.*Retry/i);
  assert.equal(timers.activeCount(120_000), 0);
});

test("blank-line keepalives cannot evade the provider hard cap", async () => {
  const timers = createFakeTimers();
  let releaseRead;
  let signal;
  const helpers = loadBackgroundHelpers({
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: () =>
              new Promise((resolve, reject) => {
                releaseRead = () => resolve({ done: false, value: encode("\n") });
                signal.addEventListener("abort", () => {
                  const error = new Error("aborted");
                  error.name = "AbortError";
                  reject(error);
                }, { once: true });
              }),
          }),
        },
      };
    },
  });

  const request = helpers.callAiTranslation("Translate.", "Hello.");
  await nextTurn();
  releaseRead();
  await nextTurn();
  releaseRead();
  await nextTurn();
  assert.equal(timers.activeCount(50_000), 1);
  timers.fireActive(120_000);
  const result = await request;
  assert.equal(result.success, false);
  assert.equal(result.code, "AI_HARD_TIMEOUT");
  assert.match(result.error, /120-second limit.*Retry/i);
  assert.equal(timers.activeCount(50_000), 0);
});

test("provider response reader accepts leading whitespace before JSON", async () => {
  const helpers = loadBackgroundHelpers({
    fetchImpl: async () =>
      streamingResponse([
        encode('  \n\t{"choices":[{"message":{"content":"ok"}}]}'),
      ]),
  });
  const result = await helpers.callAiTranslation("Translate.", "Hello.");
  assert.equal(result.success, true);
  assert.equal(result.text, "ok");
});

test("provider response reader rejects bodies over 2 MiB", async () => {
  const helpers = loadBackgroundHelpers({
    fetchImpl: async () =>
      streamingResponse([new Uint8Array(2 * 1024 * 1024 + 1)]),
  });
  const result = await helpers.callAiTranslation("Translate.", "Hello.");
  assert.equal(result.success, false);
  assert.equal(result.code, "AI_RESPONSE_TOO_LARGE");
  assert.match(result.error, /2 MiB limit/);
});

test("DeepSeek retries one empty transcript JSON response without response_format", async () => {
  const requests = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: async (url, options) => {
      if (url.startsWith("chrome-extension://")) {
        return { ok: true, text: async () => read("prompts/translation.md") };
      }
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: requests.length === 1
                ? ""
                : '{"segments":[{"id":"segment-0-0","text":"\u4e2d\u6587\u8bd1\u6587\u3002"}]}',
            },
          }],
        }),
      };
    },
  });
  const result = await helpers.handleTranslateContent(
    { segments: [{ id: "segment-0-0", text: "English source sentence." }] },
    "transcriptBatch",
    "zh",
    "Video",
  );
  assert.equal(result.success, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].response_format, { type: "json_object" });
  assert.equal(Object.hasOwn(requests[1], "response_format"), false);
  assert.equal(requests[0].max_tokens, 1536);
});

test("interface batches use the dedicated Overview and Notes translation prompt", async () => {
  const requests = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: async (url, options) => {
      if (url.startsWith("chrome-extension://")) {
        return { ok: true, text: async () => read("prompts/translation.md") };
      }
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"segments":[{"id":"note-1","text":"\u4e2d\u6587\u7b14\u8bb0\u3002"}]}',
            },
          }],
        }),
      };
    },
  });

  const result = await helpers.handleTranslateContent(
    { segments: [{ id: "note-1", text: "Saved note." }] },
    "interfaceBatch",
    "zh",
    "Video",
  );

  assert.equal(result.success, true);
  assert.equal(result.translatedContent.segments[0].text, "\u4e2d\u6587\u7b14\u8bb0\u3002");
  assert.match(
    requests[0].messages[0].content,
    /chapter titles, summaries, quotes, and saved notes/,
  );
});

test("translation message watchdog rejects, clears its timer, and ignores late replies", async () => {
  let timeoutCallback;
  let timeoutDelay;
  let resolveMessage;
  let clearCount = 0;
  const helpers = loadSidepanelHelpers({
    sendMessage: () =>
      new Promise((resolve) => {
        resolveMessage = resolve;
      }),
    setTimeoutImpl(callback, delay) {
      timeoutCallback = callback;
      timeoutDelay = delay;
      return 73;
    },
    clearTimeoutImpl(id) {
      assert.equal(id, 73);
      clearCount += 1;
    },
  });

  const request = helpers.sendTranslationMessage({
    action: "translateContent",
  });
  assert.equal(timeoutDelay, 130_000);
  timeoutCallback();
  await assert.rejects(request, /timed out after 130 seconds.*Retry/i);
  assert.equal(clearCount, 1);

  resolveMessage({ success: true });
  await Promise.resolve();
  assert.equal(clearCount, 1);

  let successTimeoutCallback;
  let successClearCount = 0;
  const successfulHelpers = loadSidepanelHelpers({
    sendMessage: () => Promise.resolve({ success: true }),
    setTimeoutImpl(callback) {
      successTimeoutCallback = callback;
      return 91;
    },
    clearTimeoutImpl(id) {
      assert.equal(id, 91);
      successClearCount += 1;
    },
  });
  assert.deepEqual(
    await successfulHelpers.sendTranslationMessage({
      action: "translateContent",
    }),
    { success: true },
  );
  assert.equal(successClearCount, 1);
  successTimeoutCallback();
  assert.equal(successClearCount, 1);
});

test("Chinese prompt preserves natural bilingual-learning style rules", () => {
  const prompt = read("prompts/translation.md");
  assert.match(prompt, /Translate the complete thought/);
  assert.match(prompt, /Use 你, never 您/);
  assert.match(prompt, /spaces between Chinese and adjacent English words or digits/);
  assert.match(prompt, /source-language `text`/);
});

test("model list requests go only to the fixed gateway with the typed token", async () => {
  const requests = [];
  const { handleListModels } = loadBackgroundHelpers({
    settings: { provider: "openai-compatible", aiApiKey: "saved-token", aiModel: "" },
    fetchImpl: async (url, options) => {
      requests.push({ url, authorization: options.headers.Authorization });
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "model-b" }, { id: "model-a" }] }),
      };
    },
  });

  const typed = await handleListModels("  typed-token  ");
  assert.deepEqual(JSON.parse(JSON.stringify(typed)), {
    success: true,
    models: ["model-a", "model-b"],
  });
  const saved = await handleListModels("");
  assert.equal(saved.success, true);

  assert.deepEqual(requests, [
    { url: "https://api.meding.site/v1/models", authorization: "Bearer typed-token" },
    { url: "https://api.meding.site/v1/models", authorization: "Bearer saved-token" },
  ]);
});

test("model list failures are reported without throwing", async () => {
  const respond = (status, body) =>
    loadBackgroundHelpers({
      fetchImpl: async () => ({ ok: status < 400, status, json: async () => body }),
    });

  const rejected = await respond(401, {}).handleListModels("bad");
  assert.equal(rejected.success, false);
  assert.equal(rejected.error, "INVALID_AI_KEY");

  const broken = await respond(500, {}).handleListModels("token");
  assert.equal(broken.error, "MODEL_LIST_FAILED");

  const empty = await respond(200, { data: [] }).handleListModels("token");
  assert.equal(empty.error, "NO_MODELS");

  const noToken = await loadBackgroundHelpers({
    settings: { provider: "openai-compatible", aiApiKey: "", aiModel: "" },
    fetchImpl: async () => {
      throw new Error("must not call the network without a token");
    },
  }).handleListModels("");
  assert.equal(noToken.error, "NO_AI_KEY");

  const offline = await loadBackgroundHelpers({
    fetchImpl: async () => {
      throw new Error("network down");
    },
  }).handleListModels("token");
  assert.equal(offline.success, false);
  assert.equal(offline.error, "MODEL_LIST_FAILED");
});

test("AI requests fail clearly when no model is selected", async () => {
  const { requestAiCompletion } = loadBackgroundHelpers({
    settings: { provider: "openai-compatible", aiApiKey: "token", aiModel: "" },
    fetchImpl: async () => {
      throw new Error("must not reach the network without a model");
    },
  });

  await assert.rejects(
    () => requestAiCompletion({ maxTokens: 8, messages: [] }),
    (error) => error.code === "NO_AI_MODEL",
  );
});

test("sendMessageWithTimeout settles on a reply, an error, or the timeout", async () => {
  let timeoutCallback;
  let timeoutDelay;
  const timeoutText = "took too long";
  const slow = loadSidepanelHelpers({
    sendMessage: () => new Promise(() => {}),
    setTimeoutImpl(callback, delay) {
      timeoutCallback = callback;
      timeoutDelay = delay;
      return 1;
    },
  });
  const pending = slow.sendMessageWithTimeout({ action: "getNotes" }, 15_000, timeoutText);
  assert.equal(timeoutDelay, 15_000);
  timeoutCallback();
  await assert.rejects(pending, /took too long/);

  const ok = loadSidepanelHelpers({
    sendMessage: async () => ({ success: true, notes: [] }),
  });
  assert.deepEqual(
    await ok.sendMessageWithTimeout({ action: "getNotes" }, 15_000, timeoutText),
    { success: true, notes: [] },
  );

  const failing = loadSidepanelHelpers({
    sendMessage: async () => {
      throw new Error("worker stopped");
    },
  });
  await assert.rejects(
    failing.sendMessageWithTimeout({ action: "getNotes" }, 15_000, timeoutText),
    /worker stopped/,
  );
});

test("Overview and Notes requests cannot wait on the message channel forever", () => {
  const js = read("sidepanel.js");
  const analysis = js.match(/async function triggerAnalysis\(\)[\s\S]*?\r?\n}\r?\n/)?.[0] || "";
  const notes = js.match(/async function loadNotes\(videoId\)[\s\S]*?\r?\n}\r?\n/)?.[0] || "";

  assert.match(analysis, /sendMessageWithTimeout\(/);
  assert.match(analysis, /action: "analyzeTranscript"/);
  assert.doesNotMatch(analysis, /chrome\.runtime\.sendMessage\(/);
  assert.match(notes, /sendMessageWithTimeout\(/);
  assert.match(notes, /action: "getNotes"/);
  assert.doesNotMatch(notes, /chrome\.runtime\.sendMessage\(/);
  // Reopening the same video must not clear the in-flight flag of a running analysis.
  assert.match(js, /if \(videoChanged\) isAnalysisLoading = false;/);
  assert.doesNotMatch(js, /\n\s{2,4}isAnalysisLoading = false;\r?\n\s*\r?\n\s*\/\/ Restore semantic/);
});

const analysisReply = JSON.stringify({
  summary: {
    headline: "A practical guide",
    overview: "The video explains the main idea and how to apply it.",
    takeaways: ["Start with the core problem", "Test the idea in practice"],
  },
  chapters: [{ title: "Intro", timestamp: "0:00", timestampSeconds: 0, summary: "s" }],
  keyQuotes: [{ quote: "q", timestamp: "1:30", timestampSeconds: 90 }],
  keyMoments: [0],
});

function sseResponse(pieces) {
  const lines = pieces.map(
    (piece) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`,
  );
  lines.push("data: [DONE]\n\n");
  return streamingResponse(lines.map(encode));
}

const promptFetch = (handler) => async (url, options) => {
  if (String(url).startsWith("chrome-extension://")) {
    return { ok: true, status: 200, text: async () => read(String(url).replace("chrome-extension://test/", "")) };
  }
  return handler(JSON.parse(options.body));
};

test("overview analysis streams so a slow model is not cut off as inactive", async () => {
  const bodies = [];
  const half = Math.floor(analysisReply.length / 2);
  const helpers = loadBackgroundHelpers({
    fetchImpl: promptFetch(async (body) => {
      bodies.push(body);
      return sseResponse([analysisReply.slice(0, half), analysisReply.slice(half)]);
    }),
  });

  const result = await helpers.handleAnalyzeTranscript(
    "[0:00] hello [1:30] world", "Title", "Channel", "Description", 200,
  );
  assert.equal(result.success, true);
  assert.equal(result.analysis.summary.headline, "A practical guide");
  assert.equal(result.analysis.summary.takeaways.length, 2);
  assert.equal(result.analysis.summary.takeaways[0], "Start with the core problem");
  assert.equal(result.analysis.summary.takeaways[1], "Test the idea in practice");
  assert.equal(result.analysis.chapters[0].title, "Intro");
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].stream, true);
});

test("overview analysis accepts a plain JSON reply when the gateway ignores streaming", async () => {
  const helpers = loadBackgroundHelpers({
    fetchImpl: promptFetch(async () =>
      streamingResponse([encode(JSON.stringify({ choices: [{ message: { content: analysisReply } }] }))]),
    ),
  });
  const result = await helpers.handleAnalyzeTranscript("[0:00] hi", "T", "C", "D", 100);
  assert.equal(result.success, true);
  assert.equal(result.analysis.keyQuotes[0].quote, "q");
});

test("overview analysis falls back step by step when the gateway rejects parameters", async () => {
  const attempts = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: promptFetch(async (body) => {
      attempts.push({ stream: body.stream === true, format: Boolean(body.response_format) });
      // This gateway rejects response_format but accepts streaming.
      if (body.response_format) {
        return streamingResponse([encode(JSON.stringify({ error: { message: "bad param" } }))], {
          ok: false,
          status: 400,
        });
      }
      return sseResponse([analysisReply]);
    }),
  });
  const result = await helpers.handleAnalyzeTranscript("[0:00] hi", "T", "C", "D", 100);
  assert.equal(result.success, true);
  assert.deepEqual(attempts, [
    { stream: true, format: true },
    { stream: true, format: false },
  ]);
});

test("overview analysis does not retry on errors that a new request cannot fix", async () => {
  let calls = 0;
  const helpers = loadBackgroundHelpers({
    fetchImpl: promptFetch(async () => {
      calls += 1;
      return streamingResponse([encode(JSON.stringify({ error: { message: "bad token" } }))], {
        ok: false,
        status: 401,
      });
    }),
  });
  const result = await helpers.handleAnalyzeTranscript("[0:00] hi", "T", "C", "D", 100);
  assert.equal(result.success, false);
  assert.equal(result.error, "INVALID_AI_KEY");
  assert.equal(calls, 1);
});

test("overview analysis retries once without streaming when the gateway rejects it", async () => {
  const streamFlags = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: promptFetch(async (body) => {
      streamFlags.push(body.stream === true);
      if (body.stream) {
        return streamingResponse([encode(JSON.stringify({ error: { message: "no stream" } }))], {
          ok: false,
          status: 400,
        });
      }
      return streamingResponse([encode(JSON.stringify({ choices: [{ message: { content: analysisReply } }] }))]);
    }),
  });
  const result = await helpers.handleAnalyzeTranscript("[0:00] hi", "T", "C", "D", 100);
  assert.equal(result.success, true);
  // Streaming with response_format, streaming without it, then a plain request.
  assert.deepEqual(streamFlags, [true, true, false]);
});

test("a streamed error event is reported instead of an empty overview", async () => {
  const helpers = loadBackgroundHelpers({
    fetchImpl: promptFetch(async () =>
      streamingResponse([encode(`data: ${JSON.stringify({ error: { message: "model overloaded" } })}\n\n`)]),
    ),
  });
  const result = await helpers.handleAnalyzeTranscript("[0:00] hi", "T", "C", "D", 100);
  assert.equal(result.success, false);
  assert.match(result.error, /model overloaded/);
});

test("overview analysis waits longer than short requests before giving up", async () => {
  const timers = createFakeTimers();
  const helpers = loadBackgroundHelpers({
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    fetchImpl: promptFetch(async () => sseResponse([analysisReply])),
  });
  const result = await helpers.handleAnalyzeTranscript("[0:00] hi", "T", "C", "D", 100);
  assert.equal(result.success, true);
  // The overview uses the longer idle and hard limits, never the 50 and 120 second ones.
  assert.ok(timers.createdCount(90_000) >= 1, "Expected a 90 second idle timer");
  assert.equal(timers.createdCount(240_000), 1);
  assert.equal(timers.createdCount(50_000), 0);
  assert.equal(timers.createdCount(120_000), 0);
  // The service worker keepalive stops when the request ends.
  assert.equal(timers.activeCount(20_000), 0);
});

test("short AI requests keep their 50 and 120 second limits", async () => {
  const timers = createFakeTimers();
  const helpers = loadBackgroundHelpers({
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    fetchImpl: async () =>
      streamingResponse([encode('{"choices":[{"message":{"content":"ok"}}]}')]),
  });
  await helpers.callAiTranslation("Translate.", "Hello.");
  assert.ok(timers.createdCount(50_000) >= 1);
  assert.equal(timers.createdCount(120_000), 1);
  assert.equal(timers.createdCount(90_000), 0);
  assert.equal(timers.createdCount(240_000), 0);
});

test("Overview shows progress while streaming and offers Retry after a failure", () => {
  const js = read("sidepanel.js");
  const css = read("sidepanel.css");
  assert.match(js, /message\.action === "analysisProgress"[\s\S]*?showAnalysisProgress\(/);
  assert.match(js, /Writing the overview\.\.\. \$\{kb\} KB received/);
  assert.match(js, /id="analysisRetryBtn"/);
  assert.match(js, /getElementById\("analysisRetryBtn"\)[\s\S]*?addEventListener\("click", retryAnalysis\)/);
  assert.match(css, /\.analysis-retry-btn:focus-visible\s*\{/);
  assert.doesNotMatch(js, /Switch tabs and try again\.<\/div>`/);
});

test("connection test sends one tiny chat request to the fixed gateway", async () => {
  const seen = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: async (url, options) => {
      seen.push({ url, headers: options.headers, body: JSON.parse(options.body) });
      return streamingResponse([encode('{"choices":[{"message":{"content":"OK"}}]}')]);
    },
  });
  const result = await helpers.handleTestConnection("typed-token", "model-x");
  assert.equal(result.success, true);
  assert.equal(result.model, "model-x");
  assert.equal(typeof result.latencyMs, "number");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "https://api.meding.site/v1/chat/completions");
  assert.equal(seen[0].headers.Authorization, "Bearer typed-token");
  assert.equal(seen[0].body.model, "model-x");
  assert.equal(seen[0].body.max_tokens, 8);
});

test("connection test reports each failure kind without throwing", async () => {
  const run = async (fetchImpl, key = "tok", model = "m") =>
    loadBackgroundHelpers({ fetchImpl, settings: { provider: "openai-compatible", aiApiKey: "", aiModel: "" } })
      .handleTestConnection(key, model);
  const reply = (status, body) => async () =>
    streamingResponse([encode(JSON.stringify(body))], { ok: status < 400, status });

  assert.equal((await run(reply(401, { error: { message: "bad" } }))).error, "INVALID_AI_KEY");
  assert.equal((await run(reply(429, {}))).error, "RATE_LIMITED");
  const failed = await run(reply(500, { error: { message: "upstream down" } }));
  assert.equal(failed.error, "CONNECTION_FAILED");
  assert.equal(failed.message, "upstream down");
  assert.equal((await run(reply(200, { hello: "world" }))).error, "UNEXPECTED_RESPONSE");
  assert.equal((await run(async () => { throw new TypeError("offline"); })).error, "NETWORK");
  assert.equal((await run(async () => { throw Object.assign(new Error("a"), { name: "AbortError" }); })).error, "TIMEOUT");
  assert.equal((await run(reply(200, {}), "", "m")).error, "NO_AI_KEY");
  assert.equal((await run(reply(200, {}), "tok", "")).error, "NO_AI_MODEL");
});

test("Chinese subtitles are detected from the text, not from a language tag", () => {
  const { isChineseText, isChineseTranscript } = loadSidepanelHelpers();
  assert.equal(isChineseText("大家好，欢迎来到今天的节目，我们聊聊缓存。"), true);
  // Names, numbers and a little English inside Chinese do not flip the result.
  assert.equal(isChineseText("今天我们用 Claude Code 写了 3 个 API，效果很好，大家可以试试看。"), true);
  assert.equal(isChineseText("Today we talk about caching and why it matters."), false);
  // Mostly English with a Chinese title is still English.
  assert.equal(
    isChineseText("缓存教程 This whole talk is in English and explains caching in depth for beginners."),
    false,
  );
  assert.equal(isChineseText("123 456 !!!"), false);

  const zh = Array.from({ length: 120 }, (_, i) => ({ start: i, text: `这是第 ${i} 句中文字幕内容。` }));
  // An English intro and outro do not decide a Chinese video.
  zh[0] = { start: 0, text: "Hello everyone, welcome back to the channel." };
  zh[119] = { start: 119, text: "Thanks for watching, see you next time." };
  assert.equal(isChineseTranscript(zh), true);
  const en = Array.from({ length: 50 }, (_, i) => ({ start: i, text: `This is English line number ${i}.` }));
  assert.equal(isChineseTranscript(en), false);
  assert.equal(isChineseTranscript([]), false);
});

test("Chinese-subtitle videos hide the Chinese-only view and translate into English", () => {
  const js = read("sidepanel.js");
  // The Chinese-only view would repeat the original, so it is hidden and blocked.
  assert.match(js, /handleDisplayLanguageModeChange\(mode\)[\s\S]*?currentTranscriptIsChinese && mode === "zh"\) return;/);
  assert.match(js, /button\.hidden = chinese && chineseOnly;/);
  assert.match(js, /if \(chinese && currentTranscriptMode === "zh"\) \{\s*currentTranscriptMode = "bilingual";/);
  // Bilingual stays available, and its translation target is English.
  assert.match(js, /function translationTarget\(\)\s*\{\s*return currentTranscriptIsChinese \? "en" : "zh";/);
  // Interface batches ask for the current target; transcript batches capture it
  // when sent, so a late reply is stored under the language it was asked for.
  assert.match(js, /contentType: "interfaceBatch",\s*targetLanguage: translationTarget\(\)/);
  assert.match(js, /const requestTarget = translationTarget\(\);/);
  assert.match(js, /targetLanguage: requestTarget/);
  assert.doesNotMatch(js, /targetLanguage: "zh"/);
  // English and Chinese translations of one segment never share a cache entry.
  assert.match(js, /\$\{currentVideoId\}:\$\{translationTarget\(\)\}:semantic:/);
  // Every place that sets a new transcript re-checks the language.
  assert.equal((js.match(/applySubtitleLanguageRules\(\);/g) || []).length >= 3, true);
});

test("English is a supported translation target with its own rules and check", async () => {
  const bg = loadBackgroundHelpers();
  const prompt = read("prompts/translation.md");
  assert.match(prompt, /^## English rules$/m);
  assert.match(prompt, /Write Chinese personal names in pinyin/);
  assert.doesNotMatch(prompt, /NOT English syntax translated word-by-word/);

  const source = [{ id: "a", text: "大家好，欢迎来到今天的节目。" }];
  const english = bg.normalizeTranslatedSegmentBatch(
    { segments: [{ id: "a", text: "Hello everyone, welcome to today's show." }] },
    source,
    "en",
  );
  assert.equal(english.segments[0].text, "Hello everyone, welcome to today's show.");
  // Handing the Chinese back, or a reply with no English, is rejected.
  const echoed = bg.normalizeTranslatedSegmentBatch(
    { segments: [{ id: "a", text: "大家好，欢迎来到今天的节目。" }] },
    source,
    "en",
  );
  assert.equal(echoed.segments[0].text, "");
  assert.equal(echoed.segments[0].error, "Missing or invalid translation");
  // The default target is still Chinese.
  const toChinese = bg.normalizeTranslatedSegmentBatch(
    { segments: [{ id: "a", text: "你好，世界" }] },
    [{ id: "a", text: "Hello there, this is a fairly long English sentence." }],
  );
  assert.equal(toChinese.segments[0].text, "你好，世界");

  const requests = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: async (url, options) => {
      if (String(url).startsWith("chrome-extension://")) {
        return { ok: true, status: 200, text: async () => read(String(url).replace("chrome-extension://test/", "")) };
      }
      requests.push(JSON.parse(options.body));
      return streamingResponse([
        encode(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ segments: [{ id: "a", text: "Hello everyone, welcome to the show." }] }) } }],
        })),
      ]);
    },
  });
  const result = await helpers.handleTranslateContent(
    { segments: source },
    "transcriptBatch",
    "en",
    "Title",
  );
  assert.equal(result.success, true);
  assert.match(requests[0].messages[0].content, /Translate the transcript segments into English/);
  assert.match(requests[0].messages[0].content, /clear, natural, modern English/);
  const rejected = await helpers.handleTranslateContent({ segments: source }, "transcriptBatch", "fr", "T");
  assert.equal(rejected.success, false);
  assert.match(rejected.error, /Unsupported translation target/);
});
