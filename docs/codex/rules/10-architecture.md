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
- The allowed dependency direction is `selector/useConnect → helper`; helpers cannot depend on selectors
  or `useConnect`.

`features/routing` is a legacy app-composition exception because it imports pages. Do not copy that dependency direction into new features; new route composition belongs at the app/router boundary.

## Ownership

- Keep local UI state in the component or a focused hook.
- Use Zustand only for genuinely shared state, remote domain data, or application session state.
- Runtime API calls never originate in pages, features, components, or basics.
- Type-only DTO imports are allowed at mapping/store boundaries. UI should prefer domain types.
- Side effects belong in store actions, focused hooks, event handlers, or explicit app-lifecycle orchestration.
- Backend API contracts do not change as an incidental frontend refactor.

## Placement

- Add code to the narrowest layer that owns its behavior.
- Do not create a new cross-cutting service, store, hook, or context for one local use.
- Split large touched files when responsibilities are already separable and the split materially reduces change risk.
- Do not move whole legacy folders while implementing a narrow feature.
- Shared public directories use a focused `index.ts`; avoid repository-wide barrel rewrites.

## Recursive Nested Directory Structure

Use the same structure at every nesting depth. The immediate directory owns its primary component,
public types, presentation styles, subcomponents, and private implementation details. Create only files
that the implementation actually needs; never scaffold empty directories or placeholder files.

```text
settle-up/
├── SettleUpModal.tsx
├── SettleUpModal.friend.test.tsx
├── SettleUpModal.group.test.tsx
├── types.ts
├── styled.ts
├── components/
│   ├── settlement-form/
│   │   ├── SettlementForm.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   ├── debt-section/
│   │   ├── DebtSection.tsx
│   │   └── index.ts
│   └── index.ts
├── internal/
│   ├── constants.ts
│   ├── helpers.ts
│   ├── helpers.test.ts
│   ├── hooks.ts
│   ├── useConnect.ts
│   ├── selectors.ts
│   ├── types.ts
│   └── index.ts
└── index.ts
```

The example shows the available locations, not a required complete file set.

### Directory Naming

- Every directory uses `kebab-case`, including capability directories and nested component owners.
- A capability directory is named after its primary component in `kebab-case`, for example
  `AddExpenseModal.tsx` belongs to `add-expense-modal/`.
- Component filenames and exported component names remain `PascalCase`.
- Do not add a parent-level compatibility component such as `modals/AddExpenseModal.tsx` for a capability
  already owned by `modals/add-expense-modal/`. Parent exposure belongs in the parent `index.ts`.

### Ownership

- Keep the directory's primary component at its root and name it for the capability, for example
  `SettleUpModal.tsx`.
- Put React subcomponents used by the primary component in `components/`. Whenever `components/`
  exists, it always has an `index.ts` with semantically named exports, including when it currently
  contains only one component.
- Put shared public component types in the root `types.ts`. Export those types by name from the root
  `index.ts` when consumers need them.
- Put private implementation types in `internal/types.ts`; do not expose them from the root `index.ts`.
- Keep styled-components in one root `styled.ts` for that ownership level. Export styled components
  directly by their readable component names; do not split them into one file per styled component.
- Put private support code in `internal/`. Use the semantic filenames `constants.ts`, `helpers.ts`,
  `hooks.ts`, `selectors.ts`, and `types.ts`, creating only the files that are needed.
- A component-specific Zustand connector is named `internal/useConnect.ts`. Export it only through the
  owner's private `internal/index.ts`; do not expose it from the component's public root `index.ts`.
- Apply the same rules recursively when a subcomponent grows into its own nested directory.

### Index Files And Import Boundaries

- Every directory imported across a directory boundary has an `index.ts`.
- Every `index.ts` contains imports first and exactly one explicit named `export { ... }` block last.
  Inline re-exports, wildcard exports, multiple export statements, and default exports are prohibited.
- A parent or external consumer imports a child directory through that child's `index.ts`; deep imports
  across the boundary are prohibited.
- Import paths that cross a directory boundary end at the directory, never at its component file. The
  directory's `index.ts` owns the public export.
- Files within the same directory may import sibling files directly. Do not import through the current
  directory's own `index.ts`, because that creates avoidable barrel cycles.
- The root `index.ts` exposes only the capability's public API. It does not re-export `internal/` or
  private subcomponents.
- A public aggregate parent such as `components/modals/index.ts` may re-export child capabilities, but it
  must source them from each child directory's `index.ts`. Consumers use the aggregate boundary, for
  example `import { AddExpenseModal } from 'components/modals/';`.
- `components/index.ts` exports components by semantic names.

```ts
// components/index.ts
import { DebtSection } from './debt-section';
import { SettlementForm } from './settlement-form';

export { DebtSection, SettlementForm };

// settle-up/index.ts
import SettleUpModal from './SettleUpModal';
import type { SettleUpModalProps } from './types';

export { SettleUpModal, type SettleUpModalProps };
```

