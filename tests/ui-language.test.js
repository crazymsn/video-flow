const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("side panel settings action uses the Chinese label", () => {
  const html = read("sidepanel.html");

  assert.match(html, /id="settingsBtn"[\s\S]*>\s*设置\s*<\/button>/);
  assert.doesNotMatch(html, /id="settingsBtn"[\s\S]*>\s*Settings\s*<\/button>/);
  assert.match(html, /data-tab="transcript">字幕<\/button>/);
  assert.match(html, /data-tab="overview">概览<\/button>/);
  assert.match(html, /data-tab="notes">笔记<\/button>/);
});
