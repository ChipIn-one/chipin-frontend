# Spec 05: styles, tokens, dark theme, assets

Owner decisions: D14 (styles), D16 (assets, vendor regex), D7 (`packages/tokens`), D8 (the Astro site uses tokens).
Based on DS v1: `docs/superpowers/specs/2026-10-22-design-system-v1-design.md` (on master since 01312ea).
The DS v1 decisions are not revisited, except those listed in the section "Changes relative to DS v1".
PR identifiers are `05-<n>` (global scheme, `00-overview.md`; after review C `05-2` is split into `05-2a`/`05-2b`). All lint/stylelint rules of this spec are rows of the spec 02 registry §D0 (C1-14). There are no deviations from DECISIONS; deviations from DS v1 are in a separate section.

**Order relative to the monorepo (04-0):** 05-1 — before or after 04-0 (works in `src/`); 05-2a…05-7 — only after 04-0 (npm workspaces are needed). The codemod 05-4 goes after 04-0, so as not to conflict with the rename.
**Ownership of overlapping topics:** vendor-regex and removal of `dexie` — 02-B1; lazy-loading of locales — 04-2c; SW registration (`PWABadge`) — 04-2d; the ESLint config and the `restrictedImports()` helper — 02-C4; boundaries — 02-C9; jsx-a11y — 02-C8; ds-gallery aliases — 02-C3; ds-gallery typecheck — 02-C5. This spec is the sole owner of `packages/tokens`, next-themes, stylelint, the styled allowlist, and `no-raw-colors`.

## Goal

1. A single source of tokens for the app, the Astro site, and ds-gallery: `packages/tokens/tokens.json` (DTCG). From it the generator builds `tokens.css` and `tokens.ts`.
2. A single theme switching mechanism (light/dark/system); both themes stay.
   - Currently there are 4. One is needed: a value in the store → a class on `<html>` → `<Theme appearance>`.
   - No flicker on load (FOUC).
3. Retire `styled-themes.ts` and `themeColor()`.
   - styled-components no longer grows: editing a file means moving it to CSS Modules, there are no new imports. All this is checked by lint and CI.
4. A clear boundary between `basics` and `components`.
5. Less Radix CSS, the vendor chunk fixed, assets prepared for the offline PWA (D2).
6. An agent must know unambiguously where to add a color, where to change the theme, and what to style with.

## Context (audit references)

- The palette is shipped twice.
  - `src/constants/styled-themes.ts:1-269` imports 31 scales from the phantom `@radix-ui/colors`.
  - It is used via `themeColor()` (`src/helpers/colors.ts:5-8`): 21 files, about 62 calls, 15 scales.
  - This is about 126 KB of source in the `useScrollToTop` chunk (`05-deps-styling.md`, finding 1).
- Gray mismatch.
  - `<Theme grayColor="olive">` (`src/main.tsx:43`, `src/public-routes/PublicApp.tsx:66`, `ds-gallery/gallery.tsx:403`).
  - Meanwhile `themeColor('gray11')` returns a pure gray hex.
  - Inside `.radix-themes` the variable `--gray-N` is remapped to olive (`@radix-ui/themes/tokens/base.css:951`). Therefore styled surfaces currently stand out from the theme.
- The dark theme is implemented in 4 ways (finding 8):
  - `next-themes` in `src/root.tsx:57-63`. Readers: `main.tsx:31`, `components/DevMenu.tsx:35`, `components/ThemeSwitcherDev.tsx:10`, `hooks/useSyncUserSettings.tsx:16,23`;
  - `useSyncExternalStore` in `PublicApp.tsx:24-50`;
  - `<Theme>` duplicated in 3 files;
  - the styled `ThemeProvider`.
  - In addition, `global-error-boundary/styles.css:12-18` depends on the classes `.light`/`.dark`.
- Radix CSS: `vendor-radix.css` weighs 683 KB raw / 80 KB gz because of the full import of `@radix-ui/themes/styles.css` (`src/root.tsx:20`). `tokens.css` inside it weighs 177 KB (finding 5).
- The `basics` layer:
  - `basics/RelativeTime.tsx:6` imports a store;
  - `basics/BalanceBadges.tsx:8` imports `components/skeletons`;
  - `basics/PWABadge.tsx` has a side effect (SW registration).
  - 6 thin wrappers (finding 7).
- Assets:
  - `src/assets/dashboard-onboarding.png`: 354 KB, 1254×1254, shown at ≈352 px, ends up in precache (`vite.config.ts:198`);
  - `src/assets/apple-icon.svg` is not used;
  - PWA icons are regenerated on every build (`package.json:8,17`).
- The `vendor-react` regex (`vite.config.ts:263`) does not catch `react-router`, so an anonymous 41 KB chunk appears (fixed by 02-B1, not this spec).
- DS v1 is 0% implemented (`05-deps-styling.md`, "Plan vs reality"). Palette-name hits: 83.

## Decision

### 1. `packages/tokens`

Structure (the package name `@chipin/tokens` — per the layout of spec 04 §1.1; all files below are new):

```
packages/tokens/
  package.json            # private, no build step for consumers; exports: ./tokens.css, ./radix-colors.css,
                          # ./tokens (ts), ./theme-init (ts), ./assets/*
  tokens.json             # SOURCE OF TRUTH, DTCG 2025.10 ($type, $value, aliases, light/dark modes)
  scripts/build-tokens.mjs  # generator (~120 lines, no dependencies): tokens.json -> generated/*
  scripts/check-tokens.mjs  # tokens:check — see "Checks"
  generated/tokens.css    # DO NOT EDIT: --cp-* for light and dark
  generated/tokens.ts     # DO NOT EDIT: RADIX_THEME, RADIX_PALETTES, PROP_COLOR, the CpToken type
  generated/manifest-colors.json  # DO NOT EDIT: { theme_color, background_color } in hex (D23, item 6)
  src/radix-colors.css    # 22 @imports of Radix scales (see item 5); the list is checked against RADIX_PALETTES
  src/theme-init.ts       # the anti-FOUC inline script string + its sha256 (item 2)
  assets/logo.svg, assets/favicon.svg   # brand marks (moved from src/assets and public/)
```

