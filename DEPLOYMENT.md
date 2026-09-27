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
disabled even if the build would otherwise enable telemetry. The existing
build-derived Sentry environment, release, source-map upload, and privacy
configuration remain unchanged.

There is no unconditional external API rewrite. Unknown hosts therefore cannot
fall back to production.

For local development, Vite proxies `/api/*` to
`https://api-dev.chipin.one/*` and strips the local `/api` prefix before
forwarding the request.

All Vercel `/api/*` responses are marked `no-store` for both browser and CDN
caches. Keep these rules in sync with the auth transport decision in #151 and
the token lifecycle work in #163.


## CI-gated Vercel deployments

GitHub CI owns deployment admission. The Actions deployment path is intentionally
inactive unless the repository variable `VERCEL_ACTIONS_DEPLOY_ENABLED` is exactly
`true`. Keep that variable absent or false until the cutover prerequisites below
are verified.

Deployment mapping:

| GitHub event | Required successful gate | Vercel target |
| --- | --- | --- |
| Pull request to `dev` from this repository | `frontend-ci` | `preview` |
| Push to `dev` | `frontend-ci` | `staging` |
| Release pull request `dev → main` | `main-ci` | `preview` |
| Push to `main` | `main-ci` | `production` |

The reusable deployment workflow checks out the CI SHA explicitly, verifies that
the checked-out SHA and current source-branch SHA still equal the CI SHA, and
rejects other repositories, forks, unsupported events, failed/cancelled CI, stale
runs, and invalid release sources. It runs `vercel pull`, `vercel build`, and
`vercel deploy --prebuilt` against that verified checkout. Deployment metadata
records the GitHub repository, run id, and verified commit SHA.

Deployment concurrency is bounded per event/base/source branch and cancels an
older in-progress deployment for the same key. A retry is permitted only while
the source branch still points to the same CI SHA; once the branch advances, the
freshness check blocks the retry. A retry of an unchanged SHA can create a new
Vercel deployment of the same artifact source and is therefore an explicit
operator retry, not an automatic stale publication.

### Cutover prerequisites

Do not disable Vercel Git deployments until all of these are confirmed in the
actual Vercel/GitHub settings:

1. The Vercel project is the project for `ChipIn-one/chipin-frontend`, with
   `main` still the production source branch.
2. Vercel targets `preview`, `staging`, and `production` exist as intended.
   The `staging` target must be a real custom environment; do not silently map it
   to `preview`. Its persistent development domain should remain
   `dev.chipin.one`.
3. Vercel environment variables preserve `VITE_CHIPIN_ENV=dev` for preview and
   staging, and `VITE_CHIPIN_ENV=prod` for production, together with the existing
   Sentry/runtime configuration.
4. GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and
   `VERCEL_PROJECT_ID` are present for this repository.
5. The Actions implementation is merged while
   `VERCEL_ACTIONS_DEPLOY_ENABLED` is still absent or false, so the current Git
   deployment path continues to work until the controlled cutover.

The reviewable Vercel Git cutover diff is deliberately not applied by the
implementation change. Apply it in a separate, human-authorized cutover change:

```diff
 {
     "$schema": "https://openapi.vercel.sh/vercel.json",
+    "git": {
+        "deploymentEnabled": false
+    },
     "buildCommand": "npm run vercel-build",
```

Immediately before the human merges that cutover change into `dev`, set
`VERCEL_ACTIONS_DEPLOY_ENABLED=true` and avoid unrelated pushes during the
cutover window. The merge SHA is the staging canary: `frontend-ci` must succeed,
the Actions deployment must publish that exact SHA to `staging`, and Vercel must
show no independent Git-triggered deployment for the same commit. Only after that
canary is verified should a separately authorized `dev → main` release activate
the production path.

### Rollback

If the Actions path cannot complete the canary, set
`VERCEL_ACTIONS_DEPLOY_ENABLED=false` first. Revert the cutover diff so
`git.deploymentEnabled` returns to its default enabled state, then merge that
rollback through the normal human-controlled route. This restores the previous
Vercel Git deployment behavior without changing `dev`/`main` lifecycle or
backend routing.
