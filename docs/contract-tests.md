# Frontend contract tests

The contract suite validates selected frontend assumptions against a live ChipIn backend without sharing fixed test users.

## Commands

Run the isolated contract suite:

```bash
npm run test:contract
```

Run the current auth/session smoke only:

```bash
npm run test:contract:smoke
```

The normal `npm run test:full` and `npm run verify:full` commands do not execute `*.contract.ts` files and therefore do not make contract-test network requests.

## Environment

The harness reads:

- `CHIPIN_CONTRACT_BASE_URL`
- `CHIPIN_CONTRACT_BASIC_USER`
- `CHIPIN_CONTRACT_BASIC_PASSWORD`

Allowed targets are intentionally closed:

- `https://api-dev.chipin.one`
- `http://localhost:8080`
- `http://127.0.0.1:8080`

The production origin `https://api.chipin.one` is rejected before any request. Other schemes, hosts, ports, user info, query strings, fragments, and non-root base paths are also rejected.

Staging requires both Basic Auth values. Local development targets do not send Basic Auth.

Example local run:

```bash
CHIPIN_CONTRACT_BASE_URL=http://localhost:8080 npm run test:contract:smoke
```

Example staging run:

```bash
CHIPIN_CONTRACT_BASE_URL=https://api-dev.chipin.one \
CHIPIN_CONTRACT_BASIC_USER='<swagger-basic-user>' \
CHIPIN_CONTRACT_BASIC_PASSWORD='<swagger-basic-password>' \
npm run test:contract:smoke
```

Do not commit credentials or tokens.

## Auth/session smoke

Each run:

1. validates the target before network I/O;
2. fetches `/swagger/documentation.yaml` and checks the required auth/session paths are present;
3. creates a unique run with `POST /auth/test-register`;
4. validates the provisioning response at field level;
5. calls `GET /users/self` with the returned Bearer token and validates it against the frontend self-user DTO;
6. calls `POST /auth/refresh` with only `X-Refresh-Token` and validates the returned token pair;
7. deletes the run with `DELETE /auth/test-runs/{runId}` from a `finally` path after provisioning was attempted.

The run stays self-contained. Do not connect a contract-test user or its data to any account outside the same run.

## Secret-safe failures

The HTTP helper does not retry mutations or other requests. Requests have a bounded timeout.

Failure messages may identify the HTTP method, path, and status. They do not include response bodies, Basic credentials, Bearer tokens, refresh tokens, or sensitive headers. JSON-shape failures describe the invalid field rather than dumping the backend response.

## CI trust boundary

Pull-request CI remains credential-free. `frontend-ci.yml` runs `npm run verify:full`, which includes the pure contract helper unit tests but excludes live `*.contract.ts` tests.

`.github/workflows/contract-smoke.yml` runs only on a push to `dev`, after code has been human-reviewed and merged into the trusted integration branch. It uses GitHub-hosted runners and these repository or organization secrets:

- `CHIPIN_CONTRACT_BASIC_USER`
- `CHIPIN_CONTRACT_BASIC_PASSWORD`

The workflow has no `pull_request` or `workflow_dispatch` trigger, so staging credentials are not exposed to untrusted PR code.

## Remaining #160 coverage

This first slice covers only the harness and auth/session smoke. Parent issue #160 still needs the broader contract matrix for users, groups, expenses/settlements, dashboard/activity/pagination, currencies, and standard error responses.
