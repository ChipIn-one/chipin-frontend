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
| [`packages/tokens/src/theme.ts`](../../packages/tokens/src/theme.ts)                       | `RADIX_THEME`, `PROP_COLOR`, `TYPE_ROLES`, `ICON_SIZE`, `BREAKPOINTS`, the palette lists, `BRAND_COLORS`    |
| [`packages/tokens/tokens.test.ts`](../../packages/tokens/tokens.test.ts)                   | Keeps the files above in sync                                                                               |
| [`apps/app/src/design-system/AppTheme.tsx`](../../apps/app/src/design-system/AppTheme.tsx) | The app's Radix `<Theme>` with `RADIX_THEME` (`public-routes/PublicApp.tsx` spreads the same `RADIX_THEME`) |
| [`apps/app/src/styles/index.css`](../../apps/app/src/styles/index.css)                     | The app CSS entry: scales, Radix base/components/utilities, `tokens.css`, overrides                         |

`RADIX_THEME`: accent `grass`, gray `olive`, radius `large`, panel background `solid`, scaling
`100%`.

## How to read tokens.css

Two rule blocks with the same selector list, then two media blocks (DECISIONS D36).

- **Primitives:** space, radius, font sizes, line heights, weights, z-index layers and motion
  (`--cp-space-1..9`, `--cp-radius-1..6` and `--cp-radius-pill`, `--cp-font-size-1..9`,
  `--cp-line-height-1..9`, `--cp-font-weight-*`, `--cp-z-*`, `--cp-duration-*`, `--cp-easing-*`).
  Colors have no `--cp-` primitives: the primitives are the Radix scales from `radix-colors.css`
  (`--olive-11`, `--grass-9`).
- **Roles** (first block): what UI code uses. Every color role references one step of a concrete
  scale (`--cp-text-primary: var(--olive-12)`). There is no separate dark block: the Radix scales
  switch themselves on `.dark`/`.dark-theme`, so each role is right in both modes. A dark override
  is added only for a value that differs by more than that.
- **Component tokens** (second block): one component each (`--cp-nav-highlight*`,
  `--cp-fab-border*`, `--cp-logo-mode-*`, `--cp-invite-glow`, `--cp-subevents-divider`,
  `--cp-avatar-placeholder-*`, `--cp-auth-illustration-glow`). A value equal to a role references
  the role (`--cp-logo-mode-primary: var(--cp-mode-solo-solid)`). New ones are added by the
  design-phase PR that migrates their file.
- `@media (min-width: 768px)` (`BREAKPOINTS.sm`) widens `--cp-gutter`; the
  `prefers-reduced-motion: reduce` block sets `--cp-duration-*` to `0ms`.
- Raw color literals exist only for `--cp-brand-loader`, `--cp-media-on` and `--cp-media-scrim`
  (D23 exceptions).

## Foundation roles

| Group     | Tokens                                                                                                             | Purpose                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Type      | `--cp-type-display`, `-amount-hero`, `-title-1`, `-title-2`, `-title-3`, `-body`, `-body-sm`, `-label`, `-caption` | `font: var(--cp-type-body)`; size/line/weight in the table below                                            |
| Type      | `--cp-type-display-tracking` (`-0.02em`), `--cp-font-numeric-tabular` (`tabular-nums`)                             | Letter spacing of display; `font-variant-numeric` of amount-hero, after the `font` shorthand (it resets it) |
| Layout    | `--cp-gutter` (16px, 24px from sm), `--cp-width-narrow` 360, `-form` 480, `-content` 560, `-shell`                 | Page side padding; max widths; `-shell` = desktop shell                                                     |
| Layout    | `--cp-touch-target` (44px)                                                                                         | Minimum hit area                                                                                            |
| Radius    | `--cp-radius-control` (3), `--cp-radius-card` (4), `--cp-radius-sheet` (5)                                         | Inputs and buttons; cards; sheets and dialogs                                                               |
| Elevation | `--cp-elevation-0` (none), `-1`, `-2`, `-3`                                                                        | Flat (cards use a border); raised; popover; modal                                                           |
| Icons     | `--cp-icon-sm` 16, `-md` 20, `-lg` 24, `-tile` 32, `-hero` 48                                                      | Icon sizes; `ICON_SIZE` for the lucide `size` prop                                                          |
| Motion    | `--cp-duration-fast` 120, `-base` 160, `-slow` 240; `--cp-easing-standard`, `-out`, `-enter`, `-exit`              | Transitions                                                                                                 |
| States    | `--cp-focus-ring`, `--cp-focus-ring-width` 2px, `--cp-focus-ring-offset` 2px, `--cp-field-invalid-border`          | Focus ring; an invalid field                                                                                |

