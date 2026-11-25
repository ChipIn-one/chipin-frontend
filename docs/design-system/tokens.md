# Tokens

The token source of truth is the hand-written
[`packages/tokens/tokens.css`](../../packages/tokens/tokens.css) (package `@chipin/tokens`). There
is no `tokens.json`, no generator and no `tokens:check` (DECISIONS D31). Product code uses tokens
as `var(--cp-*)`.

## Where things live

| File                                                                                       | Role                                                                                                        |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| [`packages/tokens/tokens.css`](../../packages/tokens/tokens.css)                           | Every `--cp-*` token                                                                                        |
| [`packages/tokens/src/radix-colors.css`](../../packages/tokens/src/radix-colors.css)       | The Radix color scales the app ships (equals `RADIX_PALETTES`)                                              |
| [`packages/tokens/src/theme.ts`](../../packages/tokens/src/theme.ts)                       | `RADIX_THEME`, `PROP_COLOR`, `RADIX_PALETTES`, `BRAND_COLORS`                                               |
| [`packages/tokens/tokens.test.ts`](../../packages/tokens/tokens.test.ts)                   | Keeps the files above in sync                                                                               |
| [`apps/app/src/design-system/AppTheme.tsx`](../../apps/app/src/design-system/AppTheme.tsx) | The app's Radix `<Theme>` with `RADIX_THEME` (`public-routes/PublicApp.tsx` spreads the same `RADIX_THEME`) |
| [`apps/app/src/styles/index.css`](../../apps/app/src/styles/index.css)                     | The app CSS entry: scales, Radix base/components/utilities, `tokens.css`, overrides                         |

`RADIX_THEME`: accent `grass`, gray `olive`, radius `large`, panel background `solid`, scaling
`100%`.

## How to read tokens.css

- **Primitives:** space, radius, typography, shadows, z-index layers and motion
  (`--cp-space-1..9`, `--cp-radius-1..6` and `--cp-radius-pill`, `--cp-font-*`, `--cp-shadow-*`,
  `--cp-z-*`, `--cp-duration-*`, `--cp-easing-*`). Colors have no `--cp-` primitives: the
  primitives are the Radix scales from `radix-colors.css` (`--olive-11`, `--grass-9`).
- **Semantic roles:** every color token references one step of a concrete scale
  (`--cp-text-primary: var(--olive-12)`). There is no separate dark block: the Radix scales switch
  themselves on `.dark`/`.dark-theme`, so each role is right in both modes. A dark override is
  added only for a value that differs by more than that.
- **Component tokens:** the `/* Components */` group (`--cp-logo-mode-*`). New ones are added by
  the design-phase PR that migrates their file.
- A `prefers-reduced-motion: reduce` block sets `--cp-duration-*` to `0ms`.
- Raw color literals exist only for `--cp-brand-loader`, `--cp-media-on` and `--cp-media-scrim`
  (D23 exceptions).

## Semantic roles

| Group     | Tokens                                                                                                   | Purpose                                                   |
| --------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Brand     | `--cp-brand-primary`, `--cp-brand-loader`                                                                | Brand green; the loader stroke                            |
| Text      | `--cp-text-primary`, `-secondary`, `-muted`, `-inverse`                                                  | Text by emphasis; text on a solid fill                    |
| Surfaces  | `--cp-surface-base`, `-subtle`, `-muted`                                                                 | Page and panel backgrounds                                |
| Borders   | `--cp-border-default`, `-strong`, `-translucent`, `-translucent-strong`, `-brand`                        | Dividers and outlines                                     |
| Fills     | `--cp-fill-hover`, `-pressed`, `-scrim`                                                                  | Hover/press backgrounds; overlay scrim                    |
| Accent    | `--cp-accent-surface`, `--cp-accent-solid`, `--cp-focus-ring`                                            | Accent backgrounds; the focus ring                        |
| Status    | `--cp-status-success`, `-info`, `-danger-border`, `-danger-surface`, `-warning-text`, `-warning-surface` | Feedback colors                                           |
| Debts     | `--cp-debt-owed`, `--cp-debt-owing`, `--cp-debt-settled`                                                 | You are owed (green), you owe (red), settled (gray)       |
| Selection | `--cp-selection-border-subtle`, `-border`, `-solid`, `-surface`, `-surface-hover`                        | Selected items (jade)                                     |
| Media     | `--cp-media-on`, `--cp-media-scrim`                                                                      | Text over a cover image and its scrim, same in both modes |

## Radix `color` props: PROP_COLOR

