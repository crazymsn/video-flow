const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const options = require("../options.js");

// A tiny DOM that is just big enough for options.js: elements by id, option
// lists, listeners and the data-i18n pass.
function createDom() {
  class El {
    constructor(tag, id = "") {
      this.tagName = tag;
      this.id = id;
      this.value = "";
      this.hidden = false;
      this.disabled = false;
      this.textContent = "";
      this.children = [];
      this.dataset = {};
      this.listeners = {};
      this.attrs = {};
    }
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    }
    async fire(type, event = {}) {
      for (const fn of this.listeners[type] || []) {
        await fn({ preventDefault() {}, ...event });
      }
    }
    append(...nodes) {
      this.children.push(...nodes);
      if (this.tagName === "select" && !this.value && this.children[0]) {
        this.value = this.children[0].value;
      }
    }
    replaceChildren(...nodes) {
      this.children = [];
      this.value = "";
      this.append(...nodes);
    }
    setAttribute(name, value) {
      this.attrs[name] = value;
    }
  }

  const ids = [
    "settingsForm",
    "aiApiKey",
    "aiModel",
    "aiModelManual",
    "manualModelRow",
    "refreshModelsBtn",
    "modelStatus",
    "supadataApiKey",
    "customizationPrompt",
    "copyCustomizationPromptBtn",
    "copyStatus",
    "saveStatus",
    "dataStatus",
    "clearCacheBtn",
    "clearNotesBtn",
    "resetBtn",
  ];
  const byId = Object.fromEntries(
    ids.map((id) => [id, new El(id === "aiModel" ? "select" : "div", id)]),
  );
  byId.manualModelRow.hidden = true;
  byId.aiModel.disabled = true;
  byId.aiModel.append(Object.assign(new El("option"), { value: "" }));

  const doc = {
    readyState: "complete",
    documentElement: {},
    title: "",
    getElementById: (id) => byId[id] || null,
    querySelectorAll: () => [],
    createElement: (tag) => new El(tag),
    addEventListener() {},
  };
  return { doc, byId };
}

async function openSettings({ stored, models }) {
  const { doc, byId } = createDom();
  const sent = [];
  const storage = { ...stored };
  const timers = [];
  const fakeRoot = {
    document: doc,
    YTD_SETTINGS: require("../settings.js"),
    chrome: {
      runtime: {
        sendMessage: async (message) => {
          sent.push(message);
          return typeof models === "function" ? models(message) : models;
        },
      },
      storage: {
        local: {
          get: async (key) =>
            key === null ? { ...storage } : { [key]: storage[key] },
          set: async (items) => Object.assign(storage, items),
          remove: async () => {},
          clear: async () => {},
        },
      },
    },
    confirm: () => true,
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: null,
  };

  // options.js debounces model loading with setTimeout. Capture those timers so
  // the test decides exactly when the pause is over.
  const realSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => {
    timers.push(fn);
    return timers.length;
  };
  try {
    options.initialize(fakeRoot);
    await new Promise((resolve) => realSetTimeout(resolve, 20));
  } finally {
    global.setTimeout = realSetTimeout;
  }
  return { byId, sent, storage, timers };
}

const storedSettings = (extra = {}) => ({
  ytd_settings: {
    provider: "openai-compatible",
    aiApiKey: "token-1",
    aiModel: "model-b",
    supadataApiKey: "",
    ...extra,
  },
});

test("saved token loads the model list and restores the saved model", async () => {
  const { byId, sent } = await openSettings({
    stored: storedSettings(),
    models: { success: true, models: ["model-a", "model-b", "model-c"] },
  });

  assert.deepEqual(sent, [{ action: "listModels", apiKey: "token-1" }]);
  assert.equal(byId.aiModel.disabled, false);
  assert.deepEqual(
    byId.aiModel.children.map((option) => option.value),
    ["model-a", "model-b", "model-c"],
  );
  assert.equal(byId.aiModel.value, "model-b");
  assert.equal(byId.manualModelRow.hidden, true);
});

