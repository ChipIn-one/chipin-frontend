# AGENTS.md

## Project Snapshot

- Stack: `React 19` + `TypeScript` + `Vite` (`@vitejs/plugin-react-swc`).
- Routing: `react-router-dom` with route guards in `src/features`.
- State: `zustand` stores in `src/store`.
- API: centralized `axios` client in `src/api/chipin.ts`.
- Persistence: `Dexie` (`src/store/IDB`) for auth token and offline-first local data.
- UI: `@radix-ui/themes` as primary UI system.
- i18n: `i18next` (`en`, `ru`) in `src/i18n`.
- PWA: `vite-plugin-pwa`.

---

## Rule Priority

When rules conflict, follow this order:

1. Task / user instructions
2. **[HARD]** rules in this file
3. Architecture & data flow rules
4. UI system rules (Radix)
5. Naming & style conventions
6. General best practices

If still unclear: choose the least invasive solution.

---

## Core Principles

- Keep changes minimal and localized.
- Do not refactor unrelated code.
- Do not invent APIs, types, or data.
- Follow existing patterns in the file/module.
- Prefer simple solutions over abstractions.

---

## Directory Roles

- `src/root.tsx`: app bootstrap (Sentry, ThemeProvider, analytics, global CSS).
- `src/main.tsx`: app shell composition (router, layout, toaster, global hooks).
- `src/basics/*`: **atomic primitives** — single-responsibility, no store access, no API calls; reusable across any domain.
- `src/components/*`: **composite UI blocks** — may read from stores or combine multiple `basics`; domain-adjacent but not tied to one feature.
- `src/features/*`: **self-contained domain modules** — routing guards, domain-specific sub-components, and feature-scoped hooks; not reusable outside their domain.
- `src/pages/*`: **route-level screens** — assemble components and features; contain minimal logic; delegate to stores and hooks.
- `src/hooks/*`: cross-page side effects and app lifecycle hooks.
- `src/store/*`: global client state + async actions.
- `src/api/*`: HTTP transport and backend contracts.
- `src/helpers/*`: pure utilities (env/url/errors/time/...).
- `src/constants/*`: app constants, route map, messages, env config.
- `src/types/*`: global TypeScript ambient declarations and module augmentations (`global.d.ts`, `styled.d.ts`, etc.).

---

## Architecture

### Layers

Allowed import direction:

```
pages → features → components → basics
```

Never import in reverse direction.

- `basics/` — pure, no store, no API.
- `components/` — reusable UI blocks, may read stores.
- `features/` — domain-specific logic, routing guards, scoped sub-components.
- `pages/` — route-level composition; leaf nodes in the import tree.
- `store/` — global state + async logic.
- `api/` — HTTP layer only.

---

### Store Rules

**[HARD]**

- All API calls must be inside zustand stores.
- Hooks, components, features, and pages must NOT call the API directly.
- Only global stores are allowed — no feature-level stores.
- Store is the single source of truth for business logic.

**[SOFT]**

- Separate state and actions clearly.
- Async actions must be prefixed with `fetch*` and must handle loading/error state.
- Do not mix UI state and server state in the same store slice.

---

## Hooks

**[HARD]**

- Hooks must NOT call the API directly.
- Hooks must NOT contain business logic.

**[SOFT]**

Hooks may:

- call store actions.
- combine store selectors.
- manage UI state and effects.

Before writing a custom hook, check if `@uidotdev/usehooks` already provides it — prefer the library over reinventing the wheel. Custom hooks in `src/hooks/*` should only exist for app-specific logic that has no equivalent there.

---

## Data Flow

**[HARD]**

```
UI → store → API
```

`UI → API` is forbidden.

---

## No Assumptions

**[HARD]**

- Do not invent API fields, types, or endpoints.
- Use only existing contracts.
- If data shape is unclear: keep it minimal and safe.

---

## i18n

**[HARD]**

- No user-facing strings in JSX or TypeScript.
- All user-visible text must go through i18n (`react-i18next`) or centralized message constants.

Allowed exceptions (not user-facing):

- internal variable names.
- non-user-facing logs.

**[SOFT]**

