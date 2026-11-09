const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("manifest uses minimized install-time permissions", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.equal(packageJson.version, manifest.version);
  assert.equal(manifest.options_ui.page, "options.html");
  assert.ok(!manifest.permissions.includes("activeTab"));
  assert.deepEqual(manifest.host_permissions.slice().sort(), [
    "https://*.hdslb.com/*",
    "https://api.bilibili.com/*",
    "https://api.meding.site/*",
    "https://api.supadata.ai/*",
    "https://www.bilibili.com/*",
    "https://www.youtube.com/*",
  ]);
  assert.equal(Object.hasOwn(manifest, "optional_host_permissions"), false);
  assert.equal(manifest.version, "1.3.0");

  // Each site gets its own content script, and the Bilibili one stays on
  // video pages only.
  const matchesByScript = Object.fromEntries(
    manifest.content_scripts.map((entry) => [entry.js.join(","), entry.matches]),
  );
  assert.deepEqual(matchesByScript["content.js"], ["https://www.youtube.com/*"]);
  assert.deepEqual(matchesByScript["content-bilibili.js"], [
    "https://www.bilibili.com/video/*",
    "https://www.bilibili.com/list/*",
  ]);
});

test("release copy documents current scope without em dashes", () => {
  const readme = read("README.md");
  const chineseReadme = read("README.zh-CN.md");
  const manifest = JSON.parse(read("manifest.json"));
  const packageJson = JSON.parse(read("package.json"));

  assert.doesNotMatch(readme, /—/);
  assert.doesNotMatch(chineseReadme, /—/);
  assert.doesNotMatch(manifest.description, /—/);
  assert.doesNotMatch(packageJson.description, /—/);

  assert.equal(manifest.name, "Video Flow");
  assert.equal(packageJson.name, "video-flow");
  assert.match(read("scripts/package-extension.sh"), /video-flow-v\$version\.zip/);
  assert.doesNotMatch(
    [readme, chineseReadme, read("PRIVACY.md"), read("SECURITY.md")].join("\n"),
    /\bYT Digest\b/,
  );
  assert.match(readme, /^# Video Flow$/m);
  assert.match(
    readme,
    /A Chrome side panel that turns YouTube and Bilibili videos into searchable learning notes\./,
  );
  assert.match(readme, /^## Install$/m);
  assert.match(readme, /chrome:\/\/extensions/);
  assert.match(readme, /Load unpacked/);
  assert.match(readme, /^## Configure$/m);
  assert.match(readme, /https:\/\/api\.meding\.site/);
  assert.match(readme, /^## Use$/m);
  assert.match(readme, /Open \*\*概览\*\*/);
  assert.doesNotMatch(readme, /^## New in v1\.3\.0$/m);
  assert.doesNotMatch(readme, /^## Earlier in v1\.2\.0$/m);
  assert.doesNotMatch(readme, /^## Supadata free tier and request costs$/m);
  assert.doesNotMatch(readme, /^## Remix it with your coding agent$/m);

  assert.match(chineseReadme, /^# Video Flow$/m);
  assert.match(chineseReadme, /Video Flow 是一个 Chrome 侧边栏扩展/);
  assert.match(chineseReadme, /^## 安装$/m);
  assert.match(chineseReadme, /加载已解压的扩展程序/);
  assert.match(chineseReadme, /^## 配置$/m);
  assert.match(chineseReadme, /https:\/\/api\.meding\.site/);
  assert.match(chineseReadme, /^## 使用$/m);
  assert.match(chineseReadme, /打开 \*\*概览\*\*/);
  assert.doesNotMatch(chineseReadme, /^## v1\.3\.0 更新$/m);
  assert.doesNotMatch(chineseReadme, /^## Supadata 免费额度和请求成本$/m);
  assert.doesNotMatch(chineseReadme, /^## 用编程 Agent 改造成自己的版本$/m);

  for (const doc of [readme, chineseReadme]) {
    assert.match(doc, /dash\.supadata\.ai\/auth\/sign-up/i);
    assert.match(doc, /https:\/\/api\.meding\.site/);
    assert.match(doc, /npm test/);
    assert.match(doc, /PRIVACY\.md/);
  }


  const optionsPage = read("options.html");
  const optionsStyles = read("options.css");
  const optionsScript = read("options.js");
  assert.match(optionsPage, /dash\.supadata\.ai\/auth\/sign-up/i);
  assert.doesNotMatch(optionsPage, /deepseek/i);
  // One OpenAI-compatible provider: no provider picker, a read-only Base URL,
  // and a model picker that the token fills in.
  assert.doesNotMatch(optionsPage, /id="provider"/);
  assert.match(optionsPage, /<select\b[^>]*id="aiModel"/);
  assert.match(optionsPage, /<input[^>]*id="aiBaseUrl"[^>]*\sreadonly\s/);
  // The provider summary, privacy note, and company footer are gone from
  // Settings. The company name stays in the top brand area.
  assert.doesNotMatch(optionsPage, /provider-summary|provider-badge|privacy-note/i);
  assert.match(optionsPage, /class="settings-brand-mark"[^>]*src="icons\/deepcloud-logo\.png"[^>]*alt="DeepCloud"/);
  assert.match(optionsPage, /class="eyebrow"[\s\S]*>\s*<span[^>]*>深度云创科技<\/span>/);
  assert.doesNotMatch(optionsPage, /class="company-credit"|深度云创科技\s*·\s*Video Flow/);
  assert.match(optionsStyles, /\.brand-company\s*\{[^}]*color:\s*#1464c4;[^}]*font-size:\s*20px;/);
  assert.doesNotMatch(optionsScript, /providerBadge|providerSummaryLabel|privacyNote|footer:/);
  // The top "create an API token" heading is gone. The token site is linked from
  // the AI card title and from the line under the Base URL, without underlines.
  assert.doesNotMatch(optionsPage, /create an API token/i);
  assert.doesNotMatch(optionsScript, /创建 API 密钥|create an API token/i);
  assert.match(optionsPage, /<h2[^>]*data-i18n-html="aiProvider"[^>]*>[\s\S]*?href="https:\/\/api\.meding\.site"/);
  // The create-token link sits right under the API token field, in the same
  // line as the note that models load automatically.
  assert.match(
    optionsPage,
    /id="aiApiKey"[\s\S]*?data-i18n-html="aiApiKeyHelp"[^>]*>[\s\S]*?href="https:\/\/api\.meding\.site"/,
  );
  assert.doesNotMatch(optionsPage, /baseUrlHelp/);
  assert.doesNotMatch(optionsScript, /baseUrlHelp/);
  assert.match(optionsScript, /前往 API 分发站创建密钥<\/a>，填写密钥后会自动获取模型列表/);
  assert.doesNotMatch(optionsScript, /Base URL 已固定|只会发送到这个地址/);
  const tokenLink = optionsStyles.match(/h2 a,\s*\.help a\[href="https:\/\/api\.meding\.site"\]\s*\{[^}]*\}/)?.[0] || "";
  assert.match(tokenLink, /text-decoration:\s*none/);
  // The intro paragraph under the language switch was removed from Settings.
  assert.doesNotMatch(optionsPage, /class="lede"|fully open-source|sent only to Supadata|developer server/i);
  assert.doesNotMatch(optionsStyles, /\.lede\b/);
  assert.doesNotMatch(optionsScript, /lede:|完全开源|fully open-source|sent only to Supadata|开发者服务器/);
  // The "Want to use another AI model?" remix card was removed from Settings.
  assert.doesNotMatch(optionsPage, /customization|Local remix|agent-badge/i);
  assert.doesNotMatch(optionsStyles, /customization|agent-badge|prompt-reminder/i);
  assert.doesNotMatch(optionsScript, /customization|clipboard\.writeText/i);
  assert.match(optionsStyles, /\.data-card\s*\{[^}]*margin-top:\s*36px;/);
  assert.match(optionsScript, /migration\.migrated[\s\S]*storage\.set/);
  assert.doesNotMatch(optionsScript, /deepseek/i);

  const publishedDocs = [
    readme,
    chineseReadme,
    read("PRIVACY.md"),
    read("SECURITY.md"),
  ].join("\n");
  assert.doesNotMatch(publishedDocs, /optional custom-origin/i);
  assert.doesNotMatch(publishedDocs, /chosen AI provider/i);
  assert.doesNotMatch(publishedDocs, /deepseek-v4-flash|DeepSeek V4 Flash/i);
});

test("settings page uses the full viewport and shows DeepCloud branding", () => {
  const html = read("options.html");
  const css = read("options.css");

  assert.match(html, /class="settings-brand-mark"[^>]*src="icons\/deepcloud-logo\.png"[^>]*alt="DeepCloud"/);
  assert.match(html, /深度云创科技/);
  assert.match(css, /\.settings-shell\s*\{[^}]*width:\s*100%;/);
  assert.match(css, /\.settings-shell\s*\{[^}]*padding:\s*48px 32px 0;/);
  assert.match(css, /\.brand-company\s*\{[^}]*color:\s*#1464c4;[^}]*font-size:\s*20px;/);
  assert.doesNotMatch(css, /\.settings-shell\s*\{[^}]*max-width:/);
});

test("product UI contains no emoji or emoji-like pictographs", () => {
  const productUi = [
    read("sidepanel.html"),
    read("sidepanel.js"),
    read("content.js"),
    read("options.html"),
    read("options.js"),
  ].join("\n");

  assert.doesNotMatch(
    productUi,
    /\p{Extended_Pictographic}|[✓✕⧉▶]/u,
  );
  assert.doesNotMatch(productUi, /&#(?:9655|9888);/);
});

test("selection actions use two equal edge-to-edge hover areas", () => {
  const css = read("sidepanel.css");

  assert.match(
    css,
    /\.explain-tooltip\s*\{[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/,
  );
  assert.match(
    css,
    /\.explain-btn,\s*\.selection-note-btn\s*\{[^}]*flex:\s*1 1 50%;[^}]*border-radius:\s*0;/,
  );
  assert.match(
    css,
    /\.explain-tooltip\s*\{[^}]*animation:\s*selectionToolbarIn/,
  );
  assert.match(
    css,
    /@keyframes selectionToolbarIn\s*\{[\s\S]*transform:\s*translate\(-50%, 4px\);[\s\S]*transform:\s*translate\(-50%, 0\);/,
  );
});

test("note delete is an accessible SVG action at the end of the action row", () => {
  const js = read("sidepanel.js");
  const css = read("sidepanel.css");

  assert.match(
    js,
    /<div class="note-actions">[\s\S]*class="[^"]*note-play[^"]*"[\s\S]*class="note-delete"[\s\S]*aria-label="Delete note"[\s\S]*<svg viewBox="0 0 24 24" aria-hidden="true">/,
  );
  assert.doesNotMatch(js, /class="note-delete"[^>]*>Delete<\/button>/);
  assert.match(
    css,
    /\.note-delete\s*\{[^}]*place-items:\s*center;[^}]*margin-left:\s*auto;/,
  );
  assert.match(css, /\.note-delete:focus-visible\s*\{[^}]*outline:/);
});

test("notes filters preserve selected contrast and expose pressed state", () => {
  const html = read("sidepanel.html");
  const css = read("sidepanel.css");
  const js = read("sidepanel.js");

  assert.match(
    html,
    /id="notesFilterThis"[\s\S]*?aria-pressed="true"[\s\S]*?>[\s\S]*?本视频/,
  );
  assert.match(
    html,
    /id="notesFilterAll"[\s\S]*?aria-pressed="false"[\s\S]*?>[\s\S]*?全部笔记/,
  );
  assert.match(
    css,
    /\.notes-filter \.enhance-btn\.active:hover:not\(:disabled\)\s*\{[^}]*background:\s*var\(--accent-hover\);[^}]*color:\s*white;/,
  );
  assert.match(
    css,
    /\.notes-filter \.enhance-btn:hover:not\(:disabled\)\s*\{[^}]*background:\s*transparent;[^}]*color:\s*var\(--text-secondary\);/,
  );
  assert.match(css, /\.notes-filter \.enhance-btn:focus-visible\s*\{[^}]*outline:/);
  assert.match(js, /setNotesFilter\(false\)/);
  assert.match(js, /setNotesFilter\(true\)/);
  assert.match(js, /setAttribute\("aria-pressed", String\(!showAll\)\)/);
  assert.match(js, /setAttribute\("aria-pressed", String\(showAll\)\)/);
});

test("runtime has no source-file credential dependency or retired model", () => {
  const runtime = [
    "background.js",
    "content.js",
    "sidepanel.js",
    "options.js",
    "settings.js",
  ]
    .map(read)
    .join("\n");

  assert.doesNotMatch(runtime, /\bCONFIG\./);
  assert.doesNotMatch(runtime, /importScripts\(["']config\.js/);
  // DeepSeek was removed: no retired model name, host or key link may remain.
  assert.doesNotMatch(runtime, /deepseek/i);
  assert.match(runtime, /https:\/\/api\.meding\.site/);
});

test("background reconciles side-panel state after navigation commits", () => {
  const background = read("background.js");

  assert.match(
    background,
    /function getNavigationUrl\(changeInfo, tab\)[\s\S]*changeInfo\.status !== "loading"[\s\S]*changeInfo\.status !== "complete"[\s\S]*tab\.pendingUrl \|\| tab\.url/,
  );
  assert.match(
    background,
    /chrome\.tabs\.onUpdated\.addListener\(\(tabId, changeInfo, tab\)[\s\S]*getNavigationUrl\(changeInfo, tab\)[\s\S]*updatePanelForTab\(tabId, url\)/,
  );
  // The panel is hidden per tab, never closed, so it can return on switch-back.
  assert.doesNotMatch(background, /chrome\.sidePanel\.close\(/);
  assert.match(
    background,
    /async function updatePanelForTab\(tabId, url\)[\s\S]*setOptions\(\{ tabId, enabled: false \}\)/,
  );
});

test("retired Remix and reader files are absent", () => {
  for (const file of [
    "reader.html",
    "reader.js",
    "remix-prompts.js",
    "config.example.js",
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
});

test("published prompt files contain runtime sections", () => {
  const expectedSections = {
    "prompts/analysis.md": ["System prompt", "User prompt"],
    "prompts/explain.md": ["System prompt", "User prompt"],
    "prompts/note-cleanup.md": ["System prompt", "User prompt"],
    "prompts/translation.md": [
      "Shared base rules",
      "Chinese rules",
      "Transcript batch translation",
    ],
  };

  for (const [file, sections] of Object.entries(expectedSections)) {
    const markdown = read(file);
    for (const section of sections) {
      assert.match(markdown, new RegExp(`^## ${section}$`, "m"));
    }
  }
});

test("Settings save button has states and the Bilibili buttons match YouTube", () => {
  const page = read("options.html");
  const styles = read("options.css");
  const bilibili = read("content-bilibili.js");
  const youtube = read("content.js");

  // Save button: spinner and check live inside the button, state is data-driven.
  assert.match(page, /id="saveBtn"[\s\S]*?class="save-btn-spinner"[\s\S]*?class="save-btn-label"/);
  assert.match(page, /id="formActions"[^>]*data-state="idle"/);
  assert.match(styles, /\.form-actions\[data-state="saved"\] \.save-btn\s*\{/);
  assert.match(styles, /\.form-actions\[data-state="error"\] \.save-status\s*\{/);
  assert.match(styles, /button\.primary:focus-visible\s*\{/);
  assert.match(styles, /--ok-solid:/);
  // The button aligns with the form content and keeps a stable touch target.
  const saveBtn = styles.match(/\n\.save-btn\s*\{[^}]*\}/)?.[0] || "";
  assert.match(saveBtn, /height:\s*40px/);
  assert.match(saveBtn, /min-width:\s*132px/);
  assert.match(saveBtn, /font-size:\s*13px/);
  assert.doesNotMatch(page, /supadataHelpSuffix|generates the key during onboarding/);
  assert.doesNotMatch(read("options.js"), /supadataHelpSuffix|引导流程中生成密钥/);
  // The heavy 30% glow under the resting button was replaced by a thin shadow.
  const primary = styles.match(/\nbutton\.primary\s*\{[^}]*\}/)?.[0] || "";
  assert.doesNotMatch(primary, /0 4px 12px/);

  // Bilibili uses the same brand pill as YouTube, including the hover color.
  for (const source of [bilibili, youtube]) {
    assert.match(source, /#d43366/);
    assert.match(source, /#b82a58/);
  }
  assert.match(bilibili, /height:36px;padding:0 18px;border:none;border-radius:18px/);
  assert.doesNotMatch(bilibili, /border-radius:6px/);
  assert.doesNotMatch(bilibili, /rgba\(0,0,0,\.55\)/);
});
