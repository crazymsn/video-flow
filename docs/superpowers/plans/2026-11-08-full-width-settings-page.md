# Full-Width Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the settings page fill the browser viewport and add `深度云创科科技` as a secondary label in the existing top brand area.

**Architecture:** Keep the change presentation-only. `options.html` owns the brand markup, while `options.css` owns the full-width shell, viewport height, responsive gutters, and brand typography. Add a small static contract test to `tests/release.test.js` so the width constraint and company label cannot regress.

**Tech Stack:** HTML, CSS, Node.js built-in test runner, existing Chrome extension options page.

---

### Task 1: Add regression coverage for the settings layout contract

**Files:**
- Modify: `tests/release.test.js` near the existing `optionsPage` and `optionsStyles` assertions

- [ ] **Step 1: Add a failing test for full-width settings and company branding**

Append a test after the existing release UI checks:

```js
test("settings page uses the full viewport and shows company branding", () => {
  const html = read("options.html");
  const css = read("options.css");

  assert.match(html, /深度云创科科技/);
  assert.match(css, /\.settings-shell\s*\{[^}]*width:\s*100%;/);
  assert.match(css, /\.settings-shell\s*\{[^}]*min-height:\s*100vh;/);
  assert.doesNotMatch(
    css,
    /\.settings-shell\s*\{[^}]*width:\s*min\(680px,\s*calc\(100%\s*-\s*32px\)\)/,
  );
});
```

Keep the existing uncommitted assertions in `tests/release.test.js` unchanged; only add this independent test.

- [ ] **Step 2: Run the focused test and verify it fails for the intended reason**

Run:

```bash
node --test tests/release.test.js
```

Expected: the new test fails because `options.html` does not yet contain `深度云创科科技` and `.settings-shell` still uses the `680px` width rule.

### Task 2: Implement the full-width settings layout and company label

**Files:**
- Modify: `options.html:12-16`
- Modify: `options.css:152-158` and the brand rules around `.eyebrow`

- [ ] **Step 1: Add the company name to the existing brand eyebrow**

Replace the current eyebrow contents:

```html
<div class="eyebrow">
  <img class="settings-brand-mark" src="icons/icon128.png" alt="" aria-hidden="true" />
  <span>Video Flow</span>
</div>
```

with:

```html
<div class="eyebrow">
  <img class="settings-brand-mark" src="icons/icon128.png" alt="" aria-hidden="true" />
  <span class="brand-product">Video Flow</span>
  <span class="brand-company">深度云创科科技</span>
</div>
```

The product name remains the primary label. The company name is adjacent in the same semantic brand group and can wrap on narrow screens.

- [ ] **Step 2: Change the settings shell from a centered 680px column to a full-width viewport shell**

Replace the existing `.settings-shell` rule:

```css
.settings-shell {
  width: min(680px, calc(100% - 32px));
  margin: 0 auto;
  padding: 48px 0 72px;
}
```

with:

```css
.settings-shell {
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 48px 32px 72px;
}
```

This lets the cards and form controls expand with the browser window while preserving a 32px desktop gutter. The existing global `box-sizing: border-box` rule keeps the padding inside the viewport width.

- [ ] **Step 3: Add restrained secondary branding and wrapping behavior**

Add these rules after `.eyebrow`:

```css
.eyebrow {
  flex-wrap: wrap;
}

.brand-product {
  color: inherit;
}

.brand-company {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
}
```

The company label stays visually subordinate and wraps with the product label instead of forcing horizontal overflow. Do not add a new layout section or alter the language switch placement.

- [ ] **Step 4: Preserve the narrow-screen gutter adjustment**

Update the narrow-screen rule so the full-width shell still has a smaller horizontal gutter:

```css
@media (max-width: 620px) {
  .settings-shell {
    padding: 28px 16px 56px;
  }

  .card {
    padding: 18px;
  }

  .settings-heading-row {
    align-items: flex-start;
  }

  .language-switch .language-option {
    min-width: 56px;
    padding-inline: 8px;
  }

  .model-row {
    flex-wrap: wrap;
  }
}
```

This retains the existing mobile top spacing and card density while preventing the page from touching the viewport edges.

### Task 3: Run validation and review the final diff

**Files:**
- Test: `tests/release.test.js`
- Test: `tests/options-language.test.js`
- Check: `options.html`, `options.css`

- [ ] **Step 1: Run the focused settings and release tests**

Run:

```bash
node --test tests/release.test.js tests/options-language.test.js
```

Expected: all tests pass, including the new full-width settings contract.

- [ ] **Step 2: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all repository tests pass.

- [ ] **Step 3: Run the release check**

Run:

```bash
npm run check
```

Expected: the release check completes successfully with no packaging or source validation errors.

- [ ] **Step 4: Inspect the final diff for scope and layout regressions**

Run:

```bash
git diff -- options.html options.css tests/release.test.js
git status --short
```

Confirm that the diff only adds the company label, changes the settings shell to full width with responsive gutters, adds the static regression assertion, and preserves all pre-existing worktree modifications.

- [ ] **Step 5: Commit the implementation**

Stage only the implementation files and the new regression assertion:

```bash
git add options.html options.css tests/release.test.js
git commit -m "Make settings page fill the viewport" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Do not stage the pre-existing README, background, sidepanel, or unrelated test changes unless they are already part of the user's intended work and explicitly requested separately.
