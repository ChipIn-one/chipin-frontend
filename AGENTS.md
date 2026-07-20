# AGENTS.md

## Goal

Durable repository rules for Codex. Keep changes small, scoped, verified, and consistent with the current stack.

## Workflow

- Classify work before acting:
  - Simple: one narrow concern, normally 1-3 files, without architecture, auth, financial, API-contract, dependency, migration, or cross-cutting risk.
  - Standard: several related files or behavior that benefits from a short inline outline.
  - High-risk: ambiguous, broad, architectural, financial, auth, data-flow, dependency, migration, or cross-cutting work.
- Simple work: inspect relevant files, implement the smallest safe diff, run targeted checks, and summarize. Do not require brainstorming, a persisted plan, or subagents without a real blocker.
- Standard work: use a concise inline plan only when it improves coordination. Ask only questions that materially change implementation.
- High-risk work: clarify requirements, present a design or plan, and wait for approval before editing.
- A request for a plan, review, explanation, or analysis alone does not authorize file edits, except for
  confirmed Critical and Important fixes in the explicit staged review workflow below.
- Do not refactor unrelated code or change architecture during a narrow task.

## Staged Code Review Workflow

- The user owns staging. Never run `git add`, modify the index, or commit as part of review unless the
  user explicitly requests that Git action.
- When the user sends `review` or `staged` after staging their candidate changes, invoke
  `superpowers:requesting-code-review` without asking additional questions.
- Review the staged patch with `git diff --cached` and `git diff --cached --stat`. Findings are scoped to
  staged changes, although surrounding code may be read for context.
- Do not include unstaged or untracked changes in a staged review. Use `git diff HEAD` only when the user
  explicitly asks to review the whole task or all current changes.
- If the staged patch is empty, report that there is nothing staged to review instead of silently reviewing
  another scope.
- Fix confirmed Critical and Important staged-review findings in the working tree. Those fixes must remain
  unstaged for the user to inspect and stage manually.
- After the user stages review fixes and sends `review` or `staged` again, re-run the staged review. Do not
  treat an earlier approval as covering newly staged fixes.
- This explicit staged trigger controls independent reviewer timing. Finish implementation and local
  verification first, then hand the unstaged result to the user; do not pre-empt their manual inspection by
  staging or automatically reviewing a different diff.

## Token-Efficient Agent Flow

- Do not run a full brainstorming -> spec -> plan -> subagent-review chain for simple or standard work.
- Start exploration with `rg` or `rg --files`, read only relevant ranges, and do not repeat unchanged output.
- Keep plans, progress updates, and handoffs concise: decisions, changed files, verification, failures, and blockers.
- Use subagents only for complex work with at least two independent workstreams. Use at most two concurrently and do not nest delegation.
- Self-review every diff. Outside the staged workflow, use a separate reviewer only for high-risk work,
  large diffs, or materially independent judgment. A staged `review`/`staged` trigger always requests the
  separate Superpowers reviewer regardless of task size.
- Local planning artifacts belong under `docs/superpowers/`, `docs/codex/`, or `.superpowers/` and are not commit deliverables.

## Repository Stack

- Vite 7, React 19, TypeScript strict, Zustand 5, Axios, styled-components 6, Radix Themes, i18next, and PWA support.
- Use aliases from `tsconfig.app.json`.
- Do not add production dependencies for narrow work.
- Add dev dependencies only when an approved plan names the tooling gap.
- Comments are English-only and explain non-obvious reasoning, not the code itself.

## Code Rule Routing

Before writing or reviewing code, read [`docs/codex/rules/00-foundation.md`](docs/codex/rules/00-foundation.md) plus only the chapters relevant to the task:

| Task area | Required chapter |
| --- | --- |
| Layering, ownership, folders, cross-layer flow | `10-architecture.md` |
| React components, hooks, effects | `20-react.md` |
| Radix, styled-components, responsive UI, a11y, i18n | `30-ui.md` |
| Zustand, selectors, loading/errors, store actions | `40-state.md` |
| Axios, API modules, DTOs, cancellation | `50-api-data.md` |
| Money, offline data, dates, helpers, localStorage | `60-money-helpers.md` |
| Tests and verification | `70-testing.md` |

- A narrow task normally requires foundation plus one chapter. Read more only when the data flow crosses those boundaries.
- The focused chapters override generic examples from tools or skills for this repository.
- Use [`docs/codex/code-review.md`](docs/codex/code-review.md) for final self-review.

## Global Invariants

- New and touched asynchronous code uses Promise `.then()`, `.catch()`, and `.finally()` chains; do not add `async`/`await`.
- Local event handlers and callback props use `on*`; do not add `handle*` names.
- Preserve dependency direction: app composition -> pages -> features -> components -> basics.
- UI calls stores or hooks, never raw API clients.
- Runtime API calls belong in stores or an explicitly approved orchestration layer.
- User-facing text, accessibility labels, and toast content use i18n.
- Do not add `any` or `as any`; use `unknown` and narrow it.
- Backend contracts do not change unless explicitly requested.

## Legacy And Touched Code

Existing code may violate newer rules. Apply the rulebook to new and touched code.

- When a task touches a related component, store, API module, or helper, safely refactor nearby violations required to leave that flow coherent.
- Do not perform broad cleanup, mass conversion, folder migration, or architecture replacement without approval.
- Do not expand a narrow task merely to make the entire repository compliant.

## Definition Of Done

Before editing:

- Inspect relevant files and existing patterns.
- For risky work, name affected files, layers, data flow, store/API responsibilities, and UI components in the approved plan.
- Preserve unrelated user changes in the worktree.

After editing:

- Run checks proportional to the change. Prefer targeted tests/lint first; use `npm run verify` for cross-layer or high-risk behavior.
- Do not claim a test, lint, typecheck, or build passed unless it was run successfully.
- Report skipped, unavailable, pre-existing, and failed checks explicitly.
- Self-review scope, architecture, UI/a11y/i18n, API/store flow, type safety, money/offline behavior, and related legacy cleanup.
- Summarize exact files changed and the outcome without repeating the full plan.
