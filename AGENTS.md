# AGENTS.md

ChipIn frontend on Vite 8, React 19, TS strict, Radix Themes, i18next, PWA.
Do not change backend contracts without an explicit request. The full rulebook is only `docs/engineering/rules/*`.

## Invariants

Invariants 1–6 and 9 describe the target state of specs 03/04 (the `app`, `entities`, and `shared` layers do not exist yet); until their PRs land, the current `src/` structure, the code, and the rules in `docs/engineering/rules/` apply (for money, `60-money-helpers.md`). Exception: the bans in item 9 (new server stores and new connector hooks) apply now (D12).

1. Layers import only downward along one graph: app → pages → features → components → hooks → store → entities → helpers → shared → api → base (constants, types, i18n, styles, assets); basics sits between components and helpers; `shared` splits into `shared-api` (`shared/api`, `shared/offline`: only hooks, store, entities, app) and `shared-lib`. Details: `docs/engineering/rules/10-architecture.md`.
2. UI (pages, features, components, basics) and helpers do not call the runtime API, `axios`, `shared/api`, or `shared/offline`; server data comes through the query layer (`entities/*`) or a store. `no-restricted-imports` catches imports of `axios` and runtime `api/` modules from UI.
3. Money in code is `Money { minor: bigint }` (ledger units, scale 4); on the wire it is a JSON number with scale 4 (D21). The wire boundary has two layers: the transport `shared/api/wireJson.ts` (only inside the `api()` wrapper) parses the body without doubles into an opaque `WireAmount` and writes outgoing amounts as decimal literals, but does not interpret amounts; `WireAmount` ↔ `Money` conversion happens only in `moneyFromWire`/`moneyToWire` inside the `entities/*/model` mappers (`toX()`/`toXWire()`). Input parsing, rounding, sums, and formatting live only in `src/shared/money/`; `parseFloat`/`Number()`/`JSON.parse` on money fields outside it are forbidden. Display is only `basics/numbers/amount/Amount.tsx`.
4. The server is the source of truth for finances: do not patch balances/debts locally; only the outbox loop `runOutboxOp` repeats a mutation (spec 03 §2.4); every TanStack mutation has `retry: false`, the online path is `ledgerOnlineMutationKeys` (`networkMode: 'online'`); a stale response never overwrites newer state.
5. Expenses are created/edited/deleted only through `entities/ledger/api/mutations.ts` (selected by `offlineWritesAvailable`: online keys or outbox); offline only through the outbox with a client UUID and `entryKind: 'expense'` (enabled by 03-17 behind a flag and backend capabilities; until then there are no offline writes). Settle-up and payments, including editing and deleting a settlement, are forbidden offline (`ONLINE_ONLY_ACTIONS`, `<OnlineOnly>`).
6. Types: no `any`, `as any`, `@ts-ignore`, unjustified `as`, or `!`; type-only imports use `import type`. Data from IndexedDB, the outbox, and localStorage is validated with zod on read.
7. Promises are never lost: every promise is returned, awaited, or explicitly marked `void`; errors are not swallowed. `await` or `.then` style is free (the owner lifted the async/await ban on 2026-10-28, D24; do not fix warnings from the old async selector in `eslint.config.js`). A JSX attribute never returns a promise: `onClick={() => void action()}`.
8. Named exports only; at most one `index.ts` per slice, no `export *`. Until lint/codemod 02-C12/02-D3 land this is a review rule; it is mandatory in new code. Do not rewrite existing files incidentally (codemod 02-D3 migrates them).
9. Server state is TanStack Query; Zustand is UI state. Server stores that spec 03 has not migrated yet are transitional: do not create new ones and do not add new server-data fields to them. Read one value with a selector, several with one object selector wrapped in `useShallow`; `useStore()` without a selector and new `useConnect` hooks are forbidden.
10. `npx eslint --fix <changed files>` fixes everything auto-fixable; do not fix style by hand. A lint error is about correctness or a boundary, and its message says how to fix it; `eslint-disable` only with a reason.
11. All user-facing text, including `aria-*`, `placeholder`, `title`, and toasts, goes through i18n in every locale. Interactive elements are native elements or Radix; icon buttons have a translated name (review).
12. `localStorage`/`sessionStorage` only through `helpers/localStorage.ts`. Tokens, invite tokens, and personal data never reach logs, Sentry, or URLs; logout clears all user data (cache, outbox, user `id`/`role`); only the language and theme UI settings survive.
13. Import order is `simple-import-sort` (fixed by `--fix`), formatting is `.prettierrc.cjs`; do not reformat code the task does not change.
14. Every task PR body has `## Version impact` (`none|patch|minor|major`); a task does not change `version` in `package.json`/`package-lock.json` and does not run `version:bump` (see Release).
15. A change to the domain, API, or visible behavior starts in the KB: `chipin-knowledge-base/common/glossary.md` and `common/specs/<capability>.md`; tests are named by requirement IDs. New behavior lands in the KB spec first through a linked PR; a conflict with an ADR in `common/adr/` means stop and ask the owner. Take the KB from `../chipin-knowledge-base`, otherwise `git clone` it there, otherwise read it through GitHub; if the KB is unavailable both locally and through GitHub — BLOCKED.

