# Frontend PR metadata (#381)

Contract: https://github.com/ChipIn-one/.github/blob/feat/issue-381-pr-metadata/automation/pr-metadata.md

FE-only caller invokes pinned shared action, which reuses GitHubClient and native Development link read-back. New `scripts/create-pr.mjs` PRs receive one explicit Task identity and concise metadata headings; human authors must replace the prompts with actual verified evidence. Existing PRs are preserved.

Triggers: opened/edited/reopened/synchronize/ready_for_review and completed Frontend CI / Main CI workflow_run (including failures for diagnostics) (once workflow is present on the default branch), plus manual workflow_dispatch retry with exact SHA. No PR code checkout and no paid reviewer on every event. Reviewer requests require all live target-branch required checks (frontend-ci on dev, main-ci on main) green for the exact current head/base SHA, with trusted GitHub Actions workflow-run provenance; human review and merges remain required.

Full live acceptance needs approved FE secret `CHIPIN_PR_METADATA_TOKEN` with organization Project #5 read/write and PR/Issues write. The dedicated scoped token is mandatory: no automatic fallback to GITHUB_TOKEN. Verify Project #5 read/write with a real nonsecret live read-back; do not disclose token contents. Missing owner/reviewer config is intentionally a blocker, not license to guess. No Issue closure, Project Status, or backend rollout.

Org #53 is a prerequisite for task admission and final #381 acceptance. One canonical issue-intake.mjs writer and fresh versioned INTAKE_COMPLETE read-back are required before execution/publication; this caller is not a second metadata writer. The existing #381 bootstrap PR does not certify a new admitted Issue. Missing release owner and independent reviewer approvals remain blocked; Issue owner is not implicitly the reviewer. No review/retry storms; human requests and manual metadata are preserved.
