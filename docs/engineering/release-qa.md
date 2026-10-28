# Frontend release QA

Manual QA checks one exact Vercel Preview built from `master` before the owner **Promotes** it. Only UI changes need a tester. QA never gates CI, merge or deployment; the owner makes the release decision.

**Rule for every UI-affecting Issue:** carry 1–3 lines `- [ ] QA: <step> => <expected result>` (a `- [ ] When <action>, then <expected result>` line also works).

## One-time setup

| Name | Kind | Purpose |
| --- | --- | --- |
| `CHIPIN_DEV_READ_TOKEN` | Secret | Read deployments, ruleset, checks, PRs, Issues and the pinned `.github` checkout. |
| `CHIPIN_ISSUE_WRITE_TOKEN` | Secret | Canonical Issue Intake (pinned `.github@7dbcfb2b72fca2d477c14f4d242261d72a103dbd`), QA Issue creation, Project #5 and QA assignment. Without it a UI candidate is blocked before any handoff. |
| `SLACK_WEBHOOK_CI` | Secret | Incoming Webhook for `#chipin-ci`. Keep it secret. |
| `SLACK_USER_MAP` | Repository variable | JSON map of GitHub login to Slack user ID, for example `{"SoRawSteak":"U0C9X8T4R2Q","syllik":"U0OWNER123"}`. The QA login must be mapped for a handoff; `syllik` is mentioned on results when mapped, otherwise the plain login is written. |

## Owner: start a QA round

1. Wait until the newest `master` commit has its Vercel Preview and a green `frontend-ci`.
2. Run **Prepare frontend release QA** on `master` (as `syllik`) with no inputs. Optional overrides: `candidate_sha`, `deployment_id`, `priority` (default `P2`), `qa_login` (default `SoRawSteak`), and `reassign_qa=true` to move an existing same-SHA QA Issue to a new tester.
3. With no inputs the workflow walks the last 20 `master` commits from the head and picks the newest one that has a successful `vercel[bot]` Preview with an immutable URL and a green `frontend-ci` push run. The run output lists skipped SHAs. When it fell back, both Slack lines say `(not master head <short sha>: CI pending)` or `(… Preview pending)`.
4. Every trust check still runs on that candidate: the Preview host must be `chipin-frontend-<id>-sylliks-projects.vercel.app` (no `git-` or `master` alias, no `dev.chipin.one`) and publicly reachable, the SHA must be in current `master` and contain the previous verified Production SHA, and every required check must be green at that SHA. Any failure stops the run.
5. The workflow compares Production to the candidate:
   - **No UI-affecting and no build-affecting change** → `NO_MANUAL_QA_REQUIRED` with the file list in the run output, no QA Issue, one line in `#chipin-ci`. You can Promote.
   - **UI-affecting or build-affecting changes** → it creates (or reuses) one QA Issue, assigns `syllik` plus the tester and posts the handoff in `#chipin-ci`.
6. A run is blocked only when a commit without a linked Issue touches UI-affecting files, or when GitHub/Vercel evidence is missing or inconsistent. Build-affecting changes never block. Fix the record and run it again.

UI-affecting paths are maintained in `scripts/release-qa/ui-paths.mjs`: `src/**` except `*.test.*` and `src/test/**` (this includes the `src/i18n/locales/**` translations), `public/**`, `index.html`, `app.html`, `vercel.json`, `vite.config.ts`, `pwa-assets.config.ts`, and the service-worker build inputs `scripts/prerender-before-workbox.mjs`, `scripts/prerender-public.mjs` and `scripts/private-spa-navigation.ts`.

Build-affecting changes are maintained in the same module. They change the shipped bundle or service worker without a UI path:

- `tsconfig*.json` and `scripts/version-resolver.mjs`;
- in `package.json`, any change in `dependencies`, or a `devDependencies` change of the build/PWA toolchain. The toolchain is every package `vite.config.ts` and `pwa-assets.config.ts` import (`vite`, `vite-plugin-*`, `vite-tsconfig-paths`, `@vitejs/*`, `@vite-pwa/*`, `@sentry/vite-plugin`) plus `workbox-*`. A test parses both config files, so a new plugin cannot be missed;
- in `package-lock.json`, a changed package that ships in the production tree (no `dev` or `devOptional` flag), or one the toolchain pulls in through lockfile `dependencies`, `optionalDependencies` or non-optional `peerDependencies` (for example `rolldown`, `@swc/core`, `lightningcss`, `@svgr/*`). `@types/*` never counts. The project's own entry is ignored, so `npm run version:bump` alone changes nothing.

