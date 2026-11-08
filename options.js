const YTD_OPTIONS = (() => {
  const LANGUAGE_STORAGE_KEY = "ytd_options_language";
  const PREVIEW_STORAGE_PREFIX = "videoFlowPreview:";
  const SUPPORTED_LANGUAGES = new Set(["en", "zh-CN"]);

  const COPY = {
    en: {
      pageTitle: "Video Flow Settings",
      languageGroupLabel: "Interface language",
      transcriptProvider: "Transcript provider",
      supadataApiKeyLabel: "Supadata API key",
      supadataHelp: "Used to fetch timestamped YouTube subtitles. Bilibili videos need no key. ",
      supadataLink: "Create a Supadata account and key",
      aiProvider:
        '<a href="https://api.meding.site" target="_blank" rel="noreferrer">Enter your API token</a>',
      baseUrlLabel: "Base URL",
      aiApiKeyLabel: "API token",
      aiApiKeyHelp:
        '<a href="https://api.meding.site" target="_blank" rel="noreferrer">Go to the API distribution site to create a token</a>, and models load automatically after you enter the token.',
      modelLabel: "Model",
      modelPlaceholder: "Enter your token to load models",
      refreshModels: "Refresh models",
      manualModelLabel: "Model name",
      saveSettings: "Save settings",
      localData: "Local data",
      localDataHelp:
        "Digests, translations, and notes are stored only in this Chrome profile. You can remove them at any time.",
      clearCache: "Clear cached digests",
      deleteNotes: "Delete all notes",
      resetData: "Reset extension data",
      migrationWarning:
        "Settings from an older version were reset. Your Supadata key was kept, but the old AI key was cleared. Enter an API token for the fixed gateway and choose a model.",
      saving: "Saving…",
      addSupadataKey: "Add a Supadata API key.",
      addAiKey: "Add an API token.",
      addAiModel: "Choose a model.",
      modelsLoading: "Loading models...",
      modelsLoaded: ({ count }) =>
        `Loaded ${count} model${count === 1 ? "" : "s"}.`,
      modelsFailed: "Could not load models. Type a model name instead.",
      testConnection: "Test connection",
      connectionTesting: "Testing connection…",
      connectionOk: ({ model, ms }) =>
        `Connected. ${model} answered in ${ms} ms.`,
      connectionNeedKey: "Enter your API token first.",
      connectionNeedModel: "Choose a model first.",
      connectionInvalidKey: "The API token was rejected. Check it and try again.",
      connectionRateLimited: "The gateway is rate-limiting requests. Try again shortly.",
      connectionTimeout: "The gateway did not answer in time. Try again.",
      connectionNetwork: "Could not reach the gateway. Check your network.",
      connectionUnexpected: "The gateway answered, but not with a chat reply.",
      connectionFailed: ({ detail }) =>
        detail ? `Connection failed: ${detail}` : "Connection failed.",
      modelsInvalidKey: "The API token was rejected. Check it and try again.",
      modelsNone: "No models were returned. Type a model name instead.",
      modelNotListed: ({ model }) => `Saved model "${model}" is not in the list.`,
      saved: "Saved. Reopen Video Flow to use these settings.",
      saveFailed: "Could not save settings. Please try again.",
      clearedDigests: ({ count }) =>
        `Cleared ${count} cached digest${count === 1 ? "" : "s"}.`,
      notesDeleted: "Deleted all saved notes.",
      resetConfirm:
        "Delete API keys, cached digests, translations, and saved notes from this Chrome profile?",
      allDataDeleted: "All Video Flow data was deleted.",
      settingsLoadFailed:
        "Could not load saved settings. You can still preview this page.",
    },
    "zh-CN": {
      pageTitle: "Video Flow 设置",
      languageGroupLabel: "界面语言",
      transcriptProvider: "字幕服务",
      supadataApiKeyLabel: "Supadata API 密钥",
      supadataHelp: "用于获取带时间戳的 YouTube 字幕。Bilibili 视频不需要此密钥。",
      supadataLink: "创建 Supadata 账号并获取密钥",
      aiProvider:
        '<a href="https://api.meding.site" target="_blank" rel="noreferrer">填入 API 密钥</a>',
      baseUrlLabel: "Base URL",
      aiApiKeyLabel: "API 密钥",
      aiApiKeyHelp:
        '<a href="https://api.meding.site" target="_blank" rel="noreferrer">前往 API 分发站创建密钥</a>，填写密钥后会自动获取模型列表',
      modelLabel: "模型",
      modelPlaceholder: "填写密钥后自动加载模型",
      refreshModels: "刷新模型",
      manualModelLabel: "模型名称",
      saveSettings: "保存设置",
      localData: "本地数据",
      localDataHelp:
        "摘要、翻译和笔记仅保存在当前 Chrome 个人资料中。你可以随时删除。",
      clearCache: "清除缓存的摘要",
      deleteNotes: "删除全部笔记",
      resetData: "重置扩展数据",
      migrationWarning:
        "旧版本的设置已重置。Supadata 密钥已保留，旧的 AI 密钥已清除。请输入固定网关的 API 密钥并选择模型。",
      saving: "正在保存…",
      addSupadataKey: "请添加 Supadata API 密钥。",
      addAiKey: "请添加 API 密钥。",
      addAiModel: "请选择模型。",
      modelsLoading: "正在加载模型...",
      modelsLoaded: ({ count }) => `已加载 ${count} 个模型。`,
      modelsFailed: "无法加载模型，请手动填写模型名称。",
      testConnection: "连通性测试",
      connectionTesting: "正在测试连接…",
      connectionOk: ({ model, ms }) => `连接成功。${model} 在 ${ms} 毫秒内响应。`,
      connectionNeedKey: "请先填写 API 密钥。",
      connectionNeedModel: "请先选择模型。",
      connectionInvalidKey: "API 密钥被拒绝，请检查后重试。",
      connectionRateLimited: "网关正在限流，请稍后重试。",
      connectionTimeout: "网关响应超时，请重试。",
      connectionNetwork: "无法连接到网关，请检查网络。",
      connectionUnexpected: "网关有响应，但返回的不是对话结果。",
      connectionFailed: ({ detail }) =>
        detail ? `连接失败：${detail}` : "连接失败。",
      modelsInvalidKey: "API 密钥被拒绝，请检查后重试。",
      modelsNone: "没有返回任何模型，请手动填写模型名称。",
      modelNotListed: ({ model }) => `已保存的模型“${model}”不在列表中。`,
      saved: "已保存。请重新打开 Video Flow 以使用这些设置。",
      saveFailed: "无法保存设置，请重试。",
      clearedDigests: ({ count }) => `已清除 ${count} 条缓存摘要。`,
      notesDeleted: "已删除全部已保存的笔记。",
      resetConfirm:
        "要从当前 Chrome 个人资料中删除 API 密钥、缓存摘要、翻译和已保存的笔记吗？",
      allDataDeleted: "已删除全部 Video Flow 数据。",
      settingsLoadFailed: "无法加载已保存的设置，但你仍可预览此页面。",
    },
  };

  function normalizeLanguage(language) {
    return SUPPORTED_LANGUAGES.has(language) ? language : "en";
  }

  function translate(language, key, params = {}) {
    const normalizedLanguage = normalizeLanguage(language);
    const value = COPY[normalizedLanguage][key] ?? COPY.en[key] ?? "";
    return typeof value === "function" ? value(params) : value;
  }

  function createStorageAdapter(chromeApi, fallbackStorage) {
    const chromeStorage = chromeApi?.storage?.local;
    const memoryStorage = new Map();

    function fallbackKeys() {
      const keys = [];
      if (!fallbackStorage) return keys;
      try {
        for (let index = 0; index < fallbackStorage.length; index += 1) {
          const key = fallbackStorage.key(index);
          if (key?.startsWith(PREVIEW_STORAGE_PREFIX)) keys.push(key);
        }
      } catch (_error) {
        return [];
      }
      return keys;
    }

    function readFallbackValue(key) {
      try {
        const rawValue = fallbackStorage?.getItem(
          `${PREVIEW_STORAGE_PREFIX}${key}`,
        );
        if (rawValue !== null && rawValue !== undefined) {
          return JSON.parse(rawValue);
        }
      } catch (_error) {
        // Fall through to memory when localStorage is unavailable or malformed.
      }
      return memoryStorage.get(key);
    }

    function writeFallbackValue(key, value) {
      memoryStorage.set(key, value);
      try {
        fallbackStorage?.setItem(
          `${PREVIEW_STORAGE_PREFIX}${key}`,
          JSON.stringify(value),
        );
      } catch (_error) {
        // The in-memory copy keeps a restricted preview functional.
      }
    }

    return {
      async get(keys) {
        if (chromeStorage) return chromeStorage.get(keys);

        const requestedKeys =
          keys === null
            ? [
                ...new Set([
                  ...memoryStorage.keys(),
                  ...fallbackKeys().map((key) =>
                    key.slice(PREVIEW_STORAGE_PREFIX.length),
                  ),
                ]),
              ]
            : Array.isArray(keys)
              ? keys
              : [keys];

        return Object.fromEntries(
          requestedKeys
            .map((key) => [key, readFallbackValue(key)])
            .filter(([, value]) => value !== undefined),
        );
      },

      async set(items) {
        if (chromeStorage) return chromeStorage.set(items);
        for (const [key, value] of Object.entries(items)) {
          writeFallbackValue(key, value);
        }
      },

      async remove(keys) {
        if (chromeStorage) return chromeStorage.remove(keys);
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          memoryStorage.delete(key);
          try {
            fallbackStorage?.removeItem(`${PREVIEW_STORAGE_PREFIX}${key}`);
          } catch (_error) {
            // Memory removal is sufficient for this preview session.
          }
        }
      },

      async clear() {
        if (chromeStorage) return chromeStorage.clear();
        memoryStorage.clear();
        for (const key of fallbackKeys()) {
          try {
            fallbackStorage.removeItem(key);
          } catch (_error) {
            // Continue clearing any remaining preview keys.
          }
        }
      },
    };
  }

  async function readPreferredLanguage(storage) {
    const stored = await storage.get(LANGUAGE_STORAGE_KEY);
    return normalizeLanguage(stored[LANGUAGE_STORAGE_KEY]);
  }

  async function persistPreferredLanguage(storage, language) {
    const normalizedLanguage = normalizeLanguage(language);
    await storage.set({ [LANGUAGE_STORAGE_KEY]: normalizedLanguage });
    return normalizedLanguage;
  }

  function updateLanguageButtonState(buttons, language) {
    const normalizedLanguage = normalizeLanguage(language);
    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.language === normalizedLanguage),
      );
    }
  }

  function getSafeLocalStorage(root) {
    try {
      return root.localStorage;
    } catch (_error) {
      return null;
    }
  }

  function initialize(root = globalThis) {
    const doc = root.document;
    const settingsApi = root.YTD_SETTINGS;
    if (!doc || !settingsApi) return;

    const storage = createStorageAdapter(
      root.chrome,
      getSafeLocalStorage(root),
    );
    const form = doc.getElementById("settingsForm");
    const aiApiKeyInput = doc.getElementById("aiApiKey");
    const aiModelSelect = doc.getElementById("aiModel");
    const aiModelManualInput = doc.getElementById("aiModelManual");
    const manualModelRow = doc.getElementById("manualModelRow");
    const refreshModelsBtn = doc.getElementById("refreshModelsBtn");
    const modelStatus = doc.getElementById("modelStatus");
    const supadataApiKeyInput = doc.getElementById("supadataApiKey");
    const saveStatus = doc.getElementById("saveStatus");
    const dataStatus = doc.getElementById("dataStatus");
    const languageButtons = [...doc.querySelectorAll("[data-language]")];
    const statusStates = new Map();
    let currentLanguage = "en";

    function renderStatus(element) {
      const state = statusStates.get(element);
      element.textContent = state
        ? translate(currentLanguage, state.key, state.params)
        : "";
    }

    function setStatus(element, key, params = {}) {
      statusStates.set(element, { key, params });
      renderStatus(element);
    }

    // The save row shows its outcome through data-state: idle, saving, saved
    // or error. CSS turns that into the spinner, check mark and status color.
    const formActions = doc.getElementById("formActions");
    const saveBtn = doc.getElementById("saveBtn");
    let saveStateTimer = null;

    function setSaveState(state) {
      clearTimeout(saveStateTimer);
      if (formActions) formActions.dataset.state = state;
      if (saveBtn) saveBtn.disabled = state === "saving";
      // Return the button to its resting look once the result has been seen.
      // The status sentence stays until the next save.
      if (state === "saved") {
        saveStateTimer = setTimeout(() => {
          if (formActions && formActions.dataset.state === "saved") {
            formActions.dataset.state = "idle";
          }
        }, 2200);
      }
    }

    function applyLanguage(language) {
      currentLanguage = normalizeLanguage(language);
      doc.documentElement.lang = currentLanguage;
      doc.title = translate(currentLanguage, "pageTitle");

      for (const element of doc.querySelectorAll("[data-i18n]")) {
        element.textContent = translate(
          currentLanguage,
          element.dataset.i18n,
        );
      }
      for (const element of doc.querySelectorAll("[data-i18n-html]")) {
        element.innerHTML = translate(
          currentLanguage,
          element.dataset.i18nHtml,
        );
      }
      for (const element of doc.querySelectorAll("[data-i18n-aria-label]")) {
        element.setAttribute(
          "aria-label",
          translate(currentLanguage, element.dataset.i18nAriaLabel),
        );
      }

      updateLanguageButtonState(languageButtons, currentLanguage);
      for (const element of statusStates.keys()) renderStatus(element);
    }

    // ---- Model list -------------------------------------------------
    // The model comes from the gateway's model list, loaded with the typed
    // token. If the list cannot be loaded, a free-text field takes over.
    let modelRequestId = 0;
    let manualModelMode = false;

    function setModelPlaceholder(key) {
      aiModelSelect.replaceChildren();
      const option = doc.createElement("option");
      option.value = "";
      option.dataset.i18n = "modelPlaceholder";
      option.textContent = translate(currentLanguage, key);
      aiModelSelect.append(option);
      aiModelSelect.disabled = true;
    }

    function setManualModelMode(enabled) {
      manualModelMode = enabled;
      manualModelRow.hidden = !enabled;
      aiModelSelect.hidden = enabled;
    }

    function selectedModel() {
      const raw = manualModelMode ? aiModelManualInput.value : aiModelSelect.value;
      return settingsApi.normalizeModel(raw);
    }

    function fillModelList(models, preferred) {
      aiModelSelect.replaceChildren();
      const usableModels = models.filter(
        (model) => !settingsApi.isBlockedModel(model),
      );
      const safePreferred = settingsApi.isBlockedModel(preferred)
        ? ""
        : preferred;
      const list = usableModels.includes(safePreferred) || !safePreferred
        ? usableModels
        : [safePreferred, ...usableModels];
      for (const model of list) {
        const option = doc.createElement("option");
        option.value = model;
        option.textContent = model;
        aiModelSelect.append(option);
      }
      aiModelSelect.disabled = false;
      aiModelSelect.value = safePreferred && list.includes(safePreferred)
        ? safePreferred
        : list[0];
      setManualModelMode(false);
    }

    async function loadModels({ preferred = selectedModel() } = {}) {
      const apiKey = aiApiKeyInput.value.trim();
      if (!apiKey) {
        modelRequestId += 1;
        setManualModelMode(false);
        setModelPlaceholder("modelPlaceholder");
        modelStatus.textContent = "";
        statusStates.delete(modelStatus);
        return;
      }
      const requestId = (modelRequestId += 1);
      setStatus(modelStatus, "modelsLoading");
      let reply = null;
      try {
        reply = await root.chrome?.runtime?.sendMessage({
          action: "listModels",
          apiKey,
        });
      } catch (_error) {
        reply = null;
      }
      // A newer request (or an edited token) supersedes this one.
      if (requestId !== modelRequestId) return;

      if (reply?.success && reply.models?.length) {
        fillModelList(reply.models, preferred);
        resetConnectionResult();
        setStatus(modelStatus, "modelsLoaded", { count: reply.models.length });
        if (preferred && !reply.models.includes(preferred)) {
          setStatus(modelStatus, "modelNotListed", { model: preferred });
        }
        return;
      }
      setManualModelMode(true);
      aiModelManualInput.value = preferred || "";
      setStatus(
        modelStatus,
        reply?.error === "INVALID_AI_KEY"
          ? "modelsInvalidKey"
          : reply?.error === "NO_MODELS"
            ? "modelsNone"
            : "modelsFailed",
      );
    }

    let modelDebounce = null;
    function scheduleModelLoad() {
      clearTimeout(modelDebounce);
      modelDebounce = setTimeout(() => void loadModels(), 600);
    }

    async function loadSettings() {
      try {
        const stored = await storage.get(settingsApi.STORAGE_KEY);
        const migration = settingsApi.migrateLegacyProvider(
          stored[settingsApi.STORAGE_KEY],
        );
        const settings = migration.settings;

        aiApiKeyInput.value = settings.aiApiKey;
        supadataApiKeyInput.value = settings.supadataApiKey;
        if (migration.migrated) {
          await storage.set({ [settingsApi.STORAGE_KEY]: settings });
          setStatus(saveStatus, "migrationWarning");
        }
        await loadModels({ preferred: settings.aiModel });
      } catch (_error) {
        setStatus(saveStatus, "settingsLoadFailed");
      }
    }

    async function loadOptions() {
      try {
        applyLanguage(await readPreferredLanguage(storage));
      } catch (_error) {
        applyLanguage("en");
      }
      await loadSettings();
    }

    async function saveSettings(event) {
      event.preventDefault();
      setSaveState("saving");
      setStatus(saveStatus, "saving");

      const settings = settingsApi.normalize({
        aiApiKey: aiApiKeyInput.value,
        aiModel: selectedModel(),
        supadataApiKey: supadataApiKeyInput.value,
      });

      // The Supadata key is optional: Bilibili videos work without it, and
      // YouTube videos ask for it when they need it.
      if (!settings.aiApiKey) {
        setSaveState("error");
        setStatus(saveStatus, "addAiKey");
        return;
      }
      if (!settings.aiModel) {
        setSaveState("error");
        setStatus(saveStatus, "addAiModel");
        return;
      }

      try {
        await storage.set({ [settingsApi.STORAGE_KEY]: settings });
        setSaveState("saved");
        setStatus(saveStatus, "saved");
      } catch (_error) {
        setSaveState("error");
        setStatus(saveStatus, "saveFailed");
      }
    }

    async function clearCachedDigests() {
      const all = await storage.get(null);
      const keys = Object.keys(all).filter((key) => key.startsWith("digest_"));
      if (keys.length) await storage.remove(keys);
      setStatus(dataStatus, "clearedDigests", { count: keys.length });
    }

    async function clearNotes() {
      await storage.remove("ytd_notes");
      setStatus(dataStatus, "notesDeleted");
    }

    async function resetAllData() {
      const confirmed = root.confirm(
        translate(currentLanguage, "resetConfirm"),
      );
      if (!confirmed) return;

      await storage.clear();
      await persistPreferredLanguage(storage, currentLanguage);
      await loadSettings();
      setStatus(dataStatus, "allDataDeleted");
    }

    // ---- Connection test --------------------------------------------
    // One tiny chat request with the token and model on screen, so a bad pair
    // is found before saving. Elements are optional so older markup still works.
    const testConnectionBtn = doc.getElementById("testConnectionBtn");
    const connectionStatus = doc.getElementById("connectionStatus");
    let connectionRequestId = 0;

    function setConnectionState(state) {
      if (connectionStatus) connectionStatus.dataset.state = state;
      if (testConnectionBtn) {
        testConnectionBtn.dataset.state = state;
        testConnectionBtn.disabled = state === "testing" || !canTestConnection();
      }
    }

    function canTestConnection() {
      return Boolean(aiApiKeyInput.value.trim() && selectedModel());
    }

    // A result belongs to the token and model that produced it. Editing either
    // one clears it, so a stale green message never describes new input.
    function resetConnectionResult() {
      connectionRequestId += 1;
      if (connectionStatus) {
        connectionStatus.textContent = "";
        statusStates.delete(connectionStatus);
      }
      setConnectionState("idle");
    }

    function connectionFailureKey(reply) {
      switch (reply?.error) {
        case "NO_AI_KEY":
          return ["connectionNeedKey", {}];
        case "NO_AI_MODEL":
          return ["connectionNeedModel", {}];
        case "INVALID_AI_KEY":
          return ["connectionInvalidKey", {}];
        case "RATE_LIMITED":
          return ["connectionRateLimited", {}];
        case "TIMEOUT":
          return ["connectionTimeout", {}];
        case "NETWORK":
          return ["connectionNetwork", {}];
        case "UNEXPECTED_RESPONSE":
          return ["connectionUnexpected", {}];
        default:
          return ["connectionFailed", { detail: reply?.message || "" }];
      }
    }

    async function testConnection() {
      if (!connectionStatus || !canTestConnection()) {
        resetConnectionResult();
        return;
      }
      const requestId = (connectionRequestId += 1);
      setConnectionState("testing");
      setStatus(connectionStatus, "connectionTesting");

      let reply = null;
      try {
        reply = await root.chrome?.runtime?.sendMessage({
          action: "testConnection",
          apiKey: aiApiKeyInput.value.trim(),
          model: selectedModel(),
        });
      } catch (_error) {
        reply = { success: false, error: "NETWORK" };
      }
      // The token or model changed while the request was in flight.
      if (requestId !== connectionRequestId) return;

      if (reply?.success) {
        setConnectionState("ok");
        setStatus(connectionStatus, "connectionOk", {
          model: reply.model,
          ms: reply.latencyMs,
        });
        return;
      }
      setConnectionState("error");
      const [key, params] = connectionFailureKey(reply);
      setStatus(connectionStatus, key, params);
    }

    form.addEventListener("submit", saveSettings);
    aiApiKeyInput.addEventListener("input", () => {
      resetConnectionResult();
      scheduleModelLoad();
    });
    aiModelSelect.addEventListener?.("change", resetConnectionResult);
    aiModelManualInput.addEventListener?.("input", resetConnectionResult);
    testConnectionBtn?.addEventListener("click", () => void testConnection());
    refreshModelsBtn.addEventListener("click", () => {
      clearTimeout(modelDebounce);
      void loadModels();
    });
    doc
      .getElementById("clearCacheBtn")
      .addEventListener("click", clearCachedDigests);
    doc.getElementById("clearNotesBtn").addEventListener("click", clearNotes);
    doc.getElementById("resetBtn").addEventListener("click", resetAllData);
    for (const button of languageButtons) {
      button.addEventListener("click", async () => {
        const language = button.dataset.language;
        applyLanguage(language);
        await persistPreferredLanguage(storage, language);
      });
    }

    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", loadOptions, { once: true });
    } else {
      void loadOptions();
    }
  }

  return {
    COPY,
    LANGUAGE_STORAGE_KEY,
    createStorageAdapter,
    normalizeLanguage,
    persistPreferredLanguage,
    readPreferredLanguage,
    translate,
    updateLanguageButtonState,
    initialize,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_OPTIONS;
}

if (typeof document !== "undefined") {
  YTD_OPTIONS.initialize();
}