- Prefer explicit namespaces: `common:save`.
- Use semantic key naming: `feature.section.element` — e.g. `groups.create.title`.
- Feature-specific text → feature namespace; text that is not domain-specific → `common.json`.
- If the same string (or meaning) exists in more than one namespace, move it to `common.json` and remove the duplicates — never declare identical strings in two namespace files.
- Add locale keys in both `src/i18n/locales/en/*` and `src/i18n/locales/ru/*` within the same task.

---

## UI System

**[HARD]**

- Prefer Radix components for all UI composition.
- Do not use inline styles (`style={}` is forbidden — no exceptions). If no Radix prop covers the required CSS property, create a narrowly scoped `styled-component` instead.

Fallback order when Radix cannot express the required UI:

1. Use `styled-components` with narrow scope.
2. Never fall back to inline styles.

**[SOFT]**

- If a layout, spacing, color, size, alignment, or variant can be expressed via native Radix props, always use the Radix API first.
- For page/content width constraints, prefer `Container` with appropriate `size` prop over hardcoded `maxWidth` on layout primitives.
- Do not introduce routine CSS classes for standard component layout.
- Use `asChild` when a Radix component needs to render as a different HTML element while keeping Radix styles (e.g. `<Flex asChild><label>`).
- For hyperlinks, always use the Radix `Link` component instead of a bare `<a>` tag or `styled.a`.
- For interactive components that lack a `width` prop (e.g. `Button`, `IconButton`), wrap them in `<Box width="...">` rather than creating `styled(Button)` solely for width.
- When building typed wrapper components around Radix components, use `ComponentProps<typeof RadixComponent>['propName']` to extract prop types.
- `flexShrink`, `flexGrow`, `flexBasis`, `overflow`, `overflowX`, `overflowY`, `position`, `top`, `right`, `bottom`, `left`, `inset` are Radix props on all layout components — use them in JSX instead of CSS.
- Grid child placement props (`gridArea`, `gridColumn`, `gridColumnStart`, `gridColumnEnd`, `gridRow`, `gridRowStart`, `gridRowEnd`) are Radix props available on all layout components inside a `Grid`.
- Width/height string values like `"100%"`, `"max-content"`, `"var(--space-8)"` are accepted directly by `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` props on layout components.

---

## Layering and z-index Rules

- Treat Radix portal stacking as the default layering system for dialogs, popovers, dropdowns, tooltips, and other floating UI.
- Do **not** introduce custom `z-index` scales or arbitrary high values. Avoid `z-index` values other than `auto`, `0`, or in rare cases `-1`.
- If elements must stack above each other, render them through portals instead of forcing order with `z-index`.
- A non-default `z-index` is allowed only as a documented exception when portal composition cannot solve the issue; keep it narrowly scoped and explain the reason in code.

---

## Styling Rules

**[HARD]**

- No inline styles.
- No unnecessary styled wrappers.
- Do not override Radix styles without necessity.
- Do not use `&&` specificity hacks inside `styled-components` templates to override Radix styles — refactor to avoid the conflict entirely.
- Do not use raw hex colors (`#...`) inside `styled-components` templates.
- Do not access Radix color tokens via CSS variables (`var(--indigo-2)`) inside `styled-components` templates.
- Do not use `styled(Compound.Part)` (e.g. `styled(TextField.Root)`, `styled(Select.Trigger)`) — it breaks TypeScript types. Wrap the compound in a `styled.div` or `<Box>` instead.

**[SOFT]**

- Use `themeColor('token')` from `src/helpers/colors.ts` for all colors in `styled-components` templates.
- In `styled-components`, reference palette token names directly (`green8`, `gray11`, etc.); light/dark switching is handled by `lightThemeStyled`/`darkThemeStyled` automatically.
- Always choose the token step that matches its semantic role per the Radix Color Scale Semantics table below.
- If a needed color token does not exist yet, extend the theme mapping/helper instead of hardcoding a hex fallback.
- For spacing props (`padding`, `margin`, and directional variants): prefer native Radix props (`p`, `px`, `py`, etc.) in JSX. `var(--space-*)` is only acceptable in CSS for properties that have no Radix prop equivalent (e.g. `inset-inline`, `transform`, `clip-path`).
- Do not create routine wrappers: `styled(Flex)`, `styled(Box)`, `styled(Grid)`, `styled(Text)` — use primitives directly in JSX.
- Do not hardcode `rem` values in `styled-components` for routine layout sizing; prefer Radix size/spacing tokens.
- `styled(ScrollArea)` is acceptable (it is not a compound part); do not use `styled(ScrollArea.Viewport)`.

