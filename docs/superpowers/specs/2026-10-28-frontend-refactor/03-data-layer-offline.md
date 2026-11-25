# Spec 03 — Data layer: TanStack Query, offline outbox, money, OpenAPI types

Implements decisions D2, D3, D4, D5 (its conflict UI is superseded by D28), D21 (replaces D10), D19 (the outbox part), D28 (409 = toast +
draft), D29 (tab coordination through Web Locks only) (and D12 for the stores part) from `specs/DECISIONS.md`.
Paths below are relative to `src/` of the current `chipin-frontend` repository; after the monorepo move (D7)
the prefix becomes `apps/app/src/`. The target folders `shared/`, `entities/`, `features/` come from
`01-architecture.md` §8.

PR identifiers are `03-<n>`, backend issues are `BE-03-<n>` (global scheme, `00-overview.md`).

D10 withdrawn → D21: the backend is the source of truth, and the wire carries a JSON number of scale 4 **forever** (there are no strings on the wire,
and no backend issue for strings is created). The wire boundary has two layers, each with one job (revision C1-03/C1-11/C2-06/C3-14):
- **transport** `shared/api/wireJson.ts` (only inside the `api()` wrapper): the response body is parsed from **text** without
  double (`lossless-json` + the field registry §4.3); a money field becomes an opaque `WireAmount`, and the outgoing body is written by the same
  module as a decimal literal. The transport does not interpret amounts and does not convert them to `Money`;
- **conversion** `WireAmount` ↔ `Money` — **only** in the mappers `entities/*/model/toX()` / `toXWire()`
  (`moneyFromWire`/`moneyToWire`, lint §4.3).
This is the interpretation of D21 "at the API boundary (generated types + wrapper)": wrapper = lossless transport, conversion = mappers;
it is listed among the owner confirmations in 00 (together with the deviations from D3 `networkMode: 'always'` §2.1 and D4 buster instead of zod
for the cache §1.4). The domain is `Money { minor: bigint /* scale 4 */, currency }`, there is no float arithmetic. Clarifications: (1) the "integer
units" of D21 are ledger units of scale 4, like the backend (`ShareDistribution.kt`); currency minor units are only for
display/input. (2) The `money/` module lives at `src/shared/money/`. (3) D5 `version`/409 —
the backend does not have this yet; offline writing is enabled by a flag only after BE-03-1/BE-03-2 (PR 03-17) **and** when
the backend runtime capabilities are present (§2.7).

Revision 2026-10-28 per review B (`review-B-data.md`): B1–B3, M1–M14, m1–m11 — see the Resolution column there.
Revision 2026-10-28 per review C1/C2/C3 (`review-C1.md`, `-C2.md`, `-C3.md`, Resolution column): money without double
(§4.1, Node-sweep proof), outbox — restore guard, cancellation, `seq`, tab coordination (now D29 Web Locks), account binding (§2),
the "exit reason → what is deleted" table (§1.5), settlement online only (§2.9), the exact backend contract (§7),
PR split: 03-4a/b, 03-7a/b, 03-15a/b/c, 03-16a/b.

Dependencies on other specs:
- spec 01 (hotfix D1: dedupe `roundMoney`, sign of zero balance — PR 01-3) is merged before PR 03-1;
- spec 04 (D6: data router, guards) uses `queryOptions` from this spec; prefetch loaders (former PR 04-2e)
  are withdrawn by D31, guard loaders appear only after PR 03-5; the "Update required" screen and the SW are PR 04-2d;
- spec 01 (PR 01-1 `clearLocalUserRole`, D16 "role from localStorage") — in PR 03-7b it is absorbed by the
  `clearUserData()` function from this spec (it keeps only `settings`, as 01-1 requires);
- spec 02: removal of `dexie` — PR 02-B1; ban on new `useConnect.ts` — PR 02-C12; the helper
  `restrictedSyntax()`/`restrictedImports()` and `config/eslint/project.js` — PR 02-C4.
- Monorepo (04-0): 03-1…03-4b can be done before or after 04-0; 03-5 onwards is recommended after 04-0
  (the new folders `src/app`, `src/shared`, `src/entities` are created directly in `apps/app/src/`).
- This spec is the **sole owner** of the removal of `useConnect` (D12) — in the PR that migrates its own store, leftovers in 03-18 (done: no `useConnect` hook is left in `src/`).
  Lazy loading of locales (04-2c), SW registration (04-2d), the vendor regex (02-B1) — not here.

---

## Goal

1. One predictable way to work with server data: TanStack Query instead of 11 hand-written
   zustand stores with loading/error bags and `createRequestChannel`.
2. Offline PWA: reading cached data without a network; creating/changing/deleting expenses offline through a
   queue (outbox) that is sent in order when the network is restored.
3. Money without float: a single `money/` module, number ↔ `bigint` conversion at the boundary, integer units inside, the remainder rule
   matches the backend.
4. API types are generated from the backend OpenAPI, and CI catches drift.

## Context (audit)

- 11 stores, a manual cache, no staleness/refetch: `02-routing-state-pwa.md:15`, `01-architecture.md:111-130`;
  flag bags `loadingStore.ts`/`errorsStore.ts` (`01-architecture.md:118-121`); `resourceRequests.ts` (:79-80).
- Cycles `groupsStore.ts:18` ↔ `activity-store/actions.ts:14`, `expenseModalStore.ts:16` ↔ `expenseModalSelectors.ts` (:63-64).
- `authStore.ts:46-53` resets 6 stores, and session expiry loses the draft (`02-routing-state-pwa.md:22`).
- Offline = "backend unavailable" over the whole screen: `02-routing-state-pwa.md:16`, `helpers/errors.ts:127-139`,
  `api/chipin.interceptors.ts:75-91`.
- Money: `roundMoney` in `expenseModalStore.ts:161`, `expenseModalSelectors.ts:14`; 6 copies of the sign split,
  `CurrencyGroupCard.tsx:13` with `>= 0` (`01-architecture.md:86-101`). Types are hand-written (`api/chipin.raw.types.ts`, :141-149).
- axios: `api/chipin.interceptors.ts` (223 lines), `onUploadProgress` in `api/usersApi.ts:45`, `api/groupsApi.ts:46`.

Verified in the backend (`chipin-backend`, `develop`, read-only):
- Amounts on the wire are **JSON numbers**, not strings: `BigDecimalJsonNumberSerializer` writes a literal of scale 4
  (`85.5000`) and **rejects a string** on input (`common/serialization/BigDecimalJsonNumberSerializer.kt`).
- DB `decimal(19,4)` (`ledger/models/database/LedgerDbObjects.kt:26`). Shares: integer units of scale 4 for all
  currencies, largest remainder, ties broken by participant order (`ledger/shares/ShareDistribution.kt:9-60`).
- There is no `version`/409/`If-Match`; there are only `createdAt`/`updatedAt` in **Unix seconds** (expense, entry, group).
  The ledger is event-sourced: `expense_events` (`CREATED|CORRECTED|REVERSED`, `seq`) — `LedgerDbObjects.kt:13-36`.
- `POST /ledger/entries` does not accept an id (`LedgerCrudRequests.kt:17-22`), and an unknown body field → **400**
  (`ignoreUnknownKeys = false`: `SerializationPlugin.kt:8-9`, `OpenApiSchemaOverrides.kt:73-76`). `DELETE` of a deleted entry → already 204
  (`LedgerEntryCommandService.kt:182`), `PATCH` of a deleted entry → 404.
- A transient transaction race (serialization failure/deadlock after Exposed retries) → **409 `SYSTEM.CONFLICT`**,
  the client should simply repeat the request (`ExceptionHandlingPlugin.kt:59-70`). The error body is only
  `ErrorResponse { code, details?: Map<String,String> }` (`common/dto/ErrorResponse.kt:30-42`), an entity cannot be passed in it.
- `GET /health` (public, exists on prod) → `{ status: "UP" }` (`features/health/HealthRoutes.kt`).
- OpenAPI 3.1 runtime only, `/swagger/documentation.yaml` is behind Basic auth, disabled on prod; a snapshot in the
  backend is forbidden (`docs/openapi.md`).
- Access 1 h, refresh 30 days (`resources/application.yaml:16,18`). CORS (develop): only `Content-Type`, `Authorization`
  (`plugins/CORSPlugin.kt:21-23,37-41`); irrelevant for the FE — requests go same-origin through the Vercel proxy `/api`.
  There is no client version header.

## Decision

1. TanStack Query v5, `networkMode: 'offlineFirst'`; cache in IndexedDB (`idb-keyval`), keyed by `userId`, buster = spec hash.
2. Outbox = paused mutations with `mutationDefaults`, sent one at a time in `seq` order skipping blocked entries (D29), but
   **persisted separately** from the query cache (its own IDB key, a zod schema), so that a buster change does not wipe unsent operations.
3. Conflicts — `version` + `If-Match` + 409 with the current entity (the backend adds this); the UI is a toast + a draft (D28).
4. The offline balance is **not recalculated**; the server balance is shown with the mark "excluding unsent operations".
5. HTTP stays on **axios** + `openapi-typescript` types + a thin typed wrapper with a lossless-JSON transport (money without double, §4.1).
6. `shared/money/`: `Money { minor: bigint; currency }` (scale 4), arithmetic in `bigint` (like the backend),
   rounding to currency minor units only for display.

---

## Details

### 1. Query layer

#### 1.1 Dependencies

Add: `@tanstack/react-query`, `@tanstack/react-query-persist-client`,
`@tanstack/query-async-storage-persister` (all TanStack — one exact version, `5.105.0`), `idb-keyval` (`6.3.0`, `update()` is needed —
an atomic read-modify-write in a single IDB transaction, §2.3), `lossless-json` (exactly `4.3.3`, MIT, §4.1), `zod`;
dev: `@tanstack/eslint-plugin-query`, `@tanstack/react-query-devtools` (dev build only), `msw` (exactly `2.15.0`: `latest`
on npm is `3.0.3` with a different API, the §8 tests are written for v2 `setupServer`), `fake-indexeddb`, `openapi-typescript`.
`dexie`, `dexie-react-hooks` are removed in PR 02-B1 (not in this spec; they are not used in `src/`).

#### 1.2 QueryClient

File `shared/api/queryClient.ts`, factory `createQueryClient()` (a new client for each user, see 1.5).

```ts
export const PERSIST_MAX_AGE = 14 * DAY;
export const createQueryClient = (): QueryClient => {
  const client = new QueryClient({ defaultOptions: {
    queries: { networkMode: 'offlineFirst', staleTime: 30_000, gcTime: PERSIST_MAX_AGE, // gcTime >= maxAge
               retry: queryRetry, refetchOnWindowFocus: true, refetchOnReconnect: true },
    mutations: { networkMode: 'offlineFirst', retry: false } } });
  registerMutationDefaults(client); // before hydrate, see 2.1
  return client;
};
```

`queryRetry(failureCount, error)`: network error (`isNetworkError`: a sent request without an HTTP response; a cancellation or an Axios
setup error that never sent one, such as `ERR_BAD_OPTION` or `ERR_INVALID_URL`, is not one) → `!isNetworkUsable() || failureCount < 3` (in v5 `offlineFirst` pauses
**only between retries**: after a failed first attempt the retryer sees offline and holds the query as
`fetchStatus: 'paused'`, `status` stays `success` with the cache; with `retry: false` the query would go to `error`; while
`onlineManager` is still online — no more than 3 attempts, otherwise `isFetching` does not finish until the probe, C1-31); 5xx and 409
`SYSTEM.CONFLICT` → `failureCount < 2` (default TanStack backoff); other 4xx → `false`.

Rules that follow from this (checked by review and by the §8 test):
- Components render `data` if it exists; they show an error **only** when `data === undefined`
  (the pattern `const { data, error } = useXQuery(); if (data) … else if (error) …`). `isError` without a `data` check is forbidden.
- Loaders (spec 04): `restoreReady.then(…)` (§1.6; `await`/`.then` style is free, D24), inside it
  `void queryClient.prefetchQuery(opts)` — does not block. Returning `queryClient.ensureQueryData(opts)` from the chain
  is allowed only if `isNetworkUsable()` (§1.7) **and** `queryClient.getQueryData(opts.queryKey) === undefined`;
  otherwise — `getQueryData` + prefetch. Reason: waiting for a paused query (offline) hangs navigation until reconnect.

