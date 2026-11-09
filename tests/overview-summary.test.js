const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("overview includes a structured summary card above chapters", () => {
  const html = read("sidepanel.html");
  const css = read("sidepanel.css");
  const js = read("sidepanel.js");
  const prompt = read("prompts/analysis.md");

  assert.match(html, /id="overviewSummary"/);
  assert.match(html, /id="summaryHeadline"/);
  assert.match(html, /id="summaryOverview"/);
  assert.match(html, /id="summaryTakeaways"/);
  assert.match(css, /\.overview-summary-card\s*\{/);
  assert.match(js, /function renderAnalysisSummary\(/);
  assert.match(js, /renderAnalysisSummary\(analysis\.summary/);
  assert.match(prompt, /"summary"\s*:/);
  assert.match(prompt, /"headline"/);
  assert.match(prompt, /"takeaways"/);
});

test("summary rendering handles draft and complete results", () => {
  const js = read("sidepanel.js");
  const source = js.match(/function renderAnalysisSummary\([\s\S]*?\n}\r?\n/)?.[0];
  assert.ok(source);
  const elements = Object.fromEntries(["overviewSummary", "summaryHeadline", "summaryOverview", "summaryTakeaways"].map((id) => [id, {
    innerHTML: "loading",
    children: [],
    appendChild(item) { this.children.push(item); },
  }]));
  const context = {
    document: { getElementById: (id) => elements[id], createElement: () => ({ innerHTML: "" }) },
    renderLocalizedContent: (text) => text,
  };
  vm.runInNewContext(`${source}\nthis.render = renderAnalysisSummary`, context);
  context.render(undefined, { draft: true });
  assert.equal(elements.summaryHeadline.innerHTML, "loading");
  context.render({ headline: "Title", overview: "Overview", takeaways: ["One"] }, { draft: false });
  assert.equal(elements.summaryHeadline.innerHTML, "Title");
  assert.equal(elements.summaryOverview.innerHTML, "Overview");
  assert.equal(elements.summaryTakeaways.children[0].innerHTML, "One");
});

test("old overview caches trigger a summary refresh", () => {
  const js = read("sidepanel.js");

  assert.match(js, /function analysisNeedsSummary\(/);
  assert.match(js, /analysisNeedsSummary\(currentAnalysis\)/);
  assert.match(js, /currentAnalysis = null;/);
});
