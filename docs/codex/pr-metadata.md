# Frontend PR metadata (#381)

Contract: https://github.com/ChipIn-one/.github/blob/feat/issue-381-pr-metadata/automation/pr-metadata.md

FE-only caller invokes pinned shared action, which reuses GitHubClient and native Development link read-back. New `scripts/create-pr.mjs` PRs receive one explicit Task identity and concise metadata headings; human authors must replace the prompts with actual verified evidence. Existing PRs are preserved.

Triggers: opened/edited/reopened/synchronize/ready_for_review and successful frontend-ci workflow_run (once workflow is present on the default branch), plus manual workflow_dispatch retry with exact SHA. No PR code checkout and no paid reviewer on every event. Reviewer requests require successful frontend-ci for the same head SHA; human review and merges remain required.

Full live acceptance needs approved FE secret `CHIPIN_PR_METADATA_TOKEN` with organization Project #5 read/write and PR/Issues write. GITHUB_TOKEN may fail org Project permissions. Missing owner/reviewer config is intentionally a blocker, not license to guess. No Issue closure, Project Status, or backend rollout.
