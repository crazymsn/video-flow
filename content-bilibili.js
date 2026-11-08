/**
 * BILIBILI CONTENT SCRIPT
 *
 * Runs on bilibili.com/video/* and bilibili.com/list/* pages. It:
 * 1. Reports the current video (BV id, part, title, uploader, duration).
 * 2. Adds a "Digest" button and a "Note" button, and the "n" shortcut.
 * 3. Seeks the player when the side panel asks it to.
 *
 * Bilibili renders its player with Vue. Touching the page before it settles can
 * make Vue rebuild the player, so every DOM change waits for the player and a
 * short settle delay. Nodes are built with DOM calls, never innerHTML, because
 * Bilibili may enforce Trusted Types.
 */
(() => {
  "use strict";

  const DIGEST_BUTTON_ID = "vd-bili-digest-button";
  const NOTE_BUTTON_ID = "vd-bili-note-button";
  const OVERLAY_ID = "vd-bili-overlay";
  const TOAST_ID = "vd-bili-toast";
  const SETTLE_DELAY_MS = 1200;
  const PLAYER_POLL_MS = 200;
  const PLAYER_WAIT_TIMEOUT_MS = 15000;
  const REINJECT_INTERVAL_MS = 800;
  // Rewind a little so the note captures what the viewer just heard.
  const NOTE_REWIND_SECONDS = 3;

  // Tried in order. The first match wins. Covers the new and old video pages.
  const TOOLBAR_SELECTORS = [
    ".video-toolbar-left",
    ".video-toolbar-container .toolbar-left",
    "#arc_toolbar_report .toolbar-left",
    ".toolbar-left",
  ];
  // The floating overlay must NOT go into the element that directly holds the
  // <video>: Bilibili's player owns that node and rebuilds it on foreign children.
  const PLAYER_SELECTORS = [
    "#bilibili-player .bpx-player-primary-area",
    "#bilibili-player",
    ".bpx-player-container",
    "#playerWrap",
  ];

  const videoElement = () =>
    document.querySelector(".bpx-player-video-wrap video") ||
    document.querySelector("video");

  function currentBvid() {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments[0] === "video" && /^BV[0-9A-Za-z]{10}$/.test(segments[1] || "")) {
      return segments[1];
    }
    if (segments[0] === "list") {
      const queryBvid = new URLSearchParams(location.search).get("bvid") || "";
      if (/^BV[0-9A-Za-z]{10}$/.test(queryBvid)) return queryBvid;
    }
    return null;
  }

  function currentPart() {
    const raw = new URLSearchParams(location.search).get("p");
    if (raw === null || raw === "") return 1;
    const part = Number(raw);
    return Number.isInteger(part) && part >= 1 && part <= 9999 ? part : null;
  }

  // Same key format the side panel and background use: BV id, "_pN" from part 2.
  function currentVideoKey() {
    const bvid = currentBvid();
    const part = currentPart();
    if (!bvid || part === null) return null;
    return part > 1 ? `${bvid}_p${part}` : bvid;
  }

  function readVideoInfo() {
    const title =
      document.querySelector("h1.video-title") ||
      document.querySelector(".video-title") ||
      document.querySelector("h1[title]");
    const owner =
      document.querySelector(".up-info-container .up-name") ||
      document.querySelector("a.up-name") ||
      document.querySelector(".up-name");
    const description = document.querySelector(
      ".basic-desc-info, .desc-info-text, .video-desc-container",
    );
    return {
      title:
        title?.getAttribute("title")?.trim() ||
        title?.textContent?.trim() ||
        document.title.replace(/_哔哩哔哩.*$/, "").trim(),
      channelName: owner?.textContent?.trim() || "",
      description: description?.textContent?.trim() || "",
      duration: Number(videoElement()?.duration) || 0,
    };
  }

  // ------------------------------------------------------------
  // Buttons
  // ------------------------------------------------------------

  const BASE_STYLE =
    "display:inline-flex;align-items:center;gap:6px;padding:6px 14px;" +
    "border:none;border-radius:6px;cursor:pointer;font-size:13px;" +
    "line-height:1.4;color:#fff;white-space:nowrap;";

  function firstMatch(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function holdsVideoDirectly(element) {
    return Array.from(element.children || []).some(
      (child) => child.tagName === "VIDEO",
    );
  }

  function playerContainer() {
    for (const selector of PLAYER_SELECTORS) {
      const element = document.querySelector(selector);
      if (element && !holdsVideoDirectly(element)) return element;
    }
    return null;
  }

  function ensureOverlay() {
    const player = playerContainer();
    if (!player) return null;
    const existing = player.querySelector(`#${OVERLAY_ID}`);
    if (existing?.isConnected) return existing;

    if (getComputedStyle(player).position === "static") {
      player.style.position = "relative";
    }
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText =
      "position:absolute;top:12px;right:12px;z-index:9999;display:flex;" +
      "flex-direction:column;align-items:flex-end;gap:8px;";
    player.appendChild(overlay);
    return overlay;
  }

  function makeButton(id, label, title, background, floating, onClick) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.title = title;
    button.textContent = label;
    button.style.cssText =
      BASE_STYLE +
      `background:${background};` +
      (floating
        ? "box-shadow:0 2px 8px rgba(0,0,0,.2);"
        : "margin-left:12px;");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function flash(button, text, restore) {
    if (!button) return;
    button.textContent = text;
    setTimeout(() => {
      if (button.isConnected) button.textContent = restore;
    }, 2000);
  }

  async function openSidePanel() {
    let result = null;
    try {
      result = await chrome.runtime.sendMessage({ action: "openSidePanel" });
    } catch (error) {
      // The service worker may be restarting. Treated as "could not open".
    }
    if (!result?.success) {
      flash(
        document.getElementById(DIGEST_BUTTON_ID),
        "Use the toolbar icon",
        "Digest",
      );
    }
  }

  function injectDigestButton() {
    if (document.getElementById(DIGEST_BUTTON_ID)?.isConnected) return;
    const toolbar = firstMatch(TOOLBAR_SELECTORS);
    const overlay = toolbar ? null : ensureOverlay();
    const host = toolbar || overlay;
    if (!host) return;
    host.appendChild(
      makeButton(
        DIGEST_BUTTON_ID,
        "Digest",
        "Open the Video Flow side panel",
        "#d43366",
        !toolbar,
        openSidePanel,
      ),
    );
  }

  function injectNoteButton() {
    if (document.getElementById(NOTE_BUTTON_ID)?.isConnected) return;
    const overlay = ensureOverlay();
    if (!overlay) return;
    overlay.appendChild(
      makeButton(
        NOTE_BUTTON_ID,
        "Note",
        "Save a note at this moment (shortcut: n)",
        "rgba(0,0,0,.55)",
        true,
        saveNoteAtCurrentTime,
      ),
    );
  }

  // ------------------------------------------------------------
  // Notes
  // ------------------------------------------------------------

  let noteInFlight = false;

  function showToast(note) {
    document.getElementById(TOAST_ID)?.remove();
    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:999999;background:#fff;" +
      "border:1px solid #ece4e7;border-radius:12px;padding:14px 18px;" +
      "max-width:340px;box-shadow:0 12px 32px rgba(0,0,0,.2);color:#2b2629;" +
      "font:13px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif;";

    const heading = document.createElement("div");
    heading.style.cssText = "font-weight:700;margin-bottom:4px;color:#c9385f;";
    heading.textContent = "Note saved";
    const meta = document.createElement("div");
    meta.style.cssText = "font-size:12px;color:#6e6569;margin-bottom:6px;";
    meta.textContent = `${note.timestamp} ${note.videoTitle || ""}`.trim();
    const body = document.createElement("div");
    body.textContent = note.text || "";
    toast.append(heading, meta, body);

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  async function saveNoteAtCurrentTime() {
    const video = videoElement();
    const videoId = currentVideoKey();
    const button = document.getElementById(NOTE_BUTTON_ID);
    if (!video || !videoId || noteInFlight) return;

    noteInFlight = true;
    const info = readVideoInfo();
    if (button) button.textContent = "Saving...";
    try {
      const result = await chrome.runtime.sendMessage({
        action: "saveNote",
        videoId,
        timestamp: Math.max(
          0,
          Math.floor(video.currentTime || 0) - NOTE_REWIND_SECONDS,
        ),
        videoTitle: info.title,
        channelName: info.channelName,
      });
      if (result?.success) {
        flash(button, "Saved", "Note");
        showToast(result.note);
      } else {
        flash(button, "Failed", "Note");
      }
    } catch (error) {
      flash(button, "Failed", "Note");
    } finally {
      noteInFlight = false;
    }
  }

  // Letters typed into the comment box or search field must not trigger a note.
  function isTypingTarget(target) {
    const tag = target?.tagName;
    return (
      tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true
    );
  }

  function handleKeydown(event) {
    if (event.key !== "n" && event.key !== "N") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    saveNoteAtCurrentTime();
  }

  // ------------------------------------------------------------
  // Messages from the side panel and background
  // ------------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === "getVideoInfo") {
      sendResponse(readVideoInfo());
      return false;
    }
    if (message?.action === "getCurrentTime") {
      const video = videoElement();
      sendResponse({
        currentTime: video ? Math.floor(video.currentTime) : 0,
        paused: video ? video.paused : true,
      });
      return false;
    }
    if (message?.action === "seekTo") {
      const video = videoElement();
      if (!video) {
        sendResponse({ success: false, error: "NO_PLAYER" });
        return false;
      }
      video.currentTime = Math.max(0, Number(message.seconds) || 0);
      if (video.paused) video.play().catch(() => {});
      sendResponse({ success: true });
      return false;
    }
    if (message?.action === "highlightMoments") {
      // Chapters are shown in the side panel only.
      sendResponse({ success: true });
      return false;
    }
    if (message?.action === "showNoteSavedFeedback") {
      showToast(message.note || {});
      sendResponse({ success: true });
      return false;
    }
    sendResponse({ success: false, error: "Unknown action" });
    return false;
  });

  // ------------------------------------------------------------
  // Startup
  // ------------------------------------------------------------

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function whenWindowLoaded() {
    if (document.readyState === "complete") return Promise.resolve();
    return new Promise((resolve) =>
      window.addEventListener("load", resolve, { once: true }),
    );
  }

  async function whenPlayerMounted() {
    const deadline = Date.now() + PLAYER_WAIT_TIMEOUT_MS;
    while (!videoElement() && Date.now() < deadline) {
      await delay(PLAYER_POLL_MS);
    }
  }

  function injectButtons() {
    if (!currentBvid()) return;
    injectDigestButton();
    injectNoteButton();
  }

  async function init() {
    // Listening does not touch the DOM, so it can start immediately.
    document.addEventListener("keydown", handleKeydown);

    await whenWindowLoaded();
    await whenPlayerMounted();
    await delay(SETTLE_DELAY_MS);

    injectButtons();
    // A timer, not a MutationObserver: danmaku (scrolling comments) mutate the
    // DOM constantly, and the timer also restores buttons after Bilibili's
    // client-side page changes.
    setInterval(injectButtons, REINJECT_INTERVAL_MS);
  }

  init();
})();
