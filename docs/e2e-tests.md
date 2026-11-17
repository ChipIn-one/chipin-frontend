# Frontend e2e smoke (Playwright)

The Chromium smoke checks the app in a real browser against the staging API (#663). It mirrors items b to e of `SMOKE-SHORT` ([`release-qa.md`](engineering/release-qa.md), `scripts/release-qa/impact-rules.mjs`); item a, the Google sign-in, stays manual because Google OAuth cannot be automated.

| Test                                                            | SMOKE-SHORT |
| --------------------------------------------------------------- | ----------- |
| an equal-split group expense is listed and changes the balance  | b           |
| the other participant sees the matching balance in Balances     | c           |
| language and theme apply without a flash and survive a reload   | d           |
| after log out, reloading a protected page asks to sign in again | e           |

Code: `apps/app/playwright.config.ts`, `apps/app/e2e/specs/` (tests), `apps/app/e2e/support/` (target guard, provisioning, fixtures, global setup, UI helpers).

## Money-critical flows

`apps/app/e2e/specs/money/` covers the flows of #667, named by KB requirement IDs where one exists. Each test arranges its preconditions through the staging API, does the checked action in the UI and asserts the amounts as shown, for both participants where two are involved (each in its own signed-in context).

| Test                                                                                        | Flow                       |
| ------------------------------------------------------------------------------------------- | -------------------------- |
| EXP-011: an expense split by amounts gives each participant their own share                 | unequal split              |
| SET-007: a partial payment leaves the remaining debt for both participants                  | settle up                  |
| SET-007, BAL-003: paying the full debt settles both participants                            | settle up                  |
| SET-007: a payment appears in the activity of both participants                             | settle up, activity        |
| EXP-044: editing the amount recalculates both balances                                      | edit an expense            |
| BAL-004, EXP-050: deleting the expense settles both participants                            | delete an expense          |
| GRP-030: a second user joins through the invite link and both see each other                | join by invite link        |
| going offline shows the banner over the saved balance, and reconnecting hides it (Chromium) | offline banner             |
| a balance with cents reads the same amount in English and in Russian                        | money in both UI languages |

Not covered because the app does not have them with the production flags:

- **A note on a settle-up.** The API accepts an optional `note` (`CreateLedgerSettlementPayload` in the generated schema), but the settle-up form has only the amount (`components/modals/settle-up-modal`).
- **A change made offline that syncs after reconnect.** Offline expense writes are behind `VITE_FEATURE_OFFLINE_WRITES` (off), and every ledger, group and user write is refused while offline (`hooks/useLedgerMutations.ts`, `useGroupMutations.ts`, `useUserMutations.ts`), so nothing waits to be sent. The offline test checks the banner only.

The offline spec allows service workers (`test.use({ serviceWorkers: 'allow' })`) and skips every browser but Chromium; the other specs keep service workers blocked and make no desktop-only layout assumptions (a control that exists per layout is taken from the visible ones), so the release matrix (#666) can run them on every profile. On the Vite dev server no service worker registers (`devOptions.enabled: false` in `vite.config.ts`); on a Vercel Preview target the app's worker does.

The invite link the app shares points at the production app origin (`buildGroupInviteLink`), so the invite test opens its path, `/group/join/<token>`, on the target. The token is read through the staging API and never logged or put in a title.

All specs run on pull requests. Estimate: each money test takes about 8 to 20 s (two registrations, one or two contexts, two to four screens), so the nine add about 60 to 90 s with 2 workers, and the test step stays near 2 to 2.5 minutes, well inside its 10-minute timeout. If the measured job grows beyond that, tag the slowest tests `@release` and exclude them on pull requests with `--grep-invert @release`.

## Commands

```bash
npx playwright install chromium   # once per Playwright version
CHIPIN_CONTRACT_SWAGGER_USER='<swagger-basic-user>' \
CHIPIN_CONTRACT_SWAGGER_PASSWORD='<swagger-basic-password>' \
npm run test:e2e
```

`npm run test:e2e -- --list` lists the tests without credentials or network. `npm run test:full` and `npm run verify:full` never run the Playwright specs: Vitest excludes `e2e/**/*.spec.ts` and collects only the unit tests of the pure support modules (`e2e/support/*.test.ts`).

## Environment

- `CHIPIN_E2E_BASE_URL` (optional): the app origin. Unset, Playwright starts the Vite dev server on `http://localhost:5173` with the commit's code; it proxies `/api` to `https://api-dev.chipin.one` (`vite.config.ts`). Set, it must be a local `http://localhost:<port>` or `http://127.0.0.1:<port>` origin, or a Vercel Preview of this project, `https://chipin-frontend-<hash or git-branch>-sylliks-projects.vercel.app` (its `/api` rewrite also goes to the staging API). Other `*.vercel.app` hosts are rejected.
- `CHIPIN_CONTRACT_SWAGGER_USER`, `CHIPIN_CONTRACT_SWAGGER_PASSWORD` (required to run): the staging Basic credentials, the same ones as the [contract tests](contract-tests.md).

## Safety guards

- The target is checked while `playwright.config.ts` loads, before the web server, the global setup or any request: `chipin.one`, `www.chipin.one`, `app.chipin.one` and `api.chipin.one` fail with `Production e2e target is forbidden`; any other host, scheme, user info, query, fragment or path fails as not allowlisted.
- Provisioning always goes to `https://api-dev.chipin.one`; the production API is never a target.
- Missing credentials fail the global setup with a message that names the variables, never their values. An unreachable staging API fails the global setup with a message that names it.
- The Basic credentials are used only by Node `fetch` in the support code, never by Playwright's `request` or a page, so they reach no trace or report; CI also scans the artifacts for them. Error messages name the method and path, never a body or header.
- Session material of the run's test users is not kept out of the artifacts: the browser carries each user's refresh cookie and receives access tokens from the app's own refresh calls, so a trace or the HTML report can contain them. These users are deleted by the run's purge, and CI uploads artifacts only after that purge is verified; an access token in an artifact may still be accepted until it expires if the backend does not reject tokens of deleted users. Only the Basic credentials are guaranteed absent.

## Provisioning and cleanup

1. The global setup uses the `runId` from `CHIPIN_E2E_RUN_ID` when it has the format `fe-e2e-<13-digit ms>-<12 hex>` (CI creates it this way), else creates a new one, and passes it to the workers.
2. Each test registers its own users with `POST /auth/test-register` under that `runId` (Basic auth). A refresh token rotates on first use, so users are not shared between tests.
3. Preconditions (friendship by invite link, a group with both users, for test c an expense) are arranged through the staging API with the users' Bearer tokens. The checked action goes through the UI.
4. Each user gets its own browser context with a working session and no sign-in UI: the `__Host-chipin_refresh` cookie from registration, host-only on the app origin (the app reaches the API through its own `/api` proxy), and the session hint `Chipin_authSessionHint=true` in localStorage. The app restores the session with a cookie refresh, as after a real sign-in.
5. After all tests, also after a failure, the global teardown calls `DELETE /auth/test-runs/{runId}` (retried once on failure), then purges again (also retried once) and fails if that second call still deletes users. Only then does it log the counts (`[e2e] purged run …: users=… groups=… expenses=… settlements=… activityEvents=…`) and write the marker `apps/app/test-results/.purge-verified` with the run id.

The run stays self-contained: no test user or its data is ever connected to an account outside the same `runId`.

## Browser settings

Chromium only (`Desktop Chrome`), `en-US`, light color scheme at start. Service workers are blocked, except in the offline spec. Tests run fully parallel (each registers its own users), with 2 workers in CI. Trace, screenshot and video are kept only for failed tests, in `apps/app/test-results/`; the video is recorded by the `signIn` fixture for each user's context (Playwright's `use.video` does not cover contexts made with `browser.newContext()`) and deleted when the test passes; the HTML report goes to `apps/app/playwright-report/` and is never opened automatically. Both folders are git-ignored. Locators use role, label, placeholder and visible text; there are no fixed sleeps.

## CI

`.github/workflows/e2e-smoke.yml` runs the smoke on pull requests to `master` and on pushes to `master`, on the commit's code with the dev server and the staging API. It is not a required check.

- A `check` job reports whether the staging Basic secrets are available. Without them (forks, Dependabot) the `e2e-smoke` job is shown as skipped, with a notice saying why.
- In `e2e-smoke` the secrets are passed only to the steps that need them (the test run, the artifact scan and the final purge), never as an environment variable of `npm ci`.
- **Trust boundary:** code of a same-repository pull request runs in this job with the staging Basic secrets: its own `playwright.config.ts`, test and support code, and the install scripts of the packages in its lockfile. Anyone who can push a branch to this repository can therefore read these secrets. They grant only staging test provisioning (`/auth/test-register`, `/auth/test-runs/{runId}`), never production.
- A pre-flight request fails the job with a message naming the staging API when it is down, before any test runs.
- A newer push to the same pull request cancels the older run; runs on `master` are never cancelled. Chromium is cached per Playwright version; on a cache hit only its system dependencies are installed. npm is not cached, as in every workflow of this repository (`package-manager-cache: false`).
- The workflow creates the `runId` itself and passes it as `CHIPIN_E2E_RUN_ID`. A final step runs always, also after a cancel, a timeout or a crash of the test step, calls `DELETE /auth/test-runs/{runId}` with curl (the Basic credentials go through curl's stdin config, never its arguments or the log) and logs the counts; after the teardown's purge it deletes nothing.
- On failure, artifacts are considered only when the teardown's marker holds this run's id, i.e. after a verified purge. The report and test results are then scanned for the Basic password and Basic token, including zip files and the HTML report's embedded data, and uploaded with a retention of 3 days only when the scan is clean.
