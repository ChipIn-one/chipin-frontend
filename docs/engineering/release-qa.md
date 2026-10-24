# Frontend release QA

The release owner chooses one concrete Vercel Preview deployment built from `master`. The manual **Prepare frontend release QA** workflow validates that deployment, exact source SHA, current `frontend-ci`, and previous verified Production deployment. It then creates or reuses one canonical QA Issue for `ChipIn-one/chipin-frontend` plus the full candidate SHA. The owner reviews the QA result and decides whether to manually **Promote** that exact deployment in Vercel. QA preparation does not gate CI, merge, or deployment.

## Activate and select a candidate

The workflow must run from `master` as release owner `syllik`. Configure these GitHub Actions values before use:

| Name | Kind | Purpose |
| --- | --- | --- |
| `CHIPIN_DEV_READ_TOKEN` | Secret | Read deployments, ruleset, checks, PRs, Issues and the pinned `.github` checkout. |
| `CHIPIN_ISSUE_WRITE_TOKEN` | Secret | Canonical `.github` Issue Intake apply, FE Issue creation and QA assignment. It must read Organization Issue Fields and Issue Types, write the approved frontend Issue, and read/write Project #5. Its absence blocks the handoff before any ready status. |
| `SLACK_WEBHOOK_CI` | Secret | Dedicated Incoming Webhook for `#chipin-ci`. Keep its URL secret. |
| `SLACK_USER_MAP` | Repository variable | JSON map of GitHub login to Slack user ID, for example `{"SoRawSteak":"U0C9X8T4R2Q"}`. |

No token is provisioned by this repository. The owner or an authorized administrator must configure and verify the write token's narrowest working permissions. The workflow uses the canonical Issue Intake implementation pinned to `.github@7dbcfb2b72fca2d477c14f4d242261d72a103dbd`; do not replace it with a local schema writer.

1. After `master` Preview and its required `frontend-ci` complete, open the Vercel deployment and copy its full source SHA and the matching **GitHub Preview Deployment ID**. The workflow input is the GitHub Deployment ID, not a URL or mutable branch alias.
2. Dispatch **Prepare frontend release QA** on `master` with that full 40-character SHA, deployment ID, and explicit canonical Priority `P0`–`P3`. The QA login defaults to `SoRawSteak`. An owner changing the current QA on an existing Issue sets `reassign_qa=true` and provides the new assignable login; the Slack map must contain it.
3. Read the workflow result. A ready handoff requires a trusted `vercel[bot]` Preview success for that SHA, an immutable public build URL, candidate ancestry in current `master`, every active required check successful at the exact SHA from its required producer, a successful `frontend-ci` push run on `master`, and a verified previous Production SHA. The Preview host must be `chipin-frontend-<id>-sylliks-projects.vercel.app`, where `<id>` is one alphanumeric deployment slug. A `git-` branch alias, the `master` alias, `dev.chipin.one`, and the bare project host are rejected. Production evidence may still use `https://chipin.one`. Missing or inconsistent GitHub/Vercel evidence blocks the handoff for operator investigation. A Preview that requires Vercel login is not public and cannot be handed to QA.
4. The included-work checklist uses the verified Production-to-candidate compare, merged PR evidence, one native closing Issue per PR, and explicit Issue lines of the form `- [ ] QA: <step> => <expected result>` or `- [ ] When <action>, then <expected result>`. Unlinked commits and ambiguous links block even a docs-only candidate. User-facing work without explicit steps and outcomes also blocks; clarify the canonical Issue/PR record and dispatch again. A fully linked docs-only compare records `NO_MANUAL_QA_REQUIRED` with file and Issue/PR evidence in the run output and creates no QA Issue or false PASS. That path needs read access but no Issue-write token or Slack configuration.
5. For work requiring manual QA, confirm the resulting Issue has Type `Task`, the selected Priority, Project #5 Status, `syllik` and one QA assignee. The workflow reads back canonical admission and assignment before posting the `#chipin-ci` handoff with the mapped Slack mention. Slack failure is reported in the run output; the admitted Issue remains intact, and rerunning the same SHA can retry the handoff.

