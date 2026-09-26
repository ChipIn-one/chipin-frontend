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

The read-only knowledge-base dependency is `ChipIn-one/chipin-knowledge-base@main`.
Resolve it from `../chipin-knowledge-base` when available. In GitHub-only/web
environments, resolve the same canonical files through authenticated GitHub access;
a missing sibling checkout alone is not a reason to substitute copied or stale KB
content.

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

`Sol 5.6 planning/architecture → Luna xhigh implementation + local validation → IMPLEMENTATION_COMPLETE → trusted Sol/human publication → green full frontend-ci on the current head → exactly one @codex review for that head → human-authorized correction cycle if needed → changed head repeats green frontend-ci plus one new @codex review → human merge`.

Luna is executor-only and stops at `IMPLEMENTATION_COMPLETE` or `BLOCKED`.
Luna does not review her own task diff, perform independent review batches, judge
merge readiness, commit, push, create or update PRs, merge, or enable auto-merge.
The managed Codex GitHub Code Review is the routine/default independent reviewer.
Automatic Codex review is disabled. After trusted publication, wait until required
`frontend-ci` is green for the current PR head, then post exactly one `@codex review`
for that head. Never request review while required CI is pending or failing, and do
not post duplicate review requests for the same head. A review is current only when
its reviewed commit SHA equals the current PR head; every changed head repeats the
green-CI gate and receives one new review request. Reviewer findings remain separate
from Luna execution state and return to Luna only after explicit human authorization.
Sol 5.6 High is escalation/fallback only for architecture or high-risk review,
ambiguous or disputed findings, Codex unavailability, or an explicit human request.
Only a human merges.

## Code Review Rules

These are the self-contained repository-wide rules for managed Codex GitHub Code
Review. Do not assume `.ai/context.md` or linked `docs/codex/rules/*` files are loaded
automatically; those files remain implementation guidance and navigation, not an
implicit review-instruction source.

- Flag auth/session/refresh-token changes that can leak credentials, restore a logged-out
  session, break refresh ordering, or bypass protected-route behavior.
- Flag API/wire/domain shape mismatches, unsafe nullable-field assumptions, stale-response
  application, broken cancellation/concurrency guards, and local patching of canonical
  backend-owned financial/domain state.
- Flag money handling that loses decimal precision or coerces decimal wire values with
  `Number()`/`parseFloat()` instead of preserving the contract and using canonical money
  helpers at the appropriate boundary.
- Flag persisted/offline state changes that can corrupt, duplicate, or incorrectly restore
  state across reload, logout, retry, or reconciliation.
- Flag React lifecycle/state bugs, routing regressions, CSP/security regressions, and
  behavior changes that bypass i18n or required accessibility semantics.
- Require meaningful regression tests for materially changed logic when a practical seam
  exists. Do not report formatting, import ordering, or other deterministic style checks
  already enforced by CI unless they cause a concrete correctness problem.

Evidence and the repository decision for instruction loading are recorded in
`docs/codex/review-instruction-loading.md`.

## GitHub task authority

These rules apply only to ChipIn frontend tasks.

- The canonical task identity is `ChipIn-one/<repository>#<issue-number>`.
- The GitHub Issue title and body are the task specification and dependency record.
- Organization Issue Fields are canonical structured metadata, including `Priority`, `Severity`, and `Release scope` where applicable.
- ChipIn Development Project #5 `Status` is the canonical workflow state. Do not duplicate status in the Issue title or body.
- Priority presentation is derived only from the canonical `Priority` field. If that field cannot be read, fail closed; do not substitute Issue labels or title/body encoding.
- PRE-PROD semantics derive from the canonical `Release scope`; title encoding is not the source of truth.
- Historical Trello links may remain in `References` as read-only provenance/evidence; Trello must not participate in current task state, notifications as authority, admission, planning, or execution authorization.
- Active agents and workflows must not create or update Trello cards; move Trello cards or lists; update Trello labels, status, or metadata; write comments or activity to Trello; or invoke or maintain Trello task-tracking integrations.
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

## GATE — knowledge base

The ChipIn knowledge base (`../chipin-knowledge-base`, github.com/ChipIn-one/chipin-knowledge-base)
owns the domain language, the behaviour specs and the HTTP contract. This repo owns how they are
implemented. Do not start a change that touches the domain, the API or user-visible behaviour
until every item below is done:

1. Read `chipin-knowledge-base/common/glossary.md`. Use its terms in code, DTOs and docs; do not
   introduce synonyms.
2. Read `chipin-knowledge-base/common/specs/<capability>.md` for the capability you change.
   Requirements carry stable ids (`SET-003`). Name tests after them.
3. If the change alters behaviour or the contract: update the common spec in a linked PR to the
   knowledge base before or together with this one. A bugfix for behaviour the spec is silent about
   adds the missing requirement there.
4. If the change conflicts with an accepted ADR in `chipin-knowledge-base/common/adr/`: stop and ask.
5. Implementation-only invariants (transactions, locks, state ownership, deviations) go to this
   repo's `docs/specs/<capability>.md`, referencing the requirement ids, never repeating the rules.
   Design docs and plans stay in this repo.

If the knowledge base is not checked out next to this repo, clone it there before proceeding:
`git clone https://github.com/ChipIn-one/chipin-knowledge-base.git ../chipin-knowledge-base`.
