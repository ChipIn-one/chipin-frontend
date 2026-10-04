# ChipIn frontend repository context

- Repository: `ChipIn-one/chipin-frontend`
- Purpose: ChipIn frontend Vite/React/TypeScript PWA.
- Repository-specific engineering invariants live in `AGENTS.md` and relevant `docs/codex/rules/*`.
- Generic AI lifecycle and role semantics belong to canonical `syllik/ai-workflow`; model/provider does not define Planner/Architect/Executor/Reviewer/Auditor authority.
- Integration branch: `dev`; production branch: `main`. Preserve an already assigned/published task branch; new branch naming follows the current canonical registry policy.
- Canonical local completion gate: `npm run verify:full`.
- Remote required `frontend-ci` is authoritative after publication; release flow remains `dev → main`.
- Executor stops at `IMPLEMENTATION_COMPLETE` or `BLOCKED` and never inherits publication/review authority.
- Trusted Publisher handles one final commit + one push per completed revision only when the task contract explicitly permits publication; published history is not rewritten.
- Required `frontend-ci` must be green for the exact current PR head before one independent Reviewer runs for that SHA. A changed head invalidates prior CI/review; Reviewer is read-only and returns one consolidated findings package.
- Task contract v2 may pre-authorize 0–2 correction batches. Legacy v1/unspecified handoffs keep the existing human authorization gate per correction batch. After the limit, escalate to a human.
- Only a human merges.
- Review-critical repository instructions live in `AGENTS.md`; linked documentation is not assumed to be loaded automatically by a reviewer.
- The read-only KB dependency is `ChipIn-one/chipin-knowledge-base@master`; resolve canonical files from a sibling checkout or authenticated GitHub/web access and never duplicate them locally.
- Backend contracts are unchanged unless explicitly requested.
- Preserve ChipIn money, offline, persistence, concurrency, API/data-shape, accessibility, and i18n invariants.
