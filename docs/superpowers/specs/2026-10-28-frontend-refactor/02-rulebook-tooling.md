# Спека 02 — единый свод правил, tooling, чистка зависимостей

Решения: D9, D11, D12, D13, D15, D16 (зависимости и гигиена сборки). Связанные решения: D21 (модуль `money/`; D10 снят), D3 (TanStack Query), D6 (data router), D4 (zod на границах).
Связанные спеки: **01** (хотфикс: `.gitignore`, CSP — уже там), **03** (D3/D4/D21: `src/shared/money`, Query-слой, удаление `useConnect`, денежные lint-правила), **04** (D6/D7: монорепо — конфиги уезжают в корень, см. §Д9; data router и `src/app/`), **05** (D14: stylelint, styled allowlist, `no-raw-colors`).
Идентификаторы PR — глобальная схема `<спека>-<n>`: `02-A0…02-A3`, `02-B1…02-B2`, `02-C1…02-C12`, `02-D1…02-D3` (см. `00-overview.md`).

Отклонение от DECISIONS: D9 называет полным сводом `docs/codex/rules`; на `master` свод уже лежит в `docs/engineering/rules/` — D9 применяется к нему, новый `docs/codex/` не создаётся. D12 (удаление `useConnect`) исполняет спека 03; здесь — только запрет новых.