Use child barrels from the parent and direct sibling imports within one directory:

```ts
// Correct: crossing into child directories through their public boundary.
import { DebtSection, SettlementForm } from './components';
import { getSettlementViewModel } from './internal';

// Incorrect: deep imports across child directory boundaries.
import DebtSection from './components/DebtSection';
import { getSettlementViewModel } from './internal/helpers';
```

### Internal Exports

Export helpers as exact named functions from `internal/index.ts`. Do not import helper modules with
`import * as helpers`; consumers must show which helpers they depend on. Constants and selectors may
remain namespaced when the namespace is the established boundary for that module.

```ts
import * as constants from './constants';
import { getSettlementViewModel } from './helpers';
import { useSettlementDraft } from './hooks';
import * as selectors from './selectors';
import type { SettlementDraft } from './types';

export {
    constants,
    getSettlementViewModel,
    selectors,
    type SettlementDraft,
    useSettlementDraft,
};
```

Import helpers, hooks, private types, and styled components by name so their usage stays immediately
readable. Namespace access remains allowed for established `constants` and `selectors` boundaries.

```tsx
import { getSettlementViewModel, useSettlementDraft } from './internal';
import { ActionFooter, ModalSurface } from './styled';

const draft = useSettlementDraft();
const model = getSettlementViewModel(draft);

return <ModalSurface>{model.amount}</ModalSurface>;
```

If two helper names collide in one file, alias the named import at the import site:

```ts
import {
    getSettlementViewModel as getPaymentSettlementViewModel,
} from './payment-form/internal';
```

### Test Placement And Naming

- Co-locate a unit test with its source: `internal/helpers.ts` uses `internal/helpers.test.ts`, and
  `components/DebtSection.tsx` uses `components/DebtSection.test.tsx`.
- Co-locate public component tests with the public component.
- Split large independent scenarios with a semantic infix, for example
  `SettleUpModal.friend.test.tsx` and `SettleUpModal.group.test.tsx`.
- Do not create `tests/`, `__tests__/`, or test barrel directories for these co-located tests.
- Do not test `styled.ts`, `types.ts`, or `constants.ts` separately when they contain no executable logic.
- Give an internal component its own test only when it owns meaningful behavior; otherwise cover it through
  the public component.

### Adoption

- This structure is required for new directories and directories undergoing substantial refactoring.
- A narrow edit in a legacy directory does not require migrating that entire directory.
- Do not perform repository-wide structural migrations as incidental cleanup.

## Store Capability Structure

Every new or substantially refactored Zustand store lives in its own `kebab-case` directory named
`<domain>-store`.

```text
store/
└── groups-store/
    ├── actions.ts
    ├── actions.test.ts
    ├── types.ts
    ├── constants.ts
    ├── initialState.ts
    ├── selectors.ts
    ├── selectors.test.ts
    └── index.ts
```

- `actions.ts` creates and exports `use*Store`. It owns Zustand `set`/`get` usage and all store actions.
- `types.ts` owns the store state, action, input, and combined store types.
- `constants.ts` is optional and contains only constants owned by the store.
- `initialState.ts` owns the complete typed initial state without actions.
- `selectors.ts` owns named public or reusable selectors.
- Tests are co-located with their owner as `actions.test.ts` and `selectors.test.ts`. Add the files when
  their owner has meaningful behavior to verify; do not create tests for passive types or constants.
- `index.ts` imports public values and types first and exposes them through exactly one explicit named
  export block. It does not use wildcard or inline re-exports.
- External consumers import from the store directory, for example
  `import { selectSelectedGroup, useGroupsStore } from 'store/groups-store';`. Deep imports such as
  `store/groups-store/actions` and compatibility files such as `store/groupsStore.ts` are prohibited.
- Files inside one store directory import sibling files directly and do not import through their own
  `index.ts`.

## Cross-Store And App Orchestration

- Stores do not directly write another store's domain data.
- Avoid circular store imports and hidden `getState()` dependencies. The narrow exception is an
  online-first domain mutation action invoking named canonical fetch actions in other stores after
  backend success; keep that dependency explicit next to the mutation.
- For that exception, a store may import the other store's owning `actions.ts` directly when the public
  barrel would create a circular Rollup chunk. UI consumers still use the public store `index.ts`.
- Bootstrap, logout, multi-store reset, and offline reconciliation use an app-level orchestrator/hook or an explicitly approved coordination module.
- Prefer passing required data into an action over secretly reading another store.

## Change Scope

- Preserve existing public behavior unless the request explicitly changes it.
- Refactor related legacy code only when the touched flow would otherwise duplicate a forbidden pattern or remain unsafe.
- Architecture changes spanning several layers require an approved design that names ownership and data flow.
