# Spec 03 — Data layer: TanStack Query, offline outbox, money, OpenAPI types

Implements decisions D2, D3, D4, D5, D21 (replaces D10), D19 (the outbox part) (and D12 for the stores part) from `specs/DECISIONS.md`.
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
(§4.1, Node-sweep proof), outbox — restore guard, cancellation, `seq`, leader fencing, account binding (§2),
the "exit reason → what is deleted" table (§1.5), settlement online only (§2.9), the exact backend contract (§7),
PR split: 03-4a/b, 03-7a/b, 03-15a/b/c, 03-16a/b.

Dependencies on other specs:
- spec 01 (hotfix D1: dedupe `roundMoney`, sign of zero balance — PR 01-3) is merged before PR 03-1;
- spec 04 (D6: data router, loaders, guards) uses `queryOptions` from this spec; loaders with prefetch
  (PR 04-2e) appear only after PR 03-5; the "Update required" screen and the SW are PR 04-2d;
- spec 01 (PR 01-1 `clearLocalUserRole`, D16 "role from localStorage") — in PR 03-7b it is absorbed by the
  `clearUserData()` function from this spec (it keeps only `settings`, as 01-1 requires);
- spec 02: removal of `dexie` — PR 02-B1; ban on new `useConnect.ts` — PR 02-C12; the helper
  `restrictedSyntax()`/`restrictedImports()` and `config/eslint/project.js` — PR 02-C4.
- Monorepo (04-0): 03-1…03-4b can be done before or after 04-0; 03-5 onwards is recommended after 04-0
  (the new folders `src/app`, `src/shared`, `src/entities` are created directly in `apps/app/src/`).
- This spec is the **sole owner** of the removal of `useConnect` (D12) — in the PR that migrates its own store, leftovers in 03-18.
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
2. Outbox = paused mutations with `mutationDefaults` and a shared `scope`, but **persisted separately** from the query cache
   (its own IDB key, a zod schema), so that a buster change does not wipe unsent operations.
3. Conflicts — `version` + `If-Match` + 409 with the current entity (the backend adds this).
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

`queryRetry(failureCount, error)`: network error → `!isNetworkUsable() || failureCount < 3` (in v5 `offlineFirst` pauses
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
| dashboard (balances) | `['dashboard']` | 30 s | yes |
| groups list | `['groups','list']` | 60 s | yes |
| group detail (+ group balances) | `['groups','detail',id]` | 30 s | yes |
| group activity previews | `['groups','activity',id]` (infinite) | 30 s | yes, first page only |
| self activities / previews | `['activity','self',filters]` (infinite) | 30 s | yes, first page only |
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
`no-restricted-syntax` on a literal array in the `queryKey` property outside `entities/*/api/queries.ts`.

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
  dehydrateOptions: { shouldDehydrateQuery: q => q.state.status === 'success' && q.meta?.persist !== false
                        && !isEntryWithPendingOp(q.queryKey),     // an optimistic entry is not persisted (2.2)
                      shouldDehydrateMutation: () => false },   // mutations are persisted by the outbox (2.3)
});
```

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
- `isEntryWithPendingOp(key)`: key `['ledger','entry',id]` and `id` is in `outboxState.entryIds` (§2.3). After
  `restoreOutbox` all `entryId`s from the outbox are invalidated — the persisted cache and the outbox are written independently, after a crash
  they may diverge, the server is the arbiter. Until 03-15a (no outbox yet) 03-7a exports a stub
  `isEntryWithPendingOp = () => false` from the same path; 03-15a changes the implementation, not the path (C2-08).

- Buster — the **single** definition (C2-07, C3-14, C3-30): `${QUERY_CACHE_EPOCH}:${MODEL_SHAPE_HASH}`. What is persisted is
  the domain model (the result of the mappers), so the buster depends on its shape, not on the OpenAPI spec:
  `MODEL_SHAPE_HASH` is written by `scripts/offline/write-model-hash.mjs` (called from `api:gen`, drift is caught by `api:check`):
  the first 12 hex of sha256 over `entities/*/model/types.ts` (paths sorted, each file re-printed with the TypeScript printer with
  `removeComments: true` — comments and formatting do not change the hash) → `shared/offline/modelHash.generated.ts`.
  A change in the shape of a domain type resets the cache automatically (nothing to bump by hand); an OpenAPI sync without a change to
  domain types does not reset the cache. `QUERY_CACHE_EPOCH` (`shared/offline/constants.ts`, an integer) is bumped by hand
  only when the **meaning** of a field changes without a type change (for example seconds → ms; a checklist item of the PR touching
  `entities/*/model/to*.ts`). `OPENAPI_SPEC_HASH`/`specHash.ts` do not exist. The deviation from D4 ("zod on the IDB cache")
  is listed among the owner confirmations (00).
- `meta: { persist: false }` — premium promo, stats. IDB error (Safari private, quota) → Sentry
  `offline.persist_failed` once per session, work continues without persistence.

#### 1.5 Binding to the user, logout, account switch

- `LocalUser` (`helpers/localStorage.ts`) gets `id: string`, read through the zod `LocalUserSchema`
  (invalid → fallback): `userId` is needed before restore, and offline `users/self` cannot be loaded.
- `app/providers/QueryProvider.tsx`: no `userId` → `QueryClientProvider` without persistence; with one →
  `<QueryClientProvider key={userId} client={clientFor(userId)}>`, and restore/subscribe with `persistOptions(userId)` happen outside
  React before the router is created (§1.6, `bootstrapUserCache`). Two users never share one `QueryClient`.
  `onRestored` resolves `restoreReady` (§1.6). The outbox is restored and started **only by the leader tab** on acquiring the
  lock (§2.3): `restoreOutbox(client, userId).then(() => client.resumePausedMutations())`.
- `clearUserData(userId)` (`shared/offline/clearUserData.ts`), strictly in this order: (1) unsubscribe the persister
  (unsubscribe from `persistQueryClientSubscribe`/the provider) and the outbox subscriber on `mutationCache`, leave the
  leader lock (§2.3); (2) `queryClient.clear()`; (2a) `resetAuthScopedStores()` — all still-living legacy zustand stores
  **and** the draft `expenseModalStore.reset()` (C1-02: otherwise between 03-7b and 03-12 Y would see X's groups/balances/friends from
  `groupsStore`/`users-store`/`dashboardStore` and send X's draft); (3) `del` the query key, `chipin:outbox:<userId>`,
  `chipin:outbox-failed:<userId>`, `chipin:outbox-inbox:<userId>`; (4) unmount the provider (change `key`). Otherwise a
  throttled write (1 s) or a `mutationCache` event after `del` brings back X's data. In `LS_KEY_USER` only
  `{ settings }` remains (no `id`/`role` — like `clearLocalUserRole` from 01-1: the landing language/theme after logout are read from `settings`).
- `resetAuthScopedStores()` (`store/authStore.ts:46-53`) **stays** until the end of the migration and is still called on
  **any** transition to `unauthenticated` (as today: `setUnauthenticated`, `expireSession`, OAuth exchange error) —
  legacy stores hold data in memory and are reloaded after sign-in. Each store-migration PR (03-8…03-12, 03-18)
  removes **its own** line from `resetAuthScopedStores` together with the store (PR test: no line, no store). The only
  change in 03-7b: the line `useExpenseModalStore.getState().reset()` moves from `resetAuthScopedStores` to step (2a) of
  `clearUserData`; the draft gets an `ownerId` field and is reset when a user ≠ `ownerId` signs in.

The "reason → what is deleted" table (C3-08; real constants `store/authConstants.ts:9-16`). `clearUserData` is called
**only** by the rows that mention it; any other reason deletes nothing user-related in IDB. Test — for each row.

| Transition (code today) | `unauthReason` | Query cache (IDB) | Outbox / failed / inbox | Draft | `LS_KEY_USER` |
|---|---|---|---|---|---|
| `signOut()` in this tab (`authStore.ts:164`) | `signed_out` | `clearUserData` | delete; non-empty outbox → confirm "N unsent operations will be deleted" | reset | `{ settings }` |
| remote logout via BroadcastChannel (`useCheckSignIn.tsx:41-52`) | `signed_out` | `clearUserData` | delete (the confirm was in the initiating tab) | reset | `{ settings }` |
| `expireSession()` (refresh 401: `authStore.ts:69,128`, `bootstrap/initializeApi.ts:6`); `logoutOtherDevices` → 401 (`authStore.ts:155`) | `expired` | keep | keep, the `auth` gate is closed | keep | delete only `role` (`clearLocalUserRole`, 01-1) |
| `invalid` (reserved, `useAuthToasts.tsx:23`) | `invalid` | keep | keep, the `auth` gate | keep | delete only `role` |
| cold start without a session hint (`useCheckSignIn.tsx:64`) | `missing` | keep (not restored without sign-in) | keep | keep | unchanged |
| refresh at startup failed with non-401 (`useCheckSignIn.tsx:89`); OAuth exchange error (`authStore.ts:100-122`, `OAuthCallbackPage.tsx:37`) | `error` / `persistence_error` | keep | keep | keep | unchanged |
| sign-in of Y when `LocalUser.id === X ≠ Y` or the token `sub` ≠ the outbox owner (§2.3) | — (after sign-in) | `clearUserData(X)` | delete; non-empty → dialog "This device has N unsent operations of account X. Delete and sign in?"; "Cancel" → `signOut()` Y, X's data stays | reset | `{ id: Y, settings }` |

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
  rejects. Until 03-7a (spec 04, 04-2a2) the same path exports `restoreReady = Promise.resolve()`. All loaders
  (spec 04) return the chain `restoreReady.then(…)` (style is free, D24); the data router runs the initial loaders on `createBrowserRouter`,
  before the first render, so the React gate `useIsRestoring()` alone does not save us.
- After the timeout the cache restore is **cancelled**: flag `restoreAborted = true`, a late IDB result is ignored (does not
  `hydrate`), otherwise it would overwrite data loaded after startup.
- **The outbox is restored separately and is not part of `restoreReady`** (C3-02): the leader (§2.3) holds
  `outboxRestore: 'pending' | 'ok' | 'failed'`. There is no timeout — the restore runs to the end. Invariant: **while
  `outboxRestore !== 'ok'`, the key `chipin:outbox:<userId>` is never written** (neither the `mutationCache` subscription nor
  `persistNow`), and new operations take the online path (§2.1: `offlineWritesAvailable === false`, offline — `<OnlineOnly>`).
  `failed` (IDB error, the whole key fails `OutboxStateSchema`, `owner !== userId`) → offline writing is off until
  restart, a non-blocking banner `offline:outboxUnavailable` "Offline saving is unavailable. Operations on the device
  are preserved — restart the app", the key is **not deleted**, Sentry `outbox.restore_failed`. Individual invalid
  operations → failed `unreadable`, and the restore is still `ok`.
- Therefore the provider is a plain `QueryClientProvider` (not `PersistQueryClientProvider`, which starts restore itself on mount): `bootstrapUserCache(userId)` = `persistQueryClientRestore` → `persistQueryClientSubscribe` (the unsubscribe is stored for `clearUserData`), `onRestored` from §1.5 is its continuation. Until `restoreReady` is resolved, the shell (header + skeleton) is rendered, not the routes (`useRestoreReady()` instead of `useIsRestoring()`).
- Offline cold start (PR 03-7b): `useCheckSignIn` (`hooks/useCheckSignIn.tsx:55-91`), on a network error during refresh and
  when `LocalUser.id` + session hint `=== true` are present (the hint is stored as JSON `true`/`false`, `helpers/localStorage.ts`),
  sets `AUTHENTICATED` + a new field `sessionMode = 'offline-cached'`; guards (spec 04 §2.3, `requireSession`) let the user through to
  the cache. On reconnect `refreshAuthSession()`: 401 → `expireSession()`; success → `sessionMode = 'online'`. The outbox `auth` gate
  is opened **not** by a successful refresh but by the owner check (§2.3: `sub` of the new access token === outbox `userId`).
  Until 03-15a `outboxGate` is a no-op stub from `shared/offline/outboxGate.ts` (same path).

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
**All** lifecycle callbacks (`onMutate`, `onError`, `onSuccess`, `onSettled`) live here too, in the defaults: callbacks
passed to `useMutation`/`mutate()` are lost after reload. The hooks `useCreateExpense()` etc. pass only
`mutationKey`; overriding `scope`, `retry`, `mutationFn` and callbacks in the hook is forbidden (the §8 test checks
`mutation.options.scope.id === OUTBOX_SCOPE` and `retry === false` on a mutation created by the hook).

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
  scope: { id: OUTBOX_SCOPE },   // 'outbox' — one mutation at a time, strictly in enqueue order
  networkMode: 'always',         // waiting for network/gate is inside runOutboxOp (2.4), not in the TanStack retryer
  retry: false,                  // the only retry mechanism is the runOutboxOp loop (2.4)
  // Deviation from the letter of D3 (offlineFirst + paused): the TanStack pause fires only between retries and knows
  // nothing about the gate; the wait in runOutboxOp covers both the network and auth/426. Restore still goes through hydrate (isPaused=true)
  // + resumePausedMutations(). An owner confirmation item in 00 (C1-16a/C3-27); 03-15a does not start before it.
  onMutate, onError, onSettled,  // 2.2
  meta: { outbox: true } });
```

