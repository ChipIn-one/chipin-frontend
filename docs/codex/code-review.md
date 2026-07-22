# Codex Code Review Checklist

Use this checklist for final self-review. Request a separate reviewer only for high-risk work, large diffs, or changes that benefit from independent judgment.

## Staged Review Gate

The user manually inspects implementation changes and owns the Git index. `review` and `staged` are explicit
commands to run `superpowers:requesting-code-review` against the staged candidate.

```bash
git diff --cached --stat
git diff --cached
```

- Review only staged changes by default. Unstaged and untracked files are outside the finding scope.
- Read surrounding code when necessary to understand the staged patch, but do not broaden findings into
  unrelated cleanup.
- Use `git diff HEAD` only when the user explicitly requests review of the whole task or all current changes.
- If no staged patch exists, report that nothing is staged and stop.
- Never stage reviewer fixes automatically. Apply confirmed Critical and Important fixes to the working tree
  as unstaged changes for the user to inspect.
- Once the user stages fixes and sends `review` or `staged` again, review the staged candidate again before
  declaring it approved.
- A review-only request outside this explicit staged workflow remains read-only unless the user authorizes
  fixes.

## Scope

- The diff matches the request or approved plan and contains no unrelated churn.
- The implementation is the smallest safe change and follows existing patterns.
- New and substantially refactored nested directories follow the recursive ownership structure from
  `rules/10-architecture.md`; legacy directories are not migrated incidentally.

## Project Invariants

- Dependency direction remains pages -> features -> components -> basics.
- Directory boundaries expose focused `index.ts` files, consumers avoid deep imports, and root barrels do
  not leak `internal/` implementation details.
- Primary components, subcomponents, `internal` support files, `styled.ts`, public/private types, and
  co-located tests are placed at their documented ownership level without empty scaffolding.
- The relevant chapters under `docs/codex/rules/` were applied to new and touched code.
- UI uses Radix responsive props first, project theme helpers, shared money basics, i18n, and accessible semantics.
- UI calls store actions; runtime API calls remain namespaced and below the UI boundary.
- Types remain strict; no `any` or `as any` was added.
- Dynamic collections are traversed once per computation when multiple results can be collected together;
  repeated array methods, repeated `Object.*` conversions, nested scans, and copying `reduce` accumulators
  are rejected unless a documented exception applies.
- Loading/errors remain centralized and offline financial state remains distinguishable until backend reconciliation.
- Backend contracts remain unchanged unless explicitly in scope.

## Validation

- Run checks proportional to the changed behavior and risk; use `npm run verify` for cross-layer app changes.
- Confirm the evidence is fresh and report skipped, failed, or unavailable checks explicitly.
- If a check fails, identify whether the failure is related to the diff or appears pre-existing.

## Handoff

- List exact files changed and the outcome.
- Report verification results and remaining risks without repeating the full plan.
