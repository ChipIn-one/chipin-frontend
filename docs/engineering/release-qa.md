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
3. Read the workflow result. A ready handoff requires a trusted `vercel[bot]` Preview success for that SHA, an immutable public build URL, candidate ancestry in current `master`, successful exact-SHA required `frontend-ci`, and a verified previous Production SHA. Missing or inconsistent GitHub/Vercel evidence blocks the handoff for operator investigation. A Preview that requires Vercel login is not public and cannot be handed to QA.
4. The included-work checklist uses the verified Production-to-candidate compare, merged PR evidence, one native closing Issue per PR, and explicit Issue lines of the form `- [ ] QA: <step> => <expected result>`. Unlinked commits, ambiguous links and user-facing work without explicit QA steps block preparation; clarify the canonical Issue/PR record and dispatch again. A proven docs-only compare records `NO_MANUAL_QA_REQUIRED` in the run output and creates no QA Issue or false PASS.
5. For work requiring manual QA, confirm the resulting Issue has Type `Task`, the selected Priority, Project #5 Status, `syllik` and one QA assignee. The workflow reads back canonical admission and assignment before posting the `#chipin-ci` handoff with the mapped Slack mention. Slack failure is reported in the run output; the admitted Issue remains intact, and rerunning the same SHA can retry the handoff.

The QA Issue pins the full SHA, GitHub Deployment ID, immutable Preview URL, previous Production SHA, included Issue/PR links and checklist. Its hidden `chipin-release-qa:v1` repository/SHA marker is the retry key. A retry of the same SHA keeps the body, checkboxes, comments, defects and time entries; a different SHA creates a separate Issue. If a same-SHA Issue has conflicting deployment ID or URL, stop and resolve the identity with the owner. If an earlier same-SHA workflow run may have created an Issue but no matching Issue is readable, creation blocks as ambiguous rather than risking a duplicate. Check the canonical Issue and prior run before manual recovery.

## Tester result and defects

The currently assigned QA checks the relevant steps and posts **one new, unedited** result comment in the QA Issue. Use this exact format, replacing values:

```text
QA RESULT: PASS
SHA: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
TOTAL TIME: 45m
```

Use `FAIL` or `BLOCKED` in place of `PASS` as appropriate. `TOTAL TIME` is one approximate total in whole minutes. The result workflow reads the current Issue and comment again, then checks the full SHA, human author, sole current QA assignment, comment identity and original timestamp. Checkboxes, owner comments, edited comments, bot comments, Slack messages and results for an old SHA are not acceptance. The workflow only reports validation; the Issue comment remains the result authority and the owner makes the release decision.

When a defect appears, create a separate **canonical Bug Issue** through the normal Issue Intake path. Record reproduction steps, expected and actual behavior, Preview SHA/URL and a link back to the originating QA Issue. Add the Bug link to the QA Issue's defect list. After a correction, use the corrected deployment's new full SHA and its own QA Issue; retest the fixed flow and adjacent risks justified by the Bug. Do not carry a prior PASS across SHAs. The owner reviews the final Issue result and manually chooses whether to Promote the tested Vercel deployment. Existing implementation-Issue production completion still waits for the Production deployment receipt.

## Disable or recover

To stop new handoffs, disable **Prepare frontend release QA** in GitHub Actions or remove its required write-token secret. This does not alter existing QA Issues, CI or Vercel. Restore the workflow and all required configuration before another owner dispatch. A failed Slack delivery needs only a same-SHA retry after repairing the webhook or map; it never justifies resetting or duplicating the QA Issue. An ambiguous create outcome, duplicate marker, conflicting deployment, unavailable canonical intake read-back, or missing permissions requires human reconciliation before retry. The historical release-PR flow, `qa-approved` label, QA Check and production notification work in #484 are outside this procedure.
