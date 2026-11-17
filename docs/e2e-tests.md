# Frontend e2e tests (Playwright)

The e2e suite checks the app in a real browser against the staging API (#663): the smoke below and the [money-critical flows](#money-critical-flows). Pull requests run it in desktop Chromium; every release candidate runs it on five browser profiles against its immutable Preview ([release browser matrix](#release-browser-matrix)). The smoke mirrors items b to e of `SMOKE-SHORT` ([`release-qa.md`](engineering/release-qa.md), `scripts/release-qa/impact-rules.mjs`, where they carry `automated: true`); item a, the Google sign-in, stays manual because Google OAuth cannot be automated, and so does the real-phone check.

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
| SET-007: a partial payment leaves the remaining debt and appears in both activities         | settle up, activity        |
| SET-007, BAL-003: paying the full debt settles both participants                            | settle up                  |
| EXP-044: editing the amount recalculates both balances                                      | edit an expense            |
| BAL-004, EXP-050: deleting the expense settles both participants                            | delete an expense          |
| GRP-030: a second user joins through the invite link and both see each other                | join by invite link        |
| going offline shows the banner over the saved balance, and reconnecting hides it (Chromium) | offline banner             |
| a balance with cents reads the same amount in English and in Russian                        | money in both UI languages |

Not covered because the app does not have them with the production flags:

- **A note on a settle-up.** The API accepts an optional `note` (`CreateLedgerSettlementPayload` in the generated schema), but the settle-up form has only the amount (`components/modals/settle-up-modal`).
- **A change made offline that syncs after reconnect.** Offline expense writes are behind `VITE_FEATURE_OFFLINE_WRITES` (off), and every ledger, group and user write is refused while offline (`hooks/useLedgerMutations.ts`, `useGroupMutations.ts`, `useUserMutations.ts`), so nothing waits to be sent. The offline test checks the banner only.

The offline spec checks only data held in memory by the open page: no service worker registers on the dev server, so nothing is served from a worker cache.

The offline spec allows service workers (`test.use({ serviceWorkers: 'allow' })`) and runs only in Chromium (desktop and the Pixel profile); on the Firefox and WebKit profiles it is skipped with a link to its Issue (placeholder `TBD-offline-spec-firefox-webkit` until filed). The other specs keep service workers blocked and make no layout assumptions (a control that exists per layout is taken from the visible ones with `visibleOne`), so the release matrix runs them on every profile. On the Vite dev server no service worker registers (`devOptions.enabled: false` in `vite.config.ts`); on a Vercel Preview target the app's worker does.

The invite link is `<app origin>/group/join/<token>` (`buildGroupInviteLink`, `getChipInAppUrl` is `window.location.origin`). The app hands it out only through the native share sheet or the clipboard, which a test cannot read in every browser, so the invite test reads the token through the staging API and opens the link on the target. The token appears in the `goto` URL, traces and failure output; it is dead after the run's purge.

A page that has just written money data is never reloaded or reopened with `goto`: the persisted cache is written at most once per second and the group detail stays fresh for 30 s, so a reload within a second of a write shows the balance from before it (#724). The writing user stays in the app (switches tabs, goes back in the same document, follows in-app links); the other participant opens a fresh context.

The invite test works around #730 (a Join click before the session restore has finished is silently dropped): it opens the invite link, waits for the groups list (read only once the session is restored on the user's client), and only then clicks Join, asserting that the join request succeeded.

One locator exception: the split-share inputs of the expense editor have no accessible name (#725), so `split.spec.ts` finds them structurally, as the input next to the participant's label.

All specs run on pull requests. Estimate: each money test takes about 8 to 20 s (two registrations, one or two contexts, two to four screens), so the eight add about 55 to 85 s with 2 workers, and the test step stays near 2 to 2.5 minutes, well inside its 10-minute timeout. If the measured job grows beyond that, tag the slowest tests `@release` and exclude them on pull requests with `--grep-invert @release`.

## Commands

```bash
npx playwright install chromium   # once per Playwright version (firefox, webkit for those profiles)
CHIPIN_CONTRACT_SWAGGER_USER='<swagger-basic-user>' \
CHIPIN_CONTRACT_SWAGGER_PASSWORD='<swagger-basic-password>' \
npm run test:e2e -- --project=chromium
```

Without `--project` all five profiles run. `npm run test:e2e -- --list` (optionally with `--project=<name>`) lists the tests without credentials or network. `npm run test:full` and `npm run verify:full` never run the Playwright specs: Vitest excludes `e2e/**/*.spec.ts` and collects only the unit tests of the pure support modules (`e2e/support/*.test.ts`).

## Environment

- `CHIPIN_E2E_BASE_URL` (optional): the app origin. Unset, Playwright starts the Vite dev server on `http://localhost:5173` with the commit's code; it proxies `/api` to `https://api-dev.chipin.one` (`vite.config.ts`). Set, it must be a local `http://localhost:<port>` or `http://127.0.0.1:<port>` origin, or a Vercel Preview of this project, `https://chipin-frontend-<hash or git-branch>-sylliks-projects.vercel.app` (its `/api` rewrite also goes to the staging API). Other `*.vercel.app` hosts are rejected.
- `CHIPIN_CONTRACT_SWAGGER_USER`, `CHIPIN_CONTRACT_SWAGGER_PASSWORD` (required to run): the staging Basic credentials, the same ones as the [contract tests](contract-tests.md).
- `VERCEL_AUTOMATION_BYPASS_SECRET` (optional): Vercel's Protection Bypass for Automation secret, needed only if the Preview is behind Vercel deployment protection. It is used only with a Vercel Preview target and sent only to that exact origin (see [Safety guards](#safety-guards)).
- `CHIPIN_E2E_JSON_REPORT` (optional): adds Playwright's JSON reporter writing to that file; the release matrix reads its counts from it.

## Safety guards

- The target is checked while `playwright.config.ts` loads, before the web server, the global setup or any request: `chipin.one`, `www.chipin.one`, `app.chipin.one` and `api.chipin.one` fail with `Production e2e target is forbidden`; any other host, scheme, user info, query, fragment or path fails as not allowlisted.
- Provisioning always goes to `https://api-dev.chipin.one`; the production API is never a target.
- The Vercel bypass header `x-vercel-protection-bypass` is added by a request route of each signed-in context to requests whose origin equals the Preview origin exactly (scheme, host and port), never through `extraHTTPHeaders`, so it never reaches `api-dev.chipin.one`, Google or any other host directly. Requests to the Preview's own `/api` path carry it to Vercel, which serves the rewrite. A trace records the header: CI scans the artifacts for the secret and uploads nothing that contains it.
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

Five projects (`playwright.config.ts`): `chromium` (`Desktop Chrome`), `firefox` (`Desktop Firefox`), `webkit` (`Desktop Safari`), `pixel` (`Pixel 7`, Chromium) and `iphone` (`iPhone 15`, WebKit). The phone profiles have a phone viewport (412 and 393 px wide), touch, a coarse pointer without hover and a mobile user agent; the contexts made by the `signIn` fixture inherit them. The specs use `click()`, which works with touch emulation, and no hover-only interaction. All projects use `en-US` and a light color scheme at start. Service workers are blocked, except in the offline spec. Tests run fully parallel (each registers its own users), with 2 workers in CI. Trace, screenshot and video are kept only for failed tests, in `apps/app/test-results/`; the video is recorded by the `signIn` fixture for each user's context (Playwright's `use.video` does not cover contexts made with `browser.newContext()`) and deleted when the test passes; the HTML report goes to `apps/app/playwright-report/` and is never opened automatically. Both folders are git-ignored. Locators use role, label, placeholder and visible text; there are no fixed sleeps.

## CI

`.github/workflows/e2e-smoke.yml` (workflow `E2E`, job and check `e2e-smoke`) runs the whole suite, the smoke and the money flows, in the `chromium` project only (`--project=chromium`, only Chromium is installed), on pull requests to `master` and on pushes to `master`, on the commit's code with the dev server and the staging API. It is not a required check.

- A `check` job reports whether the staging Basic secrets are available. Without them (forks, Dependabot) the `e2e-smoke` job is shown as skipped, with a notice saying why.
- In `e2e-smoke` the secrets are passed only to the steps that need them (the test run, the artifact scan and the final purge), never as an environment variable of `npm ci`.
- **Trust boundary:** code of a same-repository pull request runs in this job with the staging Basic secrets: its own `playwright.config.ts`, test and support code, and the install scripts of the packages in its lockfile. Anyone who can push a branch to this repository can therefore read these secrets. They grant only staging test provisioning (`/auth/test-register`, `/auth/test-runs/{runId}`), never production.
- A pre-flight request fails the job with a message naming the staging API when it is down, before any test runs.
- A newer push to the same pull request cancels the older run; runs on `master` are never cancelled. Chromium is cached per Playwright version; on a cache hit only its system dependencies are installed. npm is not cached, as in every workflow of this repository (`package-manager-cache: false`).
- The workflow creates the `runId` itself and passes it as `CHIPIN_E2E_RUN_ID`. A final step runs always, also after a cancel, a timeout or a crash of the test step, calls `DELETE /auth/test-runs/{runId}` with curl (the Basic credentials go through curl's stdin config, never its arguments or the log) and logs the counts; after the teardown's purge it deletes nothing.
- On failure, artifacts are considered only when the teardown's marker holds this run's id, i.e. after a verified purge. The report and test results are then scanned for the Basic password and Basic token, including zip files and the HTML report's embedded data, and uploaded with a retention of 3 days only when the scan is clean.

## Release browser matrix

**Prepare frontend release QA** (`.github/workflows/prepare-release-qa.yml`, [`release-qa.md`](engineering/release-qa.md)) runs the whole suite against the immutable Preview URL of the release candidate on all five profiles before the QA Issue is created and the tester is pinged.

Jobs:

1. `resolve` (trusted master workflow code, no install, read-only `GITHUB_TOKEN`): picks the candidate as before (inputs or the zero-input walk), validates its `vercel[bot]` Preview (`chipin-frontend-<id>-sylliks-projects.vercel.app`, public), checks the SHA is inside current `master`, and outputs the SHA, deployment ID, Preview URL and fallback note.
2. `e2e <profile>`, one job per profile, `fail-fast: false`: checks out the **candidate SHA**, so the tests are the code the Preview was built from (a test written for a newer screen never runs against an older build); the SHA is a `master` commit, which is at least as trusted as the pull request code the PR smoke runs. It installs only that profile's browser (cached per Playwright version and browser), creates its own `runId`, runs `npx playwright test --project=<profile>` with `CHIPIN_E2E_BASE_URL` set to the resolved Preview (`playwright.config.ts` still rejects any target outside the allowlist, production included), and purges and handles artifacts exactly like `e2e-smoke`: final purge `if: always()`, report and traces uploaded only after a verified purge and a clean scan (Basic password, Basic token and the bypass secret). It also writes and uploads `e2e-result-<profile>`: `{version, profile, status: passed|failed|error, passed, failed, flaky, skipped}`, counts from the JSON report, `error` when the suite produced none.
3. `prepare` (trusted master code, no install) runs after the matrix whatever its outcome (not after a cancel). It downloads the result files, reads one `result.json` per known profile at a fixed path (regular file, at most 4 KB, exact keys, integer counts, fixed status values; anything else is "no result") and the conclusion of each `e2e <profile>` job from the GitHub API. A profile passed only when its job succeeded and its file reports passed tests and no failure; a failure in either is "failed"; anything else is "no result". Then it creates the QA Issue and the handoff as before ([what the tester sees](engineering/release-qa.md#automation-and-the-human-tester)).

**Trust boundary.** The `e2e` job runs the candidate's `npm ci` install scripts, `playwright.config.ts` and test code with the staging Basic secrets and the optional `VERCEL_AUTOMATION_BYPASS_SECRET`, and `permissions: contents: read`. It never holds `CHIPIN_DEV_READ_TOKEN`, `CHIPIN_ISSUE_WRITE_TOKEN` or `SLACK_WEBHOOK_CI`; only `prepare` does, and it treats the result files as untrusted data (never as paths, Markdown or shell). Workflow expressions never appear inside `run:` scripts; values reach them through `env`.

**Runtime.** The profiles run in parallel, so the matrix adds the time of the slowest profile job: npm ci (about 1 minute), the browser and its system libraries (about 1 to 2 minutes, less on a cache hit), and the 12 tests with 2 workers (about 2 to 3 minutes; WebKit is the slowest). Expected: 5 to 7 minutes. Limits: 6 minutes for the test step and 10 minutes for each profile job, so the matrix never adds more than 10 minutes; a profile that hits the limit shows as "no result". The `prepare` job keeps its own 25 minutes.

**Deployment protection.** The resolver already requires the Preview to answer publicly (the tester opens the same URL). If Vercel deployment protection is turned on for Previews, set the repository secret `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel: Project Settings, Deployment Protection, Protection Bypass for Automation); without it the matrix runs as before.

**Verify after a change.** Run **Prepare frontend release QA** with no inputs: five `e2e` jobs, then `prepare`; the QA Issue starts with the matrix verdict and lists all five profiles before the handoff. For a deliberate break the candidate itself must fail, because the tests come from the candidate SHA and that SHA must be in `master`: merge a throwaway PR that makes one smoke assertion fail (for example an expected balance of `6` instead of `5`), run the workflow with that SHA as `candidate_sha`, check that the QA Issue starts with "The automated browser matrix did not pass" and that the Slack handoff has the "Автотесты в браузерах НЕ прошли" line, then revert the PR (the revert is a new candidate).