| Role        | Size/line, weight   | `TYPE_ROLES` (Radix `<Text>` `size`, `weight`) |
| ----------- | ------------------- | ---------------------------------------------- |
| display     | 35/40 bold, -0.02em | `display`: 8, bold (site/landing only)         |
| amount-hero | 28/36 bold, tabular | `amountHero`: 7, bold                          |
| title-1     | 24/30 bold          | `title1`: 6, bold                              |
| title-2     | 20/28 bold          | `title2`: 5, bold                              |
| title-3     | 16/24 bold          | `title3`: 3, bold                              |
| body        | 16/24 regular       | `body`: 3, regular                             |
| body-sm     | 14/20 regular       | `bodySm`: 2, regular                           |
| label       | 14/20 medium        | `label`: 2, medium                             |
| caption     | 12/16 regular       | `caption`: 1, regular                          |

`TYPE_ROLES` is for Radix `<Text>`: `<Heading>` has its own line heights and letter spacing, so a
title is `<Text as="h2" …>`. Display also needs `letterSpacing: var(--cp-type-display-tracking)`.

`--cp-shadow-popover` equals `--cp-elevation-2`. `--cp-shadow-card` is deprecated (no elevation
step; removed by the Card merge): use `--cp-elevation-*` in new code. `BREAKPOINTS` in `theme.ts`
are the Radix ones (xs 520, sm 768, md 1024, lg 1280, xl 1640).

## Color roles

| Group    | Tokens                                                                                                                                               | Purpose                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Brand    | `--cp-brand-primary`, `--cp-brand-loader`                                                                                                            | Brand green; the loader stroke                                 |
| Text     | `--cp-text-primary`, `-secondary`, `-muted`, `-inverse`                                                                                              | Text by emphasis; text on a solid fill                         |
| Surfaces | `--cp-surface-base`, `-subtle`, `-muted`                                                                                                             | Page and panel backgrounds                                     |
| Borders  | `--cp-border-default`, `-strong`, `-translucent`, `-translucent-strong`, `-brand`                                                                    | Dividers and outlines                                          |
| Fills    | `--cp-fill-hover`, `-pressed`, `-scrim`                                                                                                              | Hover/press backgrounds; overlay scrim                         |
| Accent   | `--cp-accent-solid`, `-solid-hover`, `-text`, `-surface`, `-surface-strong`, `-surface-subtle`, `-surface-subtle-hover`, `-border`, `-border-subtle` | Grass accent; also selected items (jade selection merged, D36) |
| Success  | `--cp-status-success-text`, `-success-surface`, `-success-border`                                                                                    | Green feedback                                                 |
| Danger   | `--cp-status-danger-solid`, `-danger-text`, `-danger-surface`, `-danger-border`                                                                      | Red feedback, destructive actions                              |
| Warning  | `--cp-status-warning-text`, `-warning-surface`, `-warning-border`                                                                                    | Amber feedback                                                 |
| Info     | `--cp-status-info-text`, `-info-surface`, `-info-border`                                                                                             | Blue feedback                                                  |
| Debts    | `--cp-debt-owed`, `--cp-debt-owing`, `--cp-debt-settled`                                                                                             | You are owed (green), you owe (red), settled (gray)            |
| Mode     | `--cp-mode-solo-solid`, `-text`, `-surface`                                                                                                          | Solo mode (violet)                                             |
| Media    | `--cp-media-on`, `--cp-media-scrim`                                                                                                                  | Text over a cover image and its scrim, same in both modes      |

