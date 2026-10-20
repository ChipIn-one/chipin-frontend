# Frontend PR metadata (#381)

Contract: https://github.com/ChipIn-one/.github/blob/master/automation/pr-metadata.md

FE-only caller invokes pinned shared action, which reuses GitHubClient and native Development link read-back. New `scripts/create-pr.mjs` PRs receive one explicit Task identity and concise metadata headings; human authors must replace the prompts with actual verified evidence. Existing PRs are preserved.

Triggers: opened/edited/reopened/synchronize/ready_for_review and completed Frontend CI / Main CI workflow_run (including failures for diagnostics) (once workflow is present on the default branch), plus manual workflow_dispatch retry with exact SHA. No PR code checkout and no paid reviewer on every event. Reviewer requests require all live target-branch required checks (frontend-ci on dev, main-ci on main) green for the exact current head/base SHA, with trusted GitHub Actions workflow-run provenance; human review and merges remain required.

FE uses only the local scoped GITHUB_TOKEN for PR/Issue metadata and CHIPIN_DEV_READ_TOKEN for canonical Issue read-only admission. Org Project #5 writes are performed exclusively in .github by a scheduled/manual trusted writer using the existing .github CHIPIN_ISSUE_WRITE_TOKEN. FE never receives that credential. The org writer rereads exact PR SHA, Task identity, native Development links, and fresh per-Issue admission before idempotent Project write/read-back. No Issue closure, Project Status, or backend rollout.

Org #53 is merged and published to FE dev/main; this adapter calls its canonical reader with fresh versioned INTAKE_COMPLETE receipt before any native Development writes. The release owner is syllik. With one maintainer, no native self-review request is made; exact-head CI, scoped independent code review and human-only merges remain required. Org #54 must merge before FE is re-pinned to the final published SHA. Project membership is only confirmed by org read-back. Existing #381 requires canonical Issue admission; no historical bypass.