**Levels in `tokens.json`** (the same as in DS v1, "Token levels"):

1. Primitives — aliases of Radix scales (`grass.1..12`, `olive.1..12`, alpha) and literals:
   - `space.1..9` = 4, 8, 12, 16, 24, 32, 40, 48, 64 px (equal to Radix at scaling 100%);
   - `radius.1..6` = 4.5, 6, 9, 12, 18, 24 px (Radix base × factor 1.5 for `radius="large"`) and `radius.pill` = 9999px;
   - `font.family.sans` = the `--default-font-family` stack from Radix (system font, no webfont);
   - `font.size.1..9` = 12, 14, 16, 18, 20, 24, 28, 35, 60 px; `font.weight.{regular 400, medium 500, bold 700}`;
   - `shadow.{card,popover}` from `olive.a*` and `rgba` (a literal is allowed only in tokens.json);
   - `z.{content 0, raised 1, floating 2}` — currently only these values are in the code; for modal windows the layers are set by Radix portals;
   - `motion.duration.{fast 120ms, base 160ms}`, `motion.easing.{standard ease, out ease-out}` (currently the code has 120/150/160 ms, 150 is folded into 160);
   - `brand.loader` = `#80c837` (a literal from `basics/ChipInLoader.tsx:10`, preserves the look);
   - `brand.primary` = alias `grass.9` (D23) — the only source of the main brand color.
2. Semantics with light/dark modes: `color.text.*`, `color.surface.*`, `color.border.*`, `color.fill.*`, `color.accent.*`, `color.status.*`, `color.debt.{owed,owing,settled}`, `color.selection.*`, `color.focus.ring`, `color.media.*`.
3. Component tokens — the minimum, only what is needed for the codemod (the table in "Details"): `fab.border*`, `nav.highlight*`, `logo.mode.*`, `avatar.placeholder.*`, `landing.*`.

**What the generator produces:**

- `generated/tokens.css`. Each token becomes `--cp-<path joined with ->`: `color.text.secondary` → `--cp-text-secondary` (the prefix `color.` is dropped), `space.3` → `--cp-space-3`.
  - Colors reference **a concrete scale**: `--cp-text-secondary: var(--olive-11)`. References to `--accent-*` and `--gray-*` are forbidden. Reason:
    - `--accent-*` exists only inside `.radix-themes`, and the Astro site has no Radix Themes;
    - a custom property declared on `:root` evaluates `var()` at the place of declaration and becomes invalid when it references a nonexistent variable.
  - Declaration selector: `:root, .light, .light-theme, .dark, .dark-theme`. This way the token is recomputed in a nested theme, for example in `<Theme appearance="dark">` inside a light page.
  - The `dark` mode in tokens.json is needed only where the value differs by more than the scale's own light/dark switch. Radix scales switch by `.dark` on their own.
- `generated/tokens.ts`:
  - `RADIX_THEME = { accentColor: 'grass', grayColor: 'olive', radius: 'large', panelBackground: 'solid', scaling: '100%' } as const`;
  - `PROP_COLOR = { debtOwed: 'green', debtOwing: 'red', debtSettled: 'gray', danger: 'red', warning: 'amber', ... } as const` — roles for Radix `color` props, which do not accept CSS variables;
  - `RADIX_PALETTES` — the list of scales imported by `radix-colors.css`;
  - the type `CpToken` — a union of the `--cp-*` names.
- `generated/manifest-colors.json` (D23): `theme_color` = `brand.primary` (= `grass.9`, light), `background_color` = the background role `color.surface.base` (light). The generator resolves aliases to hex — this is the only place where the brand hex appears outside `tokens.json`.

**Wiring into the app** (`apps/app/src/styles/index.css`, the only CSS entry, imported from `root.tsx` instead of `@radix-ui/themes/styles.css`):

```css
@import '@radix-ui/themes/tokens/base.css';
@import '@chipin/tokens/radix-colors.css';
@import '@radix-ui/themes/components.css';
@import '@radix-ui/themes/utilities.css';
@import '@chipin/tokens/tokens.css';
@import './radixStylesOverwrite.css';
```

`<Theme>` is configured in exactly one place: `apps/app/src/design-system/AppTheme.tsx`. It is `<Theme {...RADIX_THEME} appearance={appearance} hasBackground>`; `appearance` comes as a prop (the caller reads the store), so `design-system/` is a `basics` level in the layer graph (spec 02 D5). It is used by `main.tsx` and ds-gallery. `PublicApp.tsx` uses `RADIX_THEME` until its removal in spec 04.

**Wiring into Astro** (`apps/site`, spec 04): in the base layout

```css
@import '@chipin/tokens/radix-colors.css';
@import '@chipin/tokens/tokens.css';
```

- Without `base.css`/`components.css`, since D8 has no Radix Themes.
- `@radix-ui/themes` is installed in the site only as a devDependency for the scale CSS files, no JS goes into the bundle.
- The site uses only `--cp-*`, including `--cp-space-*`, `--cp-radius-*`, `--cp-font-*`.

**Olive versus gray: olive is chosen** (DS v1 decision, owner decision 3).

- Visual effect. Surfaces from 21 styled files go from neutral gray to olive with a faint green tint:
  - `gray-11 #646464` → `olive-11 #60655f`;
  - `gray-6 #d9d9d9` → `olive-6 #d7dad7`;
  - `gray-12 #202020` → `olive-12 #1d211c`.
- The difference ΔE is about 1–2: to the eye it is noticeable only next to pure gray, i.e. exactly at the current joints of styled code and Radix components.
- 198 files on Radix Themes are already olive and do not change.
- The opposite choice (`grayColor="gray"`) would change the whole interface.
- Flag for the owner: see "Open questions".

### 2. Theme (light/dark/system): a single switching mechanism

- **Store.** `src/store/ui-prefs/appearanceStore.ts` (Zustand, UI state per D3; the path is fixed by spec 03 §6: UI stores live in `src/store/ui-prefs/`):
  - `preference: 'light' | 'dark' | 'system'`, `resolved: 'light' | 'dark'`, `setPreference(p)`;
  - storage in localStorage, key `LS_KEY_THEME` (`Chipin_theme`), through `helpers/localStorage.ts`;
  - the value is a raw string: the same format that next-themes wrote, so users do not lose their choice.
