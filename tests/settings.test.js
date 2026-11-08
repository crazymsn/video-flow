const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../settings.js");

test("the AI Base URL is fixed and ignores any stored value", () => {
  const normalized = settings.normalize({
    provider: "openai-compatible",
    aiApiKey: "  example-token  ",
    aiBaseUrl: "https://attacker.example/v1",
    aiModel: "  gpt-example  ",
    supadataApiKey: "  example-supadata  ",
  });

  assert.equal(normalized.provider, "openai-compatible");
  assert.equal(normalized.aiBaseUrl, "https://api.meding.site");
  assert.equal(normalized.aiModel, "gpt-example");
  assert.equal(normalized.aiApiKey, "example-token");
  assert.equal(normalized.supadataApiKey, "example-supadata");
  assert.equal(
    settings.chatCompletionsUrl(),
    "https://api.meding.site/v1/chat/completions",
  );
  assert.equal(settings.modelsUrl(), "https://api.meding.site/v1/models");
});

test("there is no default model and invalid model names are dropped", () => {
  assert.equal(settings.DEFAULTS.aiModel, "");
  assert.equal(settings.normalize({}).aiModel, "");
  assert.equal(settings.normalize({ aiModel: "bad model\nname" }).aiModel, "");
  assert.equal(settings.normalize({ aiModel: "<script>" }).aiModel, "");
  assert.equal(settings.normalize({ aiModel: "vendor/model-v2:free" }).aiModel, "vendor/model-v2:free");
});

test("settings from DeepSeek or custom providers are reset and never reused", () => {
  const legacy = {
    provider: "deepseek",
    aiApiKey: "old-deepseek-secret",
    aiBaseUrl: "https://api.deepseek.com",
    aiModel: "deepseek-v4-flash",
    supadataApiKey: " supadata-secret ",
  };
  const first = settings.migrateLegacyProvider(legacy);

  assert.equal(first.migrated, true);
  assert.equal(first.settings.provider, "openai-compatible");
  assert.equal(first.settings.aiBaseUrl, "https://api.meding.site");
  assert.equal(first.settings.aiApiKey, "", "an old key must not reach the new gateway");
  assert.equal(first.settings.aiModel, "");
  assert.equal(first.settings.supadataApiKey, "supadata-secret");

  const custom = settings.migrateLegacyProvider({ ...legacy, provider: "custom" });
  assert.equal(custom.migrated, true);
  assert.equal(custom.settings.aiApiKey, "");

  const second = settings.migrateLegacyProvider(first.settings);
  assert.equal(second.migrated, false);
  assert.deepEqual(second.settings, first.settings);

  const configured = settings.normalize({
    ...first.settings,
    aiApiKey: "new-token",
    aiModel: "model-a",
  });
  assert.equal(configured.aiApiKey, "new-token");
  assert.equal(configured.aiModel, "model-a");
});

test("the model list parser accepts OpenAI-style payloads", () => {
  assert.deepEqual(
    settings.parseModelList({
      object: "list",
      data: [{ id: "zeta" }, { id: "alpha" }, { id: "alpha" }, { id: "" }, { id: "bad name" }, {}],
    }),
    ["alpha", "zeta"],
  );
  assert.deepEqual(settings.parseModelList({ data: ["b", "a"] }), ["a", "b"]);
  assert.deepEqual(settings.parseModelList(null), []);
  assert.deepEqual(settings.parseModelList({ error: "nope" }), []);
});

test("Supadata receives a canonical YouTube URL", () => {
  assert.equal(
    settings.canonicalYouTubeUrl("ydTeb_I0b94"),
    "https://www.youtube.com/watch?v=ydTeb_I0b94",
  );
  assert.throws(
    () => settings.canonicalYouTubeUrl('"><script>'),
    /Invalid YouTube video ID/,
  );
});

