# Deployment API routing

The browser uses only the same-origin `/api/*` path for ChipIn backend traffic.
Vercel owns the deployment-to-backend mapping:

| Frontend host        | Runtime environment | `/api/*` backend               |
| -------------------- | ------------------- | ------------------------------ |
| `app.chipin.one`     | production          | `https://api.chipin.one/*`     |
| `app-dev.chipin.one` | development         | `https://api-dev.chipin.one/*` |
| `*.vercel.app`       | development         | `https://api-dev.chipin.one/*` |

All Vercel-generated domains are development surfaces, including the default
production `.vercel.app` domain. A production build opened through a
`.vercel.app` hostname is therefore treated as development at runtime so its
same-origin API traffic cannot reach production data. Only `app.chipin.one`
maps to the production API. The site hosts (`chipin.one`, `dev.chipin.one`, see
[Domains](#domains-and-rollback)) get no `/api/*` rule from the app project.

Vercel builds still require an explicit `VITE_CHIPIN_ENV` configuration: the
build-time guard in `apps/app/vite.config.ts` fails a Vercel production build
without it (and a preview build unless it is `dev`), as defined by #180. At
runtime an invalid value, an unknown host, or a `.vercel.app` host without the
variable fails closed. The app hostnames (`app.chipin.one`,
`app-dev.chipin.one`) resolve from `ENV_URLS` in
`apps/app/src/constants/env.ts` when the variable is absent (a build
without it served on those hosts; Vercel builds always set it, 04-2g). Custom `*.dev.chipin.one` branch domains are intentionally not
part of the deployment contract.

Sentry runtime reporting reads `VITE_SENTRY_DSN` from the deployment
environment. Configure it independently for the Vercel environments that should
send events. When the variable is absent or empty, runtime Sentry reporting is
disabled even if the build would otherwise enable telemetry. Vercel Git
integration builds use the normal Vercel environment configuration; only a
tagged production build (the automatic redeploy after the release tag) creates
the Sentry release and uploads source maps (see Build toolchain below).

`VITE_FEATURE_OFFLINE_WRITES` turns on offline expense writes through the
outbox (spec 03 §2.7) only when it is exactly `true`; it is unset (off) in every
environment until PR 03-17 enables it. Since 03-15b the outbox is persisted in
IndexedDB (`chipin:outbox:<userId>`, `chipin:outbox-failed:<userId>`). Since
03-15c1 every read-modify-write of the keys runs under a Web Lock
(`chipin-outbox-write:<userId>`), so concurrent appends from two tabs no longer
lose an op. Since 03-15c2 only the tab holding the drain lock
(`chipin-outbox-drain:<userId>`) sends the queue; the other open tabs append and
ping it over `BroadcastChannel('chipin-outbox:<userId>')`, so two tabs no longer
both drain. Offline writing also needs `BroadcastChannel`. Keep the flag unset
in every deploy, previews included, until 03-17 enables it (03-16a/03-16b come
first). Off, the outbox modules are loaded but inert: nothing of the outbox is
started, read or written, and no lock, channel or page listener is created
(only `clearUserData` deletes its keys, as before).

The blocking "App update required" screen (spec 04 §2.11 item 4) has no build
flag: the backend `MIN_CLIENT_VERSION` drives it (KB API-002, API-004,
API-006). Every request sends `X-Client-Version`; a 426 `CLIENT.OUTDATED` or an
`X-Min-Client-Version` above the build closes the outbox gate with the reason
`outdated` (the outbox is kept and sent by the updated version) and shows the
screen, whose button activates a waiting service worker or says the update is
not published yet. With `MIN_CLIENT_VERSION` unset nothing changes; only the
update policy (toast, forced update after 24 h at a safe point) is active.

Owner step before setting `MIN_CLIENT_VERSION` on the backend, and after every
production deploy while it is set: open the production app, Settings, "App
version", and confirm it is a real release `x.y.z`, not `0.0.0-dev-…` (the
fallback of `scripts/version-resolver.mjs` when the release tag lookup fails). A
`0.0.0` build is below any minimum and is blocked; redeploy it at once.

There is no unconditional external API rewrite. Unknown hosts therefore cannot
fall back to production.

For local development, Vite proxies `/api/*` to
`https://api-dev.chipin.one/*` and strips the local `/api` prefix before
forwarding the request.

All Vercel `/api/*` responses are marked `no-store` for both browser and CDN
caches. Keep these rules in sync with the auth transport decision in #151 and
the token lifecycle work in #163.

## Vercel delivery from `master`

Vercel is delivery only; the repository has no deploy workflow and no Deploy
Hook or Vercel token secrets
([#497](https://github.com/ChipIn-one/chipin-frontend/issues/497)).

| GitHub event             | Required gate             | Vercel                                                                                                     |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Pull request to `master` | `frontend-ci`             | Git integration Preview of the PR branch                                                                   |
| Merge (push) to `master` | `frontend-ci` on the push | Git integration Preview build of the exact `master` commit (dev env vars); `app-dev.chipin.one` follows it |
| Release                  | none in GitHub            | the owner runs **Promote to Production** on a chosen `master` deployment                                   |

- `master` builds are Preview deployments: the Vercel Production Branch stays
  `main` (Vercel rejects a non-existent branch), and `apps/app/vercel.json` disables Git
  deployments for `main`, so no push creates a production build.
  `app-dev.chipin.one` is attached to `master` and serves the Preview build with
  development environment variables.
- Production is always an exact `master` commit that was already built and
  served on `app-dev.chipin.one`. The owner opens that commit's deployment and runs
  **Promote to Production**; Vercel rebuilds the same commit with production
  environment variables and assigns `app.chipin.one`. Nothing in GitHub triggers it.
- Vercel records that production deployment as a GitHub Deployment,
  environment `Production`, creator `vercel[bot]`, with the commit SHA and a
  `success` status, written at Promote. Preview builds of `master` create only
  GitHub Deployments `Preview`. Since the second Vercel project `chipin-site` is
  connected (#797) the app's environments are `Production – chipin-frontend` and
  `Preview – chipin-frontend`; automation accepts both forms and never the
  site's ([release QA: Two projects](docs/engineering/release-qa.md#two-projects), #801). Verified at cutover step 7 of #497: Promote
  created Deployment `Production` 7254813070 by `vercel[bot]` on `e6d2f2e`
  (2026-10-22T14:24:47Z). That record is the production evidence for Issue
  completion (strategy `deployment-receipt`).
- After the release tag, `release-on-production.yml` (job `redeploy`,
  `scripts/redeploy-tagged-production.mjs`) redeploys the promoted deployment
  to Production once more, so the second build finds the tag on its commit and
  carries the in-app version and the Sentry release. It needs the repository
  secret `VERCEL_TOKEN` and the repository variables `VERCEL_TEAM_ID` and
  `VERCEL_PROJECT_ID`. If Production has moved to another deployment since the
  Promote (a newer Promote or a rollback), the redeploy is skipped with a
  warning and that tag stays without an in-app version until it is promoted
  again. If the job fails, redeploy by hand: Vercel → the Production deployment
  → **Redeploy**.
- A promoted untagged commit gets a tag only if its `.github/workflows/` equals
  the `master` tip: GitHub does not let `GITHUB_TOKEN` create a tag on a commit
  whose workflow files differ from the default branch (#838). If
  `.github/workflows/` of the chosen build differs from the `master` tip, the
  guard job fails with "its .github/workflows differs from the master tip" and
  release and redeploy are skipped; the untagged Production deployment stays
  live. Promote the `master` tip build instead (after a release QA round on it
  if needed, [release QA](docs/engineering/release-qa.md#owner-read-the-result-and-release)).
  A GitHub App token with the `workflows` permission would lift this limit
  (#838 option B); it is not built. The check runs only for builds that
  contain it (a `deployment_status` run uses the workflow file of the promoted
  commit): an older build still fails at the engine's tag step with a 403.
- The repository has no completion caller. The ChipIn-one/.github org sweep
  (`frontend-production-completion.yml`) runs `deployment-receipt` for the
  frontend (registry `capabilities.completion: automatic` since
  ChipIn-one/.github#217): PR merged into `master` → Issue `Awaiting release`
  → owner Promote → `forward-production-deployment.yml` sends the sweep a
  `repository_dispatch` (#559) and the Issue closes within minutes. If that
  dispatch is missing or fails, the next sweep run on a `.github` push or its
  GitHub-throttled schedule (observed every ~5–6 hours) closes it. FE Issues
  are never closed by hand; GitHub auto-close is off.
- `apps/app/vercel.json` keeps `git.deploymentEnabled` off for the retired `dev` and
  `main` branches. `dev` was deleted on 2026-10-22 (the owner cancelled the
  rollback window); `main` stays only as the Vercel Production Branch
  placeholder and receives no pushes. The Vercel Deploy Hooks and their
  secrets were removed.
- Preview access (QA of #497, 2026-10-27): the Preview deployment of `master`
  `39ee2dc` (Deployment 7310123775,
  `chipin-frontend-crscznela-sylliks-projects.vercel.app`), `dev.chipin.one` and
  `chipin.one` all answer an unauthenticated request with HTTP 200 and the
  ChipIn landing page, so Vercel Deployment Protection puts no login wall in
  front of QA on a selected Preview URL.

### Vercel configuration

The Vercel project remains connected to `ChipIn-one/chipin-frontend`.

- The Production Branch stays `main` with Git deployments disabled for it, so
  every `master` commit is a Preview build and production changes only through
  Promote.
- `app-dev.chipin.one` is attached to `master`.
- Preview (every `master` build, and PR branch builds) uses `VITE_CHIPIN_ENV=dev`.
- Production (the rebuild created by Promote to Production) uses
  `VITE_CHIPIN_ENV=prod`.
- Existing Sentry/runtime variables remain scoped to the environments where they
  are required.
- The site project `chipin-site` (`apps/site`, spec 04 §4.4) needs
  `PUBLIC_APP_ORIGIN`, the app origin of its buttons and invite landing:
  Preview `https://app-dev.chipin.one`, Production `https://app.chipin.one`. A
  Vercel build of the site fails while it is unset or not a bare `https` origin,
  so set both before the first site build that needs it (04-3c) and before
  Promote.

No paid custom Vercel environment is required.

### Build toolchain (#575)

- Node: `package.json` declares `engines.node: "24.x"`, matching the Vercel
  project Node.js Version setting `24.x`. Vercel selects the latest 24.x; CI
  workflows pin an exact 24.x patch for reproducibility. Change the major in
  `package.json`, the Vercel setting and the workflows together.
- npm install scripts: `allowScripts` in `package.json` is the reviewed policy.
  Allowed: `@sentry/cli` (fetches the `sentry-cli` binary used for source-map
  upload).
  Denied: `sharp` (prebuilt `@img/sharp-*` binaries cover supported platforms;
  the script only builds from source) and `fsevents` (macOS-only, ships a
  prebuilt binary). Review any new entry from
  `npm approve-scripts --allow-scripts-pending` before adding it.
- The npm warning `Unknown env config "cache-dir"` comes from the Vercel build
  image environment, not from this repository (no `.npmrc`, `apps/app/vercel.json` or
  project environment variable sets it). It is harmless and cannot be changed
  here.
- Sentry: the Rolldown runtime chunk (`assets/rolldown-runtime-*.js`) has no
  source map, so it is excluded from the Sentry upload via `sourcemaps.ignore`.
  Source maps stay `hidden` and are deleted from `dist` after upload.
- The Sentry release and source maps are created only by a tagged Vercel
  production build (`VERCEL_ENV=production` with a version tag on the commit:
  the automatic redeploy after the release tag). The Promote build is untagged
  and uploads nothing; preview, local and CI builds skip the upload and emit no
  source maps (`apps/app/scripts/sentry-sourcemaps.ts`).

### Rollback

Production rollback is a Vercel action independent of git: Instant Rollback, or
Promote of the previous production deployment.
Before rolling back past 04-5a, read [Domains and rollback](#domains-and-rollback).

## Domains and rollback

The app moved to its own host in two steps (spec 04 §4.5,
`docs/superpowers/specs/2026-10-28-frontend-refactor/04-routing-monorepo-site.md`):
step 1 (04-4a2) moved the app to `app.chipin.one` / `app-dev.chipin.one`, and in
step 2 (04-4b, done by the owner on 2026-11-26) the site project took
`chipin.one`. The domains are:

| Project           | Domains                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `chipin-frontend` | `app.chipin.one` (Production), `app-dev.chipin.one` (Preview, `master`)                                                     |
| `chipin-site`     | `chipin.one` and `www.chipin.one` (Production, no redirect), `dev.chipin.one` and `site-dev.chipin.one` (Preview, `master`) |

04-5a (owner decision 2026-11-27: the old hosts as app hosts have almost no
users) removed every move-era rule instead of switching it to `301`:

- `apps/app/vercel.json` has no rule for `chipin.one` or `dev.chipin.one`: no
  step-1 or `/join/*` compat redirects, no `/api` rewrites, no
  `/manifest.webmanifest` redirect and no `/sw.js` kill-switch rewrite. The
  app keeps the `/sw.js` → `/sw-app.js` rewrite, the `/api` rewrites of the app
  hosts and previews, the host-scoped catch-all to the shell, the locale `301`
  rows and its headers. The app code has no legacy-host gate, handoff or notice.
- `apps/site/vercel.json` no longer redirects old app URLs (`/dashboard`,
  `/oauth/callback`, …) to the app host, nor `/group/join/<t>` and
  `/friends/join/<t>` to the invite landing, nor `/app.html` to `/`: the old app
  paths and `/app.html` now answer the site's `404`. The site keeps its locale
  and trailing-slash `301` rows, `/sitemap.xml` → `/sitemap-index.xml`,
  `/index.html` → `/`, `/<page>/index.html` → `/<page>`, the
  `/join/group|friend/<t>` landing and the `/api/stats` proxy.
- The worker kill-switch is gone (the site's `/sw.js` and the app's
  `sw-kill.js`). An old app worker still registered on `chipin.one` stays (a
  failed update fetch keeps the active registration) and keeps serving its
  precache until the visitor clears the site data. The owner decision of
  2026-11-27 (the old hosts have almost no users) accepts this residual effect
  instead of the 6-month kill-switch window of spec 04 §3.6.

Only the app hosts are installable as the app: the site has no
`manifest.webmanifest`, no `<link rel="manifest">` and no
`mobile-web-app-capable` / `apple-mobile-web-app-*` metas (#758).

### Rollback of the domains

The domain move is not rolled back any more: since 04-5a the app project has no
rules for `chipin.one` and `dev.chipin.one`. Fix a broken build of either
project with an Instant Rollback of that project to its previous Production
deployment.

- Never make `www.chipin.one` a `307` to `chipin.one` while browsers may still
  hold the cached `308` `chipin.one` → `www.chipin.one` from step 2 of the move:
  the two redirects loop.
- Once the offline-write flag (03-17) is enabled in prod, the outbox lives in
  the IndexedDB of `app.chipin.one`: no change of the app domain without first
  disabling the flag and letting the outbox queues drain.
