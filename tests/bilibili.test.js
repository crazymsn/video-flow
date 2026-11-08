const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const B = require("../bilibili.js");

const BVID = "BV1GJ411x7h7";
// Example vector from the public Bilibili API documentation for WBI signing.
const KEYS = {
  imgKey: "7cd084941338484aae1ad9425b84077c",
  subKey: "4932caff0ff746eab6f01bf08b70ac45",
};

test("built-in MD5 matches node:crypto", () => {
  for (const sample of [
    "",
    "abc",
    "The quick brown fox jumps over the lazy dog",
    "中文字幕测试",
    "a".repeat(55),
    "a".repeat(56),
    "a".repeat(64),
    "x".repeat(1000),
  ]) {
    assert.equal(B.md5(sample), crypto.createHash("md5").update(sample).digest("hex"));
  }
});

test("WBI signing matches the published example vector", () => {
  assert.equal(B.mixinKey(KEYS.imgKey, KEYS.subKey), "ea1db124af3c7062474693fa704f4ff8");
  assert.equal(
    B.signQuery({ foo: "114", bar: "514", zab: 1919810 }, KEYS, 1702204169),
    "bar=514&foo=114&wts=1702204169&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4",
  );
  assert.equal(
    B.sortedQuery({ foo: "one one four", bar: "五一四", baz: 1919810 }),
    "bar=%E4%BA%94%E4%B8%80%E5%9B%9B&baz=1919810&foo=one%20one%20four",
  );
  assert.equal(B.sortedQuery({ a: "x!'()*y" }), "a=xy");
  assert.throws(() => B.mixinKey("short", "keys"), /invalid WBI key/);
  assert.equal(B.keyFromImageUrl("https://i0.hdslb.com/bfs/wbi/abc123.png?x=1"), "abc123");
});

const jsonResponse = (payload, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => payload,
  text: async () => JSON.stringify(payload),
});

function createFetch({
  viewData,
  tracks,
  fallbackTracks = [],
  needLogin = false,
  subtitleBody,
  viewCode = 0,
}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const href = String(url);
    if (href.startsWith("https://api.bilibili.com/x/web-interface/view")) {
      return jsonResponse({ code: viewCode, message: "x", data: viewData });
    }
    if (href.startsWith("https://api.bilibili.com/x/web-interface/nav")) {
      return jsonResponse({
        code: -101,
        data: {
          wbi_img: {
            img_url: `https://i0.hdslb.com/bfs/wbi/${KEYS.imgKey}.png`,
            sub_url: `https://i0.hdslb.com/bfs/wbi/${KEYS.subKey}.png`,
          },
        },
      });
    }
    if (href.startsWith("https://api.bilibili.com/x/player/wbi/v2")) {
      return jsonResponse({
        code: 0,
        data: { need_login_subtitle: needLogin, subtitle: { subtitles: tracks } },
      });
    }
    if (href.startsWith("https://api.bilibili.com/x/v2/subtitle/web/view")) {
      return jsonResponse({
        data: { subtitle: { subtitles: fallbackTracks } },
      });
    }
    if (href.includes("hdslb.com/bfs/subtitle")) {
      return jsonResponse(subtitleBody);
    }
    throw new Error(`Unexpected URL: ${href}`);
  };
  impl.calls = calls;
  return impl;
}

const VIEW_DATA = {
  bvid: BVID,
  aid: 170001,
  title: "Whole video",
  desc: "A description",
  owner: { name: "Uploader", mid: 7 },
  duration: 600,
  pages: [
    { page: 1, cid: 1111, part: "Part one", duration: 300 },
    { page: 2, cid: 2222, part: "Part two", duration: 300 },
  ],
};

test("track picking prefers manual over AI and Chinese over English", () => {
  const track = (lang, isAi) => ({ lang, isAi, url: `https://aisubtitle.hdslb.com/${lang}` });
  assert.equal(B.pickTrack([track("ai-zh", true), track("en", false)]).lang, "en");
  assert.equal(B.pickTrack([track("en", false), track("zh-Hans", false)]).lang, "zh-Hans");
  assert.equal(B.pickTrack([track("ai-en", true), track("ai-zh", true)]).lang, "ai-zh");
  assert.equal(B.pickTrack([]), null);
});