Pattern summary:

```ts
// ✅ colors — use the selector helper
color: ${themeColor('gray11')};
background-color: ${themeColor('indigo2')};

// ✅ padding/margin — use Radix props on the component in JSX
// <Box p="4">...</Box> instead of padding: var(--space-4) in CSS

// ✅ CSS properties with no Radix prop equivalent — var() is acceptable
inset-inline: var(--space-4);
transform: translateY(var(--space-1));

// ❌ don't use var() in CSS for props that have Radix JSX equivalents
top: var(--space-3);    // → use <Box top="3"> instead
inset: var(--space-4);  // → use <Box inset="4"> instead

// ❌ never use hex or var() for colors in styled templates
color: #0d1511;
color: var(--indigo-2);

// ❌ don't create routine styled wrappers around Radix primitives
const HeaderRow = styled(Flex)`...`;

// ❌ never use inline styles
style={{ height: '240px' }}

// ❌ never use && to override Radix styles
&& { background: red; }

// ❌ never wrap compound parts in styled()
const Field = styled(TextField.Root)`width: 100%;`;
```

---

## Error Handling

**[HARD]**

- All API errors must be handled.
- Use `resolveApiErrorMessage` to normalize errors.
- Show errors via toaster (sonner).
- Do not silently ignore errors.

---

## Numbers & Financial Logic

**[HARD]**

- All financial calculations must use `bignumber.js` (`Big`). Native JS arithmetic (`+`, `-`, `*`, `/`) is forbidden on financial values — use `.plus()`, `.minus()`, `.multipliedBy()`, `.dividedBy()`.
- Use `tryToBig()` from `helpers/numbers` for any value coming from the API or external input — never use `Number()`, `parseFloat()`, or unary `+` on financial strings.
- Compare `Big` values with `.eq()`, `.lt()`, `.gt()`, `.lte()`, `.gte()` — never use `===`, `>`, `<`, `>=`, `<=` directly on `Big` objects.
- Serialize financial values with `.toFixed(precision)` before sending to the API — never send `.toNumber()`.
- Round with `.decimalPlaces(n, Big.ROUND_HALF_UP)` — never use `Math.round()`, `Math.floor()`, `Math.ceil()`, or native `.toFixed()` on financial values.
- Always send numbers to API as strings.

**[SOFT]**

- Exception: threshold/guard comparisons that do not affect stored or transmitted amounts are acceptable with native numbers.
- `.toNumber()` is allowed only as the final step for non-financial consumption: DOM props, percentage-bar widths, chart libraries, or legacy component props that require `number`. Never feed a `.toNumber()` result back into arithmetic or to the API.
- `Amount` (via `constructNumberComponent`) already calls `tryToBig()` internally — pass the raw API string or a `Big` instance directly; wrapping in `Number()` beforehand is redundant and unsafe.
- Use `Amount` from `src/basics/numbers` as the default renderer for money values in UI — do not render amounts as raw strings or via ad-hoc `toFixed`.
- Import from `basics/numbers` (public entry), not from deep internal paths, unless extending the number system itself.
- Keep formatting logic inside `basics/numbers` and `helpers/numbers`; UI layers should only pass value/format props.

---

## Code Quality

### Type Safety

**[HARD]**

- `any` is strictly forbidden.
- Do not use `as any`.
- Do not bypass the type system.

If type is unknown:

- use `unknown`.
- narrow safely.

---

### Minimal Changes

**[HARD]**

- Only modify what is required.
- Do not rewrite or reformat unrelated code.

---

### Opportunistic Improvements

**[SOFT]**

Allowed when touching a file:

- improve naming.
- improve types.
- remove obvious dead code.

Keep changes minimal — do not refactor entire modules.

---

### Naming

**[HARD]**

