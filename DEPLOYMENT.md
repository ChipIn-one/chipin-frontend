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
disabled even if the build would otherwise enable telemetry. PR Preview builds
are created by Vercel only after successful GitHub CI. Protected `dev` Preview
and Production builds keep the existing Sentry source-map upload behavior.

There is no unconditional external API rewrite. Unknown hosts therefore cannot
fall back to production.

For local development, Vite proxies `/api/*` to
`https://api-dev.chipin.one/*` and strips the local `/api` prefix before
forwarding the request.

All Vercel `/api/*` responses are marked `no-store` for both browser and CDN
caches. Keep these rules in sync with the auth transport decision in #151 and
the token lifecycle work in #163.


## CI-gated Vercel deployments

GitHub CI owns deployment admission. Vercel Git auto-deploy is disabled by
`vercel.json`. The Actions path is active only when repository variable
`VERCEL_ACTIONS_DEPLOY_ENABLED` is exactly `true`.

| GitHub event | Required successful gate | Result |
| --- | --- | --- |
| Same-repository PR to `dev` | `frontend-ci` | Vercel Preview of the exact green SHA |
| Push to `dev` | `frontend-ci` | `dev` Deploy Hook → Vercel Preview |
| Release PR `dev → main` | `main-ci` | CI only |
| Push to `main` | `main-ci` | `main` Deploy Hook → Vercel Production |

The trusted `workflow_run` is resolved from the repository default branch.
GitHub does not reliably populate `workflow_run.pull_requests`, so the Preview
job resolves the current open same-repository PR from the CI head branch with
`base=dev`, then requires its current head SHA to equal the successful CI SHA.
Closed, ambiguous, or stale PR state is skipped.

After admission, the workflow calls Vercel's Deployments API with the repository
id, branch ref, and exact CI SHA. Vercel performs its normal Preview build using
the project's Preview environment. `VERCEL_TOKEN` is available only to trusted
default-branch workflow code; PR-controlled GitHub Actions steps never receive it.

Protected `dev` and `main` pushes keep the existing branch-based Deploy Hooks
and their freshness check.

Required secrets:

- `VERCEL_DEV_DEPLOY_HOOK`
- `VERCEL_PROD_DEPLOY_HOOK`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`

The PR Preview path becomes active only after this workflow exists on the default
branch. Merge this change to `dev`, promote `dev → main`, verify the two API
credentials, then update a PR to `dev`. No additional Vercel Git cutover is
required; `git.deploymentEnabled=false` remains the final configuration.

If PR Preview API creation fails, leave Vercel Git auto-deploy disabled and fix
or revert the Preview workflow. Protected `dev` and `main` Deploy Hooks are
independent.
