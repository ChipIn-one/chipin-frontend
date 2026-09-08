# ChipIn frontend repository context

- Repository: `ChipIn-one/chipin-frontend`
- Purpose: ChipIn frontend Vite/React/TypeScript PWA.
- Repository-specific engineering invariants live in `AGENTS.md` and relevant `docs/codex/rules/*`.
- Generic AI lifecycle, publication, and reviewer semantics belong to canonical `syllik/ai-workflow`.
- Integration branch: `dev`; production branch: `main`; task branches: `luna/<task-slug>`.
- Canonical local completion gate: `npm run verify:full`.
- Remote `frontend-ci` is authoritative after publication; release flow is `dev → main`.
- Luna is executor-only and stops at `IMPLEMENTATION_COMPLETE` or `BLOCKED`.
- Publication is separate trusted Sol/human-controlled work.
- Routine independent review is managed Codex GitHub Code Review; Sol 5.6 High is escalation/fallback.
- Only a human merges.
- Backend contracts are unchanged unless explicitly requested.
- Preserve ChipIn money, offline, persistence, concurrency, API/data-shape, accessibility, and i18n invariants.