- Booleans → `is*` / `has*` prefix.
    - Use `is` as default: `isLoading`, `isOpen`, `isVisible`, `isButtonShown`.
    - Use `has` only when `is` reads unnaturally: `hasError`, `hasPermission`, `hasChildren`.
    - Never name booleans without a prefix (`loading`, `open`, `visible` are not allowed).
    - Applies to local variables, state hooks, store fields, component props, and function return values.
- Event handlers → `handle*` prefix: `handleSubmit`, `handleAvatarClick`, `handleMenuClose`.
- Callback props → `on*` prefix: `onSubmit`, `onChange`, `onClose`.
- Async store actions → `fetch*` prefix: `fetchGroups()`, `fetchDashboard()`, `fetchUserById(id)`.
- Arrays → plural names: `users`, `groupIds`, `expenseItems`.
- Iteration variables → full singular word, never single letters: `users.map((user) => ...)`.
- Index in iterations → full word `index`, never `i` or `idx`.

**[SOFT]**

- Computed values → descriptive names; avoid `data`, `value`, `result`.
- Zustand stores → suffix `Store`: `useAuthStore`, `useDashboardStore`.
- Custom hooks → prefix `use`: `useGroups`, `useModalState`.
- Ref variables → suffix `Ref`: `buttonRef`, `containerRef`.
- Module-level constants → `SCREAMING_SNAKE_CASE`: `MAX_RETRY_COUNT`, `DEFAULT_CURRENCY`.
- Types and interfaces → PascalCase, no `I`-prefix: `type GroupMember = {}`, `interface AuthState {}`.
- Component props type/interface → named `Props` in the component file: `interface Props { ... }`.
- React components → PascalCase: `GroupCard`, `ExpenseItem`.
- Utility functions → camelCase verb-first: `formatDate()`, `parseUrl()`, `resolveError()`.
- React component files → `PascalCase.tsx`.
- Custom hook files → `camelCase.ts`.
- Utility/helper/constant files → `camelCase.ts`.
- Directories → `kebab-case`.

---

### Code Style

**[HARD]**

- Never write single-line `return` statements without braces:

    ```ts
    // ✅ block body
    if (!value) {
        return;
    }

    // ✅ block body with value
    if (isLoading) {
        return <Spinner />;
    }

    // ❌ single-line return — never do this
    if (!value) return;
    if (isLoading) return <Spinner />;
    ```

- When a boolean expression has **3 or more operands** (`&&` / `||`), extract it into a named `const` before the JSX return. The name must describe the _intent_:

    ```tsx
    // ✅ three conditions → named const
    const isEndOfFeed = !isNextPageLoading && !hasMore && items.length > 0;
    {
        isEndOfFeed && <Text>{t('endOfFeed')}</Text>;
    }

    // ❌ inline expression with 3+ parts
    {
        !isNextPageLoading && !hasMore && items.length > 0 && <Text>{t('endOfFeed')}</Text>;
    }
    ```

- Do not define components inside render functions.

---

### Exports

- Use `export default` for most React components (pages, features, reusable components).
- Exception: components that live inside a barrel-exported group directory (e.g. `modals/`, `navs/`) should use named `const` exports to support clean re-export from the barrel `index.ts`.

---

### Linting

- Run `npm run lint` before finalizing changes.
- Follow import sorting and unused-import rules from `eslint.config.js`.
- Keep strict TS compatibility (`strict: true`).

---

## React Rules

**[HARD]**

- No single-line returns (see Code Style above).
- Do not define components inside render functions.

**[SOFT]**

- Avoid unnecessary re-renders.
- Avoid unnecessary memoization. Memoization is opt-in, not default — profile first with React DevTools Profiler.
- `React.memo` — wrap a component only when it re-renders frequently with identical props or is expensive to render.
- `useMemo` — use only for computationally expensive derivations or stabilizing references passed to memoized children or hook deps.
- `useCallback` — use only when the function is passed to a `React.memo` child or appears in a `useEffect`/`useMemo` dependency array.
- Never use `JSON.stringify(value)` in dependency arrays.
- Keep memoization surgical and documented with a comment explaining why.

---

## Side Effects

**[SOFT]**

- Side effects should live in hooks.
- Avoid side effects in components.
- Do not trigger API calls from `useEffect` — call store actions instead.

