# React Rules

## Components And Props

- Components and hooks stay pure; render does not mutate stores, props, browser state, or external objects.
- Use named function or arrow components with explicit props. Do not add `React.FC`.
- Prefer named exports; default exports remain only where an existing boundary requires them.
- Do not define components inside another component's render.
- Keep props minimal and semantic. Use discriminated unions when valid prop combinations differ.
- Local handlers and callback props use `on*` only.

## State

- Keep a single source of truth.
- Do not copy props or store values into local state unless the value is an intentional editable draft.
- Compute derived values during render or in selectors/helpers; do not synchronize derived state through an effect.
- Keep form, modal, hover, and temporary selection state local unless it is shared outside the flow.

## Effects

- `useEffect` synchronizes React with an external system: subscription, timer, browser API, or externally owned lifecycle.
- Do not use an effect for derived data or logic that belongs in the initiating event.
- Effects include complete dependencies and cleanup subscriptions/timers/requests.
- UI effects never call raw API clients. They may trigger a store action.
- When React must ignore a returned Promise, make that intentional and ensure the action or attached chain owns errors:

```ts
useEffect(() => {
    void fetchSetGroups();
}, [fetchSetGroups]);
```

## Hooks

- Custom hooks start with `use`, remain focused, and compose React/store/browser behavior.
- Pure calculations remain helpers, not hooks.
- Hooks do not expose raw API clients to UI.
- Do not hide unrelated effects behind one broad hook.

## Performance

- Do not add `memo`, `useMemo`, or `useCallback` by default.
- Memoization is a measured optimization, not a correctness mechanism.
- Prefer smaller subscriptions, pure selectors, and simpler component boundaries before memoization.
- Dependency arrays must remain correct without relying on memoization to hide stale logic.

## Decomposition

- Split components by responsibility: data connection, form state, repeated UI, or a coherent visual section.
- Avoid both giant components and one-line wrapper fragmentation.
- Event and side-effect coordination stays near the owner of the interaction.
