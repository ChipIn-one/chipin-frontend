# Deployment API routing

The browser uses only the same-origin `/api/*` path for ChipIn backend traffic.
Vercel owns the deployment-to-backend mapping:

| Frontend host        | Runtime environment | `/api/*` backend               |
| -------------------- | ------------------- | ------------------------------ |
| `chipin.one`         | production          | `https://api.chipin.one/*`     |
| `dev.chipin.one`     | development         | `https://api-dev.chipin.one/*` |
| `app.chipin.one`     | production          | `https://api.chipin.one/*`     |
| `app-dev.chipin.one` | development         | `https://api-dev.chipin.one/*` |
| `*.vercel.app`       | development         | `https://api-dev.chipin.one/*` |

All Vercel-generated domains are development surfaces, including the default
production `.vercel.app` domain. A production build opened through a
`.vercel.app` hostname is therefore treated as development at runtime so its
same-origin API traffic cannot reach production data. Only `chipin.one` maps
to the production API (and `app.chipin.one`, see Domains and rollback).

Vercel builds still require an explicit `VITE_CHIPIN_ENV` configuration: the
build-time guard in `apps/app/vite.config.ts` fails a Vercel production build
without it (and a preview build unless it is `dev`), as defined by #180. At
runtime an invalid value, an unknown host, or a `.vercel.app` host without the
variable fails closed. The app and legacy hostnames (`app.chipin.one`,
`chipin.one`, `app-dev.chipin.one`, `dev.chipin.one`) resolve from `ENV_URLS`
in `apps/app/src/constants/env.ts` when the variable is absent (a build
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

| GitHub event             | Required gate             | Vercel                                                                                                 |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Pull request to `master` | `frontend-ci`             | Git integration Preview of the PR branch                                                               |
| Merge (push) to `master` | `frontend-ci` on the push | Git integration Preview build of the exact `master` commit (dev env vars); `dev.chipin.one` follows it |
| Release                  | none in GitHub            | the owner runs **Promote to Production** on a chosen `master` deployment                               |

- `master` builds are Preview deployments: the Vercel Production Branch stays
  `main` (Vercel rejects a non-existent branch), and `apps/app/vercel.json` disables Git
  deployments for `main`, so no push creates a production build.
  `dev.chipin.one` is attached to `master` and serves the Preview build with
  development environment variables.
- Production is always an exact `master` commit that was already built and
  served on `dev.chipin.one`. The owner opens that commit's deployment and runs
  **Promote to Production**; Vercel rebuilds the same commit with production
  environment variables and assigns `chipin.one`. Nothing in GitHub triggers it.
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
- `dev.chipin.one` is attached to `master`.
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
Before rolling back past 04-4a2, read [Domains and rollback](#domains-and-rollback).

## Domains and rollback

The app moves to its own host in two steps (spec 04 §4.5,
`docs/superpowers/specs/2026-10-28-frontend-refactor/04-routing-monorepo-site.md`).
Step 1 (04-4a2) is below; step 2 (the site takes `chipin.one`, 04-4b) follows
in [Step 2: the site takes `chipin.one`](#step-2-the-site-takes-chipinone).

Neither step makes `chipin.one` or `dev.chipin.one` installable as the app
(#758). In step 1 the legacy hosts serve no manifest and no web-app metas and
show the standalone notice (below). 04-4b must keep the site the same way: no
`manifest.webmanifest`, no `<link rel="manifest">`, no `mobile-web-app-capable`
/ `apple-mobile-web-app-*` metas, and a notice pointing to the app host when the
site runs in standalone mode (an icon installed from `chipin.one` before step 1,
or any icon iOS 26+ makes from a Home Screen bookmark). Only the app hosts are
installable.

### Step 1: the app moves to `app.chipin.one`

After 04-4a2 the existing app project serves both host groups from one build:

| Host                                          | Serves                                                                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.chipin.one`, `app-dev.chipin.one`        | the app, `/api/*` → `api.chipin.one` / `api-dev.chipin.one`, the app worker at `/sw.js`, `X-Robots-Tag: noindex, nofollow`                                    |
| `*.vercel.app` (previews)                     | the same as the app hosts, `/api/*` → `api-dev.chipin.one`                                                                                                    |
| `chipin.one`, `dev.chipin.one` (legacy hosts) | today's landing (`/`, `/privacy`, `/terms`, `/ru/*`), the worker kill-switch at `/sw.js` (04-4a1), `302` of private paths to the app host, no manifest (#758) |

On the legacy hosts `/dashboard*`, `/solo*`, `/activity*`, `/settings*`,
`/group*`, `/friends*`, `/oauth*`, `/not-found`, `/login` and `/app.html` answer `302` to
the app host of the same environment (`chipin.one` → `app.chipin.one`,
`dev.chipin.one` → `app-dev.chipin.one`) with the same path and query. The
status stays `302` for the whole life of these rules. `/index.html` and every
`<path>/index.html` there answer `302` to the directory path of the same host
(`/index.html` → `/`, `/privacy/index.html` → `/privacy`, `/ru/index.html` →
`/ru`), and the full app never boots on a legacy host: if the SPA shell is
reached there anyway, `root.tsx` replaces the page with the same URL on the app
host. The landing there signs nobody in: its sign-in buttons open
`<app host>/dashboard`, and a visitor with a session hint who opens the home
page (`/`, `/ru/`) is sent there without any `/api` auth call; on `/privacy`,
`/terms` and their `/ru/` variants such a visitor stays and reads the page. The
session hint on the legacy host is never cleared (no auth call runs there), so a
former user opening `chipin.one/` always lands on the app host.

The legacy hosts are not installable as the app (#758). An icon installed from
`chipin.one` has scope `chipin.one/`, so its sign-in opened the app host in an
in-app sheet and the session never reached the icon. `/manifest.webmanifest`
there answers `302` to `/legacy-host-has-no-manifest`, which is neither a file
nor a rewrite and so answers `404` (Vercel runs the rewrites after the
filesystem, so a rewrite could not hide the existing file; the redirects run
before it). The HTML is shared with the app hosts, so `root.tsx` removes
`<link rel="manifest">`, `mobile-web-app-capable`,
`apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` on a
legacy host before anything renders (the icons stay); the landing there never
offers its install buttons. When the landing runs in standalone mode on a legacy
host (an old icon; since iOS 26 any Home Screen bookmark opens as a web app), it
hides every sign-in button, does not hand a visitor with a session hint to the
app host, and shows one notice: the icon is out of date, open `app.chipin.one`
(`app-dev.chipin.one` on dev) in the browser and add it to the Home Screen
again. Nothing of this applies to the app hosts, previews or localhost.

Preconditions:

- 04-4a1 (service worker host gate and kill-switch) is in Production.
- BE-04-2 is applied on dev and prod before the merge: `OAUTH_ALLOWED_REDIRECT_ORIGINS`
  and `CORS_ALLOWED_ORIGINS` contain `https://app-dev.chipin.one` (dev) and
  `https://app.chipin.one` (prod); the old origins stay.

Order (each app host exists, valid and with a certificate, before any redirect
points at it):

1. Owner: Vercel → the existing app project → Settings → Domains → add
   `app-dev.chipin.one`, Git branch `master`. Do not rename the project: the
   backend preview allowlists (`OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS`,
   `CORS_ALLOWED_VERCEL_PREVIEW_PROJECTS`) are bound to its name. DNS: if the
   `chipin.one` zone is on Vercel, the record is added automatically; if DNS is
   hosted elsewhere, add `CNAME app-dev` → `cname.vercel-dns.com` (the same for
   `app` in step 4).
2. Wait until Vercel shows `app-dev.chipin.one` with Valid Configuration and its
   certificate is issued, then merge 04-4a2 into `master`. Adding the domain
   before the merge is harmless: the host serves the current build, and nothing
   links to it yet.
3. Smoke on dev, the dev variant of criterion 10 below on `app-dev.chipin.one`
   and `dev.chipin.one`. Two checks are blocking gates for Promote:
   - `curl -sI 'https://dev.chipin.one/oauth/callback?code=x&returnTo=%2Fgroup%2F1'`
     → `302`, `Location: https://app-dev.chipin.one/oauth/callback?code=x&returnTo=%2Fgroup%2F1`
     (the same query; the config tests cannot prove that Vercel forwards it);
   - `curl -sI https://app-dev.chipin.one/dashboard` → `200`, no redirect (an app
     host never redirects to itself).
4. Owner: add `app.chipin.one` (Production) to the same project and wait until it
   shows Valid Configuration and its certificate is issued. As in step 2, adding
   it before the Promote is harmless.
5. Promote the `master` deployment to Production.
6. Smoke on prod (criterion 10 of spec 04):
   - `curl -sI https://chipin.one/dashboard` → `302`, `Location: https://app.chipin.one/dashboard`;
   - `https://chipin.one/oauth/callback?code=x&returnTo=%2Fgroup%2F1` → `302` with the same query;
   - `https://chipin.one/group/join/x` → `302` to `https://app.chipin.one/group/join/x`;
   - 04-2g invite links (once 04-2g is in the promoted build): `curl -sI 'https://chipin.one/join/group/x?locale=ru'` → `302`, `Location: https://app.chipin.one/group/join/x?locale=ru`; `https://chipin.one/join/friend/x` → `302` to `https://app.chipin.one/friends/join/x`; on dev `curl -sI 'https://dev.chipin.one/join/group/x?locale=ru'` → `302`, `Location: https://app-dev.chipin.one/group/join/x?locale=ru`, and `https://dev.chipin.one/join/friend/x` → `302` to `https://app-dev.chipin.one/friends/join/x`;
   - `https://chipin.one/`, `/privacy`, `/ru/`, `/robots.txt`, `/.well-known/assetlinks.json` → `200`, no redirect, no `X-Robots-Tag`;
   - `https://chipin.one/index.html` → `302` to `/` on the same host;
   - `https://chipin.one/sw.js` → `200`, `Cache-Control: no-cache`, the kill-switch body; `https://app.chipin.one/sw.js` → the app worker;
   - `curl -sIL https://chipin.one/manifest.webmanifest` → `302` to `/legacy-host-has-no-manifest`, then `404`; `https://app.chipin.one/manifest.webmanifest` → `200`, `Content-Type: application/manifest+json` (#758);
   - `https://app.chipin.one/` and `/dashboard` → `200` with `X-Robots-Tag: noindex, nofollow`; `https://app.chipin.one/api/health` → `200`;
   - `assetlinks.json` lists `chipin.one`, `dev.chipin.one`, `app.chipin.one`, `app-dev.chipin.one`;
   - on `app.chipin.one`: Google sign-in, a deep link reload (`/group/<uuid>`), an offline reload of `/dashboard` from precache, and `Set-Cookie` of sign-in and refresh with the `__Host-` prefix and no `Domain=`;
   - the landing sign-in on `chipin.one` opens `app.chipin.one`; a browser with a session hint opening `https://chipin.one/` makes no `/api/auth` request there and lands on `https://app.chipin.one/dashboard`; no `chipin.one` response sets a cookie.

Users sign in again once on the app host: the refresh cookie is host-only, and
local data of the old origin (drafts, theme, language) is not carried over.

OAuth at the moment of the switch: the backend may return a user to
`https://chipin.one/oauth/callback?code=…`, which the `302` forwards to the app
host with `code` and `returnTo`. chipin-backend#196 (BE-01-1, binding the
one-time code to the browser) is still open; if it lands before step 1, the
exchange on the new origin fails for such an in-flight sign-in and the user
signs in once more. The old-host callback smoke must then expect that extra
sign-in.

### Rollback of step 1

Rollback criterion: 404 or 5xx on `chipin.one` or `app.chipin.one` rising above
1 % per hour, an OAuth sign-in error, or the app host unavailable.

- Targeted (tens of minutes: a PR, CI and a Promote): a PR that deletes only the
  step-1 legacy redirects in `apps/app/vercel.json` (the `302` rows with a
  `chipin.one`/`dev.chipin.one` host condition) and the legacy-host changes of
  04-4a2 and #758 (`helpers/legacyHost.ts` users: `root.tsx`, `SignInEntry`,
  `PublicSession`, `useCheckPwa`, `useLegacyHostStandaloneAppHost`,
  `LegacyHostStandaloneNotice`), then Promote. For an immediate stop, use the full rollback
  below (Instant Rollback first, then remove the app domains; in the other
  order `chipin.one` keeps redirecting to a host that no longer resolves).
  The app hosts keep their `/api` rewrites, `X-Robots-Tag` and domains, so users
  already on `app.chipin.one` keep working; `chipin.one` serves the app again,
  online-only while 04-4a1 stays.
- A full revert of 04-4a2, or an Instant Rollback to a build before it, also
  drops the `/api` rewrites of the app hosts: do it only together with removing
  `app.chipin.one` and `app-dev.chipin.one` from the project.
- Once the offline-write flag (03-17) is enabled in prod, step 1 is not rolled
  back without first disabling the flag and letting the outbox queues drain:
  the outbox lives in the IndexedDB of `app.chipin.one`.

### Step 2: the site takes `chipin.one`

Done by the owner on 2026-11-26 (04-4b). The domains move from the app project
`chipin-frontend` to the site project `chipin-site` (Root Directory
`apps/site`); the DNS zone is on Vercel, so no record changes. After the move:

| Project           | Domains                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `chipin-frontend` | `app.chipin.one` (Production), `app-dev.chipin.one` (Preview, `master`)                                                     |
| `chipin-site`     | `chipin.one` and `www.chipin.one` (Production, no redirect), `dev.chipin.one` and `site-dev.chipin.one` (Preview, `master`) |

The site serves the old app URLs by the `302` rows of `apps/site/vercel.json`
(spec 04 §4.2 step 2; `302` until 04-5a): on `chipin.one` and `www.chipin.one`
private app paths go to `https://app.chipin.one` + the same path and query, on
`dev.chipin.one` and `site-dev.chipin.one` to `https://app-dev.chipin.one`;
`/group/join/<t>` and `/friends/join/<t>` go to the site landing
`/join/group/<t>` and `/join/friend/<t>` on every host. `/api/stats` is proxied
on the same hosts. `www.chipin.one` gets the same rules as `chipin.one` and no
`X-Robots-Tag`.

Preconditions:

- Step 1 in Production (04-4a2 promoted, app domains valid, criterion 10 green).
- 04-2f and 04-2g in Production; 04-2h green.
- The site has 04-3b1, 04-3b2, 04-3c and 04-3d and its dev check on
  `site-dev.chipin.one` passed.
- `chipin-site` settings, all found missing on 2026-11-26:
  - `site-dev.chipin.one` is connected to the Preview environment with Git
    branch `master`. As a Production domain without a Production deployment it
    answered `DEPLOYMENT_NOT_FOUND`.
  - Vercel Authentication (Deployment Protection) is off. Domains bound to a
    branch count as Preview, so with protection on `dev.chipin.one` and
    `site-dev.chipin.one` ask for a Vercel login. The app project has it off too.
  - Node.js version 24.x, the same as the app project and the root
    `package.json` `engines`.
- The site's `master` deployment is promoted to Production before the move. The
  site's Production Branch is `main` with Git deployments off, so without a
  Promote `chipin.one` would have no deployment to serve.

Order:

1. Rehearsal on dev: in `chipin-frontend` → Settings → Domains remove
   `dev.chipin.one`; in `chipin-site` add `dev.chipin.one`, environment Preview,
   Git branch `master`. Wait for Valid Configuration, then run the dev variant
   of the checks below on `dev.chipin.one` (targets `https://app-dev.chipin.one`,
   `X-Robots-Tag: noindex, nofollow` present).
2. Prod: in `chipin-frontend` remove `chipin.one`; in `chipin-site` add
   `chipin.one` as a Production domain. Vercel adds `www.chipin.one` with it,
   makes `www.chipin.one` the primary and turns `chipin.one` into a `308`
   redirect to `www.chipin.one`. Edit `chipin.one` right away: Production, no
   redirect. Leave `www.chipin.one` as a Production domain without a redirect
   too. Browsers cache a `308`, so every minute it is served adds visitors who
   go to `www` from then on; that is why `www.chipin.one` must serve the same
   rules as `chipin.one`.
3. Right after, the prod checks below (criterion 7 and 9 of spec 04).
4. The `www.chipin.one` rows of `apps/site/vercel.json` (#530, after the move):
   until the site build with them is promoted, `www.chipin.one/dashboard`,
   `/oauth/callback` and `/api/stats` answer `404`. Merge, check
   `site-dev.chipin.one` (a regression check only: the `www` rows show only on
   `www.chipin.one`), then Promote the site's `master` deployment and run the
   `www` checks below.
5. Monitor for 48 hours against the rollback criterion. 04-5a/b not earlier
   than 7 days without a step-2 rollback.

Checks (criterion 7; on dev the same on `dev.chipin.one`, app targets on
`https://app-dev.chipin.one`):

- `curl -sI https://chipin.one/` → `200`, no `Location` (not a `308` to `www`),
  no `X-Robots-Tag`; the same for `/privacy`, `/terms`, `/ru/`, `/ru/privacy`;
- `curl -sI https://chipin.one/dashboard` → `302`,
  `Location: https://app.chipin.one/dashboard`; the same for `/solo`,
  `/activity`, `/settings`, `/group/<uuid>`, `/friends`, `/login`;
- `curl -sI 'https://chipin.one/oauth/callback?code=x&returnTo=%2Fgroup%2F1'` →
  `302`, `Location: https://app.chipin.one/oauth/callback?code=x&returnTo=%2Fgroup%2F1`;
- `curl -sI https://chipin.one/group/join/x` → `302`, `Location: /join/group/x`;
  `/friends/join/x` → `302`, `Location: /join/friend/x`;
  `/join/group/x` → `200`, `Referrer-Policy: no-referrer`;
- `/not-found` → `404` (the site `404.astro`, no redirect);
  `/manifest.webmanifest` → `404`;
- `/sitemap.xml` → `302` to `/sitemap-index.xml`; `/index.html` and `/app.html`
  → `302` to `/`; `/es/` → `301` to `/`;
- `curl -sI https://chipin.one/sw.js` → `200`, `Cache-Control: no-cache`;
  `curl -s https://chipin.one/sw.js` is the kill-switch (`unregister`, no
  Workbox);
- `/api/stats` → `200`, `Cache-Control: private, no-store`;
  `/.well-known/assetlinks.json` → `200`;
- `curl -sI https://chipin.one/join/group/x | grep -ci content-security-policy`
  → `1` (criterion 9); no response of `chipin.one` has `Set-Cookie`;
- `www.chipin.one` (after the Promote of order step 4): `/` → `200`, no
  redirect, no `X-Robots-Tag`; `/dashboard` → `302` to
  `https://app.chipin.one/dashboard`;
  `'https://www.chipin.one/oauth/callback?code=x&returnTo=%2Fgroup%2F1'` → `302`
  to the same path and query on `https://app.chipin.one`; `/api/stats` → `200`,
  `Cache-Control: private, no-store`;
- `https://app.chipin.one/dashboard` → `200`, `X-Robots-Tag: noindex, nofollow`;
- in a browser: Google sign-in from the site (`/login?locale=…` on the app host)
  and through the old `https://chipin.one/oauth/callback`; `Set-Cookie` of
  sign-in and refresh on `app.chipin.one/api/…` is `__Host-` without `Domain=`;
  an old invite link `https://chipin.one/group/join/<t>` → the site landing →
  its button → the confirmation screen on `app.chipin.one` → joining.

### Rollback of step 2

Rollback criterion: as for step 1 (404 or 5xx on `chipin.one` or
`app.chipin.one` above 1 % per hour, an OAuth sign-in error), or the site
unavailable. It takes minutes and needs no PR:

- Prod: remove `chipin.one` from `chipin-site` and add it to `chipin-frontend`
  as a Production domain without a redirect. Dev: remove `dev.chipin.one` from
  `chipin-site` and add it to `chipin-frontend`, Preview, Git branch `master`.
- Leave `www.chipin.one` on `chipin-site` (Production, no redirect). The app
  project has no `www` rules: its legacy-host redirects, `/api` rewrites,
  `/sw.js` kill-switch rewrite and the app's legacy-host lists
  (`helpers/serviceWorkerHost.ts`, `helpers/legacyHost.ts`) name only
  `chipin.one` and `dev.chipin.one`. On the app project `www.chipin.one` would
  install the full app worker, answer `404` on `/api/*` and serve the app shell
  on private paths. On the site it keeps sending private paths to
  `app.chipin.one`, so visitors who still have the cached `308` keep working.
  Moving `www.chipin.one` to the app project first needs an app PR that adds it
  to those host lists. If the rollback is for a broken site build, fix
  `www.chipin.one` with an Instant Rollback of `chipin-site` to its previous
  Production deployment, not by moving the domain.
- Never make `www.chipin.one` a `307` to `chipin.one` while browsers may still
  hold the cached `308` `chipin.one` → `www.chipin.one` from step 2 of the move:
  the two redirects loop.
- The app project keeps the step-1 redirects: `chipin.one` serves today's
  landing again, private paths still `302` to `app.chipin.one`, `/sw.js` stays
  the kill-switch of 04-4a1, and the new invite links `/join/group|friend/<t>`
  are handled by its compat redirects. The site's own step-2 redirects are `302`, so
  browsers cached none of them (only the Vercel `308` above). `app.chipin.one` and an enabled 03-17 are not
  affected.
- After 04-5a this rollback is impossible: 04-5a removes the landing and the
  legacy-host rules from the app project.
