/**
 * Shared, non-secret configuration helpers.
 *
 * API keys are stored in chrome.storage.local by options.js. This file contains
 * defaults, validation and URL helpers only, so it is safe to publish.
 */
var YTD_SETTINGS = (() => {
  const STORAGE_KEY = "ytd_settings";
  const PROVIDER = "openai-compatible";
  const DEFAULTS = Object.freeze({
    provider: PROVIDER,
    aiApiKey: "",
    // The Base URL is fixed on purpose. Users enter only an API token, so a
    // token can never be redirected to another server from the Settings page.
    aiBaseUrl: "https://api.meding.site",
    aiModel: "",
    supadataApiKey: "",
  });

  const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
  const MODELS_PATH = "/v1/models";
  const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/;
  // Embedding, reranker and speech/music models the gateway lists but that
  // cannot answer chat completions. They are hidden from the model picker.
  const BLOCKED_MODELS = Object.freeze([
    "BAAI/bge-large-en-v1.5",
    "BAAI/bge-large-zh-v1.5",
    "BAAI/bge-m3",
    "BAAI/bge-reranker-v2-m3",
    "chirp-v3-5",
  ]);
  const BLOCKED_MODEL_KEYS = new Set(
    BLOCKED_MODELS.map((model) => model.toLowerCase()),
  );

  function isBlockedModel(value) {
    return (
      typeof value === "string" && BLOCKED_MODEL_KEYS.has(value.trim().toLowerCase())
    );
  }
  const YOUTUBE_HOST = "www.youtube.com";
  const BILIBILI_HOST = "www.bilibili.com";
  const BILIBILI_VIDEO_PATTERN = /^BV[0-9A-Za-z]{10}$/;
  const MAX_BILIBILI_PAGE = 9999;
  const BILIBILI_KEY_PATTERN = /^(BV[0-9A-Za-z]{10})(?:_p([1-9]\d{0,3}))?$/;

  /**
   * Settings saved by earlier versions named a different provider. Those keys
   * belong to another service and must never be sent to the fixed gateway, so
   * they are dropped instead of being carried over.
   */
  function isLegacyProvider(input) {
    return (
      !!input &&
      typeof input.provider === "string" &&
      input.provider !== PROVIDER
    );
  }

  function normalizeModel(value) {
    const model = typeof value === "string" ? value.trim() : "";
    // Blocked models are rejected here too, so a stale saved choice or a
    // manually typed name cannot bring one back.
    return MODEL_NAME_PATTERN.test(model) && !isBlockedModel(model) ? model : "";
  }

  function normalize(input = {}) {
    const legacy = isLegacyProvider(input);
    return {
      provider: DEFAULTS.provider,
      aiApiKey:
        !legacy && typeof input.aiApiKey === "string"
          ? input.aiApiKey.trim()
          : "",
      aiBaseUrl: DEFAULTS.aiBaseUrl,
      aiModel: legacy ? "" : normalizeModel(input.aiModel),
      supadataApiKey:
        typeof input.supadataApiKey === "string"
          ? input.supadataApiKey.trim()
          : "",
    };
  }

  function migrateLegacyProvider(input = {}) {
    return {
      settings: normalize(input),
      migrated: isLegacyProvider(input),
    };
  }

  function chatCompletionsUrl() {
    return `${DEFAULTS.aiBaseUrl}${CHAT_COMPLETIONS_PATH}`;
  }

  function modelsUrl() {
    return `${DEFAULTS.aiBaseUrl}${MODELS_PATH}`;
  }

  /**
   * Reads an OpenAI-style model list ({ data: [{ id }] }) and returns a sorted,
   * de-duplicated list of usable model names.
   */
  function parseModelList(payload) {
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];
    const ids = new Set();
    for (const row of rows) {
      const id = normalizeModel(typeof row === "string" ? row : row?.id);
      // normalizeModel already drops blocked (non-chat) models.
      if (id) ids.add(id);
    }
    return [...ids].sort((a, b) => a.localeCompare(b));
  }

  function canonicalYouTubeUrl(videoId) {
    const normalized = String(videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(normalized)) {
      throw new Error("Invalid YouTube video ID.");
    }
    return `https://www.youtube.com/watch?v=${normalized}`;
  }

  // ------------------------------------------------------------
  // Platforms
  // ------------------------------------------------------------

  function hostnameOf(url) {
    try {
      return new URL(String(url || "")).hostname;
    } catch {
      return "";
    }
  }

  /** Pages where the side panel is available (any page on a supported site). */
  function isSupportedPageUrl(url) {
    const host = hostnameOf(url);
    return host === YOUTUBE_HOST || host === BILIBILI_HOST;
  }

  function isYouTubeUrl(url) {
    return hostnameOf(url) === YOUTUBE_HOST;
  }

  function isBilibiliUrl(url) {
    return hostnameOf(url) === BILIBILI_HOST;
  }

  /** A Bilibili video key is the BV id, plus "_p<N>" for part 2 and later. */
  function bilibiliKey(bvid, page = 1) {
    if (!BILIBILI_VIDEO_PATTERN.test(String(bvid || ""))) return null;
    const part =
      page === undefined || page === null || page === "" ? 1 : Number(page);
    if (!Number.isInteger(part) || part < 1 || part > MAX_BILIBILI_PAGE) {
      return null;
    }
    return part > 1 ? `${bvid}_p${part}` : bvid;
  }

  function parseBilibiliKey(videoId) {
    const match = BILIBILI_KEY_PATTERN.exec(String(videoId || ""));
    if (!match) return null;
    return { bvid: match[1], page: match[2] ? Number(match[2]) : 1 };
  }

  function platformOf(videoId) {
    return parseBilibiliKey(videoId) ? "bilibili" : "youtube";
  }

  /**
   * Identifies the video in a tab URL.
   * Returns { platform, videoId } or null when the page is not a video page.
   * YouTube keeps its plain video ID as the key so existing caches and notes
   * keep working. Bilibili uses the BV id (see bilibiliKey).
   */
  function parseVideoUrl(url) {
    let parsed;
    try {
      parsed = new URL(String(url || ""));
    } catch {
      return null;
    }

    if (parsed.hostname === BILIBILI_HOST) {
      const isVideoPath = parsed.pathname.startsWith("/video/");
      const isPlaylistPath = parsed.pathname.startsWith("/list/");
      if (!isVideoPath && !isPlaylistPath) return null;

      let bvid = null;
      if (isVideoPath) {
        const segment = parsed.pathname.split("/").filter(Boolean)[1] || "";
        if (BILIBILI_VIDEO_PATTERN.test(segment)) bvid = segment;
      } else if (isPlaylistPath) {
        const queryBvid = parsed.searchParams.get("bvid") || "";
        if (BILIBILI_VIDEO_PATTERN.test(queryBvid)) bvid = queryBvid;
      }
      const rawPage = parsed.searchParams.get("p");
      const page = rawPage === null || rawPage === "" ? 1 : Number(rawPage);
      const videoId = bilibiliKey(bvid, page);
      return videoId ? { platform: "bilibili", videoId } : null;
    }

    if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.searchParams.has("v")) {
        return { platform: "youtube", videoId: parsed.searchParams.get("v") };
      }
      if (parsed.pathname.startsWith("/embed/")) {
        const videoId = parsed.pathname.split("/")[2];
        return videoId ? { platform: "youtube", videoId } : null;
      }
      return null;
    }

    if (parsed.hostname === "youtu.be") {
      const videoId = parsed.pathname.slice(1);
      return videoId ? { platform: "youtube", videoId } : null;
    }

    return null;
  }

  /** Canonical watch URL, optionally deep-linked to a timestamp in seconds. */
  function videoUrl(videoId, seconds = 0) {
    const start = Math.max(0, Math.floor(Number(seconds) || 0));
    const bilibili = parseBilibiliKey(videoId);
    if (bilibili) {
      const url = new URL(`https://www.bilibili.com/video/${bilibili.bvid}`);
      if (bilibili.page > 1) url.searchParams.set("p", String(bilibili.page));
      if (start > 0) url.searchParams.set("t", String(start));
      return url.toString();
    }
    const base = canonicalYouTubeUrl(videoId);
    return start > 0 ? `${base}&t=${start}s` : base;
  }

  return {
    STORAGE_KEY,
    DEFAULTS,
    isLegacyProvider,
    normalize,
    normalizeModel,
    migrateLegacyProvider,
    chatCompletionsUrl,
    modelsUrl,
    parseModelList,
    isBlockedModel,
    BLOCKED_MODELS,
    canonicalYouTubeUrl,
    isSupportedPageUrl,
    isYouTubeUrl,
    isBilibiliUrl,
    bilibiliKey,
    parseBilibiliKey,
    platformOf,
    parseVideoUrl,
    videoUrl,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_SETTINGS;
}