- **Applying.** `applyAppearance(resolved)` sets on `<html>` the class `light` or `dark` (removing the other) and `style.colorScheme`. A class was chosen over `[data-theme]` because the Radix scale files switch by `.dark, .dark-theme` themselves. `<Theme appearance={resolved}>` and `<Toaster theme={resolved}>` read the same `resolved`.
- **System.** With `preference === 'system'` the store subscribes to `matchMedia('(prefers-color-scheme: dark)')` and updates `resolved`. The subscription is removed when the preference changes.
- **Preference source.**
  - `useSyncUserSettings` calls `setPreference(settings.theme)` when the server settings arrive.
  - If there are no server settings, the local key applies.
  - A one-time migration at store init: if there is no key but `getLocalUser()?.settings.theme` has a value, it is written to the key. This replaces `resolveStoredTheme` in `root.tsx:59`.
  - Remove this branch after 2 releases (the Issue is created in PR 05-3).
- **FOUC.** `packages/tokens/src/theme-init.ts` exports `THEME_INIT_SCRIPT`, an IIFE of about 12 lines in try/catch:
  - reads `localStorage['Chipin_theme']`;
  - `dark` or (`system`/no value and `matchMedia` dark) → class `dark`, otherwise `light`;
  - on exception → `light`.
  - A Vite plugin in `apps/app/vite.config.ts` (`transformIndexHtml`, 10 lines) inserts the script as the first element of `<head>` in `app.html`. Astro inserts it like this: `<script is:inline set:html={THEME_INIT_SCRIPT} />`.
  - CSP: `'sha256-<hash>'` is added to `script-src`. The test `theme-init.test.ts` computes the hash and checks that it is in the generated `vercel.json` (D6). On a mismatch the test prints the expected value.
  - The key is duplicated in the script string. The test checks that the string contains `LS_KEY_THEME`.
- **Removed:**
  - `next-themes` (dependency) and `ThemeProvider` in `root.tsx`;
  - `useTheme` in 4 files (`main`, `DevMenu`, `ThemeSwitcherDev`, `useSyncUserSettings`) and their test mocks;
  - `isThemeDark`, `resolveStoredTheme` from `helpers/theme.ts`.
  - `isPreferredPublicThemeDark` and the logic of `PublicApp.tsx:24-50` are removed together with `public-routes/` in spec 04. We do not touch them here.

### 3. Retiring styled-components

**Codemod `themeColor()` → `var(--cp-*)`.**

- The script `scripts/codemods/theme-color-to-vars.mjs` runs once and is deleted in the same PR.
- It replaces `${themeColor('k')}` with `var(--cp-…)`, and a bare `themeColor('k')` in an expression with `'var(--cp-…)'`.
- Dynamic calls (`AddExpenseButton.tsx:17`, `desktop-sidebar/styled.ts:12`, `interactiveCardStyles.ts:41-56`) are fixed by hand using the table in "Details".
- In the same files `var(--space-N)` → `var(--cp-space-N)` and `var(--radius-N)` → `var(--cp-radius-N)` are replaced (98 places, 1:1 by value), as well as 14 direct `var(--<palette>-N)`.

Then removed:

- `src/constants/styled-themes.ts`;
- `src/helpers/colors.ts` (`hexToRgba` is not used);
- `src/types/styled.d.ts`;
- the styled-components `<ThemeProvider>` in `main.tsx`, `PublicApp.tsx`, and `ds-gallery/gallery.tsx`.

The phantom `@radix-ui/colors` goes into `no-restricted-imports`.

**The rule "no new styled-components".**

- `config/eslint/styled-components-allowlist.json` is generated once by the script `scripts/generate-styled-allowlist.mjs` from the current importers (55 non-test files + tests that import `styled-components`).
- `no-restricted-imports` for `styled-components` applies to `src/**`, `ds-gallery/**`, and is turned off for files in the allowlist.
- Flat config trap: a same-named rule in a later block **replaces** the options, it does not merge them. Therefore all `no-restricted-imports` blocks are built through the shared helper `restrictedImports(extraPaths, extraPatterns)` from `config/eslint/project.js`, otherwise the restrictions on axios and api disappear (`eslint.config.js:143-210`). The config refactoring and the `restrictedImports()` helper are spec 02 (PR 02-C4); 05-5 depends on it and only adds its own paths.
- `scripts/check-styled-allowlist.mjs` (in `lint`, about 60 lines):
  1. every entry exists and still imports `styled-components`, otherwise the error "remove the entry";
  2. the number of entries ≤ the number in `git show $BASE_SHA:config/eslint/styled-components-allowlist.json` (decrease only). The script accepts `--base "$BASE_SHA"`; CI passes `BASE_SHA` from `steps.gate.outputs.base_sha` (02 D7, C1-15), with `CI=true` and an empty `--base` in a PR the script fails; the ref `origin/master` does not exist in CI; locally the default is `git merge-base HEAD origin/master` (A-19);
  3. the touch rule: if a PR changes a file from the allowlist and it is `**/styled.ts` or the added lines contain `styled[.(]`, `` css` ``, `` keyframes` ``, `createGlobalStyle`, then the file must leave the allowlist, i.e. be moved to CSS Modules. A diff in which all changed lines are `import …`/`export … from …` does not count as a touch (the codemods 02-D2/02-D3 change imports in 31 `styled.ts`, A-18);
  4. an exception is an entry in `config/eslint/styled-touch-exempt.json` (`{path, reason, issue}`) in the same PR. Entries without `issue` are an error.

**CSS Modules conventions.**

