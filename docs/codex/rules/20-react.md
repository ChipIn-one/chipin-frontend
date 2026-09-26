# React Rules

## Components And Props

- Components and hooks stay pure; render does not mutate stores, props, browser state, or external objects.
- Use named function or arrow components with explicit props. Do not add `React.FC`.
- Keep one production React component declaration per component file. Do not declare a sibling or nested
  component constant/function inside another component's file; move it to its own `PascalCase.tsx` file at
  the narrowest ownership level. JSX-valued variables and non-component render helpers may stay local.
- Component `Props` types stay in the component file immediately above the component. Do not create a
  separate `types.ts` only for local component props; reserve shared type modules for types with multiple
  real consumers.
- Prefer named exports; default exports remain only where an existing boundary requires them.
- Do not define components inside another component's render.
- Keep props minimal and semantic. Use discriminated unions when valid prop combinations differ.
- Optional boolean feature and display props default to `false`. Static callers omit the prop for
  `false` and use JSX shorthand for `true` (`<ActivityFeedSkeleton isShowSummary />`). Forward
  runtime boolean values explicitly with `prop={value}`.
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
    fetchSetGroups();
}, [fetchSetGroups]);
```

## Hooks

- Custom hooks start with `use`, remain focused, and compose React/store/browser behavior.
- Pure calculations remain helpers, not hooks.
- Hooks do not expose raw API clients to UI.
- Do not hide unrelated effects behind one broad hook.

## Component Store Connections

- A new or touched component with two or more Zustand subscriptions (`use*Store(selector)` calls),
  including action selections, moves them into its private `internal/useConnect.ts`. One subscription
  may remain inline.
- `useConnect` may read multiple stores, accept component props or identifiers, compose a
  component-specific render model, and return bound callbacks named with `on*`.
- `useConnect` owns only Zustand selectors/actions and their component-specific composition. Keep local
  UI state, i18n, router hooks, direct API calls, and unrelated effects outside it.
- When a selector produces a stable component render value, subscribe with it directly inside
  `useConnect`.
- When a selector/helper allocates nested arrays or objects, `useConnect` selects its stable source
  references with `useShallow` and invokes the calculation after the subscription. Do not force direct
  subscription with memoization or deep comparison merely to hide an unstable selector result.
- Component-specific derived values belong in `useConnect`: call a pure helper or named selector there
  and return the ready render value instead of exposing raw store fields to the component.
- Reusable domain calculations remain named store selectors or pure helpers. Follow the selector grouping
  and stability rules in `40-state.md` inside the connector.
- Let `useConnect` infer its return type when it only combines values/actions already typed by store
  selectors and direct store subscriptions. Do not add a `Connection` interface or explicit return
  annotation merely to repeat those existing types.
- Keep an explicit return type only when the connector intentionally narrows or renames a semantic render
  model, exposes a shared private contract to multiple consumers, or inference would otherwise lose an
  important boundary. Keep a larger such contract in `internal/types.ts`.
- Return only fields required for rendering and interaction. Do not expose complete store objects, and
  do not use the complete returned object as an effect dependency.
- Apply this convention to new and touched components without mass-migrating unrelated legacy code.

## Performance

- Do not add `memo`, `useMemo`, or `useCallback` by default.
- Memoization is a measured optimization, not a correctness mechanism.
- Prefer smaller subscriptions, pure selectors, and simpler component boundaries before memoization.
- Dependency arrays must remain correct without relying on memoization to hide stale logic.
- Heavy forms and financial modals must not keep every editable field as broad parent React state when
  child sections are expensive to render. Prefer local draft stores, narrow selectors, and connected
  subcomponents so editing one field does not rerender unrelated sections.
- Repeated rows in editable financial lists use row view-models/selectors. Parent components should pass
  stable semantic inputs or let rows subscribe narrowly; avoid rebuilding per-row arrays and inline
  handlers as the only source of truth on every keystroke.

## Decomposition

- Split components by responsibility: data connection, form state, repeated UI, or a coherent visual section.
- Avoid both giant components and one-line wrapper fragmentation.
- Event and side-effect coordination stays near the owner of the interaction.
