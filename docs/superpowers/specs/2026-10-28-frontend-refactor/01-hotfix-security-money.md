# Spec 01 — Hotfix before the refactor: invite security, money, spinner

Decision: D1 (+ one-line items of D16). Repository: `chipin-frontend`, target branch `master` (canonical after FE#497).
Paths and lines were verified on commit `3d0086e` (branch `chore/issue-456-ds-gallery`); the `src/**`, `vercel.json`, `.gitignore` paths were re-checked against `origin/master` `522973a` (the `src/` code matches); backend — `origin/develop` `0901ebb`.
PR identifiers use the global scheme `<spec>-<n>` (see `00-overview.md`): here `01-1`, `01-2`, `01-3`; backend issues — `BE-01-<n>`.
Order: all three PRs are merged **before** the mass formatting (02-C2) and before the monorepo move (04-0); the paths below are `src/…` of the current root.
Revision 2026-10-28 after review C1/C2/C3 (`review-C*.md`, Resolution column): C2-20 (`error` state + session guard), Minor C1-26/27, C2-21…24, C3-16/17/28/29. The hotfix can be merged.

## Goal

Before the refactor starts (specs 02–05), close the critical defects with small PRs that do not depend on the future architecture:
1. An invite link must not be turned into an arbitrary authorized request (CSPT, F1).
2. Joining a group / accepting a friendship via a link happens only after explicit confirmation (F4).
3. Invite tokens do not go to Sentry/Vercel Analytics (F2).
4. Money in the expense editor is rounded by one correct function.
5. A zero balance means "settled up" everywhere.
6. The public page does not hang on `PageLoader` after settings sync.
7. Safe one-line fixes for headers, `.gitignore`, the role in localStorage (D16).

## Context

- F1: `src/api/chipin.ts:87` — `` `/groups/invite/${inviteToken}` `` without encoding; `src/hooks/useJoinInviteLink.tsx:16-30` sends the POST immediately when the page opens. React Router 7 turns `%2F` in a parameter into `/` (`04-security.md`, §5 F1). The link `/group/join/..%2F<groupId>%2Fmembers%2F<userId>%2Fkick` → `POST /api/groups/<groupId>/members/<userId>/kick` with the victim's token.
- The second link of the chain is the Vercel external rewrite `/api/:path*` → `https://api.chipin.one/:path*` (`vercel.json:12-19`). If Vercel decodes `%2F` when substituting `:path*`, upstream receives `/groups/invite/../<g>/members/<u>/kick` and normalizes it — then `encodeURIComponent` alone is not enough for any unchecked id parameter (`/group/:groupId`, `/activity/:parentActivityId`). Therefore `apiPath` does not rely on proxy behavior: every segment passes the allowlist `^[A-Za-z0-9_-]+$` (review B, M1).
- An important clarification to the open question "does Ktor normalize `..`": for this vector it **does not matter**. A literal `..` in a URL is normalized by the browser itself (WHATWG URL in `XMLHttpRequest.open`) before sending — the backend already receives the "clean" `/groups/<uuid>/members/<uuid>/kick`, which passes `asValidUuid`. So the fix must be on the client; the backend check is only defense-in-depth for the encoded `%2E%2E`/`%2F`.
- All interpolations of path parameters in the API layer (14 places, only one encodes):
  - `src/api/chipin.ts:52, 69, 74, 82 (groupId, userId), 87`
  - `src/api/groupsApi.ts:25, 44`
  - `src/api/ledgerApi.ts:67, 74, 86`
  - `src/api/activityApi.ts:46, 71`
  - `src/api/usersApi.ts:67` (already `encodeURIComponent`), `:72`
- Token format on the backend: `src/main/kotlin/common/InviteTokenGenerator.kt:9-16` — 32 random bytes → Base64 URL-safe without padding → `.take(32)`. Result: exactly 32 characters from `[A-Za-z0-9_-]` (192 bits). The generator has not changed since creation (`5ff82cd`). One generator for groups (`GroupService.kt:70`) and friends (`UserInviteRepository.kt:30`). Columns `invite_token VARCHAR(64)` (`V3__…_add_groups.sql:62`, `V16__…_create_user_invite_links.sql:3`).
- There is **no** preview endpoint for a group invite: `GroupRoutes.kt:109` has only `post("/invite/{inviteToken}")`; there is no GET counterpart.
- F2: `src/constants/telemetry.ts:1-3` + `src/helpers/telemetry.ts:19-27` cover `/group/join/`, `/friends/join/`, `/users/invite/`, but not the API path `/groups/invite/<token>`. The sanitizer is used in `src/bootstrap/initializeSentry.ts:20-43` (breadcrumbs `url/from/to`) and `:44-70` (request, transaction), and in Vercel Analytics via `sanitizeTelemetryEvent`.
- Money: `roundMoney = Math.round(v*100)/100` — `src/store/expenseModalStore.ts:161` and `src/store/expenseModalSelectors.ts:14`; the correct `roundHalfUp` is `src/helpers/numbers.ts:95` (not exported). `01-architecture.md:86-90`.
- Balance sign: 6 places split by sign (`01-architecture.md:91-95`), the faulty one is `CurrencyGroupCard.tsx:13`.
- Spinner: `src/features/routing/PublicLocaleRoute.tsx:28-50` + `src/hooks/useSyncUserSettings.tsx:18-33` (`02-routing-state-pwa.md`, item 3).
- D16: `vercel.json:120` (CSP), `:136` (Permissions-Policy), `.gitignore:30-31`, `src/helpers/localStorage.ts:10-13, 93-99`, `src/store/users-store/selectors.ts:35`.

## Decision

Three PRs, each released independently:

| PR | Title | Content |
|----|-------|---------|
| 01-1 | `fix(security): encode API path segments, validate invite tokens, redact group invite telemetry` | `apiPath` helper, 14 call sites, token validation in 2 hooks, sanitizer, CSP/Permissions-Policy, `.gitignore`, role cleanup |
| 01-2 | `fix(security): confirm before joining group or accepting friend invite` | confirmation screen for `/group/join/:inviteToken` and `/friends/join/:inviteToken` + i18n for 5 locales |
| 01-3 | `fix(money): single half-up rounding, zero balance is settled, public locale spinner` | replace `roundMoney`, balance direction helper in 6 places, `PublicLocaleRoute` fix |

Merge order: 01-1 → 01-2 (01-2 relies on `isInviteToken` from 01-1). 01-3 is independent.

## Details

### 01-1.1 The `apiPath` helper

New file `src/api/apiPath.ts`:

```ts
// UUID, base64url invite tokens, test fixtures (`group-1`, `activity-parent`). No `.`, `/`, `%`, `\`.
export const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export class InvalidPathSegmentError extends Error {
    constructor() {
        super('Invalid API path segment');
        this.name = 'InvalidPathSegmentError';
    }
}

export const apiPath = (strings: TemplateStringsArray, ...segments: string[]): string =>
    strings.reduce((path, chunk, index) => {
        if (index >= segments.length) {
            return path + chunk;
        }
        return path + chunk + encodePathSegment(segments[index]);
    }, '');

// Single implementation, reused by the generated-client wrapper `api()` (spec 03 §5.4).
export const encodePathSegment = (segment: string): string => {
    if (!PATH_SEGMENT_PATTERN.test(segment)) {
        throw new InvalidPathSegmentError();
    }
    return encodeURIComponent(segment); // no-op for the allowlist; kept as defense-in-depth
};
```

- Why an allowlist and not just encoding: (1) `encodeURIComponent('..') === '..'` — encoding alone does not protect against a dot-segment (`/groups/..` → `/`); (2) `%2F` may be decoded by the Vercel proxy before reaching the backend (Context). The allowlist excludes `.`, `..`, `''`, `/`, `%`, `\` — the protection depends on neither the browser, nor the proxy, nor Ktor.
- All API functions that call `apiPath` build the path **inside `.then`** — one form, no `async`: `` Promise.resolve().then(() => apiInstance.post(apiPath`/groups/invite/${inviteToken}`)) ``. This way `InvalidPathSegmentError` becomes a **rejected Promise**, not a synchronous throw: a route parameter `%2E` (RR decodes it to `.`) would otherwise throw inside a store action from `useEffect` and bring down the error boundary (review B, m1). We do not use `async`: until 02-C4, a warn selector "async without await" is in effect in `eslint.config.js:99-122` (its removal is PR 02-C4, spec 02).
- The error text does not contain the segment value (it does not leak into Sentry).
- All 14 call sites are rewritten to `` apiPath`/groups/${groupId}` `` etc.; `usersApi.ts:67` too (remove the manual `encodeURIComponent`, otherwise there will be double encoding).
- We do **not** add UUID validation for `groupId`/`entryId`/`parentActivityId` to the API layer: the test fixtures use `group-1`, `activity-parent` (both pass the allowlist), and the backend already does `asValidUuid`. All 14 places are ids/tokens (checked by grep), there are no other characters in legitimate segments; a fixture that does not pass the allowlist is replaced with a valid one. Validation of route parameters moves to loaders (D6, spec 04, PR 04-2e).

### 01-1.2 Invite token validation

New file `src/helpers/inviteToken.ts`:

```ts
// Backend InviteTokenGenerator: base64url alphabet; DB column VARCHAR(64).
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const isInviteToken = (value: string | undefined): value is string =>
    typeof value === 'string' && INVITE_TOKEN_PATTERN.test(value);
```

- The alphabet is exactly from the generator (this is the protective property: no `/`, `.`, `%`). The length is not strictly 32 but `16..64`: the lower bound cuts off garbage, the upper bound = the column size; this way the client does not break if the backend changes the generator length.
- Usage: in `useJoinInviteLink.tsx` and `useFriendInviteLink.tsx` — if `!isInviteToken(inviteToken)`, the request is not sent, `toast.error(i18n.t('toasts:group.inviteJoinError'))` / `toasts:friend.inviteJoinError` (the keys already exist) is shown and `navigate(ROUTES.DASHBOARD, { replace: true })`. In 01-2 the same predicate determines the "link is invalid" state on the confirmation screen.
- Fixtures in the hook tests (`invite-token`, `friend-token`, etc., shorter than 16 characters) are replaced with the constant `TEST_INVITE_TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345'` (the same example as in backend `UserOpenApiExamples.kt:19`) in `src/test/fixtures/inviteToken.ts`. API-layer fixtures do not need changing — the API layer does not validate the token.

### 01-1.3 Token sanitizer in telemetry

- `src/constants/telemetry.ts`: add `export const GROUP_INVITE_API_PATTERN = /\/groups\/invite\/[^/?#]+/;`.
- `src/helpers/telemetry.ts:26-28`: add `.replace(GROUP_INVITE_API_PATTERN, '/groups/invite/:inviteToken')`.
- Additionally in `initializeSentry.ts` `beforeBreadcrumb`: if `typeof breadcrumb.message === 'string'`, run it through `sanitizeTelemetryUrl` (fetch/xhr/navigation breadcrumbs sometimes put the URL in `message`).
- Instead of the key list `['url','from','to']` — a shallow walk: `sanitizeTelemetryUrl` is applied to **every** string value of `breadcrumb.data`, `event.extra`, `event.tags` (with one helper `sanitizeStringValues(obj)`; only the 4 explicit patterns, no generic regexp). This covers future `captureException(err, { extra: { url } })` (review B, m2).
- We do **not** introduce a generic rule "any base64url segment ≥20 characters" in the hotfix: false positives on UUIDs without hyphens / asset hashes, it breaks debugging. It is not part of any spec: follow-up issue "telemetry: generic token redaction" (list in `00-overview.md`).

### 01-1.4 One-line D16 items (all safe, included in 01-1)

1. CSP (`vercel.json:120`): add `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`; remove `blob:` from `script-src` (it appeared as a legacy of `606bdb0`, there are no blob scripts in the code; `URL.createObjectURL` is used only for image previews — `UserAvatarModal.tsx:96`, `create-update-group-modal/internal/hooks.ts:58` — that is `img-src`); remove `https://fonts.googleapis.com` from `style-src` and `https://fonts.gstatic.com` from `font-src` (there are no Google Fonts references). We do not touch `worker-src 'self' blob:`. `form-action 'self'` is safe: there is no `<form action>` in `src`, the OAuth start is a navigation, not a form submit.
   Update `vercel.config.test.js:128`: `expect(directives['script-src']).toBe("'self'")` + assertions for the 4 new directives and the absence of `googleapis`/`gstatic`.
2. Permissions-Policy (`vercel.json:136`): `camera=(), microphone=(), geolocation=(), payment=(), usb=()`. Test in `vercel.config.test.js`.
3. `.gitignore`: replace the block `:30-31` with
   ```
   # Env files (secrets)
   .env*
   !.env.example
   ```
   There are no tracked `.env*` files in the repo (`git ls-files` is empty), `.env.sentry-build-plugin` stays covered.
4. Role in localStorage: delete **only `role`**, not the whole object under the key `LS_KEY_USER` (`'Chipin_user'`, `src/constants/localstorage.ts:3`; in code and tests — only the constant). The whole object must not be deleted — `settings.language/theme` from it are read by `helpers/publicRoutes.ts:38` (landing locale after logout), `helpers/theme.ts:6`, `helpers/locale.ts:115`, `store/dashboardStore.ts:49`. Changes:
   - `src/helpers/localStorage.ts:10-13`: `role?: UserRole`.
   - a new function `clearLocalUserRole()` in the same file: reads `getLocalUser()`, if present — `saveLocalUser({ settings: localUser.settings })`.
   - the call in `resetAuthScopedStores` (`src/store/authStore.ts:46`) **as the first line** — before `useUsersStore.getState().setInitialUsersStore()`, which re-reads localStorage (`users-store/initialState.ts:6`).
   - Effect: `selectIsUserAdmin` (`users-store/selectors.ts:35`) after logout/session expiry no longer returns `true` from the old role until `users/self` of the new account is loaded.

Deferred (not one-line, not part of specs 02–05): narrowing `img-src` (needs a list of avatar/cover hosts — an open audit question), `report-to`, Sentry tunnel — follow-up issue "security: CSP img-src/report-to/Sentry tunnel" (list in `00-overview.md`). The source of the app CSP: until PR 04-2b — `vercel.json`, after — `apps/app/hosting.base.json` (from which `vercel.json` is generated); the directives of this PR are carried over there unchanged and repeated in the site CSP (`apps/site/vercel.json`, spec 04 §3.6).

### 01-2 Confirmation screen

- `src/pages/GroupJoinPage.tsx` and `src/pages/FriendJoinPage.tsx` stop being "hook + `PageLoader`". The hooks `useJoinInviteLink`/`useFriendInviteLink` no longer call POST in `useEffect`; they return `{ status: 'invalid' | 'ready' | 'joining' | 'error', errorMessage?: string, confirm: () => void, cancel: () => void }`.
- `confirm()` keeps the guard of the current `useFriendInviteLink.tsx:21-25` (`getAuthSessionVersion()` + `isAuthSessionCurrent()` + the `isActive` flag on unmount) in **both** hooks: a response that arrives after logout / a session change / leaving the page does not change the state and does not navigate.
- Screen states:
  - `invalid` (`!isInviteToken`): the text "The invite link is invalid", a "Go home" button.
  - `ready`: the title "Join the group by invitation?" / "Add the user as a friend?", the explanation "Group members will see your name and avatar", the buttons "Join"/"Accept" (primary) and "Cancel". Cancel → `navigate(ROUTES.DASHBOARD, { replace: true })`.
  - `joining`: the primary button in loading, a repeated click is ignored.
  - `error` (join rejected): 404 (unknown/revoked token, `GroupRoutes.kt:113-114`) → the `invalid` state; any other error (403, 409 `GROUP.ALREADY_MEMBER`, network, 5xx) → `error`: the text `resolveApiErrorMessageFromError(error, <inviteJoinError>)`, the buttons "Retry" (calls `confirm()` again, exactly one request) and "Go home". No toast is shown on error (the screen already shows it).
  - Focus on open — on "Cancel" (or nothing); the primary button has **no** `autoFocus`, so that Enter/a double tap right after opening does not join without reading the screen (review B, m11).
  - After success — the current behavior (navigate to the group / toast + `ROUTES.FRIENDS`).
- Unauthenticated user: `ProtectedRoute` does not change in the hotfix. Known behavior (`ProtectedRoute.tsx:26-38`): reason `signed_out` → redirect to the landing, the invite token is lost; other reasons → AuthModal, after sign-in the user sees `ready`, not an automatic join. Preserving the token for `signed_out` is PR 04-2f (`/login?returnTo`, spec 04); the 01-2 RTL test pins both paths so that 04-2f changes the behavior deliberately.
- Group preview (name, cover, number of members) — **there is no endpoint**, so the screen is generic. After backend issue BE-01-3 the preview is added in a separate PR (not in the hotfix).
- i18n: a new `join` block in `group.json` and `friends.json` in all 5 locales (`en, es, pt-BR, pt-PT, ru`): `title`, `description`, `confirm`, `cancel`, `invalidTitle`, `goHome`. The en/ru texts are written by the executor, es/pt-BR/pt-PT — machine translation with owner review.
- Components — Radix `Card`, `Button`, `Flex`, `Text` (as in the current pages), no new styled-components.

### 01-3.1 Money rounding

- `src/helpers/numbers.ts`: export `roundHalfUp`; add `export const MONEY_INPUT_PRECISION = 2;`.
- Remove both local `roundMoney` (`expenseModalStore.ts:161`, `expenseModalSelectors.ts:14`). Replace the calls with `roundHalfUp(x, MONEY_INPUT_PRECISION)` — the full list:
  1. `src/store/expenseModalSelectors.ts:106` — EQUAL, `totalAmount / includedUserCount`
  2. `:108` — PERCENT, participant's share
  3. `:110` — AMOUNTS, participant's input
  4. `:113` — SHARES, share by weights
  5. `:172` — PERCENT, `assignedAmount`
  6. `:174` — AMOUNTS, `assignedAmount`
  7. `src/store/expenseModalStore.ts:574` — the +/- step in AMOUNTS (`.toFixed(2)`)
- The other `roundHalfUp` calls (`numbers.ts:118, 236, 263`) are not touched.
- Precision 2 is temporary (as it is now). Minor units per currency (JPY=0, BHD=3) and `money.split` in scale-4 units — D10, spec 03 (PR 03-1, 03-2); we do not introduce them in the hotfix so as not to change behavior.

### 01-3.2 Zero balance = "settled up"

Definition: a balance is considered zero ("Settled up", gray color, neither in "you are owed" nor in "you owe") if `normalizeApiMoneyAmount(netBalance) === 0` (4 decimal places, `numbers.ts:117-120`; this removes float noise like `5.5e-17` after sums).

A new helper in `src/helpers/currencies.ts`:

```ts
export type BalanceDirection = 'owed' | 'owe' | 'settled';
export const getBalanceDirection = (netBalance: number): BalanceDirection => {
    const normalized = normalizeApiMoneyAmount(netBalance);
    if (normalized > 0) return 'owed';
    if (normalized < 0) return 'owe';
    return 'settled';
};
```

6 places that split by sign:

| # | Place | Now | Action |
|---|-------|-----|--------|
| 1 | `src/basics/BalanceSummaryText.tsx:29-33` | `>0` / `<0` | replace with `getBalanceDirection` |
| 2 | `src/store/dashboardSelectors.ts:21-25` | `>0` / `<0` | replace with `getBalanceDirection` |
| 3 | `src/components/dashboard-summary/internal/useConnect.ts:19, 31` | repeated filtering of already split lists | remove the repeated check (the input is already split in #2) |
| 4 | `src/store/groupsSelectors.ts:52-58` | `<0` / `>0` | replace with `getBalanceDirection` |
| 5 | `src/store/groupsSelectors.ts:90-94` | `===0` skip, `>0` | replace with `getBalanceDirection`; run the sum at `:98` through `normalizeApiMoneyAmount` |
| 6 | `src/pages/friends-page/components/CurrencyGroupCard.tsx:13` | **`>= 0` — a bug**: zero is shown in green "You are owed" | `const direction = getBalanceDirection(netBalance)`; `settled` → color `gray`, text `balances.settledUp` |

Plus the source of the sum for #6: `src/store/users-store/selectors.ts:76` (`group.netBalance += balance.netAmount`) — after the loop normalize `group.netBalance = normalizeApiMoneyAmount(group.netBalance)`.
The reference behavior already exists in `src/basics/DebtAmount.tsx` (`isZero` → `settledUp`, gray) — after the fix all 6 places are consistent with it. `DebtAmount` itself is also moved to the helper (the 7th edit, 2 lines).

### 01-3.3 `PublicLocaleRoute` hang

Cause: `useSyncUserSettings.tsx:29` changes the language on every new `settings` object; the effect `PublicLocaleRoute.tsx:28-46` does not restart (its deps did not change), and the render `:48-50` returns `PageLoader` while `resolvedLanguage !== locale` → an endless spinner.

The fix in `PublicLocaleRoute.tsx` — split into two effects and remove the blocking render:
1. **Assert effect** without cleanup, deps `[i18n, locale, i18n.resolvedLanguage]`: sets `document.documentElement.lang = locale`; if `i18n.resolvedLanguage !== locale` — `i18n.changeLanguage(locale)`. It fires also on an external language change, so it returns the URL language. No loop: `useSyncUserSettings` restarts only when `settings` change, not the language.
2. **Restore effect** deps `[]`, only a cleanup on unmount: the values `isLoggedIn`/`savedLanguage`/`previousDocumentLanguage` are taken from `useRef`s updated on every render. The restore logic is the same as now in `:37-45`. Reason for deps `[]`: on a transition between public pages React Router may reuse the component instance with a new `locale`; a cleanup between them would cause a race of two `changeLanguage` calls.
3. `PageLoader` remains only for the first render while the language is not yet switched — but with a guaranteed exit: the assert effect reacts to `resolvedLanguage`.

Complete elimination of the multiple language "writers" (5 places) — spec 04 (PR 04-2c `setAppLanguage`; PR 04-5a deletes `PublicLocaleRoute` entirely). The hotfix is needed because D8 is several weeks away.

## Nuances and pitfalls

- `apiPath` itself throws synchronously, but is called only inside `.then` (01-1.1) → a rejected Promise comes out, which store actions handle like any request error (the loading flag is reset). The test pins exactly the rejection, not a synchronous throw.
- Double encoding: after moving `usersApi.ts:67` to `apiPath`, the manual `encodeURIComponent` must be removed.
- Valid tokens do not change under `encodeURIComponent` (the base64url alphabet is safe) — for legitimate links the URL is identical to the current one.
- Changing `roundMoney` → `roundHalfUp` changes the result only on "half" float values (1.005, 2.675, −1.005). Negatives are rounded away from zero (as `roundHalfUp` does now), `Math.round` — toward +∞. The sum of EQUAL shares can still differ from the total by 0.01 — this is not a regression, remainder distribution is D10.
- The "zero" threshold = 4 decimal places, not 2: a balance of `0.004` is not "settled" (the backend stores it and blocks deleting the friend with `USER.OUTSTANDING_DEBT`). This is the **final** rule in spec 03 too (`displaySign` = the sign at scale 4, §4.2); displaying such an amount as "< 0.01" and settling the exact amount — spec 03 §4.5.
- CSP: check on a Vercel preview deploy that Sentry, Speed Insights, SW registration and avatar loading work (console without `Refused to …`).
- `.env*` in `.gitignore` will also hide a future `.env.example` if the `!` exception is forgotten — it is included.

## Future extension

- `apiPath` becomes the only way to build a path until the move to the generated client (D4, spec 03 PR 03-4: the `api()` wrapper substitutes `{param}` through the same `encodePathSegment` — the allowlist and the dot-segment rule are not lost; the file moves to `shared/api/pathSegment.ts`); a `no-restricted-syntax` lint rule on a template literal inside `apiInstance.*(…)` — spec 02 (PR 02-C12).
- `getBalanceDirection` is replaced in PR 03-3 by `partitionBalances`/`displaySign` (`src/shared/money`, `src/entities/balance`). The "zero" threshold stays at scale 4 (`0.0040 USD` ≠ "settled"), the hotfix behavior is preserved.
- The confirmation screen gets the group preview after BE-01-3; on the Astro site (D8) the landings `/join/group/<token>` and `/join/friend/<token>` (spec 04 §3.5) lead with a button to the same screen (`app.chipin.one/group/join/<token>`, `app.chipin.one/friends/join/<token>`; the path in the app does not change, only the host changes, D26).

## What we do NOT do

- PKCE/state for OAuth on the client (needs the backend, BE-01-1).
- UUID validation of route parameters — spec 04 (04-2e); narrowing `img-src`, CSP reporting, Sentry tunnel — a follow-up issue outside the specs.
- Minor units per currency, the `src/shared/money/` module, lint on `Number()`/`parseFloat` — D10, spec 03 (03-1, 03-3).
- Merging the 5 language "writers" — spec 04 (04-2c, 04-5a).
- Removing the D16 dependencies (dexie, sharp, etc.) and the vendor regex — spec 02 (02-B1, 02-B2).
- Rotating the local Sentry token — an owner action.
- `.gitignore` `.env*` is here (01-1); spec 02 (02-A3) does not repeat it.

## Phases/PRs

| PR | Diff estimate | Dependencies | Risk |
|----|---------------|--------------|------|
| 01-1 | ~250 lines (code ~90, tests ~160) | — | low; the URL of legitimate requests does not change |
| 01-2 | ~350 lines (2 pages, 2 hooks, 10 json, tests) | 01-1 | medium (UX change, the texts need review) |
| 01-3 | ~220 lines | — | medium (money) — before/after snapshot tests |

Each PR has its own FE issue (Type=Bug, Priority=P1 for 01-1/01-2, P2 for 01-3, Project 5), with a reference to D1 and this file.

## Tests/acceptance criteria

01-1:
- `src/api/apiPath.test.ts`: (a) UUID, `TEST_INVITE_TOKEN`, `group-1`, `activity-parent` → unchanged; (b) `..`, `.`, `''`, `'a/b'`, `'../x'`, `'a%2Fb'`, `'a.b'`, `'a\b'`, space → `InvalidPathSegmentError`; (c) the error message does not contain the segment value; (d) an API function with `'..'` in the parameter returns a rejected Promise (`return expect(...).rejects…`; the `await` style is free, D24), does not throw synchronously.
- `src/api/chipin.test.ts`, `groupsApi.test.ts`, `ledgerApi.test.ts`, `activityApi.test.ts`, `usersApi.test.ts`: one case per function with `/` in the parameter — the promise is rejected with `InvalidPathSegmentError`, the `apiInstance` mock is not called.
- **E2E-ish traversal** `src/features/routing/inviteTraversal.integration.test.tsx`: a real `apiInstance` with a custom axios `adapter` that records `new URL(axios.getUri(config), 'https://chipin.one').pathname` (with `baseURL: '/api'` `getUri` is relative — without a base `new URL` throws) and answers 200; `MemoryRouter` with `initialEntries={['/group/join/..%2F11111111-1111-1111-1111-111111111111%2Fmembers%2F22222222-2222-2222-2222-222222222222%2Fkick']}` and the route from `AppRouter`; an authorized auth store. Expectations: the adapter is never called; the `inviteJoinError` toast is shown; no recorded pathname matches `/\/kick$/`. A second case in the same file: a direct call `inviteApiUserToGroup({ inviteToken: '../g/members/u/kick' })` → rejected `InvalidPathSegmentError`, the adapter is not called.
- Preview-deploy check (manual, PR checklist): `curl -i https://<preview>/api/groups/..%2Fhealth` does not return the `/health` body (`{"status":"UP"}`); record the result (whether Vercel decodes `%2F`) in BE-01-2.
- `src/helpers/inviteToken.test.ts`: `TEST_INVITE_TOKEN` is valid; `''`, `'abc'` (short), 65 characters, `'../x'`, `'a%2Fb'`, `'a.b'`, space are invalid.
- `useJoinInviteLink`/`useFriendInviteLink` tests: invalid token → API not called, navigate to the dashboard.
- `src/helpers/telemetry.test.ts`: `https://chipin.one/api/groups/invite/AbC…?x=1` → `https://chipin.one/api/groups/invite/:inviteToken`; the existing cases stay green. `initializeSentry` test: a breadcrumb with a token in `message` and in an arbitrary `data` key, an event with a token in `extra` and `tags` — are sanitized.
- `vercel.config.test.js`: new CSP/Permissions-Policy assertions.
- `src/helpers/localStorage.test.ts` + `authStore` test: after `signOut()`/`expireSession()` there is no `role` in the `LS_KEY_USER` value, `settings` are preserved; `selectIsUserAdmin` on a fresh store = `false`. (Spec 03, PR 03-7b, keeps this behavior: on expiry only `role` is deleted.)

01-2:
- RTL tests `GroupJoinPage.test.tsx`, `FriendJoinPage.test.tsx`: on mount the API is not called; the primary button is not focused after mount, Enter right after mount does not call the API; clicking "Join" → exactly one call; a repeated click during `joining` does not produce a second; "Cancel" → navigate to the dashboard without a call; an invalid token → the `invalid` screen; API reject 404 → `invalid`; reject 409/network → `error`, "Retry" → exactly one new call; a response after unmount / session change does not navigate; an unauthenticated user with `signed_out` → landing, with `expired` → AuthModal, then `ready`.
- 01-2 updates `inviteTraversal.integration.test.tsx` from 01-1: instead of the `inviteJoinError` toast, the `invalid` screen is expected (the adapter is still not called).
- i18n parity: a local 01-2 test — the `join.*` keys exist in all 5 locales of `group.json`/`friends.json`. The general parity test of all namespaces is PR 04-2c (the only owner).

01-3:
- `src/helpers/numbers.test.ts`: `roundHalfUp(1.005, 2) === 1.01`, `(2.675, 2) === 2.68`, `(-1.005, 2) === -1.01`, `(10/3, 2) === 3.33`.
- `src/store/expenseModalSelectors.test.ts`: EQUAL `3.015 / 1` → `3.02` (the old code gave `3.01`); PERCENT 50% of `2.01` → `1.01`; the +/- step in AMOUNTS (`expenseModalStore`) from `1.004` → `1.00`, `.toFixed(2)`.
- `src/helpers/currencies.test.ts`: `getBalanceDirection` for `1`, `-1`, `0`, `-0`, `5.5e-17`, `0.00004` → `owed`, `owe`, `settled`, `settled`, `settled`, `settled`.
- `CurrencyGroupCard.test.tsx`: `netBalance: 0` → the text `balances.settledUp`, not `balances.youAreOwed`; `getFriendsView` with balances `+5` and `-5` of one currency → `netBalance === 0`.
- Snapshot before/after for `selectDashboardSummary`, `selectGroupBalances`, settlement-options on the current fixtures — for non-zero values the output does not change.
- `PublicLocaleRoute.test.tsx`: a logged-in user (`savedLanguage='ru'`) on `locale='en'`; an external `i18n.changeLanguage('ru')` (imitating `useSyncUserSettings`) → within `waitFor` the children render, `i18n.resolvedLanguage === 'en'`; unmount → language `ru`, `documentElement.lang === 'ru'`; changing the `locale` prop `en → es` without unmount → `es`, without an intermediate switch to `ru`.
- All: `npm run lint`, `npm run test:run`, `npm run build` are green.

## Backend requirements

Create 3 issues in `chipin-backend` (Type, Priority, assignee, Project 5 — at creation):

- **BE-01-1 (P1) OAuth: bind the code to the browser (PKCE).** `/auth/login/google` accepts `code_challenge` (S256) and stores it together with the one-time code; `/auth/oauth/exchange` requires `code_verifier`, otherwise 400. An alternative is a short-lived `__Host-chipin_oauth_tx` cookie (HttpOnly, SameSite=Lax, 10 min) checked on exchange. Context: `OAuthTokenExchangeService.kt:44-75` accepts only `code` (`04-security.md` F3). The FE part is a separate FE issue (#540) after BE-01-1. The cookie variant is preferred: an installed iOS PWA (standalone) may return the OAuth redirect in a different browsing context, and the verifier from `sessionStorage` would be lost; sign-in goes same-origin through `/api` (`src/constants/env.ts:3`), so a `__Host-` cookie works. If PKCE is chosen — the acceptance of #540 includes checking sign-in from iOS standalone.
- **BE-01-2 (P3) Reject encoded dot-segments/slashes in path parameters.** A global interceptor/plugin: if the raw path contains `%2F`, `%2E%2E`, `%5C` (case-insensitive) — 400. Integration tests: `POST /groups/invite/..%2Fx%2Fkick` → 400, not routed. State explicitly in the issue: a literal `..` is normalized by the browser, this is protection only against encoded variants and non-browser clients. Record in the issue the result of the preview-check from 01-1 (whether Vercel decodes `%2F` on rewrite): if it decodes, a backend check of the raw `%2F` path is useless for traffic through the proxy, and protection rests on the FE allowlist + `asValidUuid`.
- **BE-01-3 (P2) Invite token validation + preview endpoint.** (a) `POST /groups/invite/{inviteToken}` and `POST /users/invite/{inviteToken}`: `inviteToken` is checked against `^[A-Za-z0-9_-]{16,64}$` before touching the DB, otherwise 400 with code `INVALID_INVITE_TOKEN`; (b) `GET /groups/invite/{inviteToken}` (requires auth, rate-limited) → `{ groupId, name, coverUrl, memberCount, isAlreadyMember }` without the member list; 404 for an unknown token. Describe it in OpenAPI (`GroupOpenApi`).

## Open questions

- ASSUMPTION: the confirmation screen is added for `/friends/join/:inviteToken` too (D1/F4 mention only the group, but the mechanism is the same — an auto-POST via the link).
- ASSUMPTION: the token length is `16..64`, not strictly 32 — so that changing the generator on the backend does not break links.
- ASSUMPTION: the zero threshold is 4 decimal places (`normalizeApiMoneyAmount`), not the display precision.
- ASSUMPTION: the es/pt-BR/pt-PT texts for the confirmation screen are machine translation, owner review.
- ASSUMPTION (checked by the 01-1 preview-check): Vercel may decode `%2F` in `:path*`; the fix does not depend on it (allowlist).
- The question "does Ktor normalize `..`" for F1 is withdrawn: the browser normalizes a literal `..` before sending; only BE-01-2 remains for the encoded variants.
