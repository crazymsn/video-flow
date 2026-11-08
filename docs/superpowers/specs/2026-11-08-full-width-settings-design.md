# Full-Width Settings Page Design

## Goal

Make the Video Flow settings page use the full available browser window instead of constraining all content to a narrow centered column. Add the company name `深度云创科科技` in the settings page's existing top brand area.

## Scope

The change is limited to the settings page presentation:

- `options.css` controls the full-width layout, viewport height, spacing, and responsive behavior.
- `options.html` adds the company name to the existing `Video Flow` brand eyebrow.
- Settings behavior, storage, language switching, links, and form controls remain unchanged.

## Layout

The `.settings-shell` becomes a full-width page shell:

- Remove the fixed `680px` maximum width.
- Use `width: 100%` and responsive horizontal padding so content reaches both sides while keeping comfortable gutters.
- Set a minimum height of `100vh` so the page background fills the viewport even when content is short.
- Keep the existing vertical spacing and narrow-screen adjustments unless they conflict with the full-width rule.

Cards and form controls remain fluid and stretch with the available page width. The existing `box-sizing: border-box` rule prevents padding and borders from causing horizontal overflow.

## Branding

The existing `Video Flow` eyebrow remains the primary product label. Add `深度云创科科技` as a secondary company label within the same eyebrow area, using a smaller muted treatment and allowing it to wrap naturally on narrow screens. The language switch stays aligned on the opposite side of the heading row.

## Responsive behavior

- Desktop and tablet widths use the full viewport with consistent horizontal gutters.
- Narrow screens keep the current reduced top padding and card padding.
- The brand area may wrap when needed; it must not create horizontal scrolling.
- Form rows continue to wrap according to the existing mobile rule.

## Validation

Verify that:

1. The settings page background and content span the browser width.
2. Cards no longer remain inside a 680px centered column.
3. The company name appears in the top brand area.
4. Narrow viewport widths do not produce horizontal scrolling or clipped controls.
5. Existing release and settings tests continue to pass.
