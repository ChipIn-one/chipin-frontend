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

- Prefer `@radix-ui/themes` components for new UI by default.
- `styled-components` is allowed only in exceptional cases:
    - when a Radix component cannot be configured with existing props/tokens;
    - when a targeted style override is required for Radix-based UI.
- Do not introduce custom styled wrappers if the same result is possible with Radix props/composition.
- Do not use inline styles (`style={...}`) on React components.
- Prefer Radix props, theme tokens, CSS classes, or scoped styled overrides instead of inline styles.

## styled-components Color and Spacing Rules

- **Colors** must use theme tokens and a single selector helper: `themeColor('indigo2')`.
    - Never access Radix color tokens via CSS variables (`var(--indigo-2)`) inside styled-components templates.
    - All color palette entries are available in both light and dark variants via `ThemeProvider` (see `src/constants/styled-themes.ts`).
    - Use `themeColor('token')` from `src/helpers/colors.ts` in styled templates for consistency and readability.
    - In components, reference palette token names directly (`green8`, `gray11`, etc.); light/dark switching is handled by `lightThemeStyled`/`darkThemeStyled` automatically.
- **Spacing props** (`padding`, `margin` and their directional variants): prefer native Radix props (`p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, etc.) passed directly to the styled component in JSX, since `styled(Box)` forwards all Radix props.
    - Do **not** hardcode `padding: var(--space-4)` in the CSS template when a `p="4"` JSX prop achieves the same result.
    - `var(--space-*)` is only acceptable for CSS-only properties that have no Radix prop equivalent — such as `top`, `right`, `bottom`, `left`, `gap` inside a raw CSS rule, etc.
- Pattern summary:

    ```ts
    // ✅ colors — use the selector helper
    color: ${themeColor('gray11')};
    background-color: ${themeColor('indigo2')};

    // ✅ padding/margin — use Radix props on the component in JSX
    // <CoverInfo p="4"> instead of padding: var(--space-4) in CSS

    // ✅ positional CSS with no Radix prop equivalent — var() is acceptable
    top: var(--space-3);
    bottom: var(--space-6);

    // ❌ never mix — don't use var() for colors
    color: var(--indigo-2);

    // ❌ don't use var() for padding/margin when Radix prop works
    padding: var(--space-4);
    ```

## Numbers and Amount Formatting

- Use `Amount` from `src/basics/numbers` as the default renderer for UI numbers related to money, balances, debts, totals, and formatted numeric values.
- Do not render currency/amount values as raw JSX strings or via ad-hoc `toFixed`/manual concatenation in components.
- Import from `basics/numbers` (public entry), not from deep internal paths, unless extending the number system itself.
- Keep formatting logic inside `basics/numbers` and `helpers/numbers`; UI layers should only pass value/format props.

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
