# Chat-driven native milestone creation

This repository supports a local `[create-milestone]` Issue control command.
The workflow uses the shared policy at
[ChipIn-one/.github#51](https://github.com/ChipIn-one/.github/issues/51)
via a SHA-pinned action and **only this repository's** `GITHUB_TOKEN`.

After the control workflow reaches the default branch (`main`), use
ChatGPT's connected GitHub `create_issue` action in **`ChipIn-one/chipin-frontend`**:

```text
Issue title: [create-milestone] PRODUCT 1.2
Issue body:
Description: Product release 1.2 work in this repository
Due date: 2026-11-01
```

In the actual Issue, the body contains just the `Description:` and
optional `Due date:` lines. Description is mandatory (1–1000 characters),
date is optional strict UTC `YYYY-MM-DD`. Plain data only, no executable
commands or extra keys. The Issue author must have write/maintain/admin
access. Normal Issues are ignored.

Workflow reads all existing milestones (open and closed), and returns the
URL/number/state of the sole match. If absent, it creates and re-reads a
new milestone. It never opens a closed one or mutates pre-existing due
dates or Issue assignments. A single bot receipt is updated on retries;
on success control Issue closes as completed, on errors it stays open.

To retry an open control Issue, edit it or manually dispatch Create
milestone with its Issue number. To attach a future issue, pass the
returned milestone `number` in the GitHub `create_issue` request's
`milestone` field. Do not assume that milestone numbers are the same
across repositories; identical product release names are a convention.

Live acceptance for `ChipIn-one/chipin-frontend#380`: after human merge, create
a harmless uniquely named canary with no due date, verify a single bot
receipt and Issue closure, then request that title again and verify the
same milestone number. Do not use `POST RELEASE 1.1` as a canary, and
do not modify older releases, Project memberships or assignments.
