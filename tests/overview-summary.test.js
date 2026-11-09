const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

test("old overview caches trigger a summary refresh", () => {
  const js = read("sidepanel.js");

  assert.match(js, /function analysisNeedsSummary\(/);
  assert.match(js, /analysisNeedsSummary\(currentAnalysis\)/);
  assert.match(js, /currentAnalysis = null;/);
});
