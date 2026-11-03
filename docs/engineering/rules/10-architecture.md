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
- Helpers never import or read Zustand stores, store hooks, or store selectors. Pass every required
  value through helper parameters.
- The allowed dependency direction is `selector → helper`; helpers cannot depend on selectors.

`features/routing` is a legacy app-composition exception because it imports pages. Do not copy that dependency direction into new features; new route composition belongs at the app/router boundary.

## Ownership

- Zustand holds UI state only (modals, drafts, UI preferences); server state belongs to TanStack Query
  (spec 03). Server stores that spec 03 has not migrated yet are transitional: do not create new ones
  and do not add new server-data fields to them.
- Runtime API calls never originate in pages, features, components, or basics.
- Type-only DTO imports are allowed at mapping/store boundaries. UI should prefer domain types.
- Side effects belong in store actions, focused hooks, event handlers, or explicit app-lifecycle orchestration.
- Backend API contracts do not change as an incidental frontend refactor.

## Placement

- Add code to the narrowest layer that owns its behavior.

## Slice Structure

A slice is `src/<layer>/<slice>/`. Its directory owns its primary component, presentation styles,
subcomponents, and private implementation details. Create only files that the implementation actually
needs; never scaffold empty directories or placeholder files.

```text
settle-up/
├── SettleUpModal.tsx
├── SettleUpModal.friend.test.tsx
├── SettleUpModal.group.test.tsx
├── styled.ts
├── components/
│   ├── SettlementForm.tsx
│   └── DebtSection.tsx
├── internal/
│   ├── constants.ts
│   ├── helpers.ts
│   ├── helpers.test.ts
│   ├── hooks.ts
│   ├── selectors.ts
│   └── types.ts
└── index.ts
```

The example shows the available locations, not a required complete file set.

- Keep the primary component at the slice root and name it for the capability, for example
  `SettleUpModal.tsx`.
- Put React subcomponents used by the primary component in `components/`, and private support code in
  `internal/` (`constants.ts`, `helpers.ts`, `hooks.ts`, `selectors.ts`, `types.ts`, only as needed).
  Neither `components/` nor `internal/` has its own `index.ts`.
- Component `Props` live in the component file, immediately above the component. A `types.ts` holds only
  types with two or more consumers.
- Keep styled-components in one `styled.ts` per ownership level until they move to CSS Modules (D14).
  Export styled components directly by their readable component names.

## Index Files And Import Boundaries

- The only barrel is the slice root `src/<layer>/<slice>/index.ts`; it exposes the slice's public API and
  never re-exports `internal/`.
- Inside a slice, import files by relative path; do not import through the slice's own `index.ts`.
- From outside a slice, import only that slice's `index.ts` or a file at the root of a layer.
- Existing nested `index.ts` files are legacy: do not add new ones and do not remove them incidentally.

```ts
// settle-up/index.ts
import { SettleUpModal, type SettleUpModalProps } from './SettleUpModal';

export { SettleUpModal, type SettleUpModalProps };

// settle-up/SettleUpModal.tsx: files inside the slice, imported directly.
import { DebtSection } from './components/DebtSection';
import { SettlementForm } from './components/SettlementForm';
import { getSettlementViewModel } from './internal/helpers';
```

## Store Location

- UI stores live in `store/ui-prefs/<name>Store.ts` (spec 03 §6, spec 05 `appearanceStore`).
- Server stores are removed by their TanStack Query migration (spec 03); they get no separate layout.
  Existing `<domain>-store/` directories stay as they are until migrated.

## Cross-Store And App Orchestration

- Stores do not directly write another store's domain data.
- Avoid circular store imports and hidden `getState()` dependencies. The narrow exception is an
  online-first domain mutation action invoking named canonical fetch actions in other stores after
  backend success; keep that dependency explicit next to the mutation.
- For that exception, a store may import the other store's owning `actions.ts` directly when the public
  barrel would create a circular Rollup chunk. UI consumers still use the public store `index.ts`.
- Bootstrap, logout, multi-store reset, and offline reconciliation use an app-level orchestrator/hook or an explicitly approved coordination module.
- Prefer passing required data into an action over secretly reading another store.