---

## Component Placement

**[HARD]**

- Reusable across domains → `components/`.
- Domain-specific → `features/`.
- Routing / orchestration → `features/`.
- If unsure → use `features/`.

| Layer             | Lives in      | Criteria                                                                                                             |
| ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Primitive**     | `basics/`     | Single-responsibility; no store access; no API calls; reusable across any domain.                                    |
| **Composite**     | `components/` | Combines primitives or reads from a store; domain-adjacent but not tied to one feature.                              |
| **Domain module** | `features/`   | Self-contained domain slice — routing guards, feature-scoped hooks, sub-components; not reusable outside its domain. |
| **Screen**        | `pages/`      | Route-level container; assembles features and components; minimal logic.                                             |

Promotion rules:

- Promote from `basics/` to `components/` when the component imports from a store, combines 3+ primitives, or carries domain-specific display logic.
- Promote from `components/` to `features/` when the component introduces routing, access guards, or encapsulates a complete product domain.
- Never import from `pages/*` in any other layer.

---

## Component Grouping

**[SOFT]**

- When two or more components share closely related purpose in the same layer, group them in a `kebab-case` subdirectory (e.g. `components/modals/`, `components/navs/`).
- Every such directory must have an `index.ts` barrel file that re-exports all public components using named exports. The barrel must only contain `import` / `export` statements — no logic, no JSX.
- Consumers must import from the directory barrel (`components/modals`), not from deep internal paths.
- A single standalone component does not need its own folder; only group when there are two or more related components.
- Do not mix components from different layers in the same subdirectory.

**Co-located private sub-components:**

- Sub-components that belong exclusively to one parent and are not reused elsewhere must live in a `components/` subdirectory next to their parent.
- Do **not** create a barrel `index.ts` for a co-located `components/` folder — import the files directly within the same feature/component scope.
- Example: `features/activity/components/EventJoinGroup.tsx` — private to `activity/`, never exported outside it.
- If a sub-component is later needed by a second feature or page, move it to the appropriate shared layer.

---

## Imports

**[SOFT]**

- Use TS path aliases from `tsconfig.app.json` (`api/*`, `store/*`, `components/*`, etc.).
- Avoid deep internal imports — import from barrels where available.
- Route paths come from `ROUTES` (`src/constants/routes.ts`), not hardcoded strings.

---

## Working With Legacy Code

**[SOFT]**

- Do not refactor entire modules.
- Fix only local issues.
- Preserve existing behavior.

---

## Exceptions

**[HARD]**

If a rule cannot be followed:

- Keep the exception minimal.
- Document with a comment explaining why.
- Do not propagate the workaround.

---

## Radix UI Reference

### Radix Color Scale Semantics

Radix Colors uses a 12-step scale per hue. Always pick the step that matches the use case.

| Step | Use case                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 1    | App background                                                                                             |
| 2    | Subtle background (cards, code blocks, sidebars, canvas)                                                   |
| 3    | UI element background — normal state                                                                       |
| 4    | UI element background — hover state                                                                        |
| 5    | UI element background — active/selected state                                                              |
| 6    | Subtle border on **non-interactive** components (headers, cards, separators, sidebars, alerts)             |
| 7    | Border on **interactive** components (inputs, buttons) — normal state                                      |
| 8    | Border on **interactive** components — hover state; focus rings                                            |
| 9    | Solid background — normal state (highest chroma; also used for overlays, accent borders, coloured shadows) |
| 10   | Solid background — hover state                                                                             |
| 11   | Low-contrast text                                                                                          |
| 12   | High-contrast text                                                                                         |

Rules:

- Never use a **background step (1–5)** for a border. Borders must use steps 6–8.
- Never use a **border step (6–8)** for a background or text.
- Never use a **text step (11–12)** for a background or border.
- Static non-interactive containers → border step **6**.
- Interactive components → border step **7** (normal) / **8** (hover/focus).
- Solid-fill backgrounds, overlays, badges → steps **9–10**.
- `Sky`, `Mint`, `Lime`, `Yellow`, `Amber` need **dark** foreground text on steps 9–10.

Semantic pairings:

