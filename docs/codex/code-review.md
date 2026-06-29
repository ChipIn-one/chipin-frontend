# Codex Code Review Checklist

Use this checklist before handing off Codex-generated changes.

## Scope

- The diff follows the approved plan.
- The change is the smallest safe diff for the request.
- Unrelated refactors, formatting churn, route changes, state rewrites, and business logic changes are absent.
- Existing app architecture is preserved: pages -> features -> components -> basics.

## Frontend UI

- Radix Themes primitives are used where appropriate.
- Styling uses existing patterns and styled-components v6 when custom styling is needed.
- There are no inline styles.
- `className` is not used for styling unless the surrounding file already requires that pattern.
- No new UI library was introduced.
- User-facing text in JSX uses i18n keys.
- Comments are in English and only explain non-obvious logic.

## Data Flow

- UI does not call `fetch` or `axios` directly.
- API calls stay in the existing API/service/store patterns.
- Store selectors are used where the existing pattern expects them.
- Backend API contracts are unchanged unless the approved task explicitly covers the contract.
- Backend remains the source of truth for financial calculations.

## Type Safety And Money

- No `any` or `as any` was added.
- Unknown data is narrowed before use.
- Frontend money values use JavaScript `Number` unless an existing helper requires otherwise.
- UI may round values for display only.
- No decimal, Big.js, or BigNumber dependency was added for new frontend work.

## Validation

- Run relevant existing `package.json` scripts.
- Prefer `npm run verify` for frontend or workflow changes in this repo.
- If `npm run verify` is not appropriate, run and report the most relevant available scripts.
- Do not claim `typecheck`, `test`, or `format:check` passed if the script does not exist.
- If a check fails, identify whether the failure is related to the diff or appears pre-existing.

## Handoff

- List exact files changed.
- Explain why each changed file reduces future agent risk.
- Report failed or skipped checks.
- Self-review the diff against `AGENTS.md`.
