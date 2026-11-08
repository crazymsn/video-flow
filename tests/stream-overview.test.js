const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Loads the real background.js in a sandbox, the same way Chrome's
// importScripts() does, and returns its test-only exports.
function loadBackground() {
  const listeners = { addListener() {} };
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    AbortController,
    setTimeout: () => 0,
    clearTimeout: () => {},
    fetch: async () => ({ ok: true, status: 200, text: async () => "" }),
    importScripts() {},
    chrome: {
      storage: {
        local: {
          setAccessLevel: () => Promise.resolve(),
          get: async () => ({}),
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
  return sandbox.__YTD_TRANSLATION_TESTING__;
}

const sse = (content) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

test("completed chapters are pulled out of a reply that is still being written", () => {
  const { extractCompletedItems, extractStreamedContent } = loadBackground();
  const full = JSON.stringify({
    chapters: [
      { title: "Intro, {not a brace}", timestampSeconds: 0, summary: 'He said "hi"' },
      { title: "Two", timestampSeconds: 60, summary: "s" },
    ],
    keyQuotes: [{ quote: "q", timestampSeconds: 90 }],
    keyMoments: [0],
  });
  const count = (cut, key) => extractCompletedItems(full.slice(0, cut), key).length;

  assert.equal(count(20, "chapters"), 0);
  // The first "}" in the text sits inside a title string, so it must not end
  // the chapter. The real end is the brace before the second chapter starts.
  const insideTitle = full.indexOf("}") + 1;
  assert.equal(count(insideTitle, "chapters"), 0);
  // A chapter counts as complete only once its own closing brace has arrived.
  const firstEnd = full.indexOf('},{"title":"Two"') + 1;
  assert.equal(count(firstEnd - 1, "chapters"), 0);
  assert.equal(count(firstEnd, "chapters"), 1);
  assert.equal(count(full.length, "chapters"), 2);
  assert.equal(count(full.length, "keyQuotes"), 1);

  // Quotes and braces inside strings do not end an object early.
  const items = extractCompletedItems(full, "chapters");
  assert.equal(items[0].title, "Intro, {not a brace}");
  assert.equal(items[0].summary, 'He said "hi"');
  // Arrays built inside the vm sandbox have a different prototype, so compare
  // by length rather than by reference shape.
  assert.equal(extractCompletedItems("", "chapters").length, 0);
  assert.equal(extractCompletedItems(full, "missing").length, 0);

  // Streamed event text is joined back into the model's JSON.
  const events = ['{"chapters":[', '{"title":"A"}', "]}"].map(sse).join("");
  assert.equal(extractStreamedContent(events), '{"chapters":[{"title":"A"}]}');
  assert.equal(extractStreamedContent('{"chapters":[]}'), '{"chapters":[]}');
});

test("the progress reporter sends each new chapter once, already validated", () => {
  const { createAnalysisProgressReporter } = loadBackground();
  const chapter = (title, seconds) => ({ title, timestampSeconds: seconds, summary: "s" });
  const stream = (chapters) => sse(JSON.stringify({ chapters }));
  const messages = [];
  const reporter = createAnalysisProgressReporter("vid", 120, (message) =>
    messages.push(message),
  );

  reporter(100, stream([chapter("A", 0)]));
  reporter(200, stream([chapter("A", 0), chapter("B", 60)]));
  // The same content again adds nothing new, so no chapter message is sent.
  const afterSecond = messages.length;
  reporter(300, stream([chapter("A", 0), chapter("B", 60)]));
  assert.equal(
    messages.slice(afterSecond).some((message) => message.partial),
    false,
  );
  // A chapter past the end of the video is dropped by the same validator as
  // the final result.
  reporter(400, stream([chapter("A", 0), chapter("B", 60), chapter("Late", 9999)]));

  assert.equal(messages[0].action, "analysisProgress");
  assert.equal(messages[0].videoId, "vid");
  assert.equal(messages[0].partial.chapters.length, 1);
  assert.equal(messages[1].partial.chapters.length, 2);
  const everyChapter = messages.flatMap((message) => message.partial?.chapters || []);
  assert.equal(everyChapter.some((item) => item.title === "Late"), false);
});

test("the panel shows streamed chapters as a draft and only translates the final result", () => {
  const js = read("sidepanel.js");
  assert.match(js, /function renderAnalysisResults\(analysis, \{ draft = false \} = \{\}\)/);
  assert.match(js, /showAnalysisProgress\(message\.bytes, message\.partial, message\.videoId\)/);
  assert.match(js, /renderAnalysisResults\(partial, \{ draft: true \}\)/);
  // A draft never starts translation, and a message for another video is ignored.
  assert.match(
    js,
    /if \(\s*!draft &&\s*currentTranscriptMode !== "original" &&\s*resultTabIsActive\("overview"\)\s*\)/,
  );
  assert.match(js, /if \(videoId && videoId !== currentVideoId\) return;/);
  assert.match(js, /videoId: requestVideoId,/);
});