- Error: `red`, `ruby`, `tomato`, `crimson`.
- Success: `green`, `teal`, `jade`, `grass`, `mint`.
- Warning: `yellow`, `amber`, `orange`.
- Info: `blue`, `indigo`, `sky`, `cyan`.

---

### Radix Token Reference

#### Space Scale

Spacing props (`p`, `px`, `m`, `gap`, etc.) accept numeric steps `"1"`–`"9"`. The `scaling` prop on `<Theme>` multiplies all values uniformly.

| Step | Value | CSS variable     |
| ---- | ----- | ---------------- |
| 1    | 4px   | `var(--space-1)` |
| 2    | 8px   | `var(--space-2)` |
| 3    | 12px  | `var(--space-3)` |
| 4    | 16px  | `var(--space-4)` |
| 5    | 24px  | `var(--space-5)` |
| 6    | 32px  | `var(--space-6)` |
| 7    | 40px  | `var(--space-7)` |
| 8    | 48px  | `var(--space-8)` |
| 9    | 64px  | `var(--space-9)` |

Use `var(--space-N)` in `styled-components` only for CSS properties that have no Radix JSX prop equivalent.

#### Typography Scale

`Text` and `Heading` `size` prop values. Font size, letter spacing, and line height are always set together — never override them individually with custom CSS.

| Size | Font size | Line height |
| ---- | --------- | ----------- |
| 1    | 12px      | 16px        |
| 2    | 14px      | 20px        |
| 3    | 16px      | 24px        |
| 4    | 18px      | 26px        |
| 5    | 20px      | 28px        |
| 6    | 24px      | 30px        |
| 7    | 28px      | 36px        |
| 8    | 35px      | 40px        |
| 9    | 60px      | 60px        |

Font weight values: `light` = 300 · `regular` = 400 · `medium` = 500 · `bold` = 700.

#### Breakpoints

All responsive props accept an object keyed by breakpoint name. Values are `min-width` based.

| Key       | Min-width | Typical target      |
| --------- | --------- | ------------------- |
| `initial` | 0px       | Phones (portrait)   |
| `xs`      | 520px     | Phones (landscape)  |
| `sm`      | 768px     | Tablets (portrait)  |
| `md`      | 1024px    | Tablets (landscape) |
| `lg`      | 1280px    | Laptops             |
| `xl`      | 1640px    | Desktops            |

Always start from `initial` (mobile-first). Example: `size={{ initial: '3', md: '5', xl: '7' }}`.

---

### Radix Compound Component API Rules

Radix Themes uses compound component patterns. Always use the correct composition; incorrect nesting causes broken accessibility and visual bugs.

#### Layout Primitives (Box · Flex · Grid · Container · Section)

All five layout components share a common set of props. Every prop accepts a responsive object (`p={{ initial: '3', sm: '5' }}`).

| Group       | Props                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Padding     | `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`                                                               |
| Width       | `width`, `minWidth`, `maxWidth`                                                                       |
| Height      | `height`, `minHeight`, `maxHeight`                                                                    |
| Positioning | `position`, `inset`, `top`, `right`, `bottom`, `left`                                                 |
| Overflow    | `overflow`, `overflowX`, `overflowY`                                                                  |
| Flex child  | `flexBasis`, `flexShrink`, `flexGrow`                                                                 |
| Grid child  | `gridArea`, `gridColumn`, `gridColumnStart`, `gridColumnEnd`, `gridRow`, `gridRowStart`, `gridRowEnd` |

Margin props (`m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml`) are available on most Radix components, not just layout ones.

**Box** — fundamental layout building block; based on `div`.

- `as` prop: `"div"` (default) | `"span"`.
- `display` unique values: `"none" | "inline" | "inline-block" | "block" | "flex" | "inline-flex" | "grid" | "inline-grid"`.
- Use `display={{ initial: 'none', sm: 'block' }}` to show/hide content at breakpoints.

**Flex** — extends Box with flex-specific props.

- Additional props: `direction`, `align`, `justify`, `wrap`, `gap`, `gapX`, `gapY`.
- Use `gapX`/`gapY` when column and row gaps differ.

**Grid** — extends Box with grid-specific props.

