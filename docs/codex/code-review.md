# Code review

## Level 1 — deterministic

During implementation run targeted tests and lint/typecheck where appropriate.
The final gate is:

```bash
npm run verify:full
```

## Level 2 — bounded Luna self-review

Luna performs one findings-first review of the final task diff against base,
including task-owned untracked files, directly affected callers/consumers, and
relevant tests/config. Focus on requirements, correctness, regressions,
state/data flow, races, security, data loss, architecture, and missing
validation. Ignore formatting/style already enforced by tooling.

## Level 3 — risk-triggered deeper same-Luna review

Only high-risk changes receive one additional focused pass over the final diff,
affected subsystem, direct callers/consumers, and relevant tests/config. Risk
triggers include auth/tokens/interceptors, permissions, money/balances,
settlements/rounding, persistence/offline/idempotency, critical shared stores,
races, routing/auth composition, service-worker cache behavior, CI security,
major dependency/security upgrades, or large cross-cutting changes. Heuristics
are 3+ architecture layers, about 15+ production files, or 800+ changed lines.

No reviewer agent, second model, subagent, manual staged ceremony, or merge is
required.
