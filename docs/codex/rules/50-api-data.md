# API And Data Rules

## Boundary

```text
UI → store action → resource API module → Axios instance → backend
```

- Pages, features, components, basics, and UI hooks do not import runtime API functions or `apiInstance`.
- API modules do not import Zustand, UI, toast, or loading/error stores.
- API functions return typed domain/response data, never `AxiosResponse`.
- Runtime API calls originate in store actions or an explicitly approved orchestration layer.

## Resource Modules And Namespace Calls

New endpoints belong in focused modules such as `groupsApi.ts`, `usersApi.ts`, `activityApi.ts`, and `ledgerApi.ts`, not the growing legacy `chipin.ts`.

- When a task touches an existing endpoint, move only its related resource block when safe; do not migrate the whole API incidentally.
- Import API modules as namespaces so the transport layer is visible:

```ts
import * as groupsApi from 'api/groupsApi';

groupsApi.createGroup(input);
```

- Do not use bare runtime imports such as `import { createGroup } from 'api/groupsApi'`.
- UI receives `createGroup` from a Zustand selector; `groupsApi.createGroup` remains unambiguous inside the store.

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
- Store actions catch `unknown`, ignore cancellation, normalize other errors, write `errorsStore`, and re-reject.
- Interceptors attach auth/session transport concerns and handle only truly global infrastructure behavior.
- Do not display the same error from interceptor, store, and component.
- Never persist raw Axios errors.

## Cancellation And Concurrency

- Use `AbortController`/`AbortSignal`; do not add deprecated Axios `CancelToken`.
- Add cancellation for search, entity switching, page-bound requests, and latest-response-wins flows, not every short mutation.
- Protect pagination ordering and do not apply stale responses.
- Do not automatically retry mutations. A repeated POST can duplicate financial/domain operations.
- Retry reads only when explicitly required and bounded.
- Old responses after logout must not restore cleared state.
