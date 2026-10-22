# Frontend production-completion live canary

This is a non-product, documentation-only E2E probe for the frontend release
completion lifecycle. Canonical tasks: [Issue #385](https://github.com/ChipIn-one/chipin-frontend/issues/385)
(original canary) and [Issue #497](https://github.com/ChipIn-one/chipin-frontend/issues/497)
(canonical `master`, completion strategy `deployment-receipt`).

## Purpose

A fresh Issue must remain open while its native Development-linked implementation
PR is merged into `master`. The merge alone must not close it: GitHub's
"Auto-close issues with merged linked pull requests" is disabled for this
repository. The `deployment-receipt` completion caller and its `.github` sweep
fallback are the only allowed source of the `closed/completed` transition, and
only after the merge commit is contained in a Vercel production deployment.

FE completion is manual (registry `capabilities.completion: manual`) until
ChipIn-one/.github#217, which adds the `deployment-receipt` caller
(`Completion` workflow) to this repository. Until then no Issue closes
automatically on `master`, FE Issues are still never closed by hand, and this
canary cannot run.

## Release flow

1. A PR merges into `master` (squash).
2. The Vercel Git integration builds that `master` commit as a Preview with
   development environment variables; `dev.chipin.one` is attached to
   `master`. The Vercel Production Branch points to a non-existent branch, so
   nothing reaches production by itself.
3. The owner opens the chosen commit's deployment and runs **Promote to
   Production**; Vercel rebuilds that commit with production environment
   variables and assigns `chipin.one`. Vercel is expected to record that
   production deployment as a GitHub Deployment,
   environment `Production`, creator `vercel[bot]`, with the exact commit SHA
   and a `success` status. This is verified at cutover step 7 of #497.
4. The completion engine treats that Deployment as the production receipt and
   closes every Issue whose linked PR merge commits it contains.

There is no repository deploy workflow and no release PR.

## Issue lifecycle after the merge to `master`

- After the last implementation PR merges into `master`, the Issue stays open.
- The `Completion` workflow runs on the push to `master` and sets Project #5
  Status `Awaiting release`; the `.github` sweep (every 15 minutes) does the
  same if the event was missed. The Status is display only and never closes an
  Issue.
- Never close the Issue by hand after the merge. A manual close followed by a
  reopen counts as a scope change for `deployment-receipt`, so the Issue then
  stays open until a fresh linked PR merges or a human closes it.
- When the owner promotes a `master` deployment that contains the merge, the
  `Completion` workflow (on `deployment_status`) closes the Issue as completed.
- Issues without implementation evidence (decisions, research, gates) are closed
  by hand as before.
- Contract: [`docs/workflow/completion.md`](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/completion.md)
  (`deployment-receipt`).

## Controlled sequence

1. Open one Issue-backed docs-only implementation PR against `master`; let the
   `Native Development link` workflow associate it with the Issue.
2. Confirm required `frontend-ci` succeeds and request independent review for
   the exact implementation head SHA. A human merges it into `master`.
3. Verify the Issue is still `open` and Project #5 shows `Awaiting release`.
4. Confirm Vercel built the merge commit and that no GitHub Deployment
   `Production` with status `success` exists for it yet.
5. The owner runs **Promote to Production** on that deployment in Vercel.
6. Inspect the `Completion` run started by the `deployment_status` event. Its
   `Production evidence:` line must name the promoted Deployment and SHA, and
   the receipt must identify this canary as `closed-completed`.
7. Confirm the Issue closing event actor is the completion token's account, its
   reason is `completed`, and its timestamp follows the promotion.
8. Verify ChipIn Development Project #5 mirrors the completed Issue as `Done`.

## Constraints

- Never use historical Issues for canary closure or reopen them.
- No automated merges, backend changes, product behavior changes, or new PATs.
- A merge to `master` is not evidence of a production deployment; only the
  promoted Vercel Deployment is.
- If Vercel writes a `Production` `success` status for a `master` Preview
  build (before Promote to Production), the evidence is invalid: stop the
  canary and keep the engine off for the frontend until a corrected evidence
  source is agreed (#497, cutover step 7).
- If another open eligible Issue would also be completed by the promotion, the
  receipt count is not an isolated canary; investigate rather than altering
  unrelated Issues.