The QA Issue pins the full SHA, GitHub Deployment ID, immutable Preview URL, previous Production SHA, included Issue/PR links and checklist. Its hidden `chipin-release-qa:v1` repository/SHA marker is the retry key. A retry of the same SHA keeps the body, checkboxes, comments, defects and time entries; a different SHA creates a separate Issue. If a same-SHA Issue has conflicting deployment ID or URL, stop and resolve the identity with the owner. A visible matching Issue is reused. If no Issue is readable, creation blocks when an earlier same-SHA preparation succeeded, is still queued or in progress, or the run record explicitly shows that Issue creation started. A prior run that finished as failure, cancelled, or timed out without a visible Issue can be dispatched again. There is no separate checkpoint artifact. Check the canonical Issue and prior run before manual recovery of an ambiguous create.

The maintained impact rule in `scripts/release-qa/impact-rules.mjs` adds one adjacent check per included Issue when its PR changes `src/store/authStore.ts`, `src/helpers/authSession.ts`, or `src/features/routing/ProtectedRoute.tsx`. Its source is [AUTH-041 at the pinned knowledge-base commit](https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md): log out, then reload a protected page in the same browser; no logged-out browser session should be restored. It does not assert immediate access-token revocation. Other paths add no impact check. The source Issue still needs explicit primary acceptance steps; the impact rule cannot fill a missing primary checklist.

## Tester result and defects

The currently assigned QA checks the relevant steps and posts **one new, unedited** result comment in the QA Issue. Use this exact format, replacing values:

```text
QA RESULT: PASS
SHA: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
TOTAL TIME: 45m
```

Use `FAIL` or `BLOCKED` in place of `PASS` as appropriate. `TOTAL TIME` is one approximate total in whole minutes. The result workflow reads the current Issue and comment again, then checks the full SHA, human author, sole current QA assignment, comment identity and original timestamp. Checkboxes, owner comments, edited comments, bot comments, Slack messages and results for an old SHA are not acceptance. Editing or deleting a result triggers a new workflow run reporting invalidation, including edits that remove `QA RESULT:`. An old green validation run is historical evidence only: the owner reads the **current comment and latest validation run** before deciding. A revised result must be a new unedited comment. The workflow only reports validation; the Issue comment remains the result authority and the owner makes the release decision.

When a defect appears, create a separate **canonical Bug Issue** through the normal Issue Intake path. Record reproduction steps, expected and actual behavior, Preview SHA/URL and a link back to the originating QA Issue. Add the Bug link to the QA Issue's defect list. After a correction, use the corrected deployment's new full SHA and its own QA Issue; retest the fixed flow and adjacent risks justified by the Bug. Do not carry a prior PASS across SHAs. The owner reviews the final Issue result and manually chooses whether to Promote the tested Vercel deployment. Existing implementation-Issue production completion still waits for the Production deployment receipt.

## Disable or recover

To stop new handoffs, disable **Prepare frontend release QA** in GitHub Actions or remove its required write-token secret. This does not alter existing QA Issues, CI or Vercel. Restore the workflow and all required configuration before another owner dispatch. A failed Slack delivery needs only a same-SHA retry after repairing the webhook or map; it never justifies resetting or duplicating the QA Issue. A pre-create failure, cancellation, or timeout with no visible QA Issue is dispatched again for the same SHA. An ambiguous create outcome (a prior success, a still-running preparation, or an explicit create-started signal with no readable Issue), duplicate marker, conflicting deployment, unavailable canonical intake read-back, or missing permissions requires human reconciliation before retry. The historical release-PR flow, `qa-approved` label, QA Check and production notification work in #484 are outside this procedure.