- The file `Component.module.css` lies next to `Component.tsx`. One module per component. Modules shared by several components are forbidden. A shared style needs a component.
- Import: `import styles from './Component.module.css'`. A default import of a CSS module does not violate D11, because that rule concerns exports.
- Class names are camelCase. The root class is `.root`, parts — `.header`, `.amount`.
- States and variants are set by data attributes (`data-active`, `data-variant="solo"`), not conditional classes. CSS: `.root[data-variant='solo']`.
- An external `className` is joined by the helper `src/helpers/cx.ts` (5 lines, no dependency).
- `composes:` is allowed only from the same file.
- Vite: `css.modules = { localsConvention: 'camelCaseOnly', generateScopedName: dev ? '[name]__[local]' : '[hash:base64:6]' }`. Tests do not check class names.
- Breakpoints are given as literals equal to Radix: `min-width` 520/768/1024/1280/1640px, `max-width` 0.02px less. This is a convention without lint: a rule for a list of values is not auto-fixable and under 02 §D0 (class c) is not introduced (C1-14). We do not use `@custom-media`: it needs one more plugin, and the definitions are visible only inside a file.
- Global styles are allowed only in `apps/app/src/styles/*.css`. `createGlobalStyle` from `overlay-layout/styled.ts:7` is moved to `styles/modal-overlay.css` when touched.

**Radix props first** (the order of choice; the rule is duplicated in the new `docs/design-system/process.md` (created by the DS v1 tasks)):

1. Radix component props: `size`, `variant`, `color` (only via `PROP_COLOR`), `highContrast`, `radius`.
2. Layout props of `Box`/`Flex`/`Grid`/`Text`: `p`, `m`, `gap`, `width`, `display`, responsive objects `{ initial, xs, sm }`.
3. A CSS Module with `--cp-*` — only for what is not in the props: gradients, pseudo-elements, `:has`, transitions, `position: fixed` and safe-area, complex grid, custom variables of Radix components.
4. Forbidden:
   - `.rt-*` selectors outside `styles/radixStylesOverwrite.css`;
   - `style={{…}}` with ordinary properties. Only custom properties are allowed (`style={{ '--cover-url': url }}`). ESLint: `no-restricted-syntax` on `JSXAttribute[name.name='style'] ObjectExpression > Property[key.type='Identifier']`. The existing 6 places in 2 files are converted in PR 05-5.

