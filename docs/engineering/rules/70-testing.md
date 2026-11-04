# Testing And Verification Rules

## Stack

- Vitest is the runner, assertion, mock, spy, and timer layer.
- React Testing Library renders components and queries accessible DOM behavior.
- `@testing-library/user-event` performs realistic user interactions.
- jsdom supplies `window`, `document`, DOM, and browser-like APIs for component tests.
- This stack does not replace `tsc` and does not verify real CSS layout or a real browser.

## When To Test

Write a focused failing test first for new behavior and reproducible bug fixes when a practical seam exists.

Tests are expected for:

- business rules, money parsing/calculation, selectors, and mappers;
- store actions and loading/error transitions;
- offline pending/sync/retry/reconciliation flows;
- API mapping, optional `0`/`false` values, cancellation, races, and pagination;
- user-visible component behavior, permissions, and accessibility.

Do not create artificial tests for documentation, config-only edits, formatting, generated files, or purely mechanical changes. If a narrow legacy change has no practical seam, report why instead of building a broad harness.

## Test Shape

- Co-locate `*.test.ts`/`*.test.tsx` with the source unless an integration suite has a clearer boundary.
- Test public behavior, not private implementation details.
- Mock resource API modules and external browser boundaries, not internal functions.
- Reset Zustand stores, mocks, timers, and DOM between tests.
- Prefer semantic assertions over snapshots.
- Query components by role and accessible name. Do not assert styled-components class names or Radix internals.
- Narrow a queried element with the type argument, not `as`: `screen.getByRole<HTMLInputElement>('textbox')`.
- Use `userEvent.setup()` inside each interaction test; use `fireEvent` only for behavior user-event cannot express.
- Tests may use `async`/`await` or returned Promise chains; a test never leaves a Promise unawaited.

```tsx
test('submits a group', () => {
    const user = userEvent.setup();

    render(<CreateGroupForm onSubmit={onSubmit} />);

    return user
        .type(screen.getByRole('textbox', { name: /name/i }), 'Trip')
        .then(() => user.click(screen.getByRole('button', { name: /create/i })))
        .then(() => {
            expect(onSubmit).toHaveBeenCalled();
        });
});
```

## Priority

1. Pure helpers, selectors, validators, and DTO mappers.
2. Store actions with mocked API boundaries.
3. Components through accessible user behavior.
4. Cross-layer integration.
5. Real-browser end-to-end tests only for critical flows when separately approved.

Do not test React, Zustand, Axios, or Radix themselves.

## Financial And Offline Coverage

Cover empty/zero/negative/non-finite amounts, decimal normalization, precision boundaries, missing rates, signs, and tolerance. Offline tests cover pending local state, successful reconciliation, retryable failure, duplicate prevention, conflicts, and stale responses not overwriting pending changes.

## Commands

- During development: use `npm run test:task -- <explicit test paths>`; this command refuses to run
  without at least one test path.
- Select tests by the changed behavior: pure helper/selector changes use their co-located tests,
  store/API changes use the owning store/API tests plus directly affected UI tests, and component
  changes use the component test plus the smallest affected integration test.
- `npm run test:full` runs the complete Vitest suite once.
- `npm run typecheck` runs `tsc -b`.
- `npm run format` rewrites the repository with Prettier (`prettier.config.js`); never run it in a task.
  Run `npx prettier --write <files>` on the files you changed. `npm run format:check` checks without
  writing; `verify`, `verify:full`, and CI run it, so CI enforces formatting.
- `npm run lint` runs ESLint with `--max-warnings 0` and the rule registry check; `npm run lint:full`
  runs ESLint in full mode (`CHIPIN_ESLINT_FULL=1`, for CI-only rules; there are none yet,
  `import-x/no-cycle` arrives in 02-C9). The registry check always resolves the config in both
  modes and checks their union, so a full-only rule must be registered and is not reported as
  dead in `lint`. Extra arguments go to ESLint: `npm run lint -- <args>`.
- `npm run baseline:update` prunes fixed entries from `eslint-suppressions.json`; it never adds entries.
- `npm run verify` is the fast local check: format check, lint, and typecheck; it does not run
  Vitest or build.
- `npm run verify:full` is the full gate and the same command CI runs: format check, `lint:full`, the
  complete Vitest suite, the production build, and the ds-gallery build. CI also runs
  `scripts/check-baseline.mjs` on pull requests. Husky `pre-push` runs `version:check` and
  `verify:full`.
- `npm run build` runs `tsc -b`, the Vite production build, and the public precache check; it does not run tests.
- `npm run vercel-build` (wired through `vercel.json`) is the Vercel deployment build: Vite production
  build and public precache check, no tests and no icon generation.
- `npm run version:check` validates matching versions in `package.json` and `package-lock.json` without writing.

## Legacy Baseline

- New and substantially refactored code follows this rulebook; a narrow edit in legacy code keeps the
  touched flow consistent with it but does not migrate whole directories or start unrelated cleanup.
- Every ESLint rule is `error` or `off`; there is no `warn` level (spec 02 §D0). Lint runs with
  `--max-warnings 0` only as a guard against an accidental `warn`. Each enabled rule is registered
  in `config/eslint/rule-classes.json` as class a (auto-fixable) or b (correctness or boundary);
  `scripts/check-rule-registry.mjs` (part of `npm run lint`) fails on a missing entry, a class c rule,
  a `warn` level, or a registry key that is not effective on any linted file.
- Known violations live in `eslint-suppressions.json` (native ESLint bulk suppressions): a count per
  file and rule. More violations than recorded fail lint; the file only shrinks.
  `npm run baseline:update` (`eslint . --prune-suppressions`) removes entries that no longer fire.
- Suppressions are keyed per rule (`no-restricted-syntax`), not per selector id. So only the PR that
  first registers a rule in `rule-classes.json` (no `<rule>` or `<rule>#<id>` key at base) may add
  suppressions for it, with `npx eslint . --suppress-rule <rule>`. Any later PR that adds selectors
  or ids under an already registered rule must fix all of their violations in the same PR. CI
  `scripts/check-baseline.mjs` fails on any other new entry or higher count.
- Today `no-restricted-syntax` is unregistered, so whichever PR first adds selectors to it (the 03-1
  money selectors or 02-C12) owns its initial suppressions.
- Do not fix unrelated existing lint/test failures during a narrow task, and do not add
  suppressions or `eslint-disable` comments to make a new violation pass.
