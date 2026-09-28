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
disabled even if the build would otherwise enable telemetry. PR-controlled
Actions preview builds use only public `VITE_*` build variables and explicitly
skip Sentry source-map upload and disable Vite source-map generation, so neither
`SENTRY_AUTH_TOKEN` nor unpublished source maps enter the untrusted preview
artifact. Protected `dev` Preview and production builds preserve the existing Sentry
source-map upload behavior.

There is no unconditional external API rewrite. Unknown hosts therefore cannot
fall back to production.

For local development, Vite proxies `/api/*` to
`https://api-dev.chipin.one/*` and strips the local `/api` prefix before
forwarding the request.

All Vercel `/api/*` responses are marked `no-store` for both browser and CDN
caches. Keep these rules in sync with the auth transport decision in #151 and
the token lifecycle work in #163.


## CI-gated Vercel deployments

GitHub CI owns deployment admission. Vercel Git auto-deploy remains enabled until
the final cutover. The Actions trigger path stays inactive unless repository
variable `VERCEL_ACTIONS_DEPLOY_ENABLED` is exactly `true`.

Deployment mapping after cutover:

| GitHub event | Required successful gate | Result |
| --- | --- | --- |
| Pull request to `dev` | `frontend-ci` | CI only; no Vercel deployment |
| Push to `dev` | `frontend-ci` | trigger the `dev` Deploy Hook → Vercel Preview |
| Release pull request `dev → main` | `main-ci` | CI only; no Vercel deployment |
| Push to `main` | `main-ci` | trigger the `main` Deploy Hook → Vercel Production |

The deployment workflow uses trusted `workflow_run` events from the repository
default branch. It accepts only successful push runs from this repository and only
these workflow/branch pairs:

- `Frontend CI` on `dev`
- `Main CI` on `main`

Immediately before triggering Vercel, GitHub Actions reads the current branch SHA.
If the branch has advanced since the successful CI run, the deployment is skipped.
This prevents an obsolete CI run from intentionally triggering a newer branch
state in the normal case.

Deploy Hooks are intentionally branch-based rather than exact-SHA deployment.
There is a small race window after the final GitHub SHA check because Vercel
resolves the configured branch when processing the hook. This tradeoff is accepted
for the simpler operating model: deploy only after successful CI and keep the
latest green branch state live.

The workflow does not receive a Vercel API token. The only deployment credentials
are two secret Deploy Hook URLs:

- `VERCEL_DEV_DEPLOY_HOOK` — Vercel hook configured for branch `dev`
- `VERCEL_PROD_DEPLOY_HOOK` — Vercel hook configured for branch `main`

Treat Deploy Hook URLs like passwords. Anyone holding a URL can trigger its
deployment.

### Vercel configuration

The Vercel project remains connected to `ChipIn-one/chipin-frontend`.

- `main` is the Production branch.
- `dev` deployments use the standard Preview environment.
- `dev.chipin.one` remains the persistent development domain for the `dev`
  Preview branch.
- Preview uses `VITE_CHIPIN_ENV=dev`.
- Production uses `VITE_CHIPIN_ENV=prod`.
- Existing Sentry/runtime variables remain scoped to the environments where they
  are required.

No paid custom Vercel environment is required.

### Cutover prerequisites

Before disabling Vercel Git auto-deploy:

1. Create one Vercel Deploy Hook for branch `dev`.
2. Create one Vercel Deploy Hook for branch `main`.
3. Store their URLs as GitHub Actions secrets `VERCEL_DEV_DEPLOY_HOOK` and
   `VERCEL_PROD_DEPLOY_HOOK`.
4. Keep `VERCEL_ACTIONS_DEPLOY_ENABLED` absent or `false`.
5. Merge this Deploy Hook implementation through `dev` and then `main` so the
   trusted `workflow_run` definition exists on the default branch.
6. Verify the Vercel Production branch, domain mappings, and environment variables.

Only after the implementation is live on `main` should a separate cutover PR add:

```json
{
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "git": {
        "deploymentEnabled": false
    }
}
```

Immediately before the human merge of that cutover PR into `dev`, set
`VERCEL_ACTIONS_DEPLOY_ENABLED=true`.

The merge into `dev` is the canary:

1. `frontend-ci` must succeed.
2. `Vercel Deploy` must run only after that success.
3. The workflow must confirm that `dev` still points at the successful CI SHA
   immediately before POST.
4. The `dev` Deploy Hook must create the expected Preview deployment.
5. `dev.chipin.one` must serve that deployment.
6. There must be no second independent Git-triggered deployment for the same push.

Production remains a separate human-controlled release. A `dev → main` merge
will trigger the Production Deploy Hook only after `main-ci` succeeds.

### Rollback

If the canary fails, set `VERCEL_ACTIONS_DEPLOY_ENABLED=false` first. Revert the
separate `git.deploymentEnabled=false` cutover change through the normal PR route.
That restores the previous Vercel Git auto-deployment behavior.
