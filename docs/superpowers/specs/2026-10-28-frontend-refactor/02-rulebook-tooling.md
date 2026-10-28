# Спека 02 — единый свод правил, tooling, чистка зависимостей

Решения: D9, D11, D12, D13, D15, D16 (зависимости и гигиена сборки). Связанные решения: D21 (модуль `money/`; D10 снят), D3 (TanStack Query), D6 (data router), D4 (zod на границах).
Связанные спеки: **01** (хотфикс: `.gitignore`, CSP — уже там), **03** (D3/D4/D21: `src/shared/money`, Query-слой, удаление `useConnect`, денежные lint-правила), **04** (D6/D7: монорепо — конфиги уезжают в корень, см. §Д9; data router и `src/app/`), **05** (D14: stylelint, styled allowlist, `no-raw-colors`).
Идентификаторы PR — глобальная схема `<спека>-<n>`: `02-A0…02-A3`, `02-B1…02-B2`, `02-C1…02-C12`, `02-D2…02-D3` (02-D1 снят, §Д0) (см. `00-overview.md`).

Отклонение от D11/D13 (ревью владельца PR #542, записано в DECISIONS): правила без автофикса и не про корректность удаляются (§Д0) — сняты `handle*`, запрет `React.FC`, Props только в файле компонента как проверка. Отклонение от DECISIONS: D9 называет полным сводом `docs/codex/rules`; на `master` свод уже лежит в `docs/engineering/rules/` — D9 применяется к нему, новый `docs/codex/` не создаётся. D12 (удаление `useConnect`) исполняет спека 03; здесь — только запрет новых. После review C (выносится владельцу, `00-overview.md` «Подтверждения»): (1) D9 «каждое правило — lint/CI или удаляется» исполняется с четвёртым классом `REVIEW` — короткий список семантических инвариантов AGENTS.md, которые машина не проверяет (C1-16); (2) D21 «конверсия денег на границе API» толкуется как «в мапперах `entities/*/model`», обёртка `api()` деньги не трогает (C1-11, C2-06, C3-14; детали — спека 03 §4.3).

**Порядок относительно монорепо-переноса (04-0).** До 04-0: 02-A0…A3, 02-B1, 02-B2, 02-C1…02-C5 (рекомендуемо — чтобы массовое форматирование и `tsconfig.base.json` были до rename). После 04-0: 02-C6…02-C12, 02-D2…02-D3 (codemod'ы — строго после 04-0). 02-A*/02-B*/02-C* написаны через `APP_DIR` (§Д9) и при необходимости могут идти и после 04-0.

## Цель

Агент (Claude/Codex) получает **одно** место с правилами, и каждое правило либо проверяет машина (ESLint/tsc/CI-скрипт), либо входит в короткий список инвариантов, которые проверяет ревьюер. Противоречий между файлами нет. CI падает на любом warning'е, на неотформатированном коде и на рассинхроне версии. Lint не заставляет агента делать лишние круги: всё стилевое чинит `--fix`, ошибкой остаётся только корректность (§Д0).

## Д0. Без трения для агентов (принцип для каждого lint/format-правила)

Ревью владельца (PR #542): правила линтера и Prettier часто ломают агентов и заставляют делать лишнюю работу. Поэтому каждое правило ESLint/Prettier относится ровно к одному классу:

- **(a) Автоисправимое** → `error`, но агент его как ошибку не видит: его чинят `eslint --fix`/`prettier --write` на сохранении (VSCode), в lint-staged и командой `npm run fix`.
- **(b) Корректность или граница** (промисы, `any`, границы слоёв и импортов, денежная арифметика, сырые цвета, `no-default-export`) → `error` с сообщением, которое говорит, **как чинить** (`message` в `no-restricted-*`, ссылка на правило свода).
- **(c) Стиль или имена без автофикса** → **удаляется** (`off`, текст правила из свода тоже удаляется).

Следствия:
- Уровня `warn` нет: каждое правило `error` или `off`. Поэтому `--max-warnings 0` остаётся, но только как страховка от случайного `warn` в конфиге.
- Pre-commit быстрый (< 5 с): lint-staged только с `--fix`, оставшиеся ошибки печатаются подсказкой и **коммит не блокируют**. Pre-push удаляется. Блокирует только CI (`verify:full`); агент запускает `npm run verify:full` сам как локальную проверку перед `IMPLEMENTATION_COMPLETE`.
- Baseline — **нативные bulk suppressions ESLint** (C1-13; ESLint 9.39.4 в репо: `--suppress-rule`, `--suppress-all`, `--prune-suppressions`, файл `eslint-suppressions.json` в корне со счётчиком нарушений на файл × правило, `node_modules/eslint/lib/services/suppressions-service.js`). Нарушений в файле больше, чем записано, — все репортятся как `error`; записи, которые больше не срабатывают, валят `eslint` (exit 2) до `--prune-suppressions`, поэтому baseline только сокращается. Своего `baseline.js` с `rules: 'off'` нет: он выключал правило на весь файл, и новые нарушения в baseline-файле проходили. `npm run baseline:update` = `eslint . --prune-suppressions` (+ `config/tsc-baseline.json`, если 02-C11 делится). Рост ловит CI `check-baseline.mjs` (Д7). Агент запускает одну команду.
- Записи добавляются только в PR, который включает правило: `eslint . --suppress-rule <rule>`. `check-baseline.mjs` разрешает новые ключи только для правил, которые этот же PR добавил в `config/eslint/rule-classes.json` (относительно base); любой другой рост счётчика или нового ключа — fail. Так ratchet не протекает.
- Новое правило в конфиг добавляется только со строкой в реестре ниже; правило класса (c) не добавляется.

**Реестр правил — единственный для всех спек (C1-14).** Каждое правило ESLint и stylelint из спек 02–05 — строка этой таблицы (или таблицы stylelint ниже); спека, которая вводит правило, добавляет строку сюда в том же PR, где включает его. Машинная копия — `config/eslint/rule-classes.json` (`{ "<rule>" | "<rule>#<id селектора>": "a" | "b" }`; у селекторов `no-restricted-*` `message` начинается с `[<id>]`). `scripts/check-rule-registry.mjs` (в `lint`, вводит 02-C4) сверяет её с `eslint --print-config` для трёх файлов (компонент, store, тест) и с `stylelint --print-config`: правило без записи или с классом c — fail.

| Правило | Класс | Почему |
|---|---|---|
| Prettier (формат) | a | `prettier --write` |
| `simple-import-sort/imports`, `/exports` | a | `--fix` |
| `consistent-type-imports` | a | `--fix` |
| `no-import-type-side-effects` | a | `--fix` |
| `no-unnecessary-type-assertion` | a | `--fix` |
| `unused-imports/no-unused-imports` | a | `--fix` |
| `curly: all` | a | `--fix` |
| `react/jsx-boolean-value: never` | a | `--fix` |
| `import-x/no-useless-path-segments` | a | `--fix` |
| `linterOptions.reportUnusedDisableDirectives: 'error'` (вместо `eslint-comments/no-unused-disable`) | a | `--fix` удаляет лишний disable |
| `no-multiple-empty-lines` | a | выключено в ESLint, чинит Prettier |
| `no-floating-promises` (`ignoreVoid`) | b | потерянная ошибка; сообщение: `return` или `void` |
| `no-misused-promises` (`checksVoidReturn.attributes: true`) | b | промис там, где ждут `void`/boolean, включая JSX-атрибуты (C1-22); сообщение: `onClick={() => void action()}` |
| `no-unsafe-*` (assignment, member-access, call, return, argument; тесты off) | b | `any` протекает в типы |
| `no-explicit-any` | b | инв. 6 |
| `ban-ts-comment` | b | инв. 6 |
| `no-non-null-assertion` | b | инв. 6; есть suggestion, не autofix |
| `js.configs.recommended` + `tseslint.configs.recommended` (без stylistic; в т.ч. `no-async-promise-executor`) | b | ошибки, а не стиль |
| `react.configs.flat.recommended` (`jsx-key` и др.), `react/prop-types: off` | b | ошибки рендера |
| `react/no-unstable-nested-components` | b | компонент пересоздаётся, теряет state |
| `react-hooks` v7 `recommended` (`rules-of-hooks`, `exhaustive-deps`, compiler-правила) | b | ошибки хуков |
| jsx-a11y — 6 правил: `alt-text`, `anchor-is-valid`, `aria-props`, `aria-role`, `role-has-required-aria-props`, `no-static-element-interactions` | b | невалидный ARIA, картинка без `alt`, ссылка без `href`, кликабельный `div` — реальные дефекты доступности; остальные правила `recommended` — c |
| `react/jsx-no-literals` + селектор атрибутов i18n | b | текст мимо i18n = баг в 3 локалях |
| `import-x/no-default-export` | b | граница модулей (D11); сообщение: `export { X }` |
| `import-x/no-self-import` | b | ошибка импорта |
| `import-x/no-cycle` (только CI) | b | граница |
| `import-x/no-internal-modules` (allow-list) | b | граница слайса |
| `boundaries/dependencies` | b | граф слоёв (инв. 1) |
| `no-restricted-imports` (`axios`, runtime `api/` из UI, UI-библиотеки) | b | граница (инв. 2); runtime `shared/api`/`shared/offline` из UI держит `boundaries` (элемент `shared-api`, Д5) |
| `no-restricted-globals` (`localStorage`, `sessionStorage`) | b | граница `helpers/localStorage.ts` (инв. 12) |
| `no-restricted-syntax` `ExportAllDeclaration` | b | граница barrel'а (D11) |
| `no-restricted-syntax` `<img>`/`styled.img` | b | граница: только `basics/Image` |
| `no-restricted-syntax` `localStorage.clear` | b | стирает настройки языка/темы |
| `no-restricted-syntax` `CancelToken` | b | устаревший API отмены |
| `no-restricted-syntax` `use*Store()` без селектора, объектный литерал без `useShallow` | b | лишние ре-рендеры / бесконечный цикл в Zustand 5 |
| `no-restricted-syntax` `TemplateLiteral` в URL `apiInstance.*` | b | безопасность путей (01-1 `apiPath`) |
| денежные селекторы (спека 03 §4.3; 03-1 — сразу `error` + suppressions, без `warn`) | b | деньги |
| `no-restricted-imports` `shared/money/*` (только корень модуля; 03-1) и `moneyFromWire`/`moneyToWire` только в `entities/*/model/**` (03-4b) | b | деньги: одно место конверсии (инв. 3) |
| `no-restricted-syntax` литерал-массив в `queryKey` вне `entities/*/api/queries.ts` (03-5) | b | один источник ключей |
| `@tanstack/eslint-plugin-query` `recommended` (03-5) | b | ошибки query-хуков |
| `no-restricted-imports` `zustand` только в `src/store/**`, `src/app/**`; `zustand/react/shallow` разрешён везде (спека 03 §6; C1-18) | b | граница UI-состояния |
| `no-restricted-properties` `navigator.onLine` вне `src/shared/offline/**` (03-5) | b | один онлайн-предикат `isNetworkUsable()` (спека 04 §2.3) |
| `no-restricted-imports` `@vercel/*` кроме `app/telemetry/vercelAnalytics.ts` (04-2b) | b | изоляция провайдера (D18) |
| `no-restricted-properties` `window.location.pathname` кроме `getRouterPathname` (04-2g) | b | basename (спека 04 §2.1); сообщение: `getRouterPathname()` |
| `no-restricted-syntax` `ROUTES.HOME\|PRIVACY\|TERMS` (04-2f) | b | ссылки на сайт — `SITE_PATHS` |
| `no-restricted-syntax` `i18n.changeLanguage` вне `setAppLanguage.ts` (04-2c) | b | язык меняется в одном месте |
| `no-restricted-syntax` строковый литерал `/…(png\|svg\|ico\|webp)` в `apps/app/src` (04-2g) | b | ассеты через `import.meta.env.BASE_URL` |
| `no-raw-colors` (спека 05 §3, 05-5; regex с якорями) | b | токены |
| `no-restricted-syntax` `style` с обычными свойствами (05-5) | b | стили — пропсы Radix или CSS Module; кастомные `--x` разрешены |
| `no-restricted-imports` `styled-components` вне allowlist (05-5), `@radix-ui/colors` (05-4), `\.svg\?react$` вне allowlist (05-5) | b | заморозка styled, токены, иконки — lucide |
| `eslint-comments/require-description` | b | исключение без причины |
| ~~`no-restricted-syntax` `AwaitExpression`/async~~ (бывш. инв. 7) | — | удалено по решению владельца 2026-10-28 (D24): селектор `eslint.config.js:99-122` (18 warnings) удаляет **02-C4** (C2-04, C1-26), текст в `docs/engineering/rules` — 02-A2 |
| `@typescript-eslint/naming-convention` `handle*` | c | автофикса нет (rename руками) |
| `naming-convention` `typeLike` PascalCase | c | автофикса нет |
| `no-restricted-syntax` `React.FC` | c | фиксер `react/function-component-definition` пропускает переменные с типом (`function-component-definition.js:190`) |
| `react/no-multi-comp` | c | стиль |
| `no-nested-ternary` | c | стиль |
| `explicit-module-boundary-types` | c | автофикса нет; tsc выводит типы |
| `no-restricted-syntax` spread аккумулятора в `reduce` | c | стиль/перф |
| `no-restricted-syntax` `@media … px` | c | стиль |
| `no-restricted-syntax` `ImportNamespaceSpecifier` | c | стиль |
| `no-restricted-syntax` `toMatchSnapshot` | c | стиль тестов |
| `eslint-comments/disable-enable-pair` | c | стиль |
| `unused-imports/no-unused-vars` | c | дубль tsc `noUnused*` |
| `react-refresh/only-export-components` | c | только DX HMR |
| остальные правила `jsx-a11y/recommended` | c | автофикса нет, шум на Radix |
| остальные правила `recommendedTypeChecked` (`unbound-method`, `restrict-template-expressions` и др.) | c | шум без пользы |
| `check-file-layout`: kebab-case/PascalCase имён, `__tests__`, `*Props` в `types.ts` | c | автофикса нет; в скрипте остаются только глубина `index.ts` и запрет новых `useConnect.ts` (b) |

Stylelint (вводит 05-5, спека 05 §3; тот же реестр, C1-14):

| Правило | Класс | Почему |
|---|---|---|
| `color-no-hex`, `color-named: 'never'`, `function-disallowed-list` (rgb/hsl/…) | b | сырой цвет мимо токенов (D23); сообщение: `var(--cp-*)` |
| `declaration-property-value-disallowed-list` `var(--(?!cp-\|_)` | b | только `--cp-*` и локальные `--_*` |
| `csstools/value-no-unknown-custom-properties` | b | опечатка в имени токена |
| `selector-disallowed-list` `.rt-*` (кроме `radixStylesOverwrite.css`) | b | граница Radix |
| `reportDescriptionlessDisables` | b | исключение без причины |
| `unit-disallowed-list` `px`, `media-feature-name-value-allowed-list` (брейкпоинты) | c | автофикса нет — **не вводятся**; брейкпоинты Radix остаются конвенцией в `docs/design-system` |

## Контекст

**Важно: аудит 03 смотрел устаревшую ветку** `chore/issue-456-ds-gallery` (3d0086e). Каноническая ветка теперь `master` (522973a, cutover FE#497). На `master`:
- правила лежат в `docs/engineering/rules/*`, а не в `docs/codex/rules/*`; `docs/codex/review-instruction-loading.md` уже удалён;
- `CLAUDE.md` — файл с блоком `@AGENTS.md`, а не симлинк;
- deploy-workflow'ов **нет**: delivery = Vercel Git integration + ручной Promote (DEPLOYMENT.md «Vercel delivery from master»). Находка «два deploy-workflow» (03-tooling-rules.md:125-126) устарела;
- `src/`, `package.json`, `eslint.config.js`, `tsconfig*`, `vite.config.ts` совпадают с веткой аудита (git diff пуст), поэтому все счётчики аудита по коду актуальны.

Ниже все пути указаны для `master`.

| Проблема | Где в аудите |
|---|---|
| Правила продублированы в 4–5 файлах и противоречат друг другу | 03-tooling-rules.md:9, §5 (R1–R4, P1–P15) |
| «CI проверяет форматирование» — неправда, Prettier не установлен | 03-tooling-rules.md:10, :106-111 |
| 112 warnings, CI их пропускает | 03-tooling-rules.md:23-32, :130 |
| Нет type-aware правил, jsx-a11y, границ слоёв | 03-tooling-rules.md:16, :61-68 |
| import-sort не знает 4 алиаса | 03-tooling-rules.md:14, :47 |
| typecheck не видит ds-gallery и vite-конфиги; `verbatimModuleSyntax` расходится | 03-tooling-rules.md:15, :72-90 |
| `version:check` только в pre-push | 03-tooling-rules.md:129 |
| Мёртвые зависимости, иконки на каждой сборке, regex vendor-react | 05-deps-styling.md:12-16, :35-36, :63-66 |
| Нарушения слоёв (~30 импортов), 144 barrel'а | 01-architecture.md:23-59; 00-synthesis.md B |

Замеры этой спеки (только чтение, на `src` = `master`):
- `tsc --noUncheckedIndexedAccess`: **39 ошибок в 21 файле** (23 из них в тестах);
- `tsc --verbatimModuleSyntax`: **31 ошибка**;
- type-aware ESLint по `src`: `no-floating-promises` 35 (34 в prod-коде), `no-misused-promises` 28 (18), `consistent-type-imports` 34 (все autofix), `unbound-method` 70 (все в тестах), `no-unsafe-assignment` 35 (29 в тестах). Время прогона около 7 с;
- Prettier с текущим `.prettierrc.cjs`: **317 из 737** файлов `src` отличаются;
- `export default`: 172 файла, 314 мест `import X from '<локальный модуль>'`, 14 `React.lazy`, 25 тестов с `vi.mock(..., () => ({ default }))`;
- `index.ts`: 144 файла; 37 на уровне слайса (`src/<layer>/<slice>/index.ts`), 4 корневых для слоя, **103 вложенных**;
- `useConnect`: 17 файлов, 47 ссылок; `useShallow`: 40 файлов;
- `Number(`/`parseFloat(` в prod-коде: 21 вызов в 5 файлах.

## Решение

1. **Свод правил.** `AGENTS.md` содержит 15 инвариантов, команды и ссылки. Полный свод — только `docs/engineering/rules/*`. `.ai/context.md`, `.ai/decisions.md` и `docs/engineering/code-review.md` удаляются. Процесс (lifecycle, admission, Trello, completion) описан в `syllik/ai-workflow` и `ChipIn-one/.github`; здесь остаются только ссылки.
2. **Классы проверки.** У каждого правила ровно один класс:
   - `LINT` — ESLint/tsc;
   - `CI` — скрипт или тест в `verify:full`;
   - `REVIEW` — семантический инвариант из списка AGENTS.md (деньги, auth, офлайн, конкурентность), который машина проверить не может;
   - `DELETE` — правило удаляется.
   Стилевое правило без `LINT` удаляется.
3. **Tooling:**
   - ESLint type-aware (`projectService`), import-x, jsx-a11y, boundaries;
   - Prettier, который владеет форматированием;
   - `--max-warnings 0`. Каждое правило имеет уровень `error` или `off` и класс a/b из §Д0; известные нарушения — в `eslint-suppressions.json` (нативные suppressions ESLint), его ведёт `npm run baseline:update`, и этот список может только сокращаться;
   - husky: pre-commit — быстрый (lint-staged, только `--fix`, не блокирует); pre-push нет; блокирует только CI;
   - CI проверяет формат, версию и typecheck всех TS-файлов.
4. **Версия (D15).** Задачи не трогают `version`. Бамп делается только в release-PR перед Promote. CI запрещает менять версию в остальных PR.
5. **Deploy (D15).** Единственный путь — Vercel Git + Promote. Он уже задокументирован в `DEPLOYMENT.md`. Из AGENTS.md дубль удаляется, остаётся ссылка.

## Детали

### Д1. Файлы: что остаётся и что уходит

| Файл (master) | Судьба | Примечание |
|---|---|---|
| `AGENTS.md` | **переписать** (≈70 строк) | структура в Д2 |
| `CLAUDE.md` | оставить как есть | блок `ai-workflow:claude-routing` управляется ai-workflow |
| `.ai/context.md` | **удалить** | всё содержимое дублирует AGENTS.md (03:210). Зависимость: PR в ai-workflow, после которого шаг 4 routing-блока читает `.ai/context.md` только «если существует» |
| `.ai/decisions.md` | **удалить** | пустая заглушка (03:223) |
| `docs/engineering/rules/00…70` | **остаются единственным сводом**; правка по таблице Д3 | язык — английский, как сейчас |
| `docs/engineering/code-review.md` | **удалить** | lifecycle — дубль ai-workflow. Список «review focus» сворачивается в инварианты AGENTS.md |
| `docs/engineering/pr-metadata.md`, `release-qa.md`, `frontend-production-completion-canary.md` | оставить | процесс, а не правила кода; AGENTS.md ссылается на них |
| `docs/api-notes/*`, `docs/architecture/modal-router.md`, `docs/contract-tests.md` | оставить | справка |
| `README.md` | переписать раздел команд | убрать шаблонный текст Vite/Babel и строку «vercel-build: full test suite» (03:202) |
| `.codex/config.toml` | оставить | sandbox-настройки, не правила |
| `docs/superpowers/specs/*` | оставить, **место для утверждённых design-спек** | см. конфликт «план/спека» в Д4 |
| `docs/superpowers/plans/*` (2 tracked) | оставить как историю | новые планы не коммитятся |

### Д2. Новый `AGENTS.md`

Структура:
1. `# AGENTS.md` и 2 строки о стеке: «Vite 8, React 19, TS strict, Radix Themes, i18next, PWA; backend-контракты не меняем без явного запроса».
2. `## Инварианты` — список ниже, дословно.
3. `## Команды` — 7 строк: `test:task`, `fix` (prettier + eslint `--fix`), `verify`, `verify:full`, `typecheck`, `version:check`, `baseline:update`.
4. `## Процесс` — 4 ссылки: ai-workflow FLOW, org issue-intake contract, `docs/engineering/release-qa.md`, completion canary. Плюс одна строка: «FE Issue не закрывается руками; после merge в `master` он ждёт в `Awaiting release`».
5. `## Ревью` — «Независимый ревьюер проверяет инварианты 1–15 и наличие регрессионных тестов для изменённой логики. Стиль, формат, порядок импортов и всё, что ловит CI, ревьюер не комментирует.» Секция самодостаточна: ревьюер не обязан открывать ссылки.
6. Блок `<!-- ai-workflow:agents-routing:start/end -->` без изменений (им управляет ai-workflow).

Инварианты (дословно, ровно 15):

```markdown
## Инварианты

1. Слои импортируются только вниз по одному графу: app → pages → features → components → hooks → store → entities → helpers → shared → api → base (constants, types, i18n, styles, assets); basics — между components и helpers; `shared` делится на `shared-api` (`shared/api`, `shared/offline`: только hooks, store, entities, app) и `shared-lib`. Единственный источник графа — `config/eslint/layers.js` (таблица в спеке 02 Д5), `docs/engineering/rules/10-architecture.md` генерируется из него; проверяет `boundaries/dependencies`.
2. UI (pages, features, components, basics) и helpers не вызывают runtime-API, `axios`, `shared/api` и `shared/offline`; серверные данные приходят через query-слой (`entities/*`) или store. Проверяют `boundaries` (элемент `shared-api`) и `no-restricted-imports`.
3. Деньги в коде — `Money { minor: bigint }` (ledger units scale 4); на проводе — JSON-число scale 4 (D21). Граница провода — два слоя: транспорт `shared/api/wireJson.ts` (только в обёртке `api()`) разбирает тело без double в opaque `WireAmount` и пишет исходящие суммы decimal-литералом, но суммы не интерпретирует; конверсия `WireAmount` ↔ `Money` — только `moneyFromWire`/`moneyToWire` в мапперах `entities/*/model` (`toX()`/`toXWire()`). Парсинг ввода, округление, суммы и форматирование — только `src/shared/money/`; `parseFloat`/`Number()`/`JSON.parse` на денежных полях вне него запрещены (lint, спека 03 §4.3). Отображение — только `basics/numbers/amount/Amount.tsx`.
4. Сервер — источник истины для финансов: не патчим балансы/долги локально; мутацию повторяет только цикл outbox `runOutboxOp` (спека 03 §2.4); у всех мутаций TanStack `retry: false`, онлайн-путь — `ledgerOnlineMutationKeys` (`networkMode: 'online'`); устаревший ответ не перезаписывает более новое состояние.
5. Создание/правка/удаление расходов — только через `entities/ledger/api/mutations.ts` (селектор по `offlineWritesAvailable`: онлайн-ключи или outbox); офлайн — только через outbox с client UUID и `entryKind: 'expense'` (включается 03-17 за флагом и capabilities backend; до него офлайн-записи нет). Settle-up и платежи, включая правку и удаление settlement, офлайн запрещены (`ONLINE_ONLY_ACTIONS`, `<OnlineOnly>`).
6. Типы: без `any`, `as any`, `@ts-ignore`, неоправданных `as` и `!`; type-only импорты — `import type`. Данные из IndexedDB, outbox и localStorage проверяются zod при чтении.
7. Промисы не теряются: каждый промис возвращается, `await`-ится или явно помечается `void`; ошибки не глотаются. Стиль `await` или `.then` свободный (запрет async/await снят владельцем 2026-10-28, D24). Проверяют `no-floating-promises` и `no-misused-promises` (оба `error`, JSX-атрибуты тоже: `onClick={() => void action()}`).
8. Только именованные экспорты; не больше одного `index.ts` на слайс, без `export *`.
9. Серверное состояние — TanStack Query; Zustand — UI-состояние. Серверные сторы, которые спека 03 ещё не мигрировала, — переходные: новых не создаём, новые поля серверных данных в них не добавляем. Одно значение читается селектором, несколько — одним объектным селектором с `useShallow`; `useStore()` без селектора и новые `useConnect` запрещены.
10. Перед коммитом — `npm run fix` (Prettier + `eslint --fix`). Ошибки lint после него — только корректность и границы; их сообщение говорит, как чинить. Стилевых правил без автофикса нет; `eslint-disable` — только с причиной.
11. Весь пользовательский текст, включая `aria-*`, `placeholder`, `title` и тосты, идёт через i18n во все локали. Интерактив — нативные элементы или Radix, у кнопок-иконок есть переводимое имя (ревью; lint — 6 правил jsx-a11y из §Д0).
12. `localStorage`/`sessionStorage` — только через `helpers/localStorage.ts`. Токены, invite-токены и персональные данные не попадают в логи, Sentry и URL; logout очищает все пользовательские данные (кэш, outbox, `id`/`role` пользователя); сохраняются только UI-настройки языка и темы.
13. Форматирование — Prettier, порядок импортов — `simple-import-sort`; стиль руками не правим, CI падает на любом warning'е.
14. Задача не меняет `version` в package.json; бамп делается только в release-PR (CI `version:check`).
15. Изменение домена, API или видимого поведения начинается с KB: `chipin-knowledge-base/common/glossary.md` и `common/specs/<capability>.md`; тесты называются по id требований. Если KB недоступна ни локально, ни через GitHub — BLOCKED.
```

### Д3. Каждое правило `docs/engineering/rules` и его судьба

Обозначения: `L:<rule>` — LINT, `CI:<script>`, `R` — REVIEW (инвариант N), `RW` — переписать (как именно — в колонке), `DEL` — удалить. Номер вида `00.TS.3` означает третий пункт раздела TypeScript в файле 00.

| ID | Правило (кратко) | Решение |
|---|---|---|
| 00.TS.1 | strict-типы на границах, инференс локальных значений | DEL (не проверяется; это и так поведение `strict`) |
| 00.TS.2 | явный return type у экспортов и actions | DEL (§Д0: автофикса нет, tsc выводит типы); упоминание `useConnect` удалить |
| 00.TS.3 | `unknown` для недоверенных данных | R (инв. 6) |
| 00.TS.4 | без `any`/`as any`/ts-ignore/`!` | `L:no-explicit-any`, `ban-ts-comment`, `no-non-null-assertion`, `no-unnecessary-type-assertion` |
| 00.TS.5 | предпочитать `satisfies` | DEL |
| 00.TS.6 | `import type` | `L:consistent-type-imports` + tsc `verbatimModuleSyntax` |
| 00.TS.7 | discriminated unions вместо набора boolean | DEL (вкусовое) |
| 00.TS.8 | закрытые наборы строк — `as const`-объект | DEL |
| 00.TS.9 | `Api*` имена не в UI | RW → «UI импортирует доменные типы». После D4 проверяется `boundaries` (UI не импортирует `api/generated/**`) |
| 00.TS.10 | без indexed-access типов в props | DEL |
| 00.Naming.1 | PascalCase/camelCase/UPPER_SNAKE | DEL (§Д0: `naming-convention` без автофикса) |
| 00.Naming.2–3 | kebab-case директорий, PascalCase.tsx | DEL (§Д0: автофикса нет) |
| 00.Naming.4 | boolean `is/has/can/should` | DEL (оговорка «when practical» не проверяется) |
| 00.Naming.5 | без boolean-отрицаний | DEL |
| 00.Naming.6 | `on*`, без `handle*` | DEL (§Д0: rename руками, автофикса нет) |
| 00.Naming.7–8 | имена по бизнес-смыслу, описательные итераторы | DEL |
| 00.Promises.1 | без async/await | DEL (решение владельца 2026-10-28, D24); текущее правило репозитория удалить в 02-A |
| 00.Promises.2 | async action возвращает `Promise<T>` | DEL (`promise-function-async: off`) |
| 00.Promises.3 | плоские цепочки | DEL |
| 00.Promises.4 | не глотать ошибки | `L:no-floating-promises`; семантика — R (инв. 7) |
| 00.Promises.5 | read-actions резолвятся, «без `void`-обёрток» | **RW**: «намеренно не ожидаемый промис помечается `void`» — иначе конфликт с `no-floating-promises` |
| 00.Promises.6–9 | `.finally` для cleanup, `Promise.all`, без `new Promise`, не смешивать стили | DEL (6, 7); `L:no-async-promise-executor` для 8; 9 — DEL (стиль свободный, D24) |
| 00.Collections.* (8 пунктов) | один проход, `for...of`, без spread в reduce, `Map` для lookup | RW → сжать до 3 строк, без lint (§Д0); остальное DEL |
| 00.Modules.1 | именованные экспорты | `L:import-x/no-default-export` (исключения в Д5) |
| 00.Modules.2 | формат `index.ts` | RW (D11): один barrel на слайс, `export { … } from` разрешён, `export *` запрещён — `L:no-restricted-syntax ExportAllDeclaration` + `CI:scripts/check-file-layout.mjs` (новый, ≈40 строк; только: index.ts глубже слайса запрещён, новые `useConnect.ts` запрещены) |
| 00.Modules.3 | граница директории через index | RW → «граница слайса через его index»; `L:import-x/no-internal-modules` в форме allow-list (Д5) |
| 00.Modules.4 | ранние return | DEL |
| 00.Modules.5 | без вложенных тернарников | DEL (§Д0) |
| 00.Modules.6–8 | абстракции, размер функций, комментарии на английском | DEL |
| 00.Modules.9 | TODO при отложенном фиксе | DEL |
| 00.Modules.пример | `import AddExpenseModal from` | RW → named-пример (конфликт R2) |
| 00.Touched | правило тронутого кода | RW → одна строка в 70 §Legacy |
| 10.Direction.* | граф слоёв, helpers без store | `L:boundaries/dependencies` (Д5); `features/routing` — элемент `app`, поэтому routing → pages разрешено до переезда в `src/app/router` (04-2a), в suppressions не идёт (C1-24) |
| 10.Ownership.1–2 | локальный стейт; Zustand только для shared | RW (D3): «Zustand — только UI-состояние, серверное — TanStack Query» |
| 10.Ownership.3 | runtime API не из UI | `L:no-restricted-imports` (уже есть) |
| 10.Ownership.4–6 | DTO на границе, side effects, контракты | R (инв. 2, 4) |
| 10.Placement.* (5) | узкий слой, без лишних сервисов, не двигать папки | DEL, кроме «узкий слой» → R |
| 10.Recursive.* | рекурсивная структура `components/ internal/ styled.ts types.ts` | RW (D11): `internal/` и `components/` без своих index.ts; `types.ts` только для типов с ≥2 потребителями; `styled.ts` остаётся до D14 |
| 10.DirNaming.* | kebab-case, без compat-файлов родителя | DEL (§Д0) |
| 10.Ownership(dir).* | Props в `types.ts`, `internal/useConnect.ts` | **RW** (конфликты R3, R4): Props в файле компонента; `useConnect` удалить |
| 10.Index.* (9) | index в каждой директории, deep-импорты запрещены | RW (D11): только `src/<layer>/<slice>/index.ts`; внутри слайса — относительные импорты файлов; снаружи — только index слайса или файл в корне слоя |
| 10.InternalExports | хелперы именованно, `import * as helpers` запрещён | DEL (§Д0) |
| 10.Tests.* | co-location, без `__tests__` | DEL (§Д0) |
| 10.Adoption | правила для нового/тронутого кода | RW → 70 §Legacy |
| 10.StoreLayout.* | `<domain>-store/{actions,types,…}` | RW (D3): UI-сторы живут в `store/ui-prefs/<name>Store.ts` (спека 03 §6, спека 05 `appearanceStore`); серверные сторы удаляются миграцией TanStack, отдельный layout для них не вводим (A-35) |
| 10.CrossStore.* | без записи в чужой store, оркестратор | R (инв. 4); после D3 правило отпадает |
| 10.ChangeScope | не менять поведение попутно | DEL (общий принцип ai-workflow) |
| 20.Components.1 | чистый render | `L:react-hooks` (compiler rules, уже есть) |
| 20.Components.2 | без `React.FC` | DEL (§Д0: фиксер `react/function-component-definition` не трогает переменные с типом `FC`) |
| 20.Components.3 | один компонент на файл | DEL (§Д0) |
| 20.Components.4 | Props в файле компонента | RW (D11): конвенция «Props в файле компонента, прямо над компонентом» остаётся текстом свода без lint (§Д0: проверка удалена, не конвенция); вариант «Props в `./types`» удаляется (C1-17) |
| 20.Components.5 | named exports | `L:import-x/no-default-export` |
| 20.Components.6 | без компонентов внутри render | `L:react/no-unstable-nested-components` |
| 20.Components.7–8 | минимальные props, boolean по умолчанию false | `L:react/jsx-boolean-value` (never) для части 8; остальное DEL |
| 20.Components.9 | `on*` | DEL (§Д0) |
| 20.State.* (4) | единый источник, без копий в state, derived в render | DEL (react-hooks compiler rules частично ловят это: `set-state-in-effect`) |
| 20.Effects.1–4 | эффекты только для внешних систем, deps, без API | `L:react-hooks/exhaustive-deps` (error); остальное R |
| 20.Effects.5 | игнор промиса в эффекте | **RW**: пример `void fetchSetGroups();` |
| 20.Hooks.* (4) | `use*`, чистые хелперы не хуки | `L:react-hooks/rules-of-hooks`; остальное DEL |
| 20.StoreConn.* (11) | `useConnect` для ≥2 подписок | **DEL целиком** (D12). Вместо него 40.Sel |
| 20.Perf.1–4 | без memo по умолчанию | DEL (React Compiler в react-hooks v7 делает это правило неактуальным) |
| 20.Perf.5–6 | тяжёлые формы, row view-models | DEL (переезжает в спеку 03 §6, шаг 6: 03-13/03-14) |
| 20.Decomp.* | разбивка по ответственности | DEL |
| 30.Radix.1–3 | Radix first, styled только если нельзя | R → RW по D14 (спека 05 §3 «Сначала пропсы Radix») |
| 30.Radix.4 | без новых UI-библиотек | `L:no-restricted-imports` (patterns `@mui/*`, `@chakra-ui/*`, `antd`, `tailwindcss`, `@emotion/*`) |
| 30.ZIndex.* (5) | без глобальной z-index шкалы | DEL (3 использования, вкусовое) |
| 30.Responsive.1–5 | responsive props Radix | DEL |
| 30.Responsive.6 | без хардкода `767px` в media | DEL (§Д0) |
| 30.Colors.1–4 | `themeColor()`, без hex | RW по D14 (`var(--cp-*)`); lint вводит **05-5** (A-17): `no-raw-colors` — не плагин, а блок `no-restricted-syntax` в `config/eslint/project.js`; regex (с якорями, C1-21), селекторы, исключения и фикстуры — только в спеке 05 §3; для CSS/`<style>` — stylelint (таблица §Д0). Текст правила меняется в 05-5 |
| 30.Colors.5 | transient `$prop` | DEL |
| 30.ClassName.* | без className/style | `style` с обычными свойствами запрещён, кастомные свойства (`--x`) разрешены — селектор из спеки 05 §3 (05-5); className — DEL (CSS Modules по D14 его требуют) |
| 30.A11y.1–6 | семантика, имена, label, dialog title | `L:` 6 правил jsx-a11y (§Д0) + R (инв. 11) |
| 30.Images.* | `basics/Image` вместо `<img>` | `L:no-restricted-syntax JSXOpeningElement[name.name='img']` вне `basics/Image.tsx`; `styled.img` — тот же селектор по `MemberExpression` |
| 30.i18n.1 | весь текст через i18n | `L:react/jsx-no-literals` (дети JSX) + `no-restricted-syntax` по пользовательским атрибутам (Д5) |
| 30.i18n.2 | ключи во всех локалях | `CI:` тест паритета ключей локалей — вводит 04-2c (единственный владелец); здесь только ссылка |
| 30.Money.1–2 | Amount, AmountInput | R (инв. 3) + денежные `L:no-restricted-syntax` из спеки 03 §4.3 (`toFixed`/`Intl.NumberFormat` вне `src/shared/money/**` и `src/shared/lib/formatNumber.ts`) |
| 30.Split.* (2) | стабильные размеры split-строк | DEL из свода → в спеку 03 §6 (03-13/03-14) |
| 30.Landing (сейчас в AGENTS.md:23-28) | синхронизировать `*PagePreview` | перенести в 30-ui как R; удаляется спекой 04 вместе с лендингом |
| 40.Choice.* (8) | когда Zustand | RW (D3): «Zustand = UI-state; серверное состояние = Query» |
| 40.Loading.* (8) | loadingStore/errorsStore | RW (D3): действует до миграции стора; после миграции удаляется |
| 40.Sel.1 | без `useStore()` без селектора | `L:no-restricted-syntax CallExpression[callee.name=/^use\w+Store$/][arguments.length=0]` |
| 40.Sel.2–3 | одно значение — селектор, несколько — объект + `useShallow` | **оставить (D12)**; `L:` — тот же селектор: объектный литерал в аргументе `use*Store` без обёртки `useShallow`. Запрет файлов `useConnect.ts*` — `CI:check-file-layout` с baseline 17 файлов |
| 40.Sel.4–8 | не группировать несвязанное, именованные селекторы в `selectors.ts`, стабильность | R/DEL: стабильность — R; остальное DEL |
| 40.Sel.9 | без `getState()` в render | DEL (react-hooks compiler `purity` частично ловит) |
| 40.Updates.* (5) | иммутабельность, функциональный `set` | DEL (после D3 серверных обновлений в Zustand нет) |
| 40.Naming (таблица) | `fetchSet*`, `create*`… | RW (D3): таблица именования query/mutation-хуков `use<Entity>Query`, `use<Verb><Entity>Mutation` |
| 40.Async.* (8) | stale/concurrency для actions | RW (D3): заменяется правилами Query; инв. 4 |
| 40.Coord.* (5) | координация сторов | DEL после D3; до него R |
| 50.Boundary.* | UI → store → api | `L:boundaries` + `no-restricted-imports` |
| 50.Modules.* | namespace-импорт API | `L:no-restricted-imports` (`importNames` для `api/*`) → RW по D4 (сгенерированный клиент) |
| 50.Naming (таблица) | имена API-функций | RW (D4) |
| 50.Axios.* (8) | generic, mapper, Input/Request/Response | RW (D4): типы из OpenAPI; ручные `Request/Response` запрещены; zod только на stale-format границах |
| 50.Payloads.* (4) | 0/false/null, params | R (инв. 4) + `L:no-restricted-syntax` конкатенации в URL (`TemplateLiteral` в первом аргументе `apiInstance.*`) |
| 50.Errors.* (6) | ошибки не дублируются, interceptors | R |
| 50.Cancel.* (6) | AbortSignal, без ретрая мутаций | R (инв. 4) + `L:no-restricted-syntax` `CancelToken` |
| 50.OnlineFirst.* (6) | рефетчи после мутаций | RW (D3): заменяется `invalidateQueries`; таблица рефетчей — спека 03 §2.2 |
| 50.Activity | ссылка на api-notes | оставить |
| 60.Money.1 | **«money = JS Number»** | **DEL — конфликт R1 → D21**: `Money` с `bigint` scale 4, модуль `src/shared/money/` (спека 03 §4) |
| 60.Money.2 | без integer-минорных единиц | **DEL — противоречит D21/спеке 03** (арифметика в `bigint` ledger units scale 4, как backend) |
| 60.Money.3–7 | Amount, backend — источник истины, конвертация | R (инв. 3, 4) |
| 60.Offline.* (7) | локальный lifecycle, idempotency | RW (D2): outbox + client UUID; «не изобретать outbox» удалить |
| 60.Input.* (5) | сумма как строка, `Number.isFinite` | RW (D21): парсинг только `parseMoneyInput` / `moneyFromWire` (спека 03 §4.2) |
| 60.Rounding.* (7) | без промежуточного округления | RW (D21): округление `roundToMinor` (half-up от нуля до minor units валюты) только для отображения, внутри `src/shared/money/` |
| 60.UI.* (4) | вывод через Amount | `L:` см. 30.Money |
| 60.Dates.* (6) | единицы времени, `Intl.DateTimeFormat` | DEL, кроме «не хранить `Date` в store» → R |
| 60.Helpers.* (6) | чистые хелперы | `L:boundaries` (helpers без store, `api`, `shared-api`; Д5) + R |
| 60.Storage.1 | localStorage только через helper | `L:no-restricted-globals` (+ `sessionStorage`) |
| 60.Storage.2–8 | схема ключей, guard, try/catch | RW (D4): zod-схема на чтение; `localStorage.clear()` — `L:no-restricted-syntax` |
| 70.Stack, When, Shape, Priority | стек тестов | оставить; async/await в тестах разрешён (D24); `toMatchSnapshot` — DEL (§Д0) |
| 70.Commands | команды | RW: актуальный список скриптов (Д7) |
| 70.Integration (12 пунктов) | lifecycle, version:bump, `@codex review` | **DEL целиком** (дубль ai-workflow; P1–P4) |
| 70.Legacy.* (4) | baseline, «warn → error после нуля» | RW: «уровни только error/off; baseline — `eslint-suppressions.json` (нативные suppressions ESLint), только сокращается, обновляется `npm run baseline:update`; записи добавляет только PR, который включает правило» |

### Д4. Как разрешаются конфликты из матрицы аудита (03-tooling-rules.md §5)

| Конфликт | Решение |
|---|---|
| R1 money: Number vs запрет `Number()` | D21 (D10 снят): домен — `Money { minor: bigint }` scale 4, провод навсегда JSON-число scale 4 (backend — источник истины), конверсия только на границе API, арифметика в `bigint` ledger units. 60.Money.1–2 удаляются. Набор lint-селекторов и ignores (`src/shared/money/**`, `src/shared/lib/formatNumber.ts`, тесты) — **единственный, в спеке 03 §4.3** (03-1 вводит сразу `error` + `eslint --suppress-rule` для известных ~29 мест; 03-3 и PR миграции убирают записи; C2-03); эта спека его не дублирует. Немонетарные исключения — `// eslint-disable-next-line no-restricted-syntax -- not money: <причина>`; `eslint-comments/require-description` требует причину |
| R2 exports: «prefer named» vs примеры с default | D11. Только named; все примеры в 00 и 10 переписаны. Lint `import-x/no-default-export` |
| R3 Props: файл компонента vs `./types` | D11. В файле компонента, прямо над компонентом. Примеры 00:139 и 10:96,137 переписаны. `types.ts` — только для типов с ≥2 потребителями |
| R4 store reads: `useShallow` vs `useConnect` vs отдельные селекторы | D12. Один объектный селектор с `useShallow`; пример 40:54-55 переписан; раздел 20 «Component Store Connections» удалён |
| P2/P3/D15 версия: кто бампит, «pre-1.0» | Задачи не бампят. Release-PR `chore/issue-<n>-release-v<x.y.z>` запускает `npm run version:bump -- <patch\|minor\|major>`; делает его Trusted Publisher или владелец, Executor — никогда. CI правило в Д7. Фразы «Version impact в каждом task prompt» и «major rejected pre-1.0» удаляются |
| P7 KB отсутствует: fallback vs обязательный clone | Одно правило (инв. 15): (1) `../chipin-knowledge-base`, если есть; (2) иначе `git clone` туда, если есть git и сеть; (3) иначе чтение через аутентифицированный GitHub; (4) иначе BLOCKED. Копии KB в репо запрещены |
| P8 планы/спеки: `docs/specs/` не существует, `.gitignore` игнорирует tracked-файлы | Утверждённые design-спеки коммитятся в `docs/superpowers/specs/<YYYY-MM-DD>-<slug>.md`. Планы не коммитятся (`docs/superpowers/plans/` остаётся в ignore). Implementation-инварианты — в соответствующую главу `docs/engineering/rules/`. `.gitignore`: удалить `docs/superpowers/*`, `/docs/superpowers/specs/`, `/docs/engineering/plans/`, `/docs/engineering/specs/`; оставить `/docs/superpowers/plans/` и `/.superpowers/` |
| P4 `@codex review` | На master уже удалено; проверить grep'ом в 02-A2 |
| P10 «формат проверяет CI» | Становится правдой после 02-C1…02-C3 (Prettier + `format:check` в `verify`) |
| P11/P12/P13 Vite 7, Trello, локальный абсолютный путь `Canonical root` | Vite 8 в шапке; Trello — одна строка в ai-workflow, из AGENTS.md удалить; путь `Canonical root` сидит внутри routing-блока ai-workflow → issue в ai-workflow |
| T2/T3 что делает verify:full / vercel-build | Описание из Д7 — единственное, в 70 §Commands и README |

### Д5. ESLint: целевой инвентарь

Структура (готовность к монорепо, Д9):

```
eslint.config.js          // 15 строк: собирает пресеты, задаёт APP_DIR = '.'
config/eslint/aliases.js  // читает paths из tsconfig.app.json через typescript API — единственный список алиасов
config/eslint/base.js     // js + tseslint recommended + явный список type-aware (Д0), prettier, import-x, unused-imports, sort
config/eslint/react.js    // react, react-hooks, jsx-a11y, i18n
config/eslint/layers.js   // boundaries + no-restricted-imports
config/eslint/project.js  // ChipIn-правила: деньги, img, storage, хелперы restrictedSyntax()/restrictedImports()
config/eslint/rule-classes.json // машинная копия реестра §Д0 (rule → a|b)
eslint-suppressions.json  // в корне: нативные suppressions ESLint (baseline), только сокращается
```

Новые devDependencies (версии на 2026-10-28, ставить через `^`):
- `eslint-plugin-jsx-a11y@6.10.2`, `eslint-plugin-import-x@4.17.1`, `eslint-import-resolver-typescript@4.4.5`, `eslint-plugin-boundaries@7.4.0`;
- `@eslint-community/eslint-plugin-eslint-comments` (последняя);
- `prettier@3.9.10`, `eslint-config-prettier@10.1.8`, `lint-staged@17.6.0`.

Правила (все `error`, если не сказано иначе; класс каждого — в §Д0, правила класса c здесь уже выключены):

| Группа | Правило / настройка |
|---|---|
| ignores | `dist`, `dev-dist`, `coverage`, `node_modules/.cache`, `.claude/**`, `public/**`, `ds-gallery/standalone.html` |
| языки | `src/**` и `ds-gallery/**` — browser globals; `scripts/**`, `*.config.*`, `contract-tests/**`, `ds-gallery/build-html.mjs` — node globals |
| type-aware | явный список из §Д0 (`no-floating-promises`, `no-misused-promises`, `no-unsafe-*`, `no-unnecessary-type-assertion`), не весь `recommendedTypeChecked`; `parserOptions.projectService: true`, `tsconfigRootDir: import.meta.dirname`; для `**/*.{js,mjs}` — `disableTypeChecked` |
| promises (инв. 7 — и для loaders/скриптов; стиль `await`/`.then` свободный, D24) | `no-floating-promises` (`ignoreVoid: true`), `no-misused-promises` (`checksVoidReturn: { attributes: true }` — `onClick={() => promise}` тоже ошибка с подсказкой `onClick={() => void action()}`; C1-22), `promise-function-async: off`, `require-await: off` |
| tests override | `**/*.test.{ts,tsx}`: `unbound-method: off`, `no-unsafe-assignment: off`, `no-unsafe-member-access: off` (vi.fn/expect-паттерны); `unbound-method` не включается вовсе |
| типы | `consistent-type-imports` (`fixStyle: 'inline-type-imports'`), `no-import-type-side-effects`, `no-unnecessary-type-assertion`, `no-non-null-assertion` |
| unused | `@typescript-eslint/no-unused-vars: off` (убирает двойной репорт, 03:46), `unused-imports/no-unused-imports` (autofix); неиспользуемые переменные ловит только tsc `noUnused*` |
| prettier | `eslint-config-prettier` последним; `no-multiple-empty-lines` и `curly` — `curly: all` оставить (prettier его не трогает) |
| import-sort | `simple-import-sort/imports` и `/exports`. Группы: `['^node:']`, `['^react$','^react-dom$','^@?\\w']`, затем **одна группа, собранная из всех алиасов tsconfig** в порядке слоёв: `^(app\|bootstrap\|pages\|features\|entities\|store\|api\|shared\|hooks\|helpers\|constants\|i18n\|types\|public-routes)(/\|$)`, `^(components\|basics)(/\|$)`, `^(assets\|styles)(/\|$)`, `['^\\.\\.']`, `['^\\.']`, `['\\.s?css$']`. Регулярки строятся в `aliases.js` из `paths` — ручного списка нет |
| import-x | `import-x/no-default-export`; `import-x/no-cycle` (`maxDepth: 3`, только в полном режиме `CHIPIN_ESLINT_FULL=1` — дорого; его ставит сам скрипт `lint:full`, поэтому локальный `verify:full` и CI видят одно и то же, C1-23; вводит 02-C9 с suppressions для известных циклов `groupsStore`↔`activity-store`, `expenseModalStore`↔selectors); `import-x/no-useless-path-segments`; `import-x/no-self-import` |
| исключения default export | `*.config.{js,ts,mjs}`, `eslint.config.js`, `vite.config.ts`, `vitest*.config.ts`, `ds-gallery/vite.config.ts`, `pwa-assets.config.ts`, `**/*.d.ts`. Route-модулям исключение не нужно: D6 `lazy` ждёт named `Component`. До D6 — `React.lazy(() => import('pages/X').then((m) => ({ default: m.X })))` |
| react | `react.configs.flat.recommended` + `jsx-runtime`; `react/no-unstable-nested-components`, `react/jsx-boolean-value: never`, `react/prop-types: off` |
| react-hooks | `recommended` (v7); `exhaustive-deps: error` |
| a11y | без `recommended`; только `alt-text`, `anchor-is-valid`, `aria-props`, `aria-role`, `role-has-required-aria-props`, `no-static-element-interactions` (§Д0); `no-autofocus` не включается (модалки) |
| i18n | `react/jsx-no-literals`: `noStrings: true`, `ignoreProps: true`, `noAttributeStrings: false`, `allowedStrings: [' ','-','+','/','~','·']` — ловит текст в JSX-детях. Пользовательские атрибуты ловит `no-restricted-syntax` на `JSXAttribute[name.name=/^(aria-label\|aria-description\|placeholder\|title\|alt)$/] > Literal[value=/\\w/]` (A-38: `elementOverrides` работает по элементу, а не по атрибуту). `ds-gallery/**` исключён (демо-литералы) |
| naming | нет (§Д0: `naming-convention` без автофикса удалён, включая текущий селектор `handle*`) |
| project | `no-restricted-syntax`: `ExportAllDeclaration`, `<img>`, `localStorage.clear`, `CancelToken`, объектный литерал в `use*Store(...)` без `useShallow`, `use*Store()` без аргумента; у каждого селектора `message` с готовым исправлением. Денежные селекторы — спека 03 §4.3, цветовые — спека 05 (05-5); все блоки `no-restricted-syntax`/`no-restricted-imports` собираются хелперами `restrictedSyntax()`/`restrictedImports()` из `config/eslint/project.js` (вводит 02-C4), потому что в flat config более поздний блок заменяет опции правила целиком |
| globals | `no-restricted-globals`: `localStorage`, `sessionStorage` (кроме `helpers/localStorage.ts`) |
| ignores (генерируемые файлы) | ESLint и Prettier игнорируют `**/vercel.json`, `**/routing.generated.ts`, `packages/tokens/generated/**`, `src/shared/api/generated/**`, `eslint-suppressions.json`: генератор пишет итог сам, `routes:check`/`tokens:check` сверяют его побайтно (C1-20) |
| imports | `no-restricted-imports`: `axios` (кроме `src/api/chipin.{instance,interceptors}.ts`, после 03-4b — `src/shared/api/http.ts`), runtime `api/` из UI (как сейчас, `allowTypeImports`), UI-библиотеки (30.Radix.4). Мёртвый override `authSession` (03:58) удалить |
| eslint-comments | `require-description`; лишние disable — `linterOptions.reportUnusedDisableDirectives: 'error'` (autofix) |

Граф слоёв (`config/eslint/layers.js`, `boundaries/elements` описывают **текущие** папки, код не двигается; у каждого элемента явный `mode`: `file` для отдельных файлов, `folder` для остальных; A-35):

| element type | pattern (от `src/`) |
|---|---|
| `app` | `main.tsx`, `root.tsx`, `pages/GlobalHooks.tsx` (`mode: 'file'`); `app/**` (создают 03-5 и 04-2a; включает `app/pwa`, `app/i18n`, `app/router`), `bootstrap/**`, `features/routing/**`, `public-routes/**` (до удаления спекой 04) (`mode: 'folder'`) |
| `pages` | `pages/*` |
| `features` | `features/*` |
| `entities` | `entities/**` (создаёт спека 03: queries, мапперы, доменные модели) |
| `store` | `store/**` (оставшиеся UI-сторы, спека 03 §6) |
| `components` | `components/**` |
| `basics` | `basics/**`, `design-system/**` (спека 05: `AppTheme` получает `appearance` пропом и store не читает) |
| `hooks` | `hooks/**` |
| `helpers` | `helpers/**` |
| `shared-api` | `shared/api/**`, `shared/offline/**` (спека 03: клиент `api()`, `apiInstance`, `queryClient`, persister, outbox; C1-12) |
| `shared-lib` | остальное `shared/**` (`shared/money`, `shared/lib`) |
| `api` | `api/**` |
| `base` | `constants/**`, `types/**`, `i18n/**`, `styles/**`, `assets/**` |

Политика `boundaries/dependencies` — `default: 'disallow'`; разрешено (слева «откуда», справа «куда»):

| from | allow to |
|---|---|
| app | всё |
| pages | features, components, basics, hooks, store, entities, helpers, shared-lib, api, base |
| features | features (только чужой `index.ts`), components, basics, hooks, store, entities, helpers, shared-lib, api, base |
| components | components, basics, hooks, store, entities, helpers, shared-lib, api, base |
| hooks | hooks, store, entities, helpers, shared-api, shared-lib, api, base |
| store | store, entities, helpers, shared-api, shared-lib, api, base |
| entities | entities (только чужой `index.ts`), helpers, shared-api, shared-lib, api, base |
| basics | basics, helpers, shared-lib, base |
| helpers | helpers, shared-lib, base |
| shared-api | shared-api, shared-lib, api, base |
| shared-lib | shared-lib, base |
| api | api, base |
| base | base |

Это единственный граф (A-12): он ацикличен (`entities → store` запрещён, `store → entities` разрешён) и совпадает с инвариантом 1, который на него только ссылается. UI-слои и helpers не видят `shared-api` (инв. 2, C1-12); `helpers → api` убран (60.Helpers «helpers без store/api»). Критерий 02-C9: фикстуры `components/__probe.ts` с `import { api } from 'shared/api'` и `helpers/__probe.ts` с `import 'api/…'` дают ошибку. `docs/engineering/rules/10-architecture.md` содержит таблицу, сгенерированную из `layers.js` скриптом `scripts/generate-layers-doc.mjs` (02-C9); тест сверяет закоммиченный текст с генерацией.

`api` в UI-слоях разрешён только через типы. Это обеспечивает существующий `no-restricted-imports` с `allowTypeImports`, а не boundaries. Резолвер — `eslint-import-resolver-typescript` с `project: tsconfig.app.json`. Известные ~30 нарушений (01-architecture.md:49-56: routing→pages 14 — они уходят в `app` и нарушением не считаются; basics→components/store/hooks 4, включая `NavButton.tsx:7` и `BalanceSummaryText.tsx:8` — чинит 05-6; helpers→store; components↔public-routes) получают записи в `eslint-suppressions.json` (`--suppress-rule boundaries/dependencies` в 02-C9).

Быстрый режим: `eslint.config.js` читает `process.env.CHIPIN_ESLINT_FAST === '1'`. В этом режиме ко всем файлам применяется `tseslint.configs.disableTypeChecked` и `parserOptions.projectService: false` (иначе программа TS всё равно строится и < 5 с недостижимо, A-36), `import-x/no-cycle` выключен — для pre-commit. CI и pre-push всегда работают в полном режиме. `--cache` в `lint` не используется: с type-aware правилами кэш даёт устаревший результат по зависимым файлам.

### Д6. Prettier, editorconfig, VSCode

- `prettier.config.js` (ESM, заменяет `.prettierrc.cjs`): `{ printWidth: 100, tabWidth: 4, useTabs: false, semi: true, singleQuote: true, jsxSingleQuote: false, trailingComma: 'all', arrowParens: 'avoid', bracketSpacing: true, bracketSameLine: false, endOfLine: 'lf', overrides: [{ files: ['*.json','*.yml','*.yaml'], options: { tabWidth: 2 } }] }`. Значения текущего конфига сохраняются (`arrowParens: 'avoid'` даёт меньший diff, 317 файлов против 387 при `always`); `jsxBracketSameLine` заменён на `bracketSameLine`.
- `.prettierignore`: `dist`, `dev-dist`, `coverage`, `node_modules`, `package-lock.json`, генерируемые файлы из Д5 «ignores» (C1-20), `public`, `LICENSE`, `THIRD_PARTY_NOTICES.txt`, `ds-gallery/standalone.html`, `src/i18n/locales/**` (переформатирование JSON локалей не нужно), `docs/superpowers/**`, `AGENTS.md`, `CLAUDE.md` (sync-блоки ai-workflow), `.github/**` (A-23: иначе sync ai-workflow и Prettier перезаписывают друг друга). Override `*.md` → `{ tabWidth: 2, proseWrap: 'preserve' }` (иначе списки в `docs/**` станут `-   item`).
- Объём: «317 из 737» — только `src`. Точное число файлов для 02-C2a–c считается в 02-C1 командой `npx prettier --list-different . | wc -l` (с этим `.prettierignore`) и записывается в описания 02-C2a–c; разбиение a/b/c — по папкам так, чтобы каждый PR был выводом одной команды.
- `.editorconfig`: `root=true`; `[*] indent_style=space, indent_size=4, end_of_line=lf, charset=utf-8, insert_final_newline=true, trim_trailing_whitespace=true`; `[*.{json,yml,yaml}] indent_size=2`; `[*.md] trim_trailing_whitespace=false`.
- `.vscode/extensions.json`: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`; `.vscode/settings.json` в git не кладём.
- `.git-blame-ignore-revs` — SHA форматирующих PR.

### Д7. Скрипты, hooks, CI

`package.json` scripts (итог):

```json
"build": "tsc -b && vite build && npm run verify:public-precache",
"vercel-build": "vite build && npm run verify:public-precache",
"lint": "eslint . --max-warnings 0 && node scripts/check-rule-registry.mjs",
"lint:full": "CHIPIN_ESLINT_FULL=1 eslint . --max-warnings 0 && node scripts/check-rule-registry.mjs",
"format": "prettier --write .",
"format:check": "prettier --check .",
"fix": "prettier --write . && eslint . --fix",
"baseline:update": "eslint . --prune-suppressions && node scripts/update-tsc-baseline.mjs",
"typecheck": "tsc -b",
"verify": "npm run version:check && npm run format:check && npm run lint && npm run typecheck",
"verify:full": "npm run version:check && npm run format:check && npm run lint:full && npm run typecheck && npm run test:full && npm run build && npm run build:ds-gallery",
"build:ds-gallery": "vite build --config ds-gallery/vite.config.ts && node ds-gallery/build-html.mjs",
"icons:generate": "pwa-assets-generator",
"version:check": "node scripts/version-check.mjs"
```

Удаляются `test:run` (дубль `test:full`) и `create-pwa-icons` (переименован в `icons:generate`). `test` (watch) остаётся. `prerender:public` не трогаем — его удаляет спека 04.

`lint-staged` (в package.json):

```json
"lint-staged": {
  "*.{ts,tsx,js,mjs}": ["prettier --write", "node scripts/eslint-fix-staged.mjs"],
  "*.{json,md,css,yml,yaml,html}": ["prettier --write"]
}
```

- `.husky/pre-commit`: `CHIPIN_ESLINT_FAST=1 npx lint-staged` — цель меньше 5 с. `scripts/eslint-fix-staged.mjs` (≈20 строк) запускает `eslint --fix` по переданным файлам, печатает оставшиеся ошибки как подсказку и **всегда выходит с 0**: коммит не блокируется никогда.
- `.husky/pre-push` удаляется: блокирует только CI. Локальная проверка — `npm run verify:full` по команде (агент запускает её перед `IMPLEMENTATION_COMPLETE`).
- Своего `update-baseline.mjs` нет: ESLint-часть — `eslint . --prune-suppressions`; `scripts/update-tsc-baseline.mjs` (≈30 строк) только убирает исправленные записи `config/tsc-baseline.json`, если 02-C11 делится (иначе no-op). Новые записи не добавляет ни одна команда `baseline:update`; рост ловит `check-baseline.mjs`.
- `scripts/check-baseline.mjs --base "$BASE_SHA"` (≈50 строк, 02-C4): сравнивает `eslint-suppressions.json` и `config/tsc-baseline.json` с `git show $BASE_SHA:<файл>`; новый ключ файл × правило или рост счётчика — fail, кроме правил, которые этот PR впервые добавил в `config/eslint/rule-classes.json`.

CI (`frontend-ci.yml`, шаг `Verify frontend`): `npm run verify:full` — это даёт format, version, `lint:full` (`--max-warnings 0`, `no-cycle`), typecheck. `BASE_SHA` сейчас — `env` только шага «Resolve verification mode» (`id: gate`), в `GITHUB_OUTPUT` пишется лишь `mode` (C1-15, C2-26). Поэтому 02-C4 добавляет в этот шаг `echo "base_sha=$BASE_SHA" >> "$GITHUB_OUTPUT"` (git fetch base там уже есть), а шаги ratchet'ов получают `env: BASE_SHA: ${{ steps.gate.outputs.base_sha }}`. Скрипты с `--base` (`check-baseline`, `check-styled-allowlist`, `version-check`) при `CI=true` и пустом или не-SHA `--base` в `pull_request` падают (fail closed); в `push` без base (первый push ветки) печатают notice и пропускают проверку роста. Новые шаги перед `Verify frontend` — только для `pull_request`:

```
node scripts/check-baseline.mjs --base "$BASE_SHA"
node scripts/version-check.mjs --base "$BASE_SHA" --head-branch "$GITHUB_HEAD_REF"
```

Правило проверки: если `version` в `package.json` отличается от base, ветка должна совпадать с `^chore/issue-\d+-release-v(\d+)-(\d+)-(\d+)$`, а новая версия — равняться версии из имени ветки и быть больше base. Иначе exit 1 с текстом «version changes only in a release PR». Решено (подтверждено владельцем 2026-10-28): на каждый релиз — ровно один release-Issue, ветка `chore/issue-<n>-release-vX-Y-Z` проходит обычный `pr:create`/admission; поле `Version impact` из шаблона Issue удаляется, бамп выбирает владелец. Расширение `version-check.mjs` — около 40 строк + тест. Dependabot-PR покрыты: они версию не меняют.

`ci-gate-policy.mjs` в этой спеке не меняется (`AGENTS.md` и конфиги и так дают mode `full`); режимы `app|site` добавляет 04-1b (спека 04 §1.4).

Формат версии (A-09, D15). Версию производит только `scripts/version-resolver.mjs` из корневого `package.json`: prod (`VERCEL_ENV=production`) — чистая `x.y.z`, остальные сборки — `x.y.z-dev-<sha7>` (спека 04 §1.2, 04-0a). Любое сравнение версий (min-client-version 03-20, `version-check`) берёт только semver-ядро `major.minor.patch`.

Deploy (D15): workflow'ов нет и новых не будет; источник — `DEPLOYMENT.md` §«Vercel delivery from master». Порядок релиза записывается в `docs/engineering/release-qa.md` одним разделом:
1. release-PR с бампом;
2. merge в `master`;
3. Preview;
4. «Prepare frontend release QA»;
5. Promote.

Если с прошлого релиза влит PR, меняющий провод ledger или схему outbox (метка `wire-change`, правило m9 спеки 03 §7), Promote — только из release-PR с бампом версии, чтобы `MIN_CLIENT_VERSION` мог на него сослаться (C3-21).

Связь с тегами — ChipIn-one/.github#172 (не эта спека).

### Д8. TypeScript

Новый `tsconfig.base.json` с общими опциями: `strict`, `noUnused*`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `moduleResolution: bundler`, `module: ESNext`, `skipLibCheck`, `noEmit`, `allowImportingTsExtensions`, `moduleDetection: force`, `verbatimModuleSyntax: true`. `tsconfig.app.json` и `tsconfig.node.json` делают `extends` и задают только `target/lib/jsx/include/paths`.

| Стадия | Изменение | Объём |
|---|---|---|
| T1 | `tsconfig.app.json`: `include: ["src", "ds-gallery"]`, `exclude: ["ds-gallery/vite.config.ts"]`; удалить `ds-gallery/tsconfig.json` и `tsc -b ds-gallery` из скрипта. `tsconfig.node.json` include + `ds-gallery/vite.config.ts`, `pwa-assets.config.ts`; `__dirname` в ds-gallery заменить на `import.meta.dirname` (Node 24). `typeRoots` удалить | ≈30 строк |
| T2 | `paths` без `baseUrl` (deprecated в TS 6): `"api/*": ["./src/api/*"]` и т. д. для **всех** 15 директорий `src` (+ `bootstrap`, `i18n`, `public-routes`, `types`); убрать ручной alias-список в `ds-gallery/vite.config.ts:18` | ≈40 строк |
| T3 | `eslint --fix` с `consistent-type-imports` (34 autofix), затем `verbatimModuleSyntax: true` в base (31 ошибка tsc до фикса; остаток после autofix — вручную) | ≈120 строк |
| T4 | `noUncheckedIndexedAccess: true`. Baseline **39 ошибок / 21 файл** (16 prod, 23 test). Фикс: guard/`?.`/`at()` в prod; в тестах — `!` запрещён, используем `expect(x).toBeDefined()` + узкий helper `getOrThrow` в `src/test/` | ≈150 строк |

`exactOptionalPropertyTypes` — не включаем (см. «Что НЕ делаем»).

### Д9. Монорепо (спека 04): как сделать переезд механическим

- Все пути в конфигах считаются от `import.meta.dirname` и одной константы `APP_DIR` (сейчас `'.'`, потом `'apps/app'`); glob'ы строятся как `${APP_DIR}/src/**`. Абсолютных путей и `process.cwd()` нет.
- `config/eslint/*`, `prettier.config.js`, `.editorconfig`, `.prettierignore`, `lint-staged`, `.husky/` переезжают в корень монорепо без правок; `eslint.config.js` в корне импортирует пресеты и задаёт `APP_DIR` для каждого workspace.
- `tsconfig.base.json` переезжает в корень; `apps/app/tsconfig.*.json` меняет только путь в `extends`.
- Алиасы живут только в `paths` tsconfig приложения; ESLint (`aliases.js`) и Vite (`vite-tsconfig-paths`) читают их оттуда.
- Скрипты `verify`/`verify:full` в корне станут прокси на `-w @chipin/app` (+ сборка сайта), как в спеке 04 §1.2; `version:check` (D15) остаётся корневым, версия продукта — в **корневом** `package.json` (решение спеки 04 §1.2; в `apps/app/package.json` поля `version` нет). `scripts/version-*.mjs` находят корень через `resolve(import.meta.dirname, '..')`, а не `process.cwd()` (A-01), поэтому работают и из `apps/app` (cwd Vite/Vercel).

## Миграция 112 warnings и нарушений правил

| Набор | Кол-во | Как | PR |
|---|---|---|---|
| `simple-import-sort/imports`+`exports` | 62 | autofix после T2 и новых групп | 02-C3 |
| `no-multiple-empty-lines` | 27 | правило удаляется, чинит Prettier | 02-C2 |
| async/await | 18 (14 в тестах) | не мигрируется: запрет снят (D24); селектор `eslint.config.js:99-122` удаляется вместе с правилами класса c (C2-04) | 02-C4 |
| `handle*`, `react-refresh`, `React.FC` | 4 / 1 / 9 | правила удаляются (§Д0), код не трогаем | 02-C4 |
| Prettier-формат | 317 файлов | `prettier --write`, механически | 02-C2a–c |
| `consistent-type-imports` | 34 | autofix | 02-C6 |
| floating/misused promises | 35 / 28 (52 в prod) | вручную: `void` у намеренных, `return`/`.catch` у остальных | 02-C7a, 02-C7b |
| `jsx-a11y` (6 правил) | неизвестно (плагин не стоит) | новые правила сразу error; текущие нарушения — `--suppress-rule` в том же PR, фикс по слайсам | 02-C8 + поштучные PR по слайсам |
| boundaries | ~30 | suppressions; фикс — 05-6 (basics → components/store/hooks/api, включая `NavButton`, `BalanceSummaryText`), 04-5a (public-routes); routing → pages нарушением не считается (элемент `app`) | 02-C9 |
| `import-x/no-cycle` | известные циклы `groupsStore`↔`activity-store`, `expenseModalStore`↔selectors (03:50) | suppressions; разрывают 03-10/03-12 и 03-14 (C2-05) | 02-C9 |
| `import-x/no-internal-modules` (allow-list) | 103 вложенных barrel'а | suppressions; записи уходят с 02-D3a–e (C2-05) | 02-C9 |
| type-aware (`no-floating-promises`, `no-misused-promises`, `no-unsafe-*`) | 35 / 28+JSX / 35 | suppressions в 02-C6; фикс 02-C7a/b (C2-05) | 02-C6 |
| default exports | 172 файла, 314 импортов, 14 lazy, 25 `vi.mock` | codemod `scripts/codemods/named-exports.mjs` (ts-morph, временный devDep): `export default X` → `export { X }`, `import X from` → `import { X } from`, lazy → `.then(m => ({ default: m.X }))`. `vi.mock` с `default` — вручную | 02-D2a basics(24), 02-D2b–c components(80), 02-D2d features(24), 02-D2e pages(42)+i18n+main |
| вложенные barrel'ы | 103 + 3 корневых (`basics/index.ts`, `i18n/index.ts`, `public-routes/index.ts`; `store/index.ts` удаляет 03-5 — единственный владелец, C2-28) | codemod `scripts/codemods/inline-barrels.mjs`: импорт через вложенный index → импорт файла; удалить index. `vi.mock('<barrel>')` разбивается вручную на моки файлов | 02-D3a–02-D3e по слоям |
| `export *` / inline re-export в index | 9 | исчезают вместе с 02-D3 | 02-D3 |
| `useConnect` | 17 файлов `useConnect.ts` (47 прод-файлов ссылаются) | удаление — **только спека 03** (в PR миграции своего стора; остатки — 03-18). Эта спека даёт только запрет новых: `CI:check-file-layout` с baseline 17 файлов (02-C12) | 03-* |
| деньги `Number(`/`parseFloat(` | 21 в 5 файлах | после появления `src/shared/money/` (D21); правило и миграция — спека 03 §4.3–4.4 | 03-1, 03-3 |
| `noUncheckedIndexedAccess` | 39 | вручную | 02-C11 |

Порядок `--max-warnings 0`: он включается в 02-C4, когда строки import-sort и `no-multiple-empty-lines` обнулены, а правила класса c и async-селектор выключены. Всё, что добавляется позже (02-C6, C8, C9, 03-1, 05-5), входит сразу как `error` + `--suppress-rule` в том же PR — до `--max-warnings 0` и после него одинаково, поэтому CI красным по построению не бывает (C2-03, C2-05).

## Ньюансы и подводные камни

- **`void` vs текущий текст правил.** 00.Promises.5 запрещает `void`-обёртки, а `no-floating-promises` их требует. Правило переписывается в 02-C7a/b одновременно с включением lint, иначе агенты получат противоречие.
- **Prettier-PR конфликтуют со всеми открытыми PR.** 02-C2a–c мержатся подряд в один день, в окно без открытых feature-PR; после merge авторы делают `npm run format`. SHA попадают в `.git-blame-ignore-revs`. Механический PR без ориентира по размеру: PR = вывод одной команды, ревью = повторить команду и сравнить.
- **Codemod default→named и barrel'ы ломают строковые `vi.mock`** (477 вызовов). Мок barrel'а и мок файла — разные модули. Codemod печатает список затронутых `vi.mock`, их правят вручную в том же PR. Критерий — 1230 тестов зелёные.
- **`no-misused-promises` в JSX.** `checksVoidReturn.attributes: true` (C1-22): `onClick={() => action()}` возвращает промис React'у, и `no-floating-promises` его не видит; правило с подсказкой `void` закрывает этот путь. Существующие места — suppressions 02-C6, фикс 02-C7b.
- **Атрибуты и i18n.** Технические атрибуты (`variant`, `size`, `type`…) не проверяются: селектор Д5 перечисляет только пользовательские (`aria-label`, `placeholder`, `title`, `alt`), иначе агенты начнут писать `{'primary'}`.
- **boundaries + алиасы.** Без `eslint-import-resolver-typescript` плагин не распознаёт `components/...` и молча ничего не проверяет. Критерий приёмки 02-C9 — тестовый файл-нарушитель должен давать ошибку.
- **Type-aware lint и lint-staged.** projectService строит программу целиком; поэтому pre-commit работает в FAST-режиме и только чинит, а полную проверку делает CI (и `verify:full` по команде).
- **`unbound-method` в тестах** (70 срабатываний) — шум от `expect(store.action)`; отключён для `*.test.*`.
- **`sharp` override.** После удаления top-level `sharp` override `@vite-pwa/assets-generator.sharp: 0.35.3` тоже удаляется. Если `icons:generate` после этого падает, override возвращается с комментарием в PR (ASSUMPTION).
- **ai-workflow routing-блок** ссылается на `.ai/context.md`. 02-A1 нельзя мержить, пока ai-workflow не сделает шаг «если существует».

## Расширение в будущем

- Свои ESLint-правила (`eslint-plugin-chipin` в `config/eslint/rules/`), если `no-restricted-syntax` станет нечитаемым (больше 25 селекторов); правило с autofix может вернуть удалённое правило класса c (например, `handle*` → `on*`).
- `knip` в CI для мёртвых экспортов и зависимостей.
- `exactOptionalPropertyTypes` — после D4, когда типы будут сгенерированы.
- Turborepo-кэш для `verify` (после спеки 04).

## Что НЕ делаем

- Не переводим свод правил на русский; на русском только инварианты AGENTS.md.
- Не переносим существующие папки. Новые `src/app/`, `src/entities/`, `src/shared/` создают спеки 03 и 04; boundaries (02-C9) заранее описывает и их, и текущие папки.
- Не включаем `exactOptionalPropertyTypes`, `import-x/no-cycle` в pre-commit, Biome/oxlint.
- Не держим стилевые правила без автофикса, уровень `warn`, блокирующий pre-commit и pre-push (§Д0).
- Не добавляем deploy-workflow и не трогаем Vercel-настройки.
- Не удаляем `prerender:public`, `vercel.config.test.js` и SSG-скрипты — спека 04.
- Не трогаем `vite-plugin-svgr`, `axios`, `yaml` (`yaml` остаётся: `contract-tests/support/openapi.ts:1`).

## Фазы / PR

Каждый PR независимо релизится. Размер — ориентир, не правило: один PR = одна задача, ревью за один проход, ~400 строк диффа; механические 02-C2 и codemod 02-D2/02-D3 — без лимита (строки, порождённые командой, не считаются).

| PR | Содержимое | Зависит от |
|---|---|---|
| **02-A0** (ai-workflow) | routing-блок: `.ai/context.md` и `.ai/decisions.md` читаются «если существуют»; `Canonical root` убрать из публичного блока | — |
| **02-A1** | новый AGENTS.md (Д2); удалить `.ai/context.md`, `.ai/decisions.md`, `docs/engineering/code-review.md`; README команды | 02-A0 |
| **02-A2** | правки глав 00–70 по Д3/Д4 — **только** строки `DEL` и `RW`/`R`, которым lint не нужен. Текст каждого `L:`-правила меняется в том PR 02-C*/03-*/05-*, который включает его lint (A-22); пометок «включается в PR …» в своде нет | 02-A1 |
| **02-A3** | `.gitignore`: `.claude/`, дубли, docs-пути (Д4 P8) (`.env*` уже сделан в 01-1); `.editorconfig`; `.vscode/extensions.json` | — |
| **02-B1** | **единственный владелец** удаления dexie/workbox/sharp и фикса vendor-regex (спеки 03, 04, 05 только ссылаются). Удалить `dexie`, `dexie-react-hooks`, `sharp`, `sharp-ico`, `workbox-core`, `workbox-window`, override; regex `vendor-react` → `/node_modules[\\/](?:react\|react-dom\|react-router\|react-router-dom\|scheduler)[\\/]/`; `vendor-misc` без dexie; `build`/`vercel-build` без генерации иконок, `icons:generate`; удалить `test:run`; THIRD_PARTY_NOTICES | — |
| **02-B2** | заменить `@uidotdev/usehooks`: `useCopyToClipboard` → `helpers/clipboard.ts`, `useNetworkState` → `hooks/useOnlineStatus.ts` (`useSyncExternalStore` + `online/offline`), `useIntersectionObserver` → `hooks/useIntersectionObserver.ts`; удалить закомментированный вызов `pages/GlobalHooks.tsx:19`; обновить 2 мока | — |
| **02-C1** | Prettier + eslint-config-prettier + `format`/`format:check` (ещё не в `verify`) + `prettier.config.js` | — |
| **02-C2a–c** | `prettier --write` по `src/components` / `src/{pages,features}` / остальное; затем `format:check` в `verify`; `.git-blame-ignore-revs` | 02-C1 |
| **02-C3** | T2 (paths без baseUrl, ds-gallery alias) + `config/eslint/aliases.js` + import-sort autofix | 02-C2 |
| **02-C4** | выключить правила класса c (§Д0: `handle*`-селектор, react-refresh и др.) и async-селектор `eslint.config.js:99-122` (C2-04); **`--max-warnings 0`**; удалить мёртвый override authSession; хелперы `restrictedSyntax()`/`restrictedImports()` (единственный владелец; 03-1 и 05-5 только добавляют свои блоки); разбить `eslint.config.js` на `config/eslint/*`; механизм baseline (C2-05): `eslint-suppressions.json`, `baseline:update`, `check-baseline.mjs` + тест, `rule-classes.json` + `check-rule-registry.mjs`, `lint:full`; CI: `base_sha` в `GITHUB_OUTPUT` и шаг `check-baseline` (C1-15) | 02-C3 |
| **02-C5** | T1 (typecheck ds-gallery + конфиги), `tsconfig.base.json` | — |
| **02-C6** | type-aware preset + `consistent-type-imports` autofix + T3 `verbatimModuleSyntax`; `--suppress-rule` для `no-floating-promises`/`no-misused-promises`/`no-unsafe-*` | 02-C4, 02-C5 |
| **02-C7a/b** | `no-floating-promises`/`no-misused-promises`: фикс store/helpers/hooks (a), UI (b); правка 00.Promises.5 и 20.Effects.5 | 02-C6 |
| **02-C8** | 6 правил jsx-a11y + `jsx-no-literals` + селектор атрибутов i18n (Д5) + baseline | 02-C4 |
| **02-C9** | boundaries (с `shared-api`/`shared-lib`) + resolver + `import-x/no-cycle` + `import-x/no-internal-modules` + suppressions (~30 + циклы + barrel'ы) + `generate-layers-doc.mjs` + probe-фикстуры | 02-C4 (`config/eslint/layers.js` появляется при разбиении конфига, A-39) |
| **02-C10** | husky pre-commit + lint-staged (`--fix`, не блокирует) + FAST-режим; удалить pre-push; `fix`, `eslint-fix-staged.mjs`; CI-шаг version-policy; расширение `version-check.mjs`; раздел релиза в release-qa.md | 02-C4 |
| **02-C11** | T4 `noUncheckedIndexedAccess` (39) | 02-C6 |
| **02-C12** | project-правила: `<img>`, `useStore()`/`useShallow`, `check-file-layout.mjs` (глубина `index.ts`, запрет новых `useConnect.ts`, baseline 17). Денежные правила сюда **не входят** — их вводит 03-1 (§4.3 спеки 03) | 02-C4 |
| **02-D2a–e** | default → named (codemod). Выполняется **после** 04-0 (монорепо-перенос), чтобы не конфликтовать с rename. Файлы `src/store/expenseModal*` codemod пропускает (`--exclude`), пока не влит 03-14 (file-lock в `00-overview.md`); слой берётся в работу, только когда в нём нет открытых PR спеки 03 (C2-14) | 02-C4, 04-0 |
| **02-D3a–e** | вложенные barrel'ы (codemod; убирает записи `no-internal-modules` из suppressions); `src/store/expenseModal*` — как в 02-D2, после 03-14 | 02-D2 соответствующего слоя |

## Тесты / критерии приёмки

1. `npm run verify:full` зелёный на `master` после каждого PR; 1230+ тестов проходят.
2. После 02-C4: `npx eslint . --max-warnings 0` даёт exit 0; `grep -c warning` по выводу = 0.
3. После 02-C2: `npx prettier --check .` даёт exit 0.
4. После 02-C5: `tsc -b` проверяет `ds-gallery/gallery.tsx`. Проверка: временная ошибка типа в этом файле валит `npm run typecheck`. То же для `ds-gallery/vite.config.ts` и `pwa-assets.config.ts`.
5. После 02-C9: фикстура `basics/__boundary_probe.ts` с `import 'store/users-store'` даёт `boundaries/dependencies` error (проверяется в PR и удаляется).
6. После 02-C10: PR, меняющий `version` из ветки не-release, получает красный `frontend-ci`. Release-ветка с совпадающей версией — зелёный. Есть unit-тест в `scripts/version-check.test.mjs`.
7. После 02-A1/02-A2: `grep -rn "useConnect\|@codex\|Vite 7\|pre-1.0\|docs/specs/\|JavaScript \`Number\`" AGENTS.md docs/engineering` пуст (кроме таблиц миграции); `wc -l AGENTS.md` ≤ 90; в AGENTS.md ровно 15 инвариантов.
8. После 02-B1: в `dependencies`/`devDependencies` корневого `package.json` нет `dexie`, `sharp-ico`, `workbox-window` (транзитивный `workbox-window` из `vite-plugin-pwa` остаётся, A-25); `npm run build` не вызывает `pwa-assets-generator`; в `dist` нет анонимного чанка с react-router core (он в `vendor-react-*.js`).
9. Baseline (C1-13, C1-15): `eslint-suppressions.json` и `config/tsc-baseline.json` не растут — `scripts/check-baseline.mjs --base "$BASE_SHA"` читает base через `git show $BASE_SHA:<файл>`, `BASE_SHA` приходит из `steps.gate.outputs.base_sha` (Д7); локально по умолчанию `git merge-base HEAD origin/master`. Тест скрипта: новый ключ для правила, которого нет в base `rule-classes.json`, — pass; рост счётчика существующего ключа — fail; пустой `--base` при `CI=true` в PR — fail. Фикстура: второе нарушение в файле с одной записью — `eslint` красный.
10. Pre-commit выходит с 0 даже при оставшейся ошибке lint (gate PR: файл с `no-floating-promises` коммитится, CI красный). QA владельца, не gate (C2-34): замер < 5 с на изменении одного файла (машина владельца, M-серия).
11. **Проверка на агентах** (QA владельца, не gate PR; C2-34). До merge каждого PR 02-C, который включает правила, — две пробные задачи агентом на ветке с новым конфигом: (1) новый компонент с i18n-текстом и обработчиком, (2) правка store-экшена с промисом. Считаем повторные прогоны, вызванные правилами lint/format. Порог: **0 повторов из-за автоисправимых правил (a)**. Повторы из-за (b) записываются в PR с текстом сообщения; если сообщение не сказало агенту, как чинить, его переписывают до merge.
12. В конфиге нет правил уровня `warn` и правил класса c: `scripts/check-rule-registry.mjs` (в `lint`) по `eslint --print-config` для 3 файлов (компонент, store, тест) и `stylelint --print-config` находит каждое включённое правило в `config/eslint/rule-classes.json` с классом a/b; строки `rule-classes.json` совпадают с реестром §Д0 (тест сверяет id).

## Требования к backend

Нет.

## Открытые вопросы

1. ~~Release-ветка~~ — решено (подтверждено владельцем 2026-10-28): один release-Issue на релиз, ветка `chore/issue-<n>-release-vX-Y-Z` через `pr:create`/admission, CI `version-check` по имени ветки (Д7).
2. ~~`Version impact`~~ — решено (подтверждено владельцем 2026-10-28): поле удаляется, бамп выбирает владелец.
3. jsx-a11y baseline неизвестен до установки плагина. Если нарушений больше ~80, 02-C8 делится по слоям (с 6 правилами маловероятно).
4. ~~Запрет `async/await` (инв. 7)~~ — решено (владелец 2026-10-28, D24): запрет снят; стиль свободный, гарды — `no-floating-promises`/`no-misused-promises`.