test("a failed model fetch falls back to typing a model name", async () => {
  const { byId } = await openSettings({
    stored: storedSettings(),
    models: { success: false, error: "MODEL_LIST_FAILED" },
  });

  assert.equal(byId.manualModelRow.hidden, false);
  assert.equal(byId.aiModelManual.value, "model-b");
  assert.match(byId.modelStatus.textContent, /type a model name/i);
});

test("a rejected token is reported", async () => {
  const { byId } = await openSettings({
    stored: storedSettings(),
    models: { success: false, error: "INVALID_AI_KEY" },
  });
  assert.match(byId.modelStatus.textContent, /token was rejected/i);
});

test("no token means no network call and a disabled picker", async () => {
  const { byId, sent } = await openSettings({
    stored: storedSettings({ aiApiKey: "", aiModel: "" }),
    models: { success: true, models: ["x"] },
  });
  assert.deepEqual(sent, []);
  assert.equal(byId.aiModel.disabled, true);
});

test("typing a token loads models automatically after a short pause", async () => {
  const { byId, sent, timers } = await openSettings({
    stored: storedSettings({ aiApiKey: "", aiModel: "" }),
    models: { success: true, models: ["alpha", "beta"] },
  });
  assert.deepEqual(sent, []);

  const realSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => {
    timers.push(fn);
    return timers.length;
  };
  try {
    byId.aiApiKey.value = "  fresh-token  ";
    await byId.aiApiKey.fire("input");
  } finally {
    global.setTimeout = realSetTimeout;
  }
  assert.deepEqual(sent, [], "must wait for the pause before fetching");
  assert.ok(timers.length > 0);

  await timers.at(-1)();
  await new Promise((resolve) => realSetTimeout(resolve, 10));

  assert.deepEqual(sent, [{ action: "listModels", apiKey: "fresh-token" }]);
  assert.deepEqual(
    byId.aiModel.children.map((option) => option.value),
    ["alpha", "beta"],
  );
  assert.equal(byId.aiModel.disabled, false);
});

test("saving requires a token and a model but not a Supadata key", async () => {
  const noModel = await openSettings({
    stored: storedSettings({ aiModel: "" }),
    models: { success: false, error: "MODEL_LIST_FAILED" },
  });
  noModel.byId.aiModelManual.value = "";
  await noModel.byId.settingsForm.fire("submit");
  assert.match(noModel.byId.saveStatus.textContent, /choose a model/i);

  const ok = await openSettings({
    stored: storedSettings(),
    models: { success: true, models: ["model-a", "model-b"] },
  });
  ok.byId.aiModel.value = "model-a";
  await ok.byId.settingsForm.fire("submit");
  assert.match(ok.byId.saveStatus.textContent, /saved/i);
  assert.equal(ok.storage.ytd_settings.aiModel, "model-a");
  assert.equal(ok.storage.ytd_settings.aiApiKey, "token-1");
  assert.equal(ok.storage.ytd_settings.supadataApiKey, "");
  assert.equal(ok.storage.ytd_settings.aiBaseUrl, "https://api.meding.site");
});

test("settings saved by the DeepSeek version are reset on open", async () => {
  const { byId, storage, sent } = await openSettings({
    stored: {
      ytd_settings: {
        provider: "deepseek",
        aiApiKey: "old-deepseek-secret",
        aiBaseUrl: "https://api.deepseek.com",
        aiModel: "deepseek-v4-flash",
        supadataApiKey: "keep-me",
      },
    },
    models: { success: true, models: ["x"] },
  });

  assert.equal(storage.ytd_settings.aiApiKey, "");
  assert.equal(storage.ytd_settings.supadataApiKey, "keep-me");
  assert.equal(storage.ytd_settings.provider, "openai-compatible");
  assert.equal(byId.aiApiKey.value, "");
  assert.deepEqual(sent, [], "an old key must never be sent to the new gateway");
  assert.match(byId.saveStatus.textContent, /older version/i);
});

test("the Base URL field is read-only and fixed in the page", () => {
  const html = read("options.html");
  const field = html.match(/<input[^>]*id="aiBaseUrl"[^>]*>/s)?.[0] || "";
  assert.match(field, /value="https:\/\/api\.meding\.site"/);
  assert.match(field, /\sreadonly\s/);
  assert.doesNotMatch(read("options.js"), /getElementById\("aiBaseUrl"\)/);
});
