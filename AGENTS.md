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

## Directory Roles

- `src/root.tsx`: app bootstrap (Sentry, ThemeProvider, analytics, global CSS).
- `src/main.tsx`: app shell composition (router, layout, toaster, global hooks).
- `src/features/*`: routing and access guards (`AppRouter`, `ProtectedRoute`, `HomeRouteGuard`).
- `src/pages/*`: route-level screens/containers.
- `src/components/*`: reusable UI blocks used by pages.
- `src/basics/*`: low-level primitives/shared visual helpers.
- `src/hooks/*`: cross-page side effects and app lifecycle hooks.
- `src/store/*`: global client state + async actions.
- `src/api/*`: HTTP transport and backend contracts.
- `src/helpers/*`: pure utilities (env/url/errors/time/...).
- `src/constants/*`: app constants, route map, messages, env config.

## UI System Rules

- Prefer `@radix-ui/themes` components for all layout and UI composition by default.
- If a layout, spacing, color, size, alignment, or variant can be expressed via native Radix props, always use the Radix API first.
- For spacing and layout parameters such as `gap`, `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, `mt`, `mb`, `align`, `justify`, `width`, `height`, and similar props, use the native Radix API on `Box`, `Flex`, `Grid`, `Container`, `Text`, and related primitives whenever possible.
- For page/content width constraints, prefer Radix `Container` with appropriate size props over hardcoded fixed dimensions like `maxWidth="900px"` on layout primitives (for example on `Flex`).
- Do **not** introduce routine CSS classes such as `.this_block`, `.header_row`, `.content_wrapper`, etc. for standard component layout.
- `styled-components` is allowed only in exceptional cases:
    - when the requested UI cannot be implemented cleanly with Radix primitives and props alone;
    - when a narrowly scoped override is required by a hard UI/product requirement.
- Do **not** override Radix styles or introduce custom CSS/styled wrappers unless there is a strict necessity that cannot be solved by Radix composition/props.
- Do **not** create routine wrappers such as `styled(Flex)`, `styled(Box)`, `styled(Grid)`, `styled(Text)`, etc. for standard layout or spacing; use the Radix primitives directly in JSX.
- When `styled-components` are necessary, use clear, semantic component naming and keep the styling narrowly scoped.
- Text content that needs truncation should be rendered with the Radix `Text` component using the `truncate` prop instead of custom CSS truncation wrappers.
- Do not introduce custom styled wrappers if the same result is possible with Radix props/composition.
- Do **not** use inline styles (`style={...}`) on any React component — no exceptions. If no Radix prop covers the required CSS property, create a narrowly scoped `styled-component` instead.
- Prefer Radix props, theme tokens, and narrowly scoped styled overrides instead of inline styles.
- `flexShrink`, `flexGrow`, `flexBasis` are available as direct Radix props on all layout components (`Box`, `Flex`, `Grid`); use them in JSX instead of CSS.
- Width/height string values such as `"100%"`, `"max-content"`, `"var(--space-8)"` are accepted directly by `width`, `minWidth`, `maxWidth`, `height` props on `Box`, `Flex`, `Grid`; prefer them over styled wrappers.
- For interactive components that lack a `width` prop (e.g. `Button`, `IconButton`), wrap them in `<Box width="...">` rather than creating `styled(Button)` solely for width.
- Use `asChild` when a Radix component needs to render as a different HTML element while keeping Radix styles and behavior (e.g. `<Flex asChild><label>`). Do not add a wrapper element; merge via `asChild` instead.
- When building typed wrapper components around Radix components, use `ComponentProps<typeof RadixComponent>['propName']` to extract prop types instead of re-declaring them manually.

## Layering and z-index Rules

- Treat Radix portal stacking as the default layering system for dialogs, popovers, dropdowns, tooltips, sheets, and other floating UI.
- Do **not** introduce custom `z-index` scales or arbitrary high values. Avoid `z-index` values other than `auto`, `0`, or in rare cases `-1`.
- If elements must stack above each other, render them through portals instead of trying to force order with `z-index`.
- A non-default `z-index` is allowed only as a documented exception when portal composition cannot solve the issue; keep it narrowly scoped and explain the reason in code.

## Radix Color Scale Semantics

Radix Colors uses a 12-step scale per hue. Each step has a defined semantic purpose — always pick the step that matches the use case, not just the shade you like visually.

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

**Rules derived from the scale:**

- Never use a **background step (1–5)** for a border CSS property. Borders must use steps 6–8.
- Never use a **border step (6–8)** for a background or text CSS property.
- Never use a **text step (11–12)** for a background or border CSS property.
- Static non-interactive containers (headers, sidebars, cards) → border step **6**.
- Interactive components (inputs, buttons) → border step **7** (normal) / **8** (hover/focus).
- Solid-fill backgrounds for components, overlays, badges → steps **9–10**.
- Most step 9 colors use white foreground text; `Sky`, `Mint`, `Lime`, `Yellow`, `Amber` need **dark** foreground text on steps 9–10.

**Semantic scale pairings (Western conventions):**

- Error: `red`, `ruby`, `tomato`, `crimson`
- Success: `green`, `teal`, `jade`, `grass`, `mint`
- Warning: `yellow`, `amber`, `orange`
- Info: `blue`, `indigo`, `sky`, `cyan`

## styled-components Color and Spacing Rules

> These rules apply only when `styled-components` usage has already been justified as an exception.

- **Colors** must use theme tokens and a single selector helper: `themeColor('indigo2')`.
    - Never use raw hex colors (`#...`) inside `styled-components` templates.
    - Never access Radix color tokens via CSS variables (`var(--indigo-2)`) inside styled-components templates.
    - All color palette entries are available in both light and dark variants via `ThemeProvider` (see `src/constants/styled-themes.ts`).
    - Use `themeColor('token')` from `src/helpers/colors.ts` in styled templates for consistency and readability.
    - If a needed color token does not exist yet, extend the theme mapping/helper instead of hardcoding a hex fallback.
    - In components, reference palette token names directly (`green8`, `gray11`, etc.); light/dark switching is handled by `lightThemeStyled`/`darkThemeStyled` automatically.
    - Always choose the token step that matches its semantic role per the **Radix Color Scale Semantics** table above (e.g. `gray6` for a subtle non-interactive border, `gray7` for an interactive input border, `gray11` for low-contrast text).
