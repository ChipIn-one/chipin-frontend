# AGENTS.md

## Goal

This file defines durable working rules for Codex in this repository.
Keep changes small, scoped, verified, and consistent with the existing stack.

## Workflow

- For simple, well-scoped tasks: inspect relevant files, implement the smallest safe diff, run relevant checks, and summarize the result.
- For ambiguous, broad, risky, architectural, financial, auth, data-flow, dependency, or cross-cutting tasks: ask clarifying questions and propose a plan before editing.
- When the user explicitly asks for a plan, review, explanation, or analysis only, do not edit files.
- If an approved plan becomes stale, unsafe, or inconsistent with discovered code, pause and explain the mismatch before continuing.
- Do not refactor unrelated code or change architecture during narrow tasks.

## Repository Stack

- Vite + React + TypeScript strict + styled-components v6 + Radix Themes.
- Use the existing import aliases from `tsconfig.app.json`.
- Prefer existing project patterns over introducing new abstractions.
- Do not add production dependencies for narrow tasks.
- Do not add dev dependencies unless the plan names the gap and why the repository needs it.
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
- Handle API errors explicitly with existing project helpers such as `resolveApiErrorMessage`.
- Surface user-relevant failures through the existing toaster pattern.

## UI

- Prefer Radix Themes primitives, props, and tokens first.
- Use styled-components when Radix primitives or props are not enough.
- Do not add new UI libraries.
- Avoid inline styles in new or touched code; use Radix props or styled-components instead.
- Avoid raw hex colors in new or touched CSS; prefer theme tokens or existing theme helpers.
- `className` is allowed for component pass-through and existing library patterns, not as a new styling system.
- Do not create broad visual redesigns during narrow fixes.

## Barrel Exports

- New public component subdirectories should expose public symbols through `index.ts`.
- Prefer importing from a local barrel when it already exists.
- Do not create broad barrel-export churn during unrelated tasks.
- For new files, prefer named exports and named re-exports.

## React, i18n, And Type Safety

- Components and hooks must stay pure.
- Do not define components inside render.
- Avoid unnecessary memoization.
- No user-facing strings directly in JSX for production UI; use i18n keys.
- No `any` or `as any`; use `unknown` plus narrowing when needed.
- Keep booleans named with `is*` or `has*` when practical.
- Keep event handlers/actions named with `handle*`, `on*`, or `fetch*` when practical.
- Use full, descriptive iterator names in non-trivial code.

## Money

- Use JavaScript `Number` for frontend money values and API payloads.
- Backend is the source of truth for financial calculations.
- Frontend may display rounded values, for example with `toFixed(2)`.
- Do not introduce BigNumber, cents, or integer-money domain models on the frontend.
- Existing BigNumber usage is legacy; do not expand it, and do not migrate it during unrelated tasks.

## Legacy Code

Some existing code may violate newer rules. Do not perform broad cleanup during narrow tasks.
Apply these rules to new and touched code. Fix nearby legacy issues only when they are directly related to the requested change.

## Definition Of Done

Before editing:

- Inspect relevant files and existing patterns.
- For risky or ambiguous work, explain the plan and wait for approval.
- Name files, layers, data flow, store/API responsibilities, and UI components when applicable.

During editing:

- Make the smallest safe diff.
- Prefer workflow, config, or documentation changes when the task is about agent behavior.
- Do not touch routing, state logic, UI components, or business logic unless the approved plan requires it.
- Preserve unrelated user changes in the working tree.

After editing:

- Run relevant existing scripts from `package.json`.
- Prefer `npm run verify` when the change reasonably affects app behavior.
- For narrow docs/config-only changes, explain why full verify was skipped.
- Do not claim tests, typecheck, format checks, or builds passed if the script is missing or was not run.
- Summarize exact files changed and why each change helps.
- Report skipped or failed checks explicitly.
- Self-review for scope, UI, i18n, API/store, type-safety, money, and legacy-rule violations.
