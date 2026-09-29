# Frontend contract tests

The contract suite validates frontend assumptions against a live ChipIn backend without sharing fixed test users.

## Commands

Run the isolated contract suite:

```bash
npm run test:contract
```

Run only the fast auth/session smoke:

```bash
npm run test:contract:smoke
```

Run only the broader core API matrix:

```bash
npm run test:contract:full
```

The normal `npm run test:full` and `npm run verify:full` commands do not execute `*.contract.ts` files and therefore do not make contract-test network requests.

## Environment

The harness reads:

- `CHIPIN_CONTRACT_BASE_URL`
- `CHIPIN_CONTRACT_SWAGGER_USER`
- `CHIPIN_CONTRACT_SWAGGER_PASSWORD`

Allowed targets are intentionally closed:

- `https://api-dev.chipin.one`
- `http://localhost:8080`
- `http://127.0.0.1:8080`

The production origin `https://api.chipin.one` is rejected before any request. Other schemes, hosts, ports, user info, query strings, fragments, and non-root base paths are also rejected.

Staging requires both Basic Auth values. Local development targets do not send Basic Auth.

Example local run:

```bash
CHIPIN_CONTRACT_BASE_URL=http://localhost:8080 npm run test:contract
```

Example staging run:

```bash
CHIPIN_CONTRACT_BASE_URL=https://api-dev.chipin.one \
CHIPIN_CONTRACT_SWAGGER_USER='<swagger-basic-user>' \
CHIPIN_CONTRACT_SWAGGER_PASSWORD='<swagger-basic-password>' \
npm run test:contract
```

Do not commit credentials or tokens.

## Fast auth/session smoke

Each smoke run:

1. validates the target before network I/O;
2. fetches `/swagger/documentation.yaml` and checks the required auth/session paths are present;
3. creates a unique run with `POST /auth/test-register`;
4. validates the provisioning response at field level;
5. calls `GET /users/self` with the returned Bearer token and validates the frontend self-user fields;
6. calls `POST /auth/refresh` with only `X-Refresh-Token` and validates the returned token pair;
7. deletes the run with `DELETE /auth/test-runs/{runId}` from a `finally` path after provisioning was attempted.

## Full core API matrix

The full run uses two fresh users created under one unique `runId`. It verifies the runtime OpenAPI surface and exercises these normal API paths without seeded state:

- self-user fields, invite-link friendship, and known-user responses;
- group create/member-add plus opaque cursor pagination across two generated groups;
- group expense create/read and group settlement create/read;
- dashboard response fields, including the current required empty `groups` compatibility field;
- user activity, user activity-preview, and group activity-preview responses, including numeric cursor advancement;
- USD currency-rate responses and numeric requested rates;
- standard structured errors for unauthenticated access (`401`), field validation (`400`), and missing ledger resources (`404`).

Runtime guards validate nested response fields rather than relying only on HTTP status. The matrix also checks key OpenAPI path and field names such as `isPremium`, `simplifyDebts`, `participantShares`, `nextCursor`, `stale`, and the standard error `code` field so runtime/schema drift fails visibly.

The run stays self-contained. Never connect a contract-test user or its data to an account outside the same `runId`. Cleanup always uses `DELETE /auth/test-runs/{runId}` from `finally`; if the primary scenario and cleanup both fail, both failures are preserved.

## Secret-safe failures

The HTTP helper does not retry mutations or other requests. Requests have a bounded timeout and redirects are disabled before credentials are sent.

Failure messages may identify the HTTP method, path, expected/actual status, and invalid field. They do not include response bodies, Basic credentials, Bearer tokens, refresh tokens, or sensitive headers. Expected non-2xx contract checks parse the JSON body only after the status matches the test's explicit expectation.

## CI trust boundary

Pull-request CI remains credential-free. `frontend-ci.yml` runs `npm run verify:full`, which includes the pure contract-helper unit tests but excludes live `*.contract.ts` tests.

`.github/workflows/contract-smoke.yml` runs only on a push to `dev`, after code has been human-reviewed and merged into the trusted integration branch. It has two ordered jobs:

1. `contract-smoke` runs the fast auth/session gate;
2. `contract-full` runs the broader matrix only after the smoke passes.

Both jobs use GitHub-hosted runners and these repository or organization secrets:

- `CHIPIN_CONTRACT_SWAGGER_USER`
- `CHIPIN_CONTRACT_SWAGGER_PASSWORD`

The workflow has no `pull_request` or `workflow_dispatch` trigger, so staging credentials are not exposed to untrusted PR code. A PR can validate the pure helpers and TypeScript through normal frontend CI; the credentialed live matrix intentionally runs only after a human merges to `dev`.
