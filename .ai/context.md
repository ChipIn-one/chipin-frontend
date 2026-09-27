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
- After trusted publication, required `frontend-ci` must be green on the current PR head; then post exactly one `@codex review` for that head. Automatic Codex review is disabled. A changed head repeats green CI plus one fresh review request. Sol 5.6 High is escalation/fallback.
- Only a human merges.
- Review-critical repository instructions live in `AGENTS.md`; do not assume `.ai/context.md` or linked documentation is automatically loaded by managed GitHub review.
- The read-only KB dependency is `ChipIn-one/chipin-knowledge-base@main`; resolve canonical files from a sibling checkout or authenticated GitHub/web access and never duplicate them locally.
- Backend contracts are unchanged unless explicitly requested.
- Preserve ChipIn money, offline, persistence, concurrency, API/data-shape, accessibility, and i18n invariants.
