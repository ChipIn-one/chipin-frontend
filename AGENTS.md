# AGENTS.md

## Scope and stack

ChipIn is a frontend-only Vite 7, React 19, TypeScript strict, Zustand 5,
Axios, styled-components, Radix Themes, i18next and PWA application. Backend
contracts remain unchanged unless explicitly requested.

## Architecture and invariants

- Preserve dependency direction: app composition → pages → features → components → basics.
- UI calls stores or focused hooks, never raw API clients; runtime API calls belong in store actions.
- Helpers are pure and do not read Zustand stores or selectors.
- Preserve public module boundaries and capability ownership; use existing aliases from `tsconfig.app.json`.
- Keep strict types: no `any`, `as any`, unjustified assertions, or swallowed errors.
- New/touched async code uses Promise `.then()`, `.catch()`, and `.finally()` chains, not `async`/`await`.
- Local event handlers and callback props use `on*` names.
- User-facing text, accessibility labels, and toast content use i18n.
- Preserve money, offline, persistence, concurrency, API/data-shape, and accessibility invariants.
- For dynamic collections, avoid unnecessary repeated traversals and allocations; follow the detailed
  exceptions in `docs/codex/rules/00-foundation.md`.

## Landing previews

When changing `GroupPage` or `SoloPage`, compare the corresponding
`GroupPagePreview` or `SoloPagePreview` and update the landing mock when needed.
When changing a landing preview, compare it with the current mobile page
composition.

## Local rules and commands

Read `docs/codex/rules/00-foundation.md` and only relevant chapters before
code changes. Testing guidance is in `docs/codex/rules/70-testing.md`.

- `npm run test:task -- <explicit test paths>` — focused tests.
- `npm run verify` — fast lint/typecheck.
- `npm run test:full` — full tests.
- `npm run verify:full` — full local completion gate and CI gate.
- `npm run build` — production build.
- `npm run vercel-build` — Vercel pipeline.

## Git and execution

Generic execution lifecycle is defined by canonical `my-prompt-storage`
instructions/task prompt. Normal development is `task/*` → `dev`; release is
`dev` → `main`. When publication is authorized, Luna may stage task-owned
files, commit, push, and open/update PRs. Luna never merges or enables
auto-merge. Preserve unrelated work and do not change backend or unrelated
architecture.
