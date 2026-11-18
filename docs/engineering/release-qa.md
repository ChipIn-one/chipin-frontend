# Frontend release QA

Manual QA checks one exact Vercel Preview built from `master` before the owner **Promotes** it. Before the tester is pinged, the Playwright suite runs against the same Preview on five browser profiles ([Automation and the human tester](#automation-and-the-human-tester)). Only UI changes need a tester. QA never gates CI, merge or deployment; the owner makes the release decision.

**Rule for every UI-affecting change:** the Issue carries 1–3 lines `- [ ] QA: <step> => <expected result>` (a `- [ ] When <action>, then <expected result>` line also works), or each UI-affecting PR body has a `## QA` section with checklist steps (`npm run pr:create` adds it with a prompt; PR metadata fails a UI-affecting PR without steps). An epic-level Issue that spans several PRs usually relies on its PRs' sections. A label such as `## QA (owner)` is allowed but chooses nobody: the tester is the `qa_login` of the QA round.

## One-time setup

| Name                                                               | Kind                | Purpose                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CHIPIN_DEV_READ_TOKEN`                                            | Secret              | Read deployments, ruleset, checks, PRs, Issues and the pinned `.github` checkout.                                                                                                                                                                                                                      |
| `CHIPIN_ISSUE_WRITE_TOKEN`                                         | Secret              | Canonical Issue Intake (pinned `.github@7dbcfb2b72fca2d477c14f4d242261d72a103dbd`), QA Issue creation, Project #5 and QA assignment. Without it a UI candidate is blocked before any handoff.                                                                                                          |
| `SLACK_WEBHOOK_CI`                                                 | Secret              | Incoming Webhook for `#chipin-ci`. Keep it secret.                                                                                                                                                                                                                                                     |
| `CHIPIN_CONTRACT_SWAGGER_USER`, `CHIPIN_CONTRACT_SWAGGER_PASSWORD` | Secrets             | Staging Basic credentials for the browser matrix's test provisioning (the same ones as the e2e and contract tests). Only the `e2e` jobs get them.                                                                                                                                                      |
| `VERCEL_AUTOMATION_BYPASS_SECRET`                                  | Secret, optional    | Vercel Protection Bypass for Automation, only if Previews are behind deployment protection. Sent only to the validated Preview URL: by the public-Preview probe of `resolve` and `prepare`, and on the `e2e` jobs' document navigations (never to `/api`). Without it everything runs as before.       |
| `SLACK_USER_MAP`                                                   | Repository variable | JSON map of GitHub login to Slack user ID, for example `{"SoRawSteak":"U0C9X8T4R2Q","syllik":"U0OWNER123"}`. The QA login must be mapped for a handoff (not needed when `qa_login=syllik`, which mentions nobody); `syllik` is mentioned on results when mapped, otherwise the plain login is written. |

## Owner: start a QA round

1. Wait until the newest `master` commit has its Vercel Preview and a green `frontend-ci`.
2. Run **Prepare frontend release QA** on `master` (as `syllik`) with no inputs. Optional overrides: `candidate_sha`, `deployment_id`, `priority` (default `P2`), `qa_login` (default `SoRawSteak`), and `reassign_qa=true` to move an existing same-SHA QA Issue to a new tester. `qa_login=syllik` makes the owner the QA (see [Owner as QA](#owner-as-qa)).
3. With no inputs the workflow walks the last 20 `master` commits from the head and picks the newest one that has a successful `vercel[bot]` Preview with an immutable URL and a green `frontend-ci` push run. The run output lists skipped SHAs. When it fell back, both Slack lines say `(не последний коммит master <short sha>: ждёт CI)` or `(… ждёт Preview)`.
4. Every trust check still runs on that candidate: the Preview host must be `chipin-frontend-<id>-sylliks-projects.vercel.app` (no `git-` or `master` alias, no `dev.chipin.one`) and publicly reachable, the SHA must be in current `master` and contain the previous verified Production SHA, and every required check must be green at that SHA. Any failure stops the run.
5. The `e2e` jobs run the Playwright suite (smoke + money flows) from the candidate SHA against its immutable Preview on desktop Chromium, Firefox and WebKit, a Pixel 7 and an iPhone 15 profile, in parallel ([release browser matrix](../e2e-tests.md#release-browser-matrix)). Their result never stops the run: a failed matrix, or one that produced no result, is stated in the QA Issue and in Slack.
6. The workflow compares Production to the candidate:
   - **No UI-affecting and no build-affecting change** → `NO_MANUAL_QA_REQUIRED` with the file list in the run output, no QA Issue, one message in `#chipin-ci` (with the matrix line). You can Promote; read the matrix line first.
   - **UI-affecting or build-affecting changes** → it creates (or reuses) one QA Issue, assigns `syllik` plus the tester (or `syllik` alone when `qa_login=syllik`) and posts the handoff in `#chipin-ci`.
7. A run is blocked only when a commit without a linked Issue touches UI-affecting files, or when GitHub/Vercel evidence is missing or inconsistent. Build-affecting changes never block. Fix the record and run it again.

### Large releases

GitHub's compare lists at most 300 changed files. When the Production-to-candidate compare reports 300 or more, the run rebuilds the file list from the files of every commit in the compare (`total_commits`, read page by page), and each commit's files are read page by page too. The rebuilt list is the union of what each commit touched, so a file changed and later reverted still counts; UI impact is never decided from a cut list. The rest of the run is unchanged.

A large release still blocks when:

- the number of distinct commits read differs from the compare's `total_commits`;
- one commit's files are unreadable, or that commit reaches GitHub's own 3000-file bound for a single commit.

UI-affecting paths are maintained in `scripts/release-qa/ui-paths.mjs`: `apps/app/src/**` except `*.test.*` and `apps/app/src/test/**` (this includes the `apps/app/src/i18n/locales/**` translations), `packages/i18n-content/**` except `*.test.*` (the locale list and the `common` translations), `packages/tokens/**` except `*.test.*` (design tokens, Radix color scales, the theme constants and script), `apps/app/public/**`, `apps/app/index.html`, `apps/app/app.html`, `apps/app/vercel.json`, `apps/app/vite.config.ts`, `apps/app/pwa-assets.config.ts`, and the service-worker build inputs `apps/app/scripts/prerender-before-workbox.mjs`, `apps/app/scripts/prerender-public.mjs` and `apps/app/scripts/private-spa-navigation.ts`.

Build-affecting changes are maintained in the same module. They change the shipped bundle or service worker without a UI path:

- `tsconfig*.json` (root and `apps/app/`) and `scripts/version-resolver.mjs`;
- in `package.json`, any change in `dependencies`, or a `devDependencies` change of the build/PWA toolchain. The toolchain is every package `apps/app/vite.config.ts` and `apps/app/pwa-assets.config.ts` import (`vite`, `vite-plugin-*`, `vite-tsconfig-paths`, `@vitejs/*`, `@vite-pwa/*`, `@sentry/vite-plugin`) plus `workbox-*`. A test parses both config files, so a new plugin cannot be missed;
- in `package-lock.json`, a changed package that ships in the production tree (no `dev` or `devOptional` flag), or one the toolchain pulls in through lockfile `dependencies`, `optionalDependencies` or non-optional `peerDependencies` (for example `rolldown`, `@swc/core`, `lightningcss`, `@svgr/*`). `@types/*` never counts. The project's own entry is ignored, so a change to its `version` alone changes nothing.

Lint, test and types devDependency bumps are not build-affecting. If the two package files cannot be read at both SHAs, the change is treated as build-affecting.

What goes into the QA Issue:

- the explicit QA lines of every included Issue whose PR touched UI-affecting files, under a `#### #N: <Issue title>` heading;
- the QA steps of every merged PR in the compare that touched UI-affecting files, under a `#### PR #M: <PR title> (#N)` heading per PR, as `- [ ] PR #M: <step>` (with ` => <expected>` when the step has one). Steps are every list item (`-`, `*`, `+` or numbered) of a `## QA` section (with or without a label in parentheses, such as `## QA (owner)`) and any `- [ ] QA:` line elsewhere in the body. Sub-headings stay in the section; nested items and indented continuation lines join their parent step; code blocks, HTML comments, unfilled `- [ ]` items and whole-item `None`/`n/a` are skipped. At most 20 steps of 300 characters per PR, and about 40,000 characters of PR steps and headings per QA Issue; past that budget each further PR gets one `more QA steps are in the body of PR #M` line. `<` and `>` are removed and `@mentions` and `#123` references are broken, so PR text cannot fake the QA marker or notify anyone, and short references add no cross-references (full Issue URLs still do);
- only when neither the Issue nor any of its UI-affecting PRs in the compare has QA steps: `- [ ] #N: check against the Acceptance of #N => <issue link>` and a "Missing QA steps" section (Slack does not repeat it);
- commits and PRs without a linked Issue that touch no UI-affecting file (Dependabot, docs, CI) are listed as "No QA needed";
- a "Build-affecting changes" list when there are any;
- **SMOKE-SHORT** (`scripts/release-qa/impact-rules.mjs`) when there is a build-affecting change or the compare touches routing, auth/session, `apps/app/src/api/**`, store bootstrap, service worker/PWA, theme switching or `vercel.json`. Six checks are appended once: (a) Google sign-in opens Dashboard; (b) a group expense split equally is listed and changes the balance; (c) the other participant sees the matching balance in Balances/Settle up; (d) switching language and theme applies without a flash and survives reload; (e) log out, then reload a protected page (fresh login required, [AUTH-041](https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md)); (f) on a real phone, the keyboard, the safe area, the installed PWA and the look of new screens. b to e carry `automated: true`: when the browser matrix passed on all five profiles they are listed under `#### SMOKE-SHORT covered by the browser matrix` as `- SMOKE-SHORT (automated): …` without a checkbox; otherwise they stay checkboxes with "(the browser matrix did not pass: check by hand)". Without SMOKE-SHORT, the AUTH-041 rule alone adds the AUTH-041 check for changes to the auth store, auth session or protected route. It is never added twice.

## Automation and the human tester

| Check                                                                               | Who                        | Why                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SMOKE-SHORT b to e, money flows (split, settle up, edit, delete, invite, languages) | Browser matrix, 5 profiles | Scripted in `apps/app/e2e/` against the immutable Preview with staging test users.                                                                                             |
| SMOKE-SHORT a: Google sign-in                                                       | Tester                     | Real Google OAuth cannot be automated; the suite signs in with staging test sessions.                                                                                          |
| SMOKE-SHORT f: keyboard, safe area, installed PWA, look of new screens              | Tester, on a real phone    | Emulated profiles have no on-screen keyboard, notch or home bar, cannot install a PWA, and no screenshot comparison is run.                                                    |
| QA steps of the included Issues and PRs                                             | Tester                     | Written per change by people; most check something new or visual.                                                                                                              |
| Service-worker offline cache on Firefox and WebKit                                  | Not covered yet            | Playwright controls service workers only in Chromium; the offline banner itself is covered on all profiles ([#735](https://github.com/ChipIn-one/chipin-frontend/issues/735)). |

What the QA Issue shows, from the top:

1. The matrix verdict, right below the hidden marker. Passed: `> [!NOTE]` "The automated browser matrix passed on all 5 profiles (run)". Otherwise: `> [!CAUTION]` "**The automated browser matrix did not pass.** Failed: … No result: … See the run." A profile is "failed" when its tests failed or its job failed, "no result" when its job produced no valid result (setup failure, staging down, timeout, cancel, unreadable job list), and "not in this candidate" when the candidate predates the browser matrix (its `playwright.config.ts` has no project for that profile; the banner says "The candidate predates the browser matrix", Slack "кандидат старше этих профилей").
2. In Acceptance, after the Preview URL, `### Automated browser matrix`: one row per profile with the result and the passed, failed, flaky and skipped counts, and the run link.
3. The checks as before, with SMOKE-SHORT b to e marked as automated or given back to the tester as above.

The human `QA PASS` gate does not change: the owner reads the matrix verdict and the tester's result before Promote. When the same SHA is prepared again (a new dispatch or "Re-run failed jobs"), the Issue body is kept and the new matrix result is posted as a comment before the handoff (it never starts with `qa`, so the result reader ignores it). The comment lists the SMOKE-SHORT checks whose owner changes: after a failed matrix, b to e as unchecked `- [ ]` boxes "(the browser matrix did not pass: check by hand)", even if the body from an earlier passing round lists them as automated; after a passed matrix, b to e as covered.

## Slack messages

All four messages use Slack links `<url|text>` with a short SHA; there are no bare URLs. The commit link is `https://github.com/ChipIn-one/chipin-frontend/commit/<full sha>`. Every value comes from a validated field (SHA, Issue number, GitHub login, URLs from the GitHub API or constants); `&` is escaped and `<`, `>`, `|` are rejected. Examples for SHA `de85a9a…` and QA Issue #561:

| Case             | Text                                                                                                                                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA needed        | `<@QA> Релиз-кандидат <commit\|de85a9a> — нужна проверка`, then the matrix line, then `<preview\|QA Build>`, `<issue\|QA Issue #561>`, `<guide\|QA Guide>` on three lines. With `qa_login=syllik` the first line is `Релиз-кандидат <commit\|de85a9a> — проверяет владелец` and nobody is mentioned. |
| QA not needed    | `Релиз-кандидат <commit\|de85a9a> — QA не нужен, UI не менялся`, then the matrix line, then `<preview\|Build>`.                                                                                                                                                                                      |
| Valid result     | `<@owner> QA PASS по <commit\|de85a9a> — <issue\|QA Issue #561> (QA: SoRawSteak)`; `QA FAIL` and `QA BLOCKED` alike.                                                                                                                                                                                 |
| Withdrawn result | `<@owner> Результат QA по <commit\|de85a9a> отозван — <issue\|QA Issue #561>`                                                                                                                                                                                                                        |

The matrix line is `Автотесты в браузерах прошли на всех 5 профилях — <run|Run>`, or on a failure `Автотесты в браузерах НЕ прошли (упали: Desktop Firefox; без результата: iPhone 15 (WebKit)) — <run|Run>`, built from fixed profile labels only. The fallback note goes at the end of the first line. `<@owner>` is the owner's Slack ID from `SLACK_USER_MAP`, or the plain login `syllik` without a mapping.

## Owner as QA

When the tester is away, the owner checks the build himself.

1. Run **Prepare frontend release QA** with `qa_login=syllik`. For a SHA that already has a QA Issue with a tester, add `reassign_qa=true`; the tester is removed and `syllik` stays the only assignee. The run fails if the read-back shows anything else.
2. The handoff says the owner checks and mentions nobody.
3. Post a new `QA PASS`, `QA FAIL` or `QA BLOCKED` comment in the QA Issue. It counts as the result because `syllik` is the sole assignee, and the result message is posted as usual. The same rules apply as for a tester: new unedited comment, open `Release QA <sha>` Issue with the marker, near-misses fail the run, and editing or deleting the result withdraws it.
4. To give the round back to the tester, rerun with `qa_login=<tester>` (the tester is added next to `syllik`).

While a tester is assigned, owner comments never count as results.

## Tester: check and report

Tester guide in Russian: [`docs/qa/README.md`](../qa/README.md). Every new QA Issue and the `#chipin-ci` handoff link to it on `master`.

1. Open the immutable Preview URL from the QA Issue and go through the checks.
2. Post **one new comment** in the QA Issue. Its first non-empty line is `QA PASS`, `QA FAIL` or `QA BLOCKED` (case and surrounding spaces do not matter). Notes may follow on the next lines. A first line that starts with `qa` but is not exactly one of those (for example `QA PASSED`, `**QA PASS**`, `QA PASS.`) fails the result run with the allowed lines; post a new comment.
3. For a defect, open the **QA bug** form (`https://github.com/ChipIn-one/chipin-frontend/issues/new?template=qa-bug.yml`, org form from `ChipIn-one/.github`). It asks for steps and what was seen, device, Preview URL, expected result, a `QA:` retest line and the QA Issue link, and presets Type `Bug`, label `Frontend` and assignee `syllik`; Priority and Severity are set afterwards by the owner or an agent. Link the bug in the QA Issue's defect list and post `QA FAIL`.

Only the sole current QA assignee counts; that is `syllik` only when he is the sole assignee ([Owner as QA](#owner-as-qa)). Otherwise owner comments, bot comments, other users and edited comments are not results; checkboxes and Slack messages are not acceptance. Results count only in an open Issue titled `Release QA <sha>` with the canonical marker. Editing or deleting a result invalidates it; post a new comment instead.

## Owner: read the result and release

1. **Read frontend release QA result** runs on every Issue comment. It validates comments whose first line starts with `qa` in a QA Issue and ignores the rest. Other users' near-misses are ignored too. Slack gets one line in `#chipin-ci` in two cases:
   - after a valid result, with the outcome, tester, SHA and QA Issue link;
   - when the assigned QA edits or deletes a comment whose previous text was a valid result, saying the result for that SHA is withdrawn.

   The exact texts are in [Slack messages](#slack-messages).

   A Slack failure is a warning in that run and does not change the validation.

2. Read the current result comment and the latest validation run. Then decide whether to **Promote** that exact deployment in Vercel.
3. After a fix, run a new round: a new SHA gets its own QA Issue. Never carry a PASS across SHAs.

## Retries and recovery

- The hidden `chipin-release-qa:v1` marker (repository + SHA + deployment) is the retry key. Rerunning the same SHA reuses its Issue, checkboxes and comments; a conflicting deployment ID or URL for the same SHA stops the run.
- Preparations run one at a time. When no Issue is visible, creation is blocked while an earlier same-SHA run succeeded or is still running (a zero-input run counts as same-SHA while running or when it was dispatched on that SHA as `master` head). A failed, cancelled or timed-out run without an Issue can simply be run again.
- A failed Slack handoff needs only a same-SHA rerun after fixing the webhook or map. A rerun also runs the browser matrix again and comments its result in the reused Issue.
- To stop handoffs, disable **Prepare frontend release QA** or remove the write-token secret. Existing QA Issues, CI and Vercel are untouched.
