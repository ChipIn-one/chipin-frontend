# Zustand State Rules

## Store Choice And Shape

- Use Zustand for shared domain, session, remote, or cross-feature state.
- Keep form drafts, modal visibility, hover, and temporary UI state local.
- Do not create a store only to avoid passing a small number of props.
- A dedicated global Zustand store is allowed for an explicitly approved, single-active-session
  financial modal that opens from multiple application contexts. It owns draft transitions,
  calculations, validation, and payload construction; it resets with the modal lifecycle, exposes
  narrow stable selectors, and does not perform API requests.
- Domain stores hold domain data and actions. Request lifecycle and errors remain centralized.
- Define focused state/action types and explicit Promise return types for async actions.

## Central Loading And Errors

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
- Do not group unrelated state only to reduce the number of hooks.
- Keep arrays or objects that require element-level shallow comparison in their own top-level
  `useShallow` selector instead of nesting them as properties inside another selector result.
- Reused or derived selectors are named and live next to the store.
- Selector results must be stable; do not create new arrays/objects on every subscription unless shallow comparison is intentional.
- Do not use `getState()` during render. It is for store actions or imperative orchestration outside React.

```ts
const groups = useGroupsStore((state) => state.groups);
const fetchSetGroups = useGroupsStore((state) => state.fetchSetGroups);
```

## Updates And Derived Data

- Update state immutably.
- Use functional `set((state) => ...)` whenever the next value depends on previous state.
- Do not capture a store snapshot before an async request and apply it after the request settles.
- Keep derived values in selectors/helpers instead of synchronizing duplicate state through effects.
- Reset only state owned by the action/store.

## Action Naming

| Behavior | Name |
| --- | --- |
| Fetch without store write | API `fetchGroups` |
| Fetch and write store | `fetchSetGroups` |
| Pure store update | `setSelectedGroup` |
| Create/update/remove command | `createGroup`, `updateGroup`, `removeGroup` |
| Reset owned state | `resetGroups` |

Command names describe the business operation; their store layer is clear from the Zustand selector. Do not use vague names such as `setData`, `load`, or `process`.

## Async Actions

```ts
fetchSetGroups: (): Promise<Group[]> => {
    const { setLoading } = useLoadingStore.getState();
    const { clearError, setError } = useErrorsStore.getState();

    clearError('group', 'data');
    setLoading('group', 'data', 'loading');

    return groupsApi
        .fetchGroups()
        .then((groups) => {
            set({ groups });
            return groups;
        })
        .catch((error: unknown) => {
            setError('group', 'data', normalizeApiError(error));
            return Promise.reject(error);
        })
        .finally(() => {
            setLoading('group', 'data', 'fetched');
        });
},
```

- Validate preconditions before entering `loading`.
- Return the Promise and do not swallow rejections.
- Cancellation is not a domain error.
- Protect searches/pagination from stale responses and duplicate requests.
- The simple `.finally(set fetched)` example is valid only for a single-flight operation. Concurrent/latest-wins actions must verify request identity so an older Promise cannot settle the newer request's loading/error state.
- Append results with functional `set`.
- One layer owns presentation: stores record errors; UI displays contextual state/toasts; interceptors handle only global transport/session concerns.

## Store Coordination

- Do not create store import cycles or directly mutate another domain store.
- Bootstrap, logout, reset, and multi-store offline reconciliation use explicit app orchestration.
- Prefer action parameters over hidden reads from another store.
