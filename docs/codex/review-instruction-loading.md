# Codex GitHub review instruction loading

Last verified: 2026-10-03

## Primary-source evidence

OpenAI's Codex Code Review guidance documents repository review rules in applicable
`AGENTS.md` files: root rules are repository-wide and nested rules are appropriate only for
narrower path/service scopes. It also recommends leaving deterministic mechanical checks to CI.

OpenAI's agent-configuration guidance documents hierarchical `AGENTS.md` /
`AGENTS.override.md` discovery for Codex tooling. Neither source establishes that an arbitrary
linked Markdown file or `.ai/context.md` is automatically loaded as managed GitHub Code Review
instruction context.

Primary references:

- https://developers.openai.com/blog/custom-code-review-rules-for-codex
- https://developers.openai.com/docs/agent-configuration/agents-md
- https://developers.openai.com/docs/third-party/github

## Repository decision

- Root `AGENTS.md -> ## Code Review Rules` is the self-contained source for repository-wide,
  review-critical rules.
- No nested `AGENTS.md` is introduced until a path-specific rule materially improves precision.
- `docs/codex/rules/*` remains the detailed engineering rulebook. Links to it are navigation,
  not a loading guarantee for managed review.
- `.ai/context.md` is bootstrap/context for the broader workflow, not a second review prompt.
- `CLAUDE.md -> AGENTS.md` is a tool-compatibility alias, not a competing source of truth.
- Deterministic lint/type/build/style checks remain CI responsibilities.

## Revision evidence rule

Do not assume which revision managed GitHub review used. Every repository evidence record must
name the PR head SHA and the reviewed commit SHA. When the PR head changes, previous review
evidence is stale until required `frontend-ci` is green and one fresh `@codex review` has
reviewed the new head.

## Disposable canary protocol

The canary is a publication-time experiment and must never be merged.

1. Positive control: add a temporary root review rule for a unique marker and require a unique
   finding tag; place the marker in a controlled fixture.
2. Negative control: place a nearby explicitly allowed control that must not be flagged.
3. Context-routing control: if indirect documentation loading is being evaluated, put the
   decisive temporary rule only in a referenced `docs/codex/rules/*` file. Failure to load it
   means review-critical rules must remain self-contained in `AGENTS.md`.
4. Re-review control: push a new head that removes/fixes the positive marker, wait for green
   required `frontend-ci`, request exactly one new `@codex review`, and verify the new review
   is associated with the new head.
5. Record the PR URL, head SHA, CI run URL, review URL, reviewed SHA, relevant finding/thread URL,
   and result. Close the disposable PR without merge and remove all canary-only material.

## Recorded canary evidence

Disposable PR https://github.com/ChipIn-one/chipin-frontend/pull/275 completed the repository
canary and was closed without merge. The consolidated evidence is recorded in
https://github.com/ChipIn-one/chipin-frontend/pull/275#issuecomment-5846212184.

- Head 1: `b65dbc3c560bd593eb09bc13c3a991d91d8dcf55`
  - required Frontend CI:
    https://github.com/ChipIn-one/chipin-frontend/actions/runs/36241048747 — success
  - Codex review:
    https://github.com/ChipIn-one/chipin-frontend/pull/275#pullrequestreview-5325867206
  - reviewed commit: `b65dbc3c56`
  - positive finding:
    https://github.com/ChipIn-one/chipin-frontend/pull/275#discussion_r4111328602 — included
    the required `[CR-234-CANARY]` tag
  - negative token `CHIPIN_REVIEW_CANARY_234_ALLOWED` was not flagged by the canary rule
- Head 2: `4f599b48e3ce9bf8b7498d2b5897f150421bba6a`
  - the positive marker was removed in the only new commit for this iteration
  - required Frontend CI:
    https://github.com/ChipIn-one/chipin-frontend/actions/runs/36241251223 — success
  - fresh Codex review result:
    https://github.com/ChipIn-one/chipin-frontend/pull/275#issuecomment-5846205437
  - reviewed commit: `4f599b48e3`
  - the obsolete positive finding was not repeated

No indirect-document routing control was needed because the permanent architecture does not rely
on linked documentation or `.ai/context.md` being auto-loaded by managed review. No new canary
or review is required to establish this evidence.

Status: permanent architecture and disposable managed-review canary evidence are complete.