- Additional props: `columns`, `rows`, `areas`, `flow`, `align`, `justify`, `gap`, `gapX`, `gapY`.
- `columns` and `rows` accept enum steps or any valid CSS grid template string (e.g. `"repeat(2, 64px)"`).

**Container** — constrains content to a consistent `max-width`; based on `div`.

- `size` prop: `"1"` → 448px · `"2"` → 688px · `"3"` → 880px · `"4"` → 1136px (default).
- `align` prop (`"left"` | `"center"` | `"right"`) sets horizontal alignment within the viewport.
- Always prefer `Container size="N"` over hardcoded `maxWidth` on `Flex` or `Box`.

**Section** — semantic `<section>` element providing consistent vertical padding.

- `size` prop: `"1"` – `"4"` (default `"3"`); each step maps to a preset `py` value.
- Do not set manual `py` on a `Section` unless you need to override the size-based default.

#### Text

- Renders as `<span>` by default. Use the `as` prop (`"p"`, `"label"`, `"div"`, `"span"`) for semantics — does **not** alter visual appearance.
- `size` (`"1"`–`"9"`) controls font size, line height, and letter spacing together — never override them individually.
- Use `weight` (`"light"` | `"regular"` | `"medium"` | `"bold"`) instead of custom CSS `font-weight`.
- Use `align` (`"left"` | `"center"` | `"right"`) instead of CSS `text-align`.
- Use `trim` (`"start"` | `"end"` | `"both"`) to remove leading whitespace — do not use negative-margin CSS for this.
- Use `truncate` to clip overflowing text with an ellipsis — do not apply custom CSS `text-overflow: ellipsis`.
- Use `wrap` (`"wrap"` | `"nowrap"` | `"pretty"` | `"balance"`) instead of CSS `text-wrap`.
- Use `color` + `highContrast` for semantic text color.
- To label a form control, use `<Text as="label">` wrapping the control.

#### Heading

- Use `Heading` for page titles and section headings; shares `size` and `weight` with `Text`.
- Use `as` prop (`"h1"` – `"h6"`) to match document outline; default is `"h2"`.
- Do **not** nest `<Heading>` inside `Dialog.Title` — pass text children directly.
- Never use raw `<h1>`–`<h6>` HTML tags where `Heading` would suffice.

#### Dialog

- Structure: `Dialog.Root > Dialog.Trigger > Dialog.Content > [Dialog.Title, Dialog.Description?, Dialog.Close]`.
- `Dialog.Title` is based on `Heading` — do not nest `<Heading>` inside it.
- `Dialog.Description` is based on `Text` — pass content as children directly.
- `modal` prop is **unavailable** — Dialog is always modal.
- `Dialog.Close` must live inside `Dialog.Content`.
- Control dialog width via `maxWidth` on `Dialog.Content`.

#### Select

- `size` prop → `Select.Root`.
- `variant`, `color`, `radius` → `Select.Trigger`.
- `Select.Content` accepts `variant` (`"solid"` | `"soft"`), `color`, `highContrast`.
- For grouping items: `Select.Group` + `Select.Label`.
- Reuse the shared wrapper `src/components/Select.tsx` for standard dropdown selects instead of composing Radix `Select.Root/Trigger/Content/Item` inline in feature code.

#### SegmentedControl

- Use for switching between a small set of mutually exclusive views or filters.
- **Always** use the shared wrapper `src/components/SegmentedControl.tsx` — do not compose `SegmentedControl.Root/Item` inline in feature/page code.
- `SegmentedControl.Root` props: `size` (`"1"` | `"2"` | `"3"`), `variant` (`"surface"` | `"classic"`), `radius`, `disabled`.
- Controlled: `value` + `onValueChange`; uncontrolled: `defaultValue`.

#### RadioGroup

- Use for choosing a single visible option from a short list, instead of a dropdown select.
- For "paid by" / payer chooser: use `color="jade"`.
- Wrap the row in a semantic `<label>` with the radio control inside.

#### TextField

- Structure: `TextField.Root > TextField.Slot? > (input is implicit)`.
- `TextField.Slot` requires `side="left"` or `side="right"` — there is no default position.
- Do **not** use `size="1"` with interactive elements inside a Slot (no room).
- `TextField.Root` is a `div` and accepts margin props (`mt`, `mb`, etc.) directly.

