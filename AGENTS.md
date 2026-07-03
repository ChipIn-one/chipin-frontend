# AGENTS.md

## Goal

Durable working rules for Codex in this frontend repository.

Keep changes small, scoped, verified, reviewed, and consistent with the existing stack.

For ChipIn frontend implementation work, use the local `.agents/skills/chipin-task` skill as the procedural workflow. This file is the source of durable repository rules; if the skill and this file conflict, follow the stricter rule.

## Task Modes

- Implementation task: inspect relevant files, plan briefly, implement the smallest safe diff, verify, self-review, then stop for human review.
- Plan, review, explanation, or analysis task: do not edit files unless the user explicitly asks.
- Ambiguous, broad, risky, architectural, auth, financial, API, dependency, routing, store, or cross-cutting task: ask clarifying questions and propose a plan before editing.
- Narrow docs/config task: keep the diff minimal and explain if full app verification was skipped.

Do not refactor unrelated code or change architecture during narrow tasks.

## No Subagents

Do not use subagent-driven or multi-agent development in this repository.

Never invoke or follow workflows that spawn agents, including:

- `superpowers:subagent-driven-development`
- `superpowers:dispatching-parallel-agents`
- implementation subagents
- review subagents
- planning subagents
- background worker agents
- parallel multi-agent task execution

Do not call multi-agent tools for ChipIn repository work. Do not use subagents for code review, validation, implementation, planning, or exploration.

Reason: subagent workflows consume too many tokens and make work harder to control in this repository.

If another skill or workflow recommends subagents, use the inline/current-session alternative instead. Use `superpowers:executing-plans` instead of `superpowers:subagent-driven-development` when executing a written plan.

Only ignore this section when the user explicitly says to use subagents despite the token cost for a specific task. General wording such as "do it", "full flow", "continue", or "делай" is not approval to use subagents.

## Git And Human Review

Before editing:

- Run `git status --short`.
- Preserve unrelated user changes.
- Do not overwrite, revert, or reformat files outside the task scope.
- Create or use a dedicated task branch when safe.

Branch names:

- `feat/<short-task-name>` for features.
- `fix/<short-task-name>` for bugs.
- `chore/<short-task-name>` for tooling, docs, config, and workflow changes.
- `docs/<short-task-name>` for documentation-only changes.

Codex must not automatically run final git actions:

- `git add`
- `git commit`
- `git push`
- `git merge`
- `gh pr create`
- `git reset`
- `git checkout -- <file>`
- `git branch -D`
- destructive cleanup commands

Allowed before approval: read-only inspection commands such as `git status --short`, `git diff`, `git diff --stat`, `git diff --check`, `git log`, and `git branch --show-current`.

After implementation, verification, and self-review, stop for human review. Final git actions require explicit approval after the user has seen the changed files, verification results, risks, and proposed commit message.

Approval examples:

- `approve commit`
- `commit this`
- `можно коммитить`
- `апрув, коммить`
- `да, коммить`
- `запушь`
- `создай PR`

If approval is unclear, ask before any final git action.

## Repository Stack

- Vite + React + TypeScript strict + styled-components v6 + Radix Themes.
- Use existing import aliases from `tsconfig.app.json`.
- Prefer existing project patterns over new abstractions.
- Prefer Radix Themes primitives, props, and tokens first.
- Use styled-components when Radix primitives or props are not enough.
- Use lucide-react for icons.
- Do not add new UI libraries.
- Do not add production dependencies for narrow tasks.
- Do not add dev dependencies unless the plan explains the gap and why the repo needs it.
- Comments must be in English and explain only non-obvious logic.

## Architecture

- Preserve dependency direction: pages -> features -> components -> basics.
- UI should call stores or hooks, not raw API clients.
- Runtime API calls belong in stores or explicitly approved store-adjacent modules.
- Type-only imports from API DTO files are allowed.
- Keep side effects in hooks, stores, or event handlers.
- Do not call APIs directly from `useEffect` in UI components.
- Do not change backend API contracts unless explicitly requested.

