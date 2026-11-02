# AGENTS.md

ChipIn — фронтенд на Vite 8, React 19, TS strict, Radix Themes, i18next, PWA.
Backend-контракты не меняем без явного запроса. Полный свод правил — только `docs/engineering/rules/*`.

## Инварианты

1. Слои импортируются только вниз по одному графу: app → pages → features → components → hooks → store → entities → helpers → shared → api → base (constants, types, i18n, styles, assets); basics — между components и helpers; `shared` делится на `shared-api` (`shared/api`, `shared/offline`: только hooks, store, entities, app) и `shared-lib`. Подробности — `docs/engineering/rules/10-architecture.md`.
2. UI (pages, features, components, basics) и helpers не вызывают runtime-API, `axios`, `shared/api` и `shared/offline`; серверные данные приходят через query-слой (`entities/*`) или store. Импорт `axios` и runtime-модулей `api/` из UI ловит `no-restricted-imports`.
3. Деньги в коде — `Money { minor: bigint }` (ledger units scale 4); на проводе — JSON-число scale 4 (D21). Граница провода — два слоя: транспорт `shared/api/wireJson.ts` (только в обёртке `api()`) разбирает тело без double в opaque `WireAmount` и пишет исходящие суммы decimal-литералом, но суммы не интерпретирует; конверсия `WireAmount` ↔ `Money` — только `moneyFromWire`/`moneyToWire` в мапперах `entities/*/model` (`toX()`/`toXWire()`). Парсинг ввода, округление, суммы и форматирование — только `src/shared/money/`; `parseFloat`/`Number()`/`JSON.parse` на денежных полях вне него запрещены. Отображение — только `basics/numbers/amount/Amount.tsx`.
4. Сервер — источник истины для финансов: не патчим балансы/долги локально; мутацию повторяет только цикл outbox `runOutboxOp` (спека 03 §2.4); у всех мутаций TanStack `retry: false`, онлайн-путь — `ledgerOnlineMutationKeys` (`networkMode: 'online'`); устаревший ответ не перезаписывает более новое состояние.
5. Создание/правка/удаление расходов — только через `entities/ledger/api/mutations.ts` (селектор по `offlineWritesAvailable`: онлайн-ключи или outbox); офлайн — только через outbox с client UUID и `entryKind: 'expense'` (включается 03-17 за флагом и capabilities backend; до него офлайн-записи нет). Settle-up и платежи, включая правку и удаление settlement, офлайн запрещены (`ONLINE_ONLY_ACTIONS`, `<OnlineOnly>`).
6. Типы: без `any`, `as any`, `@ts-ignore`, неоправданных `as` и `!`; type-only импорты — `import type`. Данные из IndexedDB, outbox и localStorage проверяются zod при чтении.
7. Промисы не теряются: каждый промис возвращается, `await`-ится или явно помечается `void`; ошибки не глотаются. Стиль `await` или `.then` свободный (запрет async/await снят владельцем 2026-10-28, D24; предупреждения старого async-селектора в `eslint.config.js` не исправляйте). В JSX-атрибутах промис не возвращается: `onClick={() => void action()}`.
8. Только именованные экспорты; не больше одного `index.ts` на слайс, без `export *`.
9. Серверное состояние — TanStack Query; Zustand — UI-состояние. Серверные сторы, которые спека 03 ещё не мигрировала, — переходные: новых не создаём, новые поля серверных данных в них не добавляем. Одно значение читается селектором, несколько — одним объектным селектором с `useShallow`; `useStore()` без селектора и новые `useConnect` запрещены.
10. Автоисправимое чинит `npx eslint --fix <изменённые файлы>`; стиль руками не правим. Ошибка lint — корректность или граница, её сообщение говорит, как чинить; `eslint-disable` — только с причиной.
11. Весь пользовательский текст, включая `aria-*`, `placeholder`, `title` и тосты, идёт через i18n во все локали. Интерактив — нативные элементы или Radix, у кнопок-иконок есть переводимое имя (ревью).
12. `localStorage`/`sessionStorage` — только через `helpers/localStorage.ts`. Токены, invite-токены и персональные данные не попадают в логи, Sentry и URL; logout очищает все пользовательские данные (кэш, outbox, `id`/`role` пользователя); сохраняются только UI-настройки языка и темы.
13. Порядок импортов — `simple-import-sort` (чинит `--fix`), формат — `.prettierrc.cjs`; код, который задача не меняет, не переформатируем.
14. Задача не меняет `version` в `package.json` и `package-lock.json` и не запускает `version:bump`; бамп делается только в release-PR (см. «Релиз»).
15. Изменение домена, API или видимого поведения начинается с KB: `chipin-knowledge-base/common/glossary.md` и `common/specs/<capability>.md`; тесты называются по id требований. Новое поведение сначала попадает в spec KB связанным PR; конфликт с ADR из `common/adr/` — стоп и вопрос владельцу. KB берётся из `../chipin-knowledge-base`, иначе `git clone` туда, иначе через GitHub; если KB недоступна ни локально, ни через GitHub — BLOCKED.