**Порядок относительно монорепо-переноса (04-0).** До 04-0: 02-A0…A3, 02-B1, 02-B2, 02-C1…02-C5 (рекомендуемо — чтобы массовое форматирование и `tsconfig.base.json` были до rename). После 04-0: 02-C6…02-C12, 02-D1…02-D3 (codemod'ы — строго после 04-0). 02-A*/02-B*/02-C* написаны через `APP_DIR` (§Д9) и при необходимости могут идти и после 04-0.

## Цель

Агент (Claude/Codex) получает **одно** место с правилами, и каждое правило либо проверяет машина (ESLint/tsc/CI-скрипт), либо входит в короткий список инвариантов, которые проверяет ревьюер. Противоречий между файлами нет. CI падает на любом warning'е, на неотформатированном коде и на рассинхроне версии.

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
   - `--max-warnings 0`. Каждое правило имеет уровень `error` или `off`; известные нарушения перечислены в `config/eslint/baseline.js`, и этот список может только сокращаться;
   - husky: pre-commit — быстрый (lint-staged), pre-push — полный (`verify:full`);
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
3. `## Команды` — 7 строк: `test:task`, `verify`, `verify:full`, `format`, `lint -- --fix`, `typecheck`, `version:check`.
4. `## Процесс` — 4 ссылки: ai-workflow FLOW, org issue-intake contract, `docs/engineering/release-qa.md`, completion canary. Плюс одна строка: «FE Issue не закрывается руками; после merge в `master` он ждёт в `Awaiting release`».
5. `## Ревью` — «Независимый ревьюер проверяет инварианты 1–15 и наличие регрессионных тестов для изменённой логики. Стиль, формат, порядок импортов и всё, что ловит CI, ревьюер не комментирует.» Секция самодостаточна: ревьюер не обязан открывать ссылки.
6. Блок `<!-- ai-workflow:agents-routing:start/end -->` без изменений (им управляет ai-workflow).

Инварианты (дословно, ровно 15):

```markdown
## Инварианты

1. Слои импортируются только вниз: app → pages → features → entities → store → shared (shared/*, components, basics, hooks, helpers, api-типы, constants, i18n, types). Граф и исключения — `docs/engineering/rules/10-architecture.md`; проверяет `boundaries/dependencies`.
2. UI (pages, features, components, basics) не вызывает runtime-API и `axios`; серверные данные приходят через store/query-слой. Проверяет lint.
3. Деньги в коде — `Money { minor: bigint }` (ledger units scale 4); на проводе — JSON-число scale 4 (D21). Провод ↔ домен — только `moneyFromWire`/`moneyToWire` в обёртке API; парсинг, округление, суммы и форматирование — только `src/shared/money/`; `parseFloat`/`Number()` на денежных полях вне него запрещены (lint, спека 03 §4.3). Отображение — только `basics/numbers/amount/Amount.tsx`.
4. Сервер — источник истины для финансов: не патчим балансы/долги локально, не ретраим мутации автоматически, устаревший ответ не перезаписывает более новое состояние.
5. Офлайн: создание/правка/удаление расходов — только через outbox с client UUID; settle-up и платежи офлайн запрещены.
6. Типы: без `any`, `as any`, `@ts-ignore`, неоправданных `as` и `!`; type-only импорты — `import type`. Данные из IndexedDB, outbox и localStorage проверяются zod при чтении.
7. Промисы: цепочки `.then/.catch/.finally`, без `async/await`. Каждый промис возвращается или явно помечается `void`; ошибки не глотаются. Проверяют `no-floating-promises` и `no-misused-promises`.
8. Только именованные экспорты; тип `Props` объявлен в файле компонента; без `React.FC`; не больше одного `index.ts` на слайс, без `export *`.
9. Zustand — только UI-состояние. Одно значение читается селектором, несколько — одним объектным селектором с `useShallow`; `useStore()` без селектора и новые `useConnect` запрещены.
10. Обработчики и колбэк-пропсы называются `on*`, `handle*` запрещён (lint).
11. Весь пользовательский текст, включая `aria-*`, `placeholder`, `title` и тосты, идёт через i18n во все локали. Интерактив — нативные элементы или Radix, у кнопок-иконок есть переводимое имя (lint jsx-a11y).
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
| 00.TS.2 | явный return type у экспортов и actions | `L:@typescript-eslint/explicit-module-boundary-types`, files `src/{store,helpers,api,shared,entities}/**`; упоминание `useConnect` удалить |
| 00.TS.3 | `unknown` для недоверенных данных | R (инв. 6) |
| 00.TS.4 | без `any`/`as any`/ts-ignore/`!` | `L:no-explicit-any`, `ban-ts-comment`, `no-non-null-assertion`, `no-unnecessary-type-assertion` |
| 00.TS.5 | предпочитать `satisfies` | DEL |
| 00.TS.6 | `import type` | `L:consistent-type-imports` + tsc `verbatimModuleSyntax` |
| 00.TS.7 | discriminated unions вместо набора boolean | DEL (вкусовое) |
| 00.TS.8 | закрытые наборы строк — `as const`-объект | DEL |
| 00.TS.9 | `Api*` имена не в UI | RW → «UI импортирует доменные типы». После D4 проверяется `boundaries` (UI не импортирует `api/generated/**`) |
| 00.TS.10 | без indexed-access типов в props | DEL |
| 00.Naming.1 | PascalCase/camelCase/UPPER_SNAKE | `L:@typescript-eslint/naming-convention` (типы PascalCase) |
| 00.Naming.2–3 | kebab-case директорий, PascalCase.tsx | `CI:scripts/check-file-layout.mjs` (новый, ≈60 строк; исключения: `pt-BR`, `pt-PT`, `404-page`) |
| 00.Naming.4 | boolean `is/has/can/should` | DEL (оговорка «when practical» не проверяется) |
| 00.Naming.5 | без boolean-отрицаний | DEL |
| 00.Naming.6 | `on*`, без `handle*` | `L:naming-convention` с расширенными селекторами (Д5) |
| 00.Naming.7–8 | имена по бизнес-смыслу, описательные итераторы | DEL |
| 00.Promises.1 | без async/await | `L:no-restricted-syntax` (error) |
| 00.Promises.2 | async action возвращает `Promise<T>` | `L:explicit-module-boundary-types` + `promise-function-async: off` |
| 00.Promises.3 | плоские цепочки | DEL |
| 00.Promises.4 | не глотать ошибки | `L:no-floating-promises`; семантика — R (инв. 7) |
| 00.Promises.5 | read-actions резолвятся, «без `void`-обёрток» | **RW**: «намеренно не ожидаемый промис помечается `void`» — иначе конфликт с `no-floating-promises` |
| 00.Promises.6–9 | `.finally` для cleanup, `Promise.all`, без `new Promise`, не смешивать стили | DEL (6, 7); `L:no-async-promise-executor` для 8; 9 покрывает запрет await |
| 00.Collections.* (8 пунктов) | один проход, `for...of`, без spread в reduce, `Map` для lookup | RW → сжать до 3 строк. В lint только `L:no-restricted-syntax` «spread аккумулятора в reduce» (селектор `CallExpression[callee.property.name='reduce'] SpreadElement`); остальное DEL |
| 00.Modules.1 | именованные экспорты | `L:import-x/no-default-export` (исключения в Д5) |
| 00.Modules.2 | формат `index.ts` | RW (D11): один barrel на слайс, `export { … } from` разрешён, `export *` запрещён — `L:no-restricted-syntax ExportAllDeclaration` + `CI:check-file-layout` (index.ts глубже слайса запрещён) |
| 00.Modules.3 | граница директории через index | RW → «граница слайса через его index»; `L:import-x/no-internal-modules` в форме allow-list (Д5) |
| 00.Modules.4 | ранние return | DEL |
| 00.Modules.5 | без вложенных тернарников | `L:no-nested-ternary` |
| 00.Modules.6–8 | абстракции, размер функций, комментарии на английском | DEL |
| 00.Modules.9 | TODO при отложенном фиксе | DEL |
| 00.Modules.пример | `import AddExpenseModal from` | RW → named-пример (конфликт R2) |
| 00.Touched | правило тронутого кода | RW → одна строка в 70 §Legacy |
| 10.Direction.* | граф слоёв, helpers без store | `L:boundaries/dependencies` (Д5); исключение `features/routing` — в baseline до переезда в `src/app/router` (04-2a) |
| 10.Ownership.1–2 | локальный стейт; Zustand только для shared | RW (D3): «Zustand — только UI-состояние, серверное — TanStack Query» |
| 10.Ownership.3 | runtime API не из UI | `L:no-restricted-imports` (уже есть) |
| 10.Ownership.4–6 | DTO на границе, side effects, контракты | R (инв. 2, 4) |
| 10.Placement.* (5) | узкий слой, без лишних сервисов, не двигать папки | DEL, кроме «узкий слой» → R |
| 10.Recursive.* | рекурсивная структура `components/ internal/ styled.ts types.ts` | RW (D11): `internal/` и `components/` без своих index.ts; `types.ts` только для типов с ≥2 потребителями; `styled.ts` остаётся до D14 |
| 10.DirNaming.* | kebab-case, без compat-файлов родителя | `CI:check-file-layout` |
| 10.Ownership(dir).* | Props в `types.ts`, `internal/useConnect.ts` | **RW** (конфликты R3, R4): Props в файле компонента; `useConnect` удалить |
| 10.Index.* (9) | index в каждой директории, deep-импорты запрещены | RW (D11): только `src/<layer>/<slice>/index.ts`; внутри слайса — относительные импорты файлов; снаружи — только index слайса или файл в корне слоя |
| 10.InternalExports | хелперы именованно, `import * as helpers` запрещён | `L:no-restricted-syntax ImportNamespaceSpecifier` (кроме `api/*`, `constants`, `selectors`) |
| 10.Tests.* | co-location, без `__tests__` | `CI:check-file-layout` |
| 10.Adoption | правила для нового/тронутого кода | RW → 70 §Legacy |
| 10.StoreLayout.* | `<domain>-store/{actions,types,…}` | RW (D3): действует для UI-сторов. Серверные сторы удаляются миграцией TanStack, отдельный layout для них не вводим |
| 10.CrossStore.* | без записи в чужой store, оркестратор | R (инв. 4); после D3 правило отпадает |
| 10.ChangeScope | не менять поведение попутно | DEL (общий принцип ai-workflow) |
| 20.Components.1 | чистый render | `L:react-hooks` (compiler rules, уже есть) |
| 20.Components.2 | без `React.FC` | `L:no-restricted-syntax` по `TSTypeReference[typeName.right.name='FC']` и `TSTypeReference[typeName.name='FC']` |
| 20.Components.3 | один компонент на файл | `L:react/no-multi-comp` (ignoreStateless: false) |
| 20.Components.4 | Props в файле компонента | **R1-конфликт → оставить** (D11); `CI:check-file-layout`: `types.ts` в директории компонента не экспортирует `*Props` |
| 20.Components.5 | named exports | `L:import-x/no-default-export` |
| 20.Components.6 | без компонентов внутри render | `L:react/no-unstable-nested-components` |
| 20.Components.7–8 | минимальные props, boolean по умолчанию false | `L:react/jsx-boolean-value` (never) для части 8; остальное DEL |
| 20.Components.9 | `on*` | `L:naming-convention` |
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
| 30.Responsive.1–5 | responsive props Radix | DEL, кроме п.6 |
| 30.Responsive.6 | без хардкода `767px` в media | `L:no-restricted-syntax` по `TemplateElement[value.raw=/@media[^{]*\d+px/]` |
| 30.Colors.1–4 | `themeColor()`, без hex | RW по D14 (`var(--cp-*)`); lint — `no-raw-colors` (hex/rgb/hsl и `var(--<palette>-N)` в TS) и stylelint для CSS вводит **спека 05 (05-5)**; здесь только ссылка |
| 30.Colors.5 | transient `$prop` | DEL |
| 30.ClassName.* | без className/style | `style` с обычными свойствами запрещён, кастомные свойства (`--x`) разрешены — селектор из спеки 05 §3 (05-5); className — DEL (CSS Modules по D14 его требуют) |
| 30.A11y.1–6 | семантика, имена, label, dialog title | `L:jsx-a11y/recommended` + R (инв. 11) |
| 30.Images.* | `basics/Image` вместо `<img>` | `L:no-restricted-syntax JSXOpeningElement[name.name='img']` вне `basics/Image.tsx`; `styled.img` — тот же селектор по `MemberExpression` |
| 30.i18n.1 | весь текст через i18n | `L:react/jsx-no-literals` с `ignoreProps:false` + allowlist атрибутов (Д5) |
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
| 60.Helpers.* (6) | чистые хелперы | `L:boundaries` (helpers без store/api) + R |
| 60.Storage.1 | localStorage только через helper | `L:no-restricted-globals` (+ `sessionStorage`) |
| 60.Storage.2–8 | схема ключей, guard, try/catch | RW (D4): zod-схема на чтение; `localStorage.clear()` — `L:no-restricted-syntax` |
| 70.Stack, When, Shape, Priority | стек тестов | оставить; `L:no-restricted-syntax` для `toMatchSnapshot`; async/await в тестах — тот же запрет |
| 70.Commands | команды | RW: актуальный список скриптов (Д7) |
| 70.Integration (12 пунктов) | lifecycle, version:bump, `@codex review` | **DEL целиком** (дубль ai-workflow; P1–P4) |
| 70.Legacy.* (4) | baseline, «warn → error после нуля» | RW: «уровни только error/off, baseline в `eslint.baseline.js` только сокращается» |

### Д4. Как разрешаются конфликты из матрицы аудита (03-tooling-rules.md §5)

| Конфликт | Решение |
|---|---|
| R1 money: Number vs запрет `Number()` | D21 (D10 снят): домен — `Money { minor: bigint }` scale 4, провод навсегда JSON-число scale 4 (backend — источник истины), конверсия только на границе API, арифметика в `bigint` ledger units. 60.Money.1–2 удаляются. Набор lint-селекторов и ignores (`src/shared/money/**`, `src/shared/lib/formatNumber.ts`, тесты) — **единственный, в спеке 03 §4.3** (вводит 03-1 в `warn`, 03-3 → `error`); эта спека его не дублирует. Немонетарные исключения — `// eslint-disable-next-line no-restricted-syntax -- not money: <причина>`; `eslint-comments/require-description` требует причину |
| R2 exports: «prefer named» vs примеры с default | D11. Только named; все примеры в 00 и 10 переписаны. Lint `import-x/no-default-export` |
| R3 Props: файл компонента vs `./types` | D11. В файле компонента, прямо над компонентом. Примеры 00:139 и 10:96,137 переписаны. `types.ts` — только для типов с ≥2 потребителями |
| R4 store reads: `useShallow` vs `useConnect` vs отдельные селекторы | D12. Один объектный селектор с `useShallow`; пример 40:54-55 переписан; раздел 20 «Component Store Connections» удалён |
| P2/P3/D15 версия: кто бампит, «pre-1.0» | Задачи не бампят. Release-PR `chore/issue-<n>-release-v<x.y.z>` запускает `npm run version:bump -- <patch\|minor\|major>`; делает его Trusted Publisher или владелец, Executor — никогда. CI правило в Д7. Фразы «Version impact в каждом task prompt» и «major rejected pre-1.0» удаляются |
| P7 KB отсутствует: fallback vs обязательный clone | Одно правило (инв. 15): (1) `../chipin-knowledge-base`, если есть; (2) иначе `git clone` туда, если есть git и сеть; (3) иначе чтение через аутентифицированный GitHub; (4) иначе BLOCKED. Копии KB в репо запрещены |
| P8 планы/спеки: `docs/specs/` не существует, `.gitignore` игнорирует tracked-файлы | Утверждённые design-спеки коммитятся в `docs/superpowers/specs/<YYYY-MM-DD>-<slug>.md`. Планы не коммитятся (`docs/superpowers/plans/` остаётся в ignore). Implementation-инварианты — в соответствующую главу `docs/engineering/rules/`. `.gitignore`: удалить `docs/superpowers/*`, `/docs/superpowers/specs/`, `/docs/engineering/plans/`, `/docs/engineering/specs/`; оставить `/docs/superpowers/plans/` и `/.superpowers/` |
| P4 `@codex review` | На master уже удалено; проверить grep'ом в 02-A2 |
| P10 «формат проверяет CI» | Становится правдой после 02-C1…02-C3 (Prettier + `format:check` в `verify`) |
| P11/P12/P13 Vite 7, Trello, локальный `Canonical root` | Vite 8 в шапке; Trello — одна строка в ai-workflow, из AGENTS.md удалить; путь `Canonical root` сидит внутри routing-блока ai-workflow → issue в ai-workflow |
| T2/T3 что делает verify:full / vercel-build | Описание из Д7 — единственное, в 70 §Commands и README |

### Д5. ESLint: целевой инвентарь

Структура (готовность к монорепо, Д9):

```
eslint.config.js          // 15 строк: собирает пресеты, задаёт APP_DIR = '.'
config/eslint/aliases.js  // читает paths из tsconfig.app.json через typescript API — единственный список алиасов
config/eslint/base.js     // js + tseslint recommendedTypeChecked, prettier, import-x, unused-imports, sort
config/eslint/react.js    // react, react-hooks, jsx-a11y, i18n
config/eslint/layers.js   // boundaries + no-restricted-imports
config/eslint/project.js  // ChipIn-правила: деньги, async, FC, img, storage
config/eslint/baseline.js // список известных нарушений: { files: [...], rules: { rule: 'off' } }, только сокращается
```

Новые devDependencies (версии на 2026-10-28, ставить через `^`):
- `eslint-plugin-jsx-a11y@6.10.2`, `eslint-plugin-import-x@4.17.1`, `eslint-import-resolver-typescript@4.4.5`, `eslint-plugin-boundaries@7.4.0`;
- `@eslint-community/eslint-plugin-eslint-comments` (последняя);
- `prettier@3.9.10`, `eslint-config-prettier@10.1.8`, `lint-staged@17.6.0`.

Правила (все `error`, если не сказано иначе):

| Группа | Правило / настройка |
|---|---|
| ignores | `dist`, `dev-dist`, `coverage`, `node_modules/.cache`, `.claude/**`, `public/**`, `ds-gallery/standalone.html` |
| языки | `src/**` и `ds-gallery/**` — browser globals; `scripts/**`, `*.config.*`, `contract-tests/**`, `ds-gallery/build-html.mjs` — node globals |
| type-aware | `tseslint.configs.recommendedTypeChecked` + `parserOptions.projectService: true`, `tsconfigRootDir: import.meta.dirname`; для `**/*.{js,mjs}` — `disableTypeChecked` |
| promises | `no-floating-promises` (`ignoreVoid: true`), `no-misused-promises` (`checksVoidReturn: { attributes: false }` — допускает `onClick={() => promise}` в JSX, и это осознанно), `promise-function-async: off`, `require-await: off` (await запрещён) |
| tests override | `**/*.test.{ts,tsx}`: `unbound-method: off`, `no-unsafe-assignment: off`, `no-unsafe-member-access: off` (vi.fn/expect-паттерны) |
| типы | `consistent-type-imports` (`fixStyle: 'inline-type-imports'`), `no-import-type-side-effects`, `no-unnecessary-type-assertion`, `no-non-null-assertion`, `explicit-module-boundary-types` (только `src/{store,helpers,api,shared,entities}/**`) |
| unused | `@typescript-eslint/no-unused-vars: off` (убирает двойной репорт, 03:46), `unused-imports/no-unused-imports`, `unused-imports/no-unused-vars` (error, `^_`) |
| prettier | `eslint-config-prettier` последним; `no-multiple-empty-lines` и `curly` — `curly: all` оставить (prettier его не трогает) |
| import-sort | `simple-import-sort/imports` и `/exports`. Группы: `['^node:']`, `['^react$','^react-dom$','^@?\\w']`, затем **одна группа, собранная из всех алиасов tsconfig** в порядке слоёв: `^(app\|bootstrap\|pages\|features\|entities\|store\|api\|shared\|hooks\|helpers\|constants\|i18n\|types\|public-routes)(/\|$)`, `^(components\|basics)(/\|$)`, `^(assets\|styles)(/\|$)`, `['^\\.\\.']`, `['^\\.']`, `['\\.s?css$']`. Регулярки строятся в `aliases.js` из `paths` — ручного списка нет |
| import-x | `import-x/no-default-export`; `import-x/no-cycle` (`maxDepth: 3`, только в CI через `CHIPIN_ESLINT_FULL=1` — дорого); `import-x/no-useless-path-segments`; `import-x/no-self-import` |
| исключения default export | `*.config.{js,ts,mjs}`, `eslint.config.js`, `vite.config.ts`, `vitest*.config.ts`, `ds-gallery/vite.config.ts`, `pwa-assets.config.ts`, `**/*.d.ts`. Route-модулям исключение не нужно: D6 `lazy` ждёт named `Component`. До D6 — `React.lazy(() => import('pages/X').then((m) => ({ default: m.X })))` |
| react | `react.configs.flat.recommended` + `jsx-runtime`; `react/no-multi-comp`, `react/no-unstable-nested-components`, `react/jsx-boolean-value: never`, `react/prop-types: off` |
| react-hooks | `recommended` (v7); `exhaustive-deps: error` |
| a11y | `jsx-a11y.flatConfigs.recommended`; `jsx-a11y/no-autofocus: off` (модалки) |
| i18n | `react/jsx-no-literals`: `noStrings: true`, `ignoreProps: false`, `allowedStrings: [' ','-','+','/','~','·']`, `noAttributeStrings: true` при разрешённых технических атрибутах через `elementOverrides` (`data-testid`, `type`, `role`, `variant`, `size`, `color`, `as`, `href`, `to`, `rel`, `target`, `autoComplete`, `inputMode`). Проверить на версии плагина; если `elementOverrides` не покрывает атрибуты, i18n для `aria-label`/`placeholder`/`title` ловит `no-restricted-syntax` на `JSXAttribute[name.name=/^(aria-label\|placeholder\|title\|alt)$/] > Literal[value=/\\w/]` |
| naming | `@typescript-eslint/naming-convention`: `{ selector: ['variable','function','parameter','classProperty','objectLiteralProperty','typeProperty','method'], format: null, custom: { regex: '^handle[A-Z0-9_]', match: false } }` + `{ selector: 'typeLike', format: ['PascalCase'] }` |
| project | `no-restricted-syntax`: AwaitExpression, `ForOfStatement[await=true]`, async-функции (как сейчас), `React.FC`/`FC`, `ExportAllDeclaration`, `<img>`, `localStorage.clear`, `CancelToken`, `toMatchSnapshot`, объектный литерал в `use*Store(...)` без `useShallow`, `use*Store()` без аргумента, `no-nested-ternary`. Денежные селекторы — спека 03 §4.3, цветовые — спека 05 (05-5); все блоки `no-restricted-syntax`/`no-restricted-imports` собираются хелперами `restrictedSyntax()`/`restrictedImports()` из `config/eslint/project.js` (вводит 02-C4), потому что в flat config более поздний блок заменяет опции правила целиком |
| globals | `no-restricted-globals`: `localStorage`, `sessionStorage` (кроме `helpers/localStorage.ts`) |
| imports | `no-restricted-imports`: `axios` (кроме `src/api/chipin.{instance,interceptors}.ts`, после 03-4 — `src/shared/api/http.ts`), runtime `api/` из UI (как сейчас, `allowTypeImports`), UI-библиотеки (30.Radix.4). Мёртвый override `authSession` (03:58) удалить |
| eslint-comments | `require-description`, `no-unused-disable`, `disable-enable-pair` |

Граф слоёв (`config/eslint/layers.js`, `boundaries/elements` описывают **текущие** папки, код не двигается):

| element type | pattern (от `src/`) |
|---|---|
| `app` | `main.tsx`, `root.tsx`, `app/**` (создают 03-5 и 04-2a), `bootstrap/**`, `features/routing/**`, `pages/GlobalHooks.tsx`, `public-routes/**` (до удаления спекой 04) |
| `pages` | `pages/*` |
| `features` | `features/*` |
| `entities` | `entities/**` (создаёт спека 03: queries, мапперы, доменные модели) |
| `store` | `store/**` (оставшиеся UI-сторы, спека 03 §6) |
| `components` | `components/**` |
| `basics` | `basics/**` |
| `hooks` | `hooks/**` |
| `helpers` | `helpers/**` |
| `shared` | `shared/**` (создаёт спека 03: `shared/money`, `shared/api`, `shared/offline`, `shared/lib`) |
| `api` | `api/**` |
| `base` | `constants/**`, `types/**`, `i18n/**`, `styles/**`, `assets/**` |

Политика `boundaries/dependencies` — `default: 'disallow'`; разрешено (слева «откуда», справа «куда»):

| from | allow to |
|---|---|
| app | всё |
| pages | features, entities, store, components, basics, hooks, helpers, shared, api, base |
| features | features (только чужой `index.ts`), entities, store, components, basics, hooks, helpers, shared, api, base |
| entities | entities (только чужой `index.ts`), store, helpers, shared, api, base |
| store | store, entities, shared, api, helpers, base |
| components | components, basics, hooks, entities, store, helpers, shared, api, base |
| hooks | hooks, entities, store, helpers, shared, api, base |
| basics | basics, helpers, shared, base |
| helpers | helpers, shared, api, base |
| shared | shared, api, base |
| api | api, base |
| base | base |

`api` в UI-слоях разрешён только через типы. Это обеспечивает существующий `no-restricted-imports` с `allowTypeImports`, а не boundaries. Резолвер — `eslint-import-resolver-typescript` с `project: tsconfig.app.json`. Известные ~30 нарушений (01-architecture.md:49-56: routing→pages 14 — они уходят в `app`; basics→components/store/hooks 4; helpers→store; components↔public-routes) получают поштучные записи в `baseline.js`.

Быстрый режим: `eslint.config.js` читает `process.env.CHIPIN_ESLINT_FAST === '1'`. В этом режиме отключаются type-aware правила и `import-x/no-cycle` — для pre-commit. CI и pre-push всегда работают в полном режиме.

### Д6. Prettier, editorconfig, VSCode

- `prettier.config.js` (ESM, заменяет `.prettierrc.cjs`): `{ printWidth: 100, tabWidth: 4, useTabs: false, semi: true, singleQuote: true, jsxSingleQuote: false, trailingComma: 'all', arrowParens: 'avoid', bracketSpacing: true, bracketSameLine: false, endOfLine: 'lf', overrides: [{ files: ['*.json','*.yml','*.yaml'], options: { tabWidth: 2 } }] }`. Значения текущего конфига сохраняются (`arrowParens: 'avoid'` даёт меньший diff, 317 файлов против 387 при `always`); `jsxBracketSameLine` заменён на `bracketSameLine`.
- `.prettierignore`: `dist`, `dev-dist`, `coverage`, `node_modules`, `package-lock.json`, `public`, `LICENSE`, `THIRD_PARTY_NOTICES.txt`, `ds-gallery/standalone.html`, `src/i18n/locales/**` (переформатирование JSON локалей не нужно), `docs/superpowers/**`.
- `.editorconfig`: `root=true`; `[*] indent_style=space, indent_size=4, end_of_line=lf, charset=utf-8, insert_final_newline=true, trim_trailing_whitespace=true`; `[*.{json,yml,yaml}] indent_size=2`; `[*.md] trim_trailing_whitespace=false`.
- `.vscode/extensions.json`: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`; `.vscode/settings.json` в git не кладём.
- `.git-blame-ignore-revs` — SHA форматирующих PR.

### Д7. Скрипты, hooks, CI

`package.json` scripts (итог):

```json
"build": "tsc -b && vite build && npm run verify:public-precache",
"vercel-build": "vite build && npm run verify:public-precache",
"lint": "eslint . --max-warnings 0 --cache --cache-location node_modules/.cache/eslint/",
"format": "prettier --write .",
"format:check": "prettier --check .",
"typecheck": "tsc -b",
"verify": "npm run version:check && npm run format:check && npm run lint && npm run typecheck",
"verify:full": "npm run verify && npm run test:full && npm run build && npm run build:ds-gallery",
"build:ds-gallery": "vite build --config ds-gallery/vite.config.ts && node ds-gallery/build-html.mjs",
"icons:generate": "pwa-assets-generator",
"version:check": "node scripts/version-check.mjs"
```

Удаляются `test:run` (дубль `test:full`) и `create-pwa-icons` (переименован в `icons:generate`). `test` (watch) остаётся. `prerender:public` не трогаем — его удаляет спека 04.

`lint-staged` (в package.json):

```json
"lint-staged": {
  "*.{ts,tsx,js,mjs}": ["prettier --write", "eslint --fix --max-warnings 0"],
  "*.{json,md,css,yml,yaml,html}": ["prettier --write"]
}
```

- `.husky/pre-commit`: `CHIPIN_ESLINT_FAST=1 npx lint-staged` — цель меньше 5 с.
- `.husky/pre-push`: `npm run verify:full` (как сейчас; `version:check` уже внутри `verify`).

CI (`frontend-ci.yml`, шаг `Verify frontend`): `npm run verify:full` с `CHIPIN_ESLINT_FULL=1` — это даёт format, version, `--max-warnings 0`, typecheck. Новый шаг перед ним — только для `pull_request`:

```
node scripts/version-check.mjs --base "$BASE_SHA" --head-branch "$GITHUB_HEAD_REF"
```

Правило проверки: если `version` в `package.json` отличается от base, ветка должна совпадать с `^chore/issue-\d+-release-v(\d+)-(\d+)-(\d+)$`, а новая версия — равняться версии из имени ветки и быть больше base. Иначе exit 1 с текстом «version changes only in a release PR». Решено (подтверждено владельцем 2026-10-28): на каждый релиз — ровно один release-Issue, ветка `chore/issue-<n>-release-vX-Y-Z` проходит обычный `pr:create`/admission; поле `Version impact` из шаблона Issue удаляется, бамп выбирает владелец. Расширение `version-check.mjs` — около 40 строк + тест. Dependabot-PR покрыты: они версию не меняют.

`ci-gate-policy.mjs` не меняется (`AGENTS.md` и конфиги и так дают mode `full`).

Deploy (D15): workflow'ов нет и новых не будет; источник — `DEPLOYMENT.md` §«Vercel delivery from master». Порядок релиза записывается в `docs/engineering/release-qa.md` одним разделом:
1. release-PR с бампом;
2. merge в `master`;
3. Preview;
4. «Prepare frontend release QA»;
5. Promote.

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
- Скрипты `verify`/`verify:full` в корне станут прокси на `-w @chipin/app` (+ сборка сайта), как в спеке 04 §1.2; `version:check` (D15) остаётся корневым, версия продукта — в **корневом** `package.json` (решение спеки 04 §1.2; в `apps/app/package.json` поля `version` нет).

## Миграция 112 warnings и нарушений правил

| Набор | Кол-во | Как | PR |
|---|---|---|---|
| `simple-import-sort/imports`+`exports` | 62 | autofix после T2 и новых групп | 02-C3 |
| `no-multiple-empty-lines` | 27 | правило удаляется, чинит Prettier | 02-C2 |
| async/await | 18 (14 в тестах) | вручную, по образцу 70.Shape | 02-C4 |
| `handle*` | 4 (warn) / 8 (grep) | вручную (rename через IDE/ts-morph), селектор расширяется | 02-C4 |
| `react-refresh/only-export-components` | 1 | вручную | 02-C4 |
| Prettier-формат | 317 файлов | `prettier --write`, механически | 02-C2a–c |
| `consistent-type-imports` | 34 | autofix | 02-C6 |
| floating/misused promises | 35 / 28 (52 в prod) | вручную: `void` у намеренных, `return`/`.catch` у остальных | 02-C7a, 02-C7b |
| `jsx-a11y` | неизвестно (плагин не стоит) | новые правила сразу error; все текущие нарушения — в `baseline.js`, фикс по слайсам | 02-C8 + поштучные PR по слайсам |
| boundaries | ~30 | baseline; фикс — 04-2a (routing → `src/app/router`), 05-6 (basics → components/store), 04-5 (public-routes) | 02-C9 |
| `React.FC` | 9 | вручную | 02-D1 |
| default exports | 172 файла, 314 импортов, 14 lazy, 25 `vi.mock` | codemod `scripts/codemods/named-exports.mjs` (ts-morph, временный devDep): `export default X` → `export { X }`, `import X from` → `import { X } from`, lazy → `.then(m => ({ default: m.X }))`. `vi.mock` с `default` — вручную | 02-D2a basics(24), 02-D2b–c components(80), 02-D2d features(24), 02-D2e pages(42)+i18n+main |
| вложенные barrel'ы | 103 + 4 корневых (`basics/index.ts`, `store/index.ts`, `i18n/index.ts`, `public-routes/index.ts`) | codemod `scripts/codemods/inline-barrels.mjs`: импорт через вложенный index → импорт файла; удалить index. `vi.mock('<barrel>')` разбивается вручную на моки файлов | 02-D3a–02-D3e по слоям |
| `export *` / inline re-export в index | 9 | исчезают вместе с 02-D3 | 02-D3 |
| `useConnect` | 17 файлов `useConnect.ts` (47 прод-файлов ссылаются) | удаление — **только спека 03** (в PR миграции своего стора; остатки — 03-18). Эта спека даёт только запрет новых: `CI:check-file-layout` с baseline 17 файлов (02-C12) | 03-* |
| деньги `Number(`/`parseFloat(` | 21 в 5 файлах | после появления `src/shared/money/` (D21); правило и миграция — спека 03 §4.3–4.4 | 03-1, 03-3 |
| `noUncheckedIndexedAccess` | 39 | вручную | 02-C11 |

Порядок `--max-warnings 0`: он включается в 02-C4, когда первые пять строк таблицы обнулены. Всё, что добавляется позже, входит сразу как `error` + baseline.

## Ньюансы и подводные камни

- **`void` vs текущий текст правил.** 00.Promises.5 запрещает `void`-обёртки, а `no-floating-promises` их требует. Правило переписывается в 02-C7 одновременно с включением lint, иначе агенты получат противоречие.
- **Prettier-PR конфликтуют со всеми открытыми PR.** 02-C2a–c мержатся подряд в один день, в окно без открытых feature-PR; после merge авторы делают `npm run format`. SHA попадают в `.git-blame-ignore-revs`. Это исключение из лимита «≤400 строк»: PR = вывод одной команды, ревью = повторить команду и сравнить.
- **Codemod default→named и barrel'ы ломают строковые `vi.mock`** (477 вызовов). Мок barrel'а и мок файла — разные модули. Codemod печатает список затронутых `vi.mock`, их правят вручную в том же PR. Критерий — 1230 тестов зелёные.
- **`no-misused-promises` в JSX.** `checksVoidReturn.attributes: false` осознанно: `onClick={() => action()}` с отклоняемым промисом ловит уже `no-floating-promises`, если колбэк — блок.
- **jsx-no-literals `ignoreProps:false`** даст много срабатываний на технических атрибутах. Allowlist атрибутов обязателен, иначе агенты начнут писать `{'primary'}`.
- **boundaries + алиасы.** Без `eslint-import-resolver-typescript` плагин не распознаёт `components/...` и молча ничего не проверяет. Критерий приёмки 02-C9 — тестовый файл-нарушитель должен давать ошибку.
- **Type-aware lint и lint-staged.** projectService строит программу целиком; поэтому pre-commit работает в FAST-режиме, а полную проверку делают pre-push и CI.
- **`unbound-method` в тестах** (70 срабатываний) — шум от `expect(store.action)`; отключён для `*.test.*`.
- **`sharp` override.** После удаления top-level `sharp` override `@vite-pwa/assets-generator.sharp: 0.35.3` тоже удаляется. Если `icons:generate` после этого падает, override возвращается с комментарием в PR (ASSUMPTION).
- **ai-workflow routing-блок** ссылается на `.ai/context.md`. 02-A1 нельзя мержить, пока ai-workflow не сделает шаг «если существует».

## Расширение в будущем

- Свои ESLint-правила (`eslint-plugin-chipin` в `config/eslint/rules/`), если `no-restricted-syntax` станет нечитаемым (больше 25 селекторов).
- `knip` в CI для мёртвых экспортов и зависимостей.
- `exactOptionalPropertyTypes` — после D4, когда типы будут сгенерированы.
- Turborepo-кэш для `verify` (после спеки 04).

## Что НЕ делаем

- Не переводим свод правил на русский; на русском только инварианты AGENTS.md.
- Не переносим существующие папки. Новые `src/app/`, `src/entities/`, `src/shared/` создают спеки 03 и 04; boundaries (02-C9) заранее описывает и их, и текущие папки.
- Не включаем `exactOptionalPropertyTypes`, `import-x/no-cycle` в pre-commit, Biome/oxlint.
- Не добавляем deploy-workflow и не трогаем Vercel-настройки.
- Не удаляем `prerender:public`, `vercel.config.test.js` и SSG-скрипты — спека 04.
- Не трогаем `vite-plugin-svgr`, `axios`, `yaml` (`yaml` остаётся: `contract-tests/support/openapi.ts:1`).

## Фазы / PR

Каждый PR независимо релизится и даёт ≤ ~400 строк диффа (исключения — механические 02-C2 и codemod 02-D2/02-D3, где 400 считается без строк, порождённых командой).

| PR | Содержимое | Зависит от |
|---|---|---|
| **02-A0** (ai-workflow) | routing-блок: `.ai/context.md` и `.ai/decisions.md` читаются «если существуют»; `Canonical root` убрать из публичного блока | — |
| **02-A1** | новый AGENTS.md (Д2); удалить `.ai/context.md`, `.ai/decisions.md`, `docs/engineering/code-review.md`; README команды | 02-A0 |
| **02-A2** | правки глав 00–70 по Д3/Д4 (только текст; lint-ссылки пишутся с пометкой «включается в PR 02-Cx») | 02-A1 |
| **02-A3** | `.gitignore`: `.claude/`, дубли, docs-пути (Д4 P8) (`.env*` уже сделан в 01-1); `.editorconfig`; `.vscode/extensions.json` | — |
| **02-B1** | **единственный владелец** удаления dexie/workbox/sharp и фикса vendor-regex (спеки 03, 04, 05 только ссылаются). Удалить `dexie`, `dexie-react-hooks`, `sharp`, `sharp-ico`, `workbox-core`, `workbox-window`, override; regex `vendor-react` → `/node_modules[\\/](?:react\|react-dom\|react-router\|react-router-dom\|scheduler)[\\/]/`; `vendor-misc` без dexie; `build`/`vercel-build` без генерации иконок, `icons:generate`; удалить `test:run`; THIRD_PARTY_NOTICES | — |
| **02-B2** | заменить `@uidotdev/usehooks`: `useCopyToClipboard` → `helpers/clipboard.ts`, `useNetworkState` → `hooks/useOnlineStatus.ts` (`useSyncExternalStore` + `online/offline`), `useIntersectionObserver` → `hooks/useIntersectionObserver.ts`; удалить закомментированный вызов `pages/GlobalHooks.tsx:19`; обновить 2 мока | — |
| **02-C1** | Prettier + eslint-config-prettier + `format`/`format:check` (ещё не в `verify`) + `prettier.config.js` | — |
| **02-C2a–c** | `prettier --write` по `src/components` / `src/{pages,features}` / остальное; затем `format:check` в `verify`; `.git-blame-ignore-revs` | 02-C1 |
| **02-C3** | T2 (paths без baseUrl, ds-gallery alias) + `config/eslint/aliases.js` + import-sort autofix | 02-C2 |
| **02-C4** | async/await 18, `handle*` 8, react-refresh 1, расширенный naming-селектор; **`--max-warnings 0`**; удалить мёртвый override authSession; хелперы `restrictedSyntax()`/`restrictedImports()`; разбить `eslint.config.js` на `config/eslint/*` | 02-C3 |
| **02-C5** | T1 (typecheck ds-gallery + конфиги), `tsconfig.base.json` | — |
| **02-C6** | type-aware preset + `consistent-type-imports` autofix + T3 `verbatimModuleSyntax` | 02-C4, 02-C5 |
| **02-C7a/b** | `no-floating-promises`/`no-misused-promises`: фикс store/helpers/hooks (a), UI (b); правка 00.Promises.5 и 20.Effects.5 | 02-C6 |
| **02-C8** | jsx-a11y + `jsx-no-literals ignoreProps:false` + baseline | 02-C4 |
| **02-C9** | boundaries + resolver + baseline (~30) | 02-C3 |
| **02-C10** | husky pre-commit + lint-staged + FAST-режим; CI-шаг version-policy; расширение `version-check.mjs`; раздел релиза в release-qa.md | 02-C4 |
| **02-C11** | T4 `noUncheckedIndexedAccess` (39) | 02-C6 |
| **02-C12** | project-правила: `<img>`, `React.FC`, `useStore()`/`useShallow`, `check-file-layout.mjs` с baseline (в т.ч. запрет новых `useConnect.ts`). Денежные правила сюда **не входят** — их вводит 03-1 (§4.3 спеки 03) | 02-C4 |
| **02-D1** | `React.FC` ×9 | 02-C12 |
| **02-D2a–e** | default → named (codemod). Выполняется **после** 04-0 (монорепо-перенос), чтобы не конфликтовать с rename | 02-C4, 04-0 |
| **02-D3a–e** | вложенные barrel'ы (codemod) | 02-D2 соответствующего слоя |

## Тесты / критерии приёмки

1. `npm run verify:full` зелёный на `master` после каждого PR; 1230+ тестов проходят.
2. После 02-C4: `npx eslint . --max-warnings 0` даёт exit 0; `grep -c warning` по выводу = 0.
3. После 02-C2: `npx prettier --check .` даёт exit 0.
4. После 02-C5: `tsc -b` проверяет `ds-gallery/gallery.tsx`. Проверка: временная ошибка типа в этом файле валит `npm run typecheck`. То же для `ds-gallery/vite.config.ts` и `pwa-assets.config.ts`.
5. После 02-C9: фикстура `basics/__boundary_probe.ts` с `import 'store/users-store'` даёт `boundaries/dependencies` error (проверяется в PR и удаляется).
6. После 02-C10: PR, меняющий `version` из ветки не-release, получает красный `frontend-ci`. Release-ветка с совпадающей версией — зелёный. Есть unit-тест в `scripts/version-check.test.mjs`.
7. После 02-A1/02-A2: `grep -rn "useConnect\|@codex\|Vite 7\|pre-1.0\|docs/specs/\|JavaScript \`Number\`" AGENTS.md docs/engineering` пуст (кроме таблиц миграции); `wc -l AGENTS.md` ≤ 90; в AGENTS.md ровно 15 инвариантов.
8. После 02-B1: `npm ls dexie sharp-ico workbox-window` пуст; `npm run build` не вызывает `pwa-assets-generator`; в `dist` нет анонимного чанка с react-router core (он в `vendor-react-*.js`).
9. `config/eslint/baseline.js`: каждый следующий PR не добавляет записей (CI-скрипт сравнивает число записей с base; рост — fail).
10. Pre-commit на изменении одного файла < 5 с (замер на машине владельца, M-серия).

## Требования к backend

Нет.

## Открытые вопросы

1. ~~Release-ветка~~ — решено (подтверждено владельцем 2026-10-28): один release-Issue на релиз, ветка `chore/issue-<n>-release-vX-Y-Z` через `pr:create`/admission, CI `version-check` по имени ветки (Д7).
2. ~~`Version impact`~~ — решено (подтверждено владельцем 2026-10-28): поле удаляется, бамп выбирает владелец.
3. jsx-a11y baseline неизвестен до установки плагина. Если нарушений больше ~80, 02-C8 делится по слоям.