test("subtitle URLs must be HTTPS and on hdslb.com", () => {
  const plain = "https://aisubtitle.hdslb.com/bfs/subtitle/test.json?auth_key=abc";
  const [prefix, key] = [
    "nP](wOFRvU.+<fjS{jn-!$D|Dz&\",zT`",
    "=CFxYRn{.y|uVyO$uh&sikph?N.ilF/`",
  ];
  const path = "/bfs/subtitle/test.json";
  const xor = (text, secret) => [...text].map((char, index) =>
    String.fromCharCode(char.charCodeAt(0) ^ secret.charCodeAt(index % secret.length)),
  ).join("");
  const obfuscated = encodeURIComponent(xor(`${prefix}${path}`, `${key}bilibili`));
  const obfuscatedUrl = `https://subtitle.bilibili.com/${obfuscated}?auth_key=abc`;

  assert.equal(B.decodeSubtitleUrl(plain), plain);
  assert.equal(B.decodeSubtitleUrl(obfuscatedUrl), plain);
  assert.equal(B.isTrustedSubtitleUrl("https://aisubtitle.hdslb.com/bfs/subtitle/a.json"), true);
  assert.equal(B.isTrustedSubtitleUrl("https://hdslb.com/a.json"), true);
  assert.equal(B.isTrustedSubtitleUrl("http://aisubtitle.hdslb.com/a.json"), false);
  assert.equal(B.isTrustedSubtitleUrl("https://hdslb.com.evil.example/a.json"), false);
  assert.equal(B.isTrustedSubtitleUrl("https://evil.example/hdslb.com/a.json"), false);
  assert.equal(B.isTrustedSubtitleUrl("javascript:alert(1)"), false);

  const tracks = B.normalizeTracks({
    subtitle: {
      subtitles: [
        { lan: "zh-Hans", lan_doc: "中文", subtitle_url: "//aisubtitle.hdslb.com/bfs/subtitle/a.json" },
        { lan: "en", subtitle_url: "" },
        { lan: "ai-zh", ai_type: 1, subtitle_url: "https://aisubtitle.hdslb.com/b.json" },
      ],
    },
  });
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].url, "https://aisubtitle.hdslb.com/bfs/subtitle/a.json");
  assert.equal(tracks[1].isAi, true);
});

test("fetching a Bilibili transcript returns the shared transcript shape", async () => {
  const fetchImpl = createFetch({
    viewData: VIEW_DATA,
    tracks: [
      { lan: "ai-zh", lan_doc: "AI", ai_type: 1, subtitle_url: "https://aisubtitle.hdslb.com/bfs/subtitle/ai.json" },
      { lan: "zh-Hans", lan_doc: "中文", subtitle_url: "//aisubtitle.hdslb.com/bfs/subtitle/manual.json" },
    ],
    subtitleBody: {
      body: [
        { from: 0.4, to: 2.5, content: "  第一句  " },
        { from: 65.2, to: 70, content: "第二句" },
        { from: 71, to: 72, content: "   " },
      ],
    },
  });

  const result = await B.fetchTranscript(BVID, 2, { fetchImpl });

  assert.equal(result.success, true);
  assert.equal(result.language, "zh-Hans");
  assert.deepEqual(result.transcript, [
    { text: "第一句", start: 0, duration: 2, language: "zh-Hans" },
    { text: "第二句", start: 65, duration: 4, language: "zh-Hans" },
  ]);
  assert.equal(result.transcriptText, "第一句 第二句");
  assert.equal(result.transcriptTextTimestamped, "[0:00] 第一句\n[1:05] 第二句");
  assert.equal(result.videoInfo.title, "Part two");
  assert.equal(result.videoInfo.channelName, "Uploader");

  // Part 2 must use that part's cid, and the player call must be signed.
  const playerCall = fetchImpl.calls.find((call) => call.url.includes("/x/player/wbi/v2"));
  assert.match(playerCall.url, /cid=2222/);
  assert.match(playerCall.url, /w_rid=[0-9a-f]{32}/);
  assert.match(playerCall.url, /wts=\d+/);
  // API calls carry cookies and a page referrer; the subtitle CDN call must not.
  assert.equal(playerCall.init.credentials, "include");
  assert.equal(playerCall.init.referrer, "https://www.bilibili.com/");
  const cdnCall = fetchImpl.calls.find((call) => call.url.includes("hdslb.com/bfs/subtitle"));
  assert.equal(cdnCall.init.credentials, "omit");
});