The path choice is one function per action; component hooks pass only its result (test both branches):
`useCreateExpense()`, `useUpdateLedgerEntry(entry)`, `useDeleteLedgerEntry(entry)` in `entities/ledger/api/mutations.ts`
take the outbox key **only if** `offlineWritesAvailable` (§2.7) **and** `entry.type === 'EXPENSE'` (for create — always
an expense); otherwise — the online key (offline its button is wrapped in `<OnlineOnly>`, §2.9).

**Operation registry — the "expenses only" guard (C2-02).** `enqueueOutboxOp(op)` (`shared/offline/outboxRegistry.ts`, leader) is
the single entry into the outbox; `OUTBOX_OPS: Record<OutboxKind, { entryKind: 'expense' }>`. For `updateExpense`/`deleteExpense`
it requires `ledger.entry(entryId)` in the cache with `type === 'EXPENSE'`; no cache entry or another type → throw
`OnlineOnlyError` (the operation is not created, the UI shows "Connection required"). A settlement/payment cannot get into the outbox either
from the UI or from a `command` of a follower tab (the leader repeats the same check). The zod `OutboxOpSchema` requires
`entryKind: 'expense'` — a persisted operation of another kind on restore → failed `unreadable`.

`variables` is a serializable `OutboxOp` (JSON primitives; amounts are `WireAmount` (a plain object `{ __wireDecimal }`, §4.1)
via `moneyToWire`):

```ts
type OutboxOpBase = { opId: string; seq: number; owner: string; entryKind: 'expense'; createdAt: number; schema: 1 };
type CreateExpenseOp = OutboxOpBase & { kind: 'createExpense'; entryId: string; groupId: string | null; draft: ExpenseDraftWire };
type UpdateExpenseOp = OutboxOpBase & { kind: 'updateExpense'; entryId: string; baseVersion: string | null; patch: ExpensePatchWire };
type DeleteExpenseOp = OutboxOpBase & { kind: 'deleteExpense'; entryId: string; baseVersion: string | null };
```

- `seq` (C2-16) — a monotonic number assigned by the **leader** on `enqueueOutboxOp` from the `nextSeq` counter of the
  persisted key (§2.3); a follower sends the operation without `seq`. The queue order everywhere (restore, hydrate, overlay) is
  by `seq`; `createdAt` (device clock) is used only for the 14-day `stale` (§2.8).