Radix `color` props do not accept CSS variables. `PROP_COLOR` in `theme.ts` gives the Radix color
of each role, matching the scale of the `--cp-*` role of the same meaning: `accent`, `neutral`,
`debtOwed`, `debtOwing`, `debtSettled`, `success`, `danger`, `warning`, `info`. Spec 05 §3 says
`color` goes only through `PROP_COLOR`; no lint checks it yet.

## How to add a token

1. Add it to `tokens.css` in the same PR that uses it, in the right group.
2. A color references a concrete scale step (`var(--olive-11)`), never `--accent-*` or
   `--gray-*`: those exist only inside `.radix-themes`, and on `:root` they are invalid.
3. Use a scale listed in `radix-colors.css` and `RADIX_PALETTES`; a new scale goes into both.
4. Run `tokens.test.ts`. It checks: `RADIX_PALETTES` equals the imports of `radix-colors.css` and
   covers every palette name used in `apps/app/src`; every color token is one step of an imported
   scale (not `gray`), literals only for the three exceptions, no duplicates; `BRAND_COLORS`
   equals the light values of `--cp-brand-primary` and `--cp-surface-base`; `--cp-accent-*` and
   `--cp-focus-ring` use the theme accent scale; the `--cp-z-*` order.

## What is forbidden

Each rule names its check. Existing ESLint violations sit in `eslint-suppressions.json` and only
shrink.

| Rule                                                                                    | Check                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Raw hex, `rgb()`/`hsl()` and friends, named colors in CSS                               | stylelint `color-no-hex`, `color-named`, `function-disallowed-list` (`stylelint.config.js`) |
| Raw hex, `rgb(a)()`, `hsl(a)()` or `var(--<palette>-N)` in TS/TSX and Astro frontmatter | ESLint `no-raw-colors` (`config/eslint/project.js`)                                         |
| Any `var(--x)` in CSS other than `--cp-*` or local `--_*`                               | stylelint `declaration-property-value-disallowed-list`                                      |
| A `--cp-*` name that is not in `tokens.css` (typos)                                     | stylelint `csstools/value-no-unknown-custom-properties`                                     |
| `.rt-*` selectors outside `apps/app/src/styles/radixStylesOverwrite.css`                | stylelint `selector-disallowed-list`                                                        |
| `style={{}}` with ordinary properties; only custom properties (`{ '--x': v }`)          | ESLint `inline-style` (`config/eslint/project.js`)                                          |
| New styled-components files                                                             | ESLint `no-restricted-imports` + `scripts/check-styled-allowlist.mjs`                       |

Exceptions, exactly as configured:

- `packages/tokens/**` is ignored by stylelint and by `no-raw-colors`.
- `apps/app/src/components/global-error-boundary/styles.css` may use hex, named colors, color
  functions and any variable: it renders without the app CSS.
- The site files in `SITE_PALETTE_VAR_FILES` (`stylelint.config.js`) may still use Radix palette
  variables; hex, `rgb()`, named colors and `.rt-*` stay banned there. The list only shrinks.
- A string that looks like hex but is not a color (`'#add'`):
  `eslint-disable-next-line no-restricted-syntax -- not a color: <reason>`. Anchors such as
  `'#add-expense'` are not matched at all.

## styled-components: frozen, then gone

- `config/eslint/styled-components-allowlist.json` lists the files that may still import
  styled-components. The list only shrinks: an entry not in the list at the base commit fails, and
  an entry whose file no longer imports styled-components must be removed.
- Touch rule (D34): changing a listed file moves it to a CSS Module (`Component.module.css`,
  `var(--cp-*)`) and off the list. A change counts as a touch when the file is a `styled.ts`, or
  the added lines write styles (`styled.`/`styled(`, `` css` ``, `` keyframes` ``,
  `createGlobalStyle`). For a `styled.ts`, only an `import`/`export`-only change is not a touch;
  for any other listed file, a change with no style code (logic only) is not a touch.
- The only escape is an entry `{ path, reason, issue }` in
  `config/eslint/styled-touch-exempt.json` added in the same change (empty today).

## Legacy `themeColor()`

About 20 files in `apps/app/src` still call `themeColor()` from `helpers/colors.ts`
(`grep -rln themeColor apps/app/src`). They move to
`var(--cp-*)` file by file when a design-system task touches them (D31, spec 05 §3); a missing
token is added to `tokens.css` in the same PR. `themeColor()` is being removed, not extended (spec 05 "Changes relative to DS v1"): add no new
calls.
