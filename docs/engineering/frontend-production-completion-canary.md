# Frontend production-completion live canary

This is a non-product, documentation-only E2E probe for the frontend release
completion lifecycle. Canonical task: [Issue #385](https://github.com/ChipIn-one/chipin-frontend/issues/385).

## Purpose

A fresh Issue must remain open while its native Development-linked implementation
PR reaches `dev`. A human-only `dev → main` release merge must not auto-close
the Issue from release PR prose. The existing `Frontend production completion`
workflow is the only allowed source of its `closed/completed` transition.

## Controlled sequence

1. Open one Issue-backed docs-only implementation PR against `dev`; let the
   `Native Development link` workflow associate it with the Issue.
2. Confirm required CI succeeds and request independent review for the exact
   implementation head SHA. A human merges it into `dev`.
3. Verify the Issue is still `open`. Create a `dev → main` release PR that
   references the implementation without GitHub closing keywords.
4. Verify required release checks and independent review. A human selects
   **Create a merge commit** (not squash or rebase) to merge the release.
5. Inspect the `Frontend production completion` run for the release merge SHA.
   The receipt must identify this canary and report `Closed as completed: 1`.
6. Confirm the Issue closing event actor is `github-actions[bot]`, its reason is
   `completed`, and its timestamp follows the release merge.
7. Verify ChipIn Development Project #5 mirrors the completed Issue as `Done`.

## Constraints

- Never use historical Issues for canary closure or reopen them.
- No automated merges, backend changes, product behavior changes, or new PATs.
- A merge to `main` is not evidence of a completed Vercel production deployment.
- If another open eligible Issue would also be completed by the release, the
  receipt count is not an isolated canary; investigate rather than altering
  unrelated Issues.
