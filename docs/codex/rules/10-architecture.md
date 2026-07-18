# Architecture Rules

## Dependency Direction

```text
app composition → pages → features → components → basics
                              ↓
                         stores/hooks
                              ↓
                         API/helpers/types
```

- `pages` compose route-level screens and connect major flows.
- `features` own cohesive user capabilities and may compose shared components.
- `components` are reusable project components without route ownership.
- `basics` are the lowest reusable UI primitives and cannot import higher UI layers.
- Stores own shared application/domain state and call resource API modules.
- API modules own HTTP contracts and cannot import UI or stores.
- Helpers are pure unless their module clearly represents a browser boundary.

`features/routing` is a legacy app-composition exception because it imports pages. Do not copy that dependency direction into new features; new route composition belongs at the app/router boundary.

## Ownership

- Keep local UI state in the component or a focused hook.
- Use Zustand only for genuinely shared state, remote domain data, or application session state.
- Runtime API calls never originate in pages, features, components, or basics.
- Type-only DTO imports are allowed at mapping/store boundaries. UI should prefer domain types.
- Side effects belong in store actions, focused hooks, event handlers, or explicit app orchestration.
- Backend API contracts do not change as an incidental frontend refactor.

## Placement

- Add code to the narrowest layer that owns its behavior.
- Do not create a new cross-cutting service, store, hook, or context for one local use.
- Split large touched files when responsibilities are already separable and the split materially reduces change risk.
- Do not move whole legacy folders while implementing a narrow feature.
- Shared public directories use a focused `index.ts`; avoid repository-wide barrel rewrites.

## Cross-Store And App Orchestration

- Stores do not directly write another store's domain data.
- Avoid circular store imports and hidden `getState()` dependencies.
- Bootstrap, logout, multi-store reset, and offline reconciliation use an app-level orchestrator/hook or an explicitly approved coordination module.
- Prefer passing required data into an action over secretly reading another store.

## Change Scope

- Preserve existing public behavior unless the request explicitly changes it.
- Refactor related legacy code only when the touched flow would otherwise duplicate a forbidden pattern or remain unsafe.
- Architecture changes spanning several layers require an approved design that names ownership and data flow.
