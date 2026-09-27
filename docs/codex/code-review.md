# Code review

## Canonical lifecycle

Generic reviewer roles and lifecycle semantics belong to the canonical
`syllik/ai-workflow`. ChipIn follows that workflow:

- Luna is executor-only and does not review her own task diff.
- After `IMPLEMENTATION_COMPLETE`, trusted Sol/human publication happens before review.
- Routine independent PR review uses managed Codex GitHub Code Review.
- Automatic Codex review is disabled.
- After publication, wait for required `frontend-ci` to be green on the current PR head, then post exactly one `@codex review` for that head.
- Never request Codex review while required CI is pending or failing, and do not post duplicate review requests for the same head.
- A review is current only when its reviewed commit SHA matches the current PR head.
- Any correction that changes the PR head invalidates the previous review and requires the same green-CI gate followed by one fresh `@codex review`.
- Reviewer findings remain separate from Luna execution state and return to Luna only after explicit human authorization.
- Sol 5.6 High is escalation/fallback only for architecture or high-risk review, ambiguous or disputed findings, Codex unavailability, or an explicit human request.
- Only a human merges.

Luna does not perform independent review batches, judge merge readiness, commit,
push, create or update PRs, merge, or enable auto-merge. Do not reintroduce
Luna self-review in any form.

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