## Stores

- Use global stores only when shared state is genuinely needed.
- Avoid creating new stores for narrow local behavior.
- Use selectors for Zustand subscriptions.
- Use shallow/object selectors only when they avoid unnecessary re-renders without obscuring code.
- Handle API errors explicitly with existing helpers such as `resolveApiErrorMessage`.
- Surface user-relevant failures through the existing toaster pattern.

## UI

- Build complete states: loading, empty, error, disabled, and success where relevant.
- Preserve mobile layout and touch behavior.
- Avoid broad visual redesigns during narrow fixes.
- Avoid inline styles in new or touched code; use Radix props or styled-components.
- Avoid raw hex colors in new or touched CSS; prefer theme tokens or existing theme helpers.
- `className` is allowed for component pass-through and existing library patterns, not as a new styling system.
- Clickable elements must look interactive and have cursor, focus, hover, and disabled states where appropriate.
- Icon-only controls need accessible labels or existing tooltip patterns.

## React, i18n, And Type Safety

- Components and hooks must stay pure.
- Do not define components inside render.
- Avoid unnecessary memoization.
- No user-facing strings directly in JSX for production UI; use i18n keys.
- No `any` or `as any`; use `unknown` plus narrowing when needed.
- Keep booleans named with `is*` or `has*` when practical.
- Keep event handlers/actions named with `handle*`, `on*`, or `fetch*` when practical.
- Use full, descriptive iterator names in non-trivial code.

## Barrel Exports

- New public component subdirectories should expose public symbols through `index.ts`.
- Prefer importing from a local barrel when it already exists.
- Do not create broad barrel-export churn during unrelated tasks.
- For new files, prefer named exports and named re-exports.

## Money

- Use JavaScript `Number` for frontend money values and API payloads.
- Backend is the source of truth for financial calculations.
- Frontend may display rounded values, for example with `toFixed(2)`.
- Do not introduce BigNumber, cents, or integer-money domain models on the frontend.
- Existing BigNumber usage is legacy; do not expand it or migrate it during unrelated tasks.

## Changelog

User-visible changes must update the changelog when a changelog source exists.

Preferred source of truth: `src/content/changelog/releases.ts`.

Create that file only when the task includes changelog setup or when a user-visible implementation needs it.

Do not add changelog entries for internal-only refactors, tests, lint fixes, or agent config changes unless visible behavior changes.

## Verification And Self-Review

Before claiming completion or readiness for review, run relevant existing scripts from `package.json`.

Prefer:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `npm run verify` if the repository defines it as the canonical combined check

For UI-heavy changes, run the app when practical and inspect desktop/mobile behavior.

Rules:

- Do not claim tests, typecheck, format checks, or builds passed if the script is missing or was not run.
- If a check fails, report the failure and either fix it or explain why it is unrelated.
- For narrow docs/config-only changes, explain why full app verification was skipped.

Before final response or review handoff, inspect:

- `git diff --check`
- `git diff --stat`
- `git diff`

Review for scope creep, unrelated changes, missing states, missing i18n, API/store contract mismatches, type-safety issues, money/rounding mistakes, accessibility regressions, unnecessary abstractions, stale comments, console logs, and dead code.

## Reviews And Legacy Code

When asked for a review, use code-review mode: findings first, ordered by severity, focused on bugs, regressions, missing tests, data flow, auth/privacy, financial correctness, UI traps, and mobile regressions.

Some existing code may violate newer rules. Do not perform broad cleanup during narrow tasks. Apply these rules to new and touched code. Fix nearby legacy issues only when directly related to the requested change.

## Final Response

For completed implementation tasks, report:

- branch name
- concise summary
- exact files changed and why
- verification commands and results
- changelog entry, if added
- skipped checks or remaining risks
- proposed commit message
- clear note that no commit was made unless explicitly approved
