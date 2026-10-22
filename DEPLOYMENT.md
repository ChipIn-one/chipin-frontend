# Deployment API routing

The browser uses only the same-origin `/api/*` path for ChipIn backend traffic.
Vercel owns the deployment-to-backend mapping:

| Frontend host | Runtime environment | `/api/*` backend |
| --- | --- | --- |
| `chipin.one` | production | `https://api.chipin.one/*` |
| `dev.chipin.one` | development | `https://api-dev.chipin.one/*` |
| `*.vercel.app` | development | `https://api-dev.chipin.one/*` |

All Vercel-generated domains are development surfaces, including the default
production `.vercel.app` domain. A production build opened through a
`.vercel.app` hostname is therefore treated as development at runtime so its
same-origin API traffic cannot reach production data. Only `chipin.one` maps
to the production API.

Vercel hosts still require an explicit `VITE_CHIPIN_ENV` configuration. A
missing or invalid value fails closed as defined by #180. Custom
`*.dev.chipin.one` branch domains are intentionally not part of the deployment
contract.

Sentry runtime reporting reads `VITE_SENTRY_DSN` from the deployment
environment. Configure it independently for the Vercel environments that should
send events. When the variable is absent or empty, runtime Sentry reporting is
disabled even if the build would otherwise enable telemetry. Vercel Git
integration builds use the normal Vercel environment configuration and preserve
the existing Sentry source-map upload behavior.

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

| GitHub event | Required gate | Vercel |
| --- | --- | --- |
| Pull request to `master` | `frontend-ci` | Git integration Preview of the PR branch |
| Merge (push) to `master` | `frontend-ci` on the push | Git integration Preview build of the exact `master` commit (dev env vars); `dev.chipin.one` follows it |
| Release | none in GitHub | the owner runs **Promote to Production** on a chosen `master` deployment |

- `master` builds are Preview deployments: the Vercel Production Branch stays
  `main` (Vercel rejects a non-existent branch), and `vercel.json` disables Git
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
  GitHub Deployments `Preview`. Verified at cutover step 7 of #497: Promote
  created Deployment `Production` 7254813070 by `vercel[bot]` on `e6d2f2e`
  (2026-10-22T14:24:47Z). That record is the production evidence for Issue
  completion (strategy `deployment-receipt`).
- The repository has no completion caller. The ChipIn-one/.github org sweep
  (`frontend-production-completion.yml`, every 15 minutes) runs
  `deployment-receipt` for the frontend once ChipIn-one/.github#217 sets
  registry `capabilities.completion: automatic`: PR merged into `master` →
  Issue `Awaiting release` → owner Promote → the Issue closes within about
  15 minutes. FE Issues are never closed by hand; GitHub auto-close is off.
- `vercel.json` keeps `git.deploymentEnabled` off for the retired `dev` and
  `main` branches. `main` is a frozen rollback ref until 2026-11-05.

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

No paid custom Vercel environment is required.

### Rollback

Production rollback is a Vercel action independent of git: Instant Rollback, or
Promote of the previous production deployment.
