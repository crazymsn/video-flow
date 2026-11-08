/**
 * Bilibili transcript source.
 *
 * Bilibili subtitles come from Bilibili's own web API, so no third-party
 * transcript service or key is involved:
 *
 *  1. x/web-interface/view  : BV id -> aid, cid, title, uploader, parts
 *  2. x/web-interface/nav   : WBI image keys used to sign the next request
 *  3. x/player/wbi/v2       : aid + cid -> subtitle track list (signed)
 *  4. the track's subtitle_url (hdslb.com CDN) -> { body: [{ from, to, content }] }
 *
 * Requests to api.bilibili.com include the browser's Bilibili cookies, exactly
 * like the Bilibili web player. Bilibili hides most subtitles from signed-out
 * users, so a login is usually needed. No credential is read or stored here.
 *
 * This file is loaded by the service worker with importScripts(), and by
 * Node tests with require().
 */
var YTD_BILIBILI = (() => {
  const API_ORIGIN = "https://api.bilibili.com";
  const VIEW_URL = `${API_ORIGIN}/x/web-interface/view`;
  const NAV_URL = `${API_ORIGIN}/x/web-interface/nav`;
  const PLAYER_URL = `${API_ORIGIN}/x/player/wbi/v2`;
  const SUBTITLE_VIEW_URL = `${API_ORIGIN}/x/v2/subtitle/web/view`;
  // The player obfuscates some subtitle URLs with one of these XOR keys.
  const SUBTITLE_URL_KEYS = Object.freeze([
    Object.freeze(["nP](wOFRvU.+<fjS{jn-!$D|Dz&\",zT`", "=CFxYRn{.y|uVyO$uh&sikph?N.ilF/`"]),
    Object.freeze(["Bn\"q~|albg@]Go~ACgyDvKnd+)_D}^&J?", "Cu~L!xs~f^&r@'vh=q]q{eeng*sEg^kp#J"]),
  ]);
  const SUBTITLE_URL_SUFFIX = "bilibili";
  const SUBTITLE_CDN_ORIGIN = "https://aisubtitle.hdslb.com";
  // Bilibili serves empty subtitle lists to requests without a page referrer.
  const PAGE_REFERRER = "https://www.bilibili.com/";
  const MAX_SUBTITLE_BYTES = 8 * 1024 * 1024;

  // Preference order for subtitle language codes. Manual tracks always beat
  // AI tracks (codes starting with "ai-").
  const LANGUAGE_PREFERENCE = Object.freeze([
    "zh-Hans",
    "zh-Hant",
    "zh-CN",
    "zh",
    "en",
    "en-US",
    "ai-zh",
    "ai-en",
  ]);

  class BilibiliError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "BilibiliError";
      this.code = code;
    }
  }

  // ------------------------------------------------------------
  // MD5 (Web Crypto has no MD5, and WBI signatures need it)
  // ------------------------------------------------------------

  const MD5_SHIFTS = [
    [7, 12, 17, 22],
    [5, 9, 14, 20],
    [4, 11, 16, 23],
    [6, 10, 15, 21],
  ];
  const MD5_TABLE = new Uint32Array(64);
  for (let i = 0; i < 64; i += 1) {
    MD5_TABLE[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);
  }

  function md5(input) {
    const bytes = new TextEncoder().encode(String(input));
    const bitLength = bytes.length * 8;
    const padded = new Uint8Array((((bytes.length + 8) >>> 6) + 1) * 64);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, bitLength >>> 0, true);
    view.setUint32(padded.length - 4, Math.floor(bitLength / 2 ** 32), true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const words = new Uint32Array(16);

    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) {
        words[i] = view.getUint32(offset + i * 4, true);
      }
      let a = a0;
      let b = b0;
      let c = c0;
      let d = d0;
      for (let i = 0; i < 64; i += 1) {
        const round = i >> 4;
        let mix;
        let index;
        if (round === 0) {
          mix = (b & c) | (~b & d);
          index = i;
        } else if (round === 1) {
          mix = (d & b) | (~d & c);
          index = (5 * i + 1) % 16;
        } else if (round === 2) {
          mix = b ^ c ^ d;
          index = (3 * i + 5) % 16;
        } else {
          mix = c ^ (b | ~d);
          index = (7 * i) % 16;
        }
        const sum = (mix + a + MD5_TABLE[i] + words[index]) >>> 0;
        const shift = MD5_SHIFTS[round][i % 4];
        a = d;
        d = c;
        c = b;
        b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0;
      }
      a0 = (a0 + a) >>> 0;
      b0 = (b0 + b) >>> 0;
      c0 = (c0 + c) >>> 0;
      d0 = (d0 + d) >>> 0;
    }

    const out = new DataView(new ArrayBuffer(16));
    [a0, b0, c0, d0].forEach((word, i) => out.setUint32(i * 4, word, true));
    let hex = "";
    for (let i = 0; i < 16; i += 1) {
      hex += out.getUint8(i).toString(16).padStart(2, "0");
    }
    return hex;
  }

  // ------------------------------------------------------------
  // WBI request signing
  // ------------------------------------------------------------

  // Fixed permutation published by Bilibili's web client. One wrong entry
  // invalidates every signature, so tests pin it to a known vector.
  const MIXIN_KEY_TABLE = Object.freeze([
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52,
  ]);

  function keyFromImageUrl(url) {
    const fileName = String(url || "").split("?")[0].split("/").pop() || "";
    const dot = fileName.lastIndexOf(".");
    return dot === -1 ? fileName : fileName.slice(0, dot);
  }

  function mixinKey(imgKey, subKey) {
    const raw = `${imgKey || ""}${subKey || ""}`;
    if (raw.length < 64) {
      throw new BilibiliError("WBI_KEY", "Bilibili returned an invalid WBI key.");
    }
    return MIXIN_KEY_TABLE.map((index) => raw[index])
      .join("")
      .slice(0, 32);
  }

  // The signature is defined over encodeURIComponent output, not URLSearchParams
  // (which turns spaces into "+"). Characters !'()* are stripped from values.
  function sortedQuery(params) {
    return Object.keys(params)
      .sort()
      .map((key) => {
        const value = String(params[key] ?? "").replace(/[!'()*]/g, "");
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join("&");
  }

  function signQuery(params, keys, nowSeconds) {
    const wts = Number.isFinite(nowSeconds)
      ? Math.floor(nowSeconds)
      : Math.floor(Date.now() / 1000);
    const withTime = { ...params, wts };
    const query = sortedQuery(withTime);
    return `${query}&w_rid=${md5(query + mixinKey(keys.imgKey, keys.subKey))}`;
  }

  const WBI_KEY_TTL_MS = 60 * 60 * 1000;
  let cachedKeys = null;

  function requestInit(extra = {}) {
    return {
      credentials: "include",
      cache: "no-store",
      referrer: PAGE_REFERRER,
      referrerPolicy: "strict-origin-when-cross-origin",
      headers: { Accept: "application/json, text/plain, */*" },
      ...extra,
    };
  }

  async function fetchWbiKeys({ fetchImpl = fetch, force = false } = {}) {
    if (!force && cachedKeys && Date.now() - cachedKeys.at < WBI_KEY_TTL_MS) {
      return cachedKeys.keys;
    }
    const response = await fetchImpl(NAV_URL, requestInit());
    if (!response.ok) {
      throw new BilibiliError("HTTP_ERROR", `Bilibili request failed: HTTP ${response.status}`);
    }
    // nav answers "not logged in" (code -101) but still includes the keys.
    const payload = await response.json();
    const imgKey = keyFromImageUrl(payload?.data?.wbi_img?.img_url);
    const subKey = keyFromImageUrl(payload?.data?.wbi_img?.sub_url);
    if (!imgKey || !subKey) {
      throw new BilibiliError("WBI_KEY", "Bilibili did not return WBI keys.");
    }
    cachedKeys = { keys: { imgKey, subKey }, at: Date.now() };
    return cachedKeys.keys;
  }

  // ------------------------------------------------------------
  // API calls
  // ------------------------------------------------------------

  const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;

  async function readEnvelope(response) {
    if (!response.ok) {
      throw new BilibiliError("HTTP_ERROR", `Bilibili request failed: HTTP ${response.status}`);
    }
    const payload = await response.json();
    const code = payload?.code;
    if (code === 0) return payload.data;
    if (code === -404 || code === 62002 || code === 62004) {
      throw new BilibiliError("VIDEO_UNAVAILABLE", "This Bilibili video does not exist or is unavailable.");
    }
    if (code === -101) {
      throw new BilibiliError("NEED_LOGIN", "Log in to Bilibili in this browser, then try again.");
    }
    if (code === -403) {
      throw new BilibiliError("FORBIDDEN", "Bilibili denied access to this video.");
    }
    if (code === -352) {
      throw new BilibiliError(
        "RISK_CONTROL",
        "Bilibili blocked the request. Open the video normally in this browser, wait a moment, then try again.",
      );
    }
    throw new BilibiliError(
      "API_ERROR",
      payload?.message || `Bilibili returned error code ${code}.`,
    );
  }

  async function fetchVideoInfo(bvid, page = 1, { fetchImpl = fetch } = {}) {
    if (!BVID_PATTERN.test(String(bvid || ""))) {
      throw new BilibiliError("INVALID_BVID", "Invalid Bilibili video ID.");
    }
    const url = `${VIEW_URL}?${sortedQuery({ bvid })}`;
    const data = await readEnvelope(await fetchImpl(url, requestInit()));
    const parts = Array.isArray(data?.pages) ? data.pages : [];
    const requestedPage = Number(page);
    if (!Number.isInteger(requestedPage) || requestedPage < 1) {
      throw new BilibiliError("INVALID_PART", "Invalid Bilibili video part.");
    }
    const part = parts.length
      ? parts.find((item) => Number(item?.page) === requestedPage)
      : requestedPage === 1
        ? data
        : null;
    if (!part) {
      throw new BilibiliError("PART_UNAVAILABLE", "This Bilibili video part is unavailable.");
    }
    const cid = Number(part?.cid ?? data?.cid) || 0;
    if (!cid) {
      throw new BilibiliError("NO_CID", "Bilibili did not return the video part ID.");
    }
    return {
      bvid: String(data?.bvid || bvid),
      aid: Number(data?.aid) || 0,
      cid,
      page,
      title: (parts.length > 1 && part?.part) || data?.title || "",
      description: data?.desc || "",
      owner: data?.owner?.name || "",
      ownerMid: Number(data?.owner?.mid) || 0,
      duration: Number(part?.duration ?? data?.duration) || 0,
    };
  }

  function xorText(text, key) {
    let result = "";
    for (let index = 0; index < text.length; index += 1) {
      result += String.fromCharCode(
        text.charCodeAt(index) ^ key.charCodeAt(index % key.length),
      );
    }
    return result;
  }

  /** Convert the obfuscated subtitle URL used by some Bilibili responses. */
  function decodeSubtitleUrl(url) {
    const raw = String(url || "");
    if (!raw.includes("//subtitle.bilibili.com/")) {
      return raw.startsWith("//") ? `https:${raw}` : raw;
    }
    const splitAt = raw.indexOf("?");
    const encodedPath = splitAt === -1 ? raw : raw.slice(0, splitAt);
    const query = splitAt === -1 ? "" : raw.slice(splitAt + 1);
    const match = encodedPath.match(/\/\/subtitle\.bilibili\.com\/([^?]+)/);
    if (!match) return raw.startsWith("//") ? `https:${raw}` : raw;

    let decodedPath = "";
    let pathPart;
    try {
      pathPart = decodeURIComponent(match[1]);
    } catch {
      return raw.startsWith("//") ? `https:${raw}` : raw;
    }
    for (const [prefix, key] of SUBTITLE_URL_KEYS) {
      const plain = xorText(pathPart, `${key}${SUBTITLE_URL_SUFFIX}`);
      if (plain.startsWith(prefix)) {
        decodedPath = plain.slice(prefix.length);
        break;
      }
    }
    if (!decodedPath) return raw.startsWith("//") ? `https:${raw}` : raw;
    const absolute = `${SUBTITLE_CDN_ORIGIN}${decodedPath.startsWith("/") ? "" : "/"}${decodedPath}`;
    return query ? `${absolute}?${query}` : absolute;
  }

  function readVarint(bytes, offset) {
    let value = 0;
    let shift = 0;
    let index = offset;
    while (index < bytes.length && shift <= 28) {
      const byte = bytes[index++];
      value += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return [value, index];
      shift += 7;
    }
    return [null, index];
  }

  function skipVarint(bytes, offset) {
    let index = offset;
    while (index < bytes.length && index - offset < 10) {
      if ((bytes[index++] & 0x80) === 0) return index;
    }
    return index;
  }

  function readUtf8(bytes) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      for (const character of text) {
        const code = character.charCodeAt(0);
        if (code < 32 && !"\t\n\r".includes(character)) return null;
      }
      return text;
    } catch {
      return null;
    }
  }

  // The fallback endpoint returns protobuf rather than JSON. We only need its
  // string fields: language, label and subtitle URL.
  function parseSubtitleMessages(bytes, depth = 0, found = []) {
    if (!(bytes instanceof Uint8Array) || depth > 6) return found;
    let index = 0;
    const strings = [];
    while (index < bytes.length) {
      const [key, afterKey] = readVarint(bytes, index);
      if (key == null) return found;
      index = afterKey;
      const wire = key & 7;
      if (wire === 0) {
        index = skipVarint(bytes, index);
      } else if (wire === 2) {
        const [length, afterLength] = readVarint(bytes, index);
        if (length == null || afterLength + length > bytes.length) return found;
        index = afterLength + length;
        const chunk = bytes.subarray(afterLength, index);
        const text = readUtf8(chunk);
        if (text != null) strings.push(text);
        else parseSubtitleMessages(chunk, depth + 1, found);
      } else if (wire === 1) {
        index += 8;
      } else if (wire === 5) {
        index += 4;
      } else {
        return found;
      }
    }
    const url = strings.find((text) =>
      text.includes("subtitle.bilibili.com") || text.includes(".hdslb.com"),
    );
    const lang = strings.find((text) =>
      /^(ai-)?[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(text),
    );
    if (url && lang) {
      const labels = strings
        .filter((text) => text !== url && text !== lang && !/^\d+$/.test(text))
        .sort((a, b) => b.length - a.length);
      found.push({ lan: lang, lan_doc: labels[0] || lang, subtitle_url: url });
    }
    return found;
  }

  function normalizeTracks(playerData) {
    const rows = Array.isArray(playerData?.subtitle?.subtitles)
      ? playerData.subtitle.subtitles
      : [];
    const tracks = [];
    for (const row of rows) {
      const rawUrl = String(row?.subtitle_url || "");
      if (!rawUrl) continue;
      const url = decodeSubtitleUrl(rawUrl);
      const lang = String(row?.lan || "");
      tracks.push({
        lang,
        label: String(row?.lan_doc || lang),
        url,
        isAi:
          Number(row?.ai_type) > 0 ||
          Number(row?.ai_status) > 0 ||
          lang.startsWith("ai-"),
        authorMid: Number(row?.author_mid) || 0,
      });
    }
    return tracks;
  }

  // Subtitle files must come from Bilibili's own CDN over HTTPS.
  function isTrustedSubtitleUrl(url) {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === "https:" &&
        (parsed.hostname === "hdslb.com" || parsed.hostname.endsWith(".hdslb.com"))
      );
    } catch {
      return false;
    }
  }

  async function readSubtitleViewResponse(response) {
    if (typeof response?.arrayBuffer === "function") {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length) return [];
      if (bytes[0] === 0x7b || bytes[0] === 0x5b) {
        try {
          const payload = JSON.parse(new TextDecoder().decode(bytes));
          return normalizeTracks(payload.data || payload);
        } catch {
          return [];
        }
      }
      return normalizeTracks({ subtitle: { subtitles: parseSubtitleMessages(bytes) } });
    }
    if (typeof response?.json === "function") {
      try {
        const payload = await response.json();
        return normalizeTracks(payload.data || payload);
      } catch {
        return [];
      }
    }
    return [];
  }

  async function fetchSubtitleViewTracks(info, keys, { fetchImpl }) {
    const params = {
      oid: info.cid,
      pid: info.aid,
      context_ext: JSON.stringify({ video_type: 1 }),
      type: 1,
      cur_production_type: 0,
      playlist_switch: 0,
    };
    const query = signQuery(params, keys);
    const response = await fetchImpl(`${SUBTITLE_VIEW_URL}?${query}`, requestInit());
    if (response?.ok === false) return [];
    return readSubtitleViewResponse(response);
  }

  async function fetchSubtitleTracks(info, { fetchImpl = fetch } = {}) {
    const keys = await fetchWbiKeys({ fetchImpl });
    const query = signQuery({ aid: info.aid, cid: info.cid, bvid: info.bvid }, keys);
    const data = await readEnvelope(await fetchImpl(`${PLAYER_URL}?${query}`, requestInit()));
    let tracks = normalizeTracks(data).filter((track) => isTrustedSubtitleUrl(track.url));
    let needLogin = !!data?.need_login_subtitle;
    // The player uses this protobuf endpoint when wbi/v2 hides the list for a
    // signed-out browser. It is still a Bilibili endpoint and uses the same WBI keys.
    if (!tracks.length && info.aid && info.cid) {
      try {
        const fallback = await fetchSubtitleViewTracks(info, keys, { fetchImpl });
        const visible = fallback.filter((track) => isTrustedSubtitleUrl(track.url));
        if (visible.length) {
          tracks = visible;
          needLogin = false;
        }
      } catch {
        // Keep the original need-login or no-subtitles result.
      }
    }
    return { tracks, needLogin };
  }

  function rankOf(track) {
    const index = LANGUAGE_PREFERENCE.indexOf(track.lang);
    return index === -1 ? LANGUAGE_PREFERENCE.length : index;
  }

  // Manual subtitles first, then the language preference, then AI tracks.
  function pickTrack(tracks) {
    if (!Array.isArray(tracks) || !tracks.length) return null;
    const manual = tracks.filter((track) => !track.isAi);
    const pool = manual.length ? manual : tracks;
    return [...pool].sort((a, b) => rankOf(a) - rankOf(b))[0];
  }

  function normalizeSubtitleBody(payload, language) {
    const body = Array.isArray(payload?.body) ? payload.body : [];
    const lines = [];
    for (const row of body) {
      const text = String(row?.content ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const from = Math.max(0, Number(row?.from) || 0);
      const to = Math.max(from, Number(row?.to) || from);
      lines.push({
        text,
        start: Math.floor(from),
        duration: Math.floor(to - from),
        language: language || null,
      });
    }
    return lines;
  }

  async function downloadSubtitle(track, { fetchImpl = fetch } = {}) {
    // The CDN authorizes through the URL itself, so cookies are not needed.
    const response = await fetchImpl(
      track.url,
      requestInit({ credentials: "omit", cache: "default" }),
    );
    if (!response.ok) {
      throw new BilibiliError(
        "SUBTITLE_DOWNLOAD_FAILED",
        `Bilibili subtitle download failed: HTTP ${response.status}. Try again.`,
      );
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_SUBTITLE_BYTES) {
      throw new BilibiliError("SUBTITLE_TOO_LARGE", "The Bilibili subtitle file is too large.");
    }
    return normalizeSubtitleBody(JSON.parse(text), track.lang);
  }

  function formatClock(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
  }

  /**
   * Fetches the best subtitle track for one video part and returns the same
   * shape the YouTube path returns.
   */
  async function fetchTranscript(bvid, page = 1, { fetchImpl = fetch } = {}) {
    try {
      const info = await fetchVideoInfo(bvid, page, { fetchImpl });
      const { tracks, needLogin } = await fetchSubtitleTracks(info, { fetchImpl });
      const track = pickTrack(tracks);
      if (!track) {
        return needLogin
          ? {
              success: false,
              error: "NEED_LOGIN",
              message:
                "Bilibili only shows this video's subtitles to logged-in users. Log in to Bilibili in this browser, then try again.",
            }
          : {
              success: false,
              error: "NO_TRANSCRIPT",
              message: "This Bilibili video has no subtitle track.",
            };
      }

      const transcript = await downloadSubtitle(track, { fetchImpl });
      if (!transcript.length) {
        return {
          success: false,
          error: "EMPTY_TRANSCRIPT",
          message: "The Bilibili subtitle track is empty.",
        };
      }
      return {
        success: true,
        transcript,
        transcriptText: transcript.map((line) => line.text).join(" "),
        transcriptTextTimestamped: transcript
          .map((line) => `[${formatClock(line.start)}] ${line.text}`)
          .join("\n"),
        language: track.lang || null,
        videoInfo: {
          title: info.title,
          channelName: info.owner,
          description: info.description,
          duration: info.duration,
        },
      };
    } catch (error) {
      if (error instanceof BilibiliError) {
        return { success: false, error: error.code, message: error.message };
      }
      return { success: false, error: error?.message || "Failed to fetch the Bilibili transcript." };
    }
  }

  return {
    md5,
    mixinKey,
    sortedQuery,
    signQuery,
    keyFromImageUrl,
    fetchWbiKeys,
    fetchVideoInfo,
    fetchSubtitleTracks,
    normalizeTracks,
    decodeSubtitleUrl,
    isTrustedSubtitleUrl,
    pickTrack,
    normalizeSubtitleBody,
    fetchTranscript,
    BilibiliError,
    LANGUAGE_PREFERENCE,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_BILIBILI;
}