test("the player subtitle endpoint is used when wbi/v2 hides tracks", async () => {
  const fetchImpl = createFetch({
    viewData: VIEW_DATA,
    tracks: [],
    needLogin: true,
    fallbackTracks: [
      {
        lan: "zh-Hans",
        lan_doc: "中文",
        subtitle_url: "https://aisubtitle.hdslb.com/bfs/subtitle/fallback.json",
      },
    ],
    subtitleBody: { body: [{ from: 1, to: 2, content: "回退字幕" }] },
  });

  const result = await B.fetchTranscript(BVID, 1, { fetchImpl });
  assert.equal(result.success, true);
  assert.equal(result.transcript[0].text, "回退字幕");
  assert.equal(
    fetchImpl.calls.some((call) => call.url.includes("/x/v2/subtitle/web/view")),
    true,
  );
});

test("a video without subtitles reports why", async () => {
  const none = await B.fetchTranscript(BVID, 1, {
    fetchImpl: createFetch({ viewData: VIEW_DATA, tracks: [] }),
  });
  assert.equal(none.success, false);
  assert.equal(none.error, "NO_TRANSCRIPT");

  const login = await B.fetchTranscript(BVID, 1, {
    fetchImpl: createFetch({ viewData: VIEW_DATA, tracks: [], needLogin: true }),
  });
  assert.equal(login.success, false);
  assert.equal(login.error, "NEED_LOGIN");
  assert.match(login.message, /log in to Bilibili/i);

  const invalidPart = await B.fetchTranscript(BVID, 3, {
    fetchImpl: createFetch({ viewData: VIEW_DATA, tracks: [] }),
  });
  assert.equal(invalidPart.error, "PART_UNAVAILABLE");

  const empty = await B.fetchTranscript(BVID, 1, {
    fetchImpl: createFetch({
      viewData: VIEW_DATA,
      tracks: [{ lan: "zh-Hans", subtitle_url: "https://aisubtitle.hdslb.com/bfs/subtitle/e.json" }],
      subtitleBody: { body: [] },
    }),
  });
  assert.equal(empty.error, "EMPTY_TRANSCRIPT");
});

test("untrusted subtitle hosts are never downloaded", async () => {
  const fetchImpl = createFetch({
    viewData: VIEW_DATA,
    tracks: [{ lan: "zh-Hans", subtitle_url: "https://evil.example/steal.json" }],
    subtitleBody: { body: [{ from: 0, to: 1, content: "x" }] },
  });
  const result = await B.fetchTranscript(BVID, 1, { fetchImpl });

  assert.equal(result.success, false);
  assert.equal(result.error, "NO_TRANSCRIPT");
  assert.equal(fetchImpl.calls.some((call) => call.url.includes("evil.example")), false);
});

test("Bilibili API error codes become readable errors", async () => {
  const gone = await B.fetchTranscript(BVID, 1, {
    fetchImpl: createFetch({ viewData: null, tracks: [], viewCode: -404 }),
  });
  assert.equal(gone.error, "VIDEO_UNAVAILABLE");

  const blocked = await B.fetchTranscript(BVID, 1, {
    fetchImpl: createFetch({ viewData: null, tracks: [], viewCode: -352 }),
  });
  assert.equal(blocked.error, "RISK_CONTROL");

  const invalid = await B.fetchTranscript("not-a-bvid", 1, {
    fetchImpl: createFetch({ viewData: VIEW_DATA, tracks: [] }),
  });
  assert.equal(invalid.error, "INVALID_BVID");
});
