---
name: chipin-task
description: Use for ChipIn frontend implementation tasks. Follow the local AGENTS.md rules, work inline in the current session, avoid subagents, inspect first, make a small scoped diff, verify, self-review, update changelog for user-visible changes, and stop for human review before any commit.
---

# ChipIn Frontend Task Flow

Use this skill for ChipIn frontend implementation tasks: features, bugfixes, UI changes, refactors, API/store integration, config changes, and issue-tracker tasks.

`AGENTS.md` is the source of durable repository rules. This skill is a compact workflow overlay. If this skill and `AGENTS.md` conflict, follow the stricter rule.

## Hard Rules

- Work inline in the current session.
- Do not use subagents or multi-agent workflows.
- Do not use `superpowers:subagent-driven-development`.
- Do not use `superpowers:dispatching-parallel-agents`.
- Do not call multi-agent tools for implementation, review, exploration, validation, or planning.
- If another workflow recommends subagents, choose the inline alternative.
- Do not commit, push, merge, create a PR, discard work, or run destructive git actions without explicit approval after the user reviews the result.
- Preserve unrelated user changes.

Reason: subagent workflows consume too many tokens and make repository work harder to control.

Only use subagents if the user explicitly says to use subagents despite the token cost for a specific task.

## Workflow

1. **Classify the task**
   - If the user asks for review, explanation, analysis, brainstorming, or a plan only, do not edit files.
   - If the task is ambiguous, risky, architectural, auth, financial, API, dependency, routing, store, or cross-cutting, ask clarifying questions or propose a plan before editing.
   - For narrow docs/config changes, keep the diff minimal.

2. **Inspect**
   - Run `git status --short`.
   - Read relevant files before editing.
   - Use `rg` and `rg --files` for search.
   - Check `package.json` before choosing verification commands.

3. **Plan briefly**
   - State the intended behavior and likely files.
   - Name API/store/data-flow responsibilities when relevant.
   - Name verification commands.
   - For user-visible changes, note changelog impact.

4. **Implement**
   - Make the smallest safe diff.
   - Follow existing Vite + React + TypeScript strict + styled-components + Radix Themes patterns.
   - Preserve dependency direction: pages -> features -> components -> basics.
   - UI should call stores or hooks, not raw API clients.
   - Runtime API calls belong in stores or explicitly approved store-adjacent modules.
   - Do not call APIs directly from `useEffect` in UI components.
   - Do not change backend API contracts unless explicitly requested.
   - Do not add dependencies for narrow tasks.
   - Do not refactor unrelated code.

5. **Frontend rules**
   - Prefer Radix Themes primitives, props, and tokens.
   - Use styled-components when Radix is not enough.
   - Use lucide-react for icons.
   - Avoid inline styles and raw hex colors in new or touched code.
   - No user-facing strings directly in production JSX; use i18n keys.
   - Add i18n keys for all supported locales when visible copy changes.
   - Keep components and hooks pure.
   - Do not define components inside render.
   - Avoid unnecessary memoization.
   - Use no `any` or `as any`; prefer `unknown` plus narrowing.
   - Use selectors for Zustand subscriptions.
   - Surface user-relevant failures through existing toaster/error patterns.

6. **Money rules**
   - Use JavaScript `Number` for frontend money values and API payloads.
   - Backend is the source of truth for financial calculations.
   - Do not introduce BigNumber, cents, or integer-money domain models.
   - Do not expand or migrate legacy BigNumber usage during unrelated tasks.

7. **Tests and changelog**
   - Add or update focused tests when behavior changes and a suitable test setup exists.
   - If tests are not added, explain why.
   - Update `src/content/changelog/releases.ts` for user-visible changes when that changelog exists.
   - Do not add changelog entries for internal-only refactors, tests, lint fixes, or agent config changes.

8. **Verify**
   - Run relevant existing scripts from `package.json`.
   - Prefer `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
   - Run `npm run verify` when it is the canonical combined check or when the change reasonably affects app behavior.
   - For docs/config-only changes, explain why full app verification was skipped.
   - Do not claim a check passed unless it was run and succeeded.

9. **Self-review**
   - Run or inspect `git diff --check`, `git diff --stat`, and `git diff`.
   - Check scope, unrelated changes, i18n, loading/empty/error states, API/store contracts, type safety, accessibility, money handling, stale comments, console logs, and dead code.
   - Fix serious findings before reporting back.

10. **Human review handoff**
    - Stop before final git actions.
    - Report branch, changed files, verification results, skipped checks, changelog entry if any, remaining risks, and proposed commit message.
    - Do not treat "do it", "finish", "full flow", "сделай", or similar wording as approval to commit.

## Optional Git Finalization

Only after explicit approval, stage intended files and commit. Stage only files that belong to the reviewed task.

Valid approval examples:

- `approve commit`
- `commit this`
- `можно коммитить`
- `апрув, коммить`
- `да, коммить`

Do not push, create a PR, merge, delete branches, discard changes, or clean up worktrees unless the user explicitly asks.
