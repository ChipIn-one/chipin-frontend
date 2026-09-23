# Deployment API routing

The browser uses only the same-origin `/api/*` path for ChipIn backend traffic.
Vercel owns the deployment-to-backend mapping:

| Frontend host | `/api/*` backend |
| --- | --- |
| `chipin.one` | `https://api.chipin.one/*` |
| `dev.chipin.one` | `https://api-dev.chipin.one/*` |
| `*.vercel.app` preview | `https://api-dev.chipin.one/*` |

Vercel-generated Preview Deployment domains are the supported preview hosts.
Custom `*.dev.chipin.one` branch domains are intentionally not part of the
deployment contract.

There is no unconditional external API rewrite. Unknown hosts therefore cannot
fall back to production. The frontend also keeps the explicit environment
validation from #180, so an unsupported host without an approved environment
configuration fails before normal API traffic starts.

For local development, Vite proxies `/api/*` to
`https://api-dev.chipin.one/*` and strips the local `/api` prefix before
forwarding the request.

All Vercel `/api/*` responses are marked `no-store` for both browser and CDN
caches. Keep these rules in sync with the auth transport decision in #151 and
the token lifecycle work in #163.