## Команды

- `npm run test:task -- <пути тестов>` — точечные тесты; без пути не запускается.
- `npx eslint --fix <файлы>` — автоисправления ESLint только в изменённых файлах.
- `npm run verify` — быстрый lint (без warnings) и typecheck.
- `npm run verify:full` — полный гейт: lint, все тесты, build, ds-gallery; его же запускает CI. Перед `IMPLEMENTATION_COMPLETE`.
- `npm run typecheck` — `tsc -b`.
- `npm run version:check` — версия в `package.json` и `package-lock.json` валидна и совпадает (только чтение).
- Husky `pre-push` запускает `version:check` и `verify:full`.

## Процесс

- Роли, гейты и порядок чтения — [org canon FLOW.md](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/FLOW.md).
- Перед исполнением задачи нужен свежий `INTAKE_COMPLETE` — [org issue-intake contract](https://github.com/ChipIn-one/.github/blob/master/automation/issue-intake.md).
- Ветка задачи — `<type>/issue-<n>-<slug>` от `master`; PR в `master`, squash; мержит только человек.
- FE Issue не закрывается руками; после merge в `master` он ждёт в `Awaiting release` — [completion canary](docs/engineering/frontend-production-completion-canary.md#issue-lifecycle-after-the-merge-to-master).
- QA перед релизом — [`docs/engineering/release-qa.md`](docs/engineering/release-qa.md); метаданные PR — [`docs/engineering/pr-metadata.md`](docs/engineering/pr-metadata.md).

## Релиз

Версия меняется только при релизе (D15). Один release-Issue на релиз → ветка `chore/issue-<n>-release-vX-Y-Z` → в ней `npm run version:bump -- <patch|minor|major>` (уровень выбирает владелец; бамп делает владелец или Trusted Publisher, Executor — никогда) → merge в `master` → Vercel Preview → «Prepare frontend release QA» → Promote to Production этой сборки в Vercel. Других путей деплоя нет: [`DEPLOYMENT.md`](DEPLOYMENT.md#vercel-delivery-from-master).

## Ревью

Независимый ревьюер проверяет инварианты 1–15 и наличие регрессионных тестов для изменённой логики. Стиль, формат, порядок импортов и всё, что ловит CI, ревьюер не комментирует.

<!-- ai-workflow:agents-routing:start -->
ChipIn AI routing: start at the organization canon [FLOW.md](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/FLOW.md) and follow its reading order, roles and gates. Its [precedence and availability](https://github.com/ChipIn-one/.github/blob/master/docs/workflow/FLOW.md#precedence-and-availability) rules apply: if the canon cannot be read, stop.
<!-- ai-workflow:agents-routing:end -->