**Ban on hardcoding (D23: no hex/rgb outside `packages/tokens`; stylelint for `*.css` and `<style>` in `*.astro` in apps/*; `packages/tokens` is excluded).**

New devDeps: `stylelint`, `stylelint-value-no-unknown-custom-properties`. Rules:

- `color-no-hex`, `color-named: 'never'`;
- `function-disallowed-list: [rgb, rgba, hsl, hsla, hwb, lab, lch, oklch, color]`;
- `declaration-property-value-disallowed-list: { '/.*/': ['/var\\(--(?!cp-|_)/'] }` — in CSS only `--cp-*` and local `--_*`;
- `csstools/value-no-unknown-custom-properties` with `importFrom: packages/tokens/generated/tokens.css` (catches agents' typos);
- ~~`unit-disallowed-list` px~~ — not introduced (class c of 02 §D0: no autofix; C1-14); paddings and sizes — through `--cp-space-*`/`--cp-radius-*` as a convention;
- `selector-disallowed-list: ['/\\.rt-/']`, the exception is `radixStylesOverwrite.css` via `overrides`;
- `reportDescriptionlessDisables: true`.

Exceptions to D23 "no raw hex" (A-29; recorded as an addition to D23 and raised to the owner in `00-overview.md` item 30): `brand.loader #80c837` and `media-on/scrim #fff/#000` live only in `tokens.json` (there is no hex outside it), and the file `components/global-error-boundary/styles.css`. Exception by file: `components/global-error-boundary/styles.css`. It intentionally uses system colors and fallback hex, because it must render even without the app CSS loaded. Its `.light`/`.dark` keep working from the class on `<html>`.

For TS/TSX (all files, including frozen styled ones and `vite.config.ts`) and the frontmatter of `*.astro`, the ESLint `no-raw-colors` from DS v1 (rule 1) applies: hex/rgb/hsl and `var(--<palette>-N)` are an error; `packages/tokens/**` is excluded. The implementation (A-17) has no plugin of its own: a `no-restricted-syntax` block in `config/eslint/project.js` (through the `restrictedSyntax()` helper from 02-C4) with two selectors (C1-21: anchors, so that `'#add'`, `'#cafe'`, `'#feed'` as id/anchor are not caught): `Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|\b(?:rgba?|hsla?)\(|var\(--(?!cp-|_)[a-z]+-a?\d+\)/]` — the string is entirely a color or contains a color function/palette variable; `TemplateElement[value.raw=/(?:^|[\s:,(])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?)\(|var\(--(?!cp-|_)[a-z]+-a?\d+\)/]` — the CSS context of styled templates; message "[no-raw-colors] use var(--cp-*) from @chipin/tokens". Fixtures: `'#fff'`, `` `color: rgb(0 0 0)` ``, `` `border: 1px solid #ddd` ``, `'var(--gray-11)'` — 4 errors; `'var(--cp-text-primary)'`, `'#add-expense'`, `'#feedback'` — 0. A string that as a whole looks like hex but is not a color (`'#add'`) — `eslint-disable-next-line no-restricted-syntax -- not a color: <reason>`. For CSS and `<style>` in `.astro` — stylelint below (`color-no-hex`, `function-disallowed-list`, `declaration-property-value-disallowed-list`). Both are introduced by 05-5. The known places outside the 21 codemod files (C2-30) are converted or marked by 05-5 in the same PR: `OfflineQRCode.tsx:42,45` (canvas does not understand `var()`: the color is read with `getComputedStyle(document.documentElement).getPropertyValue('--cp-media-on' | '--cp-media-scrim')` through `helpers/cssToken.ts`), `ChipInLoader.tsx:10` (→ `var(--cp-brand-loader)`), direct `var(--gray-*)`/`var(--green-*)` in `EventIcon.tsx:26`, `InviteOnboarding.tsx:15,38`, `Icon404.tsx:8-20`, `auth-modal/styled.ts:11` (→ `--cp-*` roles; if the file is in the styled allowlist this is not a "touch", the edit is only of the color value). Stylelint for `.astro` — via `postcss-html` (`customSyntax`). `no-palette-theme-keys` is not needed (see "Changes").

### 4. The `basics` and `components` boundary

**Definition** (goes into the new `docs/design-system/components.md` and is checked by the boundaries rule from spec 02 (02-C9), D13):

- `basics/` — presentational components: only props → JSX.
  - It may import React, Radix, lucide, i18n, `helpers/*`, `@chipin/tokens`, and other `basics`.
  - It may not import `store/*`, `api/*`, `components/*`, `features/*`, `pages/*`, and may not have side effects (SW, subscriptions, timers other than animation).
- `components/` — compositions that are allowed to read stores and hooks of the app.
- A presentational component without a store, used in 2 or more features, lives in `basics`.

**Violations and fixes:**

| File | Violation | Action |
|---|---|---|
| `basics/RelativeTime.tsx` | `store/users-store` (24h format) | move to `components/RelativeTime.tsx`, update 8 imports in `features/activity/**` |
| `basics/BalanceBadges.tsx` | `components/skeletons` | `components/skeletons/BalanceBadgesSkeleton.tsx` (does not read the store) is moved to `basics/skeletons/BalanceBadgesSkeleton.tsx` |
| `basics/PWABadge.tsx` | the SW registration side effect | **not moved** here: it stays in the boundaries suppressions until 04-2d, which replaces it with `src/app/pwa/ServiceWorkerManager.tsx` |
| `basics/buttons/NavButton.tsx:7` | `hooks/*` | the hook dependency is lifted into the calling component (a prop), or the file is moved to `components/` (C1-24) |
| `basics/BalanceSummaryText.tsx:8` | `api/*` types | a domain type instead of `Api*` (import from `entities/balance` after 03-3, before that — from `types/`) (C1-24) |

**Thin Radix wrappers** (DS v1: do not wrap). Criterion: a wrapper that only sets defaults is deleted. A wrapper that fixes a ChipIn decision (size, data API, used in 3+ places, value normalization) is a ChipIn component with a card (DS v1 itself lists SegmentedControl/Select/Dropdown/ProgressBar among the cards).

| Wrapper | Lines / consumers | Action |
|---|---|---|
| `basics/Checkbox.tsx` | 21 / 1 | **delete**: the direct Radix `Checkbox`, `color='grass'` is taken from accent, `size='2'` is the default |
| `basics/RadioGroup.tsx` | 29 / 1 | **delete**, inline it at the single place of use |
| `components/SegmentedControl.tsx` | 26 / 6 | **keep**, move to `basics/`: fixes the responsive size `{initial:'2', sm:'3'}` |
| `components/Select.tsx` | 91 / 2 + gallery | **keep**, move to `basics/`: items/render API |
| `components/Dropdown.tsx` | 135 / 4 + gallery | **keep**, move to `basics/`: sections API |
| `components/progress-bar/ProgressBar.tsx` | 31 / 1 | **keep**, move to `basics/`: clamps value |

Moved files immediately switch to a named export (D11), because their imports change anyway.

**A11y baseline for custom primitives** (everything that is not a direct Radix component):

1. A native element (`button`, `a`, `label`, `input`) or a Radix primitive is used. Clickable `div`/`span` are forbidden (jsx-a11y from spec 02, 02-C8).
2. Visible focus: `:focus-visible { outline: 2px solid var(--cp-focus-ring); outline-offset: 2px; }`. Removing `outline` without a replacement is forbidden.
3. Every control has an accessible name. For icon-only it is an `aria-label` through i18n.
4. State is conveyed by an attribute (`aria-pressed`, `aria-current`, `aria-expanded`, `aria-invalid`), not by color alone.
5. The tap target on mobile is not smaller than 44×44 CSS px.
6. Text: only `--cp-text-*` (scales 11–12) on `--cp-surface-*` (1–3). Radix guarantees a contrast of at least 4.5:1.
7. Animations on `--cp-duration-*`. `tokens.css` has an `@media (prefers-reduced-motion: reduce)` block that zeroes the durations.

In PR 05-6, the 3 unchecked buttons from the audit are checked against these items: `SummaryCardButton`, `InviteActionButton`, `NavButton`.

### 5. Radix CSS size and chunks

- `@radix-ui/themes/styles.css` is replaced by the 4 imports from item 1.
- `packages/tokens/src/radix-colors.css` imports 22 scales — all that occur in the code, including the category colors from `constants/category-ui.ts`:
  `amber blue brown crimson cyan gold grass gray green indigo jade mint olive orange pink purple red sky teal tomato violet yellow` (`@import '@radix-ui/themes/tokens/colors/<name>.css';`).
- 9 are not imported: `bronze iris lime mauve plum ruby sage sand slate`. The saving is about 44 KB raw.
- A correction to the audit. The estimate of 120–140 KB was based on 8 palettes and did not account for the categories, which use 17 palettes. `base.css` (47 KB) contains the accent mapping for all 31 colors, and it can be trimmed only by a fork — we do not do this.
- `components.css`/`utilities.css` are needed in full: the responsive props depend on them.
- Protection: `tokens:check` looks in `src/**` for literals of Radix palette names in JSX/TS (`color="x"`, `color: 'x'`) and fails if the palette is not in `RADIX_PALETTES`. Without this check a missing scale would silently render transparent.
- `RADIX_PALETTES` is set in `tokens.json` (`$extensions.chipin.radixPalettes`). The check compares this list with `radix-colors.css`.
- The vendor regex and `vendor-misc` without `dexie` — PR 02-B1 (the sole owner). We do not touch them here.
- Lazy loading of locales is done by spec 04 (04-2c). We do not touch it here.

### 6. Assets

- `dashboard-onboarding.png` → `dashboard-onboarding.webp`, 704×704 (2× of 352 px), q80, target ≤ 40 KB.
  - Converted once via `cwebp -resize 704 704 -q 80` (libwebp). The result is committed, the build has no dependency (`sharp` is removed per D16).
  - The raw `<img>` in `DashboardOnboarding.tsx:52-62` is replaced by `basics/Image` with `alt=""` and `aria-hidden`.
  - Likewise `group-invite-empty-state.png` (9.8 KB) → WebP.
  - The precache `globPatterns` is currently `js,css,html,svg,png,ico` (`vite.config.ts:198`), i.e. `webp` (including the existing `auth-shared-expenses.webp`) is unavailable offline. **05-1 itself adds `webp`** to `globPatterns` (one line); 04-2d moves the pattern into `pwa.config.ts` (spec 04 §2.11) without changing the extensions.
- `src/assets/apple-icon.svg` is removed (0 references).
- `logo.svg` and `favicon.svg` are moved to `packages/tokens/assets/`.
  - The app imports `@chipin/tokens/assets/logo.svg?react` (svgr).
  - Astro imports the SVG as a component.
  - Serving by host (spec 04 §3.6, D26): the site on `chipin.one` sets `<link rel="icon">` to `@chipin/tokens/assets/favicon.svg?url`, the PWA manifest icons are served by the app project on `app.chipin.one` at the same paths `/pwa-*.png` (A-28). The source for `pwa-assets.config.ts:8` is `packages/tokens/assets/favicon.svg`.
- PWA icons are no longer regenerated on every build: `create-pwa-icons` is removed from `build`/`vercel-build`, running it manually is spec 02 (02-B1, `icons:generate`). Here only the path to the source changes.
- `theme_color: '#3e9b4f'` (`vite.config.ts:149`) is exactly Radix `grass-10` (`@radix-ui/themes/tokens/colors/grass.css`: `--grass-10: #3e9b4f`; A-24, the earlier text "does not match any step" is wrong).
  - D23 (accepted by the owner 2026-10-28): `manifest` in `vite-plugin-pwa` (`theme_color`, `background_color`; after 04-2d — inside `buildPwaOptions()` in `apps/app/pwa.config.ts`, spec 04 §2.11) and `<meta name="theme-color">` in `app.html` (through the same `transformIndexHtml` plugin as theme-init) are read from `@chipin/tokens/generated/manifest-colors.json`; the Astro site (`BaseLayout`) reads the same file. There are no color literals in `vite.config.ts`, `app.html`, and `.astro`.
  - A visible change: the PWA status bar color on Android (`#3e9b4f` → grass-9 `#46a758`) — accepted in D23, but on a false premise. Flag to the owner (`00-overview.md` item 26): `brand.primary` = alias `grass.10` keeps the current color with no visible change; by default grass-9 stays (D23, matches `accent-solid`).
  - The main brand color is the same in styled code (`var(--cp-*)`), Radix `<Theme accentColor>` (`RADIX_THEME`), the PWA manifest/`theme-color`, and on the site, because all four are derived from one token `brand.primary` in `tokens.json`; a divergence is caught by `tokens:check` (item 5 of "Checks").
- Icons: all UI icons are taken from `lucide-react` by named import (size is set by the `size` prop, color — `currentColor`). svgr is used only for brand marks and third-party logos: `logo.svg` and `google-icon.svg`.
  - ESLint: `no-restricted-imports` with the pattern `regex: '\\.svg\\?react$'` and an allowlist of 3 files (`Footer.tsx`, `mode-logotype/styled.ts` or its future module, `AuthButtons.tsx`).
  - Drawing new SVG icons is forbidden. If lucide lacks the needed icon, the owner decides.

### 7. ds-gallery

- It gets tokens exactly the way the app does:
  - imports `apps/app/src/styles/index.css`;
  - is wrapped in `AppTheme`;
  - switches the theme through `appearanceStore.setPreference`.
- `ThemeProvider` and `styled-themes` are removed (`gallery.tsx:28,402`). The manual list of aliases in `ds-gallery/vite.config.ts` is removed by 02-C3 (not this spec).
- The "Tokens" section: a table of samples of all `--cp-*` color roles in light/dark. Built from `generated/tokens.ts`, so a new token appears in the gallery automatically.
- **Visual regression harness — no.** This is YAGNI: DS v1 (owner decision 4) forbids cloud VR tools, and local Playwright with data fixtures for a single developer costs more than it is worth. The gallery stays the place for manual before/after comparison at the component level. Automatic VR is a DS v1 follow-up, not this spec.

## Details

**Codemod table** (key `themeColor` → role → value in tokens.json). 15 scales: gray, grayA, grass, grassA, green, jade, jadeA, mint, violet, violetA, red, redA, amber, amberA, white/black.

| Key | Role `--cp-*` | Alias |
|---|---|---|
| gray1 / gray2 / gray3 | surface-base / surface-subtle / surface-muted | olive-1 / 2 / 3 |
| gray6 / gray8 | border-default / border-strong | olive-6 / 8 |
| gray10 / gray11 / gray12 | text-muted / text-secondary / text-primary | olive-10 / 11 / 12 |
| grayA2 / grayA3 | fill-hover / fill-pressed | olive-a2 / a3 |
| grayA6 / grayA8 / grayA9 | border-translucent / border-translucent-strong / fill-scrim | olive-a6 / a8 / a9 |
| grass3 / grass7 / grass9 | accent-surface / fab-border / accent-solid | grass-3 / 7 / 9 |
| grassA8 | focus-ring | grass-a8 |
| green2 / green5 | landing-cta-to / landing-cta-from | green-2 / 5 |
| green4 | nav-highlight | green-4 |
| green6 | border-brand (Header), landing-step-marker (how-it-works) | green-6 |
| jade7 | selection-border-subtle; in the gradient `user-avatar-modal/styled.ts:10` — avatar-placeholder-from | jade-7 |
| jade8 / jade9 | selection-border / selection-solid | jade-8 / 9 |
| jade11 | landing-preview-gradient-to | jade-11 |
| jadeA2 / jadeA3 | selection-surface / selection-surface-hover | jade-a2 / a3 |
| mint7 | avatar-placeholder-to | mint-7 |
| violet4 / violet7 | nav-highlight-solo / fab-border-solo | violet-4 / 7 |
| violet9 / violet11 | logo-mode-primary / logo-mode-secondary | violet-9 / 11 |
| violetA8 | landing-preview-glow | violet-a8 |
| red8 / redA2 | status-danger-border / status-danger-surface | red-8 / a2 |
| amber11 / amberA3 | status-warning-text / status-warning-surface | amber-11 / a3 |
| white / black | media-on (text over a cover) / media-scrim | `#ffffff` / `#000000`, both modes |

In addition, a DS v1 requirement: `debt-owed` → green-11, `debt-owing` → red-11, `debt-settled` → olive-11, `status-success` → green-11, `status-info` → blue-11, `text-inverse` → olive-1. For props the same roles are in `PROP_COLOR`.

`interactiveCardStyles.ts` changes the parameter types from `ThemeColorToken` to `CpToken`, and the calls in `group-card/styled.ts` and `activity-event/styled.ts` — to role names.

**Checks** (one command `tokens:check` in `lint`, fits within the DS v1 budget of up to 30 s):

1. The generator in dry-run, `generated/*` must match the committed files.
2. Validation of `tokens.json`: known `$type`s, all aliases resolve, no unused semantic tokens (search for `--cp-x` across `apps/**`, `ds-gallery/**`).
3. `RADIX_PALETTES` matches `radix-colors.css` and covers the palette literals in the code.
4. The `accent`/`gray` scales in the semantics match `RADIX_THEME.accentColor`/`grayColor`.
5. `manifest-colors.json.theme_color` = the hex of `brand.primary`, and `brand.primary` references the scale `RADIX_THEME.accentColor`. The brand is changed in tokens.json with one edit of `accentColor` plus the aliases in the accent group; the check catches forgotten places.

## Nuances and pitfalls

- A custom property on `:root` with `var(--accent-9)` is invalid (accent is declared only inside `.radix-themes`). Therefore the generator references only concrete scales.
- The class on `<html>` is the main one. If `<Theme appearance>` diverges from it, `--cp-*` (computed on `:root`) and the Radix components will show different modes. Both values are taken from one `resolved`. The store test checks that the html class and `resolved` match after every `setPreference`.
- The anti-FOUC script is inserted only into `app.html` (after 04-5a it is renamed to `index.html`; the plugin looks for the single html entry). The public `index.html` (SSG) is not touched until spec 04: it has its own logic in `PublicApp`, and double control of the class would give flicker.
- The codemod is the only PR that changes pixels (gray → olive). It is isolated from other changes so that the screenshot diff is explained by one cause.
- Tests that mock `next-themes` (`DevMenu.test.tsx`, `ThemeSwitcherDev.test.tsx`, `useSyncUserSettings.test.tsx`) move to the real `appearanceStore` with `resetStore` in `beforeEach`.
- jsdom has no `matchMedia`. The store must work without it (fallback `light`), like the current `PublicApp.tsx:24-27`.
- The styled touch rule may inflate a small fix in a large styled file, for example `settle-up-modal/styled.ts`, beyond 400 lines. For this there is `styled-touch-exempt.json` with an Issue, not silent ignoring.
- `csstools/value-no-unknown-custom-properties` does not see variables declared inside a module. Local variables are named `--_name`, and the regex allows them.

## Future extension

- Brand change: `RADIX_THEME.accentColor` and the accent group aliases in tokens.json, then `tokens:build`.
- Webfont: files in `packages/tokens/fonts/`, the generator produces `@font-face`, `font-src 'self'` (Google Fonts are removed from the CSP per D16).
- Export to Figma and Pencil: see below. Style Dictionary may replace the generator without changing the input format (DS v1).

### Pencil/Figma

Mockups in Pencil or Figma are one-off: they are needed for discussion and are not the source of truth. There is one source — `packages/tokens/tokens.json`. When a designer appears, the tokens are exported to Figma Variables through a DTCG-compatible plugin or native import (the onboarding plan in DS v1, `process.md`). The reverse flow (Figma → code) is possible only as a PR into tokens.json, which goes through the same checks. No design tool becomes the master without a separate owner decision.

## What we do NOT do

- Tailwind and shadcn (D14). Abandoning Radix Themes.
- A big-bang conversion of 55 styled files. We convert only on touch.
- Wrappers over all Radix primitives.
- Automatic visual regression, Storybook, cloud services.
- Lazy locales (04-2c), SW registration/precache (04-2d; except the `webp` line in 05-1), icon regeneration (02-B1), removal of `PublicApp` (04-5a/b), restructuring of the ESLint config (02-C4), vendor-regex (02-B1), ds-gallery aliases (02-C3).
- A fork of `base.css` for the accent mapping.

## Changes relative to DS v1

1. Location of tokens: `design-system/tokens.json` and `src/design-system/generated/*` move to `packages/tokens/{tokens.json,generated/*}` (D7). The format (DTCG 2025.10), the dependency-free generator, and "code is the source of truth" do not change.
2. `themeColor()` with semantic keys is **not introduced but removed**. Styled code writes `var(--cp-*)` directly. The generated `DefaultTheme.colors` and `styled.d.ts` are not needed. The ESLint `no-palette-theme-keys` (rule 2) is cancelled, replaced by stylelint and `no-raw-colors`.
3. The generator additionally emits `RADIX_THEME`, `PROP_COLOR`, `RADIX_PALETTES`, `CpToken`, and `manifest-colors.json` (D23, instead of `PWA_THEME_COLOR`). `src/design-system/theme.ts` is replaced by `AppTheme.tsx`.
4. The semantics reference concrete scales (`--olive-11`), not `--gray-*`/`--accent-*`, otherwise the tokens do not work on the Astro site and outside `.radix-themes`.
5. Added the primitives `z.*`, `motion.*`, `brand.loader` and the component tokens from the codemod table. In DS v1 motion was out of scope, here in a minimal volume: only existing values.
6. The long-term direction of styles is CSS Modules. DS v1 left styled-components among the allowed ones, now it is frozen by an allowlist (the answer to audit question 3).
7. "Do not wrap primitives" is refined by a criterion: 2 wrappers are deleted, 4 become ChipIn components in `basics`.
8. A fine refinement of the DS v1 "basics without store": added bans on importing `components/*` and on side effects.

## Phases/PRs

| PR | Content | Files (≈) | Depends on | In parallel with |
|---|---|---|---|---|
| 05-1 | Radix CSS import in parts (temporarily in the new `src/styles/index.css`, 22 scales), WebP ×2 + `webp` in `globPatterns`, `basics/Image` in onboarding, removal of `apple-icon.svg` | 8 | — | everything, including 02/03/04 |
| 05-2a | `packages/tokens`: tokens.json, generator, `generated/*` (including `manifest-colors.json`), `radix-colors.css` (moved from 05-1), `tokens:check` + generator unit tests (C2-12) | 9 | 04-0 (npm workspaces) | 02, 03, 04-1a |
| 05-2b | Wiring into the app: `styles/index.css` on `@chipin/tokens`, moving logo/favicon to `packages/tokens/assets`, `manifest-colors.json` → the VitePWA manifest and `<meta name="theme-color">` (D23) | 6 | 05-2a | 02, 03 |
| 05-3 | `appearanceStore`, `AppTheme`, `theme-init` + Vite plugin + CSP hash + test, removal of next-themes (4 files + 3 tests), `RADIX_THEME` in `main`/`PublicApp`/gallery | 16 | 05-2b; the hash goes into `apps/app/hosting.base.json` if 04-2b is merged, otherwise into `apps/app/vercel.json` (the test checks the resulting `vercel.json`) | 03 |
| 05-4 | The codemod `themeColor` → `--cp-*` (21 files + `interactiveCardStyles`; the files `src/store/expenseModal*` and their styled are skipped until 03-14 is merged — the ownership chain in `00-overview.md`), `--space/--radius` → `--cp-*` in styled files, removal of `styled-themes.ts`, `colors.ts`, `styled.d.ts`, three `ThemeProvider`s; ban on `@radix-ui/colors` | 30 (small diffs, ≈350 lines) | 05-2b | 05-3 (different files, except `main.tsx`: 05-4 merges second) |
| 05-5 | stylelint + config, `lint:css`, `no-raw-colors` (`no-restricted-syntax`, §3) + fixtures, styled allowlist + `check-styled-allowlist.mjs --base`, the `style` rule, the svgr rule (blocks through the 02-C4 helpers), `css.modules` in Vite, `helpers/cx.ts`, the reference conversion of `mode-logotype/styled.ts` to a CSS Module, 6 inline styles | 14 | 05-4, 02-C4 | 02 (except 02-C4) |
| 05-6 | The basics boundary: move RelativeTime, BalanceBadgesSkeleton (PWABadge — no, see 04-2d); NavButton, BalanceSummaryText (C1-24); removal of Checkbox/RadioGroup; moving SegmentedControl/Select/Dropdown/ProgressBar to basics with named exports; a11y check of 3 buttons; removes the boundaries entries from suppressions | 28 (imports) | — (the boundaries rule is enabled by 02-C9); not simultaneously with 02-D2a/b on the same `basics`/`components` files — before or after them (C2-31) | 05-2…05-5 |
| 05-7 | ds-gallery: `AppTheme` + store, the Tokens section (the aliases are removed by 02-C3) | 4 | 05-3, 05-4 | 05-5, 05-6 |

- Every PR is released independently; the `Version impact` field is removed (the owner chooses the bump in the release PR, spec 02 D7). 05-4 visibly changes a shade (gray → olive) — note it in the release notes.
- DS v1 tasks 3–8 (documentation, patterns, cards, routing, screen audit) come after 05-4 in the DS v1 order. Their PRs do not overlap with the files of 05-5…05-7.

## Tests/acceptance criteria

Gate PR (commands) — items 2–8; item 1 — owner QA, not a PR gate (C2-18, C2-34): the FE repo has no seed account or data fixture mode, sign-in is only Google OAuth, so the agent does not run it.

1. **Owner QA: screenshot parity on 5 key screens in light and dark (10 pairs):**
   - Dashboard;
   - group page (expenses tab);
   - the add-expense modal with an open split;
   - the settle-up modal;
   - the Activity feed.
   - Procedure: the owner, `npm run dev` under their own dev account (`dev.chipin.one` backend), viewport 390×844 and 1280×800, the same data before and after. Screenshots before (master) and after (the PR branch). Comparison: `compare -metric AE -fuzz 1%` (ImageMagick). The pairs are attached to the PR.
   - For 05-1, 05-2a, 05-2b, 05-3, 05-5, 05-6, 05-7: 0 differing pixels beyond fuzz.
   - For 05-4: differences are acceptable only in the areas drawn by the 21 converted files, and only as a shift of the gray shade. The owner confirms the pairs in the PR.
2. After 05-3 a reload in dark (saved and system) does not show a light frame. Check: a performance recording or a screenshot under Slow 4G throttling. In addition, `document.documentElement.className` contains `dark` before `root.tsx` executes.
3. `grep -rn "next-themes\|styled-themes\|themeColor\|@radix-ui/colors" apps` after 05-4 gives 0 lines (ds-gallery lives in `apps/app/ds-gallery`, C2-31).
4. `vendor-radix.css` after 05-1 is smaller than the current 683 KB by at least 40 KB raw. The `sw.js` precache includes `dashboard-onboarding.webp`.
5. `dashboard-onboarding.webp` ≤ 40 KB.
6. Lint fixtures:
   - a new file with `import styled from 'styled-components'` — an error;
   - a CSS Module with `#fff`, `var(--gray-11)`, `var(--cp-text-secndary)` — 3 errors; `16px` in `padding` — 0 (the px rule is not introduced, C1-14);
   - TS: the `no-raw-colors` fixtures from §3 (4 errors, 0 on `'#add-expense'`);
   - editing a `styled.ts` from the allowlist without converting it — a `check-styled-allowlist` error.
7. Unit tests: the generator (a tokens.json fixture: aliases, modes, errors), `appearanceStore` (system/matchMedia, key migration, html class), `theme-init` (hash in CSP, key).
8. The existing tests and `build:ds-gallery` are green.

## Backend requirements

None.

## Open questions

1. Decided (D23, accepted by the owner 2026-10-28, implemented by the generator): the olive mapping gray → olive in 21 styled files (ΔE about 1–2), the 05-4 screenshots are a control, not a question.
2. Decided (D23, accepted by the owner 2026-10-28, implemented by the generator): `theme_color` = grass-9 `#46a758` from `manifest-colors.json` instead of `#3e9b4f`.
3. Withdrawn: the package name `@chipin/tokens` and the paths `apps/app`, `apps/site` are set by spec 04 §1.1; the UI store path `src/store/ui-prefs/` — by spec 03 §6.
4. Withdrawn (a rule, not an assumption): the theme-init hash goes into `apps/app/hosting.base.json` if 04-2b is already merged, otherwise manually into `apps/app/vercel.json`; the test always checks the resulting `vercel.json`.