Lint, test and types devDependency bumps are not build-affecting. If the two package files cannot be read at both SHAs, the change is treated as build-affecting.

What goes into the QA Issue:

- the explicit QA lines of every included Issue whose PR touched UI-affecting files;
- for such an Issue without QA lines: `- [ ] #N: check against the Acceptance of #N => <issue link>`; the Slack handoff names those Issues;
- commits and PRs without a linked Issue that touch no UI-affecting file (Dependabot, docs, CI) are listed as "No QA needed";
- a "Build-affecting changes" list when there are any;
- **SMOKE-SHORT** (`scripts/release-qa/impact-rules.mjs`) when there is a build-affecting change or the compare touches routing, auth/session, `src/api/**`, store bootstrap, service worker/PWA, theme switching or `vercel.json`. Five checks are appended once: Google sign-in opens Dashboard; a group expense split equally is listed and changes the balance; the other participant sees the matching balance in Balances/Settle up; switching language and theme applies without a flash and survives reload; log out, then reload a protected page (fresh login required, [AUTH-041](https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md)). Without SMOKE-SHORT, the AUTH-041 rule alone adds that last check for changes to the auth store, auth session or protected route. It is never added twice.

## Tester: check and report

Tester guide in Russian: [`docs/qa/README.md`](../qa/README.md). Every new QA Issue and the `#chipin-ci` handoff link to it on `master`.

1. Open the immutable Preview URL from the QA Issue and go through the checks.
2. Post **one new comment** in the QA Issue. Its first non-empty line is `QA PASS`, `QA FAIL` or `QA BLOCKED` (case and surrounding spaces do not matter). Notes may follow on the next lines. A first line that starts with `qa` but is not exactly one of those (for example `QA PASSED`, `**QA PASS**`, `QA PASS.`) fails the result run with the allowed lines; post a new comment.
3. For a defect, open the **QA bug** form (`https://github.com/ChipIn-one/chipin-frontend/issues/new?template=qa-bug.yml`, org form from `ChipIn-one/.github`). It asks for steps and what was seen, device, Preview URL, expected result, a `QA:` retest line and the QA Issue link, and presets Type `Bug`, label `Frontend` and assignee `syllik`; Priority and Severity are set afterwards by the owner or an agent. Link the bug in the QA Issue's defect list and post `QA FAIL`.

Only the sole current QA assignee counts. Owner comments, bot comments, other users and edited comments are not results; checkboxes and Slack messages are not acceptance. Results count only in an open Issue titled `Release QA <sha>` with the canonical marker. Editing or deleting a result invalidates it; post a new comment instead.

## Owner: read the result and release

1. **Read frontend release QA result** runs on every Issue comment. It validates comments whose first line starts with `qa` in a QA Issue and ignores the rest. Other users' near-misses are ignored too. Slack gets one line in `#chipin-ci` in two cases:
   - after a valid result, with the outcome, tester, SHA and QA Issue link;
   - when the assigned QA edits or deletes a comment whose previous text was a valid result, saying the result for that SHA is no longer valid.

   A Slack failure is a warning in that run and does not change the validation.
2. Read the current result comment and the latest validation run. Then decide whether to **Promote** that exact deployment in Vercel.
3. After a fix, run a new round: a new SHA gets its own QA Issue. Never carry a PASS across SHAs.

## Retries and recovery

- The hidden `chipin-release-qa:v1` marker (repository + SHA + deployment) is the retry key. Rerunning the same SHA reuses its Issue, checkboxes and comments; a conflicting deployment ID or URL for the same SHA stops the run.
- Preparations run one at a time. When no Issue is visible, creation is blocked while an earlier same-SHA run succeeded or is still running (a zero-input run counts as same-SHA while running or when it was dispatched on that SHA as `master` head). A failed, cancelled or timed-out run without an Issue can simply be run again.
- A failed Slack handoff needs only a same-SHA rerun after fixing the webhook or map.
- To stop handoffs, disable **Prepare frontend release QA** or remove the write-token secret. Existing QA Issues, CI and Vercel are untouched.
