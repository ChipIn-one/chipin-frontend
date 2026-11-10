# 00 — ChipIn Frontend Refactoring Overview (2026-10-28)

Input documents: `DECISIONS.md` (D1–D31; D10 withdrawn → D21; D25 simplified by D26; D5 superseded by D28; D26 amended by D30; D31 = plan cuts of 2026-11-10), specs `01`–`05` in this folder, audit `../0{0..5}-*.md`, reviews `../review-{A,B,C1,C2,C3}*.md` (Resolution column in C1–C3).
Paths checked against `origin/master` `522973a` (canonical after FE#497). The `src/` code on master matches the audit branch `3d0086e`; the differences are docs/CI only: the rulebook lives in `docs/engineering/rules/`, there are no deploy workflows (Vercel Git + Promote).

## Goal

The main goal is **predictability for AI agents** (Claude/Codex write most of the code): one place for rules, one way for each task (data, money, routing, styles, theme), every rule checked by a machine. The secondary goal is reliability: invite security, money without float, offline PWA.
The mode is **incremental**: no feature freeze, every PR is released independently. PR size is a guideline, not a rule: one PR = one task, reviewable in one pass; ~400 lines of diff as a guideline; mechanical PRs (Prettier, monorepo rename) have no limit — review = rerun the command.

## Identifier scheme

- PR: `<spec>-<n>` — `01-1`, `02-A3`, `02-C7a`, `03-15`, `04-2d`, `05-2a`. "Phase N" in spec 04 = PR `04-N`.
- Backend issue: `BE-<spec>-<n>` — `BE-01-1`, `BE-03-5`, `BE-04-2`; `BE-00-1` — from the open questions in DECISIONS.

## Spec map

**01 — Hotfix (D1, part of D16).** Three PRs before the refactoring: `01-1` the `apiPath` helper (encoding of 14 path segments, ban on `.`/`..`), `isInviteToken`, the `/groups/invite/<token>` sanitizer in Sentry, CSP/Permissions-Policy, `.gitignore .env*`, removing `role` from localStorage on logout; `01-2` a confirmation screen before joining a group/friendship; `01-3` a single `roundHalfUp`, "zero = settled" in 6 places, a fix for the `PublicLocaleRoute` hang. Three backend issues (PKCE, encoded dot-segments, token validation + preview).

**02 — Rulebook and tooling (D9, D11–D13, D15, D16).** `AGENTS.md` = 15 invariants + links; the full rulebook only in `docs/engineering/rules/`; every rule is LINT/CI/REVIEW/DELETE; a lint/format rule either auto-fixes (`fix` on save and in pre-commit), or checks correctness/boundaries with a hint on how to fix it, otherwise it is deleted (02 §D0 "No friction for agents"). A single registry of lint/stylelint rules of all specs (02 §D0, machine copy `rule-classes.json`); baseline — native ESLint suppressions (`eslint-suppressions.json`) with a ratchet by base SHA. Removal of dead dependencies and the vendor-regex (`02-B1`, the sole owner), Prettier, `--max-warnings 0` (levels only error/off), type-aware ESLint (only promise and `any` rules), 6 jsx-a11y rules, boundaries (with `src/app`, `src/entities`, `src/shared` described in advance), husky/lint-staged (pre-commit only `--fix`, does not block; only CI blocks), CI version policy, `tsconfig.base.json`, named exports via `import-x/no-default-export` with suppressions that only shrink (`02-C13`; no codemods, nested barrels go away when touched — D27, D31).

**03 — Data layer and offline (D2–D5, D19, D21, D12).** TanStack Query (offlineFirst, IDB persister by `userId`), an outbox on paused mutations with a separate persist, tab coordination only through `navigator.locks` + a BroadcastChannel ping (D29), 409 conflicts via `version`/`If-Match` with a short message, the fresh version in the cache and the user's changes kept as a draft (D28), the create/update payload on `Money` (03-14b), the `src/shared/money/` module (`Money { minor: bigint }` scale 4, `split` = backend `distributeAmount`; the wire is a JSON number with scale 4 forever; the `api()` wrapper is a lossless transport into an opaque `WireAmount`, conversion to `Money` only in the `entities/*/model` mappers — interpretation of D21, confirmation item 34), types from OpenAPI (axios + `openapi-typescript` + the `api()` wrapper), migration of 11 stores one by one, removal of `useConnect` (the sole owner). Seven backend issues (BE-03-3 withdrawn per D21); BE-03-5 is mandatory before the outbox is enabled (D19).

**04 — Monorepo, routing, site (D6–D8, D18, D22, D26, D30, D31, ADR FE#498).** npm workspaces (`apps/app`, `apps/site`, `packages/tokens`, `packages/i18n-content`), the first PR is a mechanical move (04-0a by script, 04-0b — docs); the version only in the root `package.json`. An RR7 data router from a single manifest with per-route `errorElement` and auth guards, no prefetch loaders (04-2e withdrawn, D31); a hand-written `vercel.json` per project: 04-2b = a host-scoped catch-all rewrite on the app hosts and a test that every router path is covered by the SW navigation allowlist; the hand-written legacy redirect lists with their tests live in 04-4a2 (app project, step 1) and 04-3d (site) (D31); lazy-loading of locales and `setAppLanguage` (the sole owner); a single SW registration `/sw.js` with scope `/` (the sole owner — 04-2d). Hosts per D26: the app on `app.chipin.one` (dev `app-dev.chipin.one`) with Vite `base: '/'`, the site on `chipin.one` (dev `site-dev.chipin.one`); the projects do not proxy each other, each has its own CSP, the `__Host-` refresh cookie is host-only for `app.chipin.one`, users sign in again once. Provider isolation (everything Vercel-specific only in `vercel.json`, `@vercel/*` in one module, D18). The cutover runs in two steps (D30): step 1 — `04-4a1` (SW host gate + host-aware kill-switch `sw-kill.js` in the shared build; the built app worker is `dist/sw-app.js` until 04-5a while the registration URL stays `/sw.js`) and `04-4a2` (the app moves to `app.chipin.one`/`app-dev.chipin.one` on the current Vercel project; `chipin.one` keeps today's landing, whose sign-in CTAs go to the app host; private app paths on the old hosts 302 to the app host), before the Astro site exists; rolling back step 1 = a targeted PR that deletes only the legacy redirects (the `/api` rewrites of the app hosts stay); step 2 — `04-4b` (the former 04-4): an Astro site with static pages, `/join/group|friend/<token>` with a button to the confirmation screen on `app.chipin.one`, a kill-switch `/sw.js` on `chipin.one` for ≥ 6 months, the site release model "Promote only", the site compatibility layer 04-3d, then moving the domains `dev.chipin.one`, then `chipin.one` to the site project; rollback — moving back, which keeps the step-1 redirects in the app project. The step-1 redirects stay 302 and are deleted by 04-5a (with `sw-kill.js` and the `/sw.js` host rewrites); only the site's step-2 redirects (04-3d) switch 302 → 301 in 04-5a. PWAs installed before the move are not supported (D26). The deviation from D8 (invite type in the path) was accepted by the owner (D20); the D20 catch-all rewrite was withdrawn by D26.

**05 — Styles and tokens (D14, D16, D17, D23, D31).** `packages/tokens` (the sole owner; a hand-written `tokens.css`, `theme.ts` with `RADIX_THEME`/`PROP_COLOR`/`RADIX_PALETTES`/`BRAND_COLORS`, favicon/logo and the theme script — no DTCG `tokens.json`, no generator, no `tokens:check`; the PWA manifest, `theme-color`, and the site take the brand color from `BRAND_COLORS`, kept equal to `--cp-brand-primary` = grass-9 by a test; hex/rgb outside `packages/tokens` are banned by lint/stylelint), a single theme switching mechanism (light/dark/system: `appearanceStore` → `<html>` class → `<Theme>`, no FOUC, CSP hash), removal of `next-themes`, `themeColor()` → `var(--cp-*)` (gray → olive) file by file in the design phase (05-4 withdrawn, D31), styled-components frozen by an allowlist + a touch rule, stylelint, the `basics`/`components` boundary, Radix CSS in parts, WebP. ds-gallery stays in `apps/app/ds-gallery/` and receives the tokens as an app.

## Who owns overlapping topics (decided, agreed across all specs)

| Topic | Owner | Others |
|---|---|---|
| Removal of `useConnect` (D12) | 03 (store migration PRs, leftovers 03-18) | 02-C12 — only the ban on new ones (`check-file-layout`) |
| Lazy-loading of locales | 04-2c | 05, 02 reference it |
| Vendor-regex `vendor-react` | 02-B1 | 04 §2.8, 05 §5 reference it |
| Removal of Dexie/`workbox-window` | 02-B1 | 03 §1.1, 04 §2.11 reference it |
| SW registration dedup, `PWABadge`, `pwa.config.ts` | 04-2d | 05-6 does not move it; 03-20 uses the screen from item 4 |
| Money lint rules | 03 §4.3 (03-1 immediately `error` + suppressions; 03-3 and the migrations remove entries) | 02 D4 R1 references it |
| Registry of lint/stylelint rules, suppressions, `check-baseline` ratchet | 02 §D0 / 02-C4 | 03/04/05 add registry rows in the PR that enables the rule |
| Online predicate `isNetworkUsable()` (`onlineManager`) | 03 §1.7 (03-5, `src/shared/offline/network.ts`) | 04 guards only reference it; `navigator.onLine` outside `shared/offline` — lint |
| Color lint/stylelint (`no-raw-colors` = `no-restricted-syntax`, no plugin), the `style` rule | 05-5 | 02 references it |
| ESLint structure, helpers `restrictedSyntax()`/`restrictedImports()` | 02-C4 (sole) | 03-1, 05-5 add their own blocks, do not introduce the helper |
| `packages/tokens` | 05-2a (package), 05-2b (wiring into app) | 04-1a creates only `i18n-content` |
| "Update required" screen | 04-2d (UI, outbox gate `outdated`) | 03-20 (detection of 426/the header) |
| Version format and normalization | 04-0a (`version-resolver.mjs`: prod = `x.y.z`, otherwise `x.y.z-dev-<sha7>`; root from `import.meta.dirname`) | 02 D7 references it; 03-20 compares only the semver core |
| Cutover rollback | 04 §4.5: step 1 (04-4a2) — a targeted PR that deletes only the legacy redirects (the app-host `/api` rewrites stay); step 2 (04-4b) — move the domain `chipin.one` (`dev.chipin.one`) back to the app project, which still holds the step-1 redirects (D30); until 04-5a the app project serves the public pages and compat redirects; there is no freeze window or Promote ban (D26) | DEPLOYMENT.md (section "Domains and rollback", 04-4a2 and 04-4b) |
| Locale parity test | 04-2c | 02 references it |
| ds-gallery | location — 04 §6; typecheck — 02-C5; aliases — 02-C3; tokens/theme — 05-7 | |
| CSP | 01-1 base directives in the hand-written `vercel.json` of each project (D31); 05-3 adds the sha256 of theme-init; each project has its own CSP on its own hosts (04 §3.6, §2.9), projects do not proxy each other (D26) | |
| `.gitignore .env*` | 01-1 | 02-A3 does not repeat it |
| Invite URL | site `chipin.one/join/group/<t>`, `/join/friend/<t>` (04-3c) → button → screen 01-2 at `app.chipin.one/group/join/<t>`, `/friends/join/<t>` | old `chipin.one/group/join/<t>` — redirect to the site landing (302 until 04-5a, then 301) |

## Dependency graph

Hard dependencies (arrow = "cannot merge earlier"):

```
01-1 ──> 01-2 ──────────────┐            01-3 ──> 03-1 ──> 03-2, 03-3 ;  01-1 + 03-1 ──> 03-4a ──> 03-4b
  └─────────────────────────┼──> 04-0a (monorepo move; the owner sets Root Directory) ─> 04-0b
02-A0 ─> 02-A1 ─> 02-A2     │      │
02-C1 ─> 02-C2a-c ─> 02-C3 ─> 02-C4 ──┬─> 02-C8, 02-C9, 02-C10, 02-C12, 02-C13        (02-C4 = suppressions, registry, ratchet)
                                      └─> 02-C6 <─ 02-C5 ; 02-C6 ─> 02-C7a/b, 02-C11
04-0a ─> 04-2a1 ─> 04-2a2 (+03-5) ─> 04-2a2b ─> 04-2a3 ─> 04-2a4 ─> 04-2f
04-2a4 + 04-2d + 04-2f + 04-3c + 04-4a2 (in prod) ─> 04-2g (site-facing app links; step 2 preparation)
04-2a1 ─> 04-2b ; 04-2a2 ─> 04-2d ─> 04-2h ; 04-0a ─> 04-1a ─> 04-2c
04-0a ─> 04-1b ; 04-0a ─> 05-2a ─> 05-2b ─> 05-3 ─> 05-7 ; 05-2b + 02-C4 ─> 05-5
05-2a + 04-1a + 04-1b ─> 04-3a ─> 04-3b1 (+05-3), 04-3b2, 04-3c (+01-2), 04-3d (+04-2a1; site kill-switch and redirects; site Promote to prod before 04-4b)
03-4b ─> 03-5 ─> 03-6, 03-7a ─> 03-7b ; 03-5 ─> 03-8, 03-9 ─> 03-10 ─> 03-11 ─> 03-12 ─> 03-13 ─> 03-14 ─> 03-14b ; 03-14 ─> 03-18
03-7b + 03-14b (+ confirmation item 35) ─> 03-15a ─> 03-15b ─> 03-15c ─> 03-16a ─> 03-16b ─> 03-17 (+ BE-03-1, BE-03-2, BE-03-5, 03-20, 04-4a2 in prod)
03-21 (settle-up precision) ← 03-3, 03-4b
04-4a1 ─> 04-4a2 (+ BE-04-2 + the owner adds app.chipin.one/app-dev.chipin.one; independent of 04-0a and of the site) ─(in prod)─> 03-17   (cutover step 1, D30)
04-2g + 04-2h + 04-3b1 + 04-3b2 + 04-3c + 04-3d (in prod) + 04-4a2 (in prod) ─> 04-4b domain move to the site (cutover step 2) ─(7 days without rollback)─> 04-5a/b
04-2d + BE-03-5 ─> 03-20 ─> 03-17   (03-19 / BE-03-3 withdrawn per D21; 04-2e, 02-D2a–e/02-D3a–e and 05-4 withdrawn per D31)
no hard dependencies (the order is soft, below): 02-A3, 02-B1, 02-B2, 02-C1, 02-C5, 05-1, 05-6, 04-4a1
src/store/expenseModal* (file-lock, one open PR):
  01-3 ─> 02-C2 ─> 03-1 (suppressions only) ─> 03-2 ─> 03-13 ─> 03-14 ─> 03-14b ─> design-phase edits (themeColor migration, default → named when touched)
  02-C3, 02-C6, 02-C7a, 02-C11, 02-C13 — these files are not touched (`--exclude`, violations go to suppressions/tsc-baseline) until 03-14b; 04-0a — in its own window with no open PRs
```

Id aliases after review A: "04-0" in other specs = 04-0a; "04-2a" = the group 04-2a1, 04-2a2, 04-2a2b, 04-2a3, 04-2a4 (completion — 04-2a4). After review C: "03-4" = 03-4a+b, "03-7" = 03-7a+b, "03-15" = 03-15a–c, "03-16" = 03-16a+b, "04-3b" = 04-3b1+b2, "05-2" = 05-2a+b. After D30: "04-4" in older text = 04-4b (cutover step 2), "04-4a" = 04-4a1+a2 (step 1).

Recommended (soft) orders: 02-C2 and 02-C5 before 04-0 (formatting and `tsconfig.base.json` before the rename); 05-1 before 04-0; 03-1…03-4b — before or after 04-0 (money rules immediately `error` + suppressions, CI does not go red); 03-5 and later — after 04-0.

## Cross-edits for specs 01 and 03 (from review A; specs 01/03 are edited by another executor)

1. **03-20 / 03 §7 (A-09):** the prod `APP_VERSION` after 04-0a is a plain `x.y.z`, outside prod — `x.y.z-dev-<sha7>`. The comparison of `X-Min-Client-Version` with `APP_VERSION` and the value of the `X-Client-Version` header — only by the semver core `major.minor.patch` (the suffix after `-` is dropped before comparison). Without this, `MIN_CLIENT_VERSION=1.0.9` would block clients on `1.0.9-dev-…`.
2. **03 §6 / entities (A-12):** in the single layer graph `entities → store` is forbidden (`store → entities` is allowed). The `entities/**` code does not import `store/**`.
3. **03 persister:** spec 04 §2.4 uses `restoreReady` (the persister hydration promise; no prefetch loaders, D31); 03 exports `restoreReady` from `src/shared/offline/restore.ts` (03-7a; before it — the stub from 04-2a2) and the outbox gate with the `outdated` state (04-2d).
4. **01, 03 — site analytics (A-15):** no edits needed; the `/join/*` token is redacted on the site (04 §3.6), the app sanitizer `sanitizeTelemetryEvent` does not change.
5. **Id aliases:** "04-0" = 04-0a; "04-2a" = the group 04-2a1–a4.

From review C (specs 01/03 are edited by another executor; here — what 02/04/05 expect from them):
6. `src/shared/offline/network.ts` (03-5): `isNetworkUsable()` = `onlineManager.isOnline()`; lint for `navigator.onLine` outside `shared/offline/**` (registry row 02 §D0).
7. `src/shared/offline/restore.ts`: the path and the name `restoreReady` do not change; until 03-7a — the stub from 04-2a2.
8. The safe SW update point reads the `sending` status from `outboxState` (03 §2.3) (04 §2.11 item 3, C3-12); 03-13 registers the draft save in `onBeforeAppReload` (04 §2.11 item 4, C3-26).
9. 03-4b: lint "`moneyFromWire`/`moneyToWire` only in `entities/*/model/**`" (registry 02 §D0).
10. 03 acceptance 1: PWAs installed on `chipin.one` before the move are not supported (D26, D30): after step 1 (04-4a1/04-4a2) the shared build's SW on `chipin.one` is the host-gated kill-switch (unregisters itself, clears that origin's caches) and private app paths 302 to `app.chipin.one`, so online such a PWA ends up on the app host in a browser tab (after step 2, the site serves `chipin.one`); offline launch is not guaranteed, no banner; the offline acceptance scenarios are verified on an installation from `app.chipin.one` (04 §2.11).

## Phase plan

An honest estimate of parallelism (C2-14): tracks run in parallel only between freeze windows and only if they do not touch the same files. The critical path of offline is **20 sequential PRs**: 01-3 → 03-1 → 03-4a → 03-4b → 03-5 → 03-7a → 03-7b → 03-9 → 03-10 → 03-11 → 03-12 → 03-13 → 03-14 → 03-14b → 03-15a → 03-15b → 03-15c → 03-16a → 03-16b → 03-17 (plus 03-20, which needs 04-2d; 04-4a2 in prod, which runs in parallel; backend BE-03-1/2/5). At 2–3 merges a week on this chain that is ≈ 7–10 weeks, not counting waiting for the backend. The router chain up to 04-2d: 04-0a → 04-2a1 → 04-2a2 (+03-5) → 04-2d.

**Freeze windows (calendar, recorded in the epic Issue):**
1. 02-C2a–c — one day, no open feature PRs (Prettier across all of `src`).
2. 04-0a — ~1 h for the merge + smoke of `dev.chipin.one`; open PRs rebase.
3. File-lock `src/store/expenseModal*` — one open PR on these files (graph above).
4. ~~Codemods 02-D2/D3~~ — withdrawn by D31: there are no codemods; 02-C13 only adds suppressions.
5. ~~Cutover — merge freeze window from 04-3d to 48 h after the 04-4 Promote~~ — withdrawn by D26: rollback = moving the domain, it does not depend on the app project deploy (04 §4.5).

**Phase 0 — hotfix (week 1).** `01-1` → `01-2`; `01-3` in parallel. In parallel: `02-A0` in ai-workflow, backend issues `BE-01-*`, the owner rotates the Sentry token and checks `/auth/test-register`.

**Phase 1 — rulebook, tooling, dead dependencies, CSS (before the move).**
- rules: `02-A1` (after sign-off of item 36) → `02-A2`, `02-A3`;
- dependencies: `02-B1`, `02-B2`;
- tooling: `02-C1` → `02-C2a–c` (window 1) → `02-C3` → `02-C4`; `02-C5` in parallel;
- styles: `05-1`;
- can be done earlier: `03-1`…`03-4b` (money, OpenAPI types; they do not depend on the move).
`packages/tokens` (05-2a) requires npm workspaces, so it is in phase 2 right after the move; in phase 1 — only 05-1.

**Phase 2 — monorepo.** `04-0a` (window 2, the owner sets Root Directory = `apps/app` at merge time), immediately `04-0b`. Then `04-1a`, `04-1b`, `04-2a1`, `05-2a`.
`04-4a1` has no hard dependency (it works in the current build, before or after 04-0a); it lands any time before `04-4a2`.

**Phase 3 — data layer/offline, data router, cutover step 1, site, remaining tooling.**
- data (critical path): `03-5` → `03-6`/`03-7a`→`03-7b`/`03-8`/`03-9` → `03-10` → `03-11` → `03-12` → `03-13` → `03-14` → `03-14b`;
- cutover step 1 (D30), right after the query chain and before the outbox: `04-4a1` → `04-4a2` (BE-04-2 on dev and prod before the merge; the owner adds `app.chipin.one`/`app-dev.chipin.one` to the current app project; `chipin.one` keeps today's landing, private app paths 302 to the app host; runbook part 1 in `DEPLOYMENT.md`);
- outbox: `03-15a` → `03-15b` → `03-15c` → `03-16a` → `03-16b` → `03-20` → `03-17` (flag after BE-03-1/2/5 and 04-4a2 in prod);
- router (after 03-5): `04-2a2` → `04-2a2b` → `04-2a3` → `04-2a4`; `04-2b`, `04-2c`, `04-2d` → `04-2h`; `04-2f`;
- site: `04-3a` → `04-3b1`, `04-3b2`, `04-3c`, `04-3d` (+04-2a1); then `04-2g` (after 04-2a4, 04-2d, 04-2f, 04-3c and 04-4a2 in prod);
- tooling: `02-C6` → `02-C7a/b`, `02-C11`; `02-C8`, `02-C9`, `02-C10`, `02-C12`, `02-C13`;
- styles: `05-2b` → `05-3`, `05-5`, `05-6`.
The end of the site work — `04-3d` in prod of the site → `04-4b` cutover step 2 (runbook part 2 in `DEPLOYMENT.md`; the owner moves `dev.chipin.one`, then `chipin.one` to the site project; rollback — moving back, the step-1 redirects stay in the app project, 04 §4.5). Step 2 does not gate 03-17 (item 44).

**Phase 4 — retiring styled, cleanup.** `05-7`; the design phase (DS v1 tasks) migrates `themeColor()` → `var(--cp-*)` file by file and removes `styled-themes.ts` with the last caller (D31; each such PR carries its own screenshots); `04-5a/b` (after 7 days without rollback; 04-5a switches the site's step-2 redirects from 302 to 301, deletes the step-1 redirects, `sw-kill.js` and the `/sw.js` host rewrites from the app project, and renames `app.html`); `03-18`; `03-21` — per spec 03; `03-20` — as soon as BE-03-5 is ready (before `03-17`).

## Backend issues (`chipin-backend`; when creating, set Type, Priority, assignee, Project 5)

1. `BE-01-1` (P1) — `OAuth: bind one-time login code to the browser (PKCE S256 or __Host- tx cookie)`
2. `BE-01-2` (P1, as in the created issue #197) — `Security: reject encoded dot-segments and slashes (%2F, %2E%2E, %5C) in path parameters`
3. `BE-01-3` (P1, as in the created issue #198) — `Invites: validate invite token format (INVALID_INVITE_TOKEN) and add GET /groups/invite/{token} preview`
4. `BE-03-1` (P1) — `Ledger: add entry version and optimistic locking (If-Match → 409 LEDGER.VERSION_CONFLICT with current)`
5. `BE-03-2` (P1) — `Ledger: idempotent create with client-generated id (200 same / 409 ID_CONFLICT / 410 ENTRY_DELETED)`
6. ~~`BE-03-3`~~ — withdrawn by D21 (the wire stays a JSON number with scale 4; the number is not reused)
7. `BE-03-4` (P2) — `OpenAPI: unique operationIds, named schemas, 409/410/426 responses, deterministic build artifact`
8. `BE-03-5` (P1, before the outbox 03-17 is enabled) — `Client version gate: new X-Client-Version request header + MIN_CLIENT_VERSION config → 426 CLIENT.OUTDATED, X-Min-Client-Version response header (exposed)`
9. `BE-03-6` (P3) — `Test: DELETE of an already deleted ledger entry returns 204`
10. `BE-03-7` (P2) — `Shared split test vectors (ledger-split-vectors.json) for backend and frontend`
11. `BE-03-8` (P3, offline phase 2) — `Groups: version and 409 on PATCH /groups/{id} and member operations`
12. ~~`BE-04-1`~~ — withdrawn (D26): the example `OAuthOpenApi.kt:30` is already `https://app.chipin.one/oauth/callback`; close chipin-backend#206 as not planned (coordinator action)
13. `BE-04-2` (P1, on dev and prod before 04-4a2 is merged, D30) — `OAuth + CORS: allow https://app.chipin.one (prod) and https://app-dev.chipin.one (dev) in OAUTH_ALLOWED_REDIRECT_ORIGINS and CORS_ALLOWED_ORIGINS; keep chipin.one/dev.chipin.one until 04-5a; app project name unchanged (OAUTH_/CORS_ALLOWED_VERCEL_PREVIEW_PROJECTS)`
14. ~~`BE-04-3`~~ — withdrawn (C3-24): the app header `/api/(.*)` = `no-store` makes `public, max-age=300` useless; close chipin-backend#208 as not planned (coordinator action)
15. `BE-00-1` (P1) — `Verify /auth/test-register is disabled in production`

## Owner confirmations (all ASSUMPTIONs + open questions of DECISIONS)

Format: question — **default recommendation**.

1. Does Ktor normalize `..` (DECISIONS) — **question withdrawn**: the browser normalizes a literal `..` before sending; the fix is on the client (01-1), BE-01-2 is only defense-in-depth.
2. Is `/auth/test-register` disabled on prod? (DECISIONS) — **it must be disabled; verify, BE-00-1**.
3. Are Vercel Speed Insights/Analytics needed? (DECISIONS, 04) — **confirmed by the owner 2026-10-28 (D18): keep; in the app — a single module `vercelAnalytics.ts`, on the site a single script `/_vercel/insights`; Vercel is isolated (04 §1.5a)**.
4. Minimum client version policy (DECISIONS, 03 §7, 04) — **confirmed by the owner 2026-10-28 (D19, option A): for now only a forced SW update after 24 h; before the outbox is enabled — BE-03-5 (new header `X-Client-Version` + `MIN_CLIENT_VERSION` → 426) and 03-20 (header from `APP_VERSION` in the axios interceptor, a blocking screen on 426); `MIN_CLIENT_VERSION` is raised only on an incompatible contract change and after ≥ 72 h of the new FE version in prod; the outbox is not deleted**.
5. The confirmation screen for `/friends/join/:token` too (01) — **yes, confirmed by the owner 2026-10-28 (D20)**.
6. Invite token length `16..64`, not strictly 32 (01) — **yes**.
7. The "zero" threshold in the hotfix is 4 digits; after 03-3 — minor currency units (`0.0040 USD` = "settled") (01, 03) — **yes, both steps; confirmed by the owner 2026-10-28**.
8. The es/pt-BR/pt-PT texts of the confirmation screen — machine translation with the owner's review (01) — **yes, confirmed by the owner 2026-10-28**.
9. The release branch `chore/issue-<n>-release-vX-Y-Z` goes through `pr:create`/admission, one Issue per release, CI `version-check` (02) — **yes, confirmed by the owner 2026-10-28** (decided in 02 D7).
10. Remove the `Version impact` field from the Issue, the owner chooses the bump (02) — **yes, confirmed by the owner 2026-10-28**.
11. Remove the `sharp` override; restore it with a comment if `icons:generate` fails (02) — **yes, confirmed by the owner 2026-10-28**.
12. If the jsx-a11y baseline is > ~80 violations — split 02-C8 by layer (02) — **yes** (unlikely with 6 rules instead of `recommended`).
13. Ties of the remainder in `distributeAmount` — by the order of the request's `participantIds` (03) — **yes, verify in BE-03-7**.
14. The refresh token is an httpOnly cookie via the same-origin `/api` rewrite (03) — **yes (per the audit)**.
15. Outbox limits: 50 operations, 14 days until `stale`, cache persist 14 days (03) — **yes, confirmed by the owner 2026-10-28 (D20)**.
16. Show "your share" of a pending expense in `OutboxSheet` with an explicit label (03) — **yes, confirmed by the owner 2026-10-28 (D20)** (`money.split` is exact).
17. Money: D10 withdrawn → D21 — the wire is a JSON number with scale 4 forever (backend is the source of truth), domain `Money { minor: bigint }` scale 4, module `src/shared/money/` (03) — **confirmed by the owner 2026-10-28 (D21)**; place of conversion — item 34.
18. The backend does not send the frontend URL (emails/push/bot) (04) — **yes; if there is a channel — add it to the 301 table**.
19. The prod/dev values of `OAUTH_ALLOWED_*` and `CORS_ALLOWED_*` match the expectation of 04 §4.4, plus the new origins `app.chipin.one`/`app-dev.chipin.one` in `OAUTH_ALLOWED_REDIRECT_ORIGINS` and `CORS_ALLOWED_ORIGINS` (04, D26) — **done on dev and prod before 04-4a2 is merged (BE-04-2, D30)**.
20. ~~An installed PWA picks up the new `scope`~~ — withdrawn: under D26 old installations on `chipin.one` are not supported (item 33).
21. The backend implements BE-03-5 (new header `X-Client-Version` → 426) before the outbox is enabled (03, 04) — **confirmed by the owner 2026-10-28 (D19, option A); until then — only the 24-hour forced SW update**.
22. Subdomains for the site project (04) — **decided by D22 + D26**: `site-dev.chipin.one` for the dev site, the site prod is `chipin.one`; the app is `app.chipin.one`/`app-dev.chipin.one`; the plan is not Hobby, custom domains are free, DNS on Vercel; `site.chipin.one` is not needed.
23. Deviations from D8: `/join/group|friend/<token>` instead of `/join/<token>` (04) — **accepted, confirmed by the owner 2026-10-28 (D20)**; the catch-all rewrite to the site was withdrawn by D26 (projects do not proxy each other).
24. ADR FE#498: option (d) Astro site + Vite SPA (04) — **approve**.
25. Olive shade in 21 styled files (ΔE ≈ 1–2), the screenshots of the design-phase migration PRs as control (05, D31) — **accepted (D23)**.
26. `theme_color` = grass-9 `#46a758` instead of `#3e9b4f` from `BRAND_COLORS` (05, hand-written per D31) — **accepted (D23), but the premise is wrong**: `#3e9b4f` = Radix `grass-10` (review A-24). **Default recommendation: keep grass-9 (D23); an alternative with no visible change — `--cp-brand-primary: var(--grass-10)`. The owner confirms.**
27. D9: the full rulebook is `docs/engineering/rules/` (on master), not `docs/codex/rules` (02) — **accept (fact on master)**.
28. Tokens (05-2) move from phase 1 to phase 2 — they require npm workspaces (00) — **accept**.
29. Rotation of the local Sentry token (D16) — **owner action in phase 0**.
30. Exceptions to D23 "no raw hex" (05, review A-29): `--cp-brand-loader #80c837`, `--cp-media-on/scrim #fff/#000` only in `packages/tokens` (D31: `tokens.css`); the file `global-error-boundary/styles.css` — **accept as an addition to D23**.
31. ~~Cutover rollback rule: 04-3d is the last Promote before 04-4; 48 h without Promote (review A-03)~~ — withdrawn by D26: rollback = moving the domain back (04 §4.5).
32. ~~`site.chipin.one` as a duplicate host (review A-33)~~ — withdrawn by D26: there is no host `site.chipin.one`, the site's dev hosts get `X-Robots-Tag` by host (04 §4.3).
33. **C3-01: SW and installed PWAs at cutover** (04 §2.11) — **decided by the owner: D25 (2026-10-28), simplified by D26 (2026-10-29)**. The app on its own host `app.chipin.one` with SW `/sw.js` and scope `/` (as now, C2-01); PWAs installed on `chipin.one` before the move are not supported (about 10 prod users): no reinstall banner, offline launch from their icon is not guaranteed. On `chipin.one` a kill-switch `/sw.js` (removes the registration, cleans the origin's caches) is served first by the shared app build on that host (04-4a1, D30), then by the site project (04-3d, after 04-4b) for at least 6 months. History: D25 chose `/app/sw.js` with scope `/app/` + a kill-switch on the same origin + a banner; option (a) was also rejected — SW `/sw.js` with scope `/` indefinitely with `offline-root.html`.
34. Money — interpretation of D21 "at the API boundary (generated types + wrapper)": the `api()` wrapper = lossless transport (`wireJson.ts`, opaque `WireAmount`, no double), the `WireAmount` ↔ `Money` conversion — only in the `entities/*/model` mappers (02 inv. 3, 03 header/§4.3; C1-11, C2-06, C3-14; before 03-4b) — **accept**.
35. Outbox mutations with `networkMode: 'always'` and their own network wait in `runOutboxOp` instead of the "paused mutations" of D3 (03 §2.1; C1-16a, C3-27) — **accept**; 03-15a does not start until signed off.
36. D9 "a rule is lint/CI or it is deleted" is carried out with the class `REVIEW` for semantic AGENTS.md invariants (02 §Decision 2; C1-16b) — **accept**; 02-A1 does not start until signed off.
37. D4 "zod on the IDB cache": for the query cache, instead of zod — a buster by the shape of the domain model (03 §1.4; before 03-7a); zod stays on the outbox and localStorage (C3-14) — **accept**.
38. Deferred (C1-28): D2 phase 2 (groups and members offline) — without a PR id until 03-17, a separate spec after 03-17 and BE-03-8 (03 §2.9); D16 "narrow img-src" — FU-2 (#539) — **accept as approved deferrals**.
39. ~~Merge freeze window at cutover (C1-07)~~ — withdrawn by D26: rollback by moving the domain does not require a freeze (04 §4.5).
40. ~~Vercel Hobby — a license for non-commercial use (C1-30)~~ — withdrawn by D26: the owner's plan is not Hobby (org project).
41. A revoked session on a lost device (C3-09, 03 §1.5): data under `AuthModal` is hidden (`inert` + `visibility: hidden`, 04 §2.3); offline access to the cache after expiry is disabled; distinguish `REVOKED`/`EXPIRED` on the backend and wipe the cache on `REVOKED` — yes/no (the backend issue is not created until decided) — **recommendation: yes**.
43. Settle-up "tops up" to the exact debt if the input differs by less than 1 minor unit, with a caption under the field (03 §4.5, C3-19; before 03-21) — **accept**.
42. BE-04-3 withdrawn (C3-24): landing statistics without CDN cache, as now; close chipin-backend#208 — **accept**.

44. Cutover step 1 (04-4a2: the app on `app.chipin.one` in prod, private paths on `chipin.one` 302 to it) is performed before the offline write 03-17 is enabled in prod: the outbox in the IndexedDB of the old origin does not move to `app.chipin.one` (04 §4.1, D26, D30); step 2 (04-4b, the site takes `chipin.one`) does not gate 03-17 — **accept** (owner decision R5, 2026-11-10).

Total: 44 items (20, 31, 32, 39, 40 withdrawn); still open are the owner actions 2 (verify `/auth/test-register`), 19 (OAuth env and new origins on dev and prod before the 04-4a2 merge, BE-04-2), 29 (Sentry token rotation) and confirmations 26, 30, 34–38, 41–44 (33 is decided by the owner, D25 → D26). Blocking the start: 36 → 02-A1, 35 → 03-15a. Owner actions without a choice: Root Directory = `apps/app` at the moment of the 04-0a merge; creating `chipin-site` in Vercel (Production Branch `main`, `site-dev.chipin.one` on `master`) before 04-3a; the domains `app.chipin.one`/`app-dev.chipin.one` in the app project as part of 04-4a2 (after 04-4a1 and BE-04-2); moving `dev.chipin.one`, then `chipin.one` to the site project per the 04-4b runbook and the reverse move on the rollback criterion (04 §4.5).

## Scope

| Spec | PRs | Note |
|---|---|---|
| 01 | 3 | ~820 lines total |
| 02 | 22 (21 FE + 02-A0 in ai-workflow; 02-D1 withdrawn — the `React.FC` rule is deleted, 02 §D0; D31: 02-D2a–e and 02-D3a–e withdrawn, +02-C13) | 02-C2a–c are mechanical |
| 03 | 26 (03-19 withdrawn by D21; +03-21; review C: 03-4a/b, 03-7a/b, 03-15a–c, 03-16a/b; +03-14b, 2026-11-10) | 03-17/20 wait for the backend |
| 04 | 25 (was 14: 04-0 → 0a/0b, 04-2a → 2a1–a4, +04-2f, 04-2g, 04-3d; review C: +04-2a2b, +04-2h, 04-3b → 3b1/3b2; D26: content of 04-2g/04-3d/04-4 rewritten; D30: 04-4 → 04-4a1, 04-4a2, 04-4b; D31: 04-2e withdrawn, 04-2b rewritten without a generator) | 04-0a — the move script, review = rerun + look at the non-rename edits |
| 05 | 7 (review C: 05-2 → 05-2a/2b; D31: 05-4 withdrawn, folds into the design phase) | no single "pixel" PR; pixel changes come with the design-phase PRs |
| **Total** | **83** (3 + 22 + 26 + 25 + 7; was 91 before 2026-11-10, C1-29) + 13 backend issues created, after closing chipin-backend#206 there are 12 active (BE-03-3, BE-04-3 and BE-04-1 withdrawn) | ≈ 79 PRs at the ~400-line guideline + 4 mechanical (02-C2a–c, 04-0a) |

## GitHub issues in the frontend repo (when creating: Type, Priority, assignee, Project 5)

- Epic: `Refactor for agent predictability: rulebook, data layer, offline, routing, site, tokens`
- `01-1 Fix: encode API path segments, validate invite tokens, redact invite telemetry, CSP hardening`
- `01-2 Fix: confirm before joining a group or accepting a friend invite`
- `01-3 Fix: single half-up rounding, zero balance is settled, PublicLocaleRoute spinner`
- `02-A Single rulebook: AGENTS.md invariants, rules 00–70 cleanup, remove .ai duplicates`
- `02-B Remove dead dependencies, fix vendor-react chunk, stop icon regeneration`
- `02-C Tooling: Prettier, zero warnings, type-aware ESLint, a11y, boundaries, hooks, version policy, TS strictness`
- `02-D Codemods: named exports, no nested barrels` — withdrawn by D31 (#520: no codemods; 02-C13 belongs to `02-C` #519; close #520 as not planned, coordinator action)
- `03-A Money module src/shared/money and balance entities`
- `03-B OpenAPI-generated API types and typed client`
- `03-C TanStack Query core: client, persister, connectivity, session expiry`
- `03-D Migrate server stores to TanStack Query (store by store, remove useConnect)` (#524: +03-14b, the expense payload on `Money`)
- `03-E Offline outbox for expenses: queue, conflicts, online-only actions` (#525: 03-15c lock-based append + drain per D29, 03-16b conflict message + draft per D28)
- `03-F Client version gate: X-Client-Version header and blocking update screen on 426 (before offline writes)`
- `04-A Monorepo: npm workspaces, apps/app move, i18n-content package, CI path filters`
- `04-B App routing: React Router data router, route manifest, generated vercel.json, lazy locales, single service worker` (#528, D31: no prefetch loaders — 04-2e withdrawn; 04-2b = hand-written host-scoped catch-all rewrite + SW allowlist coverage test, no generator; title to sync)
- `04-C Public site on Astro: landing, legal, invite landing`
- `04-D Cutover: app.chipin.one subdomain, domain move, legacy redirects, kill-switch SW on chipin.one` (#530: Scope and Acceptance per D26 and D30 — step 1: SW host gate 04-4a1, app host move 04-4a2 before the site exists; step 2: site compatibility layer 04-3d, domain move 04-4b with rollback by moving back that keeps the step-1 redirects; to sync)
- `04-E Remove PublicApp, prerender and public routes from the app`
- `05-A Radix CSS split and asset optimization`
- `05-B packages/tokens: DTCG tokens and generator` (#533, D31: hand-written `tokens.css` + `theme.ts` + assets + theme script, no DTCG/generator; title to sync)
- `05-C Single theme-switching mechanism (light/dark/system) without FOUC, remove next-themes`
- `05-D Retire styled-themes: themeColor codemod, styled allowlist, stylelint, CSS Modules` (#535, D31: no codemod PR 05-4 — the migration is file by file in the design phase; 05-5 after 05-2b with suppressions; to sync)
- `05-E basics/components boundary and Radix wrappers cleanup`
- `05-F ds-gallery on app tokens and theme`
- Synchronization after review C (coordinator): new PR ids (03-4a/b, 03-7a/b, 03-15a–c, 03-16a/b, 04-2a2b, 04-2h, 04-3b1/b2, 05-2a/b) — in the bodies of #522, #523, #525, #528, #529, #530, #533; close chipin-backend#208.
- Follow-ups outside the specs: `Telemetry: generic token redaction`, `Security: CSP img-src, report-to, Sentry tunnel`, `Auth: client PKCE after BE-01-1`, `Invites: group preview on confirmation screen after BE-01-3`.
- In `syllik/ai-workflow`: `02-A0 Routing block: read .ai/context.md and .ai/decisions.md only if present`.

## Risks (top 10)

| # | Risk | Mitigation |
|---|---|---|
| 1 | Mass PRs (Prettier, 04-0 rename) and freeze windows slow down feature work; parallelism is lower than expected | calendar of windows 1–3 (Phase plan; window 4 withdrawn by D31, window 5 by D26), file-lock `expenseModal*`, no codemods (D31), `.git-blame-ignore-revs`; the offline critical path is 20 PRs — plan by it |
| 2 | Cutover breaks OAuth, invites, SEO, the site CSP, or deep links | base does not change (`/`, D26), the app moves to `app.chipin.one` first (step 1, 04-4a2, D30) while `chipin.one` keeps today's landing, so step 2 only swaps the public pages; BE-04-2 on dev and prod before the 04-4a2 merge; rehearsal on `dev.chipin.one` before prod; curl per §4.2, one CSP per host, Google sign-in (04 criteria 7, 9, 10); rollback — moving the domain back within minutes; reversible 302 redirects until 04-5a; 7 days before deletion |
| 3 | Installed PWAs lose offline or get stuck on the old shell at cutover | PWAs installed on `chipin.one` before the move are not supported (D26, item 33, about 10 users). Getting stuck on the old shell is covered by the host-gated kill-switch of the shared app build on `chipin.one` (04-4a1, step 1, D30) and then by the kill-switch `/sw.js` of the site project (in site prod before the domain move 04-4b, ≥ 6 months); the app SW on `app.chipin.one` does not change scope; E2E 04-2h (offline reload on the app host, kill-switch on the site preview) |
| 4 | The outbox loses or duplicates operations | offline write behind a flag until BE-03-1/2, separate persist, 03-15 split into a/b/c, msw tests of reload/tabs, limits 50/14 days (details — spec 03) |
| 5 | Money regression (rounding, sign, division) | before/after snapshot, BE-03-7 vectors, money PRs isolated, single lint rules 03 §4.3 |
| 6 | Backend dependencies drag on | money without backend changes (D21), flags, 24-hour SW update; the frontend is not blocked except 03-17/20 |
| 7 | The "old + new" transition confuses agents; lint/format rules make agents do extra rounds | rules without autofix and not about correctness are deleted (02 §D0), pre-commit only fixes, a check on agents before the 02-C merge (0 repeats because of auto-fixable rules); the text of an `L:` rule changes in the same PR as the lint (02-A2 — only DEL/RW without lint); a single layer graph; a single rule registry with a class (02 §D0); AGENTS.md invariants do not contradict spec 03 (transitional ones marked); baseline — native suppressions, ratchet by base SHA from `steps.gate.outputs`, does not leak; one owner per topic (table above) |
| 8 | Vercel configuration error (Root Directory, files outside root, version from cwd) at 04-0a; plan limits for two projects | owner action at merge time, smoke checklist §1.6, comparison of the `dist` composition, version scripts from `import.meta.dirname`; Ignored Build Step by `VERCEL_GIT_PREVIOUS_SHA`, measurement of CI/deploys after 02-C6 and 04-3a (04 §1.5) |
| 9 | Visual shift gray → olive and tokens | per-file migration in the design phase (D31), screenshots of the touched screens in each PR, owner confirmation |
| 10 | IndexedDB unavailable/quota (Safari private), unencrypted financial data | fallback without persist + Sentry, `clearUserData` on logout and account switch |

## What we do NOT do

- Next.js, SSR, RR framework mode, RR actions/`<Form>`; Turborepo (while CI < 10 min); `packages/ui` and `apps/ds-gallery`.
- Tailwind, shadcn, abandoning Radix Themes, a big-bang conversion of styled-components, Storybook, automatic visual regression, cloud VR.
- Offline settle-up/payments; local recalculation of balances; Background Sync; fake events in activity caches; the API in SW `runtimeCaching`.
- zod on API responses; replacing axios with fetch/`openapi-fetch`.
- Biome/oxlint, `exactOptionalPropertyTypes`, `import-x/no-cycle` in pre-commit; translating the rulebook into Russian.
- Style lint rules without autofix (`handle*`, `React.FC`, PascalCase types, nested ternaries, `no-multi-comp`, file/folder names, `toMatchSnapshot`, the full `jsx-a11y/recommended`) and a blocking pre-commit/pre-push — 02 §D0.
- Deploy workflows, renaming the Vercel app project, editing DNS records (cutover is moving a domain between projects, D26), a shared site and app session on `.chipin.one`, support for PWAs installed before the move.
- Migrating hosting away from Vercel (and replacing Analytics) — a separate study, in progress (D18); the specs only isolate the provider (04 §1.5a).
- A locale prefix in the app URL; changes to `ModalRouter`; a group preview on `/join/*` until BE-01-3 and the owner's decision.
- Figma for now (DS v1/D17: Pencil mockups are one-off, the source is `packages/tokens/tokens.css`); a DTCG `tokens.json` and a token generator (D31).
- Codemods for named exports and barrels (D31); route loaders that prefetch queries (D31); a generated `vercel.json`/hosting config (D31); outbox leader election, epoch fencing, heartbeat/steal, an IDB inbox (D29); a conflict compare dialog (D28).
- UUID validation in the API layer (only `validateUuidParam` at the route level, 04-2a3), generic token redaction and narrowing `img-src` in the hotfix.