## Commands

- `npm run test:task -- <test paths>` — targeted tests; refuses to run without a path.
- `npx eslint --fix <files>` — ESLint auto-fixes in changed files only.
- `npm run verify` — fast lint (`--quiet`: shows only errors, warnings do not fail) and typecheck.
- `npm run verify:full` — the full gate: lint, all tests, build, ds-gallery; CI runs the same. Run before `IMPLEMENTATION_COMPLETE`.
- `npm run typecheck` — `tsc -b`.
- `npm run version:check` — the version in `package.json` and `package-lock.json` is valid and matches (read-only).
- Husky `pre-push` runs `version:check` and `verify:full`.

## Process

- Roles, gates, and reading order: [org canon FLOW.md](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/FLOW.md).
- A task needs a fresh `INTAKE_COMPLETE` before execution: [org issue-intake contract](https://github.com/ChipIn-one/.github/blob/master/automation/issue-intake.md).
- Task branch is `<type>/issue-<n>-<slug>` from `master`; PR into `master`, squash; only a human merges.
- A FE Issue is never closed by hand; after the merge into `master` it waits in `Awaiting release`: [completion canary](docs/engineering/frontend-production-completion-canary.md#issue-lifecycle-after-the-merge-to-master).
- QA before release: [`docs/engineering/release-qa.md`](docs/engineering/release-qa.md); PR metadata: [`docs/engineering/pr-metadata.md`](docs/engineering/pr-metadata.md).

## Release

The release process owns releases: the owner runs Promote to Production for a chosen `master` build in Vercel ([`DEPLOYMENT.md`](DEPLOYMENT.md#vercel-delivery-from-master)); version policy: [org release policy](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/release.md) (the version is a git tag derived from `## Version impact` of merged PRs; transition: ChipIn-one/.github#172). The Executor does not change the version in a feature PR.

## Review

An independent reviewer checks invariants 1–15 and that changed logic has regression tests. The reviewer does not comment on style, formatting, import order, or anything CI catches.
Mandatory review focus: auth/session/refresh and tokens, interceptors and permissions, routing and auth composition, request races and cancellation, service worker/PWA, CI, security (CSP), and dependency updates.

<!-- ai-workflow:agents-routing:start -->
ChipIn AI routing: start at the organization canon [FLOW.md](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/FLOW.md) and follow its reading order, roles and gates. Its [precedence and availability](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/FLOW.md#precedence-and-availability) rules apply: if the canon cannot be read, stop.
<!-- ai-workflow:agents-routing:end -->
