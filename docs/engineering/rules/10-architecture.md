# Architecture Rules

## Dependency Direction

Layers import only downward along one graph (invariant 1). The only source of the graph is
`config/eslint/layers.js`; `boundaries/dependencies` enforces it and the table below is generated from it.

<!-- BEGIN layers (generated from config/eslint/layers.js by `npm run layers:doc`; do not edit) -->

Element types (folders under `src/`; the first matching row wins) and what each may import.
Anything not listed is a `boundaries/dependencies` error, and a file under `src/` outside
every row is a `boundaries/no-unknown-files` error.
Test files (`**/*.{test,spec}.{ts,tsx}`) keep the row of their folder and may also
import `test`; no production file may import it.

| Layer        | Folders                                                                                                      | May import                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app`        | `main.tsx`, `root.tsx`, `pages/GlobalHooks.tsx`, `app/`, `bootstrap/`, `features/routing/`, `public-routes/` | every layer except `test`                                                                                                                        |
| `pages`      | `pages/*/`, `pages/*` files                                                                                  | `features`, `components`, `basics`, `hooks`, `store`, `entities`, `helpers`, `shared-lib`, `api`, `base`                                         |
| `features`   | `features/*/`, `features/*` files                                                                            | `features` (another slice only via its `index.ts`), `components`, `basics`, `hooks`, `store`, `entities`, `helpers`, `shared-lib`, `api`, `base` |
| `entities`   | `entities/*/`, `entities/*` files                                                                            | `entities` (another slice only via its `index.ts`), `helpers`, `shared-api`, `shared-lib`, `api`, `base`                                         |
| `store`      | `store/`                                                                                                     | `store`, `entities`, `helpers`, `shared-api`, `shared-lib`, `api`, `base`                                                                        |
| `components` | `components/`                                                                                                | `components`, `basics`, `hooks`, `store`, `entities`, `helpers`, `shared-lib`, `api`, `base`                                                     |
| `basics`     | `basics/`, `design-system/`                                                                                  | `basics`, `helpers`, `shared-lib`, `base`                                                                                                        |
| `hooks`      | `hooks/`                                                                                                     | `hooks`, `store`, `entities`, `helpers`, `shared-api`, `shared-lib`, `api`, `base`                                                               |
| `helpers`    | `helpers/`                                                                                                   | `helpers`, `shared-lib`, `base`                                                                                                                  |
| `shared-api` | `shared/api/`, `shared/offline/`                                                                             | `shared-api`, `shared-lib`, `api`, `base`                                                                                                        |
| `shared-lib` | `shared/`                                                                                                    | `shared-lib`, `base`                                                                                                                             |
| `api`        | `api/`                                                                                                       | `api`, `base`                                                                                                                                    |
| `test`       | `test/`                                                                                                      | every layer                                                                                                                                      |
| `base`       | `constants/`, `types/`, `i18n/`, `styles/`, `assets/`                                                        | `base`                                                                                                                                           |

<!-- END layers -->

- `pages` compose route-level screens and connect major flows.
- `features` own cohesive user capabilities and may compose shared components.
- `components` are reusable project components without route ownership.
- `basics` are the lowest reusable UI primitives and cannot import higher UI layers.
- Now: legacy server stores still hold server data and call resource API modules; do not add new ones.
  Target (spec 03): server state lives in TanStack Query `entities/*` and stores hold UI state only
  (§Ownership).
- API modules own HTTP contracts and cannot import UI or stores.
- Helpers are pure unless their module clearly represents a browser boundary.
- Helpers never import or read Zustand stores, store hooks, or store selectors. Pass every required
  value through helper parameters.
- The allowed dependency direction is `selector → helper`; helpers cannot depend on selectors.

`features/routing` is an `app` element because it imports pages (until it moves to `src/app/router`, spec 04). Do not copy that dependency direction into new features; new route composition belongs at the app/router boundary.

`import-x/no-cycle` (`maxDepth: 3`) runs only in `npm run lint:full` (CI). Known violations of the layer, cycle and
slice rules are entries in `eslint-suppressions.json`; the baseline only shrinks.

## Ownership

- Now: new code follows the target below. Server stores that spec 03 has not migrated yet are transitional:
  do not create new ones and do not add new server-data fields to them.
- Target: Zustand holds UI state only (modals, drafts, UI preferences); server state belongs to TanStack
  Query (spec 03).
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
- Another `features`/`entities` slice is imported only through its `index.ts` (`boundaries/dependencies`).
  Inside a slice and in the plain layers (`basics`, `components`, `helpers`, ...) import files directly,
  at any depth (D27).
- Existing nested `index.ts` files are legacy: do not add new ones and do not remove them incidentally.
  `scripts/check-file-layout.mjs` (`npm run check:file-layout`, part of `verify`) fails on an `index.ts`
  outside `src/<layer>/<slice>/` and on a new `useConnect.ts`; the existing ones are listed in
  `config/file-layout-baseline.json`, which only shrinks.
- Bare imports such as `store/groupsStore` are aliases from `compilerOptions.paths` in `tsconfig.app.json`
  (no `baseUrl`); that is the only alias list. Vite reads it through `vite-tsconfig-paths`, and the
  `simple-import-sort` groups are built from it in `config/eslint/aliases.js`. A new top-level `src`
  directory gets an entry there, nowhere else.

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
