# Create frontend Milestone via ChatGPT and GitHub Issues

This is a **repository-local control command**, not a normal product Issue.
It only manages milestones in `ChipIn-one/chipin-frontend`. It does not
change Issue assignments, release-target metadata, Project #5 membership,
backend, or the knowledge base.

After `.github/workflows/create-milestone.yml` reaches the repository's
**default branch (`main`)**, use the connected GitHub `create_issue` action:

Title: `[create-milestone] FRONTEND 1.2`

Body (plain text, no Markdown fences):

```text
Description: Frontend iteration 1.2
Due date: 2026-11-01
```

`Description:` is mandatory, 1–1000 characters. `Due date:` is optional
and must be valid UTC `YYYY-MM-DD`; it is recorded at 23:59:59Z.
Milestone title after the prefix is 1–100 printable characters. Duplicate
or unknown fields, invalid dates, multiline values and oversized bodies
are rejected. The body is parsed as **data**, never executed or evaluated.

Ordinary issues are ignored. The original request Issue author must have
repository `write`, `maintain` or `admin` access. Manual dispatch does
not bypass author authorization. Only the built-in `GITHUB_TOKEN` is used:
`issues: write`, `contents: read`, with implicit Metadata read. No PAT.

On success the workflow comments the milestone URL, **number** and state,
then closes the control Issue as completed. The same title is looked up
case-insensitively across both **open and closed** milestones. Existing
milestones are never reopened, modified, duplicated, renamed or reassigned.
If an existing milestone is closed it is returned as closed. Conflicting
existing duplicates fail closed for manual reconciliation.

GitHub Actions serializes control requests with `queue: max` (up to 100
pending), preventing concurrent workflow jobs from racing. A competing
milestone writer outside the workflow is not covered by this queue; on
HTTP 422 a second list read returns the winner, if any, or fails closed.

On error the bot creates/updates a single actionable receipt comment and
leaves the Issue open. Correct the Issue and edit it to retry, or use
Actions → Create milestone → Run workflow with its Issue number. A retry
of a completed control Issue is a no-op. Partial-success retries reuse the
already-created milestone instead of creating a second one.

Use the returned milestone **number** later in GitHub `create_issue`'s
`milestone` field or attach existing Issues manually. This command does
not attach issues automatically.

For harmless live acceptance, request a uniquely named test milestone;
read back its URL/number, control Issue `closed/completed` and one bot
receipt; issue the same request again and confirm the number is unchanged.
Never use existing `POST RELEASE 1.1` as a creation canary.