## Radix `color` props: PROP_COLOR

Radix `color` props do not accept CSS variables. `PROP_COLOR` in `theme.ts` gives the Radix color
of each role, matching the scale of the `--cp-*` role of the same meaning: `accent`, `neutral`,
`debtOwed`, `debtOwing`, `debtSettled`, `success`, `danger`, `warning`, `info`, `solo` (violet).
Spec 05 §3 says `color` goes only through `PROP_COLOR`; no lint checks it yet.

## Shipped scales

`RADIX_PALETTES` (= `radix-colors.css`) is `ROLE_SCALES` ∪ `CATEGORY_PALETTE` ∪ `LEGACY_PALETTES`
(`theme.ts`; `tokens.test.ts` checks it):

- `ROLE_SCALES`: olive, amber, blue, grass, green, red, violet (the roles block).
- `CATEGORY_PALETTE`: the expense category colors of `constants/category-ui.ts` (gray, amber,
  blue, brown, crimson, gold, green, indigo, mint, orange, pink, purple, red, sky, teal, violet,
  yellow). `gray` also backs Radix `color="gray"`.
- `LEGACY_PALETTES`: cyan, jade, tomato, still used directly in `apps/app/src` or `apps/site`;
  they go as those usages move to roles (#1007). jade also feeds `--cp-avatar-placeholder-from`.

No scale was pruned in #1005: every candidate (brown, crimson, gold, purple, sky, yellow) is a
category color.

## How to add a token

1. Add it to `tokens.css` in the same PR that uses it, in the right group.
2. A color references a concrete scale step (`var(--olive-11)`), never `--accent-*` or
   `--gray-*`: those exist only inside `.radix-themes`, and on `:root` they are invalid.
3. Use a scale listed in `radix-colors.css` and `RADIX_PALETTES`; a new scale goes into both and
   into `ROLE_SCALES`, `CATEGORY_PALETTE` or `LEGACY_PALETTES`.
4. Run `tokens.test.ts`. It checks: `RADIX_PALETTES` equals the imports of `radix-colors.css`, is
   the union of the three palette lists and covers every palette name used in `apps/app/src` and
   `apps/site/src`; every color token in both blocks is one step of an imported scale (not
   `gray`), literals only for the three exceptions, no `var(--cp-*)` that tokens.css does not
   declare, no duplicates; the same selector list on every block and the gutter block after the
   main blocks; component tokens only in their block, none repeating a role value; no
   `--cp-selection-*` and no jade in the roles; `BRAND_COLORS` equals the light values of
   `--cp-brand-primary` and `--cp-surface-base`; `--cp-accent-*` and `--cp-focus-ring` use the
   theme accent scale; each `PROP_COLOR` role is the scale of its `--cp-*` tokens; `TYPE_ROLES`,
   `ICON_SIZE` and the `BREAKPOINTS.sm` gutter match tokens.css; `--cp-width-shell` equals
   `DESKTOP_SHELL_MAX_WIDTH`; the `--cp-z-*` order.

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
| `@radix-ui/colors` imports                                                              | ESLint `no-restricted-imports` `[radix-colors]` (`config/eslint/project.js`)                |

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

## Removed: `themeColor()`

`themeColor()` (`helpers/colors.ts`), `constants/styled-themes.ts` and the styled `ThemeProvider`
were removed in #899. Colors come only from `@chipin/tokens` (`var(--cp-*)`, `PROP_COLOR`).