#### Popover

- Structure: `Popover.Root > Popover.Trigger > Popover.Content > Popover.Close?`.
- `Popover.Content` inherits Radix primitive props: `sideOffset`, `align`, `side`.
- To match trigger width: `width="var(--radix-popover-trigger-width)"` on `Popover.Content`.

#### ScrollArea

- Use `ScrollArea` for any container where content may overflow vertically.
- Always set a concrete `height`, **not** `max-height`. Radix uses the height to size its internal viewport; `max-height` does not propagate correctly.
- Use `scrollbars="vertical"` for lists; `"horizontal"` for wide content; `"both"` only when both axes are needed.
- Add `pr` on the direct content child to leave space for the scrollbar.
- **Width constraint caveat**: Radix `ScrollArea`'s internal viewport wraps children in a `display: table; min-width: 100%` div, which causes `width: 100%` on child elements to resolve to min-content. Fix by targeting the inner div via CSS attribute selector in `styled(ScrollArea)`:

    ```ts
    const ListScrollArea = styled(ScrollArea)`
        height: 240px;

        & [data-radix-scroll-area-viewport] > div {
            min-width: 0;
            width: 100%;
        }
    `;
    ```

    This is a known Radix limitation, not a specificity hack — the selector is the only way to constrain the internal table div.

#### Callout

- Structure: `Callout.Root > Callout.Icon > Callout.Text`.
- Always include `Callout.Icon` — it is required for correct layout and accessibility.

#### Skeleton

- `loading` prop controls display; default is `true`.
- `Skeleton` renders as `<span>` — do not wrap multiple block-level siblings in one `Skeleton`.
- For text: `<Text><Skeleton>content</Skeleton></Text>`.
- For components: `<Skeleton loading={bool}><Component /></Skeleton>`.

#### Avatar

- `fallback` is **required** — always provide it (initials string or ReactNode icon).
- `size` range is `"1"` – `"8"`.
- `variant`: `"solid"` | `"soft"` (default `"soft"`).

#### Dark Mode Integration

- `src/main.tsx` intentionally passes `appearance={resolvedTheme}` to `<Theme>` to keep Radix appearance in sync with the `styled-components` ThemeProvider. Do **not** remove this — it is a deliberate project decision.
- The official Radix recommendation (rely solely on class switching from `next-themes`) would not sync the `styled-components` palette. This dual approach is the accepted trade-off.
- Do **not** add a second `<Theme>` wrapper to change appearance elsewhere in the tree; use `accentColor`/`radius` overrides on a nested `<Theme>` if a subtree needs a different accent.

---

## Offline-First and Dexie

- `Dexie` is the local persistence layer for PWA/offline data.
- Current usage includes auth persistence; future usage must also cover offline domain data and sync metadata.
- New offline-capable features should persist local changes in Dexie first, then sync with server when online.
- Keep server sync logic explicit and predictable (retry-safe, conflict-aware where needed).

---

## Auth & Session Flow

- Login token may come from query params (`jwtAuthToken`) in `useCheckSignIn`.
- Token is persisted to IndexedDB and validated client-side (JWT exp check).
- Auth status is resolved through `useAuthStore` (`unknown` | `authenticated` | `unauthenticated`).
- Protected pages must be wrapped by `ProtectedRoute`.
- Auth token is read/written only via `src/store/IDB/auth.ts`.

---

## Global Constants Pattern

- Time constants are defined in `src/constants/time.ts`.
- Always import `SECOND`, `MINUTE`, `HOUR`, `DAY` explicitly from `constants/time` where needed.
- Do not rely on implicit globals for time constants.

---

## Agent Workflow

Before changes:

- Read this file.
- Identify layer boundaries.
- Identify minimal change scope.
- If a task requires an architecture change (e.g. moving async logic out of stores), explicitly call it out before implementing.

During changes:

- Follow existing patterns.
- Do not introduce new abstractions unnecessarily.

After changes, ensure:

- No raw user-facing strings in JSX.
- No `any`.
- No API calls outside store.
- No inline styles.
- `npm run lint` passes.
