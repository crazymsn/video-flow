const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("settings page uses the company name in the top bar", () => {
  const html = read("options.html");
  const css = read("options.css");
  const js = read("options.js");

  assert.match(html, /class="eyebrow"[\s\S]*>\s*<span[^>]*>深度云创科技<\/span>/);
  assert.match(js, /填入 API 密钥/);
  assert.match(js, /前往 API 分发站创建密钥<\/a>，填写密钥后会自动获取模型列表/);
  assert.doesNotMatch(js, /API 令牌/);
  assert.doesNotMatch(html, /class="company-credit"/);
  assert.doesNotMatch(html, /深度云创科技\s*·\s*Video Flow/);
  assert.match(css, /\.settings-shell\s*\{[^}]*width:\s*100%;/);
  assert.match(css, /\.settings-shell\s*\{[^}]*min-height:\s*100vh;/);
  assert.match(css, /\.settings-shell\s*\{[^}]*padding:\s*48px 32px 0;/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*\.settings-shell\s*\{\s*padding:\s*28px 16px 0;/);
  assert.match(css, /\.brand-company\s*\{[^}]*font-size:\s*16px;/);
  assert.match(css, /\.settings-heading-row\s*\{[^}]*padding-inline:\s*24px;/);
  assert.match(css, /\.form-actions\s*\{[^}]*padding-inline:\s*24px;/);
  assert.match(css, /\.save-btn\s*\{[^}]*min-width:\s*132px;[^}]*height:\s*40px;/);
  assert.doesNotMatch(css, /\.settings-shell\s*\{[^}]*max-width:/);
  assert.doesNotMatch(css, /\.company-credit\s*\{/);
});

test("side panel uses Chinese labels for settings, tabs and notes", () => {
  const html = read("sidepanel.html");
  const js = read("sidepanel.js");

  assert.match(html, /id="settingsBtn"[\s\S]*>\s*设置\s*<\/button>/);
  assert.match(html, /data-tab="transcript">字幕<\/button>/);
  assert.match(html, /data-tab="overview">概览<\/button>/);
  assert.match(html, /data-tab="notes">笔记<\/button>/);
  assert.match(html, /<div class="section-title">章节<\/div>/);
  assert.match(html, /<div class="section-title">关键摘录<\/div>/);
  assert.match(html, /id="notesFilterThis"[\s\S]*>\s*本视频\s*<\/button>/);
  assert.match(html, /id="notesFilterAll"[\s\S]*>\s*全部笔记\s*<\/button>/);
  assert.match(js, /当前视频还没有笔记。将鼠标移到视频上并点击“Note”即可保存。/);
  assert.match(js, /还没有保存的笔记。将鼠标移到视频上并点击“Note”即可保存。/);
});