- `owner` = the `userId` of the outbox owner; checked before every send (§2.3).

The version (an opaque string, BE-03-1) is resolved **inside the outbox**, not from the query cache:
- `baseVersion` at enqueue time = the version from the `ledger.entry(id)` cache; `null` — if the queue holds an unsent create
  of the same `entryId` (no version yet).
- `outboxVersions: Map<entryId, version>` (in the leader's memory + in the persisted outbox, §2.3): after the success of any operation
  with an `entryId`, if operations with the same `entryId` remain in the queue — `set(entryId, response.version)`, otherwise `delete`.
  "Keep mine" in `ConflictDialog` also writes `current.version`.
- On send: `effective = outboxVersions.get(entryId) ?? op.baseVersion` (the map entry takes priority — it is our
  latest write). `effective === null` → terminal `conflict` (GET `ledger.entry(id)` provides `current`).
  PATCH/DELETE **without** `If-Match` are never sent from the outbox.

#### 2.2 Optimistic updates and rollback

Activity is a server projection of events (`api/activity.types.ts`); faking events is fragile. Therefore
**the optimistic state is an overlay from the queue, not a write into the server caches**:
- `useOutboxOverlay()` reads `outboxState` (§2.3; in the leader tab it is written by the subscription to `mutationCache`, in
  the others — by the leader's messages) → `{ pendingCreates, pendingUpdatesByEntryId, pendingDeletes, failed, statusByOpId }`.
  In the feed: a "Not sent" block on top; `entryId ∈ pendingDeletes` — struck through, "will be deleted"; a pending update —
  "changed, not sent" (the `entryId` is present in activity, `api/activity.types.ts:51,95`). Rollback is automatic:
  the mutation was sent — the overlay is recomputed.
- `['ledger','entry',id]`: `onMutate` (in the defaults) — `cancelQueries` + `setQueryData` optimistically; a snapshot is **not**
  used. `onError` (terminal errors only, 2.4) → `invalidateQueries(ledger.entry(id))`: a persisted
  snapshot after reload may be days older than the server. `onSettled` → `invalidateAfterLedgerOp(client, op)`:
  `ledger.entry(id)`, `groupKeys.detail/activity(groupId)`, `['activity']`, `['dashboard']`, `['users','known']`.
  This list replaces the fan-out of `groupsStore.ts:133-155`; follower tabs call the same function on the `settled`
  message from the leader. After reload `onMutate` is not re-run — the overlay and the invalidation from §1.4 are enough.

#### 2.3 Outbox persistence and tabs: one writer per user

Files `shared/offline/outboxLeader.ts`, `outboxPersistence.ts`, `outboxChannel.ts`, `outboxInbox.ts`.
- **Leader.** Each tab with a `userId` calls
  `navigator.locks.request('chipin-outbox:<userId>', () => leaderSession())`, where `leaderSession` returns a promise
  that resolves only on logout/user change/unload. The tab whose callback is running is the **sole writer**:
  it restores, executes and persists the queue. The others wait in line for the lock; when the leader closes, the browser
  hands the lock to the next tab, which does `restoreOutbox` from the same key — there are no orphans and no adoption of them.
- **One key** `chipin:outbox:<userId>` = `OutboxState { owner: userId, epoch: number, nextSeq: number,
  mutations: DehydratedState['mutations'], versions: Record<entryId, version>, cancelled: opId[] }` (zod
  `OutboxStateSchema`, §5.7). Written only by the leader, only when `outboxRestore === 'ok'` (§1.6), on
  `mutationCache` events for `meta.outbox`: `dehydrate(client, { shouldDehydrateQuery: () => false, shouldDehydrateMutation:
  m => m.meta?.outbox === true && m.state.status === 'pending' && !cancelled.has(opId(m)) })` — **`pending` only**
  (C3-05: an `error` mutation after hydrate is not paused and will never resume; failed ones live in their own key). `pending`
  is written with `isPaused = true` (otherwise an in-flight one "hangs" after hydrate). Failed — `chipin:outbox-failed:<userId>` (2.5).
- **Fencing (C3-06).** Each write is an `idb-keyval` `update(key, prev => …)` (a single readwrite transaction): if
  `prev.epoch !== myEpoch`, the updater returns `prev` unchanged and marks "leadership lost" — the tab immediately
  stops being a writer (see below). The new leader's first action is `update(key, prev => ({ ...prev, epoch:
  prev.epoch + 1 }))`, and it restores the queue from that value.
- **Followers** (tabs without the lock) — a read-only view of the queue: `outboxState` from the leader's messages over
  `BroadcastChannel('chipin-outbox:<userId>')` (`state` on every change; on startup the follower sends
  `state-request`, and until the reply it shows the contents of the IDB key). A new operation or an action from `OutboxSheet`
  ("Retry", "Cancel", conflict resolution) in a follower: (1) a write to the **IDB inbox** `chipin:outbox-inbox:<userId>`
  (`update`, map by `opId`) — from this moment the operation is not lost on the device, and the toast "Saved, we will send it when the
  network is back" is shown after this write; (2) a `command { opId }` message to the leader. The leader picks up the inbox at
  startup and on every `command`: `enqueueOutboxOp` (assigns `seq`) → persist → deletes the inbox entry → `ack { opId }`.
  Deduplication by `opId` (already in `mutationCache`, in persisted or in failed → just delete from the inbox and `ack`).
  Messages — zod `OutboxChannelMessageSchema` (§5.7).
- **Frozen leader (C3-06).** The leader sends `heartbeat { epoch }` every 2 s. If a visible
  (`document.visibilityState === 'visible'`) follower tab has an inbox entry without `ack` for 5 s **and** no heartbeat
  has arrived for 5 s, it calls `navigator.locks.request(name, { steal: true }, leaderSession)` and becomes the leader (epoch+1,
  restore, picks up the inbox). A hidden tab does not steal the lock. Without `ack` for 10 s — a toast `offline:saveDelayed` "Saved on the
  device, sending will start when the app becomes active again" (the operation is in the inbox, not lost).
  The former leader after unfreezing: its lock promise is rejected (`AbortError`) **or** the fencing in `update` triggers — it
  sets `isLeader = false`, unsubscribes persistence, its `runOutboxOp` at the nearest check resolves `leadershipLost`
  without a request (2.4) and switches to follower mode. A request it already sent is safe thanks to idempotency
  (BE-03-1 `X-Client-Op-Id`, BE-03-2 `id`, DELETE of a deleted entry = 204).
- **Account binding (C3-07).** The keys and the lock contain `userId`; `OutboxState.owner` is checked on restore
  (`owner !== userId` → `outboxRestore = 'failed'`). The `auth` gate is **closed** when the leader starts and is opened only when
  `sessionUserId() === owner`, where `sessionUserId()` = the `sub` of the current access token (backend: `JwtTokenService.kt:29`
  `withSubject(userId)`; decoded without verifying the signature, only for comparison). The check is repeated on every token
  refresh (interceptor callback `onAccessTokenChanged`) and synchronously **right before every** send
  (`sendOutboxOp`). A mismatch → `outboxGate.close('auth')` + the account-switch flow (§1.5); X's operations are never
  sent with Y's token (for example, Y signed in in a neighboring tab while the refresh cookie is shared).
- `restoreOutbox(client, userId)` (leader only): key → `OutboxStateSchema` → each `variables` → zod `OutboxOpSchema`
  (a union by `kind`, `schema` for migrations), invalid ones → failed `unreadable`; skip `opId`s from `cancelled`, from
  the failed key (C3-05: after a crash between writing failed and rewriting the outbox an operation may be in both — failed
  takes priority) and those already present in `mutationCache` (idempotent on remount/StrictMode); **sort by `seq`**;
  `hydrate`; restore `outboxVersions`; if there are failed ones — close the gate with `blocked` **before**
  `resumePausedMutations()`; then pick up the inbox; `outboxRestore = 'ok'`.
- Repeating an in-flight operation after a leader change/reload is safe per D5: create is idempotent by `id` (BE-03-2), delete
  of a deleted entry = 204, PATCH carries `X-Client-Op-Id: <opId>` — for a repeat of an already applied operation the backend answers 200 with
  the current record before checking `If-Match` (BE-03-1, §7), a deep comparison of `current` with `patch` is not needed.
- **No `navigator.locks` or `BroadcastChannel`** (old browsers): offline writing is off
  (`offlineWritesAvailable = false`), creating/editing/deleting expenses is online only, as before 03-17; reading the cache
  offline works. We do not do leader election via `localStorage`/`storage` events (a check-then-act race).

#### 2.4 Order and gate

- `scope: { id: 'outbox' }` — TanStack v5 starts the next mutation of a scope only after the previous one
  **settled** (success or error), and in enqueue order; after reload — in hydrate order (= `seq`). Therefore the order
  rests on one rule: **`runOutboxOp` settles only with a success, a no-op result or a terminal error**;
  everything non-terminal waits inside it, the mutation stays pending at the head of the scope and nothing overtakes it.
- **`mutationCache.remove()` on a pending outbox mutation is forbidden** (C3-04). Verified in `query-core@5.105.0`
  `mutationCache.ts`: `remove` only cuts the mutation out of the scope, the running `mutationFn` continues, and `canRun` (the first
  `pending` in the scope) immediately lets the next one in — `resumePausedMutations` will start it in parallel with the "removed" one.
  Cancellation is only through `cancelledOpIds` (2.5); settled mutations are removed by gc.
- `outboxGate` (`shared/offline/outboxGate.ts`) — **in the leader's memory**: `close(reason)`, `open(reason)`,
  `whenOpen(opts?): Promise<void>`, reasons `auth | outdated | blocked`. Persistent data (the failed key) only
  restores `blocked` on restore; the decision "may we send" is never read from IDB.

```ts
// Style is free (D24); here: a retry = a recursive call from .catch, not a loop.
function runOutboxOp(op: OutboxOp, opts?: { ignore?: GateReason[] }, attempt = 0): Promise<OutboxResult> {
  const retry = (): Promise<OutboxResult> => runOutboxOp(op, opts, attempt + 1);
  const noOp = (): OutboxResult | null =>            // check after every await and right before sending
    !isLeader() ? LEADERSHIP_LOST : isCancelled(op.opId) ? CANCELLED : null;
  return outboxGate.whenOpen(opts)                    // auth / outdated / blocked
    .then(() => waitForOnline())                      // shared/offline/network.ts (§1.7)
    .then(() => {
      const skip = noOp(); if (skip) return skip;     // discard / leadership lost: not a single request
      if (sessionUserId() !== op.owner) { outboxGate.close('auth'); return retry(); }   // C3-07
      setStatus(op.opId, 'sending'); return sendOutboxOp(op);   // 2xx and the "success-no-op" rows of table 2.5
    })
    .catch((error: unknown) => {                      // retry() is returned from catch — its reject does not land here
      const c = classifyOutboxError(error);           // table 2.5
      if (c.kind === 'network') { setStatus(op.opId, 'waiting-network'); return retry(); }
      if (c.kind === 'transient') { setStatus(op.opId, 'server-unavailable'); return sleep(backoff(attempt)).then(retry); }
      if (c.kind === 'auth' || c.kind === 'outdated') { outboxGate.close(c.kind); return retry(); }
      outboxGate.close('blocked');                    // synchronously, BEFORE the write — the next operation will stop at whenOpen
      return recordFailed(op, c)                      // C3-05: memory + the IDB failed key, the write is AWAITED
        .then(() => { throw new OutboxTerminalError(c); },
              () => { setStatus(op.opId, 'failed-unsaved'); reportPersistFailed(); return retry(); });
      // the failed write did not succeed → the operation stays pending at the head of the scope (the persisted outbox contains it),
      // the gate is blocked; OutboxSheet actions work with the in-memory record. Never "neither in the outbox nor in failed".
    });
}
const backoff = (n: number) => Math.min(1000 * 2 ** n, 60_000) * (0.8 + Math.random() * 0.4);
```

`CANCELLED`/`LEADERSHIP_LOST` are successful results without side effects: `onSettled` in the defaults does not invalidate
the cache for them and does not touch `outboxVersions`.

A single retry policy (replaces the former `outboxRetry`/`retry: outboxRetry`):

| Class | Responses | Behavior | UI status |
|---|---|---|---|
| `network` | network error, timeout | wait for `online`, retry immediately | "waiting for network" |
| `transient` | 5xx, 409 `SYSTEM.CONFLICT` | backoff 1 s → 60 s ±20 %, indefinitely | "server unavailable, will retry" |
| `auth` | 401 after a failed refresh (the interceptor has already called `expireSession()`); token `sub` ≠ `owner` | `auth` gate; opened only by the owner check (2.3) | "sign-in required" |
| `outdated` | 426 `CLIENT.OUTDATED` | `outdated` gate; update screen (03-20) | "app update required" |
| terminal | 400/422, 403, 404 PATCH, 409 `LEDGER.VERSION_CONFLICT`, 409 `LEDGER.ID_CONFLICT`, unknown version | `blocked` gate, failed (write awaited), throw | failed reason |

TanStack **queries** use their own `queryRetry` policy (§1.2); outbox mutations have `retry: false`.

#### 2.5 Error handling

409 is distinguished **by `code`**, not by status: `SYSTEM.CONFLICT` — transient (retry), `LEDGER.VERSION_CONFLICT` —
version conflict (UI), `LEDGER.ID_CONFLICT` — data error.

| Response | Action |
|---|---|
| 2xx | success; `setQueryData` for the entry from the response (including the new `version`), update `outboxVersions` (2.1) |
| network | wait for the network (2.4), operation pending |
| 5xx, 409 `SYSTEM.CONFLICT` | backoff (2.4), operation pending |
| 401 | the interceptor does a refresh. If the refresh failed → `expireSession()`, `auth` gate, operation pending (not failed) |
| 400 / 422 (validation) | failed `validation`, `blocked` gate |
| 403 (no access to the group / excluded) | failed `forbidden`, `blocked` gate |
| 404 on PATCH | failed `deletedRemotely`, `blocked` gate |
| 404/204 on DELETE | success |
| 409 `LEDGER.VERSION_CONFLICT` | failed `conflict`, `current` from the `LedgerConflictResponse` body (BE-03-1, parsed by zod), `blocked` gate |
| 409 `LEDGER.ID_CONFLICT` on create | failed `idConflict` (should not happen; Sentry), `blocked` gate |
| 410 `LEDGER.ENTRY_DELETED` on a duplicate create | success-no-op, remove from the overlay |
| 426 `CLIENT.OUTDATED` | `outdated` gate, operation pending, update screen |

A failed operation is written to `chipin:outbox-failed:<userId>` (zod schema `FailedOpSchema = { op: OutboxOp, reason,
current?: LedgerEntry, failedAt }`) **before** the mutation settles with an error and leaves the persisted outbox (2.4).
**Any failed operation blocks the queue** (`blocked` gate): the following ones may depend on it (an edit of the same expense).

`features/offline-queue/OutboxSheet.tsx` (from the banner/badge in the header): pending ones with a status from `statusByOpId`
("waiting for network" / "sending" / "server unavailable" / "sign-in required" / "update required") and failed ones with a reason.
Actions for failed: "Retry" (except `conflict`), "Cancel operation", for `conflict` — "Resolve" (2.6), for
`deletedRemotely` — "Create as a new expense". "Retry" calls `runOutboxOp(op, { ignore: ['blocked'] })`
**directly, outside the scope** (it waits for `auth`/`outdated`, but not `blocked`) — the other operations stand at `whenOpen`, nothing
overtakes; on success the operation is removed from failed, and if failed is empty — `outboxGate.open('blocked')`.

**Cancellation (discard), C2-15/C3-04** — a single function `discardOps(opIds)` on the leader (in a follower — a `command`):
with a single `update` write it adds `opIds` to `OutboxState.cancelled` and removes them from `mutations`/failed; then
`cancelledOpIds` in memory. A cancelled operation, wherever it is waiting (`whenOpen`, `waitForOnline`, backoff), at the nearest
check resolves `CANCELLED` **without a request**; the next operation starts only after its settle (the scope order
is preserved). An operation in `sending` status (the request has already gone out) cannot be cancelled — the button is hidden until the response.
- Discard pending (including the queue head): `discardOps([opId])`.
- Discard failed **create**: `discardOps([createOpId, …all pending/failed with the same `entryId`])` — dependent edits and
  deletion of the same client id are cancelled together with it (confirmation "and N related edits"); no PATCH/DELETE
  goes out for a non-existent record.
- Discard failed update/delete: only this operation; subsequent operations of the same `entryId` remain (their version comes from
  `outboxVersions`/`baseVersion`, the backend catches a conflict).
- After discard: failed is empty → `outboxGate.open('blocked')`. `cancelled` is cleaned of the `opId` when its mutation has settled.

#### 2.6 Conflict 409

`ConflictDialog` (`features/offline-queue/`): "The expense was changed on another device", a table of differing
fields (amount, currency, description, date, payer, participants, split, category), "Your version" / "Currently on the
server". "Keep mine" — a retry with `baseVersion = current.version` (deliberate last-write-wins, directly);
"Take from server" — `discardOps` (2.5) + `setQueryData(entry, current)`. Delete conflict: "Delete anyway" / "Do not
delete". While the conflict is unresolved, the gate is closed.

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

- A maximum of **50** pending+failed per user; beyond that offline create/edit are disabled ("Too many
  unsent operations — connect to the network").
- Older than **14 days** by `createdAt` (refresh token 30 days, `application.yaml:18`) → failed `stale` ("Send anyway"
  / "Cancel"), no auto-deletion. Limits and `stale` — PR 03-15b.
- **Storage reliability (C3-10).** The first offline operation calls `navigator.storage.persist()` (once per session);
  if `navigator.storage.persisted()` === `false` — a caption `offline:storageNotPersisted` in `OutboxSheet` "The browser may
  delete unsaved data of this device (Safari — after 7 days without opening; a private window — on close)".
  The toast "Saved, we will send it when the network is back" in the leader — only after a successful `persistNow()` (an immediate write
  of the key without throttle). `persistNow()` rejected (quota, private mode): if the operation is not yet in `sending` —
  `discardOps([opId])`, error toast `offline:saveFailed` "Could not save on the device — connect to the network",
  `persistFailedThisSession = true` (offline writing is off until restart); if already `sending` — wait for the response,
  Sentry `outbox.persist_failed`. A success toast without a successful write is impossible.

#### 2.9 What is allowed offline

| Operation | Offline |
|---|---|
| Create / edit / delete an expense (group and personal) | yes, phase 1 |
| Create/rename a group, participants, cover, leave, kick, invites | no in phase 1; phase 2 (D2) — rename and participants through the same outbox after BE-03-8; phase 2 PR ids are not assigned — the deferral is listed among the owner confirmations (00, C1-28) |
| Settle-up / repayment / payment, deletion and editing of a settlement | **never** (see below) |
| Avatar/cover (upload) | never (multipart, progress) |
| User settings (`PATCH /users/self`) | no (phase 2 optionally) |
| Delete a friend, logout other devices | no |

Mechanism: `useRequiresOnline()` (from `isNetworkUsable()` + `sessionMode`) and `<OnlineOnly>` around the button:
offline → `disabled`, `aria-disabled`, tooltip "An internet connection is required"; entry into `GroupSettleUpFlow`
is closed entirely. The constant `ONLINE_ONLY_ACTIONS` + a test that every action is wrapped.

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
   [{ test: isWireAmount, stringify: w => w.__wireDecimal }])` — a decimal literal without an exponent (verified: `{"amount":
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
| `mapItems` | `<T, X>(list: readonly T[], toX: (t: T) => X, id: (t: T) => string) => (X \| InvalidItem)[]` | a `MoneyWireError` in an item's mapper → `{ kind: 'invalid', id }` + Sentry once per `id`; the UI renders a row "This entry cannot be shown" (`common:invalidAmount`), the rest of the list works (C3-13). Other errors propagate |
| `parseMoneyInput` | `(raw: string, c) => Money \| null` | user input: trim, remove spaces/NBSP, one separator `,` or `.`, integer digits ≤ 15 (boundary §4.1), fractional digits ≤ `minorUnits(c)`, ≥ 0. Replaces `parseAmountInput` (`helpers/numbers.ts:302`). Editing an entry with a more precise amount (the backend allows scale 4 for any currency, e.g. `10.5 JPY`, C3-20): the field shows the amount with its digits; while the field text is unchanged, the form sends the original `Money` without parsing; changed text is parsed by `minorUnits(c)` |
| `toUnits` / `fromUnits` | `Money → bigint` / `(bigint, c) → Money` | |
| `add`, `sub`, `negate`, `abs` | `(a, b) => Money` | different currencies → throw `CurrencyMismatchError` |
| `sum` | `(list: Money[], c) => Money` | empty → zero |
| `compare`, `isZero`, `sign` | | `sign` → `-1 \| 0 \| 1` |
| `roundToMinor` | `(m) => Money` | half-up **away from zero** (like `RoundingMode.HALF_UP` and the current `roundHalfUp` from `helpers/numbers.ts:95`) to `minorUnits`, the result is scale 4 again |
| `displaySign` | `(m) => -1 \| 0 \| 1` | `sign(m)` at scale 4. **The single rule "owes/is owed/settled"**: "settled" only when `minor === 0n`; `0.0040 USD` → 1 (the backend counts this as a debt and blocks friend deletion `USER.OUTSTANDING_DEBT`). Such an amount is displayed by `formatMoney` as "< $0.01" (§4.5) |
| `split` | `(total: Money, entries: readonly { userId: string; weight: string }[]) => Money[]` | an exact copy of `distributeAmount` (`ShareDistribution.kt:41-63`): decimal weights are brought to a common integer scale like `toCommonScaleIntegers` (by the max number of fractional digits), `floor(units*w/W)`, the remainder 1 unit each to the largest remainders, ties by index (stable sort). `entries` — **in the exact order of the request body's `participantIds`** (the same array is passed to the mapper `toCreateLedgerEntryWire`). Weights: AUTO = all `'1'`, SHARES = the weights, PERCENTAGE = the percentages; zero weights are allowed. Empty list → `[]`, `W <= 0` → throw |
| `convert` | `(m, rate: string, target) => Money` | approximate (rates), half-up to scale 4; the result is marked in the types as `ApproxMoney` (brand) — it cannot be passed to `moneyToWire` |
| `formatMoney` | `(m, opts?: { locale?; currencyDisplay?: 'symbol' \| 'code'; signDisplay?: 'auto' \| 'always' \| 'exceptZero'; compact?: boolean }) => string` | `roundToMinor` → `Intl.NumberFormat(locale, { style:'currency', currency, minimumFractionDigits: mu, maximumFractionDigits: mu })`. If `m ≠ 0` but `roundToMinor(m) = 0` → "< " + the format of one minor unit with the sign of `m` ("< $0.01"); the sign is conveyed as the text "you owe / you are owed", not a symbol. | A decimal string assembled from `minor` goes in as input (ES2023 `format(string)` — no loss of precision); a formatter cache by `locale+currency+opts` |
| `formatMoneyParts` | same → `Intl.NumberFormatPart[]` | for `basics/numbers/amount/Amount.tsx`, which needs separate parts |

Rules: all functions are pure, without React and i18n. Locale is passed as an argument (taken from `i18n.resolvedLanguage`
in the hook `useFormatMoney()` in `shared/i18n`, not in money).

#### 4.3 Lint restriction

A block for `src/**/*.{ts,tsx}`, `ignores: ['src/shared/money/**', 'src/shared/lib/formatNumber.ts', '**/*.test.*']`:

```js
'no-restricted-syntax': ['error',
  { selector: "CallExpression[callee.name='parseFloat']", message: 'Money: use shared/money (parseMoneyInput/moneyFromWire).' },
  { selector: "CallExpression[callee.name='Number'] > MemberExpression[property.name=/^(amount|minor|netBalance|netAmount|shareAmount)$/]", message: 'Money: no Number() on money fields.' },
  { selector: "CallExpression[callee.property.name='toFixed']", message: 'Money: use formatMoney/roundToMinor.' },
  { selector: "CallExpression[callee.object.name='Math'][callee.property.name='round'] BinaryExpression[operator='*']", message: 'Money: no Math.round(x*N) rounding.' },
  { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']", message: 'Use formatMoney or shared/lib/formatNumber.' },
  { selector: "BinaryExpression[operator=/^[<>]=?$/] > MemberExpression[property.name=/^(amount|minor)$/]", message: 'Money: compare via money.compare/sign.' },
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
  | `MONEY_FIELDS` | `amount`, `netBalance`, `netAmount`, `shareAmount` (`CurrencyBalance.kt`, `ActivityDtos.kt`, `LedgerEntryDtos.kt`, `LedgerBalanceDtos.kt`, `LedgerCrudRequests.kt`, `LedgerExpenseDtos.kt`, `KnownUserDtos.kt`) | `WireAmount` | `{ __wireDecimal }` |
  | `MONEY_MAP_FIELDS` | `customShares` (EXACT, amounts by `userId`) | `Record<string, WireAmount>` | same for the values |
  | `DECIMAL_MAP_FIELDS` | `percentageShares`, `shares` (`LedgerSharing.kt`), `rates` (`CurrencyRatesDtos.kt:109`) | `Record<string, WireDecimal>` (`string & { __brand: 'WireDecimal' }`) | a decimal string; not passed to `moneyFromWire`, `split` takes the weights as strings |

  `openapi-typescript` `transform(schemaObject, { path })` in `scripts/api/openapi-ts.config.mjs` applies the registry;
  generator checks (exit 1, test `scripts/api/wire-fields.test.mjs`): (a) every property with `multipleOf: 0.0001` (or
  a map of such numbers) is in exactly one list; (b) a property from `MONEY_FIELDS` in **any** schema has `multipleOf: 0.0001`;
  (c) `percentageShares` in the output is `Record<string, WireDecimal>`, not `WireAmount`. The same registry is written to
  `shared/api/generated/wireFields.ts` and drives the transport's reviver — the type and the runtime do not diverge. After BE-03-4
  (`x-chipin-money` / `x-chipin-decimal`, §7) the generator checks the registry against the extensions and fails on a mismatch.
  Arithmetic, comparison and `Number()` over `WireAmount` do not compile; it can be read only through `moneyFromWire`.
- The domain is `minor: bigint` (`a.minor * 2` and `a.minor + 0.5` will not compile).
- The only place of conversion is the mappers `entities/*/model/toX()` (input) and `toXWire()` (output). `api()` does not touch money.
- Lint is heuristic (by property names) and catches leftovers in not-yet-migrated code; it does not see `Number(amount)` with an identifier
  (like `settle-up-modal/internal/helpers.ts:50`) — such places are listed in §4.4. Non-money
`toFixed`/Intl (percentages, KMB `helpers/numbers.ts:236`) move to `shared/lib/formatNumber.ts` (in `ignores`).
The rule is introduced **immediately as `error`** (C2-03: `warn` is incompatible with `--max-warnings 0` of 02-C4 and the ban on `warn` in 02 §D0);
existing violations (~29 lines) go into the baseline of the spec 02 mechanism (02 §D7); if 03-1 is merged earlier than 02-C4 — native
ESLint 9 suppressions (`eslint --suppress-rule no-restricted-syntax`, file `eslint-suppressions.json`), which 02 picks up
as is. The baseline only decreases: 03-3 (`entities/`, `features/`), then as migration progresses, 03-18 last.
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

### 5. Type generation from OpenAPI

#### 5.1 Choice: axios + `openapi-typescript` + a thin wrapper

We do not take `openapi-fetch`: (1) the 223 lines of interceptors (refresh-on-401 with a session version, Web Locks,
retry flag, outage detection) are covered by `chipin.interceptors*.test.ts` — rewriting auth to middleware without
benefit is risky; (2) `fetch` gives no upload progress (`usersApi.ts:45`, `groupsApi.ts:46`); (3) 10 `api/*.test.ts`
files mock axios. The wrapper gives the same type safety path→body→response.

#### 5.2 Where it lives

- `openapi/chipin.yaml` — a snapshot of the spec **in the FE** (the `docs/openapi.md` ban concerns the backend).
- `openapi/BACKEND_VERSION` — the backend **git SHA** the snapshot was taken from; this is the version deployed on prod (not staging).
  The backend has no tags or releases (C3-15): prod = the image promoted by `deploy-production.yml` (`workflow_dispatch`,
  `image_tag` = SHA). The value is obtained with the command `gh api 'repos/ChipIn-one/chipin-backend/deployments?environment=production&per_page=1' --jq '.[0].sha'`.
- `src/shared/api/generated/schema.d.ts` and `wireFields.ts` (committed, not edited by hand, eslint/prettier ignore).
  `specHash.ts` is not generated — the cache buster is defined only in §1.4 (C2-07).
- `src/shared/api/client.ts` — the `api()` wrapper; `src/shared/api/http.ts` — `apiInstance` + interceptors from `api/`.

#### 5.3 Scripts

```jsonc
"api:fetch": "node scripts/api/fetch-openapi.mjs",   // downloads the `openapi-documentation` artifact of the backend CI run for the SHA from openapi/BACKEND_VERSION (BE-03-4, `gh run download -R ChipIn-one/chipin-backend`); writes openapi/chipin.yaml with sorted keys
"api:fetch:staging": "node scripts/api/fetch-openapi.mjs --staging", // CI only: GET https://api-dev.chipin.one/swagger/documentation.yaml, Basic auth
"api:gen":   "node scripts/api/gen-types.mjs && node scripts/offline/write-model-hash.mjs", // openapi-typescript (exact version, no ^) + field registry (§4.3) + MODEL_SHAPE_HASH (§1.4)
"api:check": "npm run api:gen && git diff --exit-code -- src/shared/api/generated src/shared/offline/modelHash.generated.ts"
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

zod schemas exist for exactly: `LocalUserSchema` (localStorage), `OutboxStateSchema` (the whole outbox key), `OutboxOpSchema`,
`FailedOpSchema`, `OutboxInboxSchema` (IDB), `BroadcastChannel` messages for logout and outbox (`OutboxChannelMessageSchema`:
`state | state-request | command | ack | heartbeat | settled`, §2.3), the 409 body `LedgerConflictResponseSchema` (§2.5;
money fields — `z.custom<WireAmount>(isWireAmount)`). API responses are **not** validated by zod: the format is guaranteed
by generation + drift check + the field registry. The query cache in IDB is protected by the buster = the shape of the domain model (§1.4).

### 6. Store migration (order and risks)

Each step is a separate PR (or two), the old store is deleted in the same PR in which its last reader goes away.
While a store is alive, its action may call `queryClient.invalidateQueries` (a bridge) — there is no reverse direction.

| # | Store | What it becomes | Risk / notes |
|---|---|---|---|
| 1 | `landing-stats-store/` | `entities/stats/api/queries.ts` | low; a pilot of the pattern; after D8 goes to Astro |
| 2 | `dashboardStore.ts` (198) | `dashboard`, `currencyRates` queries; `appMode` → `uiPrefsStore` (zustand) | medium: activity pagination on the dashboard → `useInfiniteQuery` |
| 3 | `users-store/` (283) | `users.self`, `users.known`, `users.premiumPromo` + mutations `updateSelf`, `removeKnownUser`, `uploadAvatar`; `localUser` stays in `helpers/localStorage` | medium: `useSyncUserSettings` (`hooks/useSyncUserSettings.tsx:18-33`) writes the language — read it from `select`, without an effect on every `settings` object |
| 4 | `groupsStore.ts` (660) — 2 PRs | (a) queries `groups.list` (cursor → infinite), `groups.detail`; (b) mutations create/update/leave/kick/remove/join/cover | **high**: module-level `inaccessibleGroupIds` and mutation generation (`groupsStore.ts:105-131`) → 403/404 on detail = `ApiError`, the route shows an errorElement (spec 04 §2.5). The cycle with activity disappears: group activity pagination moves to the `groups.activity` query |
| 5 | `activity-store/` (443) | `activity.self` (infinite), `activity.children` | medium: cursor pagination, filters in the key |
| 6 | `expenseModalStore.ts` + selectors/mapping/update (~1.6k) — order = the PR table (authoritative) | (a) **03-2**: split math of the preview → `money.split` + snapshot tests of the share preview; (b) **03-13**: network calls submit/update/delete → `entities/ledger/api/mutations.ts` (online, no outbox); the draft stays in zustand, before reload it is saved to `sessionStorage` by the `onBeforeAppReload` callback (04 §2.11 item 4); (c) **03-14**: remove the store↔selectors cycle (`expenseModalSelectors.ts` gets state as an argument) + co-location in `features/add-expense/` | high: money. The 03-2 snapshot tests must stay green **unchanged** in 03-13/03-14. The outbox (03-15a) depends on 03-13. File-lock below |
| 7 | `authStore.ts` (183) | stays zustand (session status is client state); the "reason → what is deleted" table §1.5: `clearUserData` only for `signed_out` and account switch; `resetAuthScopedStores` lives as long as at least one legacy store is alive (each migration PR removes its own line) | medium: the import of 7 stores disappears as migration progresses |
| 8 | `loadingStore.ts`, `errorsStore.ts` (+ selectors) | deleted; `isPending`/`error` from hooks | low, but last: deleted when the `useLoadingStore` counter = 0 |
| 9 | `backendAvailabilityStore.ts` | `connectivityStore` (1.8) | low |
| 10 | `pwaStore.ts` | stays (UI) | — |
| 11 | `store/internal/resourceRequests.ts` | deleted after step 5 (dedupe/abort is provided by Query through `signal`) | low |

**File-lock `src/store/expenseModal*` (+ `mapping`/`update`).** The PR sequence over these files:
01-3 → 02-C2 (Prettier) → 03-1 (suppressions only) → 03-2 → 03-13 → 03-14 → then the 02-D codemods and 05-4 (they skip
these files until 03-14 is merged). Other PRs that mechanically touch these files (02-C3 import-sort, 02-C6 type-imports,
02-C7a floating promises, 02-C11 `noUncheckedIndexedAccess`, 04-0a move) — either before 03-2, or with `--exclude` of these files
until 03-14, like 02-D (C2-13; the order is recorded in the 00 graph). Only one PR touching these files is open at a time.

`store/index.ts` (a dead barrel) is deleted in PR 03-5 — the sole owner (removed from 02-D3, C2-28). `src/test/renderWithQueryClient.tsx` — a new client
per test (`retry: false`, `gcTime: Infinity`). What stays in zustand: `authStore`, `expenseModalStore` (the draft),
`uiPrefsStore` (appMode, view mode) and `appearanceStore` (theme, spec 05 PR 05-3) — both in `src/store/ui-prefs/`,
`pwaStore`, `connectivityStore`, modals; `no-restricted-imports` `paths: [{ name: 'zustand' }]` (exactly the module
`zustand`) is forbidden outside `src/store/**` and `src/app/**`; `zustand/react/shallow` (`useShallow`, 39 imports in the UI) is allowed
everywhere (C1-18).

**useConnect → useShallow (D12).** 17 `useConnect.ts` files, referenced by 47 prod files; they are deleted in the PR that migrates their store (the sole owner is this spec).
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
| BE-03-4 (#201) | OpenAPI quality + artifact by SHA | unique `operationId`; all bodies are named `components.schemas`; 409 (`LedgerConflictResponse`), 410, 426 responses in the operations; deterministic key order; money fields keep `multipleOf: 0.0001` **and** carry `x-chipin-money: true`, non-money decimals (`percentageShares`, `shares`, `rates`) — `x-chipin-decimal: true` (§4.3); a gradle task/test (based on `src/test/kotlin/common/testing/GeneratedOpenApiDocument.kt`) writes `build/openapi/documentation.yaml`; backend CI publishes it as the artifact `openapi-documentation` on **every** push to `develop` (the run name contains the SHA) — the **primary** source of FE types (§5.3); there are no release tags, `BACKEND_VERSION` = the prod deploy SHA (C3-15). **Tests:** a rebuild → identical YAML; a snapshot test: every field from the §4.3 registry has `multipleOf` and the required extension; unification of `netBalance`/`netAmount` — optional, with versioning | §5 |
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
  ok vector → `stringifyWireJson({ amount })` contains exactly the original literal (no exponent).
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
- create → update → update of the same id → delete of another one offline → online: requests in this order, the first update carries
  `If-Match` from the create response, the second — from the first update's response (`outboxVersions`), not a single request without `If-Match`.
- **Strict order with a slow IDB**: the write of the failed key is delayed by 2 s; 422 on op1 → op2 is not sent
  (msw counts 0 requests of op2) until op1 is resolved; the same for 401 (refresh 401) and 426 — op1 stays pending, op2 has not gone out.
- 409 `SYSTEM.CONFLICT` ×2 then 200 → one write, the operation was never failed, `ConflictDialog` was not opened.
- reload (a new client + `restoreOutbox` + `resumePausedMutations`) → the same requests without duplicates; the "anti-example"
  without `mutationDefaults` is not executed (pins 2.1).
- 422 on the second → the third did not go out, failed in `OutboxSheet`; discard → the third went out.
- **Discard of the head (C3-04):** offline create A, create B; discard A; online → 0 requests of A, B sent **after** A settles,
  at no moment are two operations `sending`; after reload A does not come back to life (`cancelled`).
- **Discard of a failed create (C2-15):** create C → 422 (failed), update C is the head, waiting on `blocked`; discard failed C →
  0 PATCH/DELETE requests for `entryId` C, the gate is open, the next operation went out.
- **Order by `seq` (C2-16):** three operations of one `entryId` with decreasing `createdAt` (the clock set back) and increasing
  `seq` → after reload sent in `seq` order.
- **Restore failed / slow (C3-02):** the outbox restore is delayed by 5 s, during that time the user saves an expense →
  it goes out via the online path (or `<OnlineOnly>` offline), the IDB key is not overwritten, after restore all old operations are in place
  and sent; IDB throws on `get` → `outboxRestore = 'failed'`, banner, the key unchanged by a single write.
- **Failed-write window (C3-05):** interrupt the "tab" during the write of the failed key → after reload the operation is in the outbox or in
  failed, never in neither and never in both; a failed-write error → the operation stays pending at the head; `error` mutations do not
  get into the persisted outbox.
- **Quota (C3-10):** `persistNow` reject → the success toast is not shown, the operation is cancelled before sending,
  `offlineWritesAvailable === false`; `persisted() === false` → the caption in `OutboxSheet`.
- **Settlement (C2-02):** offline deletion/edit of a settlement → 0 outbox mutations, `OnlineOnlyError` from the registry, the button
  disabled; a `command` from a follower with a settlement entry is rejected by the leader.
- **Two create paths (C1-10):** without `offlineWritesAvailable` `useCreateExpense` creates a mutation with the online key
  (`networkMode: 'online'`, no scope), with it — the outbox key (`scope.id === OUTBOX_SCOPE`, `retry === false`).
- 409 → `ConflictDialog`; "Keep mine" → a retry with `current.version`; "Take from server" → cache = current.
- DELETE 404 = success; PATCH 404 = `deletedRemotely`; 5xx ×3 then 200 → one write.
- 401 + refresh 401 → the `auth` gate; sign-in with the same userId → sent; with a different one → the dialog and cleanup.
- **Foreign session (C3-07):** two tabs; Y signs in in tab B; tab A (outbox X) reconnects and successfully does a
  refresh → `sub` = Y → 0 ledger requests from outbox X, the `auth` gate is closed, the account-switch flow.
- two "tabs" (a shared fake IDB, a mock of `navigator.locks` with a lock queue, a shared `BroadcastChannel` mock): the leader is the first;
  create in the second → `command` → executed by the leader, `ack`, the overlay is visible in both; close the leader in the middle of a request →
  the second gets the lock, restore, repeat (duplicate create → 200), the result without duplicates; a simultaneous start of two tabs →
  exactly one restore; no `navigator.locks` → offline writing is off, buttons `OnlineOnly`.
- **Frozen leader (C3-06):** a mock leader that stopped sending heartbeat and does not respond; a visible second tab
  creates an expense → an inbox entry, the toast "Saved"; after 5 s `steal` → it is the leader (epoch+1), the operation is sent exactly
  once; the "unfrozen" old leader: its `update` does not change the key (fencing), its `runOutboxOp` → `LEADERSHIP_LOST`
  without a request; a hidden tab does not steal the lock.
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
- **Leader change during a request**: the response may not have arrived — a repeat is safe only thanks to BE-03-2 (`id`) and
  BE-03-1 (`X-Client-Op-Id`).

## Future extension

- Phase 2: groups (rename, participants) — the same `mutationDefaults` + `scope: 'outbox'`, BE-03-8.
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
| 03-7a | the cache persister (string-storage + `persistCodec`, `retry`→Sentry, `trimmingPersister`), buster §1.4, `LocalUser.id` + zod, `restoreReady` + the hydration gate, `shared/offline/network.ts` (`isNetworkUsable`, `setOnline`, probe, lint `navigator.onLine`), stubs `isEntryWithPendingOp = () => false` and a no-op `outboxGate` | 03-5 |
| 03-7b | `clearUserData` (order §1.5, including legacy stores and the draft), the "reason → what is deleted" table + a test per row, the draft with `ownerId`, expiry: only `role`, offline cold start + `sessionMode`, the account-switch dialog (without the outbox part) | 03-7a |
| 03-8 | dashboard + currency rates | 03-5 |
| 03-9 | users-store | 03-5 |
| 03-10/11 | groups queries / groups mutations | 03-9 |
| 03-12 | activity + removal of `resourceRequests.ts` | 03-11 |
| 03-13 | expense modal: network → `entities/ledger/api/mutations.ts` (`ledgerOnlineMutationKeys`, no `id` in the body), `capabilitiesQueryOptions`; registers saving the expense draft into `sessionStorage` via `onBeforeAppReload` (`ServiceWorkerManager`, spec 04 §2.11 item 4) + restoring at startup | 03-12 |
| 03-14 | expense modal: breaking the store↔selectors cycle, co-location `features/add-expense/` | 03-13 |
| 03-15a | the outbox core, one tab, **in memory**: `ledgerOutboxMutationKeys` + defaults/callbacks, the path-choice hooks (§2.1), the "expenses only" registry, `seq`, `runOutboxOp` + gate + `discardOps`/`cancelledOpIds` + `outboxVersions`, the `owner` check; flag `VITE_FEATURE_OFFLINE_WRITES=false`. Tests: order, error classes, discard, settlement guard, two create paths | 03-7b, 03-13; owner confirmation on D3 (00) |
| 03-15b | outbox persistence: `OutboxState` + zod, the `outboxRestore` guard (§1.6), writing only `pending`, the failed key with an awaited write, `persistNow` + toast, `storage.persist()`, limits 50/14 days + `stale`, the `auth` gate by the token `sub`. Tests: reload, slow/failed restore, the failed window, quota, foreign session | 03-15a |
| 03-15c | multiple tabs: Web Lock leader, `BroadcastChannel` (`state`/`command`/`ack`/`heartbeat`), IDB inbox, `steal` for a frozen leader, `epoch` fencing. Tests of two tabs and a frozen leader | 03-15b |
| 03-16a | `OutboxSheet`, `<OnlineOnly>` + `ONLINE_ONLY_ACTIONS` (including `settlement.delete`/`edit`), the caption at balances, confirm on `signOut` with a non-empty outbox and the outbox part of the account-switch dialog, banners `outboxUnavailable`/`storageNotPersisted`, i18n ×5 | 03-15c |
| 03-16b | `ConflictDialog` (§2.6), i18n ×5 | 03-16a |
| 03-17 | enable the flag for expenses | BE-03-1, BE-03-2, BE-03-5, 03-16b, 03-20, 04-4 (in prod: the outbox of the old origin `chipin.one` does not move to `app.chipin.one`, spec 04 §4.1) |
| 03-18 | delete `loadingStore`, `errorsStore`, their selectors; leftover `useConnect` | 03-14 |
| ~~03-19~~ | withdrawn per D21 (the wire stays a number) | — |
| 03-21 | settle-up on `Money`: `resolveSettleAmount`, prefill `roundToMinor`, "< 0.01", the "settled in full" caption, `toSettleUpWire` (§4.5) | 03-3, 03-4b |
| 03-20 | the new header `X-Client-Version: APP_VERSION` (one line in the axios interceptor), handling 426 and `X-Min-Client-Version` (comparing only `major.minor.patch`, §7) → the `outdated` gate + the blocking "Update required" screen from 04-2d | BE-03-5, 04-2d |

Renames relative to the previous table (for 00/04 and FE issues): 03-4 → 03-4a + 03-4b; 03-7 → 03-7a + 03-7b
(`restoreReady` — from 03-7a); 03-15 → 03-15a + 03-15b + 03-15c; 03-16 → 03-16a + 03-16b. Total PRs of spec 03: 25
(was 20).

## Tests / acceptance criteria

Split (C2-34): criteria 7–10 are the PR gate (commands in CI); 1–6, 11, 12 are the owner's QA on a device before 03-17
(a checklist in issue 03-E), their automated analogs are the §8 tests.

1. In airplane mode an installed PWA opens the dashboard, a group and activity with the data of the last session,
   without `BackendUnavailablePage`, with a banner. Verified on an install from `app.chipin.one`; PWAs installed on `chipin.one` before the app moved to the subdomain are not supported: online they open the site, an offline launch from their icon is not guaranteed (D26, spec 04 §2.11).
2. Offline create, edit and delete an expense. Reload the app offline: the operations are visible in
   "Not sent". Turn the network on: on the server exactly these changes, in this order, without duplicates.
3. Edit an expense on device A offline, the same expense on B online. A online → the conflict dialog, both
   options work.
4. Settle-up, deleting/editing a settlement, avatar upload, group creation are unavailable offline (disabled + tooltip).
5. Logout with a non-empty queue → a warning; after logout IDB contains no keys of the user.
6. Session expiry during editing does not lose the draft and the queue.
7. `npm run api:check` is green; the drift job opens an issue when the staging spec changes.
8. The money lint rules are `error`, the baseline/suppressions in `entities/`, `features/`, `pages/` are empty.
9. The share preview in the form matches `participantShares` of the backend response on 100% of the BE-03-7 vectors.
10. In `src/` there are no imports of `loadingStore`, `errorsStore`, `resourceRequests`, `dexie`.
11. Two open tabs offline: an expense created in the second is sent exactly once and in the shared queue order.
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
