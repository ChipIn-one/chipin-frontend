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

| Operation | API | Store |
| --- | --- | --- |
| Read | `groupsApi.fetchGroups` | `fetchSetGroups` when stored |
| Create | `groupsApi.createGroup` | `createGroup` |
| Update | `groupsApi.updateGroup` | `updateGroup` |
| Remove | `groupsApi.removeGroup` | `removeGroup` |
| Local-only update | — | `setSelectedGroup` |

Do not add `Api`, `Store`, `Effect`, or `Action` suffixes merely to distinguish layers.

## Axios And Types

- Use the shared configured Axios instance; direct `axios` calls outside `src/api` are prohibited.
- Provide a response generic for every request and return `response.data`.
- Axios generics are compile-time only. Add a focused runtime guard/mapper when a contract is untrusted or critical; do not add a validation dependency without approval.
- API input, wire request, wire response, and domain types are distinct only when their shapes or invariants differ.
- Use `Input` for client-facing input, `Request`/`Response` for wire DTOs, and an unsuffixed name for the domain type.
- Avoid no-op mappers when response and domain are intentionally identical.
- When a wire contract is smaller than another response, declare its exact fields explicitly. Do
  not derive it with `Pick` from a broader response unless the backend contract guarantees that
  they are the same resource representation.
- When a wire response and domain shape are identical, export a semantic alias from the core types
  module and keep the `Api*Response` name below the UI boundary.

```ts
export const fetchGroups = (signal?: AbortSignal): Promise<GroupResponse[]> => {
    return apiInstance
        .get<GroupResponse[]>('/groups', { signal })
        .then((response) => response.data);
};
```

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

- Backend responses are the only canonical source for financial and domain state.
- Expense, settlement, reverse, group lifecycle, and friend mutations live in their owning Zustand
  stores. Do not add a generic command layer, mutation store, mutation map, or resource registry.
- After mutation success, the action starts the required canonical fetch actions in one explicit
  `Promise.all`. Read actions record their own normalized errors and resolve, so a refresh failure
  cannot turn a confirmed backend mutation into a rejected mutation Promise. Do not patch balances,
  debts, totals, activity, friends, groups, or dashboard data locally.
- `dashboardStore` owns the `balances` and `activity` fields returned by `/dashboard`. Dashboard
  summaries derive totals from that confirmed response and the separately fetched currency rates.
- Required refreshes are:

  | Mutation | Canonical fetch actions |
  | --- | --- |
  | Expense / settlement / reverse | dashboard, activity, and selected group detail or friends; current activity children when applicable |
  | Group delete / leave | groups, friends, dashboard, activity |
  | Group member removal | selected group detail, friends, dashboard, activity |
  | Friend removal | friends |

- A mutation failure preserves the last confirmed state. A refresh failure after mutation success
  does not change the mutation result or show a second partial-success warning; the UI reports only
  whether the backend operation itself succeeded. There is no automatic or toast-level retry.
- Store mutation actions reject when the backend mutation fails and resolve `void` when the backend
  mutation succeeds. Required canonical refreshes still run after success, but their failures do not
  turn a confirmed mutation into a failed result.
- Store-owned request channels may abort an active GET when a forced refresh or reset supersedes it;
  identical pending reads in the same channel reuse one Promise, and stale responses never update
  state. Each store owns and resets its channels; do not add a global request registry or string key
  map.
