# Codex Code Review Checklist

Use this checklist for final self-review. Request a separate reviewer only for high-risk work, large diffs, or changes that benefit from independent judgment.

## Scope

- The diff matches the request or approved plan and contains no unrelated churn.
- The implementation is the smallest safe change and follows existing patterns.

## Project Invariants

- Dependency direction remains pages -> features -> components -> basics.
- The relevant chapters under `docs/codex/rules/` were applied to new and touched code.
- UI uses Radix responsive props first, project theme helpers, shared money basics, i18n, and accessible semantics.
- UI calls store actions; runtime API calls remain namespaced and below the UI boundary.
- Types remain strict; no `any` or `as any` was added.
- Loading/errors remain centralized and offline financial state remains distinguishable until backend reconciliation.
- Backend contracts remain unchanged unless explicitly in scope.

## Validation

- Run checks proportional to the changed behavior and risk; use `npm run verify` for cross-layer app changes.
- Confirm the evidence is fresh and report skipped, failed, or unavailable checks explicitly.
- If a check fails, identify whether the failure is related to the diff or appears pre-existing.

## Handoff

- List exact files changed and the outcome.
- Report verification results and remaining risks without repeating the full plan.
