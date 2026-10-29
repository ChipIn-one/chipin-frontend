# Frontend production-completion live canary

This is a non-product, documentation-only E2E probe for the frontend release
completion lifecycle. Canonical tasks: [Issue #385](https://github.com/ChipIn-one/chipin-frontend/issues/385)
(original canary) and [Issue #497](https://github.com/ChipIn-one/chipin-frontend/issues/497)
(canonical `master`, completion strategy `deployment-receipt`).

## Purpose

A fresh Issue must remain open while its native Development-linked implementation
PR is merged into `master`. The merge alone must not close it: GitHub's
"Auto-close issues with merged linked pull requests" is disabled for this
repository. The ChipIn-one/.github org sweep (`frontend-production-completion.yml`,
strategy `deployment-receipt`) is the only allowed source of
the `closed/completed` transition, and only after the merge commit is contained
in a Vercel production deployment.

This repository has no completion caller (owner decision 2026-10-22). The sweep
completes frontend Issues since ChipIn-one/.github#217 set registry
`capabilities.completion: automatic` (released in v1.7.0). FE Issues are never
closed by hand.

## Sweep trigger and latency

- `.github/workflows/forward-production-deployment.yml` (#559) runs on
  `deployment_status`; its job `if:` passes only environment `Production`, state
  `success` and creator `vercel[bot]`. The script
  `scripts/forward-production-deployment.mjs` checks the same again, validates the
  deployment id and SHA from the event file and sends one `repository_dispatch`
  `frontend-production-deployed` (payload `deployment_id`, `sha`) to
  ChipIn-one/.github. The sweep runs trusted `.github` `master` and treats the
  payload only as a hint: it re-reads the Production receipt itself.
- Latency: the sweep starts within minutes of the Promote.
- Fallback: without the secret `CHIPIN_COMPLETION_DISPATCH_TOKEN`, or when the
  POST fails (HTTP or network error), the step writes a `::warning::` and the run
  stays green. The Issue then closes at the next sweep run on a `.github` push to
  `master` or on its schedule, which GitHub throttles (observed every ~5–6 hours,
  ChipIn-one/.github#228), so it can take hours.
- `deployment_status` runs the workflow file of the deployed commit, so a Promote
  of a commit older than this workflow sends nothing (the schedule covers it).
- The secret is a fine-grained PAT: resource owner `ChipIn-one`, repository
  access only `ChipIn-one/.github`, repository permission Contents: Read and
  write (Metadata: Read is added automatically). It is set as an Actions
  repository secret of chipin-frontend.

## Release flow

1. A PR merges into `master` (squash).
2. The Vercel Git integration builds that `master` commit as a Preview with
   development environment variables; `dev.chipin.one` is attached to
   `master`. The Vercel Production Branch stays `main` (a placeholder
   that receives no pushes) and `vercel.json` disables Git deployments for it, so no
   push creates a production build. Preview builds of `master` create only
   GitHub Deployments `Preview`.
3. The owner opens the chosen commit's deployment and runs **Promote to
   Production**; Vercel rebuilds that commit with production environment
   variables and assigns `chipin.one`. Vercel records that production
   deployment as a GitHub Deployment, environment `Production`, creator
   `vercel[bot]`, with the exact commit SHA and a `success` status. Verified at
   cutover step 7 of #497: Deployment `Production` 7254813070 on `e6d2f2e`
   (2026-10-22T14:24:47Z).
4. Within minutes (dispatch from `forward-production-deployment.yml`; otherwise
   the throttled schedule, see above) the org sweep treats that Deployment as the
   production receipt and closes every Issue whose linked PR merge commits it
   contains.

There is no repository deploy workflow and no release PR.

## Issue lifecycle after the merge to `master`

- After the last implementation PR merges into `master`, the Issue stays open.
- The next `.github` org sweep run sets Project #5 Status
  `Awaiting release` (a merge sends no dispatch, so this follows the next
  Promote, `.github` push or throttled schedule run and can take hours). The Status is display only and never closes an Issue.
- Never close the Issue by hand after the merge. A manual close followed by a
  reopen counts as a scope change for `deployment-receipt`, so the Issue then
  stays open until a fresh linked PR merges or a human closes it.
- When the owner promotes a `master` deployment that contains the merge, the
  next sweep run (within minutes, started by the Production dispatch) closes the
  Issue as completed.
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
6. Confirm `Forward Production deployment to completion` ran for the
   Production deployment here and sent the dispatch (no `::warning::`), then
   wait for the `Frontend production completion` run in ChipIn-one/.github
   started by `repository_dispatch`. If the dispatch was missing, wait for the
   next sweep run (`.github` push or throttled schedule). Its
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
