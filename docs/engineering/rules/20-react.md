# React Rules

## Components And Props

- Components and hooks stay pure; render does not mutate stores, props, browser state, or external objects.
- Component `Props` types stay in the component file immediately above the component. A separate
  `types.ts` holds only types with two or more real consumers.
- Prefer named exports; default exports remain only where an existing boundary requires them.
- Do not define components inside another component's render.
- Optional boolean feature and display props default to `false`. Static callers omit the prop for
  `false` and use JSX shorthand for `true` (`<ActivityFeedSkeleton isShowSummary />`). Forward
  runtime boolean values explicitly with `prop={value}`.

## Effects

- `useEffect` synchronizes React with an external system: subscription, timer, browser API, or externally owned lifecycle.
- Do not use an effect for derived data or logic that belongs in the initiating event.
- Effects include complete dependencies and cleanup subscriptions/timers/requests.
- UI effects never call raw API clients. They may trigger a store action.
- When React must ignore a returned Promise, mark it `void` and ensure the action or attached chain owns errors:

```ts
useEffect(() => {
    void fetchSetGroups();
}, [fetchSetGroups]);
```

## Hooks

- Custom hooks start with `use`.

## Store Reads

Read Zustand stores with selectors as described in `40-state.md` §Subscriptions And Selectors: one value
with a direct selector, several values with one object selector wrapped in `useShallow`. Do not add new
component connector hooks or files that only wrap store subscriptions.
