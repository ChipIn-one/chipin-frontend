# Spec 04: monorepo, app routing, and the public site (D6, D7, D8; ADR for FE#498)

Status: draft for the owner, 2026-10-28. Repo: `ChipIn-one/chipin-frontend`. Verified read-only on branch `chore/issue-456-ds-gallery` @ `3d0086e`; paths re-checked against `origin/master` `522973a` (there are already no deploy workflows there — delivery = Vercel Git integration + Promote; rules in `docs/engineering/rules/`). Backend verified on `chipin-backend` (branch `develop`).

PR identifiers are `04-<n>` (global scheme, `00-overview.md`); "phase N" in the text = PR `04-N`. After review A: `04-0` → `04-0a`/`04-0b`, `04-2a` → `04-2a1…04-2a4`, new `04-2f`, `04-2g`, `04-3d`. After review C (2026-10-28): `04-2a2` is split into `04-2a2`/`04-2a2b`, new `04-2h` (Playwright E2E SW), `04-3b` → `04-3b1`/`04-3b2`. 2026-10-29 (D26, owner decision): the app moves to the subdomain `app.chipin.one` (dev — `app-dev.chipin.one`) instead of the path `/app/`, the site stays on `chipin.one` (dev — `site-dev.chipin.one`). D26 simplifies D25: there is no longer a base path `/app/`, a `CUTOVER` constant, an SW scope change, a reinstall banner, or a freeze window; cutover = moving the domains in Vercel with rollback by moving them back (§4.5). PR ids are kept, the content of `04-2g`, `04-3d`, `04-4` is rewritten. Backend issues — `BE-04-<n>`.

Deviations from DECISIONS: (1) D8 "Hosting: same domain … `/app/*` → SPA" and "SW registered only under /app/" are replaced by D26: two hosts, `chipin.one` — the site, `app.chipin.one` — the app; the projects do not proxy each other, the app SW is `/sw.js` with scope `/` on its own host (§2.11, §4). (2) D8 "invite landing `/join/<token>`" → `/join/group/<token>` and `/join/friend/<token>`: group and friend tokens are different backend entities (§3.5). (3) D15 "one deploy workflow" — there are no deploy workflows on master, the only path is Vercel Git integration + Promote; this stays for two projects (§1.4). (4) D6 "per-route errorElement" → three levels: root, `AuthLayout`, `InternalLayout` (§2.5; a route module may add its own `ErrorBoundary`). (5) The D20 "catch-all rewrite" is withdrawn by D26: proxying the site through the app project is no longer needed (§4.1).

Ownership of overlapping topics: lazy-loading of locales (D16) — **this spec** (04-2c); SW registration and its deduplication — **this spec** (04-2d); the vendor-regex and removal of `dexie`/`workbox-window` — spec 02 (02-B1); `packages/tokens` as a whole — spec 05 (05-2); ds-gallery stays in `apps/app/ds-gallery/` (§6), gets tokens per spec 05 (05-7), typecheck — spec 02 (02-C5).

## Goal

1. Move the repository to a monorepo on npm workspaces: `apps/app` (the current SPA), `apps/site` (Astro), `packages/tokens`, `packages/i18n-content`. The first PR is a pure file move with no behavior change.
2. Move the app to the React Router 7 data router. There is one source of routes — the manifest. `vercel.json` (rewrites and redirects) and the SW navigation allowlist are generated from it, and a test checks that they match.
3. Move the public SEO pages to Astro (`apps/site`). Remove from the app the second tree `PublicApp`, prerender, and the precache check.
4. Separate the site and the app by host (D26): the site on `chipin.one`, the app on `app.chipin.one` (dev — `site-dev.chipin.one` and `app-dev.chipin.one`); old app URLs on `chipin.one` return a redirect to the same path on `app.chipin.one`.
5. Record the ADR for FE#498: the split into Astro + SPA versus Next.js and versus the current state.

## Context

