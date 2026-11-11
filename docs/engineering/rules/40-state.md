# Zustand State Rules

Until the spec 03 PRs land, TanStack Query, the `api()` wrapper, the generated OpenAPI types
(`src/shared/api/generated/`), and zod do not exist; a task does not install or create them. A new server
read that would need them before they exist is BLOCKED — ask the owner. Existing server stores keep working
as described in the legacy notes below, without new server-data fields (`10-architecture.md` §Ownership).

## Store Choice

- Zustand holds UI state only: modal visibility, drafts, and UI preferences. Server state is TanStack
  Query (spec 03).
- Server stores that spec 03 has not migrated yet are transitional: do not create new ones and do not add
  new server-data fields to them.
- Keep form drafts, hover, and temporary UI state local unless they are shared outside the flow.
- A dedicated global Zustand store is allowed for an explicitly approved, single-active-session
  financial modal that opens from multiple application contexts. It owns draft transitions,
  calculations, validation, and payload construction; it resets with the modal lifecycle, exposes
  narrow stable selectors, and does not perform API requests.
- Store location: `10-architecture.md` §Store Location.

## Central Loading And Errors

Applies to stores that still fetch server data; a store drops these rules when it migrates to TanStack Query.

- `loadingStore` owns operation lifecycle.
- `errorsStore` owns normalized, serializable errors.
- Their section/operation keys match, for example `group.data`, `group.add`, and `dashboard.data`.
- Domain stores such as groups/dashboard do not add their own duplicate `status` or `error` fields.
- Clear only the operation error before retry; reset all errors on logout or full app reset.
- A request finishing with failure must leave `loading`; in the current lifecycle model `fetched` means settled, while `errorsStore` distinguishes failure.
- Raw `AxiosError`, `Response`, and non-serializable objects are not stored.
- Form validation errors remain local; API/domain errors use `errorsStore`.

```ts
type RequestError = {
    code?: string;
    message: string;
    details?: Record<string, unknown>;
};
```

## Subscriptions And Selectors

- Never call `useStore()` without a selector in React code.
- Read a single value or action with a direct selector.
- When a component reads two or more related values or actions from the same store, combine them
  in one object selector wrapped with `useShallow`.
- Selector results must be stable; do not create new arrays/objects on every subscription unless shallow comparison is intentional.

```ts
// UI store example.
const { isOpened, close } = useExpenseModalStore(
    useShallow((state) => ({
        isOpened: state.isOpened,
        close: state.close,
    })),
);
```

## Query And Mutation Naming

| Behavior                     | Name                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| Read server data             | `use<Entity>Query`, for example `useGroupsQuery`                  |
| Create/update/remove command | `use<Verb><Entity>Mutation`, for example `useCreateGroupMutation` |
| UI store update              | `set<Thing>`, for example `setSelectedGroup`                      |
| Reset owned UI state         | `reset<Thing>`                                                    |

Names describe the business operation. Do not use vague names such as `setData`, `load`, or `process`.

## Server Requests

- Server reads and mutations are TanStack Query hooks (spec 03 §2); mutations use `retry: false`, and
  a stale response never overwrites newer state (`AGENTS.md` invariant 8).
- Validate preconditions before starting a request. Cancellation is not a domain error.
- Stores that still fetch keep request identity checks so an older Promise cannot settle a newer
  request's loading/error state, until they migrate.

## Store Coordination

- Do not directly mutate another domain store.
- After an online-first domain mutation succeeds, the owning action may call named canonical fetch
  actions in other stores through `getState()` and wait for them with an explicit `Promise.all`.
- Keep the affected fetch actions visible beside the mutation; do not introduce a generic mutation map,
  resource registry, command layer, or action-only mutation store for this flow.
- Bootstrap, logout, reset, and multi-store offline reconciliation use explicit app orchestration.
- Prefer action parameters over hidden domain-data reads from another store.
