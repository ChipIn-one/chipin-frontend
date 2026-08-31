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
The generic implementation and integration lifecycle is defined by the
canonical `my-prompt-storage` FLOW; this file contains only ChipIn-specific
commands and repository policy.

- `npm run test:task -- <explicit test paths>` — focused tests.
- `npm run verify` — fast lint/typecheck.
- `npm run test:full` — full tests.
- `npm run verify:full` — full local completion gate and CI gate.
- `npm run version:bump -- <none|patch|minor|major>` — apply the task's explicit SemVer impact before the final commit; `none` is a safe no-op.
- `npm run version:check` — read-only validation that package and lockfile versions are valid and synchronized.
- tracked Husky `pre-push` runs `npm run version:check` and `npm run verify:full`; both block a non-zero result and neither mutates repository files.
- `npm run pr:create` — create or update the current task branch PR with an explicit `dev` base.
- Every task prompt includes `Version impact: none | patch | minor | major`, selected from product/API meaning rather than file or LoC counts.
- For `patch`, `minor`, or `major`, run the automatic `version:bump` before the final commit; `major` is rejected during the pre-1.0 period because `1.0.0` requires an explicit release decision.
- Runtime labels are `<baseVersion>-dev-<shortTaskHeadSha>` for task/dev/preview builds and `<baseVersion>` for release builds from `main`. GitHub PR builds use the PR head SHA.
- New task branches use `luna/<task-slug>`; `codex/fix-ci-development-flow` is a temporary exception only for open PR #109 and must not become a general `codex/*` allowance.
- Push only task branches; open/update a PR into `dev` and wait for required
  `frontend-ci` before reporting integration readiness.
- Normal task PR creation is equivalent to `gh pr create --base dev --head
  <current-task-branch> ...`; never rely on the repository default `main`.
- Reuse an existing open PR for the current head, retarget its base to `dev`
  when allowed, and return its real `/pull/<number>` URL.
- Luna never pushes directly to `dev`/`main` and never merges; human performs
  the merge after the remote gate is green.
- `npm run build` — production build.
- `npm run vercel-build` — Vercel pipeline.

The normal lifecycle is:

`implementation → targeted validation → bounded diff review → Version impact from Sol prompt → version:bump → npm run verify:full → stage → commit → push (version:check + verify:full) → npm run pr:create → frontend-ci → human merge`.

## Git and execution

Generic execution lifecycle is defined by canonical `my-prompt-storage`
instructions/task prompt. Normal development is `luna/*` → `dev`; release is
`dev` → `main`. When publication is authorized, Luna may stage task-owned
files, commit, push, and open/update PRs. Luna never merges or enables
auto-merge. Preserve unrelated work and do not change backend or unrelated
architecture.