- The code has 4 lists of private routes that are synchronized by hand: `src/features/routing/AppRouter.tsx:58-146`, `src/constants/routes.ts:3-96` (`ROUTES` + `ROUTE_META`), the rewrites in `vercel.json` (`/dashboard/:path*` … `/not-found`), `scripts/private-spa-navigation.ts:3-6`. The test `private-spa-navigation.test.ts` checks only the regex (audit 02, finding 1).
- Public pages are rendered by two trees: `src/root.tsx:28-52` hydrates `PublicApp` on `data-public-ssg`, and inside the SPA the same pages go through `PublicLocaleRoute`. Because of this, `Toaster`, `BackendUnavailableGate`, meta, and the redirect for a logged-in user are duplicated (`src/public-routes/PublicContent.tsx:24-58`, `PublicEffects.tsx:42-63,97-105`, `HomeRouteGuard.tsx:23-36`) (audit 02, finding 2).
- The i18n language is written by 4 or more places (`src/i18n/index.ts:12`, `PublicLocaleRoute.tsx:28-51`, `useSyncUserSettings.tsx:18-33`); there is a risk that the loader hangs (audit 02, finding 3; hotfix per D1).
- The router is declarative only: `<BrowserRouter>` in `src/main.tsx:57`, `InternalRoute` repeated 8 times, one `Suspense`, no `errorElement` (audit 02, findings 9–10). `features/routing` imports `pages`, which violates V1 (audit 01 §1.2).
- The SW is registered twice: `registerSW` in `src/basics/PWABadge.tsx:8-23` and a manual `navigator.serviceWorker.register('/sw.js', { scope: '/' })` in `src/helpers/swUpdates.tsx:221-289`. The "Later" TTL is 4 h (`swUpdates.tsx:13`), there is no minimum-version check (audit 02, findings 7–8).
- PWA manifest: `start_url: '/'`, `scope: '/'`, `id: '/'` (`vite.config.ts:142-160`). Workbox `navigateFallback: 'app.html'` with an allowlist (`vite.config.ts:197-211`).
- All locales × 13 namespaces are imported statically: `src/i18n/resources.ts` (audit 02, finding 12; 5 locales and 65 imports at the audit, 2 locales and 26 imports after #609).
- The public manifest is 3 pages × 2 locales = 6 URLs. Prefixes: `en: ''`, `/ru` (`src/constants/publicRouteManifest.ts`). The former `/es`, `/pt-br`, `/pt-pt` prefixes were removed by #609 and permanently redirect to the English page (`vercel.json` `redirects`).
- The app itself builds invite links: `src/helpers/url.ts:46-50` (`/friends/join/<t>`, `/group/join/<t>`). The backend returns only `inviteToken`: `GroupDtos.kt:11,30`, `UserService.kt:91-93`.
- OAuth: the frontend passes `redirect_to=<origin>/oauth/callback?returnTo=…` (`src/helpers/url.ts:28-44`). The backend checks **only the origin** (`OAuthRedirectValidator.kt:21-27`, `application.yaml:26-27` `OAUTH_ALLOWED_REDIRECT_ORIGINS`, `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS`).
- ds-gallery imports the app's `basics/*` and `components/*` directly (`ds-gallery/gallery.tsx`), and there is also `ds-gallery/vite.config.ts` with aliases to `src/*`.
- FE#498 requires comparing at least three options: (a) Vite + custom SSG, (b) Next.js, (c) RR framework mode or a separate public site. FE#498 is blocked by FE#497 (switch to canonical `master`). FE#499 requires a single routing system and SEO without parallel copies, and app and auth routes must remain non-indexable.

## Decision (brief)

- npm workspaces without Turborepo. React, react-dom, TypeScript, and Vite are pinned at the root. First a separate PR with the mechanical move `src/` → `apps/app/src/`.
- Two Vercel projects and two hosts (D26). The current project (name unchanged) — Root Directory `apps/app`, domains `app.chipin.one` (Production) and `app-dev.chipin.one` (branch `master`); it serves the app, `/api/*` (same-origin proxy to the backend), and `/.well-known/*`. The new project `chipin-site` (Root Directory `apps/site`) — domains `chipin.one` (Production) and `site-dev.chipin.one` (`master`). The projects do not proxy each other. Cutover — moving the domains `dev.chipin.one`, then `chipin.one` from the app project to the site project; DNS is on Vercel, the records do not change. Rollback — move the domain back to the app project, takes minutes (§4.5).
- Vite `base` = `'/'` and SW `/sw.js` with scope `/` on the app host — as now; there is no base path and no mode flag (§2.1, §2.11). PWAs installed on `chipin.one` before the move are not supported: no reinstall banner, offline launch from their icon is not guaranteed (D26). On `chipin.one` the site serves a self-removing `/sw.js` (kill-switch) for at least 6 months (§3.6).
- One route manifest (pure data) and a typed map of lazy modules. The guard is implemented as a layout route, `errorElement` exists at the root and on the layout. Loaders warm up TanStack Query (spec 03) and do not block navigation.
- The site is Astro static: built-in i18n with the same URLs (`/`, `/ru/`, `/ru/privacy`…), content collections, hreflang, sitemap, only tokens CSS; it does not register a worker (only the kill-switch `/sw.js`). The invite landing is `/join/group/<token>` and `/join/friend/<token>` with an explicit button to the confirmation screen on `app.chipin.one`. Old app URLs on `chipin.one` are served by the site project's redirects (§4.2).
- ds-gallery stays in `apps/app/ds-gallery/`.

## Details

### 1. Monorepo (D7)

#### 1.1 Layout

```
/                         repo root (workspace root, private)
  package.json            workspaces, root proxy scripts, product version (D15)
  package-lock.json       the only lockfile
  tsconfig.base.json      shared compilerOptions (strict, moduleResolution bundler, erasableSyntaxOnly …)
  eslint.config.js        one flat config, blocks by globs apps/app/**, apps/site/**, packages/**
  prettier.config.js      one (D13, spec 02 D6), `.prettierignore`, `.editorconfig`, `lint-staged`
  config/eslint/          ESLint presets from spec 02 (D5, D9), `APP_DIR` per workspace
  .husky/                 hooks call the root scripts (command texts do not change)
  scripts/                repo-level only: version-*, ci-gate-policy, create-pr, release-qa-*,
                          release-qa/ (+ their tests)
  apps/
    app/                  @chipin/app — the current SPA
      package.json  vite.config.ts  vitest.config.ts  vitest.contract.config.ts
      tsconfig.json tsconfig.app.json tsconfig.node.json  pwa-assets.config.ts  vercel.json
      index.html          (formerly app.html after 04-5a; in 04-0a — both html files as is)
      src/  public/  contract-tests/  ds-gallery/
      scripts/            prerender*, verify-public-precache, private-spa-navigation, run-task-tests,
                          taskTestArgs (while they live), then generate-routing-artifacts
    site/                 @chipin/site — Astro
      package.json astro.config.ts tsconfig.json vercel.json src/ public/
  packages/
    tokens/               @chipin/tokens — layout and content set by spec 05 §1 (generated/, assets/, src/)
    i18n-content/         @chipin/i18n-content — locales.ts, common/<locale>.json
```

#### 1.2 Root `package.json`

- `"private": true`, `"workspaces": ["apps/*", "packages/*"]`, `"engines": { "node": "24.21.0" }`. The `version` field stays here, it is the single product version (D15, spec 02 D9). **The only source of the version is the root `package.json`**; `apps/*/package.json` and `packages/*/package.json` have no `version` field.
- The repo root in the version scripts (A-01). Currently `scripts/version-resolver.mjs:9` (`REPOSITORY_ROOT = resolve(process.cwd())`) and `scripts/version-check.mjs:8-9` take the path from `process.cwd()`. After the move Vite is started with cwd = `apps/app` (Vercel Root Directory, `npm run -w`), and `readPackageVersion` fails with "package.json must contain a version string". Therefore in 04-0a `version-resolver.mjs`, `version-check.mjs`, and `version-bump.mjs` compute the root from their own file: `const REPOSITORY_ROOT = resolve(import.meta.dirname, '..')`, and `PACKAGE_PATH` and `LOCKFILE_PATH` from it; `process.cwd()` is not used in these scripts. `apps/app/vite.config.ts` imports `../../scripts/version-resolver.mjs`. Test in `version-resolver.test.mjs`: after `process.chdir('apps/app')`, `resolveAppVersion()` returns the root version.
- Version normalization (A-09). Prod is built by Promote of a `master` commit (`VERCEL_GIT_COMMIT_REF=master`), while `MAIN_BRANCH = 'main'` (`version-resolver.mjs:6`), so prod currently serves `1.0.8-dev-<sha>`. In 04-0a the resolver returns a plain `x.y.z` if `VERCEL_ENV === 'production'` or the branch is `main`; otherwise `x.y.z-dev-<sha7>`. Test: `{ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'master' }` → `1.0.8`. A rule for all consumers of `APP_VERSION` (the `X-Client-Version` header, comparison with `X-Min-Client-Version` in 03-20, the Sentry release): only the semver core `major.minor.patch` is compared, the suffix after `-` is dropped before comparison (contract for 03-20, see `00-overview.md` "Cross-edits for 03").
- Root `devDependencies`: `typescript ~5.9.3`, `eslint` and plugins, `prettier`, `husky`, `vitest`, `vite`. The versions are the same for all workspaces.
- Root `dependencies`: `react`, `react-dom` at the exact version (`19.3.0` without `^`), and also `overrides`: `{ "react": "$react", "react-dom": "$react-dom" }`. This way the Astro integration `@astrojs/react` and the app get one React instance.
- Proxy scripts so that CI and husky do not change: `"verify:full": "npm run verify:full -w @chipin/app && npm run build -w @chipin/site --if-present"`, `"lint": "eslint ."`, `"test:full": "npm run test:full -w @chipin/app"`, `"build": "npm run build -w @chipin/app"`, `"vercel-build"` is not needed at the root (Vercel builds in the Root Directory), `"version:check"` and `"version:bump"` unchanged.
- `apps/app/package.json`: `"name": "@chipin/app"`, `"private": true`, no `version` field. All runtime dependencies of the app and its scripts move here with the same names (`build`, `vercel-build`, `test:task`, `build:ds-gallery` …).
- `packages/*` declare `"exports"` pointing to sources (`"./tokens.css": "./tokens.css"`, `".": "./src/index.ts"`). There is no package build, consumers bundle the sources themselves.

#### 1.3 Shared configs

- `tsconfig.base.json` (created by 02-C5; if it is not merged yet — it is created here per the composition of 02 D8) contains only `compilerOptions` without `baseUrl`, `paths`, `include`, and `tsBuildInfoFile`. In 04-0 it moves to the root. `apps/app/tsconfig.app.json` does `extends: "../../tsconfig.base.json"` and sets `paths` itself **without `baseUrl`** (02-C3 format: `"api/*": ["./src/api/*"]`) and `include: ["src", "ds-gallery"]` (02-C5). `apps/site/tsconfig.json` extends `astro/tsconfigs/strict` and repeats the strict flags from base.
- `eslint.config.js` at the root. If 02-C4 is merged — it imports `config/eslint/*` and sets `APP_DIR = 'apps/app'` (02 D9), otherwise the current blocks get `files: ['apps/app/src/**/*.{ts,tsx}']`, the axios/api rule (`eslint.config.js:167-193`) is moved as is. `apps/site` gets a separate block with `eslint-plugin-astro`, `packages/**` — a block without React rules. Type-aware lint (D13) uses `parserOptions.projectService: true`.
- Prettier and lint-staged are wired once at the root (D13).
- Typecheck of all TS files (A-21): `packages/tokens` and `packages/i18n-content` have their own `tsconfig.json` (`extends: "../../tsconfig.base.json"`, `include: ["src", "*.ts"]`); the root `tsconfig.json` is a solution file with `references` to `apps/app`, `packages/*`. `apps/app/scripts/**/*.ts` are part of `apps/app/tsconfig.node.json`. ESLint `projectService.allowDefaultProject` — only for root `*.config.js`. The site is checked by `astro check` (the site step in CI, §1.4), because `astro build` does not check types.

#### 1.4 CI

- `frontend-ci.yml` (the only CI workflow on master) stays **a single job `frontend-ci`** — this is the name of the required check in the ruleset, it cannot be changed (A-20). There is no second filtering mechanism (`dorny/paths-filter`, third-party actions, a `ci-ok` job). The mode is chosen by the existing step "Resolve verification mode" via `scripts/ci-gate-policy.mjs`, which is extended: instead of `docs-only|full` it emits `docs-only|app|site|full`.
  - `app`: only `apps/app/**` changed;
  - `site`: only `apps/site/**` changed;
  - `full`: any change in `packages/**`, `package-lock.json`, the root `package.json`, `tsconfig.base.json`, `eslint.config.js`, `config/**`, `scripts/**`, `.github/**`, and also the combination app + site;
  - the job steps run conditionally on `steps.mode.outputs.mode`: app → `npm run verify:full -w @chipin/app`; site → `npm run lint` on `apps/site`, `astro check`, `astro build`; full → both. The admission step is neither duplicated nor skipped. New modes are covered by cases in `scripts/ci-gate-policy.test.mjs`.
- `npm ci` runs once at the root. The `actions/setup-node` cache is keyed by the root `package-lock.json`.
- Artifact paths: `dist/` → `apps/app/dist/`, `apps/site/dist/`.
- There are no deploy workflows and none are added (D15, spec 02 D7): both Vercel projects are built by the Vercel Git integration from `master`, prod is a manual Promote (`DEPLOYMENT.md` §"Vercel delivery from master"). The release-QA workflows (`prepare-release-qa.yml`, `release-qa-result.yml`) get the prefix `apps/app/` in artifact paths.

#### 1.5 Vercel: two projects

| Project | Root Directory | Domains | Build | Output |
|---|---|---|---|---|
| current (keep the **name** unchanged, see Backend requirements) | `apps/app` | `app.chipin.one` (Production), `app-dev.chipin.one` (`master`), preview `*.vercel.app`; before cutover also `chipin.one` and `dev.chipin.one` | `npm run vercel-build` | `dist` |
| `chipin-site` (new) | `apps/site` | `site-dev.chipin.one` (`master`) from 04-3a; `dev.chipin.one` (`master`) and `chipin.one` (Production) — from cutover (§4.5) | `astro build` | `dist` |

- In both projects enable "Include source files outside of the Root Directory", otherwise the root lockfile and `packages/*` will not be found.
- The `chipin.one` DNS zone is on Vercel (D26). The subdomains `app`, `app-dev`, `site-dev` are added to the projects as custom domains. Cutover and rollback are moving a domain between projects of the same team, the DNS records do not change. A future move off Vercel = moving DNS and two independent builds, with no external rewrite between projects (D18).
- Enable "Ignored Build Step" by paths so that a project is not rebuilt on someone else's changes (A-30): `[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ../../packages ../../package-lock.json ../../package.json ../../tsconfig.base.json ../../scripts`. Without `VERCEL_GIT_PREVIOUS_SHA` (the first deploy of a branch) or on a git error the command returns a non-zero code, and the project is built. `HEAD^` is not used: on a push of several commits it sees only the last one.
- The owner's plan is not Hobby (org project, D26): custom domains are free and unlimited, the fallback `*.vercel.app` is not needed.
- Plan limits (A-31): check concurrent builds and the daily deploy limit against the Limits page before 04-3a. Deploys skipped by the Ignored Build Step are also created (as cancelled). Two projects × a push of every PR double the queue. Action: after 02-C6 and after 04-3a, measure the CI duration (`timeout-minutes: 20`) and the number of deploys per week; if CI > 15 min or deploys > 60/day — move `import-x/no-cycle` to nightly and enable the Ignored Build Step for the previews of all branches except PRs with `apps/site/**`.

**Release model of the two projects (A-08).** The site is released the same way as the app (`DEPLOYMENT.md:42-66`): manual Promote only.
- In `chipin-site`: Production Branch = `main`, `git.deploymentEnabled.main: false` (via `vercel.passthrough`, §1.5a), the domain `site-dev.chipin.one` is bound to the branch `master`. A merge into `master` gives only dev/preview, the site prod changes only by Promote. Before cutover the site's Production has no custom domain: dev rules are verified on `site-dev.chipin.one`, prod rules — right after the move of `chipin.one` (§4.5). The setup is done by the owner when creating the project (04-3a).
- Promote order: first app, then site, both from the same `master` SHA. Reason: the site pages (`/join/*`, sign-in buttons) link to app routes, not the other way round.
- Release-QA and completion: both projects create the GitHub Deployment `Production`; an Issue is closed only by the app project's deploy (environment `Production – <app project name>`). A section "Two projects" with these three rules is added to `docs/engineering/release-qa.md`. If the org sweep in `ChipIn-one/.github` filters only by `environment == 'Production'`, the filter needs fixing there (an owner issue in `.github`, created in 04-3a; without it a site deploy may close an Issue before the app).

#### 1.5a Provider isolation (D18)

The owner plans to leave Vercel (a separate hosting + analytics study, in progress), so the spec does not deepen the lock-in:
- Everything Vercel-specific lives only in `apps/app/vercel.json`, `apps/site/vercel.json`, and the generator (`generate-routing-artifacts.ts`, for the site — `seoGuard`). Both `vercel.json` files are generated, not edited by hand.
- The table of rewrites/redirects/headers is kept in provider-neutral JSON: `apps/app/hosting.base.json` and `apps/site/hosting.base.json`. The route manifest generator emits `vercel.json` from it (`emitters/vercel.ts`); moving to Cloudflare/Netlify/nginx = a new emitter (`_redirects`/`_headers`, `nginx.conf`), the manifest and the table do not change.
- The `hosting.base.json` schema (A-07); an example — `apps/app/hosting.base.json` after 04-2g:
  ```jsonc
  {
    "env": {
      "prod": ["app.chipin.one"], "dev": ["app-dev.chipin.one"], "preview": ["*.vercel.app"],
      "legacyProd": ["chipin.one"], "legacyDev": ["dev.chipin.one"]   // until 04-5a: the former hosts and the rollback target (§4.5)
    },
    "headers":   [{ "source": "/(.*)", "env": ["prod", "dev", "preview"], "set": { "X-Robots-Tag": "noindex, nofollow" } }],
    "redirects": [{ "from": "/join/group/:token", "to": "https://app.chipin.one/group/join/:token", "env": ["legacyProd"], "status": 302 },
                  { "from": "/join/friend/:token", "to": "https://app.chipin.one/friends/join/:token", "env": ["legacyProd"], "status": 302 },
                  { "from": "/join/group/:token", "to": "https://app-dev.chipin.one/group/join/:token", "env": ["legacyDev"], "status": 302 },
                  { "from": "/join/friend/:token", "to": "https://app-dev.chipin.one/friends/join/:token", "env": ["legacyDev"], "status": 302 }],
    "rewrites":  [{ "from": "/api/:path*", "to": "https://api.chipin.one/:path*", "env": ["prod", "legacyProd"] },
                  { "from": "/api/:path*", "to": "https://api-dev.chipin.one/:path*", "env": ["dev", "legacyDev", "preview"] }],
    "vercel":    { "passthrough": { "$schema": "…", "buildCommand": "…", "git": { "deploymentEnabled": { "dev": false, "main": false } } } }
  }
  ```
  - A rule's `env` is a list of keys of the `env` table (without the field — for all hosts of the project). The `env` → hosts table is the only one; the Vercel emitter turns each host into `has: [{ type: 'host', value: … }]` (for `*.vercel.app` — `{ "suf": ".vercel.app" }`, as in the current `vercel.json`), a rule with several hosts becomes several rules.
  - `apps/site/hosting.base.json` — the same schema: `env` = `{ "prod": ["chipin.one"], "dev": ["site-dev.chipin.one", "dev.chipin.one"], "preview": ["*.vercel.app"] }` and an `appOrigin` field keyed by env (`prod` → `https://app.chipin.one`, `dev` and `preview` → `https://app-dev.chipin.one`) for the redirects of §4.2; also `legacyRedirectStatus` (`302` until 04-5a, `301` from 04-5a).
  - The emitter copies `vercel.passthrough` verbatim into the root of `vercel.json`; this is the only place for Vercel fields with no neutral analog (`$schema`, `buildCommand`, `git`). Another emitter ignores it.
  - Generator test: in 04-2b the generated `apps/app/vercel.json` is semantically equal to the current `vercel.json` (order and composition of rewrites, redirects, headers, `has`, `git`); from 04-2g, for the hosts `legacyProd`/`legacyDev` it equals the current one plus the compat redirects of `/join/*` to the app host of its environment.
- `@vercel/*` in code — only in one module `apps/app/src/app/telemetry/vercelAnalytics.ts` (bootstrap of Analytics + Speed Insights), which is deleted entirely (moving the imports there — in PR 04-2b); on the site — one `<script>` line in `BaseLayout` (§3.6). The lint `no-restricted-imports` bans `@vercel/*` everywhere except this file. Vercel-only APIs (Edge Config, KV, Functions, `@vercel/og`) are not used.
- Analytics and Speed Insights remain for now (D18).

#### 1.6 The mechanical move PRs (04-0a and 04-0b) — no behavior change

Two PRs (A-40). **04-0a** — items 1–5 and 7: rename and configs; the move commands live in the committed `scripts/move-to-workspace.sh`, review = rerun the script on base and compare the tree (`git diff --stat` is empty), plus a manual look at the non-rename edits (root and app `package.json`, lockfile, paths in the version scripts, workflows). **04-0b** — item 6 (replacing paths in documentation), right after 04-0a. References to "04-0" in other specs mean 04-0a.

1. `git mv` into `apps/app/`: `src`, `public`, `index.html`, `app.html`, `contract-tests`, `ds-gallery`, `vite.config.ts`, `vitest.config.ts`, `vitest.contract.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `pwa-assets.config.ts`, `vercel.json`, `vercel.config.test.js`, and also the app scripts (`prerender-public.mjs`, `prerender-before-workbox.*`, `verify-public-precache.mjs`, `private-spa-navigation.*`, `run-task-tests.mjs`, `taskTestArgs.*`).
2. Create the root `package.json` (§1.2) and `apps/app/package.json`; move `tsconfig.base.json` (from 02-C5) and the tooling configs of spec 02 (`prettier.config.js`, `config/eslint/`, `.husky/`) to the root and regenerate the lockfile. Dependency versions do not change: `npm ci` must produce the same set of packages (compare `npm ls --all --json`).
3. Fix paths: the import `./scripts/version-resolver.mjs` in `vite.config.ts` → `../../scripts/…`; in `scripts/version-{resolver,check,bump}.mjs` the root from `import.meta.dirname` and the prod version normalization (§1.2, A-01/A-09); `root` in `ds-gallery/vite.config.ts` (it is computed from `__dirname`, so it does not change), `readFileSync('vercel.json')` in `vercel.config.test.js` → a path from `import.meta.dirname`, paths in `prerender-before-workbox.mjs`, globs in `eslint.config.js`.
4. `.github/workflows/*`: `node scripts/<repo-level>.mjs` stay as is. References to app scripts and `dist/` get the prefix `apps/app/`. `paths-ignore` in `native-development-link.yml` does not change.
5. `.husky/pre-commit` does not change, because the root proxy scripts keep their names (pre-push was removed in 02-C10, spec 02 §D0).
6. Documents: `AGENTS.md`, `CLAUDE.md`, `docs/**`, `DEPLOYMENT.md` — replace `src/` → `apps/app/src/` in paths.
7. Vercel: set Root Directory → `apps/app` **at the moment of the merge** (the owner, Settings). The order of actions is in "Phases". After the Root Directory change, the previews of open PRs with the old layout are not built (there is no `apps/app`): before the 04-0a merge the authors of open PRs rebase or wait; in the merge window there are no open feature PRs. After 04-0a, deploys built before it are not promoted (the rebuild under the new Root Directory fails); prod rollback — only Instant Rollback (rule in `DEPLOYMENT.md`, C1-30).

Criteria for "no behavior change":
- The number of tests and their result are the same (currently 1230/1230).
- From the root `npm run build -w @chipin/app` and from `apps/app` `npx vite build` give the same `APP_VERSION` = the root `package.json` version (with the suffix `-dev-<sha>` outside prod); `npm run version:check` passes from the root and from `apps/app`.
- The set of files in `apps/app/dist` matches the former `dist` up to hashes. Prerender HTML matches byte for byte after normalizing the hashes in asset names. The number of precache entries in `sw.js` is the same.
- The preview of PR 04-0a is not built: the project's Root Directory is still `.` before the merge, while `vercel.json` is already in `apps/app` (C2-11). Therefore before the merge — locally: `npm run build -w @chipin/app`, comparison of `dist` (above). Smoke on `/`, `/ru/`, `/dashboard`, `/group/join/<test>`, `/oauth/callback`, `/api/health` (`200`, the same content) — on `dev.chipin.one` right after the merge and the Root Directory change, before any Promote; prod does not change until there is a Promote.
- Rollback of 04-0a: Root Directory → `.` + a revert PR. Criterion: any smoke URL is not `200` or has different content.

### 2. App routing (D6)

#### 2.1 Base path and hosts

- **The base path does not change (D26).** Vite `base: '/'`, `build.outDir: 'dist'`, the router has no `basename`. There are no `CUTOVER`/`APP_BASE` constants or `app-base.config.ts` file: the app lives at the root of its host both before and after cutover. `base: ''` and `'./'` remain forbidden: in Vite 8.3 this is a relative base (`vite/dist/node/chunks/node.js:37456`), and a deep link `/group/<id>` would load `/group/assets/*`, get `app.html` instead of JS, and show an empty screen. Test `vite.config.test.ts` (04-2d): `base === '/'`.
- `APP_SHELL = 'app.html'` — a constant in `apps/app/pwa.config.ts` (04-2d); 04-5a renames the file to `index.html` and changes the constant. The constants `ROUTES` (`'/dashboard'`), `navigate`, `<Link>`, and `matchPath` by `useLocation().pathname` do not change; `window.location.pathname` is read as now, no helper for stripping a prefix is needed.
- **Hosts (04-2g).** `src/constants/env.ts` `ENV_URLS` gets for each environment `appHostnames` and `siteOrigin`: prod — `['app.chipin.one', 'chipin.one']` and `https://chipin.one`; dev — `['app-dev.chipin.one', 'dev.chipin.one']` and `https://site-dev.chipin.one` (`chipin.one` and `dev.chipin.one` are removed in 04-5a). Currently `getEnv()` (`src/helpers/env.ts:17-50`) knows only `dev.chipin.one` and throws on an unknown hostname without `VITE_CHIPIN_ENV`, so without this edit `app-dev.chipin.one` could crash at startup. `getChipInAppUrl()` stays `window.location.origin`; the new `getSiteOrigin()` returns the environment's `siteOrigin` (preview → dev). Test `env.test.ts`: each host from `ENV_URLS` gives the expected environment and `siteOrigin`.
- Links from the app to the site (A-16). `ROUTES.HOME`, `ROUTES.PRIVACY`, `ROUTES.TERMS` are removed from `ROUTES` in 04-2f and replaced by `SITE_PATHS` (`apps/app/src/app/router/sitePaths.ts`: `home: '/'`, `privacy: '/privacy'`, `terms: '/terms'`, `localeHome(l)`), which are used only as `<a href>` or `window.location.assign`, never in `navigate`/`<Link>`. In 04-2g `SITE_PATHS` become absolute: `getSiteOrigin()` + path. Before cutover `https://chipin.one/privacy` is served by the app project itself (prerender), after — by the site; the user-facing behavior does not change. Consumers: `Page404.tsx:18`, `Header.tsx:47,70`, `src/components/Header.tsx:55` and `src/components/header/LandingMobileMenu.tsx:21` (`window.location.assign/href` to public paths), `resolveOAuthReturnTo` (`url.ts:9-34`). Lint: `no-restricted-syntax` on `MemberExpression[object.name='ROUTES'][property.name=/^(HOME|PRIVACY|TERMS)$/]`.
- `.well-known/assetlinks.json` stays in `apps/app/public/.well-known/` (base `/`, Vite copies it to `dist/.well-known` itself; there is no separate `public-root/` folder or copy step). In 04-2g `https://app.chipin.one` and `https://app-dev.chipin.one` are added to it; the same copy lives in `apps/site/public/.well-known/assetlinks.json` (04-3d), equality of the two files is checked by the generator test (§2.9).

#### 2.2 Route manifest

The file `apps/app/src/app/router/routeManifest.ts` is pure data. It has no imports except types and only erasable syntax, so that Node 24 can import it from a script without a build.

```ts
type RouteAccess = 'public' | 'protected';
type RouteLayout = 'internal' | 'bare' | 'public';  // 'public' — transitional ids only, until 04-5a

interface AppRouteDef {
    id: AppRouteId;                 // 'dashboard' | 'solo' | 'group' | ...
    path: string;                   // relative to basename: 'group/:groupId'
    access: RouteAccess;
    layout: RouteLayout;            // internal = InternalPageLayout with navigation
    guard?: 'solo';                 // additional layout guard
    meta: { titleKey: string; entityTitleKey?: string };  // keys of ns 'meta'
    legacyPaths: readonly string[]; // paths on chipin.one from which the site project redirects to app.chipin.one (§4.2)
    transitional?: true;            // transitional public route; removed in 04-5a
    localePrefix?: true;            // the path is repeated under every LOCALE_PREFIX prefix
}
```

Routes (the full table as of the spec):

| id | path | access | layout | guard | legacyPaths |
|---|---|---|---|---|---|
| `home` | `` (index) | protected | internal | — | — (from 04-5a; before it `/` is the transitional `publicHome`) |
| `login` | `login` | public | bare | — | — |
| `oauthCallback` | `oauth/callback` | public | bare | — | `/oauth/callback` |
| `dashboard` | `dashboard` | protected | internal | — | `/dashboard` |
| `solo` | `solo` | protected | internal | solo | `/solo` |
| `group` | `group/:groupId` | protected | internal | — | `/group/:groupId` |
| `groupJoin` | `group/join/:inviteToken` | protected | bare | — | — (on `chipin.one` the old path leads to the site landing, §4.2) |
| `activity` | `activity` | protected | internal | — | `/activity` |
| `activityDetails` | `activity/:parentActivityId` | protected | internal | — | `/activity/:parentActivityId` |
| `friends` | `friends` | protected | internal | — | `/friends` |
| `friendJoin` | `friends/join/:inviteToken` | protected | bare | — | — (§4.2) |
| `settings` | `settings` | protected | internal | — | `/settings` |
| `notFound` | `not-found` | public | bare | — | — (on `chipin.one` after cutover — the site's `404.astro`, §4.2) |
| `publicHome` | `` (index) | public | public | — | — (`transitional`, `localePrefix`) |
| `publicPrivacy` | `privacy` | public | public | — | — (`transitional`, `localePrefix`) |
| `publicTerms` | `terms` | public | public | — | — (`transitional`, `localePrefix`) |

- Transitional routes (C2-10). Until 04-5a, `/`, `/privacy`, `/terms` and their forms with the `LOCALE_PREFIX` prefixes (`publicRouteManifest.ts:4-20`) are `publicHome`/`publicPrivacy`/`publicTerms` (`layout: 'public'`, the element is the current `PublicLocaleRoute`, on `/` — with `HomeRouteGuard`, as now). They are needed while the app project holds `chipin.one` (before cutover) and serves as the rollback target (until 04-5a). On `app.chipin.one` they also respond, but the whole host is under `noindex` (§4.3). `createAppRouter` and the generator take the `transitional` routes until 04-5a; `home` (index) appears in 04-5a. The generator does not emit rewrites for transitional ids (they are prerender files), they are not in the SW allowlist (exact precache entries, as now). 04-5a removes the three ids.
- `home` (index, from 04-5a) — a loader with a `redirect` to the preferred mode (`dashboard` or `solo`). It replaces `HomeRouteGuard`.
- `login` — a new sign-in screen with a Google button. It accepts `?returnTo=` and `?locale=`. The site buttons and the guard lead to it. `login` sends an authenticated user straight to `returnTo` (default `/dashboard`), so the site button "Open ChipIn" leads to `/login` (§3.6). Currently an unauthenticated user is sent to the landing (`ProtectedRoute.tsx:18-48`); after the landing moves to another host this would add an extra round app → site → app.
- `*` → the NotFound component in place, without `<Navigate>`, so that the URL is preserved.

Lazy modules: `apps/app/src/app/router/routeModules.ts`.

```ts
export const ROUTE_MODULES = {
    dashboard: () => import('pages/dashboard/route'),
    // ...
} satisfies Record<AppRouteId, () => Promise<RouteModule>>;
```

Every page has a `route.ts` file with **named** exports in the RR7 `lazy` format: `Component`, optional `loader` and `ErrorBoundary`. A default export is not needed, D11 is respected, the shims `.then(m => ({default: …}))` (`AppRouter.tsx:17-36`) are removed. `satisfies Record<AppRouteId, …>` makes TS require a module for every id.

#### 2.3 Tree and the guard as a layout route

`createAppRouter(queryClient)` in `src/app/router/createAppRouter.tsx` builds the tree from the manifest:

```
RootLayout            errorElement=RootErrorBoundary; UI providers, Toaster (one), ModalHost,
                      GlobalHooks, <ScrollRestoration/>
├─ public routes      login, oauth/callback, not-found, *
└─ AuthLayout         loader=requireSession; errorElement=RouteErrorBoundary; <Outlet/> + AuthModal on top when the session has expired
   ├─ bare routes     group/join/:inviteToken, friends/join/:inviteToken
   └─ InternalLayout  errorElement=RouteErrorBoundary; InternalPageLayout + <Outlet/>
      ├─ index (home redirect), dashboard, group/:groupId, activity, activity/:id, friends, settings
      └─ SoloGuardLayout → solo
```

- `AuthLayout` replaces `ProtectedRoute`, `InternalRoute` (8 wrappers) and the paddings baked into the guard (`ProtectedRoute.tsx:43-47`, they move to `InternalLayout`).
- `requireSession` (loader) returns a promise chain (the `await`/`.then` style is free, D24): `({ request }) => { const url = new URL(request.url); const returnTo = url.pathname + url.search; return restoreReady.then(() => authReady()).then(session => (isSignedOut(session) ? redirect('/login?returnTo=' + encodeURIComponent(returnTo)) : null)); }`. `authReady()` is the promise of the initial session check, moved out of `useCheckSignIn` into `src/app/auth/session.ts`. `isSignedOut(session)` is true exactly for the "redirect" row of the table below.
- The decision of `requireSession` by the result of `authReady()` (C2-25, C3-08; constants `AUTH_STATUS`/`UNAUTH_REASON` from `src/store/authConstants.ts`):

  | status / reason | loader action |
  |---|---|
  | `AUTHENTICATED` | pass |
  | `UNAUTHENTICATED` + `SIGNED_OUT` or `MISSING` | redirect `/login?returnTo=…` (before 04-2f — as now: `SIGNED_OUT` → landing, `MISSING` → `AuthModal`) |
  | `UNAUTHENTICATED` + `EXPIRED` or `INVALID` | pass; `AuthLayout` shows `AuthModal` over the hidden page |
  | `UNAUTHENTICATED` + `ERROR` or `PERSISTENCE_ERROR`; `UNKNOWN_OFFLINE` (5 s timeout) | session hint `=== true` and `!isNetworkUsable()` → pass to the cache; otherwise `AuthModal` (retry sign-in); never a redirect |

  In no row does the loader erase user data: which reasons trigger `clearUserData` is set only by spec 03 §1.5.
- **There is one online predicate (C1-06).** `isNetworkUsable()` from `src/shared/offline/network.ts` (= TanStack's `onlineManager.isOnline()`; it is also toggled by the `/health` probe of spec 03 §1.2; introduced by 03-5). Loaders, guards, and screens of this spec use only it. `navigator.onLine` outside `src/shared/offline/**` is banned by lint (`no-restricted-properties`, registry 02 §D0). On lie-fi `navigator.onLine === true` while `isNetworkUsable() === false`, so the loader does not wait for `ensureQueryData` and navigation does not hang.
- Initial load (A-27): the root route sets `hydrateFallbackElement` = the current loader spinner, so that the screen is not empty while `authReady()` waits for the refresh. `authReady()` resolves no later than after 5 s (`Promise.race` with a timer); on timeout the status = `UNKNOWN_OFFLINE` (the last row of the table above).
- Offline (D2): if there is a session hint (`LocalStorage.get(LS_KEY_AUTH_SESSION_HINT) === true`) and `!isNetworkUsable()`, the loader does **not** redirect, but lets through to the cached data. Details in spec 03.
- The session expired during use: `AuthLayout` shows `AuthModal` over `<Outlet/>` and does not unmount the page. The expense draft is not lost, but only provided that spec 03 removes the reset of `expenseModalStore` from `expireSession` (audit 02, finding 11). The page under the modal is hidden: the `<Outlet/>` container gets `inert`, `aria-hidden=true`, and a class with `visibility: hidden` — the state is alive, but the finances are not visible to the person whose session was revoked (C3-09; owner decision — `00-overview.md`, spec 03).
- An explicit sign-out is a full navigation `window.location.assign(getSiteOrigin() + getLastAccountLandingPath())` to the site (§2.1).
- `SoloGuardLayout` — until 03-9 the loader reads `useUsersStore.getState()` (profile not loaded → pass without redirect, as the current `SoloRouteGuard`); 03-9 changes one line to `restoreReady.then(() => cachedOrEnsure(selfUserQuery))`. Target loader: `restoreReady.then(() => cachedOrEnsure(selfUserQuery)).then(user => (canAccessSolo(user) ? null : redirect('/dashboard')))`, where `cachedOrEnsure` takes the cache and calls `ensureQueryData` only online with an empty cache (§2.4); offline without a cache — pass without redirect. Replaces `SoloRouteGuard.tsx:14-27`.

#### 2.4 Loaders and TanStack Query

- A loader gets `queryClient` through the closure of `createAppRouter(queryClient)`. Query options are taken only from the factories of spec 03 (`entities/<x>/api/queries.ts`). Custom `queryFn`s in a loader are forbidden.
- Every loader starts with the persister hydration gate from spec 03: `restoreReady` (the promise of restoring the cache from IndexedDB), (`await` is allowed, D24): `() => restoreReady.then(() => { … })`. Otherwise the first loader would see an empty cache and go to the network before the offline data is restored.
- Rule: a loader **does not wait for the network**. It calls `void queryClient.prefetchQuery(opts)` for every query of the route. A loader may wait for data (`return queryClient.ensureQueryData(opts)` inside `.then`) only if the data is needed for a redirect/404 decision, `isNetworkUsable()` **and** the cache is empty (`queryClient.getQueryData(opts.queryKey) === undefined`); otherwise it takes the cache. This applies to `SoloGuardLayout` too. The component reads the same data through `useQuery` and shows the existing skeletons. Because of this navigation is not blocked offline or on a slow network (D2, `networkMode: 'offlineFirst'`).
- Exceptions — a loader may throw an error or redirect:
  - An invalid parameter (`groupId`/`parentActivityId` is not a UUID) → `throw data(null, { status: 404 })`. An invalid `inviteToken` (the `isInviteToken` format from 01-1) does **not** give 404: the join page shows the `invalid` state of the confirmation screen 01-2.
  - Guard redirects (§2.3).
- Prefetch by route: `dashboard` → balances, groups, activity preview. `group` → group(id), groupActivity(id). `activity` → activity page 1. `activityDetails` → subevents(id). `friends` → friends. `settings` → self user. The exact keys are set by spec 03.
- Actions (RR7) are not used: mutations go through `useMutation` and the outbox (spec 03). This way all mutations have one path.

#### 2.5 Errors

- `Sentry.ErrorBoundary` stays outside `RouterProvider` and catches only provider crashes.
- `RootErrorBoundary` (the root `errorElement`) and `RouteErrorBoundary` (on `InternalLayout`, rendered inside the layout, so the header and navigation remain; and on `AuthLayout` — for the bare join routes, C2-32) use one component `RouteErrorView`:
  - `isRouteErrorResponse(e) && e.status === 404` → NotFound without sending to Sentry.
  - A chunk load error (`/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/`) → an "A new version is available" screen with an update button: `updateServiceWorker(true)`, and if there is no SW, `location.reload()`. The automatic reload is done once per session (a flag in `sessionStorage`) so as not to fall into a loop.
  - Anything else → `Sentry.captureException(e, { tags: { routeId } })` and a recovery card (the logic of `GlobalErrorFallback.tsx:30-80`).
- `routeId` for tags is taken from `useMatches()`. A raw URL with a token does not go to Sentry (D1 — token leak).

#### 2.6 Meta and title

- `handle: { meta }` from the manifest. The `useDocumentTitle()` hook in `RootLayout` takes the last match with `handle.meta`, translates `titleKey` (and when there is an entity — `entityTitleKey` with the group name) and sets `document.title`. The app does not need a description, because the whole app host is served with noindex (§4.3).
- `ROUTE_META` (`routes.ts:30-96`), `useRoutesMeta`, and the duplicated meta in `PublicEffects` are removed.

#### 2.7 Compatibility with the modal router

- `ModalRouter` (`docs/architecture/modal-router.md`) keeps history in memory and does not depend on the URL. The move to the data router does **not affect** it, no change is needed.
- Global modals (`AddExpenseModal`, promo, `main.tsx:66-75`) are mounted in `RootLayout`, i.e. inside the router, so `useNavigate` works in them. A modal open on a page closes when `location.pathname` changes the same way as now (the behavior is preserved, test in the criteria).
- Modals do not enter the manifest. The future URL mode (#412) is described in "Future extension".

#### 2.8 Code-splitting

- Every `route.ts` is a separate chunk. `RootLayout`, `AuthLayout`, and `InternalLayout` are part of the entry.
- Manual vendor groups (`vite.config.ts:258-285`): `dexie` was removed and the `vendor-react` regex (together with `react-router`) was fixed in 02-B1 — not repeated here.
- Hover prefetch of chunks is not done in the phases (see "Future extension").

#### 2.9 Generated artifacts and the sync test

The script `apps/app/scripts/generate-routing-artifacts.ts` (run as `node apps/app/scripts/…` without flags, type stripping is enabled on Node 24) reads `routeManifest.ts`, `apps/app/hosting.base.json`, and from `apps/site/hosting.base.json` only `env`, `appOrigin`, and `legacyRedirectStatus`, and writes:

1. `apps/app/vercel.json` — `hosting.base.json` (headers, `/api` rewrites, compat redirects, `vercel.passthrough`) plus SPA rewrites from the manifest `path` (`/dashboard/:path*` → `/app.html`, etc.; 04-5a → `/index.html`). There are no legacy redirects or catch-all in the app project. In 04-2b the result is semantically equal to the current `vercel.json` (§1.5a).
   - app headers (A-02, simplified by D26): the app project serves only its own paths, so CSP, `Referrer-Policy`, and `X-Frame-Options` are set on `source: "/(.*)"` for all hosts of the project; `X-Robots-Tag: noindex, nofollow` — only for `prod`/`dev`/`preview` (not for `legacyProd`/`legacyDev`, where the public pages live before cutover).
2. `apps/site/legacy-redirects.generated.json` — redirects of old app URLs on the site hosts (§4.2): for every `legacyPaths` of the manifest `<path>` and `<path>/:path*` → `<appOrigin>` + the same path, by site env, plus the fixed rows of §4.2; status — `legacyRedirectStatus`. The site emitter (§1.5a) merges the file into `apps/site/vercel.json`. This way the list of private paths stays in one manifest.
3. `apps/app/src/app/router/routing.generated.ts` — `PRIVATE_SPA_NAVIGATION_ALLOWLIST` from the manifest `path`; in 04-2b a test compares it with the current two regexes of `scripts/private-spa-navigation.ts`, in 04-5a the index `/` is added to it (there are no more public pages in the app). It is imported by `pwa.config.ts` (replaces `scripts/private-spa-navigation.ts`).
4. The script `npm run routes:generate -w @chipin/app` and the step `routes:check` in `verify:full`.

The test `apps/app/scripts/generate-routing-artifacts.test.ts`:
- generates in memory and compares with the committed `apps/app/vercel.json`, `apps/site/legacy-redirects.generated.json`, and `routing.generated.ts`. On a mismatch it prints "run npm run routes:generate";
- every manifest `path` (with test parameters substituted) matches the SW allowlist **and** at least one rewrite;
- every `legacyPaths` has a redirect in `legacy-redirects.generated.json`; its `destination` begins with the `appOrigin` of its env and preserves the path; no redirect points to a path outside the manifest or the site;
- `/group/join/:token` and `/friends/join/:token` come before `/group/:path*` and `/friends/:path*`;
- `vercel.config.test.js` (the `/api` checks) stays and works on the generated file: for the hosts `prod` and `legacyProd` `/api` leads to `api.chipin.one`, for the rest — to `api-dev.chipin.one`;
- every `ROUTE_MODULES` key is in the manifest and vice versa (TS checks this too, the test duplicates it for a clear message);
- `X-Robots-Tag` is present for the hosts `app.chipin.one`, `app-dev.chipin.one`, `*.vercel.app` and absent for `chipin.one`, `dev.chipin.one`;
- in 04-2b the result is semantically equal to the current `vercel.json`, no legacy redirects and no catch-all (A-06);
- no `redirects[].source` in `apps/site/vercel.json` matches a file of the built `apps/site/dist` (`sw.js`, `.well-known/*`, `_astro/**`, `favicon.*`): a Vercel redirect fires before the file (§4.1; C1-19, C3-11); `apps/app/public/.well-known/assetlinks.json` and `apps/site/public/.well-known/assetlinks.json` are identical.

The listed rewrites, rather than a single `/:path*`, are needed so that an unknown path gets a real 404 and the SW does not serve the offline shell for it. This behavior matches the current one (`private-spa-navigation.ts:1-2`).

#### 2.10 i18n in the app

- There is no locale prefix in the app URL.
- Lazy loading: `i18next-resources-to-backend` with `(lng, ns) => ns === 'common' ? loadCommon(lng) : import(`./locales/${lng}/${ns}.json`)` (the relative `./` template is bundled by Vite via dynamic-import-vars). The `common` namespace is taken from `@chipin/i18n-content`: a bare specifier with a variable (`import(`@chipin/i18n-content/common/${lng}.json`)`) is **not** bundled by Vite and stays a runtime import with a 404 (A-13). Therefore the package exports `loadCommon(lng: SupportedLocale): Promise<Record<string, unknown>>` from `packages/i18n-content/src/loadCommon.ts`, built on `import.meta.glob('../common/*.json', { import: 'default' })` (key `../common/${lng}.json`; unknown locale → reject). The package's `package.json`: `exports` `".": "./src/index.ts"`, `"./common/*": "./common/*"`. No JSON ends up in the entry. `src/i18n/resources.ts` is removed. Build test: `dist/assets` has exactly 2 `common` chunks.
- `SUPPORTED_LOCALES` and `DEFAULT_LOCALE` are imported from `@chipin/i18n-content`, and `src/constants/locales.ts` becomes a re-export.
- The language changes **in one place**: `src/app/i18n/setAppLanguage.ts` returns a chain (free style, D24): `i18n.loadLanguages(lng).then(() => i18n.changeLanguage(lng)).then(() => { document.documentElement.lang = lng; LocalStorage.set(LS_KEY_LOCALE, lng); })`. `i18n.changeLanguage` outside this file is banned by the `no-restricted-syntax` lint rule.
- The initial language is chosen once at init, in this order: `LocalUser.settings.language` → the saved `locale` → `?locale=` on `/login` (comes from the site; the `localStorage` of the site and the app are on different origins, so the site knows only the language of its page or `navigator.languages`, §3.5) → `navigator.languages` → `en`. After the profile loads, `useSyncUserSettings` calls `setAppLanguage` only if the server language differs from the current one.
- While the language is loading, `Suspense` in `RootLayout` works. `PublicLocaleRoute` is removed, and with it goes the hanging spinner bug (D1).
- A key parity test across all locales is added to CI (audit 02 §5).

#### 2.11 Service worker

**D26 (2026-10-29) simplifies D25.** The app SW is `/sw.js` with scope `/` on the app host (`app.chipin.one`, `app-dev.chipin.one`, preview), a single registration (C2-01). The scope changes neither at cutover nor after: the app host serves only the app. PWAs installed on `chipin.one` before the move are not supported: no reinstall banner, offline launch from their icon is not guaranteed; online such an icon opens the site with a button to sign in to the app (accepted by the owner, about 10 prod users). New installs are made from `app.chipin.one`. On `chipin.one` the site project serves a kill-switch `/sw.js` (§3.6); the site does not register a worker.

- There is one registration: `useRegisterSW` from `virtual:pwa-register/react` in `src/app/pwa/ServiceWorkerManager.tsx` registers `/sw.js` with scope `/` — exactly what the manual `register('/sw.js', { scope: '/' })` does today (`swUpdates.tsx:221-289`), so 04-2d does not create a second registration and the SW behavior does not change (C2-01). There are no other places where scope is set. `src/helpers/swUpdates.tsx` and the manual `register('/sw.js')` are removed; the second update path `src/helpers/serviceWorkerRecovery.ts` (`SKIP_WAITING` postMessage, `:107-128`) is removed too, and `GlobalErrorFallback.tsx:19` calls `updateServiceWorker(true)` from `ServiceWorkerManager` (A-26), `src/basics/PWABadge.tsx` (spec 05 does not move it) is renamed to `ServiceWorkerManager` (the TODO in `PWABadge.tsx:6`). `workbox-window` was removed earlier in 02-B1 (not used in code). This is the only PR that changes the SW registration.
- The VitePWA config is built by the pure function `buildPwaOptions()` in `apps/app/pwa.config.ts` (the test `pwa.config.test.ts` checks the table; manifest colors — from `@chipin/tokens/generated/manifest-colors.json`, spec 05 §6):

  | option | value |
  |---|---|
  | VitePWA `outDir` (where `sw.js` is written; also `globDirectory`) | `dist` |
  | `buildBase` (registration path and `<link rel="manifest">`) | `/` |
  | `scope` (registration and manifest) | `/` |
  | SW file → URL | `dist/sw.js` → `/sw.js` |
  | manifest file → URL | `dist/manifest.webmanifest` → `/manifest.webmanifest` |
  | manifest `start_url` / `scope` / `id` | `/` / `/` / `/` (as now; on the new origin the browser treats the install as a new app) |
  | manifest icons | `/pwa-*.png` etc. (as now) |
  | `globPatterns` | `**/*.{js,css,html,svg,png,ico,webp}` (as now) |
  | `navigateFallback` | `APP_SHELL` (`app.html`; 04-5a → `index.html`) |
  | `navigateFallbackAllowlist` | `PRIVATE_SPA_NAVIGATION_ALLOWLIST` from `routing.generated.ts` (§2.9) |

  Common: `registerType: 'prompt'`, `injectRegister: false`, `skipWaiting: false`, `clientsClaim: true`, `cleanupOutdatedCaches: true`, `inlineWorkboxRuntime: true` (no `workbox-*.js` appears next to the SW), no `runtimeCaching`; `manifestTransforms: [addPublicDirectoryAliases]` — until 04-5a, while prerender exists. There is no API cache in the SW (that is the TanStack persister, spec 03). The options are checked against `vite-plugin-pwa@1.3.0` (`dist/index.js`: `swDest = outDir/filename`, `globDirectory = outDir`, registration path and `<link rel="manifest">` = `buildBase` + `filename`/`manifestFilename`) and `workbox-build@7.4.1` (`navigateFallbackAllowlist`, `inlineWorkboxRuntime`).
- Offline on the app host: paths from the allowlist — the shell from precache; an unknown path does not match the allowlist and gets 404, as now; transitional public pages (until 04-5a) — exact precache entries, as now.
- The manifest `id` does not change (`/`). An install from `app.chipin.one` is, for the browser, a different app than the old install from `chipin.one` (different origin); there is no install migration.
- Update policy:
  1. Detection: at startup, on `visibilitychange → visible` (`registration.update()`), and once an hour if online.
  2. Prompt: an "Update available" toast with the buttons "Update" and "Later". "Later" hides the toast until the next `visible` after 4 h.
  3. Forced: if a waiting worker has been hanging **for more than 24 h** since first detection (time in `localStorage`), the update is applied automatically at the nearest safe point. A safe point is a route change or `visible`, with no open modal with a dirty draft, `queryClient.isMutating() === 0`, and no outbox operation in the `sending` status (`outboxState` of spec 03 §2.3; before 03-15a there is no outbox — the condition is true) (C3-12). The outbox is stored in IndexedDB and survives a reload (spec 03).
  4. Minimum version: the "App update required" screen (blocking, one button `updateServiceWorker(true)` or reload) and the function `showUpdateRequired()` live here (04-2d, behind a flag). The screen's button calls `registration.update()`, waits for `waiting` up to 10 s, and only then `updateServiceWorker(true)`; if there is no new worker, the screen says "The update has not been published yet, try again later" and does not reload (otherwise a reload loop of the same version, C3-26). Before any reload the `onBeforeAppReload` callbacks from `ServiceWorkerManager` are called (03-13 registers saving the expense draft to `sessionStorage`). The screen is shown when `outboxGate` (`shared/offline/outboxGate.ts`, spec 03 §2.4; before 03-15a — a no-op stub) is closed with the reason `outdated` (replay stopped until the update); `showUpdateRequired()` puts the gate into this state, the outbox is not deleted. Detection is spec 03 (03-20): a 426 `CLIENT.OUTDATED` response or an `X-Min-Client-Version` header greater than the semver core of `APP_VERSION` (comparison only of `major.minor.patch`, the `-dev-<sha>` suffix is dropped, §1.2), contract BE-03-5. Now (D19, option A) only item 3 works. Before the outbox is enabled (03-17), BE-03-5 (new header `X-Client-Version` + `MIN_CLIENT_VERSION` → 426) and 03-20 (the header in one line in the axios interceptor from `APP_VERSION`, `src/constants/version.ts`, Vite `define`) are mandatory; the screen of item 4 is then enabled. The 72 h rule: `MIN_CLIENT_VERSION` is raised only after ≥ 72 h of the new FE version in prod (spec 03 §7).
- **Rejected alternatives.** (a) SW `/sw.js` with scope `/` indefinitely on a shared domain with `offline-root.html` (option (a) of C3-01). (b) D25: `/app/sw.js` with scope `/app/`, a kill-switch on `/sw.js` of the same origin and a one-time reinstall banner. Both schemes were needed only because of the shared origin of the site and the app; D26 separated them by host, and both mechanisms are unnecessary.

### 3. Site (Astro, D8)

#### 3.1 Layout of `apps/site`

```
astro.config.ts           output: 'static', trailingSlash: 'ignore', build.format: 'directory', i18n, sitemap
vercel.json               cleanUrls, headers (site CSP), rewrites /join/* and /api/stats, redirects of §4.2 (from legacy-redirects.generated.json)
src/
  i18n/                   ui.ts (t(locale, key)), locales/<locale>/{landing,meta,join}.json
  layouts/BaseLayout.astro  <head>: title, description, canonical, hreflang, OG, tokens.css
  components/             Header.astro, Footer.astro, LanguageLinks.astro, Hero.astro, ...
  content.config.ts       collection schemas (Astro 7: `src/content.config.ts`, not `src/content/config.ts`)
  content/                legal/, help/, blog/ (md/MDX)
  pages/
    index.astro                         en home
    [locale]/index.astro                ru home (getStaticPaths from locales)
    privacy.astro, terms.astro, [locale]/privacy.astro, [locale]/terms.astro  (from the legal collection)
    help/[...slug].astro, [locale]/help/[...slug].astro
    blog/[...slug].astro, [locale]/blog/[...slug].astro
    join/group.astro, join/friend.astro
    404.astro
public/                   robots.txt, favicon.*, og/*.png, sw.js (kill-switch, §3.6), .well-known/assetlinks.json
```

#### 3.2 i18n

- `@chipin/i18n-content/locales.ts` exports `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, and `LOCALE_PATH: { en: '', ru: 'ru' }`. The values match `LOCALE_PREFIX` (`publicRouteManifest.ts`).
- `astro.config.ts`: `i18n: { defaultLocale: 'en', locales: ['en', 'ru'], routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false } }`. The list is built from `LOCALE_PATH`, not written by hand.
- URLs do not change: `/`, `/privacy`, `/terms`, `/ru/`, `/ru/privacy`, `/ru/terms` (6 URLs; locale home pages — with a trailing slash, the others — without, as in `publicRouteManifest.ts:14-19`). Duplicates by trailing slash (A-33): `trailingSlash: 'ignore'` serves both `/privacy` and `/privacy/` with 200, so `apps/site/hosting.base.json` gets 301 redirects generated from `LOCALE_PATH` × pages: `/<page>/` → `/<page>` for non-home pages and `/<locale>` → `/<locale>/` for locale home pages. One URL form = canonical.
- hreflang in `BaseLayout`: for every page `<link rel="alternate" hreflang="<code>">` to all locales that have a translation (`getRelativeLocaleUrl`), plus `x-default` → en. Canonical is the absolute `https://chipin.one/...` (`site` in the config). The hosts `site-dev.chipin.one` and `dev.chipin.one` never end up in canonical.
- `@astrojs/sitemap` with `i18n: { defaultLocale: 'en', locales: { en: 'en', ru: 'ru' } }` writes `sitemap-index.xml`. `robots.txt` points to `Sitemap: https://chipin.one/sitemap-index.xml`. `/sitemap.xml` gets a 301 to `/sitemap-index.xml`.
- Build check (moved from `prerender-public.mjs:55-70`): every page has a title and description in all locales, and the HTML has no strings that look like tokens. Implemented by an `astro:build:done` integration in `apps/site/integrations/seoGuard.ts` that fails the build. Site key parity (A-32): the test `apps/site/src/i18n/parity.test.ts` compares the keys of all `apps/site/src/i18n/locales/<locale>/*.json`, including `join.json`, with `en`; it runs in the site step of CI.

#### 3.3 Content collections

`src/content.config.ts` (A-14: in astro 7.4 the collections config is `src/content.config.ts`; the file `src/content/config.ts` is silently ignored; `z` is imported from `astro/zod`). In 04-3a — `astro@^7.4`.

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const base = z.object({
    title: z.string().min(1),
    description: z.string().min(50).max(160),
    locale: z.enum(['en', 'ru']),
    translationKey: z.string(),          // links translations for hreflang
    updatedAt: z.coerce.date(),
    draft: z.boolean().default(false),
    ogImage: z.string().optional(),
});
export const collections = {
    legal: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/legal' }), schema: base }),
    help:  defineCollection({ loader: glob({ pattern: '**/*.mdx', base: './src/content/help' }), schema: base }),
    blog:  defineCollection({ loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
             schema: base.extend({ author: z.string(), tags: z.array(z.string()).default([]) }) }),
};
```

Files are laid out as `<collection>/<locale-path>/<slug>.md(x)`, the locale folder is in path form (`en`, `ru`, the values of `LOCALE_PATH`), the `locale` field in the frontmatter is the code (`ru`) (A-32). Criterion of 04-3a: a fixture with invalid frontmatter fails `astro build`. `draft: true` does not enter the build or the sitemap. Pages without a translation are not generated, and no hreflang is set for them (they are not substituted with English).

#### 3.4 Which pages move

| Now (`src/`) | On the site | Note |
|---|---|---|
| `pages/HomePage.tsx` + `features/landing/*` (hero, features, how-it-works, showcase, cta) | `pages/index.astro`, `[locale]/index.astro`, `components/*.astro` | texts from `locales/*/landing.json` and `meta.json` (public part) move to `apps/site/src/i18n/locales` |
| `pages/PrivacyPage.tsx` | `content/legal/<locale>/privacy.md` | the `PRIVACY_SECTIONS` sections (`PrivacyPage.tsx:13`) → markdown |
| `pages/TermsPage.tsx` | `content/legal/<locale>/terms.md` | same |
| `store/landing-stats-store` (public statistics) | `<script>` in `Hero.astro` (vanilla `fetch('/api/…')`, the same endpoint as in `src/api/statsApi.ts`) | progressive enhancement: on error the block is hidden; not a React island |
| `public-routes/PublicLanguageLinks.tsx` | `components/LanguageLinks.astro` | |
| `components/Footer.tsx` (public version, `PublicBuildYearContext`) | `components/Footer.astro` (year at build time) | the app footer stays in app without `PublicBuildYearContext` |

The new sections `/help/*`, `/blog/*` in this spec only get routes and a schema. Content is FE#499 and FE#147.

#### 3.5 Invite landing

- URL: `/join/group/<token>` and `/join/friend/<token>` on `chipin.one`. The type in the path is needed because group and friend tokens are different entities on the backend (`GroupDtos.kt:11` and `UserService.kt:91-96`). They cannot be merged under a single `/join/<token>` without an API request.
- Static: `pages/join/group.astro` and `pages/join/friend.astro`. Rewrite in `apps/site/vercel.json`: `/join/:kind(group|friend)/:token` → `/join/:kind`.
- The page is `noindex` (`<meta name="robots" content="noindex">`), is not in the sitemap, has `Referrer-Policy: no-referrer` so that the token does not leak in the Referer.
- Inline script:
  1. Extracts the token from `location.pathname` and validates it with the same regex as hotfix D1. The token format is a domain constant, it belongs neither in `packages/tokens` nor in `packages/i18n-content`, so the regex is copied into `apps/site/src/lib/inviteToken.ts`. A test in `apps/app` imports both regexes and fails on a mismatch.
  2. If the token is valid, the "Open invitation" button gets the href `PUBLIC_APP_ORIGIN` (§4.4) + an explicit table `{ group: '/group/join/', friend: '/friends/join/' }[kind] + encodeURIComponent(token)`. If invalid, the page shows "The link is broken" and a link to `/`.
  3. Language: the page contains the strings of all locales (≈6 strings × 2) from `apps/site/src/i18n/locales/<locale>/join.json` (the same JSONs as the rest of the site, checked by the parity test of §3.2; there are no inline strings in `.astro`) and chooses by `navigator.languages` → `en`. The app's `localStorage` is not accessible to the site (different origin, D26), and the `Chipin_*` keys on `chipin.one` after cutover are stale data of the old install, the site does not read them. The button passes the chosen code as `?locale=<code>` (and inside `returnTo`), so that the registration of a new user gets the right language (`url.ts:39-41`; C3-25); for an existing user the app takes the saved language before `?locale` (§2.10). There are no prefixed `/ru/join/...`, because the links are built by the app without a locale.
- There is **no** automatic redirect into the app, only an explicit button. The app on `app.chipin.one/group/join/:token` shows the confirmation screen from spec 01 (PR 01-2: generic text and a "Join" button; the group name — only after BE-01-3) and calls `joinGroup` only after a click. An unauthenticated user goes through `/login?returnTo=…` and returns to the confirmation screen.
- In the app, `buildGroupInviteLink` and `buildFriendInviteLink` (`src/helpers/url.ts:46-50`) change in 04-2g to `${getSiteOrigin()}/join/group/${encodeURIComponent(t)}` and `/join/friend/…`. Before cutover `chipin.one` still belongs to the app project, and the compat redirect (§4.2, 302) leads `/join/group/<t>` straight to `https://app.chipin.one/group/join/<t>` (dev — `app-dev.chipin.one`), so that a new member does not create data on the old origin; after cutover the link is opened by the site landing.

#### 3.6 Styles, islands, SW, 404, analytics

- Styles: only `@chipin/tokens/radix-colors.css` + `@chipin/tokens/tokens.css` (package layout — spec 05 §1; the font is the system one, no webfont) and scoped `<style>` in `.astro`. Favicon (A-28): `BaseLayout` sets `<link rel="icon" href={faviconUrl}>`, where `faviconUrl` is `import faviconUrl from '@chipin/tokens/assets/favicon.svg?url'` (Astro emits a hashed file in `/_astro/`); `/favicon.*` on `chipin.one` is served by the site, the PWA manifest icons — by the app project on its host. Radix Themes, styled-components, and Tailwind are not used. The dark theme is the same mechanism as in the app: `THEME_INIT_SCRIPT` from `@chipin/tokens/theme-init` (spec 05, PR 05-3) inline in `<head>` sets `html.light|dark` by the key `Chipin_theme` and `prefers-color-scheme`.
- React islands — only for a widget that needs state and cannot be done with a `<script>` of up to ~50 lines. Every island addition is a separate PR with a justification. Only the `client:visible` or `client:idle` directives are allowed; `client:load` is banned. The JS budget per site page is ≤ 30 KB gz (checked in `seoGuard`). Currently there are **zero** islands.
- There is **no** redirect of a logged-in user from `/` to the app (D26): the session flag `Chipin_authSessionHint` lives in the app's `localStorage` on `app.chipin.one`, it is not accessible to the site on `chipin.one`, and the same-named key on `chipin.one` after cutover is stale. The site header on all pages contains an "Open ChipIn" button → `${PUBLIC_APP_ORIGIN}/login`: until 04-5a the root `/` of the app host is the transitional `publicHome` (§2.2), and `/login` of an authenticated user leads straight into the app; from 04-5a the button may lead to `${PUBLIC_APP_ORIGIN}/`. There is also no standalone redirect or `?src=root` mark: old PWA installs are not supported (§2.11). `HomeRouteGuard` is removed in 04-5a with no replacement on the site.
- The site does not register a worker. `apps/site/public/sw.js` holds a kill-switch for the old registration of the app on `chipin.one` (scope `/`, D26): `install` → `self.skipWaiting()`; `activate` → `caches.keys()` and deletion of **all** origin caches (after cutover nobody has their own caches on `chipin.one`) → `self.registration.unregister()` → `self.clients.matchAll({ type: 'window' })` and `client.navigate(client.url)`; there is no `fetch` handler. The kill-switch does not touch IndexedDB and `localStorage`. Header `Cache-Control: no-cache` for `/sw.js` (`apps/site/hosting.base.json`). Keep for at least 6 months after cutover; removal — a separate PR no earlier than this term. What an old install or tab sees online: the old SW may once more serve the previous shell from precache; its update check receives the kill-switch, it activates, cleans the caches, removes the registration, and reloads the window; after that `chipin.one` comes from the network — the site, and the old app paths — by redirect to `app.chipin.one` (§4.2). Offline the old SW serves the previous shell until the first online launch. Test `apps/site/src/lib/swKillSwitch.test.ts` (fake `caches`, `registration`, `clients`): after `activate` the caches are empty, `unregister` and `navigate` are called once each.
- 404: `src/pages/404.astro` with text in en and links to the locales. Vercel serves it with status 404 for any unknown path on the site host.
- Analytics (D18, kept for now): the site includes only `<script defer src="/_vercel/insights/script.js">`. The path `/_vercel/*` is served by the project that holds the domain, so the site statistics are in the site project, the app's — in the app project. Speed Insights on the site — the same way. Sentry is not installed on the site.
- The invite token does not go to analytics (A-15, D1): `BaseLayout` includes the analytics/speed-insights scripts only when `includeAnalytics !== false`, and `join/group.astro` and `join/friend.astro` pass `includeAnalytics={false}`. Additionally (review B M13) on all site pages an inline script `window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); }; window.va('beforeSend', e => ({ ...e, url: e.url.replace(/\/join\/(group|friend)\/[^/?#]+/, '/join/$1/[token]') }));` stands before the analytics script — its sha256 is part of the site CSP (`seoGuard`, §3.6). Test `apps/site/src/lib/analyticsRedact.test.ts`: `/join/group/abc?x=1` → `/join/group/[token]?x=1`. `seoGuard` fails the build if HTML under `join/` contains `_vercel/insights` or `_vercel/speed-insights`. Nothing needs to change in specs 01 and 03: the app sanitizer `sanitizeTelemetryEvent` stays as is.
- The site CSP lives **only** in the site project (`apps/site/hosting.base.json` → `apps/site/vercel.json`); the projects do not proxy each other, so each host gets exactly one CSP of its project (A-02). The site project sets for its paths a CSP, `Referrer-Policy: strict-origin-when-cross-origin` (for `/join/(.*)` — `no-referrer`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`. The base directives are the same as the app's after 01-1 (`object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`, no Google Fonts), `connect-src 'self'` (the landing statistics — through `/api/stats` of the same host, §4.1), plus `script-src 'self' 'sha256-…'` for **all** inline scripts (theme-init from 05-3, `/join/*`, the `beforeSend` redaction); the hashes are computed by `seoGuard` and written to `vercel.json` at build, with a check "committed = computed". The app CSP after 04-2b lives in `apps/app/hosting.base.json` (05-3 puts the theme-init hash there too).

### 4. Domain routing (D26)

#### 4.1 Who serves what

Vercel's order inside a project (C1-19, C3-11; checked against `@vercel/routing-utils@6.6.0`, `getTransformedRoutes`: `cleanUrls`/`trailingSlash` → `redirects` → `headers` → `{ handle: 'filesystem' }` → `rewrites`; in the vercel.json documentation — "`redirects` are always processed before `rewrites`" and "precedence is given to the filesystem prior to rewrites being applied"): **a redirect fires before a file**, a file — before a rewrite. Therefore a redirect's `source` must not match a build file (generator test §2.9).

| Host | Project | What it serves |
|---|---|---|
| `app.chipin.one` (prod), `app-dev.chipin.one` (dev), `*.vercel.app` (app preview) | app | `dist` files (shell, assets, `sw.js`, `manifest.webmanifest`, `.well-known/assetlinks.json`), SPA rewrites from the manifest → `/app.html` (04-5a → `/index.html`), `/api/:path*` → backend (`api.chipin.one` / `api-dev.chipin.one`), `X-Robots-Tag: noindex, nofollow` |
| `chipin.one` (prod), `site-dev.chipin.one` and `dev.chipin.one` (dev), `*.vercel.app` (site preview) | site; `chipin.one` and `dev.chipin.one` — from cutover, before it they belong to the app project (§4.5) | Astro static, the redirects of §4.2, the kill-switch `/sw.js`, `.well-known/assetlinks.json`, `/api/stats` → `api.chipin.one/stats` (dev — `api-dev.chipin.one`) for the landing statistics with headers `Cache-Control: private, no-store` and `X-Vercel-Enable-Rewrite-Caching: 0`, like `/api/(.*)` of the app project (no CDN cache, as now), `404.astro` for an unknown path |

- There are no external rewrites between the projects: the app project does not know the site host, the site links to the app only by absolute URLs with `PUBLIC_APP_ORIGIN` (§4.4), the app to the site — through `getSiteOrigin()` (§2.1). The D20 catch-all and the external rewrite cache (A-34) are not needed.
- `/api` on the app host is a same-origin proxy, as now. The backend refresh cookie is `__Host-` with `Path=/` (`Cookies.kt`), so it is host-only by construction: set in a response of `app.chipin.one/api/…`, it lives only on `app.chipin.one`, and no site response sets it. Users who signed in on `chipin.one` before cutover keep the previous host-only cookie of `chipin.one` in the browser (up to 30 days); the site rewrite `/api/stats` passes it to the backend with the request. This is safe: `/api/stats` is a public endpoint and does not read the cookie, and the neutral schema of `hosting.base.json` cannot strip the `Cookie` header on a rewrite. Check (criterion 7): `Set-Cookie` of the sign-in and refresh responses on `app.chipin.one/api/…` has the `__Host-` prefix and no `Domain=`; no response of the site hosts contains `Set-Cookie`.
- Cookies and `localStorage` do not move: `app.chipin.one` has its own origin. Every user signs in again once; drafts and the saved theme and language from the old origin are not carried over (theme and language come from the profile after sign-in, `useSyncUserSettings`). Data on `chipin.one` (IndexedDB, `localStorage`) stays in the browser and is read by no one.
- The outbox of spec 03 is stored in the IndexedDB of its origin. Therefore cutover is done before the offline write is enabled in prod (flag 03-17): otherwise operations not sent from `chipin.one` by the time of the switch will not reach `app.chipin.one`.

#### 4.2 Redirects of old URLs (site project; Vercel preserves the query string)

They apply on the site hosts: `chipin.one` → `appOrigin` = `https://app.chipin.one`; `dev.chipin.one` and `site-dev.chipin.one` → `https://app-dev.chipin.one` (§1.5a). Generated into `apps/site/legacy-redirects.generated.json` (§2.9).

| Old URL on `chipin.one` | New URL | Source |
|---|---|---|
| `/group/join/:token` | `/join/group/:token` (site landing) | fixed, **before** the `/group/*` rule |
| `/friends/join/:token` | `/join/friend/:token` (site landing) | fixed, before `/friends` |
| `/dashboard`, `/dashboard/:path*` | `<appOrigin>/dashboard`, `<appOrigin>/dashboard/:path*` | manifest |
| `/solo…`, `/group/:path*`, `/friends…`, `/activity…`, `/settings…` | `<appOrigin>` + the same path | manifest |
| `/oauth/callback` | `<appOrigin>/oauth/callback` (with `?code&returnTo`) | manifest; keep indefinitely |
| `/not-found` | no redirect: `404.astro` with status 404 (a redirect to `/404` would give a soft 404 with 200, C3-23) | — |
| `/sitemap.xml` | `/sitemap-index.xml` | fixed |
| `/index.html`, `/app.html` | `/` | fixed (A-33: indexed variants of the current html entries) |
| `/manifest.webmanifest`, icons of the old manifest (`/pwa-*.png` etc.) | no redirect: 404 (old installs are not supported, D26) | — |
| `/`, `/privacy`, `/terms`, `/ru/…` | **unchanged** (200 from the site) | — |
| `/es/…`, `/pt-br/…`, `/pt-pt/…` (removed by #609) | permanent redirect to the English page (the site project keeps the rule) | — |

The status is `legacyRedirectStatus`: `302` until 04-5a, `301` from 04-5a (`"statusCode"` in Vercel; 301 rather than 308: all source requests are GET navigations, and old crawlers understand 301 better). 302 for the rollback window is needed because the browser caches 301 indefinitely: after a rollback (§4.5) `chipin.one` again serves the former pages, and the browser must follow the current rules of the app project, not the cached redirects of the site. There is no loop in either direction: the compat redirects of the app project lead to the app host, not back to `/group/join/<t>` of the old host. Tabs opened before cutover that load old `/assets/*` from `chipin.one` get a 404 on the chunk; after reloading the page they hit a redirect from this table (C3-22).

The compat redirects of the app project (§1.5a; from 04-2g to 04-5a) apply only on `chipin.one`/`dev.chipin.one` while these hosts belong to the app project (before cutover and after a rollback): `/join/group/:token` → `<app host>/group/join/:token`, `/join/friend/:token` → `<app host>/friends/join/:token` (`chipin.one` → `https://app.chipin.one`, `dev.chipin.one` → `https://app-dev.chipin.one`), 302. They make the new invite links work before cutover and after a rollback and immediately lead new members to the app host, so that they do not sign in or create local data on the old origin.

#### 4.3 Indexing

- App project: the header `X-Robots-Tag: noindex, nofollow` on `/(.*)` for the hosts `app.chipin.one`, `app-dev.chipin.one`, and `*.vercel.app` (§2.9). The app host is in neither the sitemap nor canonical.
- The site's `robots.txt`: `Disallow: /api/`, `Disallow: /join/`; the old `Disallow` entries for `/dashboard` and the like are removed, because there is now a redirect there.
- The dev hosts of the site (`site-dev.chipin.one`, `dev.chipin.one`) and the site preview get `X-Robots-Tag: noindex, nofollow` by host (`apps/site/hosting.base.json`), `chipin.one` — no. There is no proxy, so the host condition is unambiguous (A-33 withdrawn by D26; there is no duplicate host `site.chipin.one`).
- Check in the criteria: on prod `curl -I https://app.chipin.one/dashboard` shows `X-Robots-Tag`, `https://chipin.one/ru/` — `200` without noindex.

#### 4.4 OAuth

- `redirect_to` does not change in the code: `<origin>/oauth/callback?returnTo=<path>` (`src/helpers/url.ts:28-44`); on the app host the origin = `https://app.chipin.one` (dev — `https://app-dev.chipin.one`). `returnTo` is an app path, as now; `resolveOAuthReturnTo` (`src/helpers/url.ts:7-26`) does not change.
- Backend: the allowlist checks only the origin (`OAuthRedirectValidator.kt:21-27`). The new origin must be added (BE-04-2): `OAUTH_ALLOWED_REDIRECT_ORIGINS` on prod contains `https://app.chipin.one`, on dev — `https://app-dev.chipin.one`; `https://chipin.one` and `https://dev.chipin.one` stay until 04-5a (the rollback target). The same for CORS: `CORS_ALLOWED_ORIGINS` on prod gets `https://app.chipin.one`, on dev — `https://app-dev.chipin.one`; the old origins also stay until 04-5a. `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` and `CORS_ALLOWED_VERCEL_PREVIEW_PROJECTS` are bound to the Vercel project name, so the app project is **not to be renamed**; the site project does not initiate OAuth. Google Console is not affected: the backend's callback is registered in Google, not the frontend's (`OAuthPlugin.kt:28-36`). The example in OpenAPI (`OAuthOpenApi.kt:30`) is already `https://app.chipin.one/oauth/callback` and matches the target URL (BE-04-1 withdrawn).
- Logins at the moment of the switch: the backend will return the user to `https://chipin.one/oauth/callback?code=…`, the site redirect (§4.2) will send them to `https://app.chipin.one/oauth/callback?code=…`, `code` and `returnTo` are preserved. If, after BE-01-1, the one-time code is bound to the browser via a cookie of the old origin, the exchange on the new origin will not pass, and the user simply signs in once more.
- From the site, the buttons "Sign in/Get started" and "Open ChipIn" are links `${PUBLIC_APP_ORIGIN}/login?locale=<locale>` and `${PUBLIC_APP_ORIGIN}/login` (A-42; from 04-5a the second is `${PUBLIC_APP_ORIGIN}/`, §3.6). `PUBLIC_APP_ORIGIN` is an env of the site project: prod `https://app.chipin.one`, dev and preview `https://app-dev.chipin.one`. The `/join/*` button uses the same origin. The app calls `getSocialAuthUrl` with `locale` for registration (`url.ts:39-41`, `resolveRegistrationLocale` reads `?locale` instead of the public path).

#### 4.5 Cutover: moving the domains and rollback

Cutover is not a PR with a switch, but owner actions in Vercel per the runbook in `DEPLOYMENT.md` (section "Domains and rollback", PR 04-4). By this moment the code already works on both hosts.

Preconditions:
1. BE-04-2 is done on prod and dev: the new origins are in `OAUTH_ALLOWED_REDIRECT_ORIGINS` and `CORS_ALLOWED_ORIGINS`.
2. 04-2g in prod; the domains `app.chipin.one` (Production) and `app-dev.chipin.one` (`master`) are added to the app project. Smoke on `app.chipin.one`: Google sign-in, `/api`, deep link `/group/<uuid>`, offline reload of `/dashboard` from precache, `Set-Cookie` refresh — `__Host-`, without `Domain` (§4.1). From this moment the app works on both hosts in parallel.
3. The site project in prod (Promote) with 04-3b1, 04-3b2, 04-3c, and 04-3d; dev check on `site-dev.chipin.one`.
4. The offline write (flag 03-17) is not yet enabled in prod (§4.1).

Steps:
1. Rehearsal on dev: remove `dev.chipin.one` from the app project and add it to the site project on the branch `master`. Check on `dev.chipin.one` criterion 7 in its dev variant (redirects to `app-dev.chipin.one`, kill-switch, one CSP).
2. Prod: remove `chipin.one` from the app project and add it to the site project as the Production domain. DNS records do not change (the zone is on Vercel, both projects are in the same team). Right after — criterion 7 on prod.
3. 48 h of monitoring against the rollback criterion; 04-5a/b — no earlier than after 7 days without a rollback.

There are no merge freeze windows or Promote ban (C1-07 and A-03 withdrawn by D26): rollback does not depend on which app project deploy is currently in Production. Until 04-5a any prod build of the app project can serve the public pages on `chipin.one` (transitional routes §2.2, compat redirects §4.2).

Rollback (minutes):
- Return the domain: remove `chipin.one` (or `dev.chipin.one`) from the site project and add it back to the app project (Production or `master`). `chipin.one` again serves the former landing, prerender, and app; the app project registers its `/sw.js` again, because the kill-switch on `chipin.one` is no longer served. `app.chipin.one` keeps working.
- There are no cached 301s: the site's redirects until 04-5a are 302 (§4.2). The new invite links `chipin.one/join/group|friend/<t>` after a rollback are handled by the compat redirect of the app project.
- Rollback criterion: a rise of 404 or 5xx on `chipin.one` or `app.chipin.one` > 1 % per hour, an OAuth login error, the site is unavailable.
- After 04-5a a rollback by moving the domain is impossible: 04-5a removes the public pages from the app project, so it goes only after 7 days without a rollback.

#### 4.6 Links that live outside the app

- The backend does not generate frontend URLs. A grep over `chipin-backend/src/main` found: no emails, push, or Telegram, invite responses contain only a token. The only mention is the example in OpenAPI `OAuthOpenApi.kt:30` (`https://app.chipin.one/oauth/callback`); it already matches the new host.
- Invite links that were already sent (`chipin.one/group/join/<t>`, `chipin.one/friends/join/<t>`) are covered by the redirects of §4.2. Keep indefinitely.
- Bookmarks to `chipin.one/<app path>` lead by redirect to `app.chipin.one`; PWAs installed before the move (`start_url: '/'` on `chipin.one`) open the site online, offline is not guaranteed (D26, §2.11).
- `assetlinks.json` (namespace `web`): `chipin.one`, `dev.chipin.one`, `app.chipin.one`, `app-dev.chipin.one`; the same copy in the app and site projects (§2.1).

### 5. What is removed from the app after cutover

- `src/root.tsx`: the `data-public-ssg` branch and `hydrateRoot(PublicApp)`. The entry is only `createRoot` → `RouterProvider`.
- `src/public-routes/**` entirely: `PublicApp`, `PublicContent`, `PublicEffects`, `PublicTelemetry`, `PublicLanguageLinks`, `PublicBuildYearContext`, `entry-server.tsx`, `internal/useConnect.ts`, and tests.
- `src/features/routing/**`: `AppRouter`, `PublicLocaleRoute`, `ProtectedRoute`, `HomeRouteGuard`, `SoloRouteGuard`, `internal/useConnect.ts` → replaced by `src/app/router/**`.
- `src/constants/publicRouteManifest.ts`, `constants/publicRoutes.ts`, `helpers/publicRoutes.ts` (except `getLastAccountLandingPath`, which moves to `app/auth`), `types/publicRoutes.ts`, `constants/seo.ts` (if there are no other consumers), `ROUTE_META`, `ROUTES.PRIVACY`, `ROUTES.TERMS`, `useRoutesMeta`.
- `pages/HomePage.tsx`, `PrivacyPage.tsx`, `TermsPage.tsx`, `LegalPages.test.tsx`, `features/landing/**`, `store/landing-stats-store/**`, `api/statsApi.ts` (if there are no other consumers).
- `scripts/prerender-public.mjs`, `prerender-before-workbox.*`, `verify-public-precache.mjs`, `private-spa-navigation.*`, `addPublicDirectoryAliases`, `integration.beforeBuildServiceWorker` in `vite.config.ts`, the scripts `prerender:public` and `verify:public-precache`, and also their calls in `build` and `vercel-build`.
- The second html entry: `index.html` (public) is removed, `app.html` is renamed to `index.html`. `rolldownOptions.input` is one.
- Duplicates: the second `<Toaster>` and `BackendUnavailableGate` from `PublicContent`, theme and language setup in `root.tsx` and `PublicEffects`, `helpers/swUpdates.tsx`, `basics/PWABadge.tsx`, `public/robots.txt`, `public/sitemap.xml` (they move to the site). `next-themes` is already removed by this point in 05-3 (D14).
- Lint check: after the removal `knip` finds no unused exports from the listed modules.

### 6. ds-gallery

**Decision: it stays in `apps/app/ds-gallery/`.** The gallery renders the real app components (`basics/*`, `components/*`) through aliases to `src/*` (`ds-gallery/vite.config.ts`). A separate `apps/ds-gallery` would require extracting these components into a package (`packages/ui`), which is a separate large refactoring outside D7. The gallery types are checked in the app's `typecheck` (D13). Revisit when `packages/ui` appears.

## Nuances and pitfalls

- **The kill-switch on `chipin.one` is mandatory (D26).** Without it the old SW with scope `/` will keep serving the old `index.html` from precache on `/` and the old prerender pages, and the user will not see the site until the SW updates. The kill-switch must be in the site's prod deploy **before** the domain move (04-3d, precondition 3 of §4.5); keep for at least 6 months.
- **Installed PWAs.** Old installs on `chipin.one` are not supported (D26): online they open the site, offline launch is not guaranteed, no banner. New installs are from `app.chipin.one` (`start_url`, `scope`, `id` = `/`).
- **One re-sign-in.** The refresh cookie is host-only for `app.chipin.one`, `localStorage` does not move (§4.1). The message to users is at the owner's discretion, the code shows nothing special.
- **`getEnv()` and the new hosts.** Without the `ENV_URLS` edit (04-2g), `app-dev.chipin.one` without `VITE_CHIPIN_ENV` crashes at startup (§2.1).
- **Redirect order**: `/group/join/:token` must come before `/group/:path*`. The generator test checks the order.
- **The app preview deploy** links to the site `site-dev.chipin.one`, the site preview — to `app-dev.chipin.one`. For PRs that change both apps, each project is checked on its own preview URL.
- **Telemetry/Sentry**: app paths do not change, so the token masking templates in `src/constants/telemetry.ts` stay as they are (`/group/join/:inviteToken`, `/friends/join/:inviteToken`); the `/join/*` token is redacted in the site analytics (§3.6). The transition from the landing to the app goes with `Referrer-Policy: no-referrer`, so the token does not end up in the app's Referer.
- **`vi.mock('…')` by string paths** break when moved to `src/app/router`. Move together with the tests in one PR.
- **The D1 hotfix** (stop spinner of `PublicLocaleRoute`, PR 01-3) is done on the current code **before** this spec. Its test is removed together with `PublicLocaleRoute` in 04-5a.

## Future extension

- URL mode for modals (#412): `?modal=<id>&step=<step>` via `useSearchParams` in `ModalHost` and `push` to history, so that the Back button on Android closes a step. The manifest gets a field `modals?: ModalId[]` (allowed on the route) and a check in the generator test.
- `useBlocker` for a dirty expense draft when leaving the page.
- Hover/viewport prefetch of chunks: `preloadRoute(id)` calls `ROUTE_MODULES[id]()` on `pointerenter` of NavButton.
- Site: OG images at build time (`satori`), JSON-LD, use-case pages (#147) in the `help` collection.
- `packages/ui`, if the site needs app components. Then `apps/ds-gallery` becomes possible.
- Turborepo — when CI for the two apps becomes longer than 10 minutes.

## What we do NOT do

- We do not move the app to SSR or RR framework mode: the app is private, noindex, offline-first.
- We do not use RR actions and `<Form>` for mutations (the single path is spec 03).
- We do not introduce a locale prefix in the app URL.
- We do not render a group preview on `/join/*` (a public API is needed; a separate owner decision).
- We do not do Next.js and do not put the site and the app into one Vercel project.
- We do not proxy one project through another and do not set cookies on `.chipin.one`: there is no shared session of the site and the app (D26).
- We do not support PWAs installed on `chipin.one` before the move: no reinstall banner and no offline guarantee (D26).
- We do not touch `ModalRouter`.

## Phases / PRs

Dependencies: 04-0a after the merge of FE#497 (both change `.github/workflows`) and after the D1 hotfix. PR ≤ ~400 lines of diff, renames and generated files (`vercel.json`, `routing.generated.ts`) count as 0. The group `04-2a1–a4` is mentioned in other specs as "04-2a" (completion of the group = 04-2a4); "04-0" = 04-0a.

| PR | Content | Depends on | In parallel with |
|---|---|---|---|
| 04-0a | Mechanical move into `apps/app` + root workspace (§1.6 items 1–5, 7) by the script `scripts/move-to-workspace.sh`; the version scripts compute the root from `import.meta.dirname`, prod version = plain `x.y.z` (§1.2). At merge time the owner sets Root Directory = `apps/app` | FE#497 (cutover to master done, `e6d2f2e`), 01-1…01-3; recommended 02-C2c and 02-C5 | — (freezes paths for an hour: open PRs rebase, git recognizes the rename itself) |
| 04-0b | Replace paths `src/` → `apps/app/src/` in `AGENTS.md`, `CLAUDE.md`, `docs/**`, `DEPLOYMENT.md` (§1.6 item 6) | 04-0a | 04-1a, 04-1b |
| 04-1a | `packages/i18n-content` (locales + common + `loadCommon`, §2.10) + the package `tsconfig.json`. `packages/tokens` is **not** created here — it is done entirely by 05-2 | 04-0a | 02, 03, 05-2 |
| 04-1b | CI: modes `docs-only\|app\|site\|full` in `ci-gate-policy.mjs` + tests, conditional steps in the job `frontend-ci`, release-QA artifact paths (§1.4) | 04-0a | 04-1a |
| 04-2a1 | The manifest `routeManifest.ts` (including the transitional ids of §2.2) + `routeModules.ts` + `route.ts` per page (named `Component`); the router is still the old one, `route.ts` is imported by no one yet, except the test "every id has a module" | 04-0a (i18n-content is not needed, C2-14) | spec 03, 04-1a |
| 04-2a2 | `createAppRouter(queryClient)` + `RootLayout`/`InternalLayout`, `hydrateFallbackElement`, `main.tsx` on `RouterProvider` without `BrowserRouter`; routes 1:1 with the current ones, guards for now are the current `ProtectedRoute`/`SoloRouteGuard` as element. **Without** `basename` (`ROUTER_BASENAME = '/'`); the transitional public ids (§2.2) via `PublicLocaleRoute`. If 03-7a is not merged yet — a stub `src/shared/offline/restore.ts`: `export const restoreReady: Promise<void> = Promise.resolve();` (03-7a changes the implementation, not the path or the name; C1-08, C2-09) | 04-2a1, **03-5** (`queryClient`, `onlineManager`, `isNetworkUsable`) | spec 03 (loaders without prefetch for now) |
| 04-2a2b | `AuthLayout` (`requireSession` per the table of §2.3, `errorElement`, hiding the page under `AuthModal`) + `SoloGuardLayout` (until 03-9 — `users-store`, §2.3), `session.ts` from `useCheckSignIn` (`authReady` with a 5 s timeout); unauthenticated — as now (04-2f switches to `/login`); move of the guard tests | 04-2a2 | 04-2c, 04-2d |
| 04-2a3 | `RouteErrorView` + `errorElement` on the root, `AuthLayout`, and `InternalLayout`, `ScrollRestoration`, `handle.meta` + `useDocumentTitle` instead of `useRoutesMeta` for app routes | 04-2a2b | 04-2c |
| 04-2a4 | Removal of the old router: `AppRouter`, `ProtectedRoute`, `HomeRouteGuard`, `SoloRouteGuard`, `internal/useConnect.ts`, and their tests (`PublicLocaleRoute` lives until 04-5a) | 04-2a3 | 04-2b |
| 04-2b | Artifact generator + sync test; `vercel.json` and the allowlist become generated from `hosting.base.json` (schema §1.5a; the content is semantically the same as now) | 04-2a1 | 04-3a |
| 04-2c | Lazy i18n (`loadCommon`) + `setAppLanguage` + key parity (the sole owner of lazy-loading of locales) | 04-1a | 04-2b, 04-3a |
| 04-2d | `pwa.config.ts` (`buildPwaOptions`, `APP_SHELL`, the table of §2.11) + `pwa.config.test.ts`, `vite.config.test.ts` (`base === '/'`); a single registration of `/sw.js` with scope `/` (as now) + the update policy (items 1–3; the screen of item 4 behind a flag until BE-03-5); removal of `serviceWorkerRecovery.ts`, `swUpdates.tsx`, `PWABadge.tsx` | 04-2a2 | 04-2c |
| 04-2h | Playwright: `@playwright/test` in the devDependencies of `apps/app`, `apps/app/e2e/sw.spec.ts` (scenarios of criterion 5), workflow `e2e-sw.yml` (`workflow_dispatch` + PRs that change `apps/app/src/app/pwa/**`, `pwa.config.ts`, `apps/site/public/sw.js`; not a required check, `BASE_URL` = the PR's preview deploy) (C1-25, C2-19) | 04-2d; the kill-switch scenario — after 04-3d | 04-2e, 04-2f |
| 04-2e | Loaders with prefetch by the factories of spec 03 | 04-2a4, 03-5, and the migration PRs of the corresponding stores (03-8…03-12) | — |
| 04-2f | Cutover preparation, part 1 (path-agnostic): the `login` screen on `/login` (`?returnTo`, `?locale`), `requireSession` → `/login`; `SITE_PATHS` instead of `ROUTES.HOME/PRIVACY/TERMS` + lint (§2.1) | 04-2a4 | 04-2g |
| 04-2g | App host (D26): `ENV_URLS` (`appHostnames`, `siteOrigin`) + `getSiteOrigin()` + `env.test.ts` (§2.1); `SITE_PATHS` absolute; invite links `${getSiteOrigin()}/join/group\|friend/<t>` (§3.5); `apps/app/hosting.base.json`: hosts `app.chipin.one`/`app-dev.chipin.one` + `legacyProd`/`legacyDev`, `X-Robots-Tag` by host, compat redirects `/join/*` (302) from the former hosts to the app host (§1.5a, §4.2); `assetlinks.json` + app hosts. After the merge and Promote the owner adds the domains `app.chipin.one`/`app-dev.chipin.one` to the app project (precondition 2 of §4.5) | 04-2a4, 04-2d, 04-2f, 04-3c, BE-04-2 | 04-3b1, 04-3b2 |
| 04-3a | `apps/site`: Astro skeleton (`astro@^7.4`, `content.config.ts`), i18n + parity test, BaseLayout, 404, robots, sitemap, seoGuard, `astro check`, `noindex` for dev hosts; creation of `chipin-site` with the release model of §1.5 (owner); deploy to `site-dev.chipin.one` | 04-1a, 04-1b, 05-2a | 04-2* |
| 04-3b1 | Site: home page (en, ru) — parity of `<title>`/description and of the `landing.json` texts; theme-init from 05-3; the "Sign in"/"Open ChipIn" buttons to `PUBLIC_APP_ORIGIN` (§4.4); rewrite `/api/stats` for the landing statistics with `no-store` headers (§4.1) | 04-3a, 05-3 | 04-2*, 04-3b2 |
| 04-3b2 | Site: legal collection privacy/terms × 2 locales + a text parity test: the normalized text of the old `PRIVACY_SECTIONS`/i18n versus the text of the built HTML for each locale (C2-35) | 04-3a | 04-2*, 04-3b1 |
| 04-3c | Site: `/join/group`, `/join/friend` (no analytics + `beforeSend` redaction in `BaseLayout`, the button to `PUBLIC_APP_ORIGIN`) + a token regex equality test | 04-3a, 01-2 | 04-3b1, 04-3b2 |
| 04-3d | Site, the compatibility layer for `chipin.one`: kill-switch `apps/site/public/sw.js` + `swKillSwitch.test.ts` + `Cache-Control: no-cache` (§3.6); redirects of old URLs §4.2 from `legacy-redirects.generated.json` (generator §2.9, `legacyRedirectStatus: 302`); `.well-known/assetlinks.json`. Promote of the site to prod before 04-4 | 04-2b, 04-3a | 04-3b1, 04-3b2, 04-3c |
| 04-4 | **Cutover — moving the domains** (§4.5): a PR with the runbook in `DEPLOYMENT.md` (section "Domains and rollback": preconditions, steps, rollback criterion and steps); after the merge the owner moves `dev.chipin.one`, then `chipin.one` to the site project and verifies criteria 7 and 9 | 04-2g (in prod, app domains added), 04-2h, 04-3b1, 04-3b2, 04-3c, 04-3d (in prod), BE-04-2; before 03-17 in prod | — |
| 04-5a/b | Removal (§5) in two PRs: (a) public-routes + prerender + scripts, the transitional manifest ids and the `home` index (§2.2), `APP_SHELL = 'index.html'` (renaming `app.html`), the hosts `legacyProd`/`legacyDev` and the compat redirects from `apps/app/hosting.base.json`, `chipin.one`/`dev.chipin.one` from `ENV_URLS`, `legacyRedirectStatus: 301` in `apps/site/hosting.base.json`; (b) landing/legal pages, store, duplicates | 04-4 + 7 days without a rollback | specs 02, 05 |

Cutover rollback is moving the domain back to the app project (§4.5). There is no rollback target as a separate deploy, no Instant Rollback, no merge freeze window, and no "no Promote for 48 h" rule (A-03, C1-07 withdrawn by D26).

## Tests / acceptance criteria

1. 04-0a: everything from §1.6 (tests 1230/1230, the same `dist` composition, one `APP_VERSION` from the root and from `apps/app`, smoke on preview). Resolver test: a prod build from `master` (`VERCEL_ENV=production`) gives `x.y.z` without a suffix.
2. `generate-routing-artifacts.test.ts` is green. A manual change of `vercel.json` without the generator fails CI.
3. Unit (RTL with `createMemoryRouter` on top of the manifest):
   - unauthenticated on `/dashboard` → `/login?returnTo=%2Fdashboard`;
   - an expired session on `/group/:id` shows `AuthModal`, the page stays mounted;
   - `/solo` without access → `/dashboard`;
   - an invalid `groupId` → NotFound inside `InternalLayout`, navigation is visible;
   - a page render error does not hide the header;
   - a chunk load error → the update screen, auto-reload no more than once;
   - an open global modal closes on route change (as now);
4. i18n: the entry chunk has no locale JSON (size check: entry ≤ current minus 200 KB raw). `changeLanguage` outside `setAppLanguage` fails lint. The key parity test is green.
5. SW. `pwa.config.test.ts` — the table of §2.11; `vite.config.test.ts` — `base === '/'`. 04-2d (C2-01): the built `dist/sw.js` — registration of `/sw.js` with scope `/`, allowlist = the current one, `navigateFallback` = `app.html`, an offline reload of `/dashboard` serves the shell from precache. Kill-switch — `swKillSwitch.test.ts` (§3.6). E2E (Playwright, 04-2h): (a) on the app preview an offline reload of `/dashboard` serves the shell from precache, `navigator.serviceWorker.getRegistrations()` — one registration with scope `/`; (b) on the site preview (after 04-3d): create a cache with an arbitrary name and register `/sw.js` → after activation `getRegistrations()` is empty, `caches.keys()` is empty, the window is reloaded; (c) online `/` of the site — the site HTML, there are no SW registrations after load.
6. Site: `astro build` with `seoGuard` is green. The 15 public URLs return 200 with the same `<title>` and description as now (snapshot before/after). hreflang on every page points to all existing translations of that page (currently 5) and `x-default`. The sitemap has 15 URLs. JS on a page ≤ 30 KB gz.
7. After the domain move (§4.5; first `dev.chipin.one`, then `chipin.one`): every row of §4.2 is checked by `curl -sI` (status `302`, `Location` to `<appOrigin>` + the same path or to `/join/…`; `/not-found` → `404`); `/sw.js` — `200`, `Cache-Control: no-cache`, the body is the kill-switch; `https://app.chipin.one/dashboard` — `X-Robots-Tag: noindex, nofollow`, `https://chipin.one/ru/` — `200` without it. Google login works from the site (`/login?locale=`) and from the old `chipin.one/oauth/callback`; `Set-Cookie` of the sign-in and refresh responses on `app.chipin.one/api/…` — `__Host-`, without `Domain=`; the `chipin.one` responses (pages, redirects, `/api/stats`) have no `Set-Cookie` (§4.1). An old invite link `chipin.one/group/join/<t>` → landing → button → the confirmation screen on `app.chipin.one` → joining.
8. Owner QA, not a PR gate (C2-34): Lighthouse SEO and performance of the home page are not worse than the baseline; the baseline is recorded in FE#498 before 04-3b1 (the numbers are attached in FE#496).
9. One CSP per host (A-02): `curl -sI https://site-dev.chipin.one/join/group/x` shows exactly one `Content-Security-Policy` header with the site hashes, `https://app-dev.chipin.one/dashboard` — exactly one, the app CSP; the inline scripts theme-init, the `beforeSend` redaction, and `/join/*` execute (no CSP errors in the console). On prod — the same after the `chipin.one` move.
10. 04-2g in prod (before 04-4, this is also a check of the rollback target): `curl -sI https://chipin.one/join/group/x` → `302` `Location: https://app.chipin.one/group/join/x`; `https://chipin.one/` — `200` without `X-Robots-Tag`; `https://app.chipin.one/` and `/dashboard` — `200` with `X-Robots-Tag: noindex, nofollow`; Google sign-in on `app.chipin.one` works.
11. Site: `seoGuard` fails the build if HTML under `join/` contains `_vercel/insights` or `_vercel/speed-insights` (A-15); a fixture with invalid frontmatter fails `astro build` (A-14); `/join/*` chooses the locale by `navigator.languages` and passes `?locale` (C3-25); the home page has no redirect by `localStorage` (C3-18 withdrawn by D26, §3.6).
12. Deep links (C1-01): on the 04-2g preview and on `app.chipin.one` a reload of `/group/<uuid>` and `/activity/<uuid>` gives `200`, all JS/CSS assets of the page — `200` with `text/javascript`/`text/css`, the app is rendered.
13. ~~04-4 (C1-07): one commit between 04-3d and 04-4, freeze window~~ — withdrawn by D26: there is no freeze window (§4.5).

## Backend requirements

~~**BE-04-1**~~ — withdrawn (D26): the example `OAuthOpenApi.kt:30` is already `https://app.chipin.one/oauth/callback` and matches the target URL, no edits. Close issue chipin-backend#206 as not planned (coordinator action).
**BE-04-2 (P1, before 04-2g in prod).** On prod add `https://app.chipin.one` to `OAUTH_ALLOWED_REDIRECT_ORIGINS` and `CORS_ALLOWED_ORIGINS`, on dev — `https://app-dev.chipin.one`; leave `https://chipin.one` and `https://dev.chipin.one` in both lists until 04-5a (the rollback target, §4.5). `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` and `CORS_ALLOWED_VERCEL_PREVIEW_PROJECTS` — the name of the current app project, unchanged (the project is not renamed); the site project is not added there, it does not initiate OAuth. Confirm that the refresh cookie stays `__Host-` with `Path=/` (host-only, §4.1).
The minimum client version is not a separate issue: the contract of the new header `X-Client-Version` / response `X-Min-Client-Version` / 426 `CLIENT.OUTDATED` is set by BE-03-5 (spec 03 §7; verified: there is no API versioning in the backend, the FE does not send a version now). BE-03-5 includes `X-Min-Client-Version` in `Access-Control-Expose-Headers`. Mandatory before the outbox (03-17) is enabled.
~~**BE-04-3**~~ — withdrawn (C3-24): the app header `/api/(.*)` and the header `/api/stats` in `apps/site/hosting.base.json` set `Cache-Control: private, no-store` and `X-Vercel-Enable-Rewrite-Caching: 0`, so the backend's `public, max-age=300` has no effect; the landing statistics stay without a CDN cache, as now (§4.1). Close issue chipin-backend#208 as not planned (coordinator action).

## ADR: public site and routing (answer to FE#498)

**Status:** proposed, awaiting the owner's decision (D8 approved 2026-10-28, a formal entry in FE#498 after FE#497).

**Context.**
- The frontend is an SPA on Vite 8, React 19, and RR7 with a PWA and a custom SSG for 15 public URLs (#153).
- The SSG relies on the duplicate tree `PublicApp`, prerender via Vite SSR in a Workbox hook (`prerender-before-workbox.mjs`), and an MD5 precache check (`verify-public-precache.mjs`). There are 4 route lists synchronized by hand, and 4 places where the language is written (audit 02, findings 1–3).
- SEO growth (FE#147 use-case pages, FE#158 metadata, blog and help) requires many static localized pages with content in markdown.
- The app is private (noindex), offline-first (D2), and the code is written mostly by AI agents, so structure predictability matters (DECISIONS: goal 1).

**Options considered.**

| | (a) Status quo: Vite + custom SSG | (b) Next.js for everything | (c) RR7 framework mode (prerender) | (d) **Astro site + Vite SPA** |
|---|---|---|---|---|
| SEO capabilities | present, but every new page = edits to the manifest, prerender, precache, two trees | best (SSG/ISR, metadata API) | good (prerender, `meta`) | best for static: 0 JS, i18n routing, hreflang, sitemap, collections out of the box |
| Content (md/MDX) | no, texts in i18n JSON | via MDX plugins | manually | built in, with a schema |
| PWA/offline | works, but the SW shares scope with the public pages | App Router and SW offline for a private app conflict (RSC, server requests); `next-pwa` is not maintained | SPA mode is possible, but prerender and SW are again in one build | not affected: the app SW is `/sw.js` with scope `/` on its own host `app.chipin.one`, the site has no SW (D26) |
| Migration cost | 0 | high: rewrite routing, data layer, auth (in-memory token + Web Locks), styles (styled-components SSR), all tests | medium: move to `routes.ts` and route modules, the same prerender+SW tangle | medium: only 3 pages × 2 locales and a section; the app changes in the router (D6 is needed in any option) |
| Risk | grows with every SEO page | high, big-bang, conflict with D2/D3 | medium | low: the site is rolled out alongside, cutover and rollback are a domain move within minutes |
| CI/deploy | as now | one project, but a server runtime and functions | one project | two Vercel projects, path filters, two hosts with no rewrite between them |
| Maintenance | high (a custom pipeline that one person knows) | medium, frequent major changes | medium | low: two standard tools with documentation |
| Predictability for agents | low (two trees) | medium | medium | high: "marketing = `apps/site`, product = `apps/app`" |

**Decision.** Option (d): the public and SEO site on Astro (`apps/site`, static), the app stays an SPA on Vite and the RR7 data router (`apps/app`) on the subdomain `app.chipin.one` (D26). A monorepo on npm workspaces with shared `packages/tokens` and `packages/i18n-content`.

**Why the others were rejected.**
- (a): the cost of every SEO page and the source of bugs (duplicate trees, i18n, precache) only grow. FE#499 directly forbids parallel routing systems, and (a) already contains one.
- (b): server rendering gives no gain to a private noindex app, but breaks the offline-first model (D2, D3), requires rewriting auth and styles, and cannot be rolled out gradually (the DECISIONS mode: no feature freeze).
- (c): better than (a) on routing, but leaves the public pages and the PWA in one build and one SW scope, and gives no content system. D6 takes from RR7 only the data router — which is what the app needs.

**Consequences.**
- Pros: `PublicApp`, prerender, and the precache check are removed (§5); an SEO page is added by a markdown file; the app has a single source of routes with a test; JS on public pages is reduced to inline scripts.
- Cons: two UI stacks (Astro components and React). Only tokens and the `common` i18n are shared, so the header and footer have to be kept in two forms. Two origins: every user signs in again once, PWAs installed before the move are not supported. Two Vercel projects and a matrix deploy.
- Obligations: the kill-switch `/sw.js` on `chipin.one` for at least 6 months after cutover (D26); redirects of old URLs indefinitely; do not rename the app project (OAuth preview allowlist).
- Revisit: if the site needs personalized or server pages (for example, an invite preview with the group name), consider Astro `output: 'server'` for individual routes on Vercel, without changing the app.

## Open questions

1. ASSUMPTION: the backend does not send frontend URLs to users (no emails, push, or Telegram; grep of `chipin-backend/src/main` 2026-10-28). If there is an external channel (KB, bot, templates in Slack), its links must be added to §4.2.
2. ASSUMPTION: the backend refresh cookie stays `__Host-` with `Path=/` (host-only), and the prod and dev values of `OAUTH_ALLOWED_REDIRECT_ORIGINS`, `CORS_ALLOWED_ORIGINS`, `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS`, and `CORS_ALLOWED_VERCEL_PREVIEW_PROJECTS` in the backend environment match what §4.4 expects (the repo has only the default `http://localhost:3000`). Verified in BE-04-2 and the smoke of precondition 2 of §4.5.
3. Decided (D26, owner 2026-10-29): the app on `app.chipin.one` (dev `app-dev.chipin.one`), the site on `chipin.one` (dev `site-dev.chipin.one`); PWAs installed before the move are not supported; the kill-switch `/sw.js` on `chipin.one` for at least 6 months. D25 (SW `/app/`, kill-switch of the same origin, reinstall banner) is simplified by D26 and does not apply.
4. Decided (D19, option A, confirmed by the owner 2026-10-28): now — only a forced SW update after 24 h; before the outbox is enabled — BE-03-5 (`X-Client-Version` + `MIN_CLIENT_VERSION` → 426) and 03-20, the 72 h rule.
5. Decided (D18, confirmed by the owner 2026-10-28): Vercel Analytics and Speed Insights stay; isolated per §1.5a; leaving Vercel is a separate study.
6. Decided (D22, D26): subdomains `app`, `app-dev`, `site-dev`; the owner's plan is not Hobby (org project), custom domains are free and unlimited, DNS on Vercel. `site.chipin.one` is not needed.