staleTime per entity (set in the entity's `queryOptions`, not in components):

| Entity | queryKey | staleTime | Persist |
|---|---|---|---|
| self user | `['users','self']` | 5 min | yes |
| known users (friends) | `['users','known']` | 60 s | yes |
| premium promo | `['users','premiumPromo']` | 10 min | no |
| dashboard (balances) | `['dashboard','balances']` | 30 s | yes |
| groups list | `['groups','list']` | 60 s | yes |
| group detail (+ group balances) | `['groups','detail',id]` | 30 s | yes |
| group activity previews | `['groups','activity',id]` (infinite) | 30 s | yes, first page only |
| self activities / previews | `['activity','self',filters]` (infinite; `filters = { view: 'previews' \| 'events' }`, §6 row 5) | 30 s | yes, first page only |
| activity children | `['activity','children',parentId]` | 60 s | yes |
| ledger entry | `['ledger','entry',id]` | 30 s | yes |
| currency rates | `['currencyRates']` | 6 h (the backend updates every 12 h) | yes |
| landing stats | `['stats']` | 10 min | no (public, goes to Astro per D8) |
| health | not a query | — | no |

Infinite queries: when persisted they are trimmed to the first page (`pages.slice(0,1)`, `pageParams.slice(0,1)`), otherwise the
cache grows without bound. `dehydrateOptions` has no data transformation hook, so the trimming is in the persister wrapper:
`trimmingPersister(base)` = `{ ...base, persistClient: c => base.persistClient(trimInfinitePages(c)) }`
(`shared/offline/queryPersister.ts`; `trimInfinitePages` recognizes an infinite query by the shape `{ pages, pageParams }`).

#### 1.3 Key factory

Convention: each entity has a file `entities/<entity>/api/queries.ts`. It exports a keys object and
`…QueryOptions` functions. Components and loaders do not write key arrays by hand. This is enforced by lint:
`no-restricted-syntax` on a literal array in the `queryKey` property (also a conditional with a literal branch) outside `entities/*/api/queries.ts`.

```ts
// entities/group/api/queries.ts
export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  detail: (groupId: string) => [...groupKeys.all, 'detail', groupId] as const,
  activity: (groupId: string) => [...groupKeys.all, 'activity', groupId] as const,
};
export const groupDetailQueryOptions = (groupId: string) => queryOptions({
  queryKey: groupKeys.detail(groupId), staleTime: 30_000,
  queryFn: ({ signal }) => api('get', '/groups/{groupId}', { params: { groupId }, signal }).then(toGroup) });
```

Rules: the first key element is the entity in the plural (`groups`, `users`, `ledger`, `activity`, `dashboard`,
`currencyRates`, `stats`), entity invalidation = `invalidateQueries({ queryKey: groupKeys.all })`; `queryFn`
returns the **domain model** (mapper `toGroup` in `entities/<e>/model/`, money is already `Money`); the
`useGroupQuery` hook is in the same file; derived values go through `select`, not zustand selectors; ESLint
`plugin:@tanstack/query/recommended`.

#### 1.4 Query cache persister

File `shared/offline/queryPersister.ts`.

```ts
export const queryCacheKey = (userId: string) => `chipin:rq:${userId}`;
const idbStringStorage: AsyncStorage<string> = { getItem: get, setItem: set, removeItem: del };  // idb-keyval, values are strings
export const persistOptions = (userId: string) => ({
  persister: trimmingPersister(createAsyncStoragePersister({ key: queryCacheKey(userId), throttleTime: 1000,
    storage: idbStringStorage,
    serialize: persistCodec.stringify,          // JSON + bigint tag: Money.minor survives the write (C1-05)
    deserialize: persistCodec.parse,
    retry: ({ error }) => { reportPersistFailed(error); return undefined; } })),   // otherwise a write error is swallowed
  maxAge: PERSIST_MAX_AGE,
  buster: `${QUERY_CACHE_EPOCH}:${MODEL_SHAPE_HASH}`,
  dehydrateOptions: { shouldDehydrateQuery: q => (q.state.status === 'success'
                          || (q.state.status === 'error' && q.state.data !== undefined && !isDataRejected(q.state.error)))
                        && q.meta?.persist !== false
                        && !isEntryWithPendingOp(q.queryKey),     // an optimistic entry is not persisted (2.2)
                      shouldDehydrateMutation: () => false },   // mutations are persisted by the outbox (2.3)
});
```

An entry that kept its data after a failed refetch or next page (a network error, a 5xx, a timeout, any 4xx but 401/403/404/410) is
persisted as its last success: `trimmingPersister` rewrites its copy to `status: 'success'`, keeping `data`, `dataUpdatedAt`
and `isInvalidated` (`dehydrateOptions` has no data hook, and `hydrate` restores the state as dehydrated, checked on
`5.107`: an `error` would come back as an error and block an offline reload, #646). Every persisted copy, a success too,
is written with `error`/`fetchFailureReason`/`fetchMeta: null` and `fetchFailureCount: 0`: a success with a failed attempt
waiting to retry keeps its `fetchFailureReason`, and an `AxiosError` serializes its request config (the `Authorization`
header), so no error object ever reaches IndexedDB. An `ApiError` 401/403/404/410 is not persisted: the server rejected
the data (a group detail 403/404 wins over the cache, §6 row 4).

Verified against the `5.105.0` sources (C1-05): `createAsyncStoragePersister` accepts only `storage: AsyncStorage<string>`,
`serialize: (c) => MaybePromise<string>` (default `JSON.stringify`, which throws on `BigInt`)
(`query-async-storage-persister/src/index.ts`); a `serialize`/`setItem` error is caught inside `trySave` and without `retry`
is silently lost. Therefore:
- `persistCodec` (`shared/offline/persistCodec.ts`): `stringify(c) = JSON.stringify(c, (_, v) => typeof v === 'bigint' ?
  { $bigint: v.toString() } : v)`, `parse(s) = JSON.parse(s, (_, v) => isBigintTag(v) ? BigInt(v.$bigint) : v)`;
  `isBigintTag` = an object with exactly one key `$bigint` and a string `^-?\d+$`. `WireAmount` (a plain object, §4.1) passes through
  without tags. There is no collision: domain fields are camelCase without `$`. Test: `Money { minor: 9999999999999999999n }` → persist → restore → `typeof minor === 'bigint'`,
  same value.
- On a restore/deserialize error `persistQueryClientRestore` **itself deletes the cache key and throws**
  (`query-persist-client-core/src/persist.ts:125-160`) — acceptable for the cache (the server is the source), the §1.6 wrapper catches it.
  The outbox is never restored by this function (§2.3).

- `persistOptions(userId)` and `clientFor(userId)` are memoized by `userId` (`useMemo` in `QueryProvider` / a module-level `Map`):
  a new persister object on every render = a repeated restore.
- `isEntryWithPendingOp(key)`: key `['ledger','entry',id]` and `id` is in `outboxState.entryIds` (derived, not
  persisted: the `entryId`s of `ops`, failed ops and conflict drafts, §2.3). After
  `restoreOutbox` all `entryId`s from the outbox are invalidated — the persisted cache and the outbox are written independently, after a crash
  they may diverge, the server is the arbiter. Until 03-15a (no outbox yet) 03-7a exports a stub
  `isEntryWithPendingOp = () => false` from the same path; 03-15a changes the implementation, not the path (C2-08).

- Buster — the **single** definition (C2-07, C3-14, C3-30): `${QUERY_CACHE_EPOCH}:${MODEL_SHAPE_HASH}`. What is persisted is
  the domain model (the result of the mappers), so the buster depends on its shape, not on the OpenAPI spec:
  `MODEL_SHAPE_HASH` is written by `scripts/offline/write-model-hash.mjs` (called from `api:gen`, drift is caught by `api:check`):
  the first 12 hex of sha256 over `entities/*/model/types.ts` plus every type declaration reachable from them (imports, barrels,
  `typeof`; resolved by the TypeScript checker, without function bodies and initializers of annotated values, the default lib and npm
  packages; a reached type inferred from a value fails: annotate it) (paths sorted, each file
  and declaration re-printed with the TypeScript printer with `removeComments: true` — comments and formatting do not change the
  hash) → `shared/offline/modelHash.generated.ts`.
  The data type of every persisted query is declared in, or reachable from, its slice's `model/types.ts`; a type declared
  elsewhere (for example next to its mapper) is outside the hash.
  A change in the shape of a domain type resets the cache automatically (nothing to bump by hand); an OpenAPI sync without a change to
  domain types does not reset the cache. `QUERY_CACHE_EPOCH` (`shared/offline/constants.ts`, an integer) is bumped by hand
  only when the **meaning** of a field changes without a type change (for example seconds → ms; a checklist item of the PR touching
  `entities/*/model/to*.ts`). `OPENAPI_SPEC_HASH`/`specHash.ts` do not exist. The deviation from D4 ("zod on the IDB cache")
  is listed among the owner confirmations (00).
- `meta: { persist: false }` — premium promo, stats. IDB error (Safari private, quota) → Sentry
  `offline.persist_failed` once per session, work continues without persistence.

#### 1.5 Binding to the user, logout, account switch

- `LocalUser` (`helpers/localStorage.ts`) gets `id: string`, read through a typed hand-written reader
  (not zod: it is on the landing path, §5.7; per-field fallback, a broken record → absent): `userId` is needed before restore, and offline `users/self` cannot be loaded.
- `app/providers/UserQueryProvider.tsx`: no `userId` → `QueryClientProvider` without persistence; with one →
  `<QueryClientProvider key={userId} client={clientFor(userId)}>`, and restore/subscribe with `persistOptions(userId)` happen outside
  React before the router is created (§1.6, `bootstrapUserCache`). Two users never share one `QueryClient`.
  `userId` is set only while the session hint is true (`usePersistedUserId`, re-read on every auth transition):
  after an expiry or a sign-out the app runs on the anonymous client; the user's client stays in memory and its
  cache in IndexedDB (deleted only by `clearUserData`, 03-7b).
  `onRestored` resolves `restoreReady` (§1.6). Every tab reads the outbox key for the overlay; the outbox mutations are
  adopted and started **only by the tab holding the drain lock** (§2.3): `restoreOutbox(client, userId).then(() =>
  client.resumePausedMutations())`.
- `clearUserData(userId)` (`shared/offline/clearUserData.ts`), strictly in this order: (1) unsubscribe the persister
  (unsubscribe from `persistQueryClientSubscribe`/the provider) and the outbox `BroadcastChannel` listener, release the
  drain lock and stop requesting it (§2.3); (2) `queryClient.clear()`; (2a) `resetAuthScopedStores()` — all still-living legacy zustand stores
  **and** the draft `expenseModalStore.reset()` (C1-02: otherwise between 03-7b and 03-12 Y would see X's groups/balances/friends from
  `groupsStore`/`users-store`/`dashboardStore` and send X's draft); (3) `del` the query key, `chipin:outbox:<userId>`,
  `chipin:outbox-failed:<userId>` (the two outbox keys under the write lock, §2.3); (4) unmount the provider (change `key`).
  Otherwise a throttled query-cache write (1 s) or an outbox write after `del` brings back X's data. In `LS_KEY_USER` only
  `{ settings }` remains (no `id`/`role` — like `clearLocalUserRole` from 01-1: the landing language/theme after logout are read from `settings`).
- `resetAuthScopedStores()` (`store/authStore.ts:46-53`) **stays** until the end of the migration and is still called on
  **any** transition to `unauthenticated` (as today: `setUnauthenticated`, `expireSession`, OAuth exchange error) —
  legacy stores hold data in memory and are reloaded after sign-in. Each store-migration PR (03-8…03-12, 03-18)
  removes **its own** line from `resetAuthScopedStores` together with the store (PR test: no line, no store). The only
  change in 03-7b: the line `useExpenseModalStore.getState().reset()` moves from `resetAuthScopedStores` to step (2a) of
  `clearUserData`; the draft gets an `ownerId` field and is reset when a user ≠ `ownerId` signs in.

The "reason → what is deleted" table (C3-08; real constants `store/authConstants.ts:9-16`). `clearUserData` is called
**only** by the rows that mention it; any other reason deletes nothing user-related in IDB. Test — for each row.

| Transition (code today) | `unauthReason` | Query cache (IDB) | Outbox / failed / conflict drafts | Draft | `LS_KEY_USER` |
|---|---|---|---|---|---|
| `signOut()` in this tab (`authStore.ts:164`) | `signed_out` | `clearUserData` | delete; non-empty outbox → confirm "N unsent operations will be deleted" (N counts pending, failed and conflict drafts) | reset | `{ settings }` |
| remote logout via BroadcastChannel (`useCheckSignIn.tsx:41-52`) | `signed_out` | `clearUserData` | delete (the confirm was in the initiating tab) | reset | `{ settings }` |
| `expireSession()` (refresh 401: `authStore.ts:69,128`, `bootstrap/initializeApi.ts:6`); `logoutOtherDevices` → 401 (`authStore.ts:155`) | `expired` | keep | keep, the `auth` gate is closed | keep | delete only `role` (`clearLocalUserRole`, 01-1) |
| `invalid` (reserved, `useAuthToasts.tsx:23`) | `invalid` | keep | keep, the `auth` gate | keep | delete only `role` |
| cold start without a session hint (`useCheckSignIn.tsx:64`) | `missing` | keep (not restored without sign-in) | keep | keep | unchanged |
| refresh at startup failed with non-401 (`useCheckSignIn.tsx:89`); OAuth exchange error (`authStore.ts:100-122`, `OAuthCallbackPage.tsx:37`) | `error` / `persistence_error` | keep | keep | keep | unchanged |
| sign-in of Y when `LocalUser.id === X ≠ Y` or the token `sub` ≠ the outbox owner (§2.3) | — (after sign-in) | `clearUserData(X)` | delete; non-empty → dialog (N as in the `signOut()` row) "This device has N unsent operations of account X. Delete and sign in?"; "Cancel" → `signOut()` Y, X's data stays | reset | `{ id: Y, settings }` |
| token of Y by a refresh in another tab while X's outbox is non-empty or unreadable (03-16a part C, offline writes on) | — (stays authenticated, now Y) | X detached at once (writes blocked, client cleared and forgotten, outbox stopped in this tab); X's key deleted only if X's outbox is empty, otherwise kept | kept; X recorded in `LS_KEY_KEPT_OUTBOX_USERS`; the next sign-out or account switch counts and deletes them (a sign-in of X takes X off the list, its queue continues) | reset | `{ id: Y, settings }` |

- **Account switch by a refresh** (#641; another tab signed Y in, offline writes on or off): a refreshed token
  whose `sub` ≠ the cached user bumps `authSessionVersion` (`markAuthSessionAccountSwitched`) **before** the stores are
  reset and Y's data is reloaded, so the reload runs in the new version and every request, load and write started for X
  is stale: a late X response is rejected (`AuthRequestCancelledError(true)`), fills no store and writes no
  `LocalUser.id`. A switch is not a session end: `isAuthSessionSwitchedSince(v)` is true when every version change after
  `v` was such a switch (a session start, expiry or sign-out resets it), and the 401 retry of an X request then rejects
  it as stale instead of expiring Y's session; any other version change during the retry expires the session as before.
  A late successful response to an X mutation or outbox op after the switch is stale too: the op may stay pending, is
  counted for X (kept users) and is resent idempotently by its client UUID when X's queue runs again.
- **Session expiry ≠ logout** (finding 11, `02-routing-state-pwa.md:22`): the cache, outbox and draft are kept,
  `AuthModal` is shown, after sign-in with the same `userId` the queue continues (the `auth` gate is opened only by the
  owner check, §2.3). Legacy stores are reset (see above) and reloaded after sign-in.
- Session hint after expiry: `invalidateAuthSession()` writes hint `false` (`helpers/authSession.ts:46-55`), therefore
  **an offline cold start after session expiry is impossible** — deliberately (C3-09): after "sign out on other devices"
  a lost device does not show finances without a network; the cache and outbox remain in IDB and continue after an online sign-in with the same
  `userId`. Hiding data under `AuthModal` online — spec 04 §2.3. Distinguishing REVOKED/EXPIRED on the backend and
  `clearUserData` on REVOKED — a question for the owner (00, "Confirmations"); until decided, no backend issue is created.

#### 1.6 Hydration gate at startup

- Restore runs **before** the router is created, outside React: `shared/offline/restore.ts` exports
  `restoreReady: Promise<void>` = the restore of the **query cache** (`persistQueryClientRestore`). The promise resolves both on a
  3 s timeout and on an IDB/deserialization error (Sentry `offline.restore_timeout` / `offline.persist_failed`) — it never
  rejects. Until 03-7a (spec 04, 04-2a2) the same path exports `restoreReady = Promise.resolve()`. All guard loaders
  (spec 04; the validation-only `validateUuidParam` of 04-2a3 does not wait) return the chain `restoreReady.then(…)` (style is free, D24); the data router runs the initial loaders on `createBrowserRouter`,
  before the first render, so the React gate `useIsRestoring()` alone does not save us.
- After the timeout the cache restore is **cancelled**: flag `restoreAborted = true`, a late IDB result is ignored (does not
  `hydrate`), otherwise it would overwrite data loaded after startup.
- **The outbox is restored separately and is not part of `restoreReady`** (C3-02): each tab (§2.3) holds
  `outboxRestore: 'pending' | 'ok' | 'failed'` = the result of its own first read + validation of both outbox keys at startup
  (`readOutbox`), before it requests the drain lock; adoption (`restoreOutbox`) does not set it. There is no timeout — the restore runs to the end. Invariant: **while
  `outboxRestore !== 'ok'`, this tab never writes the key `chipin:outbox:<userId>`** (no append, no drain), and new operations take the online path (§2.1: `offlineWritesAvailable === false`, offline — `<OnlineOnly>`).
  `failed` (IDB error, the whole key fails `OutboxStateSchema`) → offline writing is off until
  restart, a non-blocking banner `offline:outboxUnavailable` "Offline saving is unavailable. Operations on the device
  are preserved — restart the app", the key is **not deleted**, Sentry `outbox.restore_failed`. Individual invalid
  operations → failed `unreadable`, and the restore is still `ok`.
- Therefore the provider is a plain `QueryClientProvider` (not `PersistQueryClientProvider`, which starts restore itself on mount): `bootstrapUserCache(userId)` = `persistQueryClientRestore` → `persistQueryClientSubscribe` (the unsubscribe is stored for `clearUserData`), `onRestored` from §1.5 is its continuation. Until `restoreReady` is resolved, the shell (header + skeleton) is rendered, not the routes (`useRestoreReady()` instead of `useIsRestoring()`).
- `restoreReady` covers only the user known at boot (`LocalUser.id` + session hint). A sign-in after boot creates
  that user's client then, and its restore runs per client (`useRestoreReady()` gates the render). Loaders (04-2a2)
  must not read that client's cache before its own restore has settled: 04-2a2 exposes the per-client readiness (the
  promise `bootstrapUserCache(userId)` already returns) and awaits it instead of `restoreReady` for a user other than
  the boot user.
- Offline cold start (PR 03-7b): `useCheckSignIn` (`hooks/useCheckSignIn.tsx:55-91`), on a network error during refresh and
  when `LocalUser.id` + session hint `=== true` are present (the hint is stored as JSON `true`/`false`, `helpers/localStorage.ts`),
  sets `AUTHENTICATED` + a new field `sessionMode = 'offline-cached'`; guards (spec 04 §2.3, `requireSession`) let the user through to
  the cache. On reconnect `refreshAuthSession()`: 401 → `expireSession()`; success → `sessionMode = 'online'`; a network
  error keeps the cached session until the next connectivity change. One reconnect refresh runs at a time (a connectivity
  flap during it starts no second one); when it fails otherwise (a request error, still online), it is retried **once**
  if the session is still offline-cached and online (#641), a second failure waits for the next change. The outbox `auth` gate
  is opened **not** by a successful refresh but by the owner check (§2.3: `sub` of the new access token === outbox `userId`).
  Until 03-15a `outboxGate` is a no-op stub from `shared/offline/outboxGate.ts` (same path); 03-15a changes its interface (global
  `close/open(reason)` + `block/unblock(entryId)` + `whenTurn(op)`, §2.4) and updates the `store`/`app` callers in the same PR.

#### 1.7 Refetch on focus/reconnect

- `focusManager` (`visibilitychange`) closes "PWA open for days with stale balances".
- **The single source of "network is usable" is TanStack `onlineManager`** (C1-06): `shared/offline/network.ts` exports
  `isNetworkUsable = () => onlineManager.isOnline()` and `waitForOnline()`. Spec 04 (the loaders' await rule, the offline branch of
  auth guards), `connectivityStore`, `useRequiresOnline()` and the outbox read only these. `navigator.onLine` is read only
  inside `shared/offline/**` (bootstrap and the probe below); lint `no-restricted-properties` `{ object: 'navigator', property:
  'onLine' }` outside `shared/offline/**` (the rule is registered in 02 §D0, class "correctness", hint "use
  isNetworkUsable()").
- `onlineManager`: v5 starts with `online = true`; at bootstrap — `onlineManager.setOnline(navigator.onLine)`, then the
  probe below (otherwise an offline cold start does not pause queries until the first `offline` event).
- Default events + a network error while `navigator.onLine === true` → `GET /health`
  (timeout 5 s); on failure → `setOnline(false)` and a check every 15 s (captive portal, "Wi-Fi without internet").

#### 1.8 Offline vs backend down

A new classification in `shared/api/errors.ts` (replaces `isLikelyBackendOutageError`):

| Situation | Classification | UI |
|---|---|---|
| `!isNetworkUsable()` or a network error + `/health` is also a network error | `offline` | banner "No network. Saved data is shown" (non-blocking), offline-only actions are allowed |
| online, response 502/503/504, `/health` answers 5xx | `backend-down` | the current `BackendUnavailablePage` |
| online, a single 500 on a specific request, `/health` = 200 | `request-error` | request error (toast / route errorElement) |
| 4xx | `client-error` | handled at the call site |

- `backendAvailabilityStore` → `connectivityStore` (zustand): `{ mode: 'online' | 'offline' | 'backend-down' }`;
  `offline` is derived from a subscription to `onlineManager` (it does not keep its own copy of the network flag).
  Interceptors no longer import the store (V5, `01-architecture.md:53`) but call the callback `onConnectivityChange`
  from `app/bootstrap`.
- `BackendUnavailableGate` — only on `backend-down`; on `offline` — `<OfflineBanner/>` in
  `InternalPageLayout`; the toast `useCheckOnlineStatus` (`hooks/pwaHooks.tsx:23-54`) is removed.

### 2. Mutations and the outbox

#### 2.1 Mutation defaults

Layers (the graph of spec 02 D5): `entities/**` and `shared/offline/**` **do not import `store`** (`entities → store` is forbidden).
`userId`, `sessionMode` and the rest from the stores are passed as an argument (`registerLedgerMutationDefaults(client)`,
`clientFor(userId)`) or as a callback from `app/bootstrap`; calls to `outboxGate.open/close` are made by `store`/`app`, not the other way around.

`entities/ledger/api/mutations.ts` → `registerLedgerMutationDefaults(client)`, called in `createQueryClient()`
**before hydrate**: otherwise restored mutations have no `mutationFn` and `resumePausedMutations` will not run them.
**All** lifecycle callbacks (`onError`, `onSuccess`, `onSettled`) live here too, in the defaults: callbacks
passed to `useMutation`/`mutate()` are lost after reload. On the online path the hooks `useCreateExpense()` etc. pass only
`mutationKey`; overriding `retry`, `mutationFn` and callbacks in the hook is forbidden. On the outbox path (D29) the hook
**does not create a mutation**: it calls `enqueueLedgerOp(op)` (the append under the write lock, §2.3, then the optimistic
write, §2.2). Outbox mutations are created in exactly one place — `adoptOutboxOps(client)` in the tab holding the drain
lock (§2.3) hydrates the persisted ops as paused mutations without a TanStack `scope` (the order is the drain turn, §2.4);
the §8 test checks `retry === false` and no `scope` on an adopted mutation.

Two sets of keys, each with its own defaults (C1-10); there is no third path:

```ts
// Outbox: expenses only (D2). Frozen contract after 03-17 (m9): keys must not be renamed.
export const ledgerOutboxMutationKeys = { createExpense: ['ledger','outbox','createExpense'],
  updateExpense: ['ledger','outbox','updateExpense'], deleteExpense: ['ledger','outbox','deleteExpense'] } as const;
// Online: any kind of write (expense and settlement), no outbox. Used when offline writing is unavailable,
// and always for settlement (C2-02).
export const ledgerOnlineMutationKeys = { createEntry: ['ledger','online','createEntry'],
  updateEntry: ['ledger','online','updateEntry'], deleteEntry: ['ledger','online','deleteEntry'] } as const;
for (const key of Object.values(ledgerOnlineMutationKeys)) client.setMutationDefaults(key, {
  mutationFn: runOnlineLedgerOp,   // api() directly; the body is the same toXWire() mappers
  networkMode: 'online', retry: false, onSettled: invalidateAfterLedgerOp });
client.setMutationDefaults(ledgerOutboxMutationKeys.createExpense, {
  mutationFn: (op: CreateExpenseOp) => runOutboxOp(op),
  // no scope: one op at a time in seq order, skipping blocked entries, is the drain turn inside runOutboxOp (2.4, D29)
  networkMode: 'always',         // waiting for network/gate is inside runOutboxOp (2.4), not in the TanStack retryer
  retry: false,                  // the only retry mechanism is the runOutboxOp loop (2.4)
  // Deviation from the letter of D3 (offlineFirst + paused): the TanStack pause fires only between retries and knows
  // nothing about the gate; the wait in runOutboxOp covers both the network and auth/426. Restore still goes through hydrate (isPaused=true)
  // + resumePausedMutations(). An owner confirmation item in 00 (C1-16a/C3-27); 03-15a does not start before it.
  onError, onSettled,            // 2.2; the optimistic write is in enqueueLedgerOp, not onMutate
  meta: { outbox: true } });
```

The path choice is one function per action; component hooks pass only its result (test both branches):
`useCreateExpense()`, `useUpdateLedgerEntry(entry)`, `useDeleteLedgerEntry(entry)` in `entities/ledger/api/mutations.ts`
take the outbox key **only if** `offlineWritesAvailable` (§2.7) **and** `entry.type === 'EXPENSE'` (for create — always
an expense); otherwise — the online key (offline its button is wrapped in `<OnlineOnly>`, §2.9).

**Operation registry — the "expenses only" guard (C2-02).** `enqueueOutboxOp(op)` (`shared/offline/outboxRegistry.ts`, any tab) is
the single entry into the outbox; `OUTBOX_OPS: Record<OutboxKind, { entryKind: 'expense' }>`. For `updateExpense`/`deleteExpense`
it requires `ledger.entry(entryId)` in the cache with `type === 'EXPENSE'`; no cache entry or another type → throw
`OnlineOnlyError` (the operation is not created, the UI shows "Connection required"). A settlement/payment cannot get into the outbox either
from the UI or from another tab's write (`adoptOutboxOps` in the drain tab repeats the check by `entryKind` and the cache). The zod `OutboxOpSchema` requires
`entryKind: 'expense'` — a persisted operation of another kind on restore → failed `unreadable`.

`variables` is a serializable `OutboxOp` (JSON primitives; amounts are `WireAmount` (a plain object `{ __wireDecimal }`, §4.1)
via `moneyToWire`):

```ts
type OutboxOpBase = { opId: string; seq: number; owner: string; entryKind: 'expense'; createdAt: number; schema: 1 };
type CreateExpenseOp = OutboxOpBase & { kind: 'createExpense'; entryId: string; groupId: string | null; draft: ExpenseDraftWire };
type UpdateExpenseOp = OutboxOpBase & { kind: 'updateExpense'; entryId: string; baseVersion: string | null; patch: ExpensePatchWire };
type DeleteExpenseOp = OutboxOpBase & { kind: 'deleteExpense'; entryId: string; baseVersion: string | null };
```

- `seq` (C2-16) — a monotonic number assigned inside the write-locked append of `enqueueOutboxOp` from the `nextSeq` counter of the
  persisted key (§2.3), so two tabs never assign the same `seq`. The queue order everywhere (sending, restore, hydrate, overlay) is
  by `seq`; `createdAt` (device clock) is used only for the 14-day `stale` (§2.8).
- `owner` = the `userId` of the outbox owner (the key name already contains it, the field pins each op); checked before every send (§2.3).

The version (an opaque string, BE-03-1) is resolved **inside the outbox**, not from the query cache:
- `baseVersion` at enqueue time = the version from the `ledger.entry(id)` cache; `null` — if the queue holds an unsent create
  of the same `entryId` (no version yet).
- `outboxVersions: Map<entryId, version>` (`OutboxState.versions` in the persisted key, §2.3, written by the drain tab in the
  same write-locked update that removes the succeeded op): after the success of any operation with an `entryId`, if operations
  with the same `entryId` remain in the queue — `set(entryId, response.version)`, otherwise `delete`. A conflict (2.6) deletes the
  entry: the user's resend is a new op with `baseVersion = current.version`.
- On send: `effective = outboxVersions.get(entryId) ?? op.baseVersion` (the map entry takes priority — it is our
  latest write). `effective === null` → GET `ledger.entry(id)`: 200 → a conflict with that `current` (2.6); 404 → failed
  `deletedRemotely` (2.5); a network/5xx error → the usual class (2.4).
  PATCH/DELETE **without** `If-Match` are never sent from the outbox.

#### 2.2 Optimistic updates and rollback

Activity is a server projection of events (`api/activity.types.ts`); faking events is fragile. Therefore
**the optimistic state is an overlay from the queue, not a write into the server caches**:
- `useOutboxOverlay()` reads `outboxState` (§2.3; in every tab — the last read of the persisted keys, re-read on the
  `changed` ping and on drain-lock acquisition; `statusByOpId` from the drain tab's `status` messages) → `{ pendingCreates,
  pendingUpdatesByEntryId, pendingDeletes, failed, conflictDrafts, statusByOpId }`.
  In the feed: a "Not sent" block on top; `entryId ∈ pendingDeletes` — struck through, "will be deleted"; a pending update —
  "changed, not sent" (the `entryId` is present in activity, `api/activity.types.ts:51,95`). Rollback is automatic:
  the mutation was sent — the overlay is recomputed.
- `['ledger','entry',id]`: `enqueueLedgerOp` (in the enqueueing tab, after the append write resolved) — `cancelQueries` +
  `setQueryData` optimistically; a snapshot is **not** used. Other tabs show the change through the overlay. `onError` (terminal errors only, 2.4) → `invalidateQueries(ledger.entry(id))`: a persisted
  snapshot after reload may be days older than the server. `onSettled` → `invalidateAfterLedgerOp(client, op)`:
  `ledger.entry(id)`, `groupKeys.detail/activity(groupId)`, `['activity']`, `['dashboard']`, `['users','known']`.
  This list replaces the fan-out of `groupsStore.ts:133-155`. The drain tab sends `settled { op, entry }` (`entry` = the
  response or `current`, absent for a cancelled/deleted result); every other tab first does `setQueryData(ledger.entry(id), entry)`
  and then the same invalidation — otherwise a tab that enqueues the next edit of the entry before its refetch lands takes a stale
  `baseVersion` and gets a false 409. After reload the optimistic write is not repeated — the overlay and the invalidation from §1.4 are enough.

#### 2.3 Outbox persistence and tabs: Web Locks, no leader (D29)

D29 replaces the former leader election, `epoch` fencing, heartbeat/`steal` and the IDB inbox: any tab writes the queue
under a short write lock, one tab at a time sends under a separate drain lock. Files `shared/offline/outboxStore.ts` (keys,
write lock), `outboxDrain.ts` (drain lock, adoption), `outboxChannel.ts` (ping).
- **One key** `chipin:outbox:<userId>` = `OutboxState { nextSeq: number, ops: OutboxOp[] /* pending, by seq */,
  versions: Record<entryId, version>, cancelled: opId[], retryRequested: opId[], sending: { opId, session } | null, conflictDrafts:
  Record<entryId, ConflictDraft> }` (zod `OutboxStateSchema`, §5.7; `ConflictDraft` — 2.6). There is no `owner`/`epoch` field: the key and
  lock names carry `userId`, and every op carries `owner` (2.1). Failed ops live in `chipin:outbox-failed:<userId>` (2.5).
  The persisted `ops` **are** the queue: no tab dehydrates its `mutationCache` into the key, and an op leaves `ops` only
  through one of the explicit writes below. Nothing is written while this tab's `outboxRestore !== 'ok'` (§1.6).
- **Write lock** `chipin-outbox-write:<userId>`. Every write to either outbox key — append, removal after success, the move
  to failed, discard, retry request, conflict draft, `versions` — is `navigator.locks.request(writeName, { signal:
  AbortSignal.timeout(5000) }, () => read → change → write)`: the lock spans the whole read-modify-write over both keys, so
  concurrent tabs never clobber each other's changes. It is held only for this IDB work, never across a network request
  or a user prompt. The move to failed writes the failed key first and then removes the op from `ops`, inside one lock
  hold (C3-05: after a crash between the two writes the op is in both, and failed takes priority on restore). Web Locks are
  not reentrant: a write-locked callback never calls another write-locked function, it composes all its changes in one
  read-modify-write (the drain lock and the write lock have different names, so the drain tab may take the write lock). A lock
  timeout or a rejected write means the change did not happen: an append fails visibly (§2.8 `offline:saveFailed`; a lock
  timeout is transient and does not turn offline writing off), a drain write is retried with backoff (`retryWrite`, 2.4).
- **Append from any tab.** `enqueueOutboxOp(op)`: under the write lock — the registry check (2.1), the limits (2.8),
  `seq = nextSeq++`, push to `ops`, write; after the write resolved — the toast "Saved, we will send it when the network is
  back", the optimistic write (2.2) and a `changed` ping. No tab waits for another tab to accept the op: once the write has
  resolved, the op is on the device. (The former `offline:saveDelayed` toast is gone: saving no longer depends on another tab.)
- **Drain lock** `chipin-outbox-drain:<userId>`. Each tab with a `userId` and `outboxRestore === 'ok'` calls
  `navigator.locks.request(drainName, () => drainSession())`; `drainSession` returns a promise that resolves on
  logout/user change, on `freeze`/`pagehide` (an in-flight request is aborted first: `sendOutboxOp` gets the drain session's `AbortSignal`), and on `visibilitychange` to hidden once no op is `sending` (if one is — after it
  settles); the tab requests the lock again on `resume`/`pageshow`/visible. On release every waiting outbox mutation of the
  tab resolves `STOPPED` without a request (2.4) and is settled, so a re-acquisition adopts its op again; `isStopped()` means
  "this tab does not hold the drain lock now", so a run still sleeping in backoff when the lock comes back simply continues. Only the tab whose callback runs creates outbox mutations and sends: on acquisition it re-reads
  the keys and runs `restoreOutbox`; on every `changed` ping it re-reads them, runs `adoptOutboxOps` for new ops and applies
  `cancelled`/`retryRequested`. The other tabs wait in the lock queue and never send. When the holder closes or crashes, the
  browser releases the lock and the next tab adopts the queue from the same key — no orphans, no handover messages. There
  is no `steal`: a holder that froze before it could release delays sending (never saving) until it is thawed or discarded —
  accepted (D29). In a tab without the drain lock, the header outbox badge shows the hint "Sending runs in another open
  ChipIn tab" while ops are pending online.
- **Ping** `BroadcastChannel('chipin-outbox:<userId>')`, zod `OutboxChannelMessageSchema` (§5.7): `changed` (after every
  write; receivers re-read both keys and recompute the overlay), `status { opId, status }` (the drain tab, not persisted),
  `status-request` (a tab that just opened; the drain tab answers with one `status` per pending op), `settled { op, entry? }` (the
  drain tab; receivers write `entry` and run `invalidateAfterLedgerOp`, §2.2). `statusByOpId[op] = 'sending'` is derived from the
  persisted claim `OutboxState.sending`, not from messages; a new drain holder clears a stale claim of a dead holder on
  acquisition and sends a `status` for every pending op, receivers replace their map. A lost message costs only freshness:
  every tab also re-reads on focus and on drain-lock acquisition, and the keys are the truth.
- **Exactly once (D29).** (1) Only the drain-lock holder sends, so an op is never in flight from two tabs at once. (2) An op
  leaves `ops` only after its response has been processed; if the holder dies mid-request, the next holder adopts the same
  op and resends it with the same identity: create with the same client `id` (BE-03-2: 200 with the existing entry, or 410 →
  success-no-op), PATCH with the same `X-Client-Op-Id: <opId>` (BE-03-1: 200 with the current entry **before** the `If-Match`
  check, no new event — a deep comparison of `current` with `patch` is not needed), DELETE of a deleted entry = 204. (3) Before
  each request the drain tab **claims** the op under the write lock (compare-and-set): the drain is not stopped (`isStopped()`
  under the lock, else `STOPPED`), the op is still in `ops` — or in failed with its `opId` in `retryRequested` (a Retry) — and
  not in `cancelled` (else `CANCELLED`), then `sending = { opId, session }` (`session` = this drain session's id); `discardOps` under the same lock refuses a claimed op ("Already sending"). So a discard never races a request:
  either it wins before the claim (0 requests) or the op is sent and processed normally. The claim is cleared — only while
  `sending` equals this run's `{ opId, session }`, so a stale holder never clears a new holder's claim — by the write that processes the response, in the `catch` of a network/transient error before the
  backoff (the retry claims again), or by `STOPPED`; a response write applies only while the op is still in `ops`/failed.
  Hence the server applies every op at most once whatever happens to the tabs, and at least once while a tab with the
  queue is open online.
- **Account binding (C3-07).** The keys and the locks contain `userId`; `adoptOutboxOps` moves an op with `owner !== userId`
  to failed `unreadable`. The `auth` gate is **closed** when a tab acquires the drain lock and is opened only when
  `sessionUserId() === userId`, where `sessionUserId()` = the `sub` of the current access token (backend: `JwtTokenService.kt:29`
  `withSubject(userId)`; decoded without verifying the signature, only for comparison). The check is repeated on every token
  refresh (interceptor callback `onAccessTokenChanged`) and synchronously **right before every** send
  (`sendOutboxOp`, against `op.owner`). A mismatch → `outboxGate.close('auth')` + the account-switch flow (§1.5); X's operations are never
  sent with Y's token (for example, Y signed in in a neighboring tab while the refresh cookie is shared).
- `restoreOutbox(client, userId)` (the drain tab, on lock acquisition; `adoptOutboxOps` repeats the same steps for ops added
  later): key → `OutboxStateSchema` → each op → zod `OutboxOpSchema` (a union by `kind`, `schema` for migrations), invalid
  ones → failed `unreadable`; skip `opId`s from `cancelled`, from the failed key (C3-05: an op in both — failed takes
  priority), those in the in-memory `pendingRemovals` (2.4) and those with a **pending** outbox mutation of the same `opId` in
  `mutationCache` (idempotent on remount/StrictMode/a repeated ping; settled ones linger until gc and do not count); **sort by
  `seq`**; `hydrate` as paused mutations (no scope, 2.4); restore `outboxVersions` (not for an entry with an op in
  `pendingRemovals`: its in-memory version is newer); clear a stale `sending` claim; for every `entryId` that has a failed op —
  `outboxGate.block(entryId)` **before** `resumePausedMutations()`. A failed op blocks only later ops of its own `entryId`
  (2.4, 2.5). The restore needs `outboxRestore === 'ok'` (§1.6) and never sets it.
- **No `navigator.locks` or `BroadcastChannel`** (old browsers): offline writing is off
  (`offlineWritesAvailable = false`), creating/editing/deleting expenses is online only, as before 03-17; reading the cache
  offline works. We do not coordinate tabs via `localStorage`/`storage` events (a check-then-act race).

#### 2.4 Order and gate

One op at a time, in global `seq` order, skipping blocked entries (D29): a failed op blocks only later ops of the same
`entryId`; ops of other entries keep draining, and a burst of 50 queued ops never goes out in parallel.
- **The drain turn** `outboxGate.whenTurn(op)` (in the drain tab's memory) grants the single send slot to the adopted
  pending op with the lowest `seq` whose `entryId` is not blocked (a failed op under "Retry" takes its turn by its own `seq`,
  ignoring its entry's block). The op keeps the turn until `runOutboxOp` settles, including network waits and backoff;
  then the next eligible op gets it. Adopted mutations have no TanStack `scope` (a scope head waiting on a blocked entry
  would hold every other entry); the order rests on one rule: **`runOutboxOp` settles only with a success, a no-op result
  or a terminal error**, everything non-terminal waits inside it holding the turn.
- **`mutationCache.remove()` on a pending outbox mutation is forbidden** (C3-04): `remove` does not stop the running
  `mutationFn` (verified in `query-core@5.105.0` `mutationCache.ts`). Cancellation is only through `cancelledOpIds` (2.5);
  settled mutations are removed by gc.
- `outboxGate` (`shared/offline/outboxGate.ts`) — **in the drain tab's memory**: global reasons `auth | outdated`
  (`close(reason)`, `open(reason)`), the per-entry set `blocked` (`block(entryId)`, `unblock(entryId)`) and `whenTurn(op, {
  ignoreEntryBlock? })`, which also waits until no global reason is closed. Persistent data (the failed key) only restores
  the blocked entries on restore; the decision "may we send" is never read from IDB.
- **Success before the write.** On a 2xx the drain tab first updates `outboxVersions` in memory and adds the `opId` to
  `pendingRemovals` (memory), releases the turn, then removes the op from the key with `retryWrite(..., { ignoreStop: true })`; this removal needs only the write lock and
  keeps retrying after the drain stops, until it succeeds or the user changes (a restore meanwhile keeps the in-memory version). Adoption skips
  `pendingRemovals`; the next op of the entry sends with the in-memory version. If the tab dies before the write, the next
  holder resends the op — idempotent (§2.3).

```ts
// Style is free (D24); here: a retry = a recursive call from .catch, not a loop.
function runOutboxOp(op: OutboxOp, opts?: { ignoreEntryBlock?: boolean }, attempt = 0): Promise<OutboxResult> {
  const retry = (): Promise<OutboxResult> => runOutboxOp(op, opts, attempt + 1);
  const noOp = (): OutboxResult | null =>            // check after every await and right before sending
    isStopped() ? STOPPED : isCancelled(op.opId) ? CANCELLED : null;
  return outboxGate.whenTurn(op, opts)                // auth / outdated / entry blocked / one op at a time
    .then(() => waitForOnline())                      // shared/offline/network.ts (§1.7)
    .then(() => {
      const skip = noOp(); if (skip) return skip;     // discard / drain released (logout, hidden, freeze): not a single request
      if (sessionUserId() !== op.owner) { outboxGate.close('auth'); return retry(); }   // C3-07
      return claimOp(op).then((noSend) => noSend ?? sendOutboxOp(op));  // §2.3 claim: null, or CANCELLED/STOPPED; 2xx and "success-no-op" rows of 2.5
    })
    .catch((error: unknown) => {                      // retry() is returned from catch — its reject does not land here
      if (isStopped()) return clearClaim(op).then(() => STOPPED);   // aborted on release: no backoff
      const c = classifyOutboxError(error);           // table 2.5
      if (c.kind === 'network' || c.kind === 'transient') {  // compare-and-clear the claim (§2.3), then back off
        setStatus(op.opId, c.kind === 'network' ? 'waiting-network' : 'server-unavailable');
        return clearClaim(op).then(() => sleep(backoff(attempt))).then(retry);
      }
      if (c.kind === 'auth' || c.kind === 'outdated') { outboxGate.close(c.kind); return retry(); }
      // the server answered for good: from here only the IDB write is repeated, never the request (no 409/422 loop)
      if (c.kind === 'conflict')                      // 2.6
        return retryWrite(op, () => recordConflict(op, c.current)).then((ok) => (ok ? CONFLICTED : STOPPED));
      outboxGate.block(op.entryId);                   // synchronously, BEFORE the write — later ops of this entry are skipped
      return retryWrite(op, () => recordFailed(op, c))  // C3-05: memory + the IDB failed key, the write is AWAITED
        .then((ok) => { if (!ok) return STOPPED; throw new OutboxTerminalError(c); });
    });
}
// a failed write: status 'failed-unsaved', Sentry, backoff; the op stays in ops (never "neither in the outbox nor in failed");
// false = the drain stopped first: the op stays in ops and the next holder resends it (idempotent, §2.3)
function retryWrite(op: OutboxOp, write: () => Promise<void>, opts: { ignoreStop?: boolean } = {}, n = 0): Promise<boolean> {
  return write().then(() => true, () => {
    setStatus(op.opId, 'failed-unsaved'); reportPersistFailed();
    const stop = () => (opts.ignoreStop ? sessionUserId() !== op.owner : isStopped());
    return sleep(backoff(n)).then(() => (stop() ? false : retryWrite(op, write, opts, n + 1)));
  });
}
const backoff = (n: number) => Math.min(1000 * 2 ** n, 60_000) * (0.8 + Math.random() * 0.4);
```

`CANCELLED`/`STOPPED` are successful results without side effects: `onSettled` in the defaults does not invalidate
the cache for them and does not touch `outboxVersions`. `STOPPED` leaves the op in `ops` (the next drain-lock holder adopts it).
`CONFLICTED` is successful too: the op left `ops` in the `recordConflict` write; `onSettled` writes `current` (2.6).

A single retry policy (replaces the former `outboxRetry`/`retry: outboxRetry`):

| Class | Responses | Behavior | UI status |
|---|---|---|---|
| `network` | network error, timeout, a request that was never sent (an Axios setup error, e.g. a bad API URL: the op stays queued, not rejected) | wait for `online`, then backoff 1 s → 60 s ±20 % (no tight loop while `onLine` lies) | "waiting for network" |
| `transient` | 5xx, 409 `SYSTEM.CONFLICT` | backoff 1 s → 60 s ±20 %, indefinitely | "server unavailable, will retry" |
| `auth` | 401 after a failed refresh (the interceptor has already called `expireSession()`); token `sub` ≠ `owner` | `auth` gate; opened only by the owner check (2.3) | "sign-in required" |
| `outdated` | 426 `CLIENT.OUTDATED` | `outdated` gate; update screen (03-20) | "app update required" |
| `conflict` | 409 `LEDGER.VERSION_CONFLICT`, unknown version with GET 200 | conflict draft (2.6), later ops of the entry folded into it, no block | — (toast) |
| terminal | 400/422, 403, 404 PATCH, unknown version with GET 404, 409 `LEDGER.ID_CONFLICT` | the `entryId` blocked, failed (write awaited), throw | failed reason |

TanStack **queries** use their own `queryRetry` policy (§1.2); outbox mutations have `retry: false`.

Deviation (03-15a): the core is in memory and wired only behind `VITE_FEATURE_OFFLINE_WRITES` (default off); files
`shared/offline/outboxGate.ts`, `outboxStore.ts` (queue, `seq`, `discardOps`, `cancelledOpIds`, `outboxVersions`,
`pendingRemovals`; every change through `writeOutbox`, the future write-locked IDB write), `outboxRegistry.ts`,
`outboxRun.ts` (`runOutboxOp`, `retryWrite`, `classifyOutboxError`, `adoptOutboxOps`, `recheckOutboxOwner`) and
`entities/ledger/api/outbox.ts` (keys, op types, send, defaults, path choice). (1) The outbox defaults are registered on
a client at its first outbox write (`registerLedgerOutboxDefaults`, once per client), not in `createQueryClient()`: there
is no hydrate yet, and with the flag off nothing of the outbox runs; resolved in 03-15b (see below). (2) The hooks
keep their signatures and stay in `hooks/useLedgerMutations.ts`: the path choice (`chooseLedgerWritePath`, the
`*ViaOutbox` functions) reads the entry type from the cached `ledger.entry(id)` instead of an `entry` argument (§2.9
C2-33 needs that cache entry anyway); a settlement is never cached as `EXPENSE`, so it always takes the online key.
(3) `offlineWritesAvailable` is the flag and the three capabilities (read from the cache, fetched when absent); the
restore, Web Locks, `BroadcastChannel` and storage conditions arrive with 03-15b/c. (4) Until 03-16b a 409
`LEDGER.VERSION_CONFLICT` (and an unknown version with GET 200) is a final error `conflict`: the op is failed and its
entry blocked, no draft. (5) Every op carries `groupId` and `parentActivityId` (what is read again on settle); the entry id of a create is
made once per submit (a repeated submit while one is being queued is refused as busy, like the online path); the
form keeps no id yet, 03-16a moves it to the form's opening (§2.7); a 404 on a create is failed `rejected`. A delete
whose unknown version GETs a 404 is a success no-op (like DELETE 404), not `deletedRemotely`.
(6) No optimistic `setQueryData` and no `setQueryData` of the 2xx entry: there is no `ledger.entry` query or mapper
yet, the settle invalidates through the hooks' `LedgerWriteEffects`. (7) `retryWrite(op, write, shouldStop)` takes the
stop predicate instead of `{ ignoreStop }`; adoption continues each mutation it builds instead of calling
`resumePausedMutations()` (no unrelated paused mutation is resumed). (8) The gate also has `adopt` (an adopted op
keeps its place in the turn before its run reaches the gate), `releaseTurn`, `wake` (a discard), `reset` (a stop) and
the `whenTurn` option `isSkipped`; a wait for the network or a backoff ends early on a discard or a stop.
(9) `recheckOutboxOwner(sub)` opens the `auth` gate; calling it on a token refresh is the 03-15b `auth` gate wiring (done, see below).
The C3-07 check is bound to the token actually attached: every outbox request carries `expectedTokenSubject: owner`,
and the request interceptor rejects a mismatch with `AuthRequestCancelledError` before sending (no session expiry),
classified `auth` like any interceptor cancel (§2.5 row 401: pending, not failed). A run of a previous owner (account
switch in the tab) resolves `stopped` without touching the new owner's queue or gate. Only a Retry or a discard
unblocks an entry; a sent op waiting for its removal write is refused by `discardOps` and is no pending create.
(10) Classification beyond the §2.5 table: 429, a 2xx with a non-JSON body and a cancelled request are `transient`;
410 is a no-op only with `LEDGER.ENTRY_DELETED`, a 409 or 410 with another code is `rejected`.
(11) Open items with their rows: the `ledger.entry(id)` query (key factory in `entities/ledger`, `toLedgerEntry`,
the optimistic write and the 2xx `setQueryData` of §2.2/§2.5) is owned by 03-16a; until it lands nothing fills that
cache, so an outbox edit or delete is unreachable in the app and only a create can take the outbox path. 03-15b:
`FailedOpSchema` keeps the reason `conflict` readable and 03-16b turns such records into conflict drafts on restore.
03-16a decides whether settle-up refuses a group with queued expenses or shows the "excluding unsent operations"
caption (the settle-up busy guard does not see outbox ops). An adopted op whose mutation fails before its run starts
releases its turn (`adoptOutboxOps`), so it cannot stall later ops. `VITE_FEATURE_OFFLINE_WRITES` stays unset in every
deploy, previews included, until at least 03-15b (the in-memory queue is lost on reload).
(12) From the R2 review, for 03-15c: a 2xx that arrives after `stopOutbox()` of the same owner resolves `stopped` and
the next drain resends the op (idempotent), unlike §2.4 "the removal keeps retrying after the drain stops"; 03-15c
processes a same-owner 2xx normally and returns `stopped` only after an owner change. `stopOutbox` clears both
cancelled sets; 03-15c clears cancellations per run (`forgetCancelled`) instead. The send claim is released only by
its own run (`releaseOutboxClaim(opId)`), so a stale run never clears a newer run's claim. The outbox owner's user id
travels on the Axios request config (`chipinExpectedTokenSubject`); Sentry does not serialize `error.config`
(`initializeSentry` has no extra-error-data integration, `sendDefaultPii: false`, and no outbox error is captured),
and the field cannot be stripped in the response-error path because the 401 retry reuses the config.

Deviation (03-15b): the queue is persisted, still one tab (no Web Locks, no `BroadcastChannel`, no drain lock: 03-15c).
(1) Resolves 03-15a (1): `clientFor(userId)` runs `runUserClientSetup` (`userCaches.ts`), wired by
`bootstrap/outboxWiring.ts`, which loads the outbox only with the flag on and calls `startLedgerOutbox` =
`registerLedgerOutboxDefaults` (once per client) and then `restoreOutbox(client, userId, adoption)` (`outboxRun.ts`);
the register-on-first-write path is gone. Not literally in `createQueryClient()` (it cannot import the ledger entity
or the hooks' effects), but always before the hydrate. Every tab with a user client restores and drains (no drain lock);
adoption keeps continuing each mutation it builds (03-15a (7)). (2) Files: `outboxIo.ts` (`runOutboxIo`, the in-tab IO
chain that 03-15c wraps in the write lock; `stopOutboxIo`/`deleteOutboxKeys` for `clearUserData`), `outboxSchema.ts`
(`OutboxStateSchema`, `OutboxOpBaseSchema`, `FailedOpSchema`); no `outboxDrain.ts`/`outboxChannel.ts` yet.
(3) `OutboxState` has every field; `retryRequested` and `conflictDrafts` are kept as read and never written by 03-15b
(03-15c/03-16b), `sending` stays `null` (the claim is in memory) and a restore clears a stale one. Only `nextSeq`,
`ops` and `cancelled` are strict; a bad `versions` value is dropped per entry (the op then uses its base version or
the GET of §2.1), a bad `sending` or `retryRequested` is reset, `conflictDrafts` is kept as read (Sentry
`outbox.invalid_field`, the restore stays `ok`). Unknown top-level keys (a newer build) are kept and written back. (4) `OutboxOpSchema`
is split: `OutboxOpBaseSchema` (the base fields, `entryKind: 'expense'`, `schema: 1`, the kind) on every read, an
op invalid there → failed `unreadable` with the restore still `ok`; the ledger union by `kind` (`LedgerOutboxOpSchema`) on
adoption. `draft`/`patch` are checked as objects only (built by our mappers, validated by the server: 400 → failed
`validation`), like the query cache envelope. (5) The failed key is a list of `{ op, reason, failedAt }`; a record whose
op is not readable is kept verbatim (a record whose reason this build does not know included), counts towards the
limit and blocks its `entryId` if it has one; an unreadable pending op already in the failed key is not added twice. `FailedOpSchema`
keeps `conflict` readable (03-15a (11)); the reasons gain `stale`. (6) Every write reads both keys, applies the change,
writes only a changed key, the failed key first; memory (`pendingRemovals`, `cancelledOpIds`) follows only after the
write landed. While `outboxRestore !== 'ok'`, after an owner change or after `clearUserData` a write rejects with
`OutboxWriteStoppedError` without IO, and `retryWrite` stops on it. `outboxRestore` is set by `readOutbox` once per owner.
(7) The limit counts pending + failed (+ unreadable records) and applies to all three kinds: at 50 `offlineWritesAvailable`
is false (the online path); an append that races it rejects with `OutboxLimitError` (toast `limitReached`). `stale` is
checked on adoption (restore and after every append), not while an op already waits in its run. (8) The toasts live in
`toasts:offline.*` (`saved`, `saveFailed`, `limitReached`), not in an `offline` namespace; `saved` is shown only while the
network is unusable (online the caller's own success toast stays, "when the network is back" would be false); the error
toasts come from `toastLedgerWriteError`. `saveRetry` is 03-15c. `persistFailedThisSession` is set by any rejected append
write. (9) `navigator.storage.persist()` runs after the first appended op of the session; `isStoragePersisted()` keeps
the `persisted()` answer for the 03-16a caption. (10) The `auth` gate closes at every `restoreOutbox` and opens at its
end only if `getAccessTokenUserId()` is the owner; every new access token a request carries is announced once by the
interceptor (`initChipInApiInterceptors`' 4th callback `onAccessTokenChanged`) and `bootstrap` calls
`recheckOutboxOwner(sub)` (flag on only). A mismatch keeps it closed; the account-switch dialog is 03-16a.
(11) `clearUserData`: step (1) `stopOutboxIo(userId)` stops the drain, forgets the queue and refuses later IO of the
user; step (3) deletes the outbox keys through the same IO chain, after the write in flight. (12) The send claim is
taken in the outbox IO order (`claimOutboxOp`, the one-tab form of the write-locked compare-and-set): a discard whose
write is in flight lands first and the run resolves `CANCELLED` with 0 requests, or the claim lands first and the
discard refuses the op. (13) Left for 03-15c (blocking, its row): a same-owner stop and restart without a reload lets
a stale run continue. That is reachable through the refresh-listener account switch X → Y → X driven by another tab
(`clearUserData(X)` and `startOutbox(X)` while X's request is in flight): the stale run closes the new `auth` gate and
re-adopts and resends a deleted op. Left for 03-16a (its row): an edit and a delete of the same entry, the delete
appended while the edit is answered, take the cached base version (a false 409); the 2xx `setQueryData` alone does not
close it. (14) With the flag on, two open tabs both drain and read-modify-write the keys without a lock, so concurrent
appends can lose an op: the flag stays unset everywhere until 03-15c.

Deviation (03-15c1): the write lock, the persisted claim and the fence; still no drain lock or `BroadcastChannel`
(03-15c2), so every tab with a user client still restores and drains. (1) The write lock wraps `runOutboxIo` (the in-tab
chain stays, so `deleteOutboxKeys` still lands after the write in flight); the `clearUserData` delete takes it only with
the flag on (flag off: no lock, as before); a lock timeout there is retried with a backoff and after the third the
keys are deleted without the lock (the user's data must not survive a sign-out; this tab's IO of the user is refused
already). Until that delete has settled, the same user's outbox IO waits for it (a sign-in again restores and
appends only after the old keys are gone; another user's IO does not wait). A cleared user's IO is refused before the
lock is requested and again once it is held. Without Web Locks
the IO is ordered by the tab's chain only and `offlineWritesAvailable` is false; ops already persisted are still
restored and sent. Without `AbortSignal.timeout` the lock timeout is an `AbortController` and a timer. Only a request
the timeout aborted is a lock timeout; it is transient everywhere: the first read of the restore retries it and
`outboxRestore` stays `pending` (§1.6 `failed` stays for an IDB error or an unreadable key; reported once per restore
as Sentry `outbox.write_lock_timeout`), and a drain write reports
it as Sentry `outbox.write_lock_timeout`, not as `offline.persist_failed`. (2) The fence is two tokens:
the owner epoch (bumped by an owner change and by `clearUserData`) and the drain session (`crypto.randomUUID()` at
every start of the drain after a stop; 03-15c2 makes it the drain-lock hold). A run captures both. A stale drain
session never closes or opens a gate, blocks, joins `whenTurn` again, releases a turn, claims or writes the failed
list; a 2xx (or a success no-op) of the same owner epoch is processed after a stop (resolves 03-15a (12): `sent`, the
removal is retried until the epoch changes), of an older epoch it writes nothing and resolves `stopped` (resolves
03-15b (13), M2). (3) `OutboxState.sending` is written: `claimOutboxOp` is a write-locked compare-and-set on the op
(still queued, not cancelled, not sent), not on the claim: it replaces any existing claim, so with two draining tabs
B's claim can replace A's live one and a discard in B of A's in-flight op is then accepted while the server still
applies it (flag off until 03-17; refusing a foreign claim would leave a crashed tab's claim stuck until the drain
lock; 03-15c2 has one drain tab and tests the refusal). It also re-checks the token's `sub` against `op.owner` under the lock (N4, `auth` → the `auth` gate, no request), and the run
checks the session and the owner once more right before the request. A rejected claim write is transient (status
`failed-unsaved`, backoff, claim again). The removal write and the failed-list write clear the run's own claim; a
transient error clears it (compare-and-clear) before the backoff; a stale run clears only its own. `discardOps` reads
the claim from the draft. A restore still clears any claim: with two draining tabs (flag off until 03-17) a newly
opened tab may clear the live claim of another; 03-15c2 clears a stale claim only on drain-lock acquisition. (4) N3:
the append reads a queued create of the entry from the draft (`OutboxAppendView`); after a success the version is
kept in memory and the removal decides from the draft whether an op of the entry is left (keep, else delete it in the
key and in memory). (5) Cancellations are forgotten per run, not on a stop. (6) A write-lock timeout on append
rejects with `OutboxPersistError` (the `saveFailed` toast), Sentry `outbox.write_lock_timeout`, and leaves
`persistFailedThisSession` unset; the `saveRetry` toast is 03-16a. (7) Resolves 03-15b (14) in part: concurrent
appends no longer lose an op; both tabs still drain until 03-15c2.

Deviation (03-15c2): the drain lock and the ping (`outboxDrain.ts`, `outboxChannel.ts`); one tab drains.
(1) `readOutbox` binds the tab to the owner (append, overlay) without draining; `restoreOutbox` runs only on
drain-lock acquisition (its write re-reads the keys and clears any claim: resolves 03-15c1 (3)), then the holder
applies the keys like on a ping. A start closes the `auth` gate at once. A repeated start of the same client
re-reads and adopts (no op twice), or after a stop opens a new drain session, never while a release is pending
(the re-request after the release starts it). A tab whose `outboxRestore !== 'ok'` never requests or keeps the
drain lock. A failed re-read is retried with a backoff; when the clear write on acquisition fails the keys are read
again before the adoption. (2) The release on hidden stops the
drain session at once (no new claim; a run in backoff or in the turn resolves `stopped` and the re-acquisition
adopts its op again, so it is still sent once, not "continues"; its backoff starts again and the `outdated` gate
reopens until the next 426) and releases the lock once the request in flight and its removal write settled (so the next holder reads the
version it keeps), at the latest after
`OUTBOX_HIDDEN_RELEASE_MS` (15 s), when the request is aborted; a queued request stays queued while hidden and,
granted while hidden, is released at once.
freeze/pagehide aborts the request in flight (`send` gets the session's `AbortSignal`, also the GET of an unknown
version) and withdraws a queued request until resume/pageshow/visible. Logout and a user change (`stopOutboxDrain`)
abort the request in flight too, before the lock goes: another tab of the same user may take the lock next (a
direct `stopOutbox()` still lets a same-owner 2xx be processed, 03-15c1). Every tab re-reads on visible (not on every
focus). The page lifecycle is injectable for tests (`setOutboxPage`). (3) `settled` also carries `result:
'sent' | 'failed'`; receivers run the hooks' write effects (`onEntryWritten`/`onWriteFailed`, a failure also
invalidates `ledger.entry(id)`). Until the `ledger.entry(id)` query of 03-16a there is no `setQueryData` of
`settled.entry`: every tab keeps the version a settled op of the entry answered (`settledVersions`, memory) and an
append prefers it to the cached version; 03-16a replaces it with the `setQueryData`. (4) `status` adds `queued`
(pending, no status yet); receivers overwrite per op and drop ops no longer pending on each re-read; the new
holder clears its received map. `changed` is posted after every landed write of a tab (a send
costs the other tabs two re-reads: the claim and the removal). A removal from a drain session that is no longer
current and no longer holds its claim leaves `versions` to the current holder. (5) Retry/Cancel from any
tab: `retryOutboxOps` (`retryRequested`; an op of another owner or not an expense is not requested) and
`discardOutboxOps` (no UI caller until 03-16a). The claim accepts a
failed op only under `retryRequested`; the removal, the failed-list write and a discard drop it from there. A
Retry of an op that may not be sent (another owner, not an expense) is not adopted and stays failed. The holder
applies another tab's discard to its waiting run (`CANCELLED`, 0 requests) and drops cancellations that no run
will forget (ops discarded before any tab adopted them). (6) Badge hint: state only (`outboxDrainState`,
`isSendingInAnotherTab`, `outboxOpStatus`), no subscription and no copy (03-16a). (7) Without Web Locks a tab still
drains without the lock (03-15c1 (1)); offline writing is off without Web Locks or `BroadcastChannel`.

Deviation (03-16a part A): the data layer of the row; the UI (`OutboxSheet`, `<OnlineOnly>`, banners, the balance
caption, the sign-out and account-switch confirms) is parts B1/B2. (1) Resolves 03-15a (6)(11): `ledgerKeys.entry(id)`
(`entities/ledger/api/queries.ts`, the same key the registry reads), `ledgerEntryQueryOptions`, `toLedgerEntry`
(`entities/ledger/model/toLedgerEntry.ts`: zod, money through `moneyFromWire`; the model is the type, the version, the
group and the expense fields the app reads). The cache is filled from reads in one place: the expense history's
edit/delete buttons mount an observer of an expense's entry (`useLedgerEntryObserver`, so it refetches with the
views) only while offline writes are available (`useIsOfflineWriteAvailable`) and the entry may change (off: no
request and no cache entry). The optimistic write follows the append write in the enqueueing tab (`cancelQueries`, then
`setQueryData`): a create writes an entry without a version unless one is cached, an edit applies its patch and keeps
the base version, a delete writes nothing (the overlay shows it). The 2xx entry is written in the drain tab's
`onSettled` and, from `settled`, in the other tabs before their invalidation and the `settled` announcement, after
`cancelQueries` of a read in flight (its older answer would land over it); an answer whose expense is not readable
still writes its type and version; a delete's entry, and an answer without a readable version, leave the cache. `LedgerWriteContext.entryId` makes every settle (online and outbox) invalidate
`ledger.entry(id)`; with the flag off nothing caches it, so the invalidation matches nothing. (2) Resolves 03-15a (5):
the expense modal store makes `clientEntryId` when the create form opens (`null` in edit mode and without
`crypto.randomUUID`); the online create ignores it. `appendOutboxOp` does not append a create of an entry that already
has the same create queued, sent or failed (compared with sorted keys), so a repeated submit of the same opening queues one op; a
repeated create with another draft is refused (`OutboxCreateSentError`, nothing appended) whatever the claim: a create
in backoff may already be on the server, so it is never replaced. (3) Resolves 03-15b (13)
(M3): the registry reads the cached version inside the append's change, and `trackOutboxAppend` counts an append of
the entry from its call until it settles; while one is counted, the removal of a sent op of the entry keeps the
version (in memory; persisted only once an op of the entry is in the key), and it is forgotten when the last append
settles with no op of the entry queued or failed; a failed op of the entry keeps it too (its Retry is sent with it), and
a discard that leaves no op of the entry forgets it, in the discarding tab and in the drain tab after its re-read
(`forgetOrphanVersions`; a later write is based on the refreshed cache).
Across tabs the count is per tab: an append in tab B while A's removal lands relies on B having written A's
`settled` entry first (the message is posted before the removal write lands), a residual window with no data loss. (4) Resolves 03-15c2 (3) (R1 L3): `settledVersions` is gone; the version
lives only in `ledger.entry(id)`, so a fresher read wins. (5) L5: a ledger write resolves `{ queued }`; a queued write
shows only the outbox's toast (`saved` while the network is unusable, none online until the `OutboxSheet` of B1), the
expense form and the history's delete show their success toast only for an answered write. Settle-up still resolves
`void` (online only). (6) N2: a discard writes the outbox key before the failed key. (7) Resolves 03-15c1 (6): a
write-lock timeout on append is a transient `OutboxPersistError` (`isTransient`) and shows `offline:saveRetry`; the
app has two locales (en, ru), not five. (8) From the 03-15c2 R3 review: N2 is done (the in-flight count of a send is
released in `finally`, and a send that throws synchronously is classified like a rejected one, so no claim stays); L1 (a stale session's removal when the claim is not its own also leaves the op in `ops`) is
not: the op would stay unadopted in this tab until the next ping, it stays a residual false conflict with no data loss.

Deviation (03-16a part B): the outbox UI. (1) `useOutboxOverlay()` (`entities/ledger/api/outboxOverlay.ts`) is a
`useSyncExternalStore` over a change notification the outbox store gained for it (`onOutboxChange`: a landed write, a
re-read, the restore, an owner change, a status, the drain lock taken or released, the `persisted()` answer); flag off
it is a constant empty view with no subscription. It has no `conflictDrafts` until 03-16b. "Sending" is the
`OutboxState.sending` claim; an op claimed, or sent and waiting for its removal, offers no Cancel (`discardOps`
refuses it anyway); a pending op of an entry blocked by a failed or unreadable record is `blocked`. The Cancel of a
create, pending as well as failed, confirms "and N related edits" and goes through `discardEntryOps(createOpId)`
(R1 M1/L1): under the write lock it takes the group of the create's entry from the draft (ops + failed, so an op
another tab appended since this tab's last read is in it) and discards all of it in one write (the outbox key first,
N2), or nothing when the create is no longer queued or failed or any op of the group is claimed or waits for its
removal. Whenever the item itself was not discarded the sheet says it can no longer be cancelled. A cancelled create
leaves `ledger.entry(id)`, a cancelled edit or delete invalidates it (R1 N4). Retry is not offered for `unreadable`
and the interim `conflict`; `stale` reads "Send anyway". (2) Internal pages have no top header (a sidebar and a bottom bar), so the
badge is a button at the top of the content column of `InternalPageLayout`, mounted by the app layer only with the
flag on, shown while pending + failed + unreadable > 0 (what the limit counts); a failed restore shows only the
`outboxUnavailable` banner. Failed records whose op is unreadable have one row without actions ("N records can't be
read on this device… they are kept", R1 L2). An edit without a new description and a delete are named by the cached
`ledger.entry(id)` (R1 N3). The sheet's open state is reset with the user stores on logout and an owner change (R1
N2). (3) The amount and "your share" are shown for a
create only. The friend balances get the caption once per currency card. (4) Deferred: "Create as a new expense" for
`deletedRemotely` (needs the edit form prefilled from the cached entry and the patch; a TODO on the row) and the
"updated <relative time>" caption of a balance cache older than 24 h (the balances still come from legacy stores
without one read time). (5) There is no `offline` i18n namespace: the spec's `offline:*` keys are `common:outbox.*`
(`unavailable`, `storageNotPersisted`, `balanceExcludesPending`, …) and `toasts:offline.*`. An op queued while online
toasts `savedSending` ("Saved, sending…"), a changed repeat of a create being sent `createAlreadySending` (the form
stays open); a queued delete disables the entry's Edit and Delete (A review N5).

Deviation (03-16a part C): online-only actions and the sign-out and account-switch confirms; flag off, nothing of the
confirms renders, subscribes or reads IDB, and every auth transition runs in master's order, while the online-only
actions are disabled offline in both modes (ChipIn-one/chipin-frontend#866, KB NET-006/NET-007). (1)
`useRequiresOnline(action, { canQueueOffline })` (`hooks/`, blocked = `!isNetworkUsable()`, re-rendered on
`onlineManager`, or `sessionMode === offline-cached`, whether the flag is on or off; the expense writes
`expense.save`/`expense.delete` (`OFFLINE_WRITE_ACTIONS`) are exempt only with the flag on and `canQueueOffline`, which
the caller reads from `useCanQueueLedgerWrite` (`entities/ledger`: the outbox is available and an edit or a delete has
its entry cached as an `EXPENSE`), so the hook needs no query client) and `<OnlineOnly action canQueueOffline>`
(`components/online-only`): not blocked, the child as it is (a Radix trigger's `asChild` props reach it through `Slot`);
blocked, the child gets `disabled` + `aria-disabled`, the trigger's props are dropped and a focusable span carries the
tooltip "An internet connection is required". `<OnlineOnlyGroup>` puts the user-settings cards in a disabled `fieldset`
(a page caption says why); menu items and a card button read the hook and show the same hint (#866: a menu item's
caption, the simplify-debts caption, the cover picker's tooltip). `ONLINE_ONLY_ACTIONS` (`constants/`) has `settleUp`,
`settlement.delete`/`edit`, `group.create`/`update`/`cover`/`leave`/`kick`/`delete`, `invite.accept`, `avatar.upload`,
`user.settings`, `friend.delete`, `logoutOtherDevices`, and since #866 `expense.save` (the add/edit form's submit,
`ExpenseButtons`) and `expense.delete` (the history's Delete of an expense); "invites" of the table are the join
confirmations (sharing an existing invite link stays local) and the group delete is added. Source-scan tests check that
every key has an entry point and that every JSX usage of the online-only trigger modals and every caller of the
online-only mutation hooks sits behind a wrapper (`DevMenu`, development only, is exempt); the expense hooks are checked
by name (create/edit only through `useExpenseModalSubmit` in `ExpenseButtons`, wrapped in `expense.save`; every
`useDeleteLedgerEntry` caller wraps `expense.delete`). The group settle-up trigger is wrapped and an open
`GroupSettleUpFlow` closes when the network goes (not while its payment request runs; it does not reopen). The refusals
before `mutate` stay as the last guard for a control used as the network went. (2) C2-02: the history's
Update and Delete of a non-expense are wrapped (`settlement.edit`/`delete`); `chooseLedgerWritePath` already takes the
online path for an entry not cached as an `EXPENSE`. (3) Resolves 03-15a (11): settle-up refuses rather than shows the
caption alone. A group's flow shows "Send or cancel the unsent expenses of this group first" with a button that opens
`OutboxSheet` while the group has a pending or failed op (`OutboxOverlay.queuedGroupIds`); the friends' form refuses
while any pending or failed op exists (its balances span groups); a payment already sent finishes. Unreadable records
do not refuse (they have no action and would block settle-up until another build sends them); the part B caption still
counts them. While this tab's outbox restore is `pending` settle-up is refused with "Checking the unsent operations of
this device…"; a `failed` restore does not refuse (its banner and the caption stay). (4) Sign-out: one hook
(`useSignOutConfirm`, both buttons) counts the cached user and the kept users (see (6)) from their stored keys
(`readOutboxRecordCount`: pending ops + failed + unreadable records, validated as a restore reads them, no write lock,
loaded lazily off the landing path); N > 0 → "N unsent operations will be deleted. Sign out?", a failed read → the same
without N, 0 → sign-out; the answer applies only while the tab's user is the one counted. The conflict drafts are not
counted: `conflictDrafts` is still kept as read; 03-16b adds them to N. The remote logout asks nothing. (5) Account
switch: the initiating tab (`exchangeGoogleOAuthCode`) asks before it establishes Y's session (the count needs no
token): X (the cached id, captured when asked) and the kept users other than Y are counted; N > 0 or a failed read asks
through `requestAccountSwitchConfirm` (a UI store; the dialog is rendered by `OAuthCallbackPage`, flag on only). The
copy says "another account" instead of naming X (no personal data in the dialog). "Delete and sign in" establishes Y,
drops the captured X and deletes the kept users (other than Y). Cancel signs Y out without ever establishing it:
`startAuthLogout({ broadcast: false })` logs Y's refresh cookie out (a broadcast would make the tabs still on X run the
remote logout and delete X's data), the hint stays false, `LS_KEY_USER` is X again if it changed, nothing is cleared,
the status is `unauthenticated`/`signed_out` and the exchange resolves, so the callback page navigates as after a
sign-out. The session version is captured when asking: any session change while the question is open (a remote
logout, an expiry) answers it Cancel, and an answer after a change signs nothing in. A newer question answers an older
one with Cancel. (6) The refresh path stays synchronous at the token, as in master: this tab moves to Y and X is
detached at once (`clearUserData` is split into `detachUserData`, steps 1, 2, 2a, 4, and `deleteUserKeys`, step 3), so
no data of X stays in memory and no X request or cache write follows. Only the key delete waits for X's stored count:
none → X's keys are deleted (unless this tab is back on X); some or unreadable (reported to Sentry by the error name)
→ the keys stay and X goes to `LS_KEY_KEPT_OUTBOX_USERS` (ids only, `helpers/localStorage.ts`, validated reader): the
§1.5 row "token of Y by a refresh". The next sign-out (this tab or remote) and the next confirmed account switch delete
the kept users' data (`clearUserData` per user, under the write lock) and empty the list; a sign-in of a kept user
takes it off the list and its queue continues. Deferred: the "Create as a new expense" and 24 h caption of part B (4)
stay deferred; conflict drafts in N (03-16b).

#### 2.5 Error handling

409 is distinguished **by `code`**, not by status: `SYSTEM.CONFLICT` — transient (retry), `LEDGER.VERSION_CONFLICT` —
version conflict (2.6), `LEDGER.ID_CONFLICT` — data error.

| Response | Action |
|---|---|
| 2xx | success; `setQueryData` for the entry from the response (including the new `version`), update `outboxVersions` (2.1) |
| network | wait for the network (2.4), operation pending |
| 5xx, 409 `SYSTEM.CONFLICT` | backoff (2.4), operation pending |
| 401 | the interceptor does a refresh. If the refresh failed → `expireSession()`, `auth` gate, operation pending (not failed) |
| 400 / 422 (validation) | failed `validation`, the `entryId` blocked |
| 403 (no access to the group / excluded) | failed `forbidden`, the `entryId` blocked |
| 404 on PATCH; unknown version and GET `ledger.entry(id)` → 404 (2.1) | failed `deletedRemotely`, the `entryId` blocked |
| 404/204 on DELETE | success |
| 409 `LEDGER.VERSION_CONFLICT` | conflict (2.6): `current` from the `LedgerConflictResponse` body (BE-03-1, parsed by zod) into the cache, a draft; not failed, nothing blocked |
| 409 `LEDGER.ID_CONFLICT` on create | failed `idConflict` (should not happen; Sentry), the `entryId` blocked |
| 410 `LEDGER.ENTRY_DELETED` on a duplicate create | success-no-op, remove from the overlay |
| 426 `CLIENT.OUTDATED` | `outdated` gate, operation pending, update screen |

A failed operation is written to `chipin:outbox-failed:<userId>` (zod schema `FailedOpSchema = { op: OutboxOp, reason,
failedAt }`) **before** the mutation settles with an error and leaves the persisted outbox (2.3, 2.4).
**A failed operation blocks only later operations of the same `entryId`** (D29): they may depend on it (an edit of the same
expense); operations of other entries keep draining.

`features/offline-queue/OutboxSheet.tsx` (from the banner/badge in the header): pending ones with a status from `statusByOpId`
("waiting for network" / "sending" / "server unavailable" / "sign-in required" / "update required"), failed ones with a reason
and the conflict drafts (2.6). Actions for failed: "Retry", "Cancel operation", for `deletedRemotely` — "Create as a new
expense". "Retry" from any tab adds the `opId` to `OutboxState.retryRequested` (write lock + ping); the drain tab calls
`runOutboxOp(op, { ignoreEntryBlock: true })` once per `opId` (an in-memory `retryingOpIds` set: a repeated ping does not start
a second run) — it waits for `auth`/`outdated` and for its turn by `seq`, the later operations of the same `entryId` stay
skipped, nothing overtakes; on success one write removes the op from failed and from `retryRequested`, and if no failed op of
that `entryId` is left — `outboxGate.unblock(entryId)`; a new terminal error updates the failed record and removes the
`opId` from `retryRequested` in one write. If the drain tab dies during a retry, the next holder sees `retryRequested` and
retries again (idempotent, §2.3).

**Cancellation (discard), C2-15/C3-04** — a single function `discardOps(opIds)`, callable from any tab:
with a single write under the write lock it adds `opIds` to `OutboxState.cancelled` and removes them from `ops`/failed, then a
`changed` ping; the drain tab adds them to `cancelledOpIds` in memory. A cancelled operation, wherever it is waiting (`whenTurn`,
`waitForOnline`, backoff), at the nearest check resolves `CANCELLED` **without a request**; the next operation starts only after
its settle (the turn order is preserved). A claimed operation (`OutboxState.sending`, the request is going out) cannot be
cancelled: the button is hidden, and `discardOps` refuses it under the write lock (§2.3).
- Discard pending (including the op holding the turn): `discardOps([opId])`.
- Discard failed **create**: `discardOps([createOpId, …all pending/failed with the same `entryId`])` — dependent edits and
  deletion of the same client id are cancelled together with it (confirmation "and N related edits"); no PATCH/DELETE
  goes out for a non-existent record.
- Discard failed update/delete: only this operation; subsequent operations of the same `entryId` remain (their version comes from
  `outboxVersions`/`baseVersion`, the backend catches a conflict).
- After discard: no failed op of that `entryId` is left → `outboxGate.unblock(entryId)`. `cancelled` is cleaned of the `opId`
  when its mutation has settled.

#### 2.6 Conflict 409 (D28, supersedes the D5 dialog)

No compare dialog and no "Keep mine / Take from server" choice. On 409 `LEDGER.VERSION_CONFLICT` (or an unknown version, 2.1)
the drain tab runs `recordConflict(op, current)`:
- **Fresh version into the cache.** `current` (the 409 body; for an unknown version — a GET of `ledger.entry(id)`) is written by
  `setQueryData(ledger.entry(id), toLedgerEntry(current))`, and the list caches are refreshed by `invalidateAfterLedgerOp`
  (`groupKeys.detail/activity(groupId)`, `['activity']`, `['dashboard']`); other tabs get the same through `settled`.
- **The user's changes stay as a draft.** One write under the write lock removes the conflicting op **and every later op of the same
  `entryId`** from `ops` (they are added to `cancelled`, so their adopted mutations resolve `CANCELLED` without a request), removes
  the conflicting op from the failed key and `retryRequested` if it was a retried failed op (then `outboxGate.unblock(entryId)`
  when no failed op of the entry is left), and stores `OutboxState.conflictDrafts[entryId] = ConflictDraft { entryId, groupId,
  fields: ExpensePatchWire, createdAt }`. `fields` = the `patch`es of those update ops merged in `seq` order (an update op's
  `patch` holds only the changed fields, 2.1); an existing draft of the entry is merged, not overwritten: its fields first, the
  new ones on top, its `createdAt` kept. `outboxVersions` drops the entry. The draft lives in the outbox key, so it survives
  reload, is bound to the account and is deleted by `clearUserData`.
- **Toast** `offline:conflictChanged` "This expense was changed by another member" with the action "Open my changes".
- **Reopen and resend.** "Open my changes" (the toast, the draft row in `OutboxSheet`, or any ordinary "Edit" of an entry
  that has a draft — there is no second edit path while a draft exists) opens the expense edit form on the cached
  entry (= `current`, or newer if it was refetched) with the draft fields applied on top and marked "your unsaved changes". Save
  enqueues an ordinary update op with `baseVersion = current.version` (taken from the `ledger.entry(id)` cache at save time) and
  deletes the draft in the same append write. The resend is a deliberate last-write-wins over a version the user has seen.
- **When the draft is discarded:** "Discard my changes" (in the form or `OutboxSheet`); Save (replaced by the new op); the entry
  is deleted remotely — whichever tab sees a 404 on `ledger.entry(id)` or a `REVERSED` entry drops the draft under the write
  lock (idempotent) with the message "The expense was deleted"; `clearUserData`. No auto-deletion by age (like §2.8); a draft is never sent without the user's Save. Drafts count
  towards the limit of 50 (§2.8, from 03-16b).
- **Delete conflict.** 409 on DELETE (or a run of later ops that ends with a delete): message `offline:conflictNotDeleted`
  "This expense was changed by another member, so it was not deleted", `current` into the cache, the delete and the folded ops
  are dropped, no draft. The user can delete again from the refreshed entry.
- Nothing is blocked: a conflict is not a failed op, the `entryId` is not blocked and other entries are unaffected.

Deviation (03-16b): (1) `recordConflict` is `shared/offline/outboxStore.ts` (one write of the run's drain session, the
folded ops into `cancelled` and the in-memory cancellations); the run resolves `conflicted { entry: current, isDelete }`
and the outbox `onSettled` writes `current`, refreshes the views (`onEntryWritten`) and tells the UI
(`entities/ledger/api/conflictDrafts.ts`, the toasts are mounted with `OutboxControls`, so only the drain tab toasts);
`settled` gains `result: 'conflicted'` for the other tabs (an older build drops the message: freshness only). A 409
`LEDGER.VERSION_CONFLICT` on a create is failed `rejected` (no version to conflict with). (2) Stale guard: versions are
opaque, so `LedgerEntry` gains the server's `updatedAt` and a `current` older than the cached entry by it is not written
(equal or unknown: written; whole seconds, so two answers of one second may overwrite, healed by the refetch that
follows); the invalidation reads the entry again either way, and an unreadable `current` drops the cached entry. (3) `ConflictDraft` also carries
`parentActivityId` (nullable): "Open my changes" (toast, `OutboxSheet`) navigates to that expense history, whose Edit
opens the form (a request in the UI store `conflictDraftStore`; `expenseModalStore` is unchanged); without it only
"Discard my changes" is offered. (4) The form's base is the expense history's latest event, as for every edit (the
cached entry has no sharing mode or participant names); the history is invalidated by the conflict, the original stays
that state, so Save sends the draft's fields as an ordinary edit whose `baseVersion` is the cached version (registry,
unchanged). Only a Save from a form opened on the draft replaces it: its edit carries `replacesConflictDraft` and the
append write drops the draft; any other queued edit (a form opened before the conflict, or on an unreadable draft) keeps
it; a queued delete drops it (moot). A Save answered online, or with nothing left to change, removes the draft after it
(no append). "Open my changes" opens the form once the expense history is fresh (not being read, not
invalidated) or its read cannot answer (paused offline or errored: the cached history is used); the request is consumed
by that first attempt or by a manual Edit that opened the form, and undelivered notices wait for the first listener. (5) `LedgerEntryInfo` has no
reversed state (a reversed entry reads 404): "a `REVERSED` entry" is the expense history whose latest event is
`EXPENSE_REVERSED`; the 404 drop runs in the `ledger.entry(id)` query function. (6) Old failed `conflict` records are
converted in the drain-lock restore write: an edit → a draft (`createdAt` = `failedAt`), a delete → dropped with the
`conflictNotDeleted` notice; a create
stays failed `conflict` (Cancel only). Its later ops are no longer blocked and fold into the draft on their own 409. (7)
Drafts count in the limit (a Save at the limit takes the online path), the badge, the sign-out and account-switch N, and
the settle-up refusal (a draft is unsent intent: its group, or any draft for the friends form). (8) Keys:
`toasts:offline.conflictChanged|openMyChanges|conflictNotDeleted|conflictDraftDeleted`, `common:outbox.*` for the sheet and
the form; en and ru only (D7 amendment), not ×5.

#### 2.7 Client UUID, create and backend capabilities

`entryId = crypto.randomUUID()` is created when the form is opened (a repeated submit carries the same id). The `id` field in the body of
`POST /ledger/entries` is rejected by the backend with **400** (unknown field) until BE-03-2, therefore:
- The source of truth is runtime capabilities: `GET /health` → `{ status: "UP", capabilities: string[] }` (the field is introduced by the
  first merged of BE-03-1/2/5; contract §7.0): `"ledger.clientEntryId"` (BE-03-2), `"ledger.entryVersion"` (BE-03-1),
  `"client.minVersion"` (BE-03-5).
  FE: `capabilitiesQueryOptions` (`['meta','capabilities']`, staleTime 10 min, persist yes, `queryFn` = the same `/health`;
  no field → `[]`). `useBackendCapability(name)` is the only reader.
- The create body is built by a single function `toCreateLedgerEntryWire(draft, { clientEntryId })`; `id` is included **only** if
  `ledger.clientEntryId` is present at send time. Without it create is **online only** (`ledgerOnlineMutationKeys.createEntry`, 2.1;
  `<OnlineOnly>` on the save button while offline), the id is not sent. The `id` field appears in the types only after
  syncing OpenAPI with the backend release that has it (§5.3) — with an old snapshot code with `id` does not compile.
- `offlineWritesAvailable = VITE_FEATURE_OFFLINE_WRITES && capabilities ⊇ {ledger.clientEntryId, ledger.entryVersion,
  client.minVersion} && navigator.locks && BroadcastChannel && outboxRestore === 'ok' && !persistFailedThisSession`
  (§1.6, §2.3, §2.8). There is no separate `VITE_FEATURE_CLIENT_ENTRY_ID`.
- A backend rollback after the capability was cached: create with `id` → 400 → failed `validation`; the next
  `/health` (refetch on focus/reconnect) clears the capability. Acceptable, Sentry `outbox.capability_mismatch`.

#### 2.8 Limits

- A maximum of **50** pending+failed (+ conflict drafts from 03-16b) per user; beyond that offline create/edit are disabled ("Too many
  unsent operations — connect to the network").
- Older than **14 days** by `createdAt` (refresh token 30 days, `application.yaml:18`) → failed `stale` ("Send anyway"
  / "Cancel"), no auto-deletion. Limits and `stale` — PR 03-15b.
- **Storage reliability (C3-10).** The first offline operation calls `navigator.storage.persist()` (once per session);
  if `navigator.storage.persisted()` === `false` — a caption `offline:storageNotPersisted` in `OutboxSheet` "The browser may
  delete unsaved data of this device (Safari — after 7 days without opening; a private window — on close)".
  The toast "Saved, we will send it when the network is back" — only after the append write (§2.3, an immediate write of the
  key under the write lock, no throttle) resolved. If the append fails, the operation does not exist (an op is sent only
  after it was adopted from the key, so nothing can be in `sending`): a rejected IDB write (quota, private mode) → error toast
  `offline:saveFailed` "Could not save on the device — connect to the network", `persistFailedThisSession = true` (offline
  writing is off until restart), Sentry `outbox.persist_failed`; a write-lock timeout is transient → error toast
  `offline:saveRetry` "Could not save, try again", offline writing stays on, Sentry `outbox.write_lock_timeout`. A success
  toast without a successful write is impossible.

#### 2.9 What is allowed offline

| Operation | Offline |
|---|---|
| Create / edit / delete an expense (group and personal) | yes, phase 1, through the outbox while it can take the write (`VITE_FEATURE_OFFLINE_WRITES` on, outbox available, an edit or delete of a cached expense); otherwise (production today: flag off) no, the save and delete are disabled offline (KB NET-007, #866) |
| Create/rename a group, participants, cover, leave, kick, invites | no in phase 1; phase 2 (D2) — rename and participants through the same outbox after BE-03-8; phase 2 PR ids are not assigned — the deferral is listed among the owner confirmations (00, C1-28) |
| Settle-up / repayment / payment, deletion and editing of a settlement | **never** (see below) |
| Avatar/cover (upload) | never (multipart, progress) |
| User settings (`PATCH /users/self`) | no (phase 2 optionally) |
| Delete a friend, logout other devices | no |

Mechanism: `useRequiresOnline()` (from `isNetworkUsable()` + `sessionMode`) and `<OnlineOnly>` around the button:
offline → `disabled`, `aria-disabled`, tooltip "An internet connection is required"; entry into `GroupSettleUpFlow` is
closed entirely. The constant `ONLINE_ONLY_ACTIONS` + a test that every action is wrapped. This holds whether
`VITE_FEATURE_OFFLINE_WRITES` is on or off (KB NET-006, ChipIn-one/chipin-frontend#866). The expense writes
(`expense.save`: the add/edit form's submit; `expense.delete`: the history's Delete) are gated the same way unless the
outbox can take the write (KB NET-007: flag on, outbox available, an edit or a delete of an entry cached as an
`EXPENSE`; `canQueueOffline` from `useCanQueueLedgerWrite`); then they are not blocked and go to the outbox. Backend
down keeps the network usable, so nothing is disabled: the blocking unavailable page (NET-002) is the only notice.

**Settlement — online only, on two levels (C2-02).** Deleting (reverse) and editing a settlement go through the same
`DELETE`/`PATCH /ledger/entries/{id}` as expenses (the backend `LedgerEntryCommandService.deleteEntry` handles
`EXPENSE` and `SETTLEMENT`), therefore: (1) the outbox registry (2.1) rejects any non-`EXPENSE` entry; (2)
`ONLINE_ONLY_ACTIONS` includes `settlement.delete` and `settlement.edit`, and `ActivitySubeventsButtons.tsx:68-75` (`onRemove`
today has no `isExpense` check, unlike `onEdit` `:52-54`) gets `<OnlineOnly>` for a non-expense; the hook
`useDeleteLedgerEntry(entry)` always takes the online key for a settlement. Test: offline settlement-delete → 0 outbox mutations,
button disabled; online → `DELETE` went out via the online path.

**Editing offline requires a cached entry (C2-33):** the form for editing/deleting an expense offline is available only if
`ledger.entry(id)` is in the cache (otherwise there is neither `baseVersion` nor the entry type) — otherwise "Connection required"; test.

Creating an expense offline requires the cached group and participants. If `groupKeys.detail(id)` is not in the
cache, the form shows "Group data is not loaded — connect to the network".

### 3. Offline balance

**Decision: we do not recompute locally.**

Rationale: an exact match is provable only for the shares of a single expense — `money.split` repeats
`distributeAmount` bit for bit. The displayed balances are built by the server projection (`ledger/balances/GroupDebtProjection.kt`,
`LedgerDebtRefreshService.kt`, transfers `EXPENSE_TRANSFERRED_*`), aggregated by groups/currencies
(`netBalance`/`netAmount`) and converted by rates (`helpers/currencies.ts:3-18`). Repeating this on the client is
a duplication of business logic without provable equality; a "jumping" figure in money is worse than an honest mark.

UI: while there are pending/failed operations, every balance (dashboard summary, group header, friend card) gets
the caption "excluding unsent operations" (`offline:balanceExcludesPending`) and a counter N linking to
`OutboxSheet`. In `OutboxSheet` a pending expense shows "your share: X" (`money.split`; EXACT as is). A balance cache
older than 24 h → the caption "updated <relative time>".

### 4. Module `shared/money/`

#### 4.1 Model

```ts
export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };   // /^[A-Z]{3}$/
export interface Money { readonly minor: bigint; readonly currency: CurrencyCode }
// minor — integer ledger units = 10⁻⁴ (85.5 → 855000n); -0 does not exist
export const LEDGER_SCALE = 4;                     // like backend MONEY_SCALE / AMOUNT_SCALE — the only constant on the FE
```

The wire is a `number` of scale 4 **forever** (D21), but on the FE an amount **never passes through double** (revision C1-03, the dispute
review B ↔ C1 was settled by running Node 24.21, a seeded sweep of 400k per range, `../evidence/money/double-path-sweep.mjs`):

| Value range | `JSON.parse` → `Math.round(v*1e4)` + round-trip (previous spec) | `JSON.parse` → `v.toFixed(4)` | parse from text (decision) |
|---|---|---|---|
| [0, 1e11) | 0 wrong, 0 rejections | 0 / 0 | 0 / 0 |
| [1e11, 2³⁹ ≈ 5.4976e11) | 0 wrong, **13,858 false rejections** (`365963032346.3555`) | 0 / 0 | 0 / 0 |
| [2³⁹, 9e11) | **72,224 silently wrong**, 0 rejections (`899999999999.9997` → `…9998n`) | 72,231 wrong | 0 / 0 |
| [9e11, 1e15) | ~89 % wrong or rejected | ~99 % wrong | 0 / 0 |

The previous claim "400k: 0 rejections, 0 wrong up to 9e11" was false: above 2³⁹ the double step (2⁻¹³ ≈ 1.22·10⁻⁴) is larger than
10⁻⁴, two neighboring 4-decimal values give the same double — no check on the FE can recover that. Therefore:
1. **Parsing from text.** The transport `shared/api/wireJson.ts` (only in `api()`, §5.4) = `lossless-json` `parse(text,
   reviver)`: all numbers first become `LosslessNumber` (the original string), the reviver, per the field registry §4.3, turns money
   ones into `WireAmount`, percentages/weights/rates into `WireDecimal` (a string), and the rest into `number`. The runtime `WireAmount` is a
   frozen plain object `{ __wireDecimal: '85.5000' }` (survives structured clone, JSON and the persist codec §1.4);
   the type is an opaque brand `{ readonly __wire: unique symbol }`. `moneyFromWire` parses the string with a regex into a `bigint` without
   arithmetic. The same sweep (from 10⁰ to 10¹⁹ ledger units, sign ±): **0 wrong, 0 rejections**.
2. **Documented boundary** = the backend column `decimal(19,4)` (`LedgerDbObjects.kt:26`): `|v| ≤
   999 999 999 999 999.9999`, regex `^-?\d{1,15}(\.\d{1,4})?$` (the backend writes `toPlainString` of scale 4 without an exponent,
   `BigDecimalJsonNumberSerializer.kt`). Out of bounds, > 4 fractional digits, an exponent → `MoneyWireError` + Sentry
   `money.wire_reject` — **a hard rejection, never a silent value**. The rejection is localized to the item (`mapItems`,
   §4.2), the page does not crash (C3-13). A backend amount limit is not needed: the DB column holds the boundary.
3. **Outgoing bodies with money** are written by the same module: `lossless-json` `stringify(body, null, undefined,
   [{ test: isWireAmount, stringify: w => w.__wireDecimal }])` plus a registry-driven replacer (§4.3) that maps each
   `DECIMAL_MAP_FIELDS` value (a `WireDecimal` string, matched by the map's property name) to `new LosslessNumber(s)`, so it is written unquoted — a decimal literal without an exponent (verified: `{"amount":
   899999999999.9997}`). `JSON.stringify` for such bodies is forbidden: the backend accepts only `^-?\d+(\.\d+)?$`, while
   `JSON.stringify(1e-7) === '1e-7'`.
4. **Cost:** a 4.1 MB JSON — `JSON.parse` 33 ms, `parseWireJson` 156 ms (Node 24, the same run); a typical response
   < 100 KB — a few ms. Non-JSON responses (204, HTML 502) are passed through by the transport as is.
5. The legacy layer `src/api/*` stays on `JSON.parse` + `normalizeApiMoneyAmount` until its store is migrated (behavior as
   today, no regression); the lossless transport is connected only through `api()` (per-request `transformResponse`/
   `transformRequest`, the global `apiInstance` defaults do not change).
6. Changing the scale is one constant on each side (`LEDGER_SCALE` on the FE, `MONEY_SCALE` on the backend), changed in sync.

Arithmetic is in `bigint` "ledger units" = 10⁻⁴; currency minor units are **only** for display and
input limiting. Reason: the backend divides and computes balances with scale 4 for all currencies
(`ShareDistribution.kt:7`); splitting in cents gives a different remainder — the current bug in `expenseModalSelectors.ts:106-174`.

#### 4.2 API (`shared/money/index.ts` — the only public entry)

| Function | Signature | Behavior |
|---|---|---|
| `currencyCode` | `(s: string) => CurrencyCode` | upper-case + check `^[A-Z]{3}$`, otherwise throw |
| `minorUnits` | `(c: CurrencyCode) => 0 \| 2 \| 3` | the `MINOR_UNITS` table (ISO 4217): 0 — BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF; 3 — BHD IQD JOD KWD LYD OMR TND; the rest 2. Not via Intl (engines differ) |
| `moneyFromWire` | `(v: WireAmount, c) => Money` | `v.__wireDecimal` by `^(-?)(\d{1,15})(?:\.(\d{1,4}))?$` → `BigInt(sign + int + frac.padEnd(4,'0'))`, `-0` → `0n`; no match → throw `MoneyWireError` + Sentry `money.wire_reject` (§4.1). No `Number`/double. Called **only** in the mappers `entities/*/model/toX()` |
| `moneyToWire` | `(m: Money) => WireAmount` | a decimal string from `minor` (`|minor| < 10¹⁹`, otherwise throw `MoneyWireError`), `{ __wireDecimal }`; no double. Called only in the mappers `toXWire()` |
| `mapItems` | `<T, X>(list: readonly T[], toX: (t: T) => X, id: (t: T) => string) => (X \| InvalidItem)[]` | a `MoneyWireError` in an item's mapper → `{ kind: 'invalid', id }` + Sentry once per `id`; the UI renders a row "This entry cannot be shown" (`common:invalidAmount`), the rest of the list works (C3-13). Other errors propagate. Deviation (12a): until the KB adds `common:invalidAmount`, the readers leave invalid items out (reported once by `mapItems`) instead of rendering the row: the group activity (`flattenGroupActivity`) and, since 12b, the user's own feeds (the dashboard previews `loadedActivityPreviews` and the Activity page events `loadedActivityEvents`; before 12b the legacy bridge showed such a row as an unknown event), as `toKnownUsers` and `toDashboardBalances` already do |
| `parseMoneyInput` | `(raw: string, c) => Money \| null` | user input: trim, remove spaces/NBSP, one separator `,` or `.`, integer digits ≤ 15 (boundary §4.1), fractional digits ≤ `minorUnits(c)`, ≥ 0. Replaces `parseAmountInput` (`helpers/numbers.ts:302`). Editing an entry with a more precise amount (the backend allows scale 4 for any currency, e.g. `10.5 JPY`, C3-20): the field shows the amount with its digits; while the field text is unchanged, the form sends the original `Money` without parsing; changed text is parsed by `minorUnits(c)` |
| `toUnits` / `fromUnits` | `Money → bigint` / `(bigint, c \| like: Money) → Money` | `fromUnits(units, like)` takes the currency of `like` and keeps its `ApproxMoney` mark (type and runtime), so `fromUnits(toUnits(a), a)` stays approximate |
| `add`, `sub`, `negate`, `abs` | `(a, b) => Money` | different currencies → throw `CurrencyMismatchError` |
| `sum` | `(list: Money[], c) => Money` | empty → zero |
| `compare`, `isZero`, `sign` | | `sign` → `-1 \| 0 \| 1` |
| `roundToMinor` | `(m) => Money` | half-up **away from zero** (like `RoundingMode.HALF_UP` and the current `roundHalfUp` from `helpers/numbers.ts:95`) to `minorUnits`, the result is scale 4 again |
| `displaySign` | `(m) => -1 \| 0 \| 1` | `sign(m)` at scale 4. **The single rule "owes/is owed/settled"**: "settled" only when `minor === 0n`; `0.0040 USD` → 1 (the backend counts this as a debt and blocks friend deletion `USER.OUTSTANDING_DEBT`). Such an amount is displayed by `formatMoney` as "< $0.01" (§4.5) |
| `split` | `(total: Money, entries: readonly { userId: string; weight: string }[]) => Money[]` | an exact copy of `distributeAmount` (`ShareDistribution.kt:41-63`): decimal weights are brought to a common integer scale like `toCommonScaleIntegers` (by the max number of fractional digits), `floor(units*w/W)`, the remainder 1 unit each to the largest remainders, ties by index (stable sort). `entries` — **in the exact order of the request body's `participantIds`** (the same array is passed to the mapper `toCreateLedgerEntryWire`). Weights: AUTO = all `'1'`, SHARES = the weights, PERCENTAGE = the percentages; zero weights are allowed. Empty list → `[]`, `W <= 0` → throw. An `ApproxMoney` total gives `ApproxMoney` shares |
| `convert` | `(m, rate: string, target) => ApproxMoney` | approximate (rates), half-up to scale 4; the result is marked in the types as `ApproxMoney` (brand) — it cannot be passed to `moneyToWire`; `add`/`sub`/`negate`/`abs`/`sum`/`roundToMinor` return `ApproxMoney` when any input is approximate |
| `formatMoney` | `(m, opts?: { locale?; currencyDisplay?: 'symbol' \| 'code'; signDisplay?: 'auto' \| 'always' \| 'exceptZero'; compact?: boolean }) => string` | `roundToMinor` → `Intl.NumberFormat(locale, { style:'currency', currency, minimumFractionDigits: mu, maximumFractionDigits: mu })`. If `m ≠ 0` but `roundToMinor(m) = 0` → "< " + the format of one minor unit, always absolute (`signDisplay` is ignored there; "< $0.01" for ±0.0040 USD); the sign is conveyed as the text "you owe / you are owed", not a symbol. | A decimal string assembled from `minor` goes in as input (ES2023 `format(string)` — no loss of precision); a formatter cache by `locale+currency+opts` |
| `formatMoneyParts` | same → `Intl.NumberFormatPart[]` | for `basics/numbers/amount/Amount.tsx`, which needs separate parts |

Rules: all functions are pure, without React and i18n. Locale is passed as an argument (taken from `i18n.resolvedLanguage`
in the hook `useFormatMoney()` in `shared/i18n`, not in money).

#### 4.3 Lint restriction

A block for `src/**/*.{ts,tsx}`, `ignores: ['src/shared/money/**', 'src/shared/lib/formatNumber.ts', '**/*.test.*']`:

```js
// F(parent, names) = `${parent} > MemberExpression[property.name=/^(names)$/]`, plus the same with
// `ChainExpression > ` (x?.amount) and `TSNonNullExpression > ` (x.amount!) before MemberExpression.
// The comparison entry also matches a field inside a `??`/`||` operand: `(x?.amount ?? 0) > 1`.
'no-restricted-syntax': ['error',
  { selector: "CallExpression[callee.name='parseFloat'], CallExpression[callee.property.name='parseFloat']", message: 'Money: use shared/money (parseMoneyInput/moneyFromWire).' },
  { selector: F("CallExpression[callee.name='Number']", 'amount|minor|netBalance|netAmount|shareAmount'), message: 'Money: no Number() on money fields.' },
  { selector: "CallExpression[callee.property.name='toFixed']", message: 'Money: use formatMoney/roundToMinor.' },
  { selector: "CallExpression[callee.object.name='Math'][callee.property.name='round'] BinaryExpression[operator='*']", message: 'Money: no Math.round(x*N) rounding.' },
  { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']", message: 'Use formatMoney or shared/lib/formatNumber.' },
  { selector: F("BinaryExpression[operator=/^[<>]=?$/]", 'amount|minor'), message: 'Money: compare via money.compare/sign.' },
],
'no-restricted-imports': ['error', { patterns: [{ group: ['shared/money/*'], message: 'Import from shared/money only.' }] }],
// outside entities/*/model/** additionally (C1-11): importNames moneyFromWire/moneyToWire from 'shared/money' are forbidden —
// 'Wire↔Money conversion only in entities/*/model mappers.'
```

The main protection is the types, lint is a safety net:
- Raw amounts in the generated types are an opaque `WireAmount` (`type WireAmount = { readonly __wire: unique symbol }`,
  **not** a number-brand; the type, `isWireAmount` and `WireDecimal` are in `shared/money/wire.ts`, PR 03-1). The decision "money or not" is made
  by the **field registry** `scripts/api/wire-fields.mjs`, not by `multipleOf` alone (C1-04: the backend sets
  `multipleOf: 0.0001` on percentages/weights too, `LedgerSharing.kt:30-62,91-101`):

  | List | Fields (backend `64f9dd8`) | Type in `schema.d.ts` | Runtime (transport §4.1) |
  |---|---|---|---|
  | `MONEY_FIELDS` | `amount`, `netBalance`, `netAmount`, `shareAmount` (`CurrencyBalance.kt`, `ActivityDtos.kt`, `LedgerEntryDtos.kt`, `LedgerBalanceDtos.kt`, `LedgerCrudRequests.kt`, `LedgerExpenseDtos.kt`, `KnownUserDtos.kt`); `debtsTrackedUsd` (`StatsResponse.kt`, added at backend `a308a90`, #682) | `WireAmount` | `{ __wireDecimal }` |
  | `MONEY_MAP_FIELDS` | `customShares` (EXACT, amounts by `userId`) | `Record<string, WireAmount>` | same for the values |
  | `DECIMAL_MAP_FIELDS` | `percentageShares`, `shares` (`LedgerSharing.kt`), `rates` (`CurrencyRatesDtos.kt:109`) | `Record<string, WireDecimal>` (`string & { __brand: 'WireDecimal' }`) | a decimal string; not passed to `moneyFromWire`, `split` takes the weights as strings |

  `openapi-typescript` `transform(schemaObject, { path })` in `scripts/api/openapi-ts.config.mjs` applies the registry;
  generator checks (exit 1, test `scripts/api/wire-fields.test.mjs`): (a) every property with `multipleOf: 0.0001` (or
  a map of such numbers) is in exactly one list; (b) a property from `MONEY_FIELDS` in **any** schema has `multipleOf: 0.0001`;
  (c) `percentageShares` in the output is `Record<string, WireDecimal>`, not `WireAmount`. Check (a) also covers every non-integer `type: number` property, map or array of numbers: it must be in a registry list or on the explicit non-money allowlist `NON_MONEY_NUMBER_FIELDS` (empty today), and a number union other than `number | null` fails. The same registry is written to
  `shared/api/generated/wireFields.ts` and drives the transport's reviver — the type and the runtime do not diverge. After BE-03-4
  (`x-chipin-money` / `x-chipin-decimal`, §7) the generator checks the registry against the extensions and fails on a mismatch.
  Arithmetic, comparison and `Number()` over `WireAmount` do not compile; it can be read only through `moneyFromWire`.
- The domain is `minor: bigint` (`a.minor * 2` and `a.minor + 0.5` will not compile).
- The only place of conversion is the mappers `entities/*/model/toX()` (input) and `toXWire()` (output). `api()` does not touch money.
- **Expense write path (PR 03-14b).** Today the create/update payload is built from JS `number`s: `selectExpensePayload`
  (`store/expenseModalSelectors.ts:161-162, 695-699, 732`, `Number(text)`) and `api/chipin.params.ts:43-51, 72, 80, 95`.
  03-14b moves amounts and exact shares onto `Money` (`parseMoneyInput` from the form text); percentage shares and weights
  become `WireDecimal` strings (they are not money, §4.3 `DECIMAL_MAP_FIELDS`, written by `wireJson` as decimal literals like
  amounts). The body is built only through
  `toCreateLedgerEntryWire` / `toExpensePatchWire` (`moneyToWire`) — the same `toXWire()` mappers the online keys and the
  outbox ops (`ExpenseDraftWire`/`ExpensePatchWire`, §2.1) use, so 03-15a reuses them unchanged. The PR also checks
  `buildExpenseUpdateParams` (`store/expenseModalUpdate.ts:95-130`), which never puts `date` into the PATCH although the type
  allows it: if the form can change the date, the PATCH (and the outbox `patch`) carries it, test "edit only the date → the
  body has `date`"; otherwise `date` is removed from the update type. Test: for the 03-2 snapshot cases the create/update
  bodies carry the same amounts and shares as before, written as decimal literals of scale ≤ 4, with no `number` on the path.
  Done in 03-14b: the draft (`ExpenseDraft`) and the patch (`ExpensePatch`) live in `entities/ledger/model/types.ts`,
  the mappers `toCreateLedgerEntryWire(draft, { clientEntryId? })` / `toExpensePatchWire(patch)` (and the wire types
  `ExpenseDraftWire`, `ExpensePatchWire`) in `entities/ledger/model/toExpenseWire.ts`; `entities/ledger/api/legacyExpenseWire.ts`
  is gone (the settlement body stays as `legacySettlementWire.ts` until 03-21), and so are the number payload types
  `CreateLedgerEntryParams`/`UpdateLedgerExpenseParams` and the unused legacy `api/ledgerApi.ts` `createExpense`/`updateExpense`.
  An amount is now written by `moneyToWire` as a literal of scale 4 (`85.5000` where the legacy client wrote `85.5`): the
  same value for the server; percents and weights are written in their shortest decimal text (`canonicalDecimal`), as before.
  The form has no date field (removed by #327), so `date` is not in `ExpensePatch`/`ExpensePatchWire`; a UI test checks that
  the edit form shows no date input. The editor starts from the domain expense events (`mapActivityExpenseToModalState`
  takes `ExpenseActivityEvent`, the original is kept as `Money` and shortest decimal text), and the 12c bridge
  `legacyExpenseEvent` is deleted. Deviation (03-14b): the amount and the EXACT shares are not re-parsed with
  `parseMoneyInput`: the payload takes the ledger units the form's validation and share preview already parsed (scale 4),
  because `parseMoneyInput` refuses more fraction digits than the currency has and an edit-loaded scale-4 amount (an expense
  of `10.1234` USD) could then not be saved; the payload equals what the preview showed. A form whose currency is not a valid
  code gives no payload (the submit does nothing) instead of sending it. The stepper of percents and weights
  (`stepSplitValue`, `Number(...)` of an integer input) is display input, not the write path, and stays.
- Lint is heuristic (by property names) and catches leftovers in not-yet-migrated code; it does not see `Number(amount)` with an identifier
  (like `settle-up-modal/internal/helpers.ts:50`) — such places are listed in §4.4. Non-money
`toFixed`/Intl (percentages, KMB `helpers/numbers.ts:236`) move to `shared/lib/formatNumber.ts` (in `ignores`).
The rule is introduced **immediately as `error`** (C2-03: `warn` is incompatible with `--max-warnings 0` of 02-C4 and the ban on `warn` in 02 §D0);
existing violations (~29 lines) go into the baseline of the spec 02 mechanism (02 §D7); if 03-1 is merged earlier than 02-C4 — native
ESLint 9 suppressions (`eslint --suppress-rule no-restricted-syntax`, file `eslint-suppressions.json`), which 02 picks up
as is. The baseline only decreases: 03-3 (`entities/`, `features/`), then as migration progresses, 03-18 last.
Deviation (03-18): 03-18 touched no money code and pruned no entry; the money entries still in the baseline leave with
the files that hold them (the legacy money helpers, 03-21).
All rules of this spec (§1.3 queryKey literal, §1.7 `navigator.onLine`, §4.3 money and the `moneyFromWire` import, §6
`zustand`) are registered in the rule registry of 02 §D0 with the class "correctness/boundary" and a hint (C1-14).
This is the **single** definition of the money lint rules across all specs (02 D4 R1 and 02-C12 refer to it).
Location: `config/eslint/project.js` via the helper `restrictedSyntax()` (02-C4); if 02-C4 is not yet merged —
`eslint.config.js`, moved over at 02-C4. Paths are relative to `APP_DIR` (after 04-0 — `apps/app/src/shared/money/**`).

#### 4.4 Migration of existing places

| Place (audit) | Replacement |
|---|---|
| `store/expenseModalStore.ts:161`, `store/expenseModalSelectors.ts:14` `roundMoney` (after D1 — `roundHalfUp`) | `split` / `roundToMinor`; the share preview = `split(total, weights)` — matches backend AUTO/SHARES/PERCENTAGE |
| `expenseModalStore.ts:574` `roundMoney(v).toFixed(2)` | `formatMoney` / input via `parseMoneyInput` |
| 6 copies of the sign split (`basics/BalanceSummaryText.tsx:29`, `store/dashboardSelectors.ts:21`, `components/dashboard-summary/internal/useConnect.ts:19,31`, `store/groupsSelectors.ts:52,94`, `pages/friends-page/components/CurrencyGroupCard.tsx:13`) | a single function `partitionBalances` in `entities/balance/model/partition.ts` based on `displaySign` |
| aggregation by currency ×3 (`store/groupsSelectors.ts:85-106`, `store/users-store/selectors.ts:76`, `features/activity/internal/selectors.ts:70`) | `entities/balance/model/aggregate.ts` based on `sum` |
| `helpers/currencies.ts:20 getBalanceEntriesSummary` + `store/commonSelectors.ts:4 calcBalancesSummary` | `entities/balance/model/summary.ts` based on `convert` (`ApproxMoney`); remove the pass-through |
| `helpers/numbers.ts` `normalizeApiMoneyAmount`, `parseAmountInput`, `getNumberData({isPrice})` | `moneyFromWire`, `parseMoneyInput`, `formatMoneyParts`; the non-money part of `getNumberData` stays in `shared/lib/formatNumber.ts` |
| `components/modals/early-supporter-promo-modal/EarlySupporterPromoModal.tsx:49` `new Intl.NumberFormat` | `formatMoney` |
| `BalanceEntry.netBalance` vs `ApiFriendBalance.netAmount` (`api/chipin.raw.types.ts:5,127`) | a mapper at the boundary: domain `Balance { net: Money }` for both |
| `components/modals/settle-up-modal/internal/helpers.ts:31-32` (`String(Math.abs(netAmount))`), `:50-55` (`Number(amount)`, `maxAmount`, `remainingAmount`) | §4.5: `resolveSettleAmount`, prefill `roundToMinor`, calculation in `Money` (PR 03-21) |

Grep estimate: 29 lines with `roundMoney|parseFloat|Number(` in `store/ helpers/ components/ features/ pages/
basics/`, not all about money. The final list is the suppressions/baseline file created by PR 03-1 (§4.3).

#### 4.5 Settle-up: a remainder smaller than a minor unit is impossible

Shares are computed at scale 4 (10/3 → 3.3334/3.3333/3.3333), input is in currency minor units. The rule:
- `owed: Money` — the exact `abs(balance.net)` of scale 4 from the backend response, **never** reassembled from the field text.
- The field prefill = `roundToMinor(owed)`; if that is `0` (the debt is < 1 minor unit) — one minor unit.
- `resolveSettleAmount(input: Money, owed: Money): Money | null` (`entities/balance/model/settle.ts`):
  `|input − owed| < oneMinor(c)` → **exactly `owed`** (scale 4, "settle in full"); otherwise `input > owed` → `null`
  (button disabled); otherwise `input` (partial repayment, the remainder is ≥ one minor unit).
  `oneMinor(c) = 10^(4 − minorUnits(c))` ledger units. When the first branch fires and `input ≠ owed`, a caption sits under the field —
  `settle:fullSettlementHint` "Will be settled in full: <owed, 4 digits>" (C3-19; a confirmation item in 00).
- Consequence: after settle-up the remainder is either 0 or ≥ 0.01 (USD) — a "tail" of 0.0033 is impossible. Historical tails
  (created before 03-21 or by share distribution) are shown as "< $0.01", with the former settle-up button; the prefill gives
  0.01, `resolveSettleAmount` sends the exact `owed`.
- "Settled" (gray, `balances.settledUp`) — only `displaySign === 0`, i.e. `minor === 0n` (§4.2), as in 01-3.
- The settle-up request body is built by the mapper `toSettleUpWire(amount: Money)` → `moneyToWire`. Settle-up stays online-only (§2.9).
- Done in 03-21: `resolveSettleAmount`, `oneMinor`, `settlePrefill` and `halfSettlePrefill` live in
  `entities/balance/model/settle.ts`; the settle-up modal reads the exact `Balance` (`net: Money`) of the friend
  (`KnownUser.balances`) and of the group member (`selectGroupSettlementOptions` now gives `Balance[]`), limits the
  field to the currency minor units as it is typed (`maxFractionDigits = minorUnits(c)`), parses it with
  `parseMoneyInput` and submits a `SettlementDraft`. `resolveSettleAmount` returns `null` for an input that is not
  positive, so a zero amount sends nothing (the button is disabled; zero is not marked `aria-invalid`, it is simply
  not a payment); an amount above the debt by a minor unit or more is `aria-invalid` with the line
  `friends:settleUp.amountAboveDebt` "The amount is more than the debt"; if the selected currency leaves the
  balances after a refetch, the form sends nothing instead of the typed amount in the fallback currency. The draft is
  declared next to its mapper in `entities/ledger/model/toSettleUpWire.ts`, not in `types.ts` (a write-only
  shape must not change `MODEL_SHAPE_HASH` and bust the persisted cache); `entities/ledger/api/legacySettlementWire.ts`, the unused legacy
  `api/ledgerApi.ts` `createSettlement` and the number `CreateSettlementParams`/`FriendBalance` are gone.
  Deviation (03-21): (1) the mapper is `toSettleUpWire(settlement: SettlementDraft)` in
  `entities/ledger/model/toSettleUpWire.ts` (the whole body, like `toCreateLedgerEntryWire`; the amount goes
  through `moneyToWire`, the currency is the amount's), not a mapper of the bare amount; (2) the caption key is
  `friends:settleUp.fullSettlementHint` "Will be settled in full: {{amount}} {{currency}}" (the settle-up texts
  live in the `friends` namespace, there is no `settle` namespace); its amount is `moneyLedgerText(owed)` (new in
  `shared/money`: all four ledger digits, "3.3350") and the currency code. This caption is a deliberate exception to
  "display is only `Amount.tsx`" (AGENTS.md invariant 4): `Amount` cannot show exactly four ledger digits; (3) the modal shows amounts through
  `basics/numbers/amount/Amount.tsx` (fed by `legacyAmountFromMoney` until `Amount` takes `Money`), so a sub-minor
  debt reads "< 0.01 USD" as in the group and friend cards (03-3), not the `formatMoney` "< $0.01";
  (4) "Half" is half of `owed` (`divideHalfUp` at scale 4), rounded like the prefill (at least one minor unit), so
  Half settles in full any debt below two minor units (owed 0.0150 → Half 0.01 → 0.0150 sent); (5) `shared/money`
  also exports `ledgerUnitsPerMinor` (used by `oneMinor`) and `divideHalfUp` (used by Half).

### 5. Type generation from OpenAPI

#### 5.1 Choice: axios + `openapi-typescript` + a thin wrapper

We do not take `openapi-fetch`: (1) the 223 lines of interceptors (refresh-on-401 with a session version, Web Locks,
retry flag, outage detection) are covered by `chipin.interceptors*.test.ts` — rewriting auth to middleware without
benefit is risky; (2) `fetch` gives no upload progress (`usersApi.ts:45`, `groupsApi.ts:46`); (3) 10 `api/*.test.ts`
files mock axios. The wrapper gives the same type safety path→body→response.

#### 5.2 Where it lives

- `openapi/chipin.yaml` — a snapshot of the spec **in the FE** (the `docs/openapi.md` ban concerns the backend).
- `openapi/BACKEND_VERSION` — the backend **git SHA** the snapshot was taken from; this is the version deployed on prod (not staging).
  Since chipin-backend#236 the backend places `vX.Y.Z` tags/Releases after a prod deploy, but only when the version changes,
  so a tag does not identify the deployed commit (C3-15): prod = the image promoted by `deploy-production.yml` (`workflow_dispatch`,
  `image_tag` = SHA). The value is obtained from the production deployment with the command `gh api 'repos/ChipIn-one/chipin-backend/deployments?environment=production&per_page=1' --jq '.[0].sha'`;
  the newest tag may be noted next to it for humans only.
- `src/shared/api/generated/schema.d.ts` and `wireFields.ts` (committed, not edited by hand, eslint/prettier ignore).
  `specHash.ts` is not generated — the cache buster is defined only in §1.4 (C2-07).
- `src/shared/api/client.ts` — the `api()` wrapper; `src/shared/api/http.ts` — `apiInstance` + interceptors from `api/`.

#### 5.3 Scripts

```jsonc
"api:fetch": "node scripts/api/fetch-openapi.mjs",   // downloads the `openapi-documentation` artifact of the backend CI run for the SHA from openapi/BACKEND_VERSION (BE-03-4, `gh run download -R ChipIn-one/chipin-backend`); writes openapi/chipin.yaml with sorted keys
"api:fetch:staging": "node scripts/api/fetch-openapi.mjs --staging", // CI only: GET https://api-dev.chipin.one/swagger/documentation.yaml, Basic auth
"api:gen":   "node scripts/api/gen-types.mjs && node scripts/offline/write-model-hash.mjs", // openapi-typescript (exact version, no ^) + field registry (§4.3) + MODEL_SHAPE_HASH (§1.4)
"api:check": "npm run api:gen && node scripts/api/check-generated.mjs" // openapi/chipin.yaml is normalized (sorted keys); the generated files match the commit (git status --porcelain: changes and untracked files)
```

- Sync — a PR "chore(api): sync openapi to BE <sha7>" with the label `requires-backend: <sha7>`; it is merged only when the
  backend prod deploy contains this SHA (`gh api …/compare/<sha>...<prod-sha>` = `ahead`/`identical`; PR checklist).
- **Inputs without secrets for the agent (C2-17).** Until BE-03-4 the snapshot is provided by the drift workflow (§5.5), which is also created in 03-4a as the first
  commit: it uses the already existing secrets of the FE repo `CHIPIN_CONTRACT_SWAGGER_USER` / `CHIPIN_CONTRACT_SWAGGER_PASSWORD`
  (read by `contract-smoke.yml`) and publishes `chipin.yaml` as an artifact; the agent takes it with `gh run download`. Sync-PR
  checklist: the owner confirms that the staging SHA the snapshot was taken from = the prod deploy SHA. There are no other manual inputs.
- `openapi-typescript` is pinned to an exact version: the output changes between versions.

#### 5.4 Wrapper

```ts
type Op<P extends keyof paths, M extends Method> = NonNullable<paths[P][M]>;
// PathParams<O>, Query<O>, Body<O> (application/json), Success<O> (200 | 201 json, otherwise void) — infer from Op
export function api<P extends keyof paths, M extends Method & keyof paths[P]>(
  method: M, path: P,
  opts: { params?: PathParams<Op<P, M>>; query?: Query<Op<P, M>>; body?: Body<Op<P, M>>;
          headers?: Record<string, string>; signal?: AbortSignal; onUploadProgress?: AxiosProgressHandler },
): Promise<Success<Op<P, M>>>;
```

- Substitution of `{param}` is **always** through `encodePathSegment()` from spec 01 (01-1.1; the file moves to
  `shared/api/pathSegment.ts`): allowlist `^[A-Za-z0-9_-]+$` (rejects `.`, `..`, `''`, `/`, `%`) + `encodeURIComponent`.
  `encodeURIComponent` alone is not enough: `encodeURIComponent('..') === '..'`. An invalid segment → a rejected Promise
  `InvalidPathSegmentError`. The `apiPath.test.ts` cases are copied into `client.test.ts`.
- Errors — `ApiError { status, code, details, current? }` from `getApiErrorPayload` (`helpers/errors.ts`); `current`
  is filled only for 409 `LEDGER.VERSION_CONFLICT` by parsing the body with the zod `LedgerConflictResponseSchema` (BE-03-1).
- The response and request body go through the lossless transport `shared/api/wireJson.ts` (§4.1): per-request
  `transformResponse: [parseWireJson]` (only `application/json`; 204/non-JSON — as is; error bodies too — hence
  `LedgerConflictResponse.current` arrives with `WireAmount`) and `transformRequest: [stringifyWireJson]` for JSON bodies
  (multipart upload — unchanged). The global `apiInstance` defaults are not touched (legacy `src/api/*` lives as before).
- `api()` does not convert money to `Money` (§4.3) — the mappers do that.
- `publicApi()` (03-5) is `api()` on the public Axios instance without the auth interceptors: `api()` cancels an
  anonymous request (no token → `AuthRequestCancelledError`), so a logged-out visitor's public query (`/stats`) needs
  it. Its type accepts only the `security: []` operations (`PublicOperations`, generated by `api:gen` from the snapshot,
  fail-closed: public only when the effective `operation.security ?? spec.security` is an empty array; a snapshot without a
  top-level `security` array or with a `$ref` path item fails `api:gen`).

#### 5.5 CI

- PR check (blocking, no network): `npm run api:check`.
- Drift check `.github/workflows/openapi-drift.yml` (once a day + `workflow_dispatch`, next to `contract-smoke.yml`,
  same secrets): `api:fetch:staging` → artifact `chipin.yaml` → `api:gen` → on a diff open/update the issue "OpenAPI drift". Report only, staging is never a source of types
  (staging is ahead of prod — `contract-smoke.yml:30` `api-dev`, swagger is disabled on prod `SwaggerRoutes.kt:16-19`).
- Sync — a separate PR "chore(api): sync openapi".

#### 5.6 Retiring the hand-written types

1. `api/chipin.raw.types.ts`: `Api*` → aliases `components['schemas'][…]`, per domain per PR; then the file is deleted.
2. `api/chipin.types.ts` → domain types `entities/*/model/types.ts` with `Money`; mappers `toX()` are the boundary
   (`moneyFromWire`, Unix seconds → ms). `api/chipin.params.ts` is deleted (`Body<Op<…>>`).
3. `contract-tests/core-api.contract.ts` (877 lines): the field path checks are deleted (the compiler
   guarantees them); auth/session and runtime semantics (`hasExpectedAutoShares`) remain.

#### 5.7 zod only at the boundaries

zod schemas exist for exactly: `OutboxStateSchema` (the whole outbox key), `OutboxOpSchema`,
`FailedOpSchema`, `ConflictDraftSchema` (inside the outbox key), `BroadcastChannel` messages for logout and outbox (`OutboxChannelMessageSchema`:
`changed | status | status-request | settled`, §2.3), the 409 body `LedgerConflictResponseSchema` (§2.5;
money fields — `z.custom<WireAmount>(isWireAmount)`). The localStorage `LocalUser` uses a typed hand-written reader instead: zod on the landing path costs ~24 KB gz. API responses are **not** validated by zod: the format is guaranteed
by generation + drift check + the field registry. The query cache in IDB is protected by the buster = the shape of the domain model (§1.4).

### 6. Store migration (order and risks)

Each step is a separate PR (or two), the old store is deleted in the same PR in which its last reader goes away.
While a store is alive, its action may call `queryClient.invalidateQueries` (a bridge) — there is no reverse direction.

| # | Store | What it becomes | Risk / notes |
|---|---|---|---|
| 1 | `landing-stats-store/` | `entities/stats/api/queries.ts` | low; a pilot of the pattern; after D8 goes to Astro |
| 2 | `dashboardStore.ts` (198) | `dashboard`, `currencyRates` queries; `appMode` → `uiPrefsStore` (zustand) | medium: activity pagination on the dashboard → `useInfiniteQuery`. Deviation (03-8): the dashboard feed lived under `['dashboard','activity']` (legacy `ActivityFeedItem` shape through the legacy `src/api` layer) until 12b moved it to `activity.self` (row 5); balances come from `GET /dashboard/balances` |
| 3 | `users-store/` (283) | `users.self`, `users.known`, `users.premiumPromo` + mutations `updateSelf`, `removeKnownUser`, `uploadAvatar`; `localUser` stays in `helpers/localStorage` | medium: `useSyncUserSettings` (`hooks/useSyncUserSettings.tsx:18-33`) writes the language — read it from `select`, without an effect on every `settings` object |
| 4 | `groupsStore.ts` (660) — 2 PRs | (a) queries `groups.list` (cursor → infinite), `groups.detail`; (b) mutations create/update/leave/kick/remove/join/cover. Deviation (03-10a, 03-10b, 03-10c): `groups.list`, `groups.detail` (`GET /groups/{id}`, 30 s) and `groups.activity` (`GET /groups/{groupId}/activity-previews`, infinite, 30 s, first page persisted) read through `api()` as domain models: since 03-10c the list and the detail map with `toGroup` (`entities/groups/model`; member balances as `Money`, `recentActivities` as `toActivityItems` items, an unreadable balance left out, an unreadable preview an invalid item), and the activity's first page starts from the cached detail (deviation #669: `fetchGroupDetail` is a pure read; the activity query takes the detail's `recentActivities` as `initialData`, only when it has no data, stamped with the detail's `dataUpdatedAt`; a ledger write, a settlement or a kick reloads the list through `refreshGroup`/`startGroupRefresh`: +1 list request, and the kick waits for it; a denied group page reloads the list once; a detail read newer than the list marks it stale, refetched on the next list mount). The shape change of the persisted groups is covered by `MODEL_SHAPE_HASH` (no `QUERY_CACHE_EPOCH` bump). Since 03-11 the group writes (create/update/cover/join/leave/kick/remove) are online mutations in `entities/groups/api/mutations.ts` (`api()` + `toGroup`, `networkMode: 'online'`, `retry: false`, no outbox; the hooks in `hooks/useGroupMutations.ts` refuse them signed out, on the anonymous client or offline, and their `isPending` is `useIsMutating` of the mutation key, shared by every reader as the legacy loading flags were); each carries the auth session version it was made in and writes nothing after that session ended; the cache writes run on the mutation's own client (`entities/groups/api/groupCache.ts`), a written group becomes its detail and seeds its activity's first page when none is cached (a read seeds it through the activity's `initialData`, #669); the store-side effects (the `lastGroupId` reset, the legacy activity store refresh until 03-12) are passed in (`GroupWriteEffects`); a second update of the same group joins the running one; a leave overtaken by a successful rejoin keeps the group. `groupsStore`, `store/legacyGroup.ts`, `api/groupsApi.ts`, the legacy group calls in `api/chipin.ts` and the `group` slices of the loading/errors stores are deleted; `store/groupsList.ts` keeps only the session-start load, the cached-groups read and `invalidateGroup` for the activity store. The group card's latest activity time skips unreadable previews, so a settled group with one may auto-hide slightly earlier. Deviation (03-10b): until the spec 04 data router, a 403/404 detail `ApiError` (it wins over cached data; other failures keep the listed group) shows the group page's existing not-found card instead of a route errorElement (`TODO(04)` at the site); the group page then reloads the list (#669: a hook effect, once per denial; the server's list no longer has the group). The last opened group (expense editor default) is a tab-local UI value `lastGroupId` in `ui-prefs`, reset with the auth-scoped stores. Deviation (#659): after a leave or a removal (`forgetGroup`) the group's detail and activity stay cached while a group page still shows them, but their observers are disabled until it unmounts (no focus, reconnect, invalidation or next-page read of a group that is gone), and they are dropped on unmount; only a rejoin keeps them (#879: the join mutation ends the pending removal, `keepRejoinedGroup`, before it writes the joined group); an update or a cover upload that a leave overtook (the leave succeeded after it was sent and no join succeeded since: the mutations' per-client leave and join counts) writes nothing, neither the detail, the activity nor the list, whether the left group's page is still mounted (its detail and activity are still dropped on unmount; `writeGroupDetail` also skips a group with a pending removal) or has already unmounted. The group feed is cut to its first page (keeping its age and invalidation) when its last reader unmounts with no load running, so the next mount's refetch is one request; offline (#881) an unmount keeps every loaded page, and once the network is back every group feed that still has no observer and no running load is cut to its first page, keeping its age and invalidation (a feed shown again meanwhile keeps its pages). The self feeds (row 5) and the group feeds share one online waiter per query client (`runWhenOnline` in `shared/offline/network.ts`) | **high**: module-level `inaccessibleGroupIds` and mutation generation (`groupsStore.ts:105-131`) → 403/404 on detail = `ApiError`, the route shows an errorElement (spec 04 §2.5). The cycle with activity disappears: group activity pagination moves to the `groups.activity` query |
| 5 | `activity-store/` (443) | `activity.self` (infinite), `activity.children`. Split (03-12 = 12a + 12b + 12c): 12a the domain activity items and the group feed; since 12b the user's own feeds are `entities/activity` queries under `['activity','self',{ view }]` read through `api()` as domain items (`MODEL_SHAPE_HASH`, no `QUERY_CACHE_EPOCH` bump): `view: 'previews'` is the dashboard feed (`GET /users/self/activity-previews`), `view: 'events'` the flat log of the Activity page (`GET /users/self/activities`, `hooks/useSelfActivity.ts`: requested only signed in on the user's persisted client). A change of the ledger or of the user's groups cuts every self feed to its first page, cancels a running load and invalidates `['activity','self']` (`invalidateSelfActivity`); until 12c the legacy writes and the group writes reach it through the store action `fetchSetActivity` (a bridge, `TODO(12c)`). Deviation (12b): the Activity page's All/Expenses/Settlements filter still narrows the loaded events on the client and is not part of the key: the server's `category=expense` also returns the debt transfer events the page's filter hides, and a per-filter cache would show nothing for a filter not opened before an offline reload. Focus/reconnect (12b): the dashboard previews are cut to their first page and refetched when stale (§1.2); the Activity page's `events` feed refetches on window focus or reconnect only while at most one page is loaded, and with more pages loaded it does nothing (the pages and the scroll position stay; the legacy store never refetched on focus), while a write still invalidates it and an unmount still cuts it to its first page (both feeds; the unmount cut only while the network is usable, #646: offline an unmount keeps every loaded page, and once the network is back every self feed that still has no observer is cut to its first page, keeping its age and invalidation; the write cut of `invalidateSelfActivity` is unconditional). A first load of the Activity page that fails with nothing cached shows an error with Retry; one paused offline shows the no-connection state without Retry. Since 12c the expense history page (`pages/activity-subevents-page`) reads `['activity','children',parentId]` (`GET /users/self/activities/{parentActivityId}/children`, infinite, 60 s, first page persisted, `hooks/useActivityHistory.ts`: requested only signed in on the user's persisted client) through `api()` as domain events (`toActivityChildrenPage`; the creation event repeated on every page, an unreadable one an invalid item and the page shows its "unavailable" header); `ExpenseActivityDetails` gains `sharingMode` (`EXACT` shares as `Money`, percents and weights as decimal text; absent without a snapshot), covered by `MODEL_SHAPE_HASH` (no `QUERY_CACHE_EPOCH` bump). A ledger write made from the history invalidates it on the write's own client (`invalidateActivityChildren`), after a success and after a failure alike: the refetch keeps the shown events, so the page is not blanked and an open delete dialog stays open. The group writes invalidate `activity.self` on their own client (`GroupWriteEffects` get the client). `store/activity-store/`, `store/internal/resourceRequests.ts`, `api/activityApi.ts`, the store's `subevents*` loading/error slices and the bridge `fetchSetActivity` are deleted. Deviation (12c): the history's category filter is not part of the key: the legacy page sent it only on a refresh after a write, never on the first load, so every visible history was the unfiltered chain. Deviation (12c): the expense editor still starts from the legacy event shape (`store/expenseModalEditMapping.ts`, file-locked by 03-14), so the edit button carries the domain events back with `legacyExpenseEvent` (`entities/balance` legacy bridge, `TODO(03-14b)`), from `store/activityExpenseEdit.ts`. Since 03-14b the editor starts from the domain events and the bridge is deleted. A first load that fails with nothing cached (a chain that does not exist, too) shows the error with Retry and the "unavailable" header; one paused offline shows the no-connection state without Retry. As for `groups.detail`, a 403/404 wins over cached data (the same error, no Edit/Delete), and an unreadable later event in the loaded chain disables Edit and Delete | medium: cursor pagination; the view is in the key, the page's category filter is not (the 12b deviation in this row) |
| 6 | `expenseModalStore.ts` + selectors/mapping/update (~1.6k) — order = the PR table (authoritative) | (a) **03-2**: split math of the preview → `money.split` + snapshot tests of the share preview; (b) **03-13**: network calls submit/update/delete → `entities/ledger/api/mutations.ts` (online, no outbox); the draft stays in zustand, before reload it is saved to `sessionStorage` by the `onBeforeAppReload` callback (04 §2.11 item 4; registered by 04-2d, not 03-13). Deviation (03-13): the calls lived in `store/activity-store/actions.ts` (`createExpense`, `updateExpense`, `reverseLedgerEntry`), not in `expenseModalStore.ts`; the modal and the delete button of the activity history now call `hooks/useLedgerMutations.ts` (`ledgerOnlineMutationKeys.createEntry/updateEntry/deleteEntry`; delete covers an expense and a settlement, one endpoint), which refuses a write when signed out, offline or already running. The mutations are `mutationOptions` factories as in 03-11 (`registerLedgerMutationDefaults` arrives with 03-15a); the refresh after a write is injected (`LedgerWriteEffects`: the `activity.self` invalidation on the write's client plus the same dashboard, group and known-users refresh functions as before, each until its own migration step, and the legacy expense-history reload, until 12c makes the history a query). A successful write settles once that refresh has (deviation #659: the group detail read and, since #669, the groups list reload are started, not awaited, so offline they never hold the flag; the group activity reload is still awaited, so with a group page mounted offline the flag still waits for the reconnect, as before); after a failed write the refresh is started but not awaited (offline it would stay paused until the reconnect), and the legacy expense history is not reloaded (its forced reload would close the open delete dialog; 12c invalidates it as a query), while the `activity.self` invalidation still runs: on the app client its refetch tries once, pauses after the retry delay and resumes on the reconnect; after a write that fails on a network drop the self feeds are cut to their first page at once; after the reconnect the first page reloads and further pages load again on demand (the group feed already behaves this way). The body is built from the legacy number payload by `entities/ledger/api/legacyExpenseWire.ts` (same request text; replaced by the `toXWire()` mappers in 03-14b). The now unused activity-store actions (`createExpense`, `updateExpense`, `reverseLedgerEntry`) and their `loadingStore`/`errorsStore` slices went with 03-12 (12c); `createSettlement` (settle-up) is not part of 03-13: since 12c it is an online mutation on `ledgerOnlineMutationKeys.createEntry` (`createSettlementMutationOptions`, body by `legacyCreateSettlementBody`, the same request text; `useCreateSettlement` in `hooks/useLedgerMutations.ts` with the 03-13 session guard, refusals and refresh), so a settle-up and an expense create are one ledger create at a time, and the settle-up form shows a refusal as the other ledger writes do (`toastLedgerWriteError`); (c) **03-14**: remove the store↔selectors cycle (`expenseModalSelectors.ts` gets state as an argument) + co-location in `features/add-expense/`. Deviation (03-14): the cycle was type-level only (the selectors and the edit mapping imported the store's types; `import-x/no-cycle` skips type imports, so it had no suppression to prune): the draft types moved to `store/expenseModalTypes.ts` (the store re-exports them), and the selectors take `ExpenseModalState`, not the store with its actions. The draft store itself stays in `src/store/expenseModal*` (zustand is allowed only in `store/**` and `app/**`); `features/add-expense/` holds the modal UI moved from `components/modals/add-expense-modal/`, with one `index.ts` at the slice root (the nested barrels and the two `useConnect` hooks are gone; the components read the store directly). `helpers/decimalDisplay.ts`, used only by the modal, stays in `helpers/`: it carries a money-rule suppression keyed to its path; (d) **03-14b**: the create/update payload on `Money` through the `toXWire()` mappers (§4.3; done, with its deviation there): `selectExpensePayload` gives an `ExpenseDraft`, `buildExpenseUpdateParams` an `ExpensePatch` without `date`, and `useLedgerMutations` sends them through `toCreateLedgerEntryWire`/`toExpensePatchWire`. The snapshot file's setup helper builds the edit snapshot as the domain event the editor now reads; its `shares`/`feedback` expectations are unchanged, and a new test checks the request body of every case (the typed amount and shares, literals of scale ≤ 4) | high: money. The 03-2 snapshot tests must stay green **unchanged** in 03-13/03-14/03-14b. In 03-13/03-14 only their imports, the setup helper and the display block may change; the `shares` and submit-feedback expectations stay unchanged. The outbox (03-15a) depends on 03-13 and 03-14b. File-lock below |
| 7 | `authStore.ts` (183) | stays zustand (session status is client state); the "reason → what is deleted" table §1.5: `clearUserData` only for `signed_out` and account switch; `resetAuthScopedStores` lives as long as at least one legacy store is alive (each migration PR removes its own line) | medium: the import of 7 stores disappears as migration progresses |
| 8 | `loadingStore.ts`, `errorsStore.ts` (+ selectors) | deleted; `isPending`/`error` from hooks | low, but last: deleted when the `useLoadingStore` counter = 0. Done in 03-18: by then only the auth flags were left. Deviation (03-18): no hook replaced them, each became local state of the action or went: the Google sign-in button keeps its own busy flag (set before `window.location.assign`, the page unloads); the logout-other-devices card keeps a local in-flight flag around the `authStore.logoutOtherDevices` promise (the same pending copy and toasts; the flag belongs to the mounted card, not the session: leaving and reopening Settings while the request runs re-enables the card, where the global flag kept it disabled); the sign-out flag was never set (`signOut` leaves protected UI at once), so its readers lost a constant `false`; the error slices were written by `exchangeGoogleOAuthCode` and `logoutOtherDevices` but read by nobody, so the writes went with the store (the callers still get the rejection). `resetAuthScopedStores` keeps the `uiPrefs` reset and the self-load reset |
| 9 | `backendAvailabilityStore.ts` | `connectivityStore` (1.8) | low |
| 10 | `pwaStore.ts` | stays (UI) | — |
| 11 | `store/internal/resourceRequests.ts` | deleted after step 5 (dedupe/abort is provided by Query through `signal`) | low |

**File-lock `src/store/expenseModal*` (+ `mapping`/`update`).** The PR sequence over these files:
01-3 → 02-C2 (Prettier) → 03-1 (suppressions only) → 03-2 → 03-13 → 03-14 → 03-14b (the 02-D codemods and 05-4 are withdrawn by D31;
these files migrate to named exports and `--cp-*` tokens only in PRs that touch them after 03-14b). Other PRs that mechanically touch these files (02-C3 import-sort, 02-C6 type-imports,
02-C7a floating promises, 02-C11 `noUncheckedIndexedAccess`, 04-0a move) — either before 03-2, or with `--exclude` of these files
until 03-14b (C2-13; the order is recorded in the 00 graph). Only one PR touching these files is open at a time.

`store/index.ts` (a dead barrel) is deleted in PR 03-5 — the sole owner (removed from 02-D3, C2-28). `src/test/renderWithQueryClient.tsx` — a new client
per test (`retry: false`, `gcTime: Infinity`). What stays in zustand: `authStore`, `expenseModalStore` (the draft),
`uiPrefsStore` (appMode, view mode) and `appearanceStore` (theme, spec 05 PR 05-3) — both in `src/store/ui-prefs/`,
`pwaStore`, `connectivityStore`, modals; `no-restricted-imports` `paths: [{ name: 'zustand' }]` (exactly the module
`zustand`) is forbidden outside `src/store/**` and `src/app/**`; `zustand/react/shallow` (`useShallow`, 39 imports in the UI) is allowed
everywhere (C1-18).

**useConnect → useShallow (D12).** 17 `useConnect.ts` files, referenced by 47 prod files; they are deleted in the PR that migrates their store (the sole owner is this spec). Done: 03-18 removed the last five (routing guard, add-expense button, settle-up form, group settings, leave-group dialog) and the two nested `index.ts` that only re-exported them; the `use-connect` baseline of `check-file-layout` is empty.
Server data — `useXQuery()`, UI — `useExpenseModalStore(useShallow(s => ({ amount: s.amount, setAmount: s.setAmount })))`.
New `useConnect` files are banned by `scripts/check-file-layout.mjs` from spec 02 (PR 02-C12, the baseline only decreases).

### 7. Backend requirements (issues)

Revision C3-03: the texts of issues #199, #200, #201, #202, #203 were rewritten from this section verbatim in meaning (2026-10-28).
Each requirement is a verifiable integration test. Error codes — the existing `ErrorResponse { code, details? }`
(`common/dto/ErrorResponse.kt:30-42`), except 409 `LEDGER.VERSION_CONFLICT` (its own schema, below).

#### 7.0 Common contract (introduced by the first merged of BE-03-1/2/5)

- `GET /health` (public) → `{ "status": "UP", "capabilities": string[] }`; the field is always present (may be `[]`).
  Values: `"ledger.clientEntryId"` (BE-03-2), `"ledger.entryVersion"` (BE-03-1), `"client.minVersion"` (BE-03-5).
  A flag appears only in the deploy where the feature is enabled; rolling the feature back removes the flag. Test: each flag ↔ behavior.
- The FE enables offline writing only with all three flags (§2.7).

#### 7.1 Issue table

| ID | Issue | Contract (tests = acceptance) | Blocks |
|---|---|---|---|
| BE-03-1 (#199) | Ledger: `version` + optimistic locking + operation id | **Version:** `version: string` in `LedgerEntryInfo`/`LedgerExpenseInfo`/settlement-info — opaque (the FE compares only for equality), = the `seq` of the entry's last event (`expense_events`/`settlement_events`, `LedgerDbObjects.kt:35,61`) as a decimal string, without COUNT on list queries; changes on **every** event, including `CORRECTED` and `REVERSED`. **Headers:** `If-Match: "<version>"` (in quotes) and `X-Client-Op-Id: <uuid>` on `PATCH`/`DELETE /ledger/entries/{id}`; CORS `allowHeader` for both; before the merge verify on preview that the Vercel proxy passes `If-Match` (otherwise `X-Entry-Version`, the FE changes one constant). **PATCH order:** (1) auth/access; (2) an event with this `X-Client-Op-Id` already exists for the entry → **200 with the current entry, no new event, regardless of `If-Match` and payload**; (3) entry deleted → 404; (4) `If-Match` is present and ≠ current → 409 `LedgerConflictResponse`; (5) apply, store the op-id in the event, 200 with the new entry. **DELETE order:** (1) auth/access; (2) entry already deleted (last event `REVERSED`) → **204 regardless of `If-Match` and op-id**; (3) op-id already exists → 204; (4) `If-Match` ≠ current → 409 `LedgerConflictResponse`; (5) `REVERSED` with op-id → 204. **409:** schema `LedgerConflictResponse { code: "LEDGER.VERSION_CONFLICT", current: LedgerEntryInfo }` (`application/json`), described in OpenAPI as a separate 409 response of PATCH and DELETE; the transient 409 `SYSTEM.CONFLICT` stays an `ErrorResponse`. Without `If-Match` — as now (last-write-wins). The op-id is unique in the pair (`entry_id`, `client_op_id`), stored in the event indefinitely. `/health.capabilities` += `"ledger.entryVersion"`. **Tests:** (a) PATCH op-id A success → repeat with op-id A and a stale `If-Match` → 200, no events added; (b) DELETE of a deleted entry with a stale `If-Match` → 204; (c) PATCH with a stale `If-Match` and a new op-id → 409, `current` equals `GET`; (d) `version` changes after PATCH and after DELETE; (e) the same rules for settlement; (f) the flag in `/health` | PR 03-17 (offline update/delete) |
| BE-03-2 (#200) | Idempotent create by client id | `CreateLedgerEntryRequest.id?: uuid`. Lookup by `id` before payload validation: none → create, **201**; exists, same author, not deleted → **200 with the existing entry regardless of payload** (bodies are not compared, the entry does not change); exists, different author → 409 `LEDGER.ID_CONFLICT` (`ErrorResponse`); exists and deleted → 410 `LEDGER.ENTRY_DELETED` (`ErrorResponse`). Reconcile with chipin-backend#101 (idempotency key), do not duplicate the mechanism. `/health.capabilities` += `"ledger.clientEntryId"`. **Tests:** 201; a repeat with a **different** payload by the same author → 200, the entry unchanged; different author → 409; deleted → 410; the flag in `/health`; a contract test on dev: POST with `id` → 201 | PR 03-17 (offline create); `id` in the create body at all |
| ~~BE-03-3~~ | — | **withdrawn per D21**: the wire stays a JSON number of scale 4, the backend does not change. The number is not reused | — |
| BE-03-4 (#201) | OpenAPI quality + artifact by SHA | unique `operationId`; all bodies are named `components.schemas`; 409 (`LedgerConflictResponse`), 410, 426 responses in the operations; deterministic key order; money fields keep `multipleOf: 0.0001` **and** carry `x-chipin-money: true`, non-money decimals (`percentageShares`, `shares`, `rates`) — `x-chipin-decimal: true` (§4.3); a gradle task/test (based on `src/test/kotlin/common/testing/GeneratedOpenApiDocument.kt`) writes `build/openapi/documentation.yaml`; backend CI publishes it as the artifact `openapi-documentation` on **every** push to `develop` (the run name contains the SHA) — the **primary** source of FE types (§5.3); release tags mark versions, not deploys, `BACKEND_VERSION` = the prod deploy SHA (C3-15). **Tests:** a rebuild → identical YAML; a snapshot test: every field from the §4.3 registry has `multipleOf` and the required extension; unification of `netBalance`/`netAmount` — optional, with versioning | §5 |
| BE-03-5 (#202) | `X-Client-Version` header + `MIN_CLIENT_VERSION` → 426 | Verified: there is no API versioning, the FE does not send a version. Request: `X-Client-Version: <major.minor.patch[-suffix]>`; the backend compares **only** the semver core (the suffix after `-` is dropped). Config `MIN_CLIENT_VERSION` (env; empty = disabled). Below the minimum → **426** `ErrorResponse { code: "CLIENT.OUTDATED", details: { minVersion: "<x.y.z>" } }` for all paths **except** `/health`, `/auth/refresh`, `/auth/logout`. Header missing or not parseable → skip (Postman, clients before the rollout), `warn` log. When the config is enabled, every response carries `X-Min-Client-Version: <x.y.z>`. CORS: `allowHeader(X-Client-Version)`, `X-Min-Client-Version` in `Access-Control-Expose-Headers`. `/health.capabilities` += `"client.minVersion"` when the config is enabled. FE (03-20): the header in one line in the axios request interceptor (`APP_VERSION`, Vite `define`). **Tests:** 426 below the minimum; equal/above → 200; the suffix is ignored (`1.2.0-dev-abc` = `1.2.0`); the three exceptions → 200; no header → 200; the response header; the flag | **mandatory before enabling the outbox** (03-17); outbox gate `outdated` |
| BE-03-6 (#203) | Pinning test "DELETE of a deleted entry = 204" | the behavior is already so (`entries/LedgerEntryCommandService.kt:179-183`: `lockAndReload` → `null` → return); a test now + after BE-03-1: DELETE of a deleted entry **with a stale `If-Match` and any op-id** → 204 | — |
| BE-03-7 | Shared split test vectors | a JSON `ledger-split-vectors.json` (total, weights, expected shares) read by the backend and FE tests | §8 money |
| BE-03-8 (phase 2) | `version` for groups + 409 on `PATCH /groups/{id}` and participant operations | like BE-03-1 | phase 2 |

Minimum version policy (D19, option A, confirmed by the owner on 2026-10-28). For now — only the forced
SW update after 24 h (spec 04 §2.11 item 3). Before enabling the outbox (03-17), BE-03-5 and 03-20 are mandatory.
The 72 h rule: `MIN_CLIENT_VERSION` is raised **only** on an incompatible contract change, and only
after the new FE version has been in prod for ≥ 72 h. On 426 or
`X-Min-Client-Version > APP_VERSION` the FE shows a blocking screen "App update required".
Comparison — only the semver core `major.minor.patch` of both sides (the suffix after `-` is dropped; the prod version is
a pure `x.y.z`, outside prod — `x.y.z-dev-<sha7>`; normalization is defined by spec 02 D7 and spec 04 §1.2/04-0a). The screen
(`showUpdateRequired()`, 04-2d) switches the outbox gate to `outdated` (§2.4)
(`updateServiceWorker(true)` or a reload from `src/app/pwa/ServiceWorkerManager.tsx`, PR 04-2d; `helpers/swUpdates.tsx` has been deleted by then); the outbox is not deleted, the new version reads it
through `OutboxOpSchema` with migrations by `schema`.

Rule for PRs (m9): a PR that raises `MIN_CLIENT_VERSION` **or** changes the schema of a ledger request
(`ExpenseDraftWire`/`ExpensePatchWire`) must add an `OutboxOpSchema` migration (`schema: n → n+1`) and
a fixture test "an old dehydrated outbox → sent by the new client without a 400". `ledgerOutboxMutationKeys` is a frozen
contract. Such a PR (and any PR that changes the ledger wire or `OutboxStateSchema`) requires a release version bump before Promote
(C3-21): without a bump two deploys share one semver core, and `MIN_CLIENT_VERSION` cannot tell them apart; a PR checklist item.

### 8. Tests

Unit `shared/money/*.test.ts` (table-driven):
- `moneyFromWire`/`moneyToWire` (via `parseWireJson`/`stringifyWireJson` on text, not on a number): `"85.5000"`→`855000n`;
  `"85.5"`→`855000n`; `"-0.0000"`→`0n`; `"0.3000"`→`3000n`; `"746251344.6807"`→`7462513446807n`;
  `"96689212322.2351"`→`966892123222351n`; **`"365963032346.3555"`→`3659630323463555n`** (the previous method falsely rejected it);
  **`"899999999999.9997"`→`8999999999999997n`** (double gives `…9998n`); `"632097188007.2934"`→`6320971880072934n`;
  `"999999999999999.9999"`→`9999999999999999999n` (the `decimal(19,4)` maximum); throw `MoneyWireError`:
  `"1000000000000000.0000"`, `"1.23456"`, `"0.00005"`, `"85.50001"`, `"1e3"`, `"-1E-7"`. `moneyToWire` for each
  ok vector → `stringifyWireJson({ amount })` contains exactly the original literal (no exponent). `parseWireJson` →
  `stringifyWireJson` of `{"percentageShares":{"u1":33.3333},"rates":{"EUR":0.9215}}` returns the same text: unquoted
  literals, no precision loss.
- **Sweep (exact, C1-03):** PRNG `mulberry32(20261028)`; 400,000 cases; for each: order `e = floor(rnd()*19)`
  (0…18), `u = randBigInt(10^(e+1))` (4 × 32 bits `% 10^(e+1)`), sign `rnd() < 0.5 ? −u : u`; text `T` = a decimal with
  exactly 4 fractional digits; JSON `{"amount":T,"sharingMode":{"type":"EXACT","customShares":{"u1":T},"percentageShares":{"u1":33.3333}},"rate":1}`
  → `parseWireJson` → `moneyFromWire(amount) === u`, `moneyFromWire(customShares.u1) === u`, `percentageShares.u1` is
  the string `'33.3333'` (not a `WireAmount`), `rate === 1` (number); then `stringifyWireJson` → `amount` in the text === `T`.
  Expected: **0 wrong, 0 rejections** (reference Node 24.21, `../evidence/money/lossless-wire-sweep.mjs`: 400,000 / 0 / 0).
- **Regression anchor:** the test `money-double-path.test.ts` records why the path through double is forbidden:
  `Math.round(JSON.parse('899999999999.9997') * 1e4) !== 8999999999999997` and `JSON.parse('365963032346.3555') * 1e4`
  is not an integer — so that a "simplification" back to `JSON.parse` fails with an explanation.
- Transport: a 204 / `text/html` 502 response passes as is; a 409 error body with `current.amount` → `WireAmount`; the legacy
  `apiInstance` without `api()` still returns a `number` (global defaults unchanged).
- `parseMoneyInput`: `"1 234,5"` (NBSP), `"0,"`, `"1.234"` USD→null / KWD→ok, `"-1"`→null, 16 digits of the integer part→null;
  editing `10.5000 JPY` without changing the text → the original `Money` is sent, a changed `"10,5"` JPY → null (C3-20).
- `mapItems`: a list of 3, the second has `amount` `"1e3"` → `[X, invalid, X]`, Sentry once.
- `wire-fields.test.mjs`: a schema with an unclassified `multipleOf` field → the generator exits 1; `percentageShares` →
  `Record<string, WireDecimal>`.
- `roundToMinor`: `1.0050`→`1.0100`, `-1.0050`→`-1.0100`, `2.6750`→`2.6800` (USD); `0.5000 JPY`→`1.0000`; `1.2345 KWD`→`1.2350`.
- `displaySign`: `0.0000`→0, `0.0040 USD`→1, `-0.0049`→-1; `formatMoney(0.0040 USD, en)` → `< $0.01`.
- `resolveSettleAmount` (owed USD): `3.3333`/input `3.33` → `3.3333`; `3.3350`/`3.33` → `3.3350`; `3.3350`/`3.34` →
  `3.3350`; `3.3333`/`3.32` → `3.32`; `3.3333`/`3.35` → `null`; `0.0001`/prefill `0.01` → `0.0001`; JPY `10.4000`/`10` →
  `10.4000`. Property (1000 seeded cases): `owed − result` = 0 or ≥ `oneMinor`.
- `split`: `100.0000/[1,1,1]`→`[33.3334,33.3333,33.3333]`; `0.0002/[1,1,1]`→`[0.0001,0.0001,0]`; weights
  `['1.5','1']` = `['15','10']`; a zero weight → 0; the order of entries changes who gets the remainder; 1000 random
  inputs (seeded PRNG): sum == total, each ≥ 0, determinism; the BE-03-7 vectors.
- `formatMoney`: `ru`/`en`/`pt-BR` × USD/JPY/KWD, negatives, `signDisplay`.

Persister (`fake-indexeddb/auto`): X's data is not visible to Y; a buster mismatch clears the cache, **the outbox is preserved**;
`Money { minor: 9999999999999999999n }` survives persist → restore (`typeof minor === 'bigint'`, C1-05); a `setItem`
error reaches `reportPersistFailed` (via `retry`); a comment in `entities/*/model/types.ts` does not change
`MODEL_SHAPE_HASH`, a new field does; `maxAge` expired → empty; infinite is persisted as a single
page (via `trimmingPersister`); `clearUserData` deletes all of the user's keys, and a `mutationCache` event /
throttled persist **after** logout writes nothing; IDB throws on `set` → the app works, Sentry once;
a restore longer than 3 s → start without the cache, the late result is not applied; a cold start with a persisted cache → 0 network
requests before `restoreReady` resolves; a repeated provider mount does not duplicate restored mutations (`opId`).

Session and logout (§1.5, one table row per test): `signOut` → IDB without the user's keys, the draft and legacy stores
are empty; remote logout — the same; `expireSession` → the cache, outbox, draft are preserved, `role` removed, legacy stores
reset; `missing`/`error` — nothing deleted; **expire X → sign-in Y → there is no X data in any store, in the draft, or in IDB**
(C1-02); expire X → sign-in X → the draft and the queue are in place; an offline cold start after expiry (hint `false`) →
the sign-in screen, not the cache.

Query retry: an offline refetch of a query with a cache → `fetchStatus: 'paused'`, `status: 'success'`, `data` unchanged, the component
shows no error; a loader while offline with an empty cache does not wait for the network (navigation completes, skeleton).

Outbox (msw `2.15.0` `setupServer` + `onlineManager.setOnline`):
- create → update → update of the same id → delete of another entry offline → online: requests in this `seq` order, one at a
  time, the first update carries `If-Match` from the create response, the second — from the
  first update's response (`outboxVersions`), not a single request without `If-Match`.
- **Order with a slow IDB (D29)**: op1 and op2 on entry X, op3 on entry Y (`seq` 1-3); the write of the failed key is delayed by
  2 s; 422 on op1 → op2 is not sent (msw counts 0 requests of op2) until op1 is resolved, op3 is sent only after the failed write
  resolved; for 401 (refresh 401) and 426 (global gates) op1 stays pending and neither op2 nor op3 goes out. At no moment are two
  requests in flight; a failed write after 422/409 repeats only the write, msw counts exactly one request of op1.
- 409 `SYSTEM.CONFLICT` ×2 then 200 → one write, the operation was never failed, no conflict draft or toast.
- reload (a new client + `restoreOutbox` + `resumePausedMutations`) → the same requests without duplicates; the "anti-example"
  without `mutationDefaults` is not executed (pins 2.1).
- three updates of entry X and one of entry Y; 422 on the second X update → the third X update did not go out, the Y update did,
  failed in `OutboxSheet`; discard → the third X update went out.
- **Discard of the head (C3-04):** offline create A, create B; discard A; online → 0 requests of A, B sent **after** A settles,
  at no moment are two operations `sending`; after reload A does not come back to life (`cancelled`). Discard of a claimed op is
  refused, the request completes normally.
- **Discard of a failed create (C2-15):** create C → 422 (failed), update C skipped as blocked; discard failed C → 0 PATCH/DELETE
  requests for `entryId` C, C is unblocked; ops of other entries were never held.
- **Success, removal write fails:** 200 on op1 of X, the removal write rejects twice → op2 of X is sent with `If-Match` = the
  op1 response version (in-memory `outboxVersions`), op1 is not re-adopted, the removal lands on the third attempt.
- **Order by `seq` (C2-16):** three operations of one `entryId` with decreasing `createdAt` (the clock set back) and increasing
  `seq` → after reload sent in `seq` order.
- **Restore failed / slow (C3-02):** the outbox restore is delayed by 5 s, during that time the user saves an expense →
  it goes out via the online path (or `<OnlineOnly>` offline), the IDB key is not overwritten, after restore all old operations are in place
  and sent; IDB throws on `get` → `outboxRestore = 'failed'`, banner, the key unchanged by a single write.
- **Failed-write window (C3-05):** interrupt the "tab" during the write of the failed key → after reload the operation is in the outbox or in
  failed, never in neither and never in both; a failed-write error → the operation stays pending and keeps the turn; `error` mutations do not
  get into the persisted outbox.
- **Quota (C3-10):** the append write rejects → the success toast is not shown, the operation does not exist and is never sent,
  `offlineWritesAvailable === false`; a write-lock timeout → `offline:saveRetry`, no op, offline writing stays on; `persisted() === false` → the caption in `OutboxSheet`.
- **Settlement (C2-02):** offline deletion/edit of a settlement → 0 outbox mutations, `OnlineOnlyError` from the registry, the button
  disabled; a settlement op written into the key by another tab is moved to failed by `adoptOutboxOps` and never sent.
- **Two create paths (C1-10):** without `offlineWritesAvailable` `useCreateExpense` creates a mutation with the online key
  (`networkMode: 'online'`, no scope), with it — no mutation in the calling tab, one op in the key, and the adopted mutation has
  the outbox key, no `scope`, `retry === false`.
- **Conflict keeps a draft (D28):** update X offline, X changed on the server; online → 409 with `current` → `ledger.entry(X)` and
  the list caches show `current`, the toast `offline:conflictChanged`, `conflictDrafts[X]` holds the changed fields, no op of X
  left in `ops`, a later queued update of X folded into the draft with 0 requests, entry Y unaffected, no dialog; reload → the draft
  is still there; "Open my changes" → the form shows `current` + the draft fields; Save → one PATCH with `If-Match:
  current.version`, the draft is gone; "Discard my changes" → no request, the draft is gone. Delete conflict → the toast
  `offline:conflictNotDeleted`, cache = `current`, no draft, no further request.
- **Conflict on a retried failed op:** update X → 422 (failed, X blocked); "Retry" → 409 → the op is gone from the failed key and
  `retryRequested`, X is unblocked, a draft exists; "Retry" pressed twice (two pings) → one request.
- **Second conflict merges:** a draft of X with `{ description }` exists; another queued update of X with `{ amount }` gets 409 →
  one draft with both fields, the first draft's `createdAt`; an ordinary "Edit" of X opens the form with the draft.
- **Unknown version:** update X with `baseVersion = null` and no create in the queue → GET `ledger.entry(X)` 200 → a draft; GET
  404 → failed `deletedRemotely`, X blocked, no PATCH.
- DELETE 404 = success; PATCH 404 = `deletedRemotely`; 5xx ×3 then 200 → one write; network errors while `onLine === true` → retries
  spaced by backoff, not a tight loop.
- 401 + refresh 401 → the `auth` gate; sign-in with the same userId → sent; with a different one → the dialog and cleanup.
- **Foreign session (C3-07):** two tabs; Y signs in in tab B; tab A (outbox X) reconnects and successfully does a
  refresh → `sub` = Y → 0 ledger requests from outbox X, the `auth` gate is closed, the account-switch flow.
- **Two tabs (D29):** a shared fake IDB, a mock of `navigator.locks` with lock queues (write and drain), a shared `BroadcastChannel`
  mock; tab A holds the drain lock. Create in tab B → the append write resolves in B (the toast "Saved" in B), the `changed` ping
  → A adopts and sends it **exactly once**, the overlay is visible in both, `settled` invalidates in both. **Fresh version
  in a non-drain tab:** A sends update 1 of X; then B enqueues update 2 of X → B's `ledger.entry(X)` already holds the version
  from `settled.entry`, update 2 carries it as `If-Match`, no 409. Concurrent appends from
  A and B (interleaved awaits) → both ops in the key with distinct `seq`, none lost. Close A in the middle of a request → B gets
  the drain lock, re-reads, resends with the same op-id/client id (duplicate create → 200, duplicate PATCH → 200 by
  `X-Client-Op-Id`), the server state has no duplicates. A failed op of entry X in A does not block entry Y appended in B.
  A simultaneous start of two tabs → exactly one tab adopts; "Retry"/"Cancel" pressed in B are executed by A. A hidden/frozen A
  releases the drain lock (no request in flight) → B takes it and sends; a holder that froze without releasing → B still saves
  (append + toast), sends nothing, and its header badge shows "Sending runs in another open ChipIn tab"; a new holder clears a
  stale `sending` claim; one tab hidden → visible (drain lock released and re-acquired) still sends its queued op;
  no `navigator.locks` → offline writing is off, buttons `OnlineOnly`.
- Without the capability `ledger.clientEntryId` create goes out online without the `id` field; with it — with `id`.
- The 51st operation is blocked; older than 14 days → `stale`.

Connectivity: `onLine=false` + network error → banner; 503 + health 503 → the page; 500 + health 200 → request error;
a cold start with `navigator.onLine=false` → `onlineManager.isOnline() === false` before the first event.

---

## Nuances and pitfalls

- **Hydrate order**: `setMutationDefaults` before `hydrate`, otherwise restored mutations have no `mutationFn`.
- **In-flight on tab close**: the request may have arrived, the response not; after reload it will be repeated. This is safe
  only with BE-03-2 (create) and BE-03-1 (update/delete), so offline writing is enabled by a flag after them.
- **`updatedAt` in seconds** is not suitable for locking (two edits in the same second are indistinguishable) → `version`.
- **JSON numbers**: money never passes through `JSON.parse`/double in the new layer — only the lossless transport (§4.1;
  above 2³⁹ ≈ 5.5·10¹¹ double silently confuses neighboring amounts). `JSON.parse` for money — only in the legacy `src/api/*` until
  the store is migrated (as today).
- **`Intl.format(string)`** is ES2023; an old Safari converts the string to a number: exact up to 15 significant digits, above that
  rounding **only on the screen** (data and wire stay exact).
- **Financial data in IDB is not encrypted**: mitigation — `clearUserData` (see 04-security).
- **Tests with `vi.mock('store/…')`** (`01-architecture.md:259-261`) are rewritten to msw +
  `renderWithQueryClient` in the migration PR, not to a new mock path.
- **No Web Locks / BroadcastChannel**: offline writing is off, online only (§2.3).
- **Drain-lock handover during a request** (the holder tab closed or crashed): the response may not have arrived — the next
  holder resends; this is safe only thanks to BE-03-2 (`id`) and BE-03-1 (`X-Client-Op-Id`) (§2.3 "Exactly once").

## Future extension

- Phase 2: groups (rename, participants) — the same `mutationDefaults` and drain turn (blocking per resource id), BE-03-8.
- Background Sync API in the SW to send the queue without an open app — only when the outbox
  is stable; for now the SW does not touch the API (`02-routing-state-pwa.md:121`).
- Local balance recomputation — only if the backend returns a "balance delta" for each expense in the create response
  and the aggregation rule becomes a public contract.
- Switching to `openapi-fetch` is possible if the need for upload progress goes away and the interceptors get simpler.

## What we do NOT do

We do not validate API responses with zod; we do not put the API in SW `runtimeCaching`; we do not recompute balances offline;
settle-up offline never; we do not change axios to fetch; we do not write fake events into the activity caches; we do not keep the
outbox in a query cache key; we do not do a big-bang store migration.

## Phases / PRs

Each PR ≤ ~400 lines of diff (excluding the generated file) and is released independently.

| PR | Contents | Depends on |
|---|---|---|
| 03-1 | `shared/money/` (+ `wire.ts`: `WireAmount`/`WireDecimal`/`isWireAmount`) + unit tests, lint rules §4.3 immediately `error` + suppressions/baseline (in `config/eslint/project.js` if 02-C4 is merged, otherwise in `eslint.config.js`) | 01-3 |
| 03-2 | the expense share preview on `money.split`, snapshot tests before/after | 03-1 |
| 03-3 | `entities/balance` (partition/aggregate/summary), removal of 6 copies, baseline → 0 in `entities/`, `features/` | 03-1 |
| 03-4a | `openapi/chipin.yaml` + `BACKEND_VERSION` (SHA), drift workflow (as the first commit, provides the snapshot), `api:*` scripts, the field registry `wire-fields.mjs` + transform + generator checks, `MODEL_SHAPE_HASH`, generated, PR check | 01-1, 03-1 |
| 03-4b | the transport `shared/api/wireJson.ts` (`lossless-json`, reviver by `wireFields.ts`, stringify), the `api()` wrapper on `encodePathSegment` + per-request transforms, `client.test.ts`, sweep §8; lint (C1-11, §4.3): `moneyFromWire`/`moneyToWire` are imported only in `entities/*/model/**` (`no-restricted-imports` `importNames` for the other paths, `error`) | 03-4a |
| 03-5 | QueryClient, provider without persistence, `renderWithQueryClient`, eslint-plugin-query, landing-stats pilot, delete `store/index.ts` | 03-4b |
| 03-6 | `connectivityStore` (from `onlineManager`), error classification, `OfflineBanner`, a page for backend-down only | 03-5 |
| 03-7a | the cache persister (string-storage + `persistCodec`, `retry`→Sentry, `trimmingPersister`), buster §1.4, `LocalUser.id` + a typed hand-written reader, `restoreReady` + the hydration gate, `shared/offline/network.ts` (`isNetworkUsable`, `setOnline`, probe, lint `navigator.onLine`), stubs `isEntryWithPendingOp = () => false` and a no-op `outboxGate` | 03-5 |
| 03-7b | `clearUserData` (order §1.5, including legacy stores and the draft), the "reason → what is deleted" table + a test per row, the draft with `ownerId`, expiry: only `role`, offline cold start + `sessionMode`, the account switch without a dialog (`clearUserData(X)`; the §1.5 dialog exists only for a non-empty outbox and comes with 03-16a) | 03-7a |
| 03-8 | dashboard + currency rates. Lands only after 03-7b: since 03-7a every user has a persisted client of their own (`clientFor`); after a sign-out the tree runs on a fresh anonymous client while X's client and IDB key survive until `clearUserData` (03-7b), so clearing one client from `resetAuthScopedStores` (the earlier bridge) no longer reaches them | 03-7b |
| 03-9 | users-store; after 03-7b for the same reason as 03-8 | 03-7b |
| 03-10/11 | groups queries / groups mutations | 03-9 |
| 03-12 | activity + removal of `resourceRequests.ts`; lands as 12a (domain items, group feed; before 03-10c), 12b (`activity.self`: dashboard feed and Activity page) and 12c (`activity.children`, store and `resourceRequests.ts` removal), §6 row 5 | 03-11 |
| 03-13 | expense modal: network → `entities/ledger/api/mutations.ts` (`ledgerOnlineMutationKeys`, no `id` in the body), `capabilitiesQueryOptions`. Saving the expense draft into `sessionStorage` before an app reload and restoring it at startup moved to 04-2d (spec 04 §2.11 item 4): the `onBeforeAppReload` hook of `ServiceWorkerManager` arrives there; 03-13 leaves a `TODO(04-2d)` in `store/expenseModalStore.ts` | 03-11 (lands after the self-activity-feed part of 03-12 and before its expense-history part; the activity-feed refresh it calls is replaced there) |
| 03-14 | expense modal: breaking the store↔selectors cycle (the draft types into `store/expenseModalTypes.ts`), co-location of the modal UI in `features/add-expense/` (the draft store stays in `store/`; §6 row 6) | 03-13 |
| 03-14b | expense create/update payload on `Money` (§4.3): `selectExpensePayload`/`expenseModalSelectors.ts` and `api/chipin.params.ts` stop building amounts/shares as JS `number` (`Number(text)`, `expenseModalSelectors.ts:161-162, 695-699, 732`; `chipin.params.ts:43-51, 72, 80, 95`); the write goes through the `toXWire()`/`moneyToWire` mappers the outbox will use; check `buildExpenseUpdateParams` (`store/expenseModalUpdate.ts:95-130`), which never sends `date` in the PATCH although the type allows it. File-lock `src/store/expenseModal*` applies | 03-14 |
| 03-15a | the outbox core, one tab, **in memory**: `ledgerOutboxMutationKeys` + defaults/callbacks, the path-choice hooks (§2.1), the "expenses only" registry, `seq`, the in-memory queue store behind the §2.3 interface (`enqueueOutboxOp`, `adoptOutboxOps`), `runOutboxOp` + `retryWrite` + the drain turn + gate (global + per-entry block; changes the 03-7a stub interface, §1.6) + `discardOps`/`cancelledOpIds` + `outboxVersions`/`pendingRemovals`, the `owner` check; flag `VITE_FEATURE_OFFLINE_WRITES=false`. Tests: `seq` order one at a time, a failed op of X does not block Y, error classes, discard, settlement guard, two create paths | 03-7b, 03-13, 03-14b; owner confirmation on D3 (00) |
| 03-15b | outbox persistence: `OutboxState` + zod, the `outboxRestore` guard (§1.6), the IDB keys with explicit writes (§2.3), the failed key with an awaited write, the append write + toast, `storage.persist()`, limits 50 (pending + failed; drafts join in 03-16b)/14 days + `stale`, the `auth` gate by the token `sub`. Tests: reload, slow/failed restore, the failed window, quota, foreign session (03-15a review: `FailedOpSchema` keeps the interim reason `conflict` readable; `recheckOutboxOwner` wired on every new access token) | 03-15a |
| 03-15c1 | multiple tabs, part 1 (D29, §2.3): the write lock `chipin-outbox-write:<userId>` (`AbortSignal.timeout(5000)`) around every read-modify-write of the outbox keys and the `clearUserData` delete (flag on), Web Locks in `offlineWritesAvailable`, the persisted `sending { opId, session }` claim (write-locked compare-and-set; compare-and-clear by its own run), the drain-session fence (owner epoch + drain session, a new session at every start of the drain until the drain lock), cancellations cleared per run; a write-lock timeout on append reuses the `saveFailed` toast and keeps offline writing on (the `saveRetry` toast is 03-16a). Tests: concurrent appends from two tabs keep both ops (two module instances, shared fake IDB, a `navigator.locks` mock with lock queues); claim cleared after a 5xx, discard then allowed; claim fails once stopped; a late removal clears only its own claim; removal after success finishes after a stop, restore sees no stale version; claim write rejected → transient retry; drain writes after `clearUserData` are no-ops; a version is deleted only inside the write-locked removal when no op of the entry remains; a stale holder's late clear leaves the new holder's claim; from the 03-15a R2 review: a same-owner 2xx after a stop is processed (removal retried), cancellations are cleared per run, not on stop; from the 03-15b R1 review (blocking): M2, the fence also guards every `outboxGate.close(...)`/`block`, the `whenTurn` re-adoption and every store write of a run (test: X's request in flight across `clearUserData(X)` → Y → `startOutbox(X)` through the refresh listener resolves `stopped`, the new `auth` gate stays open, 0 extra requests); N3, `hasPendingCreateOf` and "is another op of the entry left" read the draft under the write lock, not memory; from the 03-15b R2 review: N4, the session/owner check is repeated after the write lock is taken for the claim, right before the request. Done | 03-15b |
| 03-15c2 | multiple tabs, part 2 (D29, §2.3): append from any tab without adopting it there, the drain lock (released on hidden/freeze/pagehide, re-requested on resume) + adoption on acquisition and on ping (the drain session becomes the lock hold), a new holder clears a stale claim, `BroadcastChannel` (`changed`/`status`/`status-request`/`settled { op, entry }`), re-read on ping and on lock acquisition, `retryRequested`/discard from any tab, the badge hint (state only until a header badge exists), `BroadcastChannel` in `offlineWritesAvailable`, the `clearUserData` step (1) drain-lock release and channel close. Tests: two tabs (an op written in tab B is sent exactly once; the holder dies mid-request → the next holder resends with the same op-id, no duplicate; fresh version in a non-drain tab (checked through the outbox key/memory until the `ledger.entry(id)` query of 03-16a); hidden → visible in one tab still sends; release with a request in flight → aborted, no concurrent resend, no false conflict draft; `whenTurn` of a Retry waits its turn, a hidden tab that gets the drain lock does not drain; `retryingOpIds` cleared after the run, `cancelled` cleaned for never-adopted folded ops; Retry of a failed op is claimed and sent, not `CANCELLED`; re-acquisition during a pending removal keeps the in-memory version, no false conflict; a run in backoff across hidden → visible continues and its op is sent once); the §8 "Two tabs (D29)" rows (a failed op of X in A does not block Y appended in B; a simultaneous start → exactly one tab adopts; Retry/Cancel in B executed by A; a frozen holder → B still saves, badge-hint state; a new holder clears a stale claim; no `navigator.locks` or `BroadcastChannel` → offline writing off); from the 03-15c1 R1 review: a discard in B of A's in-flight op is refused (L4); the drain release aborts the in-flight request before the c1 test "a stale holder's late clear leaves the new holder's claim" keeps its expectation of a second request for the op after a stop and a restart (N5). Done | 03-15c1 |
| 03-16a | `OutboxSheet`, `<OnlineOnly>` + `ONLINE_ONLY_ACTIONS` (including `settlement.delete`/`edit`), the caption at balances, confirm on `signOut` with a non-empty outbox and the outbox part of the account-switch dialog, banners `outboxUnavailable`/`storageNotPersisted`, i18n (en, ru); from 03-15c1: the `saveRetry` toast + i18n (en, ru) for the write-lock timeout on append (until then it shows `saveFailed`, offline writing stays on); from the 03-15a review: the `ledger.entry(id)` query (key factory, `toLedgerEntry`, the optimistic write and the 2xx `setQueryData`, §2.2), the client entry id made at the form's opening + test "a repeated submit queues one op", and settle-up with queued expenses (refuse for the group, or the balance caption); from the 03-15b R1 review: M3, a per-entry count of in-flight appends keeps the version in `noteOutboxVersion` while one exists and the cached version is read inside the append's change (test: edit online, delete appended while the edit is answered → `If-Match` carries the edit's version, no false 409; `setQueryData` alone is not enough); L5, one toast on the outbox path (the write resolves `{ queued: true }` or the hook owns the toast; the form shows no "created" for a queued op), 03-17 does not enable the flag before it; N2, a discard of a failed create writes the outbox key first (its dependent ops leave `ops` before the create leaves failed); from the 03-15c2 R1 review (L3): when `ledger.entry(id)` holds the entry, `settled.entry` is written there and the outbox `settledVersions` is removed (or dropped on every write/refetch of the entry), test "a fresher cached version wins" (no false 409 after an online edit) | 03-15c2 |
| 03-16b | conflict handling per D28 (§2.6): `recordConflict` (fresh `current` into `ledger.entry(id)` and the list caches, later ops of the entry folded into a `ConflictDraft`), the toasts `offline:conflictChanged`/`offline:conflictNotDeleted`, reopening the draft in the edit form and resending with `baseVersion = current.version`, the draft rows in `OutboxSheet`, drafts in the limit of 50 and the sign-out count, i18n ×5; no dialog; from the 03-15b R2 review: `OutboxState.conflictDrafts` (kept as read since 03-15b) is parsed per entry with the same tolerance as `versions` (a bad draft is dropped and reported, the key stays readable); from the 03-16a part A review: `forgetOrphanVersions` does not count conflict drafts, so a drafted entry must not rely on `outboxVersions` (or the drafts are counted there) | 03-16a |
| 03-17 | enable the flag for expenses | BE-03-1, BE-03-2, BE-03-5, 03-16b, 03-20, 04-4a2 in prod (D30: the queue lives in IndexedDB of the app-host origin and does not move between origins; after cutover step 1 the app origin is `app.chipin.one` and no longer changes, step 2 (04-4b) moves only the site, spec 04 §4.1) |
| 03-18 | delete `loadingStore`, `errorsStore`, their selectors; leftover `useConnect` (done; §6 row 8) | 03-14 |
| ~~03-19~~ | withdrawn per D21 (the wire stays a number) | — |
| 03-21 | settle-up on `Money`: `resolveSettleAmount`, prefill `roundToMinor`, "< 0.01", the "settled in full" caption, `toSettleUpWire` (§4.5) | 03-3, 03-4b |
| 03-20 | the new header `X-Client-Version: APP_VERSION` (one line in the axios interceptor), handling 426 and `X-Min-Client-Version` (comparing only `major.minor.patch`, §7) → the `outdated` gate + the blocking "Update required" screen from 04-2d | BE-03-5, 04-2d |

Renames relative to the previous table (for 00/04 and FE issues): 03-4 → 03-4a + 03-4b; 03-7 → 03-7a + 03-7b
(`restoreReady` — from 03-7a); 03-15 → 03-15a + 03-15b + 03-15c; 03-16 → 03-16a + 03-16b; 03-14b added (2026-11-10 review);
03-15c → 03-15c1 + 03-15c2 (2026-11-17, size). Total PRs of spec 03: 27 (was 20).

## Tests / acceptance criteria

Split (C2-34): criteria 7–10 are the PR gate (commands in CI); 1–6, 11, 12 are the owner's QA on a device before 03-17
(a checklist in issue 03-E), their automated analogs are the §8 tests.

1. In airplane mode an installed PWA opens the dashboard, a group and activity with the data of the last session,
   without `BackendUnavailablePage`, with a banner. Verified on an install from `app.chipin.one`; PWAs installed on `chipin.one` before the app moved to the subdomain are not supported: online they open the landing on `chipin.one` (today's landing until cutover step 2, then the site), an offline launch from their icon is not guaranteed (D26, spec 04 §2.11).
2. Offline create, edit and delete an expense. Reload the app offline: the operations are visible in
   "Not sent". Turn the network on: on the server exactly these changes, in `seq` order (skipping blocked entries), without duplicates.
3. Edit an expense on device A offline, the same expense on B online. A online → the toast "This expense was changed by another
   member", A shows B's version, "Open my changes" reopens A's changes on top of it and Save applies them; an offline edit of
   another expense on A is sent meanwhile (a conflict or a failed op on one expense does not hold the others).
4. Settle-up, deleting/editing a settlement, avatar upload, group creation are unavailable offline (disabled + tooltip).
5. Logout with a non-empty queue → a warning; after logout IDB contains no keys of the user.
6. Session expiry during editing does not lose the draft and the queue.
7. `npm run api:check` is green; the drift job opens an issue when the staging spec changes.
8. The money lint rules are `error`, the baseline/suppressions in `entities/`, `features/`, `pages/` are empty.
9. The share preview in the form matches `participantShares` of the backend response on 100% of the BE-03-7 vectors.
10. In `src/` there are no imports of `loadingStore`, `errorsStore`, `resourceRequests`, `dexie`.
11. Two open tabs offline: an expense created in the second is sent exactly once (by whichever tab drains) and in the shared
    `seq` order; closing the sending tab mid-sync does not create a duplicate.
12. Settle-up "in full" for a debt of `3.3333 USD` (the field shows `3.33`) → the balance is exactly 0, the friend can be deleted.

## Open questions

1. Verified (review B, m10): remainder ties are broken by the order of the request's `participantIds` (stable sort,
   `ShareDistribution.kt:41-63`, the order is preserved in `LedgerEntryCommandService.kt:408-421`). Question closed.
2. ASSUMPTION: the refresh token arrives as an httpOnly cookie through the same-origin `/api` rewrite
   (`02-routing-state-pwa.md:105`). If the FE stores it itself, the offline start (1.6) does not change, but
   spec 04 does.
3. Limits 50 operations / 14 days / persist 14 days — confirmed by the owner on 2026-10-28 (D20).
4. "Your share" of a pending expense in `OutboxSheet` (§3) with an explicit caption — confirmed by the owner on 2026-10-28 (D20).
5. For the owner (listed in 00 "Confirmations", before the start of the named PRs): (a) the interpretation of D21 — a lossless transport in the wrapper
   + conversion in the mappers (header; before 03-4b); (b) D3: outbox `networkMode: 'always'` instead of paused (§2.1; before 03-15a);
   (c) D4: buster by the domain model shape instead of zod on the IDB cache (§1.4; before 03-7a); (d) after "sign out on other
   devices" — offline access to the cache after expiry is disabled, distinguishing REVOKED/EXPIRED on the backend — yes/no (§1.5);
   (e) settle-up "tops up" to the exact debt when the difference is < 1 minor unit, with a caption (§4.5; before 03-21);
   (f) phase 2 of D2 (groups/participants offline) without a PR id until 03-17 (§2.9).
