# Frontend PR metadata

Contract (Task identity, routes, labels, owner and reviewer rules): [org `automation/pr-metadata.md`](https://github.com/ChipIn-one/.github/blob/master/automation/pr-metadata.md). Roles and gates: [org `docs/workflow/FLOW.md`](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/FLOW.md). This page lists only what is specific to the frontend.

- **Caller:** [`.github/workflows/pr-metadata.yml`](../../.github/workflows/pr-metadata.yml) calls the shared `pr-metadata-action`, pinned to an exact commit. It does not check out PR code.
- **Triggers:** `pull_request` to `master` (opened, reopened, edited, synchronize, ready_for_review; Dependabot PRs are filtered out), completed `Frontend CI` `workflow_run` for same-repo PRs, and manual `workflow_dispatch` with the PR number and exact head SHA.
- **Credentials held by the frontend:** the job's scoped `GITHUB_TOKEN` for PR/Issue metadata and `CHIPIN_DEV_READ_TOKEN` for read-only canonical admission. The frontend never holds an org Project or Issue write credential.
- **PR bodies:** `npm run pr:create` ([`scripts/create-pr.mjs`](../../scripts/create-pr.mjs)) writes one `Task identity:` line and the `## Summary`, `## Tests`, `## Version impact`, `## Dependencies` headings; replace the prompts with verified evidence.
- **Review and merge:** the reconciler never approves or merges; independent review and human-only merges remain required.
