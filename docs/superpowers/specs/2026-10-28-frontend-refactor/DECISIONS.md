# ChipIn Frontend refactor — owner decisions (2026-10-28)

Context: audit reports in ../0{0..5}-*.md. Owner = Mihail (Russian-speaking, prefers short numbered answers).
Primary goal: predictability for AI agents (Claude/Codex write most code). Secondary: reliability.
Mode: incremental, no feature freeze, small PRs, product keeps releasing.

## Decisions (final)
D1. Critical fixes go in a separate hotfix PR BEFORE the refactor: invite path traversal (encode segments, validate token format, confirmation screen before join), invite token Sentry leak, money rounding dedupe (use existing roundHalfUp), zero-balance sign bug, PublicLocaleRoute stuck spinner. OAuth PKCE/state = backend issue.
D2. Offline PWA is required: read cached data offline + create/edit/delete expenses offline via an outbox queue replayed in order on reconnect. Phase 1: expenses CRUD. Phase 2: groups/members. Settle-up/payments NEVER offline. Dexie removed; persistence = IndexedDB via TanStack Query persister (idb-keyval or similar).
D3. Server state = TanStack Query (persistQueryClient, networkMode offlineFirst, paused mutations, resumePausedMutations). Zustand stays only for UI state (modals, drafts, ui prefs). Migrate store by store.
D4. API types generated from backend OpenAPI (openapi-typescript + openapi-fetch or thin typed wrapper over axios — writer decides, justify). Contract check in CI. zod only at boundaries where data can be stale-format (IndexedDB cache, outbox, localStorage).
D5. Conflicts: optimistic locking — entities carry `version` (or updatedAt), client sends seen version, server returns 409 with current; client shows conflict UI (keep mine / take theirs). Create: client-generated UUID, idempotent. Delete of already-deleted = success. → backend issues required.
D6. App routing: React Router 7 data router (route objects, loaders prefetching TanStack queries, actions optional, per-route errorElement, one route manifest from which vercel.json rewrites + SW allowlist are generated and tested).
D7. Monorepo with npm workspaces (no Turborepo yet): apps/app (current src/), apps/site (Astro), packages/tokens (CSS variables, fonts, logo; realizes DS v1 spec tokens), packages/i18n-content (locale list + shared `common` namespace). React version pinned at root.
D8. Public/SEO site = Astro (static, built-in i18n routing /ru/about etc., content collections in md/MDX, hreflang+sitemap, React islands only when needed, uses tokens CSS, no Radix Themes, no service worker). Hosting: same domain, Vercel rewrites: `/`, `/<locale>/*`, `/help/*`, `/blog/*` → site; `/app/*`, `/auth/*` → SPA; 301 redirects for old URLs; invite landing `/join/<token>` on site with explicit button into app. SW registered only under /app/. Removes PublicApp.tsx, public-routes/, PublicLocaleRoute, prerender-public.mjs, verify-public-precache, duplicate theme/lang/Toaster setup. Answers FE#498 ADR.
D9. Single rulebook: AGENTS.md shrinks to ~10–15 invariants + links; docs/codex/rules is the only full rulebook; .ai/context.md and duplicate copies deleted; every rule either has a lint/CI check or is deleted; stale facts fixed (Vite 8, version 1.0.x, no @codex review, no docs/specs).
D10. Money: wire values are strings (decimal); one module `money/` (parse, roundHalfUp per currency minor units, format, sum in integer minor units); lint forbids Number()/parseFloat on money outside the module. Resolves 60-money vs AGENTS.md conflict.
D11. Named exports everywhere (lint import/no-default-export, exceptions: route lazy modules if needed, config files); Props type declared in the component file; one barrel per feature max, no nested barrels; no React.FC; no handle* naming rule stays if lintable else dropped.
D12. Zustand reads: single pattern = selector with useShallow; useConnect hooks removed.
D13. Formatting/strictness: Prettier installed + lint-staged + pre-commit hook; eslint --max-warnings 0 in CI; type-aware ESLint (no-floating-promises, no-misused-promises), jsx-a11y, import boundaries rule (eslint-plugin-boundaries or no-restricted-imports) enforcing layer direction, import-sort groups include all aliases; TS: noUncheckedIndexedAccess staged, verbatimModuleSyntax unified, typecheck covers ds-gallery and vite configs.
  Amended 2026-10-28 (owner review, PR #542): every lint/format rule is either auto-fixable or a correctness/boundary rule with a fix hint; non-autofixable style rules are dropped (handle* naming, React.FC ban, nested ternary, no-multi-comp, file naming); jsx-a11y = 6 correctness rules; pre-commit only fixes and never blocks; CI is the only blocker (spec 02 §Д0).
D14. Styling: Radix Themes + CSS variables as token source (packages/tokens); styled-themes.ts replaced by var(--…); single theme-switching mechanism for light/dark/system (Radix appearance + html class; next-themes removed); <Theme> configured once; styled-components shrunk gradually to CSS Modules as files are touched (no big-bang); no Tailwind. grayColor olive vs gray mismatch resolved to one value (writer picks, flag for owner).
D15. Versioning: bump at release only; CI runs version:check; one deploy workflow documented.
D16. Misc approved: remove dexie, dexie-react-hooks, sharp, sharp-ico, workbox-core, workbox-window, @uidotdev/usehooks; stop regenerating PWA icons each build; lazy-load locales; shrink dashboard-onboarding.png; CSP add object-src/base-uri/form-action/frame-ancestors, drop script-src blob:, narrow img-src, drop Google Fonts if unused; Permissions-Policy drop camera/geolocation; .env* in .gitignore; rotate local Sentry token (owner action); clear role from localStorage on logout; vendor-react chunk regex fix.

## Open (owner must confirm; writers mark as ASSUMPTION)
- Does Ktor normalize `..` in paths (affects hotfix severity, not the fix).
- /auth/test-register disabled on prod?
- Vercel Speed Insights/Analytics still wanted?
- Exact minimum-client-version policy (backend enforced?) — writer proposes default.

## Writing rules for spec authors
- Markdown, Russian for prose, English identifiers/paths. Headings: Цель, Контекст (ссылки на аудит path:line), Решение, Детали, Ньюансы и подводные камни, Расширение в будущем, Что НЕ делаем, Фазы/PR (каждый PR ≤ ~400 строк диффа, независимо релизится), Тесты/критерии приёмки, Требования к backend (если есть), Открытые вопросы.
- No placeholders/TBD. Each requirement unambiguous. Reference concrete files from audits.
- Cross-spec dependencies stated explicitly by spec number.

## Added 2026-10-28 (after DS discussion)
D17. Design system: DS v1 spec decisions stand (code is source of truth, tokens.json DTCG 2025.10 → generated tokens.css in packages/tokens; grass/olive/lucide; no Figma now, FE#458 stays follow-up). Mockups: Pencil (.pen) locally for fast owner review before screen changes; mockups are disposable, never a token source. Later Figma migration = tokens via DTCG import, components redrawn from ds-gallery.

## Added 2026-10-28 (owner answers to confirmation items)
D18. Vercel Analytics/Speed Insights stay for now. Owner intends to leave Vercel as provider later (cost/limits): separate research task (hosting + analytics replacement). Specs must not deepen Vercel lock-in beyond rewrites/headers config; keep hosting-specific bits isolated (vercel.json only, no Vercel-only APIs in app code).
D19. Min client version policy: to be discussed; check whether backend already has API versioning (pending Explore result).
D20. Confirmation screen for friend invites: yes. Outbox limits 50/14d: yes. Show "your share" on pending expense with explicit caption: yes. Catch-all rewrite + /join/group|friend: yes.
D21. Money unification: backend is source of truth and uses JSON numbers scale 4; NO backend issue to switch wire to strings. Frontend converts number→bigint scale 4 at the API boundary (generated types + wrapper), domain type Money{minor: bigint scale4, currency}, never arithmetic on float. D10 "wire strings" is withdrawn.
D22. Subdomains for site project only if Vercel Hobby allows custom domains for free (it does); otherwise use *.vercel.app internal hostnames.
D23. Colors: everything through Radix palette, no raw hex anywhere incl. PWA theme-color and manifest; generator emits manifest/theme-color from tokens.json (grass-9); styled gray→olive mapping so main colors never differ between styled, Radix and site.
D24. async/await ban lifted (2026-10-28); style free, no-floating-promises/no-misused-promises are the guard.
D25. C3-01 = (b): accept one-time offline loss for pre-cutover installs; SW scope /app/ + kill-switch; owner 2026-10-28.
