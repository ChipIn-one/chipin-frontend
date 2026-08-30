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
- Prefer semantic assertions over snapshots; snapshots are prohibited by default.
- Query components by role and accessible name. Do not assert styled-components class names or Radix internals.
- Use `userEvent.setup()` inside each interaction test; use `fireEvent` only for behavior user-event cannot express.
- Tests follow repository Promise style and return chains instead of using `async`/`await`.

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
- `npm run test:full` runs the complete suite and is used at completion or CI/release checkpoints.
- Type safety: `npm run typecheck`.
- Fast local verification: `npm run verify` (quiet lint plus typecheck; it does not run Vitest or build).
- Full completion gate: `npm run verify:full` (lint, complete Vitest suite, and production build).
- `npm run build` generates the version and builds the app; it does not run tests implicitly.
- `npm run vercel-build` is wired through `vercel.json` and runs the complete Vitest suite before
  the production build; local `npm run build` remains test-free.

Run targeted checks first. Full verification belongs only at integration/completion checkpoints, not after
every mechanical edit. Documentation/config-only changes may skip tests when the handoff explains why no
runtime behavior is affected.

## Legacy Baseline

- Do not fix unrelated existing lint/test failures during a narrow task.
- Run ESLint on touched files when the full baseline is not green.
- Do not introduce new violations and report pre-existing failures explicitly.
- Upgrade migration warnings to errors only after their baseline reaches zero.
