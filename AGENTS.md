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
The generic AI lifecycle, publication, and reviewer roles are owned by the
canonical `syllik/ai-workflow`; this file contains only ChipIn-specific
commands and repository policy.

- `npm run test:task -- <explicit test paths>` — focused tests.
- `npm run verify` — fast lint/typecheck.
- `npm run test:full` — full tests.
- `npm run verify:full` — full local completion gate and CI gate.
- `npm run version:bump -- <none|patch|minor|major>` — apply the task's explicit SemVer impact before the final commit; `none` is a safe no-op.
- `npm run version:check` — read-only validation that package and lockfile versions are valid and synchronized.
- tracked Husky `pre-push` runs `npm run version:check` and `npm run verify:full`; both block a non-zero result and neither mutates repository files.
- `npm run pr:create` — repository publication helper for trusted Sol/human-controlled publication with an explicit `dev` base; it is not a Luna execution responsibility.
- Every task prompt includes `Version impact: none | patch | minor | major`, selected from product/API meaning rather than file or LoC counts.
- For `patch`, `minor`, or `major`, run the automatic `version:bump` before the final commit; `major` is rejected during the pre-1.0 period because `1.0.0` requires an explicit release decision.
- Runtime labels are `<baseVersion>-dev-<shortTaskHeadSha>` for task/dev/preview builds and `<baseVersion>` for release builds from `main`. GitHub PR builds use the PR head SHA.
- New task branches use `luna/<task-slug>`; `codex/fix-ci-development-flow` is a temporary exception only for open PR #109 and must not become a general `codex/*` allowance.
- Executor work stays inside the prepared task branch/worktree and explicit task scope.
- Publication targets `dev`; required `frontend-ci` remains the remote integration gate after publication.
- Trusted task publication into `dev` may use `gh pr create --base dev --head
  <current-task-branch> ...` or `npm run pr:create`; never rely on the repository
  default `main`, and do not treat publication as Luna execution.
- Reuse an existing open PR for the current head, retarget its base to `dev`
  when allowed, and return its real `/pull/<number>` URL.
- Luna never pushes directly to `dev`/`main` and never merges; human performs
  the merge after the remote gate is green.
- `npm run build` — production build.
- `npm run vercel-build` — Vercel pipeline.

The canonical lifecycle is:

`Sol 5.6 planning/architecture → Luna xhigh implementation + local validation → IMPLEMENTATION_COMPLETE → trusted Sol/human publication → managed Codex GitHub Code Review → human-authorized correction cycle if needed → new Codex review for every changed PR head → human merge`.

Luna is executor-only and stops at `IMPLEMENTATION_COMPLETE` or `BLOCKED`.
Luna does not review her own task diff, perform independent review batches, judge
merge readiness, commit, push, create or update PRs, merge, or enable auto-merge.
The managed Codex GitHub Code Review is the routine/default independent reviewer
and runs automatically on every push to an open PR after trusted publication. A
review is current only when its reviewed commit SHA equals the current PR head;
every changed PR head requires a new Codex review. Use `@codex review` only as a
manual fallback/retrigger when automatic review does not start or an explicit
retry is needed; do not trigger a duplicate manual review while automatic review
is already running. Reviewer findings remain
separate from Luna execution state and return to Luna only after explicit human
authorization. Sol 5.6 High is escalation/fallback only for architecture or
high-risk review, ambiguous or disputed findings, Codex unavailability, or an
explicit human request. Only a human merges.

## GitHub task authority

These rules apply only to ChipIn frontend tasks.

- The canonical task identity is `ChipIn-one/<repository>#<issue-number>`.
- The GitHub Issue title and body are the task specification and dependency record.
- Organization Issue Fields are canonical structured metadata, including `Priority`, `Severity`, and `Release scope` where applicable.
- ChipIn Development Project #5 `Status` is the canonical workflow state. Do not duplicate status in the Issue title or body.
- Priority presentation is derived from the canonical `Priority` field. If that field is unavailable, exactly one fallback Issue label `P0`/`P1`/`P2`/`P3` may provide presentation compatibility; conflicts fail closed.
- PRE-PROD semantics derive from the canonical `Release scope`; title encoding is not the source of truth.
- Historical Trello links may remain in `References`; Trello metadata and links are evidence only and must not override current GitHub fields.
- There is no bidirectional Trello-to-GitHub or GitHub-to-Trello synchronization.
- Slack and other notifications are presentation only and must derive meaning from canonical GitHub Issue and Project fields.
- Issue or Project status never authorizes AI execution; explicit human approval provenance is required.
- Area ownership is represented by the `Frontend` label.
- Do not use legacy frontend priority/severity labels `Critical`, `Major`, `Minor`, `Priority`, or `PROD CRIT` for new frontend tasks.
- Render priority as `P0 -> 🔴`, `P1 -> 🟠`, `P2 -> 🟡`, `P3 -> ⚪`. Emoji is presentation only and is not independent task state.
- A blocker belongs in `Dependencies`.
- Canonical descriptions use only the relevant durable subset of `Problem`, `Outcome`, `Acceptance`, `Dependencies`, and `References`.
- Do not add `[TASK DESCRIPTION]`, generic AGENT INSTRUCTIONS, execution journals, runner state, mutable status/history, raw verification logs, or duplicated labels/status/tracker metadata.
- Durable PR, Issue, documentation, or historical Trello links belong in `References` when useful. Transient CI/execution evidence belongs in the separate authorized publication result or execution record, not in mutable task metadata.

## Git and execution

Generic execution lifecycle and reviewer semantics are defined by canonical
`syllik/ai-workflow`. Normal development is `luna/*` → `dev`; release is
`dev` → `main`. Luna implements and validates the authorized scope, then stops
at `IMPLEMENTATION_COMPLETE` or `BLOCKED`. Trusted publication, independent
review, corrections, and release decisions remain outside Luna execution.
Preserve unrelated work and do not change backend or unrelated architecture.
