# Spec 02 — a single rulebook, tooling, dependency cleanup

Decisions: D9, D11, D12, D13, D15, D16 (dependencies and build hygiene), D27, D31 (no codemods: named exports via `import-x/no-default-export` + shrinking suppressions, 02-C13). Related decisions: D21 (the `money/` module; D10 withdrawn), D3 (TanStack Query), D6 (data router), D4 (zod at boundaries).
Related specs: **01** (hotfix: `.gitignore`, CSP — already there), **03** (D3/D4/D21: `src/shared/money`, the Query layer, removal of `useConnect`, money lint rules), **04** (D6/D7: monorepo — configs move to the root, see §D9; data router and `src/app/`), **05** (D14: stylelint, styled allowlist, `no-raw-colors`).
PR identifiers use the global scheme `<spec>-<n>`: `02-A0…02-A3`, `02-B1…02-B2`, `02-C1…02-C13` (02-D1 withdrawn, §D0; the codemods 02-D2a–e/02-D3a–e withdrawn by D31) (see `00-overview.md`).

Deviation from D11/D13 (owner review of PR #542, recorded in DECISIONS): rules without autofix and not about correctness are removed (§D0) — `handle*`, the `React.FC` ban, Props only in the component file as a check are dropped. Deviation from DECISIONS: D9 names `docs/codex/rules` as the full rulebook; on `master` the rulebook already lives in `docs/engineering/rules/` — D9 applies to it, no new `docs/codex/` is created. D12 (removal of `useConnect`) is carried out by spec 03; here only the ban on new ones. After review C (taken to the owner, `00-overview.md` "Confirmations"): (1) D9 "every rule is lint/CI or is deleted" is carried out with a fourth class `REVIEW` — a short list of semantic AGENTS.md invariants that a machine does not check (C1-16); (2) D21 "money conversion at the API boundary" is interpreted as "in the `entities/*/model` mappers", the `api()` wrapper does not touch money (C1-11, C2-06, C3-14; details — spec 03 §4.3).

**Order relative to the monorepo move (04-0).** Before 04-0: 02-A0…A3, 02-B1, 02-B2, 02-C1…02-C5 (recommended — so that the mass formatting and `tsconfig.base.json` come before the rename). After 04-0: 02-C6…02-C13 (02-C13 does not depend on 04-0; it only needs 02-C4). There are no codemods (D31). 02-A*/02-B*/02-C* are written through `APP_DIR` (§D9) and can also go after 04-0 if needed.

## Goal

The agent (Claude/Codex) gets **one** place with the rules, and every rule is either checked by a machine (ESLint/tsc/CI script) or is part of a short list of invariants that the reviewer checks. There are no contradictions between files. CI fails on any warning, on unformatted code, and on version desync. Lint does not make the agent do extra rounds: everything stylistic is fixed by `--fix`, only correctness remains an error (§D0).

## D0. No friction for agents (a principle for every lint/format rule)

Owner review (PR #542): linter and Prettier rules often break agents and make them do extra work. Therefore every ESLint/Prettier rule belongs to exactly one class:

- **(a) Auto-fixable** → `error`, but the agent does not see it as an error: it is fixed by `eslint --fix`/`prettier --write` on save (VSCode), in lint-staged, and by the `npm run fix` command.
- **(b) Correctness or boundary** (promises, `any`, layer and import boundaries, money arithmetic, raw colors, `no-default-export`) → `error` with a message that says **how to fix** (`message` in `no-restricted-*`, a link to the rulebook rule).
- **(c) Style or names without autofix** → **removed** (`off`, the rule's text is also removed from the rulebook).

Consequences:
- There is no `warn` level: every rule is `error` or `off`. So `--max-warnings 0` stays, but only as insurance against an accidental `warn` in the config.
- Pre-commit is fast (< 5 s): lint-staged only with `--fix`, the remaining errors are printed as a hint and **do not block the commit** (the one exception: a staged file with a syntax error makes Prettier fail, and lint-staged blocks the commit). Pre-push is removed. Only CI (`verify:full`) blocks; the agent runs `npm run verify:full` itself as a local check before `IMPLEMENTATION_COMPLETE`.
- The baseline is **native ESLint bulk suppressions** (C1-13; ESLint 9.39.4 in the repo: `--suppress-rule`, `--suppress-all`, `--prune-suppressions`, the file `eslint-suppressions.json` in the root with a violation counter per file × rule, `node_modules/eslint/lib/services/suppressions-service.js`). If a file has more violations than recorded, all of them are reported as `error`; entries that no longer fire fail `eslint` (exit 2) until `--prune-suppressions`, so the baseline only shrinks. There is no own `baseline.js` with `rules: 'off'`: it turned the rule off for the whole file, and new violations in a baseline file passed. `npm run baseline:update` = `eslint . --prune-suppressions` (+ `config/tsc-baseline.json`, if 02-C11 splits). Growth is caught by CI `check-baseline.mjs` (D7). The agent runs one command.
- Entries are added only in the PR that enables the rule: `eslint . --suppress-rule <rule>`. `check-baseline.mjs` allows growth (new keys or higher counters) only for registry keys the same PR added to `config/eslint/rule-classes.json` (relative to base): a rule new to the registry — growth allowed; a new `#id` of an already registered `no-restricted-syntax`/`no-restricted-imports` rule — growth limited per file to that rule's messages carrying the new ids, counted by re-linting the file without suppressions. Any other growth of a counter or a new key — fail. This way the ratchet does not leak.
- A new rule is added to the config only with a row in the registry below; a class (c) rule is not added.

**One rule registry for all specs (C1-14).** Every ESLint and stylelint rule from specs 02–05 is a row of this table (or of the stylelint table below); the spec that introduces a rule adds its row here in the same PR that enables it. The machine copy is `config/eslint/rule-classes.json` (`{ "<rule>" | "<rule>#<selector id>": "a" | "b" }`; the `message` of `no-restricted-*` selectors starts with `[<id>]`). `scripts/check-rule-registry.mjs` (in `lint`, introduced by 02-C4) resolves the effective ESLint config of every linted file in both lint modes (`lint` and `lint:full`) and checks it against this table; stylelint coverage comes with spec 05. A rule without an entry or with class c fails.

| Rule | Class | Why |
|---|---|---|
| Prettier (format) | a | `prettier --write` |
| `simple-import-sort/imports`, `simple-import-sort/exports` | a | `--fix` |
| `consistent-type-imports` | a | `--fix` |
| `no-import-type-side-effects` | a | `--fix` |
| `no-unnecessary-type-assertion` | b | mostly `--fix`, but the "type arguments may be inferred from the assertion" report has no autofix; hint (rulebook 70-testing): use `getByRole<HTMLInputElement>(…)` instead of `as` |
| `unused-imports/no-unused-imports` | a | `--fix` |
| `curly: all` | a | `--fix` |
| `react/jsx-boolean-value: never` | a | `--fix` |
| `import-x/no-useless-path-segments` | a | `--fix` |
| `linterOptions.reportUnusedDisableDirectives: 'error'` (instead of `eslint-comments/no-unused-disable`) | a | `--fix` removes the unneeded disable |
| `no-multiple-empty-lines` | a | off in ESLint, fixed by Prettier |
| `no-floating-promises` (`ignoreVoid`) | b | a lost error; message: `return` or `void` |
| `no-misused-promises` (`checksVoidReturn.attributes: true`) | b | a promise where `void`/boolean is expected, including JSX attributes (C1-22); message: `onClick={() => void action()}` |
| `no-unsafe-*` (assignment, member-access, call, return, argument; tests off) | b | `any` leaks into types |
| `no-explicit-any` | b | inv. 6 |
| `ban-ts-comment` | b | inv. 6 |
| `no-non-null-assertion` | b | inv. 6; has a suggestion, not autofix |
| `js.configs.recommended` + `tseslint.configs.recommended` (without stylistic; incl. `no-async-promise-executor`) | b | errors, not style |
| `react.configs.flat.recommended` (`jsx-key` etc.), `react/prop-types: off` | b | render errors |
| `react/no-unstable-nested-components` | b | the component is recreated, loses state |
| `react-hooks` v7 `recommended` (`rules-of-hooks`, `exhaustive-deps`, compiler rules) | b | hook errors |
| jsx-a11y — 6 rules: `alt-text`, `anchor-is-valid`, `aria-props`, `aria-role`, `role-has-required-aria-props`, `no-static-element-interactions` | b | invalid ARIA, an image without `alt`, a link without `href`, a clickable `div` — real accessibility defects; the other `recommended` rules — c |
| `react/jsx-no-literals` + the i18n attribute selector | b | text bypassing i18n = a bug in 3 locales |
| `import-x/no-default-export` (02-C13; exceptions in D5 "default export exceptions") | b | module boundary (D11); message: `export { X }`; the existing violations are suppressions that only shrink (D31) |
| `import-x/no-self-import` | b | import error |
| `import-x/no-cycle` (CI only) | b | boundary |
| ~~`import-x/no-internal-modules` (allow-list)~~ — removed by 02-C12 (D27) | — | slice entry stays enforced by the `boundaries/dependencies` policies; file imports inside a slice and in plain layers are allowed |
| `boundaries/dependencies` | b | layer graph (inv. 1) |
| `boundaries/no-unknown-files` | b | every file under `src/` belongs to a layer element (inv. 1); test support `src/test/` is the element `test`, which only test files may import |
| `no-restricted-imports` (`axios`, runtime `api/` from UI, UI libraries) | b | boundary (inv. 2); runtime `shared/api`/`shared/offline` from UI is held by `boundaries` (element `shared-api`, D5) |
| `no-restricted-imports` `lucide-react` only through `<Name>Icon` exports (02-C4: existing rule recorded in the registry) | b | one import surface for the icon library (spec 05: icons are lucide) |
| `no-restricted-globals` (`localStorage`, `sessionStorage`) | b | the `helpers/localStorage.ts` boundary (inv. 12) |
| `no-restricted-syntax` `ExportAllDeclaration` | b | barrel boundary (D11) |
| `no-restricted-syntax` `<img>`/`styled.img`/`createElement('img')` (`#img-element`, 02-C12) | b | boundary: only `basics/Image` |
| `no-restricted-syntax` `localStorage.clear` | b | wipes the language/theme settings |
| `no-restricted-syntax` `CancelToken` | b | deprecated cancellation API |
| `no-restricted-syntax` `use*Store()` / Zustand `useStore(store)` without a selector (`#store-without-selector`), an object or array literal (or a conditional branch or a `??`/`||` fallback, up to three levels, that yields one; also a `return` inside `if`/`else`) returned by a selector without `useShallow` (`#store-object-without-shallow`; 02-C12, #625). A heuristic: derived values (`.map`/`.filter`, `Object.assign`), named selectors and aliased hooks are not detected | b | extra re-renders / an infinite loop in Zustand 5 |
| `no-restricted-syntax` `TemplateLiteral` in the URL of `apiInstance.*` | b | path safety (01-1 `apiPath`) |
| money selectors (spec 03 §4.3; 03-1 — immediately `error` + suppressions, no `warn`) | b | money |
| `no-restricted-imports` `shared/money/*` (only the module root; 03-1) and `moneyFromWire`/`moneyToWire` only in `entities/*/model/**` (03-4b) | b | money: one place of conversion (inv. 3) |
| `no-restricted-syntax` a literal array in `queryKey` outside `entities/*/api/queries.ts` (03-5) | b | one source of keys |
| `@tanstack/eslint-plugin-query` `recommended` (03-5) | b | query hook errors |
| `no-restricted-imports` `zustand` only in `src/store/**`, `src/app/**`; `zustand/react/shallow` is allowed everywhere (spec 03 §6; C1-18) | b | UI state boundary |
| `no-restricted-properties` `navigator.onLine` outside `src/shared/offline/**` (03-5) | b | one online predicate `isNetworkUsable()` (spec 04 §2.3) |
| `no-restricted-imports` `@vercel/*` except `app/telemetry/vercelAnalytics.ts` (04-2b) | b | provider isolation (D18) |
| ~~`no-restricted-properties` `window.location.pathname` except `getRouterPathname` (04-2g)~~ — withdrawn by D26 | — | there is no `/app/` base path (spec 04 §2.1) |
| `no-restricted-syntax` `ROUTES.HOME\|PRIVACY\|TERMS` (04-2f) | b | links to the site are `SITE_PATHS` |
| `no-restricted-syntax` `i18n.changeLanguage` outside `setAppLanguage.ts` (04-2c) | b | the language is changed in one place |
| ~~`no-restricted-syntax` a string literal `/…(png\|svg\|ico\|webp)` in `apps/app/src` (04-2g)~~ — withdrawn by D26 | — | Vite `base` stays `/` (spec 04 §2.1) |
| `no-raw-colors` (spec 05 §3, 05-5; regex with anchors) | b | tokens |
| `no-restricted-syntax` `style` with ordinary properties (05-5) | b | styles are Radix props or a CSS Module; custom `--x` are allowed |
| `no-restricted-imports` `styled-components` outside the allowlist (05-5), `@radix-ui/colors` (the PR that removes `styled-themes.ts` in the design phase, 05 §3), `\.svg\?react$` outside the allowlist (05-5) | b | styled freeze, tokens, icons are lucide |
| `eslint-comments/require-description` | b | an exception without a reason |
| ~~`no-restricted-syntax` `AwaitExpression`/async~~ (formerly inv. 7) | — | removed by the owner's decision 2026-10-28 (D24): the selector `eslint.config.js:99-122` (18 warnings) is removed by **02-C4** (C2-04, C1-26), the text in `docs/engineering/rules` — by 02-A2 |
| `@typescript-eslint/naming-convention` `handle*` | c | no autofix (manual rename) |
| `naming-convention` `typeLike` PascalCase | c | no autofix |
| `no-restricted-syntax` `React.FC` | c | the fixer of `react/function-component-definition` skips variables with a type (`function-component-definition.js:190`) |
| `react/no-multi-comp` | c | style |
| `no-nested-ternary` | c | style |
| `explicit-module-boundary-types` | c | no autofix; tsc infers types |
| `no-restricted-syntax` accumulator spread in `reduce` | c | style/perf |
| `no-restricted-syntax` `@media … px` | c | style |
| `no-restricted-syntax` `ImportNamespaceSpecifier` | c | style |
| `no-restricted-syntax` `toMatchSnapshot` | c | test style |
| `eslint-comments/disable-enable-pair` | c | style |
| `unused-imports/no-unused-vars` | c | duplicates tsc `noUnused*` |
| `react-refresh/only-export-components` | c | HMR DX only |
| the other `jsx-a11y/recommended` rules | c | no autofix, noise on Radix |
| the other `recommendedTypeChecked` rules (`unbound-method`, `restrict-template-expressions`, etc.) | c | noise without benefit |
| `check-file-layout`: kebab-case/PascalCase names, `__tests__`, `*Props` in `types.ts` | c | no autofix; the script keeps only the `index.ts` depth (where an `index.ts` may exist; not an import rule, see D27) and the ban on new `useConnect.ts` (b) |

Stylelint (introduced by 05-5, spec 05 §3; the same registry, C1-14):

| Rule | Class | Why |
|---|---|---|
| `color-no-hex`, `color-named: 'never'`, `function-disallowed-list` (rgb/hsl/…) | b | a raw color bypassing tokens (D23); message: `var(--cp-*)` |
| `declaration-property-value-disallowed-list` `var(--(?!cp-\|_)` | b | only `--cp-*` and local `--_*` |
| `csstools/value-no-unknown-custom-properties` | b | a typo in a token name |
| `selector-disallowed-list` `.rt-*` (except `radixStylesOverwrite.css`) | b | Radix boundary |
| `reportDescriptionlessDisables` | b | an exception without a reason |
| `unit-disallowed-list` `px`, `media-feature-name-value-allowed-list` (breakpoints) | c | no autofix — **not introduced**; the Radix breakpoints remain a convention in `docs/design-system` |

## Context

**Important: audit 03 looked at an outdated branch** `chore/issue-456-ds-gallery` (3d0086e). The canonical branch is now `master` (522973a, cutover FE#497). On `master`:
- the rules live in `docs/engineering/rules/*`, not in `docs/codex/rules/*`; `docs/codex/review-instruction-loading.md` has already been deleted;
- `CLAUDE.md` is a file with an `@AGENTS.md` block, not a symlink;
- there are **no** deploy workflows: delivery = Vercel Git integration + a manual Promote (DEPLOYMENT.md "Vercel delivery from master"). The finding "two deploy workflows" (03-tooling-rules.md:125-126) is outdated;
- `src/`, `package.json`, `eslint.config.js`, `tsconfig*`, `vite.config.ts` match the audit branch (git diff is empty), so all audit counters for the code are current.

All paths below are given for `master`.

| Problem | Where in the audit |
|---|---|
| The rules are duplicated in 4–5 files and contradict each other | 03-tooling-rules.md:9, §5 (R1–R4, P1–P15) |
| "CI checks formatting" is untrue, Prettier is not installed | 03-tooling-rules.md:10, :106-111 |
| 112 warnings, CI lets them through | 03-tooling-rules.md:23-32, :130 |
| No type-aware rules, jsx-a11y, layer boundaries | 03-tooling-rules.md:16, :61-68 |
| import-sort does not know 4 aliases | 03-tooling-rules.md:14, :47 |
| typecheck does not see ds-gallery and the vite configs; `verbatimModuleSyntax` diverges | 03-tooling-rules.md:15, :72-90 |
| `version:check` only in pre-push | 03-tooling-rules.md:129 |
| Dead dependencies, icons on every build, the vendor-react regex | 05-deps-styling.md:12-16, :35-36, :63-66 |
| Layer violations (~30 imports), 144 barrels | 01-architecture.md:23-59; 00-synthesis.md B |

Measurements of this spec (read-only, on `src` = `master`):
- `tsc --noUncheckedIndexedAccess`: **39 errors in 21 files** (23 of them in tests);
- `tsc --verbatimModuleSyntax`: **31 errors**;
- type-aware ESLint over `src`: `no-floating-promises` 35 (34 in prod code), `no-misused-promises` 28 (18), `consistent-type-imports` 34 (all autofix), `unbound-method` 70 (all in tests), `no-unsafe-assignment` 35 (29 in tests). Run time about 7 s;
- Prettier with the current `.prettierrc.cjs`: **317 of 737** `src` files differ;
- `export default`: 172 files (173 on `master` 2026-11-10), 314 places of `import X from '<local module>'`, 14 `React.lazy`, 25 tests with `vi.mock(..., () => ({ default }))`;
- `index.ts`: 147 files; 38 at slice level (`src/<layer>/<slice>/index.ts`), 4 root ones for a layer, **105 nested** (re-measured in 02-C12; was 144/37/103) (#573, 2026-11-02, added 2 nested `index.ts` and 2 `useConnect.ts` after this spec was written);
- `useConnect`: 19 files (re-measured in 02-C12; was 17); 34 prod files reference them (19 call the hook, 15 `index.ts` re-export it; re-measured in 03-5 / #625, the earlier "47 references" was the count when the spec was written); `useShallow`: 40 files;
- `Number(`/`parseFloat(` in prod code: 21 calls in 5 files.

## Decision

1. **Rulebook.** `AGENTS.md` contains 15 invariants, commands and links. The full rulebook is only `docs/engineering/rules/*`. `.ai/context.md`, `.ai/decisions.md` and `docs/engineering/code-review.md` are deleted. The process (lifecycle, admission, Trello, completion) is described in `syllik/ai-workflow` and `ChipIn-one/.github`; only links remain here.
2. **Check classes.** Every rule has exactly one class:
   - `LINT` — ESLint/tsc;
   - `CI` — a script or test in `verify:full`;
   - `REVIEW` — a semantic invariant from the AGENTS.md list (money, auth, offline, concurrency) that a machine cannot check;
   - `DELETE` — the rule is removed.
   A style rule without `LINT` is removed.
3. **Tooling:**
   - ESLint type-aware (`projectService`), import-x, jsx-a11y, boundaries;
   - Prettier, which owns formatting;
   - `--max-warnings 0`. Every rule has the level `error` or `off` and a class a/b from §D0; known violations are in `eslint-suppressions.json` (native ESLint suppressions), maintained by `npm run baseline:update`, and this list can only shrink;
   - husky: pre-commit is fast (lint-staged, only `--fix`, does not block); no pre-push; only CI blocks;
   - CI checks the format, the version and the typecheck of all TS files.
4. **Version (D15).** Tasks do not touch `version`. The bump is done only in the release PR before Promote. CI forbids changing the version in other PRs.
5. **Deploy (D15).** The only path is Vercel Git + Promote. It is already documented in `DEPLOYMENT.md`. The duplicate is removed from AGENTS.md, a link remains.

## Details

### D1. Files: what stays and what goes

| File (master) | Fate | Note |
|---|---|---|
| `AGENTS.md` | **rewrite** (≈70 lines) | structure in D2 |
| `CLAUDE.md` | keep as is | the `ai-workflow:claude-routing` block is managed by ai-workflow |
| `.ai/context.md` | **delete** | all content duplicates AGENTS.md (03:210). Dependency: a PR in ai-workflow after which step 4 of the routing block reads `.ai/context.md` only "if it exists" |
| `.ai/decisions.md` | **delete** | an empty stub (03:223) |
| `docs/engineering/rules/00…70` | **stay as the only rulebook**; edits per the D3 table | language — English, as now |
| `docs/engineering/code-review.md` | **delete** | the lifecycle duplicates ai-workflow. The "review focus" list is folded into the AGENTS.md invariants |
| `docs/engineering/pr-metadata.md`, `release-qa.md`, `frontend-production-completion-canary.md` | keep | process, not code rules; AGENTS.md links to them |
| `docs/api-notes/*`, `docs/architecture/modal-router.md`, `docs/contract-tests.md` | keep | reference |
| `README.md` | rewrite the commands section | remove the boilerplate Vite/Babel text and the line "vercel-build: full test suite" (03:202) |
| `.codex/config.toml` | keep | sandbox settings, not rules |
| `docs/superpowers/specs/*` | keep, **the place for approved design specs** | see the "plan/spec" conflict in D4 |
| `docs/superpowers/plans/*` (2 tracked) | keep as history | new plans are not committed |

### D2. The new `AGENTS.md`

Structure:
1. `# AGENTS.md` and 2 lines about the stack: "Vite 8, React 19, TS strict, Radix Themes, i18next, PWA; we do not change backend contracts without an explicit request".
2. `## Invariants` — the list below, verbatim.
3. `## Commands` — 7 lines: `test:task`, `fix` (prettier + eslint `--fix`), `verify`, `verify:full`, `typecheck`, `version:check`, `baseline:update`.
4. `## Process` — 4 links: ai-workflow FLOW, the org issue-intake contract, `docs/engineering/release-qa.md`, the completion canary. Plus one line: "A FE Issue is not closed by hand; after the merge into `master` it waits in `Awaiting release`".
5. `## Review` — "An independent reviewer checks invariants 1–15 and the presence of regression tests for the changed logic. The reviewer does not comment on style, formatting, import order and anything CI catches." The section is self-contained: the reviewer is not required to open links.
6. The block `<!-- ai-workflow:agents-routing:start/end -->` unchanged (managed by ai-workflow).

Invariants (verbatim, exactly 15):

```markdown
## Invariants

1. Layers import only downward along one graph: app → pages → features → components → hooks → store → entities → helpers → shared → api → base (constants, types, i18n, styles, assets); basics sits between components and helpers; `shared` splits into `shared-api` (`shared/api`, `shared/offline`: only hooks, store, entities, app) and `shared-lib`. The only source of the graph is `config/eslint/layers.js` (the table in spec 02 D5), `docs/engineering/rules/10-architecture.md` is generated from it; checked by `boundaries/dependencies`.
2. UI (pages, features, components, basics) and helpers do not call the runtime API, `axios`, `shared/api` and `shared/offline`; server data comes through the query layer (`entities/*`) or a store. Checked by `boundaries` (element `shared-api`) and `no-restricted-imports`.
3. Money in code is `Money { minor: bigint }` (ledger units scale 4); on the wire it is a JSON number scale 4 (D21). The wire boundary has two layers: the transport `shared/api/wireJson.ts` (only inside the `api()` wrapper) parses the body without doubles into an opaque `WireAmount` and writes outgoing amounts as decimal literals, but does not interpret amounts; the `WireAmount` ↔ `Money` conversion is only `moneyFromWire`/`moneyToWire` in the `entities/*/model` mappers (`toX()`/`toXWire()`). Input parsing, rounding, sums and formatting are only in `src/shared/money/`; `parseFloat`/`Number()`/`JSON.parse` on money fields outside it are forbidden (lint, spec 03 §4.3). Display is only `basics/numbers/amount/Amount.tsx`.
4. The server is the source of truth for finances: we do not patch balances/debts locally; a mutation is repeated only by the outbox loop `runOutboxOp` (spec 03 §2.4); all TanStack mutations have `retry: false`, the online path is `ledgerOnlineMutationKeys` (`networkMode: 'online'`); a stale response does not overwrite a newer state.
5. Creating/editing/deleting expenses is only through `entities/ledger/api/mutations.ts` (selector by `offlineWritesAvailable`: online keys or the outbox); offline only through the outbox with a client UUID and `entryKind: 'expense'` (enabled by 03-17 behind a flag and backend capabilities; until then there are no offline writes). Settle-up and payments, including editing and deleting a settlement, are forbidden offline (`ONLINE_ONLY_ACTIONS`, `<OnlineOnly>`).
6. Types: no `any`, `as any`, `@ts-ignore`, unjustified `as` and `!`; type-only imports are `import type`. Data from IndexedDB, the outbox, and localStorage is validated on read (zod, except the landing-path `LocalUser` reader, which is hand-written for bundle size).
7. Promises are not lost: every promise is returned, `await`-ed or explicitly marked `void`; errors are not swallowed. The `await` or `.then` style is free (the async/await ban was lifted by the owner on 2026-10-28, D24). Checked by `no-floating-promises` and `no-misused-promises` (both `error`, JSX attributes too: `onClick={() => void action()}`).
8. Only named exports; no more than one `index.ts` per slice, no `export *`.
9. Server state is TanStack Query; Zustand is UI state. Server stores that spec 03 has not migrated yet are transitional: we do not create new ones, we do not add new server-data fields to them. One value is read with a selector, several with one object selector with `useShallow`; `useStore()` without a selector and new `useConnect` are forbidden.
10. Before committing — `npm run fix` (Prettier + `eslint --fix`). Lint errors after it are only correctness and boundaries; their message says how to fix. There are no style rules without autofix; `eslint-disable` — only with a reason.
11. All user-facing text, including `aria-*`, `placeholder`, `title` and toasts, goes through i18n into all locales. Interactive elements are native elements or Radix, icon buttons have a translatable name (review; lint — the 6 jsx-a11y rules from §D0).
12. `localStorage`/`sessionStorage` only through `helpers/localStorage.ts`. Tokens, invite tokens and personal data do not get into logs, Sentry and URLs; logout clears all user data (cache, outbox, the user's `id`/`role`); only the UI settings of language and theme are kept.
13. Formatting is Prettier, import order is `simple-import-sort`; we do not fix style by hand, CI fails on any warning.
14. A task does not change `version` in package.json; the bump is done only in the release PR (CI `version:check`).
15. A change to the domain, API or visible behavior starts with the KB: `chipin-knowledge-base/common/glossary.md` and `common/specs/<capability>.md`; tests are named by requirement ids. If the KB is unavailable both locally and through GitHub — BLOCKED.
```

### D3. Every rule of `docs/engineering/rules` and its fate

Notation: `L:<rule>` — LINT, `CI:<script>`, `R` — REVIEW (invariant N), `RW` — rewrite (how exactly — in the column), `DEL` — delete. A number like `00.TS.3` means the third item of the TypeScript section in file 00.

| ID | Rule (short) | Decision |
|---|---|---|
| 00.TS.1 | strict types at boundaries, inference of local values | DEL (not checked; this is `strict` behavior anyway) |
| 00.TS.2 | explicit return type on exports and actions | DEL (§D0: no autofix, tsc infers types); remove the mention of `useConnect` |
| 00.TS.3 | `unknown` for untrusted data | R (inv. 6) |
| 00.TS.4 | no `any`/`as any`/ts-ignore/`!` | `L:no-explicit-any`, `ban-ts-comment`, `no-non-null-assertion`, `no-unnecessary-type-assertion` |
| 00.TS.5 | prefer `satisfies` | DEL |
| 00.TS.6 | `import type` | `L:consistent-type-imports` + tsc `verbatimModuleSyntax` |
| 00.TS.7 | discriminated unions instead of a set of booleans | DEL (taste) |
| 00.TS.8 | closed sets of strings — an `as const` object | DEL |
| 00.TS.9 | `Api*` names not in UI | RW → "UI imports domain types". After D4 it is checked by `boundaries` (UI does not import `api/generated/**`) |
| 00.TS.10 | no indexed-access types in props | DEL |
| 00.Naming.1 | PascalCase/camelCase/UPPER_SNAKE | DEL (§D0: `naming-convention` without autofix) |
| 00.Naming.2–3 | kebab-case directories, PascalCase.tsx | DEL (§D0: no autofix) |
| 00.Naming.4 | boolean `is/has/can/should` | DEL (the "when practical" caveat is not checked) |
| 00.Naming.5 | no boolean negations | DEL |
| 00.Naming.6 | `on*`, no `handle*` | DEL (§D0: manual rename, no autofix) |
| 00.Naming.7–8 | names by business meaning, descriptive iterators | DEL |
| 00.Promises.1 | no async/await | DEL (owner's decision 2026-10-28, D24); delete the repository's current rule in 02-A |
| 00.Promises.2 | an async action returns `Promise<T>` | DEL (`promise-function-async: off`) |
| 00.Promises.3 | flat chains | DEL |
| 00.Promises.4 | do not swallow errors | `L:no-floating-promises`; semantics — R (inv. 7) |
| 00.Promises.5 | read-actions resolve, "no `void` wrappers" | **RW**: "an intentionally not awaited promise is marked `void`" — otherwise it conflicts with `no-floating-promises` |
| 00.Promises.6–9 | `.finally` for cleanup, `Promise.all`, no `new Promise`, do not mix styles | DEL (6, 7); `L:no-async-promise-executor` for 8; 9 — DEL (style is free, D24) |
| 00.Collections.* (8 items) | one pass, `for...of`, no spread in reduce, `Map` for lookup | RW → compress to 3 lines, no lint (§D0); the rest DEL |
| 00.Modules.1 | named exports | `L:import-x/no-default-export` (exceptions in D5) |
| 00.Modules.2 | `index.ts` format | RW (D11): one barrel per slice, `export { … } from` is allowed, `export *` is forbidden — `L:no-restricted-syntax ExportAllDeclaration` + `CI:scripts/check-file-layout.mjs` (new, ≈40 lines; only: an index.ts deeper than the slice is forbidden, new `useConnect.ts` are forbidden) |
| 00.Modules.3 | directory boundary via index | RW → "slice boundary via its index"; `L:boundaries/dependencies` slice policies (D5; `import-x/no-internal-modules` from 02-C9 is removed by 02-C12, D27) |
| 00.Modules.4 | early returns | DEL |
| 00.Modules.5 | no nested ternaries | DEL (§D0) |
| 00.Modules.6–8 | abstractions, function size, comments in English | DEL |
| 00.Modules.9 | TODO when a fix is deferred | DEL |
| 00.Modules.example | `import AddExpenseModal from` | RW → a named example (conflict R2) |
| 00.Touched | touched-code rule | RW → one line in 70 §Legacy |
| 10.Direction.* | layer graph, helpers without store | `L:boundaries/dependencies` (D5); `features/routing` is an `app` element, so routing → pages is allowed until the move to `src/app/router` (04-2a), it does not go into suppressions (C1-24) |
| 10.Ownership.1–2 | local state; Zustand only for shared | RW (D3): "Zustand is only UI state, server state is TanStack Query" |
| 10.Ownership.3 | runtime API not from UI | `L:no-restricted-imports` (already exists) |
| 10.Ownership.4–6 | DTO at the boundary, side effects, contracts | R (inv. 2, 4) |
| 10.Placement.* (5) | narrow layer, no extra services, do not move folders | DEL, except "narrow layer" → R |
| 10.Recursive.* | recursive structure `components/ internal/ styled.ts types.ts` | RW (D11): `internal/` and `components/` without their own index.ts; `types.ts` only for types with ≥2 consumers; `styled.ts` stays until D14 |
| 10.DirNaming.* | kebab-case, no parent compat files | DEL (§D0) |
| 10.Ownership(dir).* | Props in `types.ts`, `internal/useConnect.ts` | **RW** (conflicts R3, R4): Props in the component file; delete `useConnect` |
| 10.Index.* (9) | index in every directory, deep imports forbidden | RW (D11, D27): only `src/<layer>/<slice>/index.ts`; inside a slice — relative imports of files; another slice (`features/*`, `entities/*`) — only through its index; plain layers (`basics`, `components`, `helpers`, …) — direct file imports |
| 10.InternalExports | helpers by name, `import * as helpers` forbidden | DEL (§D0) |
| 10.Tests.* | co-location, no `__tests__` | DEL (§D0) |
| 10.Adoption | rules for new/touched code | RW → 70 §Legacy |
| 10.StoreLayout.* | `<domain>-store/{actions,types,…}` | RW (D3): UI stores live in `store/ui-prefs/<name>Store.ts` (spec 03 §6, spec 05 `appearanceStore`); server stores are removed by the TanStack migration, we do not introduce a separate layout for them (A-35) |
| 10.CrossStore.* | no writing to another store, orchestrator | R (inv. 4); after D3 the rule lapses |
| 10.ChangeScope | do not change behavior along the way | DEL (a general ai-workflow principle) |
| 20.Components.1 | pure render | `L:react-hooks` (compiler rules, already exist) |
| 20.Components.2 | no `React.FC` | DEL (§D0: the fixer of `react/function-component-definition` does not touch variables with the `FC` type) |
| 20.Components.3 | one component per file | DEL (§D0) |
| 20.Components.4 | Props in the component file | RW (D11): the convention "Props in the component file, right above the component" remains as rulebook text without lint (§D0: the check is removed, not the convention); the "Props in `./types`" variant is removed (C1-17) |
| 20.Components.5 | named exports | `L:import-x/no-default-export` |
| 20.Components.6 | no components inside render | `L:react/no-unstable-nested-components` |
| 20.Components.7–8 | minimal props, boolean defaults to false | `L:react/jsx-boolean-value` (never) for part 8; the rest DEL |
| 20.Components.9 | `on*` | DEL (§D0) |
| 20.State.* (4) | a single source, no copies in state, derived in render | DEL (react-hooks compiler rules partly catch this: `set-state-in-effect`) |
| 20.Effects.1–4 | effects only for external systems, deps, no API | `L:react-hooks/exhaustive-deps` (error); the rest R |
| 20.Effects.5 | ignoring a promise in an effect | **RW**: the example `void fetchSetGroups();` |
| 20.Hooks.* (4) | `use*`, pure helpers are not hooks | `L:react-hooks/rules-of-hooks`; the rest DEL |
| 20.StoreConn.* (11) | `useConnect` for ≥2 subscriptions | **DEL entirely** (D12). 40.Sel instead |
| 20.Perf.1–4 | no memo by default | DEL (React Compiler in react-hooks v7 makes this rule obsolete) |
| 20.Perf.5–6 | heavy forms, row view-models | DEL (moves to spec 03 §6, step 6: 03-13/03-14) |
| 20.Decomp.* | split by responsibility | DEL |
| 30.Radix.1–3 | Radix first, styled only if impossible | R → RW per D14 (spec 05 §3 "Radix props first") |
| 30.Radix.4 | no new UI libraries | `L:no-restricted-imports` (patterns `@mui/*`, `@chakra-ui/*`, `antd`, `tailwindcss`, `@emotion/*`) |
| 30.ZIndex.* (5) | no global z-index scale | DEL (3 usages, taste) |
| 30.Responsive.1–5 | Radix responsive props | DEL |
| 30.Responsive.6 | no hardcoded `767px` in media | DEL (§D0) |
| 30.Colors.1–4 | `themeColor()`, no hex | RW per D14 (`var(--cp-*)`); lint is introduced by **05-5** (A-17): `no-raw-colors` is not a plugin but a `no-restricted-syntax` block in `config/eslint/project.js`; the regex (with anchors, C1-21), selectors, exceptions and fixtures are only in spec 05 §3; for CSS/`<style>` — stylelint (the §D0 table). The rule text changes in 05-5 |
| 30.Colors.5 | transient `$prop` | DEL |
| 30.ClassName.* | no className/style | `style` with ordinary properties is forbidden, custom properties (`--x`) are allowed — the selector from spec 05 §3 (05-5); className — DEL (CSS Modules per D14 require it) |
| 30.A11y.1–6 | semantics, names, label, dialog title | `L:` the 6 jsx-a11y rules (§D0) + R (inv. 11) |
| 30.Images.* | `basics/Image` instead of `<img>` | `L:no-restricted-syntax JSXOpeningElement[name.name='img']` outside `basics/Image.tsx`; `styled.img` — the same selector via `MemberExpression` |
| 30.i18n.1 | all text through i18n | `L:react/jsx-no-literals` (JSX children) + `no-restricted-syntax` on user-facing attributes (D5) |
| 30.i18n.2 | keys in all locales | `CI:` a locale key parity test — introduced by 04-2c (the only owner); only a link here |
| 30.Money.1–2 | Amount, AmountInput | R (inv. 3) + the money `L:no-restricted-syntax` from spec 03 §4.3 (`toFixed`/`Intl.NumberFormat` outside `src/shared/money/**` and `src/shared/lib/formatNumber.ts`) |
| 30.Split.* (2) | stable sizes of split rows | DEL from the rulebook → into spec 03 §6 (03-13/03-14) |
| 30.Landing (now in AGENTS.md:23-28) | synchronize `*PagePreview` | move to 30-ui as R; removed by spec 04 together with the landing |
| 40.Choice.* (8) | when to use Zustand | RW (D3): "Zustand = UI state; server state = Query" |
| 40.Loading.* (8) | loadingStore/errorsStore | RW (D3): in effect until the store is migrated; deleted after migration |
| 40.Sel.1 | no `useStore()` without a selector | `L:no-restricted-syntax CallExpression[callee.name=/^use\w+Store$/][arguments.length=0]` |
| 40.Sel.2–3 | one value — a selector, several — an object + `useShallow` | **keep (D12)**; `L:` — `no-restricted-syntax#store-object-without-shallow`, as defined in the §D0 row (not restated here). The ban on `useConnect.ts*` files — `CI:check-file-layout` with a baseline of 19 files |
| 40.Sel.4–8 | do not group unrelated, named selectors in `selectors.ts`, stability | R/DEL: stability — R; the rest DEL |
| 40.Sel.9 | no `getState()` in render | DEL (the react-hooks compiler `purity` partly catches it) |
| 40.Updates.* (5) | immutability, functional `set` | DEL (after D3 there are no server updates in Zustand) |
| 40.Naming (table) | `fetchSet*`, `create*`… | RW (D3): a naming table for query/mutation hooks `use<Entity>Query`, `use<Verb><Entity>Mutation` |
| 40.Async.* (8) | stale/concurrency for actions | RW (D3): replaced by the Query rules; inv. 4 |
| 40.Coord.* (5) | store coordination | DEL after D3; R before it |
| 50.Boundary.* | UI → store → api | `L:boundaries` + `no-restricted-imports` |
| 50.Modules.* | namespace import of the API | `L:no-restricted-imports` (`importNames` for `api/*`) → RW per D4 (generated client) |
| 50.Naming (table) | API function names | RW (D4) |
| 50.Axios.* (8) | generic, mapper, Input/Request/Response | RW (D4): types from OpenAPI; manual `Request/Response` forbidden; zod only at stale-format boundaries |
| 50.Payloads.* (4) | 0/false/null, params | R (inv. 4) + `L:no-restricted-syntax` on URL concatenation (`TemplateLiteral` in the first argument of `apiInstance.*`) |
| 50.Errors.* (6) | errors are not duplicated, interceptors | R |
| 50.Cancel.* (6) | AbortSignal, no mutation retry | R (inv. 4) + `L:no-restricted-syntax` `CancelToken` |
| 50.OnlineFirst.* (6) | refetches after mutations | RW (D3): replaced by `invalidateQueries`; the refetch table — spec 03 §2.2 |
| 50.Activity | link to api-notes | keep |
| 60.Money.1 | **"money = JS Number"** | **DEL — conflict R1 → D21**: `Money` with `bigint` scale 4, the module `src/shared/money/` (spec 03 §4) |
| 60.Money.2 | no integer minor units | **DEL — contradicts D21/spec 03** (arithmetic in `bigint` ledger units scale 4, like the backend) |
| 60.Money.3–7 | Amount, backend is the source of truth, conversion | R (inv. 3, 4) |
| 60.Offline.* (7) | local lifecycle, idempotency | RW (D2): outbox + client UUID; delete "do not invent an outbox" |
| 60.Input.* (5) | amount as a string, `Number.isFinite` | RW (D21): parsing only `parseMoneyInput` / `moneyFromWire` (spec 03 §4.2) |
| 60.Rounding.* (7) | no intermediate rounding | RW (D21): rounding `roundToMinor` (half-up away from zero to the currency's minor units) only for display, inside `src/shared/money/` |
| 60.UI.* (4) | output through Amount | `L:` see 30.Money |
| 60.Dates.* (6) | time units, `Intl.DateTimeFormat` | DEL, except "do not store `Date` in a store" → R |
| 60.Helpers.* (6) | pure helpers | `L:boundaries` (helpers without store, `api`, `shared-api`; D5) + R |
| 60.Storage.1 | localStorage only through the helper | `L:no-restricted-globals` (+ `sessionStorage`) |
| 60.Storage.2–8 | key schema, guard, try/catch | RW (D4): a zod schema on read; `localStorage.clear()` — `L:no-restricted-syntax` |
| 70.Stack, When, Shape, Priority | test stack | keep; async/await in tests is allowed (D24); `toMatchSnapshot` — DEL (§D0) |
| 70.Commands | commands | RW: the current list of scripts (D7) |
| 70.Integration (12 items) | lifecycle, version:bump, `@codex review` | **DEL entirely** (duplicates ai-workflow; P1–P4) |
| 70.Legacy.* (4) | baseline, "warn → error after zero" | RW: "levels are only error/off; the baseline is `eslint-suppressions.json` (native ESLint suppressions), it only shrinks, updated by `npm run baseline:update`; entries are added only by the PR that enables the rule" |

### D4. How the conflicts from the audit matrix are resolved (03-tooling-rules.md §5)

| Conflict | Decision |
|---|---|
| R1 money: Number vs the `Number()` ban | D21 (D10 withdrawn): the domain is `Money { minor: bigint }` scale 4, the wire is forever a JSON number scale 4 (the backend is the source of truth), conversion only at the API boundary, arithmetic in `bigint` ledger units. 60.Money.1–2 are deleted. The set of lint selectors and ignores (`src/shared/money/**`, `src/shared/lib/formatNumber.ts`, tests) is **the only one, in spec 03 §4.3** (03-1 immediately introduces `error` + `eslint --suppress-rule` for the known ~29 places; 03-3 and the migration PRs remove the entries; C2-03); this spec does not duplicate it. Non-monetary exceptions — `// eslint-disable-next-line no-restricted-syntax -- not money: <reason>`; `eslint-comments/require-description` requires a reason |
| R2 exports: "prefer named" vs examples with default | D11. Only named; all examples in 00 and 10 are rewritten. Lint `import-x/no-default-export` |
| R3 Props: the component file vs `./types` | D11. In the component file, right above the component. The examples 00:139 and 10:96,137 are rewritten. `types.ts` — only for types with ≥2 consumers |
| R4 store reads: `useShallow` vs `useConnect` vs separate selectors | D12. One object selector with `useShallow`; the example 40:54-55 is rewritten; section 20 "Component Store Connections" is deleted |
| P2/P3/D15 version: who bumps, "pre-1.0" | Tasks do not bump. The release PR `chore/issue-<n>-release-v<x.y.z>` runs `npm run version:bump -- <patch\|minor\|major>`; it is done by the Trusted Publisher or the owner, never by the Executor. The CI rule is in D7. The phrases "Version impact in every task prompt" and "major rejected pre-1.0" are deleted |
| P7 KB missing: fallback vs a mandatory clone | One rule (inv. 15): (1) `../chipin-knowledge-base`, if present; (2) otherwise `git clone` there, if git and network are available; (3) otherwise reading through authenticated GitHub; (4) otherwise BLOCKED. KB copies in the repo are forbidden |
| P8 plans/specs: `docs/specs/` does not exist, `.gitignore` ignores tracked files | Approved design specs are committed to `docs/superpowers/specs/<YYYY-MM-DD>-<slug>.md`. Plans are not committed (`docs/superpowers/plans/` stays in ignore). Implementation invariants go into the corresponding chapter of `docs/engineering/rules/`. `.gitignore`: delete `docs/superpowers/*`, `/docs/superpowers/specs/`, `/docs/engineering/plans/`, `/docs/engineering/specs/`; keep `/docs/superpowers/plans/` and `/.superpowers/` |
| P4 `@codex review` | Already removed on master; verify with grep in 02-A2 |
| P10 "CI checks the format" | Becomes true after 02-C1…02-C3 (Prettier + `format:check` in `verify`) |
| P11/P12/P13 Vite 7, Trello, the local absolute path `Canonical root` | Vite 8 in the header; Trello — one line in ai-workflow, delete from AGENTS.md; the `Canonical root` path sits inside the ai-workflow routing block → an issue in ai-workflow |
| T2/T3 what verify:full / vercel-build do | The description from D7 is the only one, in 70 §Commands and the README |

### D5. ESLint: the target inventory

Structure (monorepo readiness, D9):

```
eslint.config.js          // 15 lines: assembles the presets, sets APP_DIR = '.'
config/eslint/aliases.js  // reads paths from tsconfig.app.json via the typescript API — the only list of aliases
config/eslint/base.js     // js + tseslint recommended + an explicit list of type-aware rules (D0), prettier, import-x, unused-imports, sort
config/eslint/react.js    // react, react-hooks, jsx-a11y, i18n
config/eslint/layers.js   // boundaries + no-restricted-imports
config/eslint/project.js  // ChipIn rules: money, img, storage, the helpers restrictedSyntax()/restrictedImports()
config/eslint/rule-classes.json // machine copy of the §D0 registry (rule → a|b)
eslint-suppressions.json  // in the root: native ESLint suppressions (the baseline), only shrinks
```

New devDependencies (versions as of 2026-10-28, install with `^`):
- `eslint-plugin-jsx-a11y@6.10.2`, `eslint-plugin-import-x@4.17.1`, `eslint-import-resolver-typescript@4.4.5`, `eslint-plugin-boundaries@7.4.0`;
- `@eslint-community/eslint-plugin-eslint-comments` (latest);
- `prettier@3.9.10`, `eslint-config-prettier@10.1.8`, `lint-staged@17.6.0`.

Rules (all `error` unless stated otherwise; the class of each is in §D0, class c rules are already off here):

| Group | Rule / setting |
|---|---|
| ignores | `dist`, `dev-dist`, `coverage`, `node_modules/.cache`, `.claude/**`, `public/**`, `ds-gallery/standalone.html` |
| languages | `src/**` and `ds-gallery/**` — browser globals; `scripts/**`, `*.config.*`, `contract-tests/**`, `ds-gallery/build-html.mjs` — node globals |
| type-aware | the explicit list from §D0 (`no-floating-promises`, `no-misused-promises`, `no-unsafe-*`, `no-unnecessary-type-assertion`), not the whole `recommendedTypeChecked`; `parserOptions.projectService: true`, `tsconfigRootDir: import.meta.dirname`; for `**/*.{js,mjs}` — `disableTypeChecked` |
| promises (inv. 7 — also for loaders/scripts; the `await`/`.then` style is free, D24) | `no-floating-promises` (`ignoreVoid: true`), `no-misused-promises` (`checksVoidReturn: { attributes: true }` — `onClick={() => promise}` is also an error with the hint `onClick={() => void action()}`; C1-22), `promise-function-async: off`, `require-await: off` |
| tests override | `**/*.test.{ts,tsx}`: `unbound-method: off`, `no-unsafe-assignment: off`, `no-unsafe-member-access: off` (vi.fn/expect patterns); `unbound-method` is not enabled at all |
| types | `consistent-type-imports` (`fixStyle: 'inline-type-imports'`), `no-import-type-side-effects`, `no-unnecessary-type-assertion`, `no-non-null-assertion` |
| unused | `@typescript-eslint/no-unused-vars: off` (removes the double report, 03:46), `unused-imports/no-unused-imports` (autofix); unused variables are caught only by tsc `noUnused*` |
| prettier | `eslint-config-prettier` last; `no-multiple-empty-lines` and `curly` — keep `curly: all` (prettier does not touch it) |
| import-sort | `simple-import-sort/imports` and `/exports`. Groups: `['^node:']`, `['^react$','^react-dom$','^@?\\w']`, then **one group assembled from all tsconfig aliases** in layer order: `^(app\|bootstrap\|pages\|features\|entities\|store\|api\|shared\|hooks\|helpers\|constants\|i18n\|types\|public-routes)(/\|$)`, `^(components\|basics)(/\|$)`, `^(assets\|styles)(/\|$)`, `['^\\.\\.']`, `['^\\.']`, `['\\.s?css$']`. The regexes are built in `aliases.js` from `paths` — there is no manual list |
| import-x | `import-x/no-default-export`; `import-x/no-cycle` (`maxDepth: 3`, only in the full mode `CHIPIN_ESLINT_FULL=1` — expensive; it is set by the `lint:full` script itself, so the local `verify:full` and CI see the same thing, C1-23; introduced by 02-C9 with suppressions for the known cycles `groupsStore`↔`activity-store`, `expenseModalStore`↔selectors); `import-x/no-useless-path-segments`; `import-x/no-self-import` |
| default export exceptions | `*.config.{js,ts,mjs}`, `eslint.config.js`, `vite.config.ts`, `vitest*.config.ts`, `ds-gallery/vite.config.ts`, `pwa-assets.config.ts`, `**/*.d.ts`. Route modules need no exception: D6 `lazy` expects a named `Component`. Until D6 — `React.lazy(() => import('pages/X').then((m) => ({ default: m.X })))` |
| react | `react.configs.flat.recommended` + `jsx-runtime`; `react/no-unstable-nested-components`, `react/jsx-boolean-value: never`, `react/prop-types: off` |
| react-hooks | `recommended` (v7); `exhaustive-deps: error` |
| a11y | without `recommended`; only `alt-text`, `anchor-is-valid`, `aria-props`, `aria-role`, `role-has-required-aria-props`, `no-static-element-interactions` (§D0); `no-autofocus` is not enabled (modals) |
| i18n | `react/jsx-no-literals`: `noStrings: true`, `ignoreProps: true`, `noAttributeStrings: false`, `allowedStrings: [' ','-','+','/','~','·']` — catches text in JSX children. User-facing attributes are caught by `no-restricted-syntax` on `JSXAttribute[name.name=/^(aria-label\|aria-description\|placeholder\|title\|alt)$/] > Literal[value=/\\w/]` (A-38: `elementOverrides` works per element, not per attribute). `ds-gallery/**` is excluded (demo literals); `**/*.test.{ts,tsx}` is excluded from the attribute selector only (test-harness markup is not user-facing, 02-C8) |
| naming | none (§D0: `naming-convention` without autofix is removed, including the current `handle*` selector) |
| project | `no-restricted-syntax`: `ExportAllDeclaration`, `<img>`, `localStorage.clear`, `CancelToken`, an object literal in `use*Store(...)` without `useShallow`, `use*Store()` without an argument; every selector has a `message` with a ready fix. The money selectors — spec 03 §4.3, the color ones — spec 05 (05-5); all `no-restricted-syntax`/`no-restricted-imports` blocks are assembled by the helpers `restrictedSyntax()`/`restrictedImports()` from `config/eslint/project.js` (introduced by 02-C4), because in a flat config a later block replaces the rule's options entirely |
| globals | `no-restricted-globals`: `localStorage`, `sessionStorage` (except `helpers/localStorage.ts`) |
| ignores (generated files) | ESLint and Prettier ignore `src/shared/api/generated/**`, `eslint-suppressions.json`: the generator writes the result itself (C1-20). `vercel.json` and `packages/tokens/tokens.css` are hand-written (D31) and are formatted like any other file |
| imports | `no-restricted-imports`: `axios` (except `src/api/chipin.{instance,interceptors}.ts`, after 03-4b — `src/shared/api/http.ts`), runtime `api/` from UI (as now, `allowTypeImports`), UI libraries (30.Radix.4). Delete the dead `authSession` override (03:58) |
| eslint-comments | `require-description`; unneeded disables — `linterOptions.reportUnusedDisableDirectives: 'error'` (autofix) |

The layer graph (`config/eslint/layers.js`, `boundaries/elements` describe the **current** folders, the code is not moved; every element has an explicit `mode`: `file` for individual files, `folder` for the rest; A-35):

| element type | pattern (from `src/`) |
|---|---|
| `app` | `main.tsx`, `root.tsx`, `pages/GlobalHooks.tsx` (`mode: 'file'`); `app/**` (created by 03-5 and 04-2a; includes `app/pwa`, `app/i18n`, `app/router`), `bootstrap/**`, `features/routing/**`, `public-routes/**` (until removed by spec 04) (`mode: 'folder'`) |
| `pages` | `pages/*` |
| `features` | `features/*` |
| `entities` | `entities/**` (created by spec 03: queries, mappers, domain models) |
| `store` | `store/**` (the remaining UI stores, spec 03 §6) |
| `components` | `components/**` |
| `basics` | `basics/**`, `design-system/**` (spec 05: `AppTheme` receives `appearance` as a prop and does not read the store) |
| `hooks` | `hooks/**` |
| `helpers` | `helpers/**` |
| `shared-api` | `shared/api/**`, `shared/offline/**` (spec 03: the `api()` client, `apiInstance`, `queryClient`, persister, outbox; C1-12) |
| `shared-lib` | the rest of `shared/**` (`shared/money`, `shared/lib`) |
| `api` | `api/**` |
| `base` | `constants/**`, `types/**`, `i18n/**`, `styles/**`, `assets/**` |

The `boundaries/dependencies` policy is `default: 'disallow'`; allowed (on the left "from", on the right "to"):

| from | allow to |
|---|---|
| app | everything |
| pages | features, components, basics, hooks, store, entities, helpers, shared-lib, api, base |
| features | features (only another one's `index.ts`), components, basics, hooks, store, entities, helpers, shared-lib, api, base |
| components | components, basics, hooks, store, entities, helpers, shared-lib, api, base |
| hooks | hooks, store, entities, helpers, shared-api, shared-lib, api, base |
| store | store, entities, helpers, shared-api, shared-lib, api, base |
| entities | entities (only another one's `index.ts`), helpers, shared-api, shared-lib, api, base |
| basics | basics, helpers, shared-lib, base |
| helpers | helpers, shared-lib, base |
| shared-api | shared-api, shared-lib, api, base |
| shared-lib | shared-lib, base |
| api | api, base |
| base | base |

This is the only graph (A-12): it is acyclic (`entities → store` is forbidden, `store → entities` is allowed) and matches invariant 1, which only references it. UI layers and helpers do not see `shared-api` (inv. 2, C1-12); `helpers → api` is removed (60.Helpers "helpers without store/api"). The 02-C9 criterion: the fixtures `components/__probe.ts` with `import { api } from 'shared/api'` and `helpers/__probe.ts` with `import 'api/…'` give an error. `docs/engineering/rules/10-architecture.md` contains a table generated from `layers.js` by the script `scripts/generate-layers-doc.mjs` (02-C9); a test compares the committed text with the generated one.

`api` in UI layers is allowed only through types. This is ensured by the existing `no-restricted-imports` with `allowTypeImports`, not by boundaries. The resolver is `eslint-import-resolver-typescript` with `project: tsconfig.app.json`. The known ~30 violations (01-architecture.md:49-56: routing→pages 14 — they move into `app` and are not counted as violations; basics→components/store/hooks 4, including `NavButton.tsx:7` and `BalanceSummaryText.tsx:8` — fixed by 05-6; helpers→store; components↔public-routes) get entries in `eslint-suppressions.json` (`--suppress-rule boundaries/dependencies` in 02-C9). An import the resolver cannot resolve is skipped silently, so every new layer folder (`src/shared`, `src/entities`, `src/app` from specs 03/04) adds its tsconfig `paths` alias in the same PR as its first file.

Fast mode: `eslint.config.js` reads `process.env.CHIPIN_ESLINT_FAST === '1'`. In this mode `tseslint.configs.disableTypeChecked` and `parserOptions.projectService: false` are applied to all files (otherwise the TS program is still built and < 5 s is unreachable, A-36), `import-x/no-cycle` is off — for pre-commit. CI and `verify:full` always run in the full mode. `--cache` is not used in `lint`: with type-aware rules the cache gives a stale result for dependent files.

### D6. Prettier, editorconfig, VSCode

- `prettier.config.js` (ESM, replaces `.prettierrc.cjs`): `{ printWidth: 100, tabWidth: 4, useTabs: false, semi: true, singleQuote: true, jsxSingleQuote: false, trailingComma: 'all', arrowParens: 'avoid', bracketSpacing: true, bracketSameLine: false, endOfLine: 'lf', overrides: [{ files: ['*.yml','*.yaml'], options: { tabWidth: 2 } }] }`. The values of the current config are kept (`arrowParens: 'avoid'` gives a smaller diff, 317 files versus 387 with `always`); `jsxBracketSameLine` is replaced by `bracketSameLine`.
- `.prettierignore`: `dist`, `dev-dist`, `coverage`, `node_modules`, `package-lock.json`, the generated files from D5 "ignores" (C1-20), `public`, `LICENSE`, `THIRD_PARTY_NOTICES.txt`, `ds-gallery/standalone.html`, `src/i18n/locales/**` (reformatting the locale JSON is not needed), `docs/superpowers/**`, `AGENTS.md`, `CLAUDE.md` (ai-workflow sync blocks), `.github/**` (A-23: otherwise the ai-workflow sync and Prettier overwrite each other). Override `*.md` → `{ tabWidth: 2, proseWrap: 'preserve', embeddedLanguageFormatting: 'off' }` (otherwise lists in `docs/**` become `-   item`).
- Scope: "317 of 737" is `src` only. The exact number of files for 02-C2a–c is computed in 02-C1 with the command `npx prettier --list-different . | wc -l` (with this `.prettierignore`) and recorded in the descriptions of 02-C2a–c; the a/b/c split is by folders so that each PR is the output of one command.
- `.editorconfig`: `root=true`; `[*] indent_style=space, indent_size=4, end_of_line=lf, charset=utf-8, insert_final_newline=true, trim_trailing_whitespace=true`; `[*.{yml,yaml}] indent_size=2`; `[*.md] trim_trailing_whitespace=false`.
- `.vscode/extensions.json`: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`; we do not put `.vscode/settings.json` in git.
- `.git-blame-ignore-revs` — the SHAs of the formatting PRs.

### D7. Scripts, hooks, CI

`package.json` scripts (result):

```json
"build": "tsc -b && vite build && npm run verify:public-precache",
"vercel-build": "vite build && npm run verify:public-precache",
"lint": "node scripts/check-rule-registry.mjs && eslint . --max-warnings 0",
"lint:full": "node scripts/check-rule-registry.mjs && CHIPIN_ESLINT_FULL=1 eslint . --max-warnings 0",
"format": "prettier --write .",
"format:check": "prettier --check .",
"fix": "eslint . --fix; prettier --write .",
"baseline:update": "eslint . --prune-suppressions && node scripts/update-tsc-baseline.mjs",
"typecheck": "tsc -b",
"verify": "npm run version:check && npm run format:check && npm run lint && npm run typecheck",
"verify:full": "npm run version:check && npm run format:check && npm run lint:full && npm run typecheck && npm run test:full && npm run build && npm run build:ds-gallery",
"build:ds-gallery": "vite build --config ds-gallery/vite.config.ts && node ds-gallery/build-html.mjs",
"icons:generate": "pwa-assets-generator",
"version:check": "node scripts/version-check.mjs"
```

Note: the rule registry check runs first and resolves the config in both modes (default and `CHIPIN_ESLINT_FULL=1`) itself. Stylelint registry coverage comes with spec 05.

`test:run` (a duplicate of `test:full`) and `create-pwa-icons` (renamed to `icons:generate`) are removed. `test` (watch) stays. We do not touch `prerender:public` — spec 04 removes it.

`lint-staged` (in package.json):

```json
"lint-staged": {
  "*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}": ["node scripts/eslint-fix-staged.mjs", "prettier --write"],
  "*.{json,md,css,scss,yml,yaml,html}": ["prettier --write"]
}
```

- `.husky/pre-commit`: `CHIPIN_ESLINT_FAST=1 npx lint-staged` — target under 5 s. `scripts/eslint-fix-staged.mjs` (≈20 lines) runs `eslint --fix` on the passed files, prints the remaining errors as a hint and **always exits with 0**: the commit is never blocked by lint. ESLint runs first and Prettier last, so code changed by an ESLint fix (for example `curly`) is formatted before it is staged; `fix` uses the same order, with `;` so an ESLint error does not skip Prettier. The script passes `--pass-on-unpruned-suppressions`: in FAST mode the type-aware entries of `eslint-suppressions.json` are unused and must not fail the run.
- `.husky/pre-push` is removed: only CI blocks. The local check is `npm run verify:full` on demand (the agent runs it before `IMPLEMENTATION_COMPLETE`).
- There is no own `update-baseline.mjs`: the ESLint part is `eslint . --prune-suppressions`; `scripts/update-tsc-baseline.mjs` (≈30 lines) only removes fixed entries of `config/tsc-baseline.json`, if 02-C11 splits (otherwise a no-op). No `baseline:update` command adds new entries; growth is caught by `check-baseline.mjs`.
- `scripts/check-baseline.mjs --base "$BASE_SHA"` (≈50 lines, 02-C4): compares `eslint-suppressions.json` and `config/tsc-baseline.json` with `git show $BASE_SHA:<file>`; a new file × rule key or a counter growth — fail, except for registry keys this PR added to `config/eslint/rule-classes.json`: a rule new to the registry — growth allowed; a new `#id` of a registered rule — growth limited per file to that rule's messages carrying the new ids (the file is re-linted without suppressions).

CI (`frontend-ci.yml`, step `Verify frontend`): `npm run verify:full` — this gives format, version, `lint:full` (`--max-warnings 0`, `no-cycle`), typecheck. `BASE_SHA` is currently `env` of the "Resolve verification mode" step only (`id: gate`), only `mode` is written to `GITHUB_OUTPUT` (C1-15, C2-26). Therefore 02-C4 adds `echo "base_sha=$BASE_SHA" >> "$GITHUB_OUTPUT"` to this step (the git fetch of base is already there), and the ratchet steps get `env: BASE_SHA: ${{ steps.gate.outputs.base_sha }}`. Scripts with `--base` (`check-baseline`, `check-styled-allowlist`, `version-check`) fail closed in `pull_request` with `CI=true` and an empty or non-SHA `--base`; in `push` without a base (the first push of a branch) they print a notice and skip the growth check. New steps before `Verify frontend` — only for `pull_request`:

```
node scripts/check-baseline.mjs --base "$BASE_SHA"
node scripts/version-check.mjs --base "$BASE_SHA" --head-branch "$GITHUB_HEAD_REF"
```

The check rule: if `version` in `package.json` differs from base, the branch must match `^chore/issue-\d+-release-v(\d+)-(\d+)-(\d+)$`, and the new version must equal the version from the branch name and be greater than base. Otherwise exit 1 with the text "version changes only in a release PR". Decided (confirmed by the owner 2026-10-28): exactly one release Issue per release, the branch `chore/issue-<n>-release-vX-Y-Z` goes through the usual `pr:create`/admission; the `Version impact` field is removed from the Issue template, the owner chooses the bump. The `version-check.mjs` extension is about 40 lines + a test. Dependabot PRs are covered: they do not change the version.

Amended (owner, 2026-11-05): the version comes from the git tag per ChipIn-one/.github#172; the release-branch version policy and the `version-check.mjs` extension are dropped from 02-C10.

`ci-gate-policy.mjs` does not change in this spec (`AGENTS.md` and configs give mode `full` anyway); the modes `app|site` are added by 04-1b (spec 04 §1.4).

Version format (A-09, D15). The version is produced only by `scripts/version-resolver.mjs` from the root `package.json`: prod (`VERCEL_ENV=production`) — a plain `x.y.z`, other builds — `x.y.z-dev-<sha7>` (spec 04 §1.2, 04-0a). Any version comparison (min-client-version 03-20, `version-check`) takes only the semver core `major.minor.patch`.

Deploy (D15): there are no workflows and there will be no new ones; the source is `DEPLOYMENT.md` §"Vercel delivery from master". The release order is recorded in `docs/engineering/release-qa.md` as one section:
1. a release PR with the bump;
2. merge into `master`;
3. Preview;
4. "Prepare frontend release QA";
5. Promote.

If a PR that changes the ledger wire format or the outbox schema (label `wire-change`, rule m9 of spec 03 §7) has been merged since the last release, Promote only from a release PR with a version bump, so that `MIN_CLIENT_VERSION` can refer to it (C3-21).

The link to tags is ChipIn-one/.github#172 (not this spec).

### D8. TypeScript

A new `tsconfig.base.json` with the shared options: `strict`, `noUnused*`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `moduleResolution: bundler`, `module: ESNext`, `skipLibCheck`, `noEmit`, `allowImportingTsExtensions`, `moduleDetection: force`, `verbatimModuleSyntax: true`. `tsconfig.app.json` and `tsconfig.node.json` use `extends` and set only `target/lib/jsx/include/paths`.

| Stage | Change | Size |
|---|---|---|
| T1 | `tsconfig.app.json`: `include: ["src", "ds-gallery"]`, `exclude: ["ds-gallery/vite.config.ts"]`; delete `ds-gallery/tsconfig.json` and `tsc -b ds-gallery` from the script. `tsconfig.node.json` include + `ds-gallery/vite.config.ts`, `pwa-assets.config.ts`; replace `__dirname` in ds-gallery with `import.meta.dirname` (Node 24). Delete `typeRoots` | ≈30 lines |
| T2 | `paths` without `baseUrl` (deprecated in TS 6): `"api/*": ["./src/api/*"]` etc. for **all** 15 `src` directories (+ `bootstrap`, `i18n`, `public-routes`, `types`); remove the manual alias list in `ds-gallery/vite.config.ts:18` | ≈40 lines |
| T3 | `eslint --fix` with `consistent-type-imports` (34 autofix), then `verbatimModuleSyntax: true` in base (31 tsc errors before the fix; the remainder after autofix — by hand) | ≈120 lines |
| T4 | `noUncheckedIndexedAccess: true`. Baseline **39 errors / 21 files** (16 prod, 23 test). Fix: guard/`?.`/`at()` in prod; in tests `!` is forbidden, we use `expect(x).toBeDefined()` + a narrow helper `getOrThrow` in `src/test/` | ≈150 lines |

`exactOptionalPropertyTypes` — we do not enable it (see "What we do NOT do").

### D9. Monorepo (spec 04): how to make the move mechanical

- All paths in configs are computed from `import.meta.dirname` and one constant `APP_DIR` (now `'.'`, later `'apps/app'`); globs are built as `${APP_DIR}/src/**`. There are no absolute paths or `process.cwd()`.
- `config/eslint/*`, `prettier.config.js`, `.editorconfig`, `.prettierignore`, `lint-staged`, `.husky/` move to the monorepo root without edits; the root `eslint.config.js` imports the presets and sets `APP_DIR` for each workspace.
- `tsconfig.base.json` moves to the root; `apps/app/tsconfig.*.json` changes only the path in `extends`.
- Aliases live only in the app's tsconfig `paths`; ESLint (`aliases.js`) and Vite (`vite-tsconfig-paths`) read them from there.
- The `verify`/`verify:full` scripts in the root become proxies to `-w @chipin/app` (+ the site build), as in spec 04 §1.2; `version:check` (D15) stays in the root, the product version is in the **root** `package.json` (decision of spec 04 §1.2; there is no `version` field in `apps/app/package.json`). `scripts/version-*.mjs` find the root via `resolve(import.meta.dirname, '..')`, not `process.cwd()` (A-01), so they work from `apps/app` too (the cwd of Vite/Vercel).

## Migration of the 112 warnings and rule violations

| Set | Count | How | PR |
|---|---|---|---|
| `simple-import-sort/imports`+`exports` | 62 | autofix after T2 and the new groups | 02-C3 |
| `no-multiple-empty-lines` | 27 | the rule is removed, Prettier fixes | 02-C2 |
| async/await | 18 (14 in tests) | not migrated: the ban is lifted (D24); the selector `eslint.config.js:99-122` is removed together with the class c rules (C2-04) | 02-C4 |
| `handle*`, `react-refresh`, `React.FC` | 4 / 1 / 9 | the rules are removed (§D0), we do not touch the code | 02-C4 |
| Prettier format | 317 files | `prettier --write`, mechanically | 02-C2a–c |
| `consistent-type-imports` | 34 | autofix | 02-C6 |
| floating/misused promises | 36 / 30 (measured in 02-C6; audit: 35 / 28, 52 in prod) | by hand: `void` for intentional ones, `return`/`.catch` for the rest | 02-C7a, 02-C7b |
| `jsx-a11y` (6 rules), `jsx-no-literals`, the i18n attribute selector | 0 / 0 / 0, measured in 02-C8 (the 39 attribute hits were all test-harness markup in `*.test.tsx`; tests are excluded from the attribute selector) | new rules are immediately error; current violations — `--suppress-rule` in the same PR, fixed by slices | 02-C8 + per-slice PRs |
| boundaries | ~30 | suppressions; the fix — 05-6 (basics → components/store/hooks/api, including `NavButton`, `BalanceSummaryText`), 04-5a (public-routes); routing → pages is not counted as a violation (element `app`) | 02-C9 |
| `import-x/no-cycle` | known cycles `groupsStore`↔`activity-store`, `expenseModalStore`↔selectors (03:50) | suppressions; broken by 03-10/03-12 and 03-14 (C2-05) | 02-C9 |
| `import-x/no-internal-modules` (allow-list) | 105 nested barrels | suppressions; removed with its entries by 02-C12 (D27: slice entry stays enforced by the `boundaries` policies; file imports are allowed inside a slice and in plain layers) | 02-C9 |
| type-aware (`no-floating-promises`, `no-misused-promises`, `no-unsafe-*`) | 36 / 30 (incl. JSX) / 10 (5 assignment, 4 member-access, 1 return), measured in 02-C6 | suppressions in 02-C6; fix 02-C7a/b (C2-05) | 02-C6 |
| `no-non-null-assertion` | 9 in 5 files | suppressions in 02-C6; fixed when the file is touched | 02-C6 |
| default exports | 173 files with `export default` on `master` (re-measured 2026-11-10; was 172 files, 314 imports, 14 lazy, 25 `vi.mock`); the rule is not enabled anywhere yet | no codemod (D31): `import-x/no-default-export` immediately `error` + `eslint . --suppress-rule import-x/no-default-export`; the ratchet (§D0) only lets the entries shrink; a file leaves the baseline when it is touched (`export { X }`, importers and `vi.mock(..., () => ({ default }))` in the same PR) | 02-C13 |
| nested barrels | 105 nested `index.ts` + 3 root ones (`basics/index.ts`, `i18n/index.ts`, `public-routes/index.ts`; `store/index.ts` is removed by 03-5 — the only owner, C2-28); 147 `index.ts` in total, 38 at slice level | no codemod (D31): D27 + the `boundaries` policies already enforce the slice entry and `check-file-layout` (02-C12) bans new nested `index.ts`; a remaining nested barrel is removed when a file in its folder is touched (importers switch to the file) | when touched |
| `export *` in index | 9 in the audit, 0 on `master` (2026-11-10) | `no-restricted-syntax` `ExportAllDeclaration` enabled without suppressions | 02-C13 |
| `useConnect` | 19 `useConnect.ts` files (34 prod files reference them, re-measured in 03-5 / #625; 47 when the spec was written; #573, 2026-11-02, added 2 nested `index.ts` and 2 `useConnect.ts` after this spec was written) | removal — **only spec 03** (in the migration PR of its store; the remainder — 03-18). This spec gives only the ban on new ones: `CI:check-file-layout` with a baseline of 19 files (02-C12) | 03-* |
| money `Number(`/`parseFloat(` | 21 in 5 files | after `src/shared/money/` appears (D21); the rule and the migration — spec 03 §4.3–4.4 | 03-1, 03-3 |
| `noUncheckedIndexedAccess` | 39 | by hand | 02-C11 |

The order of `--max-warnings 0`: it is enabled in 02-C4, when the import-sort and `no-multiple-empty-lines` lines are zeroed, and the class c rules and the async selector are off. Everything added later (02-C6, C8, C9, C13, 03-1, 05-5) comes in immediately as `error` + `--suppress-rule` in the same PR — the same before and after `--max-warnings 0`, so CI is never red by construction (C2-03, C2-05).

## Nuances and pitfalls

- **`void` vs the current rule text.** 00.Promises.5 forbids `void` wrappers, while `no-floating-promises` requires them. The rule is rewritten in 02-C7a/b simultaneously with enabling lint, otherwise agents get a contradiction.
- **Prettier PRs conflict with all open PRs.** 02-C2a–c are merged back to back on one day, in a window with no open feature PRs; after the merge the authors run `npm run format`. The SHAs go into `.git-blame-ignore-revs`. A mechanical PR with no size guideline: PR = the output of one command, review = repeat the command and compare.
- **default → named and barrel removal break string `vi.mock` calls** (477 calls). A mock of a barrel and a mock of a file are different modules, and `vi.mock(..., () => ({ default }))` must become a named key. When a touched file leaves the `no-default-export` baseline or a nested barrel is removed (02-C13, D31), the same PR updates its importers and their `vi.mock` calls; tests stay green.
- **`no-misused-promises` in JSX.** `checksVoidReturn.attributes: true` (C1-22): `onClick={() => action()}` returns a promise to React, and `no-floating-promises` does not see it; the rule with the `void` hint closes this path. Existing places — suppressions 02-C6, fix 02-C7b.
- **Attributes and i18n.** Technical attributes (`variant`, `size`, `type`…) are not checked: the D5 selector lists only user-facing ones (`aria-label`, `aria-description`, `placeholder`, `title`, `alt`), otherwise agents will start writing `{'primary'}`. Test files (`**/*.test.{ts,tsx}`) are not checked (02-C8).
- **boundaries + aliases.** Without `eslint-import-resolver-typescript` the plugin does not recognize `components/...` and silently checks nothing. The 02-C9 acceptance criterion — a violating test file must produce an error.
- **Type-aware lint and lint-staged.** projectService builds the whole program; therefore pre-commit works in FAST mode and only fixes, and the full check is done by CI (and `verify:full` on demand).
- **`unbound-method` in tests** (70 hits) — noise from `expect(store.action)`; disabled for `*.test.*`.
- **The `sharp` override.** After the top-level `sharp` is removed, the override `@vite-pwa/assets-generator.sharp: 0.35.3` is also removed. If `icons:generate` fails after that, the override is restored with a comment in the PR (ASSUMPTION).
- **The ai-workflow routing block** references `.ai/context.md`. 02-A1 must not be merged until ai-workflow makes the "if it exists" step.

## Future extension

- Own ESLint rules (`eslint-plugin-chipin` in `config/eslint/rules/`), if `no-restricted-syntax` becomes unreadable (more than 25 selectors); a rule with autofix may bring back a removed class c rule (for example, `handle*` → `on*`).
- `knip` in CI for dead exports and dependencies.
- `exactOptionalPropertyTypes` — after D4, when the types are generated.
- A Turborepo cache for `verify` (after spec 04).

## What we do NOT do

- We do not translate the rulebook into Russian; only the AGENTS.md invariants are in Russian.
- We do not move the existing folders. The new `src/app/`, `src/entities/`, `src/shared/` are created by specs 03 and 04; boundaries (02-C9) describes both them and the current folders in advance.
- We do not enable `exactOptionalPropertyTypes`, `import-x/no-cycle` in pre-commit, Biome/oxlint.
- We do not keep style rules without autofix, the `warn` level, or a blocking pre-commit and pre-push (§D0).
- We do not add a deploy workflow and do not touch Vercel settings.
- We do not remove `prerender:public`, `vercel.config.test.js` and the SSG scripts — spec 04.
- We do not touch `vite-plugin-svgr`, `axios`, `yaml` (`yaml` stays: `contract-tests/support/openapi.ts:1`).

## Phases / PRs

Each PR releases independently. The size is a guideline, not a rule: one PR = one task, review in one pass, ~400 diff lines; the mechanical 02-C2 has no limit (lines produced by a command do not count).

| PR | Content | Depends on |
|---|---|---|
| **02-A0** (ai-workflow) | routing block: `.ai/context.md` and `.ai/decisions.md` are read "if they exist"; remove `Canonical root` from the public block | — |
| **02-A1** | the new AGENTS.md (D2); delete `.ai/context.md`, `.ai/decisions.md`, `docs/engineering/code-review.md`; README commands | 02-A0 |
| **02-A2** | edits of chapters 00–70 per D3/D4 — **only** the `DEL` and `RW`/`R` rows that do not need lint. The text of every `L:` rule changes in the PR 02-C*/03-*/05-* that enables its lint (A-22); there are no "enabled in PR …" marks in the rulebook | 02-A1 |
| **02-A3** | `.gitignore`: `.claude/`, duplicates, docs paths (D4 P8) (`.env*` is already done in 01-1); `.editorconfig`; `.vscode/extensions.json` | — |
| **02-B1** | **the only owner** of removing dexie/workbox/sharp and of the vendor-regex fix (specs 03, 04, 05 only refer to it). Delete `dexie`, `dexie-react-hooks`, `sharp`, `sharp-ico`, `workbox-core`, `workbox-window`, the override; the `vendor-react` regex → `/node_modules[\\/](?:react\|react-dom\|react-router\|react-router-dom\|scheduler)[\\/]/`; `vendor-misc` without dexie; `build`/`vercel-build` without icon generation, `icons:generate`; delete `test:run`; THIRD_PARTY_NOTICES | — |
| **02-B2** | replace `@uidotdev/usehooks`: `useCopyToClipboard` → `helpers/clipboard.ts`, `useNetworkState` → `hooks/useOnlineStatus.ts` (`useSyncExternalStore` + `online/offline`), `useIntersectionObserver` → `hooks/useIntersectionObserver.ts`; delete the commented-out call `pages/GlobalHooks.tsx:19`; update 2 mocks | — |
| **02-C1** | Prettier + eslint-config-prettier + `format`/`format:check` (not yet in `verify`) + `prettier.config.js` | — |
| **02-C2a–c** | `prettier --write` over `src/components` / `src/{pages,features}` / the rest; then `format:check` in `verify`; `.git-blame-ignore-revs` | 02-C1 |
| **02-C3** | T2 (paths without baseUrl, ds-gallery alias) + `config/eslint/aliases.js` + import-sort autofix | 02-C2 |
| **02-C4** | turn off the class c rules (§D0: the `handle*` selector, react-refresh, etc.) and the async selector `eslint.config.js:99-122` (C2-04); **`--max-warnings 0`**; delete the dead authSession override; the helpers `restrictedSyntax()`/`restrictedImports()` (the only owner; 03-1 and 05-5 only add their blocks); split `eslint.config.js` into `config/eslint/*`; the baseline mechanism (C2-05): `eslint-suppressions.json`, `baseline:update`, `check-baseline.mjs` + test, `rule-classes.json` + `check-rule-registry.mjs`, `lint:full`; CI: `base_sha` in `GITHUB_OUTPUT` and the `check-baseline` step (C1-15) | 02-C3 |
| **02-C5** | T1 (typecheck of ds-gallery + configs), `tsconfig.base.json` | — |
| **02-C6** | type-aware preset + `consistent-type-imports` autofix + T3 `verbatimModuleSyntax`; `--suppress-rule` for `no-floating-promises`/`no-misused-promises`/`no-unsafe-*`/`no-non-null-assertion` | 02-C4, 02-C5 |
| **02-C7a/b** | `no-floating-promises`/`no-misused-promises`: fix store/helpers/hooks (a), UI (b); edit 00.Promises.5 and 20.Effects.5 | 02-C6 |
| **02-C8** | 6 jsx-a11y rules + `jsx-no-literals` + the i18n attribute selector (D5) + baseline | 02-C4 |
| **02-C9** | boundaries (with `shared-api`/`shared-lib`) + resolver + `import-x/no-cycle` + `import-x/no-internal-modules` + suppressions (~30 + cycles + barrels) + `generate-layers-doc.mjs` + probe fixtures | 02-C4 (`config/eslint/layers.js` appears when the config is split, A-39) |
| **02-C10** | husky pre-commit + lint-staged (`--fix`, does not block) + FAST mode; delete pre-push; `fix`, `eslint-fix-staged.mjs`; the CI version-policy step; the `version-check.mjs` extension; the release section in release-qa.md. Amended (owner, 2026-11-05): the version comes from the git tag per ChipIn-one/.github#172; the release-branch version policy, the `version-check.mjs` extension and the release section in release-qa.md (the release order belongs to #172) are dropped from 02-C10. | 02-C4 |
| **02-C11** | T4 `noUncheckedIndexedAccess` (39) | 02-C6 |
| **02-C12** | project rules: `<img>`, `useStore()`/`useShallow`, `check-file-layout.mjs` (`index.ts` depth, ban on new `useConnect.ts`, baseline 19); removal of `import-x/no-internal-modules` and its suppression entries (D27). The money rules are **not** included here — they are introduced by 03-1 (§4.3 of spec 03) | 02-C4 |
| **02-C13** | `no-restricted-syntax` `ExportAllDeclaration` (0 violations on `master`) and `import-x/no-default-export` = `error` (D31; exceptions per D5 "default export exceptions"), registry row in `rule-classes.json`, `eslint . --suppress-rule import-x/no-default-export` (173 files on `master`); the ratchet only lets the entries shrink; the rulebook text 00.Modules.1/20.Components.5 says "a touched file switches to `export { X }`, its importers and `vi.mock` in the same PR" | 02-C4 |
| ~~02-D2a–e~~ | withdrawn (D31): no default → named codemod; replaced by 02-C13 | — |
| ~~02-D3a–e~~ | withdrawn (D31): no nested-barrel codemod; D27 + `boundaries` enforce the slice entry, remaining nested barrels are removed when touched | — |

## Tests / acceptance criteria

1. `npm run verify:full` is green on `master` after each PR; 1230+ tests pass.
2. After 02-C4: `npx eslint . --max-warnings 0` gives exit 0; `grep -c warning` on the output = 0.
3. After 02-C2: `npx prettier --check .` gives exit 0.
4. After 02-C5: `tsc -b` checks `ds-gallery/gallery.tsx`. Check: a temporary type error in this file fails `npm run typecheck`. The same for `ds-gallery/vite.config.ts` and `pwa-assets.config.ts`.
5. After 02-C9: the fixture `basics/__boundary_probe.ts` with `import 'store/users-store'` gives a `boundaries/dependencies` error (checked in the PR and deleted).
6. After 02-C10: a PR that changes `version` from a non-release branch gets a red `frontend-ci`. A release branch with a matching version — green. There is a unit test in `scripts/version-check.test.mjs`.
7. After 02-A1/02-A2: `grep -rn "useConnect\|@codex\|Vite 7\|pre-1.0\|docs/specs/\|JavaScript \`Number\`" AGENTS.md docs/engineering` is empty (except the migration tables); `wc -l AGENTS.md` ≤ 90; AGENTS.md has exactly 15 invariants.
8. After 02-B1: the root `package.json` `dependencies`/`devDependencies` contain no `dexie`, `sharp-ico`, `workbox-window` (the transitive `workbox-window` from `vite-plugin-pwa` stays, A-25); `npm run build` does not call `pwa-assets-generator`; there is no anonymous chunk with the react-router core in `dist` (it is in `vendor-react-*.js`).
9. Baseline (C1-13, C1-15): `eslint-suppressions.json` and `config/tsc-baseline.json` do not grow — `scripts/check-baseline.mjs --base "$BASE_SHA"` reads the base via `git show $BASE_SHA:<file>`, `BASE_SHA` comes from `steps.gate.outputs.base_sha` (D7); locally it defaults to `git merge-base HEAD origin/master`. The script's test: a new key for a rule that is not in the base `rule-classes.json` — pass; growth of the counter of an existing key — fail; an empty `--base` with `CI=true` in a PR — fail. Fixture: a second violation in a file with one entry — `eslint` is red.
10. Pre-commit exits with 0 even with a remaining lint error (PR gate: a file with `no-floating-promises` is committed, CI is red). Owner QA, not a gate (C2-34): a measurement < 5 s on a one-file change (the owner's machine, M-series).
11. **Check on agents** (owner QA, not a PR gate; C2-34). Before the merge of each 02-C PR that enables rules — two trial tasks by an agent on a branch with the new config: (1) a new component with i18n text and a handler, (2) an edit of a store action with a promise. We count the repeated runs caused by lint/format rules. Threshold: **0 repeats due to auto-fixable rules (a)**. Repeats due to (b) are recorded in the PR with the message text; if the message did not tell the agent how to fix, it is rewritten before the merge.
12. The config has no `warn`-level rules and no class c rules: `scripts/check-rule-registry.mjs` (in `lint`) resolves every linted file in both lint modes (`lint` and `lint:full`) and finds every enabled rule in `config/eslint/rule-classes.json` with class a/b (stylelint coverage comes with spec 05); the rows of `rule-classes.json` match the §D0 registry (a test checks the ids).
13. After 02-C13: a new file with `export default` (outside the D5 exceptions) fails `eslint`; `eslint-suppressions.json` has `import-x/no-default-export` entries only for files that had a default export on the base SHA, and `check-baseline.mjs` fails on any growth.

## Backend requirements

None.

## Open questions

1. ~~Release branch~~ — decided (confirmed by the owner 2026-10-28): one release Issue per release, the branch `chore/issue-<n>-release-vX-Y-Z` through `pr:create`/admission, CI `version-check` by branch name (D7).
2. ~~`Version impact`~~ — decided (confirmed by the owner 2026-10-28): the field is removed, the owner chooses the bump.
3. ~~The jsx-a11y baseline~~ — measured in 02-C8: 0 jsx-a11y violations, 0 i18n attribute violations outside tests; no split by layer.
4. ~~The `async/await` ban (inv. 7)~~ — decided (owner 2026-10-28, D24): the ban is lifted; style is free, the guards are `no-floating-promises`/`no-misused-promises`.
