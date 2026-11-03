# API And Data Rules

## Boundary

```text
UI → store action → resource API module → Axios instance → backend
```

- Pages, features, components, basics, and UI hooks do not import runtime API functions or `apiInstance`.
- API modules do not import Zustand, UI, toast, or loading/error stores.
- API functions return typed domain/response data, never `AxiosResponse`.
- Runtime API calls originate in store actions.

## Resource Modules And Namespace Calls

New endpoints belong in focused modules such as `groupsApi.ts`, `usersApi.ts`, `activityApi.ts`, and `ledgerApi.ts`, not the growing legacy `chipin.ts`.

- When a task touches an existing endpoint, move only its related resource block when safe; do not migrate the whole API incidentally.
- Import API modules as namespaces so the transport layer is visible:

```ts
import * as groupsApi from 'api/groupsApi';

groupsApi.createGroup(input);
```

- Do not use bare runtime imports such as `import { createGroup } from 'api/groupsApi'`.
- UI receives resource commands from a Zustand selector; `groupsApi.createGroup` remains
  unambiguous below that boundary.

## Naming

- Query keys start with the plural entity (`groups`, `users`, `ledger`, `activity`, `dashboard`,
  `currencyRates`, `stats`) and live in `<entity>Keys`, for example `groupKeys.detail(groupId)`.
- Mappers in `entities/<entity>/model/` are `toX()` (wire → domain) and `toXWire()` (domain → wire).
- Query and mutation hooks follow `40-state.md` §Query And Mutation Naming.

Do not add `Api`, `Store`, `Effect`, or `Action` suffixes merely to distinguish layers.

## Wire Types

- Request and response types come from the backend OpenAPI snapshot (`src/shared/api/generated/`, spec 03
  §5); do not hand-write new `Request`/`Response` types for endpoints it covers. Generated files are not
  edited by hand.
- Calls go through the typed `api()` wrapper over the shared Axios instance; direct `axios` calls outside
  the API layer are prohibited.
- zod validates only data that can have a stale format: IndexedDB cache, outbox, and `localStorage`.
- Legacy `src/api/*` modules keep their hand-written types and the namespace-import rule above until their
  resource moves to the generated client.

## Payloads

- Preserve the semantic difference between missing, `undefined`, `null`, `false`, `0`, and an empty string.
- Do not build payloads or query params with truthiness when `0`/`false` are valid.
- Pass query parameters through Axios `params`; do not concatenate user input into URLs.
- API helpers return `Promise<void>` with `.then(() => undefined)` when no response data is exposed.

## Errors And Interceptors

- API functions reject; they do not show toast or write stores.
- Store read actions catch `unknown`, ignore stale/cancelled requests, normalize other errors, write
  `errorsStore`, and resolve with the confirmed/current state. Mutation actions write `errorsStore`
  and re-reject when the caller must react to a backend failure.
- Response interceptors handle auth/session transport concerns only. They never show generic domain toasts,
  because they cannot distinguish a foreground user action from a background refresh.
- Foreground mutation UI catches the rejected action, resolves known backend `code`/`details`, and uses
  the common localized fallback when the backend payload is unknown. Background refresh failures stay silent.
- Do not display the same error from interceptor, store, and component.
- Never persist raw Axios errors.

## Cancellation And Concurrency

- Use `AbortController`/`AbortSignal`; do not add deprecated Axios `CancelToken`.
- Add cancellation for search, entity switching, page-bound requests, and latest-response-wins flows, not every short mutation.
- Protect pagination ordering and do not apply stale responses.
- Do not automatically retry mutations. A repeated POST can duplicate financial/domain operations.
- Retry reads only when explicitly required and bounded.
- Old responses after logout must not restore cleared state.

## Online-First Domain Mutations

- Backend responses are the only canonical source for financial and domain state. Do not patch balances,
  debts, totals, activity, known-user data, groups, or dashboard data locally.
- After a mutation succeeds, invalidate the affected queries with `invalidateQueries`; the refetch and
  rollback rules are in spec 03 §2.2.
- A mutation failure preserves the last confirmed state. A refresh failure after mutation success does
  not change the mutation result; there is no automatic or toast-level retry.
- Store mutation actions that are not migrated yet start the required canonical fetch actions in one
  explicit `Promise.all` after backend success and resolve `void`; refresh failures do not reject them:

  | Mutation | Canonical fetch actions |
  | --- | --- |
  | Expense / settlement / reverse | dashboard, activity, and selected group detail or known-user data; current activity children when applicable |
  | Group delete / leave | groups, known-user data, dashboard, activity |
  | Group member removal | selected group detail, known-user data, dashboard, activity |
  | Known-user removal | known-user data |

## Activity Client Notes

For activity feed/event wire handling, read
[`docs/api-notes/activity.md`](../../api-notes/activity.md). The link is repository navigation;
an independent Reviewer must not be assumed to load linked documentation automatically.