test("only YouTube and Bilibili pages are supported", () => {
  assert.equal(settings.isSupportedPageUrl("https://www.youtube.com/watch?v=abc"), true);
  assert.equal(settings.isSupportedPageUrl("https://www.bilibili.com/video/BV1GJ411x7h7"), true);
  assert.equal(settings.isSupportedPageUrl("https://example.com/"), false);
  assert.equal(settings.isSupportedPageUrl("https://www.bilibili.com.evil.example/"), false);
  assert.equal(settings.isSupportedPageUrl("https://notyoutube.com/"), false);
  assert.equal(settings.isSupportedPageUrl("not a url"), false);
  assert.equal(settings.isSupportedPageUrl(undefined), false);
});

test("video URLs resolve to a platform and a stable key", () => {
  assert.deepEqual(settings.parseVideoUrl("https://www.youtube.com/watch?v=ydTeb_I0b94&list=PL1"), {
    platform: "youtube",
    videoId: "ydTeb_I0b94",
  });
  assert.deepEqual(settings.parseVideoUrl("https://youtu.be/ydTeb_I0b94"), {
    platform: "youtube",
    videoId: "ydTeb_I0b94",
  });
  assert.equal(settings.parseVideoUrl("https://www.youtube.com/"), null);

  assert.deepEqual(settings.parseVideoUrl("https://www.bilibili.com/video/BV1GJ411x7h7/?spm_id_from=x"), {
    platform: "bilibili",
    videoId: "BV1GJ411x7h7",
  });
  assert.deepEqual(settings.parseVideoUrl("https://www.bilibili.com/video/BV1GJ411x7h7?p=3"), {
    platform: "bilibili",
    videoId: "BV1GJ411x7h7_p3",
  });
  // Part 1 keeps the plain BV id, and ?p=1 is the same video.
  assert.equal(settings.parseVideoUrl("https://www.bilibili.com/video/BV1GJ411x7h7?p=1").videoId, "BV1GJ411x7h7");
  // Playlist pages carry the BV id in the query.
  assert.equal(
    settings.parseVideoUrl("https://www.bilibili.com/list/watchlater?bvid=BV1GJ411x7h7").videoId,
    "BV1GJ411x7h7",
  );
  assert.equal(settings.parseVideoUrl("https://www.bilibili.com/video/notabvid"), null);
  assert.equal(
    settings.parseVideoUrl("https://www.bilibili.com/video/notabvid?foo=BV1GJ411x7h7"),
    null,
  );
  assert.equal(
    settings.parseVideoUrl("https://www.bilibili.com/video/BV1GJ411x7h7?p=0"),
    null,
  );
  assert.equal(
    settings.parseVideoUrl("https://www.bilibili.com/video/BV1GJ411x7h7?p=10000"),
    null,
  );
});

test("Bilibili keys round trip and rebuild deep links", () => {
  assert.equal(settings.bilibiliKey("BV1GJ411x7h7", 1), "BV1GJ411x7h7");
  assert.equal(settings.bilibiliKey("BV1GJ411x7h7", 4), "BV1GJ411x7h7_p4");
  assert.equal(settings.bilibiliKey("nope", 2), null);
  assert.deepEqual(settings.parseBilibiliKey("BV1GJ411x7h7_p4"), { bvid: "BV1GJ411x7h7", page: 4 });
  assert.deepEqual(settings.parseBilibiliKey("BV1GJ411x7h7"), { bvid: "BV1GJ411x7h7", page: 1 });
  assert.equal(settings.parseBilibiliKey("ydTeb_I0b94"), null);
  assert.equal(settings.platformOf("BV1GJ411x7h7_p2"), "bilibili");
  assert.equal(settings.platformOf("ydTeb_I0b94"), "youtube");

  assert.equal(settings.videoUrl("ydTeb_I0b94"), "https://www.youtube.com/watch?v=ydTeb_I0b94");
  assert.equal(settings.videoUrl("ydTeb_I0b94", 92), "https://www.youtube.com/watch?v=ydTeb_I0b94&t=92s");
  assert.equal(settings.videoUrl("BV1GJ411x7h7", 95), "https://www.bilibili.com/video/BV1GJ411x7h7?t=95");
  assert.equal(settings.videoUrl("BV1GJ411x7h7_p2", 95), "https://www.bilibili.com/video/BV1GJ411x7h7?p=2&t=95");
});
