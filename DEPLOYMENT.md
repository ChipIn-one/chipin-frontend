# Deployment API routing

The browser uses only the same-origin `/api/*` path for ChipIn backend traffic.
Vercel owns the deployment-to-backend mapping:

| Frontend host | `/api/*` backend |
| --- | --- |
| `chipin.one` | `https://api.chipin.one/*` |
| `dev.chipin.one` | `https://api-dev.chipin.one/*` |
| `*.dev.chipin.one` branch domains | `https://api-dev.chipin.one/*` |
| `*.vercel.app` preview | `https://api-dev.chipin.one/*` |

Vercel Branch Domains can give a task branch a stable custom preview URL. For
example, the branch for issue #199 can use `issue-199.dev.chipin.one`; Vercel
then keeps that domain pointed at the latest deployment for the selected Git
branch.

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
