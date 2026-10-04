# Code review

## Canonical lifecycle

Generic reviewer roles and lifecycle semantics belong to the canonical
`syllik/ai-workflow`. ChipIn follows that workflow:

- Executor is implementation-only and does not review its own task diff.
- After `IMPLEMENTATION_COMPLETE`, Trusted Publisher/human publication happens before review.
- Reviewer is an independent provider-neutral, read-only role selected by capability/risk. The current GitHub implementation is triggered with `@codex review`.
- After publication, wait for required `frontend-ci` to be green on the current PR head, then request exactly one review for that SHA; never request while CI is pending/failing or duplicate a current/running review.
- A review is current only when its reviewed commit SHA matches the current PR head.
- Reviewer findings stay separate from Executor state and return as one consolidated findings package.
- A v2 handoff may pre-authorize 0–2 correction batches, so those authorized batches do not require another approval. Legacy v1/unspecified handoffs require explicit human authorization per batch.
- Any correction that changes the PR head invalidates the previous review and requires the same green-CI gate followed by one fresh independent review.
- Disputed findings, exhausted correction authority, or reviewer unavailability escalate to a human or an independently selected higher-capability reviewer by risk.
- Only a human merges.

Executor does not perform independent review batches, judge merge readiness, commit,
push, create or update PRs, merge, or enable auto-merge. Do not reintroduce
Executor self-review in any form.

## Deterministic verification

During implementation, run targeted tests and lint/typecheck where appropriate.
The full local completion gate is:

```bash
npm run verify:full
```

Remote `frontend-ci` remains the authoritative post-publication integration
gate. Local verification does not replace the remote gate or authorize merge.

## ChipIn review focus

Independent review should prioritize:

- requirements and regressions;
- dependency direction;
- Zustand/store/API ownership;
- auth, tokens, interceptors, and permissions;
- money, balances, settlements, and rounding;
- persistence, offline behavior, idempotency, and reconciliation;
- races, cancellation, and concurrency;
- data loss and stale responses;
- routing and auth composition;
- service worker and PWA behavior;
- CI, security, and dependency upgrades;
- accessibility;
- i18n;
- missing behavioral validation.