- **Spacing props** (`padding`, `margin` and their directional variants): prefer native Radix props (`p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, etc.) passed directly in JSX.
    - Do **not** hardcode `padding: var(--space-4)` in the CSS template when a `p="4"` JSX prop achieves the same result.
    - `var(--space-*)` is only acceptable for CSS-only properties that have no Radix prop equivalent — such as `top`, `right`, `bottom`, `left`, `inset`, and similar positional rules.
- **Radix primitives**: do not wrap `Box`, `Flex`, `Grid`, `Text`, and similar primitives in `styled(...)` for routine presentation.
    - Compose them directly and pass Radix props in JSX.
    - Only introduce a styled wrapper when Radix props/composition cannot express the required UI.
- **Compound component parts**: do not use `styled(Compound.Part)` such as `styled(TextField.Root)`, `styled(IconButton)`, `styled(Select.Trigger)`. This breaks TypeScript types. Instead, wrap the compound component in a `styled.div` or `<Box>` and apply layout there.
- **Specificity hacks**: never use `&&` selector blocks (`&& { ... }`) inside `styled-components` templates to override Radix styles. `&&` indicates a CSS specificity war — refactor to avoid the conflict entirely.
- **Size values** (`width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`): do not hardcode `rem` values in `styled-components` for routine layout sizing.
    - Prefer Radix size/spacing tokens and `var(--space-*)` values for component dimensions when possible.
    - If a size does not map cleanly to the spacing scale, justify the exception in code or keep it tightly scoped.
- Pattern summary:

    ```ts
    // ✅ colors — use the selector helper
    color: ${themeColor('gray11')};
    background-color: ${themeColor('indigo2')};

    // ✅ padding/margin — use Radix props on the component in JSX
    // <Box p="4">...</Box> instead of padding: var(--space-4) in CSS

    // ✅ use Radix primitives directly for layout
    // <Flex align="center" justify="between" gap="3">...</Flex>

    // ✅ truncate text with Radix instead of custom CSS wrappers
    // <Text truncate>Very long content...</Text>

    // ✅ positional CSS with no Radix prop equivalent — var() is acceptable
    top: var(--space-3);
    bottom: var(--space-6);
    inset-inline: var(--space-4);

    // ❌ never mix — don't use hex or var() for colors in styled templates
    color: #0d1511;
    color: var(--indigo-2);

    // ❌ don't create routine styled wrappers around Radix primitives
    const HeaderRow = styled(Flex)`...`;

    // ❌ don't use var() for padding/margin when Radix prop works
    padding: var(--space-4);

    // ❌ never use inline styles — use styled-component for CSS without a Radix prop
    style={{ height: '240px' }}

    // ❌ never use && to override Radix styles
    && { background: red; }

    // ❌ never wrap compound parts in styled()
    const Field = styled(TextField.Root)`width: 100%;`;
    ```

## Radix Compound Component API Rules

Radix Themes uses compound component patterns. Always use the correct composition; incorrect nesting causes broken accessibility and visual bugs.

### Dialog

- Structure: `Dialog.Root > Dialog.Trigger > Dialog.Content > [Dialog.Title, Dialog.Description?, Dialog.Close]`.
- `Dialog.Title` is based on `Heading` — do **not** nest a `<Heading>` inside it.
- `Dialog.Description` is based on `Text` — do **not** nest a `<Text>` inside it; pass content directly as children.
- `modal` prop is **unavailable** — Dialog is always modal.
- `Dialog.Close` must live inside `Dialog.Content`.
- Control width of the dialog via `maxWidth` on `Dialog.Content`, not via wrappers.

### Select

- `size` prop belongs on `Select.Root`, not on Trigger or Content.
- `variant`, `color`, `radius` belong on `Select.Trigger`.
- `Select.Content` accepts `variant` (`"solid"` | `"soft"`), `color`, `highContrast`.
- For grouping items use `Select.Group` + `Select.Label` together.
- For custom trigger display (icon + text) pass children to `Select.Trigger` directly.

### TextField

- Structure: `TextField.Root > TextField.Slot? > (input is implicit)`.
- `TextField.Slot` requires `side="left"` or `side="right"` — there is no default position.
- Do **not** use `size="1"` with interactive elements inside a Slot (no room).
- `TextField.Root` is a `div` and accepts margin props (`mt`, `mb`, etc.) directly.

### Popover

- Structure: `Popover.Root > Popover.Trigger > Popover.Content > Popover.Close?`.
- `Popover.Content` inherits Radix primitive props: `sideOffset`, `align`, `side`.
- To match trigger width: `width="var(--radix-popover-trigger-width)"` on `Popover.Content`.

### Callout

- Structure: `Callout.Root > Callout.Icon > Callout.Text`.
- Always include `Callout.Icon` — it is required for correct layout and accessibility.

### Skeleton

- `loading` prop controls display; default is `true`.
- `Skeleton` renders as `<span>`. Do **not** wrap multiple block-level siblings in one Skeleton.
- For text: wrap the text node itself — `<Text><Skeleton>content</Skeleton></Text>`.
- For components: `<Skeleton loading={bool}><Component /></Skeleton>` — one Skeleton per logical element.

### Avatar

- `fallback` is **required** — always provide it (initials string or ReactNode icon).
- `size` range is `"1"` – `"8"`.
- `variant`: `"solid"` | `"soft"` (default `"soft"`).

### Responsive Props

- Most size and layout props accept a responsive object: `size={{ initial: '1', sm: '2', md: '3' }}`.
- Breakpoints (min-width): `initial` = 0px, `xs` = 520px, `sm` = 768px, `md` = 1024px, `lg` = 1280px, `xl` = 1640px.
- Always start from `initial` when overriding — it is the mobile-first baseline.

### Dark Mode Integration

- `src/main.tsx` intentionally passes `appearance={resolvedTheme}` to `<Theme>` to keep Radix appearance in sync with the `styled-components` ThemeProvider. Do **not** remove this — it is a deliberate project decision.
- The official Radix recommendation (rely solely on class switching from `next-themes`) would not sync the `styled-components` palette. This dual approach is the accepted trade-off.
- Do **not** add a second `<Theme>` wrapper to change appearance elsewhere in the tree; use `accentColor`/`radius` overrides on a nested `<Theme>` if a subtree needs a different accent.

## Numbers and Amount Formatting

- Use `Amount` from `src/basics/numbers` as the default renderer for UI numbers related to money, balances, debts, totals, and formatted numeric values.
- Do not render currency/amount values as raw JSX strings or via ad-hoc `toFixed`/manual concatenation in components.
- Import from `basics/numbers` (public entry), not from deep internal paths, unless extending the number system itself.
- Keep formatting logic inside `basics/numbers` and `helpers/numbers`; UI layers should only pass value/format props.

## Custom Hooks

- Before writing a custom hook, check if `@uidotdev/usehooks` already provides it — prefer the library over reinventing the wheel.
- Custom hooks in `src/hooks/*` should only exist for app-specific logic that has no equivalent in `@uidotdev/usehooks`.

## React Memoization & Performance Guidelines

**Core principle:** memoization is opt-in, not default. Apply only when there is a measurable or likely performance issue. Profile first with React DevTools Profiler.

**`React.memo`** — wrap a component only when it:

- re-renders frequently with identical props, or
- is expensive to render.

Uses shallow comparison — inline objects/arrays/functions as props break it silently.

```tsx
// ✅ stable props — memo is effective
const UserCard = React.memo(({ userId, name }: Props) => <.../>);

// ❌ breaks memo — new object reference on every parent render
<UserCard style={{ color: 'red' }} />
```

**`useMemo`** — use only for:

- computationally expensive derivations, or
- stabilizing object/array references passed to memoized children or hook deps.

```tsx
// ✅ stabilize reference for memoized child
const filters = useMemo(() => ({ status, page }), [status, page]);

// ❌ unnecessary — cheap computation, no reference stability needed
const label = useMemo(() => `Hello ${name}`, [name]);
```

**`useCallback`** — use only when:

- the function is passed to a `React.memo` child, or
- the function appears in a `useEffect`/`useMemo` dependency array.

```tsx
// ✅ passed to memoized child
const handleRemove = useCallback((id: string) => removeItem(id), [removeItem]);
```

**Anti-patterns:**

- Blanket `React.memo` / `useMemo` / `useCallback` on everything.
- Inline `{}` or `[]` props on memoized components.
- `JSON.stringify(value)` in dependency arrays.
- Optimizing without profiling first.

**Practical order:**

1. Write simple, readable code first.
2. Profile if sluggishness appears.
3. Apply `React.memo` at component boundaries before reaching for `useMemo`/`useCallback`.
4. Keep memoization surgical and documented with a comment explaining why.

## Dependency Rules (Current Architecture)

- Pages/components/hooks/features can read from stores.
- Stores are the main place for async data fetching and call `src/api/*`.
- Components/pages should not call API directly.
- `src/api/chipin.ts` is the single HTTP gateway (axios instance + interceptors).
- Auth token is read/written only via `src/store/IDB/auth.ts`.
- Use TS path aliases from `tsconfig.app.json` (`api/*`, `store/*`, `components/*`, etc.).
- Route paths come from `ROUTES` (`src/constants/routes.ts`), not hardcoded strings.

## Offline-First and Dexie

- `Dexie` is the local persistence layer for PWA/offline data.
- Current usage includes auth persistence; future usage must also cover offline domain data and sync metadata.
- New offline-capable features should persist local changes in Dexie first, then sync with server when online.
- Keep server sync logic explicit and predictable (retry-safe, conflict-aware where needed).

## Auth & Session Flow

- Login token may come from query params (`jwtAuthToken`) in `useCheckSignIn`.
- Token is persisted to IndexedDB and validated client-side (JWT exp check).
- Auth status is resolved through `useAuthStore` (`unknown` | `authenticated` | `unauthenticated`).
- Protected pages must be wrapped by `ProtectedRoute`.

## Error Handling & Notifications

- API errors are normalized through `resolveApiErrorMessage` and shown via `sonner`.
- Offline/network/backend errors are handled in axios response interceptor.
- UI-level actions may show toasts from hooks/components/stores.

## i18n and UI Text

- New UI text should go through i18n (`react-i18next`) or centralized message constants.
- Keep translation keys in `src/i18n/locales/*`.
- For every new page/section, add locale keys immediately in both `src/i18n/locales/en/*` and `src/i18n/locales/ru/*` within the same task.
- Do not leave raw user-facing string literals in JSX; use `t('...')` keys instead.
- Existing hardcoded strings exist; do not add new hardcoded user-facing strings in JSX.
- If a translation text is used in more than one namespace file, move it to `common.json` and reference via `common:` prefix. Do not duplicate the same translation across multiple locale files.

## Global Constants Pattern

- Time constants are defined in `src/constants/time.ts`.
- Always import `SECOND`, `MINUTE`, `HOUR`, `DAY` explicitly from `constants/time` where needed.
- Do not rely on implicit globals for time constants.

## Code Quality

- Run: `npm run lint` before finalizing changes.
- Follow import sorting and unused-import rules from `eslint.config.js`.
- Keep strict TS compatibility (`strict: true`).
- Use `export default` for most React components (pages, features, reusable components).
- Exception: modal components can use named `const` exports to support grouped/barrel imports from the modal directory.

## Boolean Naming Convention

- Boolean variables, state, and props must be prefixed with `is` or `has`.
- Use `is` as the default prefix: `isLoading`, `isOpen`, `isVisible`, `isButtonShown`, `isWorking`.
- Use `has` only when `is` reads unnaturally and `has` better describes possession or presence: `hasError`, `hasPermission`, `hasChildren`.
- Never name booleans without a prefix (e.g. `loading`, `open`, `visible`, `shown` are not allowed as standalone boolean names).
- This applies to: local variables, state hooks, store fields, component props, and function return values that represent a boolean flag.

## Variable Naming Convention

**Event handlers** — prefix `handle`:

- `handleSubmit`, `handleAvatarClick`, `handleMenuClose`.
- Never name handlers without a prefix (`submit`, `avatarClick` are not allowed).

**Callback props** — prefix `on`:

- `onSubmit`, `onChange`, `onClose`, `onAvatarClick`.
- Never pass callbacks as props without the `on` prefix.

**Async data-fetching functions** — prefix `fetch`:

- `fetchGroups()`, `fetchDashboard()`, `fetchUserById(id)`.
- Use `fetch` for all store actions and helpers that call the API and return data.

**Arrays and collections** — always use plural names:

- `users`, `groupIds`, `expenseItems`.
- Never name an array with a singular noun (`user = []`, `groupId = []` are not allowed).

**Array iteration variables** — use short readable names, never single letters:

- `users.map((user) => ...)`, `groups.forEach((group) => ...)`, `items.map((item, index) => ...)`.
- Never use single-letter iteration variables (`i`, `r`, `o`, `x`, `e` are not allowed).
- Use the singular form of the array name as the item name: `users` → `user`, `groups` → `group`, `expenseItems` → `expenseItem`.
- For index, always use the full word `index`, never `i` or `idx`.

**Module-level constants** — `SCREAMING_SNAKE_CASE`:

- `MAX_RETRY_COUNT`, `DEFAULT_CURRENCY`, `BASE_URL`.
- Applies to exported constants in `src/constants/*` and top-level module constants elsewhere.

**Types and interfaces** — PascalCase, no `I`-prefix:

- `type GroupMember = {}`, `interface AuthState {}`.
- Never use `IAuthState`, `TGroupMember`, or lowercase type names.

**Component props type/interface names** — use `Props`:

- In React component files, name component props type/interface as `Props`.
- Prefer `interface Props { ... }` or `type Props = { ... }` instead of `EventUnknownProps` / `ComponentNameProps`.

**Custom hooks** — prefix `use`:

- `useAuth`, `useGroups`, `useModalState`.
- Never name hooks without the `use` prefix (`authHook`, `getGroups` are not allowed).

**React components** — PascalCase:

- `GroupCard`, `ExpenseItem`, `UserAvatar`.
- Never use camelCase or lowercase for component names (`groupCard`, `expenseitem` are not allowed).

**Ref variables** — suffix `Ref`:

- `buttonRef`, `containerRef`, `inputRef`.
- Always use `useRef` results with the `Ref` suffix.

**Zustand stores** — suffix `Store`:

- `useAuthStore`, `useDashboardStore`, `useGroupsStore`.
- All zustand store hooks must end with `Store`.

**Utility functions** — camelCase verb-first:

- `formatDate()`, `parseUrl()`, `resolveError()`, `buildQueryString()`.
- Name utilities as concise verb phrases; never use noun-based names (`dateFormatter`, `urlParser` are not allowed).

**File naming**:

- React components: `PascalCase.tsx` — `GroupCard.tsx`, `ExpenseItem.tsx`.
- Custom hooks: `camelCase.ts` — `useAuth.ts`, `useGroups.ts`.
- Utilities and helpers: `camelCase.ts` — `numbers.ts`, `url.ts`.
- Constants: `camelCase.ts` — `routes.ts`, `time.ts`.

## Component Grouping

- When two or more components share closely related logic, domain, or visual purpose, group them into a dedicated subdirectory (e.g. `components/Modal/`, `components/Navs/`).
- Every such directory must have an `index.ts` barrel file that re-exports all public components using named exports.
- The barrel file must only contain `import` / `export` statements — no logic, no JSX.
- Consumers must import from the directory barrel (`components/Modal`) rather than from deep internal paths (`components/Modal/AddExpenseModal`).
- A single standalone component does not need its own folder; only group when there are two or more related components.

## Practical Do/Don't

- Do: fetch dashboard/groups/users through zustand store actions.
- Do: add routes in `ROUTES` + `AppRouter` together.
- Do: use aliases (`store/...`) instead of deep relative imports.
- Do: use Radix components first; justify any `styled-components` usage.
- Don't: call backend directly from page/component.
- Don't: bypass token/helpers or offline persistence flows with ad-hoc storage access.
- Don't: hardcode route strings when `ROUTES.*` exists.

## Agent Workflow

- Before edits: inspect `AGENTS.md` and touched module boundaries.
- Preserve layer responsibilities listed above.
- If a task requires architecture change (e.g., moving async logic out of stores), explicitly call it out before implementing.
- If rules conflict, this file has priority for this repository.
