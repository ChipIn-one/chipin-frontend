# 00 — Обзор рефакторинга ChipIn Frontend (2026-10-28)

Входные документы: `DECISIONS.md` (D1–D24; D10 снят → D21), спеки `01`–`05` в этой папке, аудит `../0{0..5}-*.md`, ревью `review-{A,B,C1,C2,C3}*.md` (колонка Resolution в C1–C3).
Пути сверены с `origin/master` `522973a` (канонический после FE#497). Код `src/` на master совпадает с веткой аудита `3d0086e`; отличия — только docs/CI: свод правил в `docs/engineering/rules/`, deploy-workflow'ов нет (Vercel Git + Promote).

## Цель

Главная цель — **предсказуемость для AI-агентов** (Claude/Codex пишут большую часть кода): одно место для правил, один способ на каждую задачу (данные, деньги, роутинг, стили, тема), каждое правило проверяет машина. Вторичная — надёжность: безопасность инвайтов, деньги без float, офлайн-PWA.
Режим — **инкрементальный**: без feature freeze, каждый PR релизится независимо. Размер PR — ориентир, не правило: один PR = одна задача, ревью за один проход; ~400 строк диффа как ориентир; механические PR (Prettier, codemod'ы, rename монорепо) без лимита — ревью = повторить команду.

## Схема идентификаторов

- PR: `<спека>-<n>` — `01-1`, `02-A3`, `02-C7a`, `03-15`, `04-2d`, `05-4`. «Фаза N» в спеке 04 = PR `04-N`.
- Backend-issue: `BE-<спека>-<n>` — `BE-01-1`, `BE-03-5`, `BE-04-2`; `BE-00-1` — из открытых вопросов DECISIONS.

## Карта спек

**01 — Хотфикс (D1, часть D16).** Три PR до рефакторинга: `01-1` helper `apiPath` (кодирование 14 path-сегментов, запрет `.`/`..`), `isInviteToken`, санитайзер `/groups/invite/<token>` в Sentry, CSP/Permissions-Policy, `.gitignore .env*`, удаление `role` из localStorage при выходе; `01-2` экран подтверждения перед вступлением в группу/дружбу; `01-3` единое `roundHalfUp`, «ноль = рассчитались» в 6 местах, фикс зависания `PublicLocaleRoute`. Три backend-issue (PKCE, encoded dot-segments, валидация токена + preview).

**02 — Свод правил и tooling (D9, D11–D13, D15, D16).** `AGENTS.md` = 15 инвариантов + ссылки; полный свод только `docs/engineering/rules/`; каждое правило — LINT/CI/REVIEW/DELETE; lint/format-правило либо автоисправляется (`fix` на сохранении и в pre-commit), либо проверяет корректность/границы с подсказкой, как чинить, иначе удаляется (02 §Д0 «Без трения для агентов»). Единый реестр lint/stylelint-правил всех спек (02 §Д0, машинная копия `rule-classes.json`); baseline — нативные suppressions ESLint (`eslint-suppressions.json`) с ratchet по base SHA. Удаление мёртвых зависимостей и vendor-regex (`02-B1`, единственный владелец), Prettier, `--max-warnings 0` (уровни только error/off), type-aware ESLint (только правила промисов и `any`), 6 правил jsx-a11y, boundaries (с заранее описанными `src/app`, `src/entities`, `src/shared`), husky/lint-staged (pre-commit только `--fix`, не блокирует; блокирует только CI), CI-политика версии, `tsconfig.base.json`, codemod'ы named exports и barrel'ов (после `04-0`).

**03 — Data layer и офлайн (D2–D5, D19, D21, D12).** TanStack Query (offlineFirst, IDB-персистер по `userId`), outbox на paused-мутациях с отдельным персистом, конфликты 409 через `version`/`If-Match`, модуль `src/shared/money/` (`Money { minor: bigint }` scale 4, `split` = backend `distributeAmount`; провод навсегда JSON-число scale 4; обёртка `api()` — lossless-транспорт в opaque `WireAmount`, конверсия в `Money` только в мапперах `entities/*/model` — толкование D21, подтверждение п. 34), типы из OpenAPI (axios + `openapi-typescript` + обёртка `api()`), миграция 11 сторов по одному, удаление `useConnect` (единственный владелец). Семь backend-issue (BE-03-3 снят по D21); до включения outbox обязателен BE-03-5 (D19).

**04 — Монорепо, роутинг, сайт (D6–D8, D18, D22, ADR FE#498).** npm workspaces (`apps/app`, `apps/site`, `packages/tokens`, `packages/i18n-content`), первый PR — механический перенос (04-0a скриптом, 04-0b — docs); версия — только в корневом `package.json`. RR7 data router из одного манифеста; генерация `vercel.json` и SW-allowlist с тестом синхронизации; lazy-load локалей и `setAppLanguage` (единственный владелец); одна константа `CUTOVER` (`app-base.config.ts`) задаёт `APP_BASE` (`'/'` → `'/app/'`), Vite `base`, SW-конфиг и хостинг; одна регистрация SW `/sw.js` со scope `/` бессрочно, precache и fallback только `/app/*` (ASSUMPTION C3-01, п. 33; единственный владелец — 04-2d). изоляция провайдера (всё Vercel-специфичное — только сгенерированные `vercel.json` из нейтрального `hosting.base.json`, `@vercel/*` в одном модуле, D18). Astro-сайт со статичными страницами, `/join/group|friend/<token>`, release-модель сайта «только Promote»; подготовка cutover в 04-2f/04-2g, цель отката 04-3d, cutover 04-4 — только переключения в окне заморозки merge (обратимые redirect'ы 302 на окно отката, затем 301). Отклонения от D8 (catch-all rewrite, тип инвайта в пути) приняты владельцем (D20).

**05 — Стили и токены (D14, D16, D17, D23).** `packages/tokens` (DTCG `tokens.json` → `tokens.css`/`tokens.ts`/`manifest-colors.json`, единственный владелец; манифест PWA, `theme-color` и сайт берут цвет из одного токена `brand.primary` = grass-9; hex/rgb вне `packages/tokens` запрещены lint/stylelint), один механизм переключения темы (light/dark/system: `appearanceStore` → класс `<html>` → `<Theme>`, без FOUC, CSP-хеш), удаление `next-themes`, кодмод `themeColor()` → `var(--cp-*)` (gray → olive), styled-components заморожен allowlist'ом + правило касания, stylelint, граница `basics`/`components`, Radix CSS по частям, WebP. ds-gallery остаётся в `apps/app/ds-gallery/` и получает токены как приложение.

## Кто владеет пересекающимися темами (решено, во всех спеках согласовано)

| Тема | Владелец | Остальные |
|---|---|---|
| Удаление `useConnect` (D12) | 03 (PR миграции стора, остатки 03-18) | 02-C12 — только запрет новых (`check-file-layout`) |
| Lazy-load локалей | 04-2c | 05, 02 ссылаются |
| Vendor-regex `vendor-react` | 02-B1 | 04 §2.8, 05 §5 ссылаются |
| Удаление Dexie/`workbox-window` | 02-B1 | 03 §1.1, 04 §2.11 ссылаются |
| Дедуп регистрации SW, `PWABadge`, `app-base.config.ts`, `pwa.config.ts` | 04-2d | 05-6 его не переносит; 03-20 использует экран п. 4 |
| Денежные lint-правила | 03 §4.3 (03-1 сразу `error` + suppressions; 03-3 и миграции убирают записи) | 02 Д4 R1 ссылается |
| Реестр lint/stylelint-правил, suppressions, ratchet `check-baseline` | 02 §Д0 / 02-C4 | 03/04/05 добавляют строки реестра в PR, который включает правило |
| Онлайн-предикат `isNetworkUsable()` (`onlineManager`) | 03 §1.7 (03-5, `src/shared/offline/network.ts`) | 04 loaders/guard'ы только ссылаются; `navigator.onLine` вне `shared/offline` — lint |
| Цветовые lint/stylelint (`no-raw-colors` = `no-restricted-syntax`, без плагина), `style`-правило | 05-5 | 02 ссылается |
| ESLint-структура, хелперы `restrictedSyntax()`/`restrictedImports()` | 02-C4 (единственный) | 03-1, 05-5 добавляют свои блоки, хелпер не вводят |
| `packages/tokens` | 05-2a (пакет), 05-2b (подключение в app) | 04-1a создаёт только `i18n-content` |
| Экран «Нужно обновить» | 04-2d (UI, гейт outbox `outdated`) | 03-20 (детект 426/заголовка) |
| Формат и нормализация версии | 04-0a (`version-resolver.mjs`: prod = `x.y.z`, иначе `x.y.z-dev-<sha7>`; корень от `import.meta.dirname`) | 02 Д7 ссылается; 03-20 сравнивает только semver-ядро |
| Откат cutover | 04-3d (цель отката) + окно заморозки merge от 04-3d до 48 ч после Promote 04-4 + «нет Promote 48 ч» | DEPLOYMENT.md (раздел Rollback, 04-4) |
| Тест паритета локалей | 04-2c | 02 ссылается |
| ds-gallery | место — 04 §6; typecheck — 02-C5; алиасы — 02-C3; токены/тема — 05-7 | |
| CSP | 01-1 базовые директивы; 04-2b переносит в `hosting.base.json` (headers только на путях app, без `/(.*)`); 05-3 добавляет sha256 theme-init; сайт — только site-проект (04 §3.6), после cutover app не ставит headers на проксируемые пути | |
| `.gitignore .env*` | 01-1 | 02-A3 не повторяет |
| URL инвайта | сайт `/join/group/<t>`, `/join/friend/<t>` (04-3c) → кнопка → экран 01-2 в `/app/…/join/<t>` | старые `/group/join/<t>` — 301 на сайт |

## Граф зависимостей

Жёсткие зависимости (стрелка = «нельзя мержить раньше»):

```
01-1 ──> 01-2 ──────────────┐            01-3 ──> 03-1 ──> 03-2, 03-3 ;  01-1 + 03-1 ──> 03-4a ──> 03-4b
  └─────────────────────────┼──> 04-0a (монорепо-перенос; владелец ставит Root Directory) ─> 04-0b
02-A0 ─> 02-A1 ─> 02-A2     │      │
02-C1 ─> 02-C2a-c ─> 02-C3 ─> 02-C4 ──┬─> 02-C8, 02-C9, 02-C10, 02-C12        (02-C4 = suppressions, реестр, ratchet)
                                      └─> 02-C6 <─ 02-C5 ; 02-C6 ─> 02-C7a/b, 02-C11
                              02-C4 + 04-0a ─> 02-D2a-e ─> 02-D3a-e
04-0a ─> 04-2a1 ─> 04-2a2 (+03-5) ─> 04-2a2b ─> 04-2a3 ─> 04-2a4 ─> 04-2f, 04-2g (+04-2d), 04-2e (+03-8…03-12)
04-2a1 ─> 04-2b ; 04-2a2 ─> 04-2d ─> 04-2h ; 04-0a ─> 04-1a ─> 04-2c
04-0a ─> 04-1b ; 04-0a ─> 05-2a ─> 05-2b ─> 05-3, 05-4 ─> 05-5 (+02-C4), 05-7 (+05-3)
05-2a + 04-1a + 04-1b ─> 04-3a ─> 04-3b1 (+05-3), 04-3b2, 04-3c (+01-2)
04-2b + 04-2d + 04-2g ─> 04-3d (Promote в prod = цель отката; с merge 04-3d начинается окно заморозки)
03-4b ─> 03-5 ─> 03-6, 03-7a ─> 03-7b ; 03-5 ─> 03-8, 03-9 ─> 03-10 ─> 03-11 ─> 03-12 ─> 03-13 ─> 03-14 ─> 03-18
03-7b + 03-13 (+ подтверждение п. 35) ─> 03-15a ─> 03-15b ─> 03-15c ─> 03-16a ─> 03-16b ─> 03-17 (+ BE-03-1, BE-03-2, BE-03-5, 03-20)
03-21 (точность settle-up) ← 03-3, 03-4b
04-2b + 04-2d + 04-2f + 04-2g + 04-2h + 04-3b1 + 04-3b2 + 04-3c + 04-3d (+ BE-04-2) ─> 04-4 CUTOVER ─(48 ч без Promote и без merge; 7 дней без отката)─> 04-5a/b
04-2d + BE-03-5 ─> 03-20 ─> 03-17   (03-19 / BE-03-3 сняты по D21)
без жёстких зависимостей (порядок — мягкий, ниже): 02-A3, 02-B1, 02-B2, 02-C1, 02-C5, 05-1, 05-6
src/store/expenseModal* (file-lock, один открытый PR):
  01-3 ─> 02-C2 ─> 03-1 (только suppressions) ─> 03-2 ─> 03-13 ─> 03-14 ─> 02-D2/D3, 05-4
  02-C3, 02-C6, 02-C7a, 02-C11 — эти файлы не правят (`--exclude`, нарушения уходят в suppressions/tsc-baseline) до 03-14; 04-0a — в своём окне без открытых PR
```

Алиасы id после review A: «04-0» в других спеках = 04-0a; «04-2a» = группа 04-2a1, 04-2a2, 04-2a2b, 04-2a3, 04-2a4 (завершение — 04-2a4). После review C: «03-4» = 03-4a+b, «03-7» = 03-7a+b, «03-15» = 03-15a–c, «03-16» = 03-16a+b, «04-3b» = 04-3b1+b2, «05-2» = 05-2a+b.

Рекомендуемые (мягкие) порядки: 02-C2 и 02-C5 до 04-0 (форматирование и `tsconfig.base.json` до rename); 05-1 до 04-0; 03-1…03-4b — до или после 04-0 (money-правила сразу `error` + suppressions, CI не краснеет); 03-5 и далее — после 04-0.

## Кросс-правки для спек 01 и 03 (из review A; спеки 01/03 правит другой исполнитель)

1. **03-20 / 03 §7 (A-09):** prod-`APP_VERSION` после 04-0a — чистая `x.y.z`, вне prod — `x.y.z-dev-<sha7>`. Сравнение `X-Min-Client-Version` с `APP_VERSION` и значение заголовка `X-Client-Version` — только по semver-ядру `major.minor.patch` (суффикс после `-` отбрасывается до сравнения). Без этого `MIN_CLIENT_VERSION=1.0.9` блокировал бы клиентов на `1.0.9-dev-…`.
2. **03 §6 / entities (A-12):** в едином графе слоёв `entities → store` запрещён (`store → entities` разрешён). Код `entities/**` не импортирует `store/**`.
3. **03 loaders / persister:** спека 04 §2.4 использует `restoreReady` (промис гидрации персистера) и `void prefetchQuery`; 03 экспортирует `restoreReady` из `src/shared/offline/restore.ts` (03-7a; до него — заглушка 04-2a2) и гейт outbox с состоянием `outdated` (04-2d).
4. **01, 03 — аналитика сайта (A-15):** правок не требуется; токен `/join/*` редактируется на сайте (04 §3.6), app-санитайзер `sanitizeTelemetryEvent` не меняется.
5. **Алиасы id:** «04-0» = 04-0a; «04-2a» = группа 04-2a1–a4.

Из review C (спеки 01/03 правит другой исполнитель; здесь — что 02/04/05 от них ждут):
6. `src/shared/offline/network.ts` (03-5): `isNetworkUsable()` = `onlineManager.isOnline()`; lint `navigator.onLine` вне `shared/offline/**` (строка реестра 02 §Д0).
7. `src/shared/offline/restore.ts`: путь и имя `restoreReady` не меняются; до 03-7a — заглушка из 04-2a2.
8. Безопасная точка обновления SW читает статус `sending` из `outboxState` (03 §2.3) (04 §2.11 п. 3, C3-12); 03-13 регистрирует сохранение черновика в `onBeforeAppReload` (04 §2.11 п. 4, C3-26).
9. 03-4b: lint «`moneyFromWire`/`moneyToWire` только в `entities/*/model/**`» (реестр 02 §Д0).
10. 03 приёмка 1: случай «PWA установлен до cutover» — офлайн-запуск со `start_url: '/'` открывает `/app/` (04 §2.11, C3-01).

## План фаз

Честная оценка параллелизма (C2-14): дорожки идут параллельно только между окнами заморозки и только если не трогают одни файлы. Критический путь офлайна — **16 последовательных PR**: 01-3 → 03-1 → 03-4a → 03-4b → 03-5 → 03-9 → 03-10 → 03-11 → 03-12 → 03-13 → 03-15a → 03-15b → 03-15c → 03-16a → 03-16b → 03-17 (плюс 03-20, которому нужен 04-2d, и backend BE-03-1/2/5). При 2–3 merge в неделю на этой цепочке это ≈ 5–7 недель без учёта ожидания backend. Цепочка роутера до 04-2d: 04-0a → 04-2a1 → 04-2a2 (+03-5) → 04-2d.

**Окна заморозки (календарь, записывается в Issue эпика):**
1. 02-C2a–c — один день, без открытых feature-PR (Prettier по всему `src`).
2. 04-0a — ~1 ч на merge + smoke `dev.chipin.one`; открытые PR делают rebase.
3. File-lock `src/store/expenseModal*` — один открытый PR по этим файлам (граф выше).
4. Codemod'ы 02-D2/D3 — слой берётся, только когда в нём нет открытых PR спеки 03; 05-6 — до или после 02-D2a/b тех же файлов.
5. Cutover — от merge 04-3d до 48 ч после Promote 04-4 в `master` мержатся только 04-3d, 04-4 и revert-PR (2–4 дня; PR только в `apps/site/**` и docs-only разрешены). Исключение из «no feature freeze» — п. 39.

**Фаза 0 — хотфикс (неделя 1).** `01-1` → `01-2`; `01-3` параллельно. Параллельно: `02-A0` в ai-workflow, backend-issue `BE-01-*`, владелец ротирует Sentry-токен и проверяет `/auth/test-register`.

**Фаза 1 — свод правил, tooling, мёртвые зависимости, CSS (до переноса).**
- правила: `02-A1` (после подписи п. 36) → `02-A2`, `02-A3`;
- зависимости: `02-B1`, `02-B2`;
- tooling: `02-C1` → `02-C2a–c` (окно 1) → `02-C3` → `02-C4`; `02-C5` параллельно;
- стили: `05-1`;
- раньше срока можно: `03-1`…`03-4b` (money, OpenAPI-типы; не зависят от переноса).
`packages/tokens` (05-2a) требует npm workspaces, поэтому он в фазе 2 сразу после переноса; в фазе 1 — только 05-1.

**Фаза 2 — монорепо.** `04-0a` (окно 2, владелец в момент merge ставит Root Directory = `apps/app`), сразу `04-0b`. Затем `04-1a`, `04-1b`, `04-2a1`, `05-2a`.

**Фаза 3 — data layer/офлайн, data router, сайт, остаток tooling.**
- data (критический путь): `03-5` → `03-6`/`03-7a`→`03-7b`/`03-8`/`03-9` → `03-10` → `03-11` → `03-12` → `03-13` → `03-14`; `03-15a` → `03-15b` → `03-15c` → `03-16a` → `03-16b` → `03-20` → `03-17` (флаг после BE-03-1/2/5);
- роутер (после 03-5): `04-2a2` → `04-2a2b` → `04-2a3` → `04-2a4`; `04-2b`, `04-2c`, `04-2d` → `04-2h`, `04-2e`; подготовка cutover `04-2f`, `04-2g`;
- сайт: `04-3a` → `04-3b1`, `04-3b2`, `04-3c`;
- tooling: `02-C6` → `02-C7a/b`, `02-C11`; `02-C8`, `02-C9`, `02-C10`, `02-C12`;
- стили: `05-2b` → `05-3`, `05-6`.
Завершение фазы — `04-3d` (merge открывает окно 5, Promote — последний перед cutover) → `04-4` cutover (только `CUTOVER = true` и связанные переключения; проверка на preview до merge, E2E 04-2h; 48 ч без Promote).

**Фаза 4 — вывод styled, чистка.** `05-4` (кодмод, единственный PR с изменением пикселей) → `05-5`, `05-7`; `02-D2a–e` → `02-D3a–e` (окно 4); `04-5a/b` (через 7 дней без отката; 04-5a переводит обратимые redirect'ы с 302 на 301 и переименовывает `app.html`); `03-18`; `03-21` — по спеке 03; `03-20` — как только готов BE-03-5 (до `03-17`).

## Backend-issues (`chipin-backend`; при создании задать Type, Priority, assignee, Project 5)

1. `BE-01-1` (P1) — `OAuth: bind one-time login code to the browser (PKCE S256 or __Host- tx cookie)`
2. `BE-01-2` (P1, как в созданном issue #197) — `Security: reject encoded dot-segments and slashes (%2F, %2E%2E, %5C) in path parameters`
3. `BE-01-3` (P1, как в созданном issue #198) — `Invites: validate invite token format (INVALID_INVITE_TOKEN) and add GET /groups/invite/{token} preview`
4. `BE-03-1` (P1) — `Ledger: add entry version and optimistic locking (If-Match → 409 LEDGER.VERSION_CONFLICT with current)`
5. `BE-03-2` (P1) — `Ledger: idempotent create with client-generated id (200 same / 409 ID_CONFLICT / 410 ENTRY_DELETED)`
6. ~~`BE-03-3`~~ — снят по D21 (провод остаётся JSON-числом scale 4; номер не переиспользуется)
7. `BE-03-4` (P2) — `OpenAPI: unique operationIds, named schemas, 409/410/426 responses, deterministic build artifact`
8. `BE-03-5` (P1, до включения outbox 03-17) — `Client version gate: new X-Client-Version request header + MIN_CLIENT_VERSION config → 426 CLIENT.OUTDATED, X-Min-Client-Version response header (exposed)`
9. `BE-03-6` (P3) — `Test: DELETE of an already deleted ledger entry returns 204`
10. `BE-03-7` (P2) — `Shared split test vectors (ledger-split-vectors.json) for backend and frontend`
11. `BE-03-8` (P3, фаза 2 офлайна) — `Groups: version and 409 on PATCH /groups/{id} and member operations`
12. `BE-04-1` (P3) — `OpenAPI docs: OAuth callback example → https://chipin.one/app/oauth/callback`
13. `BE-04-2` (P1, до 04-4) — `Verify OAUTH_ALLOWED_REDIRECT_ORIGINS and VERCEL_PREVIEW_PROJECTS on prod/dev for /app callback`
14. ~~`BE-04-3`~~ — снят (C3-24): app-header `/api/(.*)` = `no-store` делает `public, max-age=300` бесполезным; закрыть chipin-backend#208 как not planned (действие координатора)
15. `BE-00-1` (P1) — `Verify /auth/test-register is disabled in production`

## Подтверждения владельца (все ASSUMPTION + открытые вопросы DECISIONS)

Формат: вопрос — **рекомендация по умолчанию**.

1. Нормализует ли Ktor `..` (DECISIONS) — **вопрос снят**: браузер нормализует literal `..` до отправки; фикс на клиенте (01-1), BE-01-2 — только defense-in-depth.
2. `/auth/test-register` выключен на prod? (DECISIONS) — **должен быть выключен; проверить, BE-00-1**.
3. Vercel Speed Insights/Analytics нужны? (DECISIONS, 04) — **подтверждено владельцем 2026-10-28 (D18): оставить; в app — один модуль `vercelAnalytics.ts`, на сайте один скрипт `/_vercel/insights`; Vercel изолирован (04 §1.5a)**.
4. Политика минимальной версии клиента (DECISIONS, 03 §7, 04) — **подтверждено владельцем 2026-10-28 (D19, вариант A): сейчас только принудительное обновление SW через 24 ч; до включения outbox — BE-03-5 (новый заголовок `X-Client-Version` + `MIN_CLIENT_VERSION` → 426) и 03-20 (заголовок из `APP_VERSION` в axios-interceptor, блокирующий экран на 426); `MIN_CLIENT_VERSION` поднимается только при несовместимом изменении контракта и после ≥ 72 ч новой FE-версии в prod; outbox не удаляется**.
5. Экран подтверждения и для `/friends/join/:token` (01) — **да, подтверждено владельцем 2026-10-28 (D20)**.
6. Длина invite-токена `16..64`, а не строго 32 (01) — **да**.
7. Порог «ноль» в хотфиксе — 4 знака; после 03-3 — минорные единицы валюты (`0.0040 USD` = «в расчёте») (01, 03) — **да, оба шага; подтверждено владельцем 2026-10-28**.
8. Тексты es/pt-BR/pt-PT экрана подтверждения — машинный перевод с ревью владельца (01) — **да, подтверждено владельцем 2026-10-28**.
9. Release-ветка `chore/issue-<n>-release-vX-Y-Z` проходит `pr:create`/admission, один Issue на релиз, CI `version-check` (02) — **да, подтверждено владельцем 2026-10-28** (решено в 02 Д7).
10. Поле `Version impact` в Issue убрать, бамп выбирает владелец (02) — **да, подтверждено владельцем 2026-10-28**.
11. Удалить override `sharp`; вернуть с комментарием, если `icons:generate` упадёт (02) — **да, подтверждено владельцем 2026-10-28**.
12. Если jsx-a11y baseline > ~80 нарушений — делить 02-C8 по слоям (02) — **да** (с 6 правилами вместо `recommended` маловероятно).
13. Ничьи остатка в `distributeAmount` — по порядку `participantIds` запроса (03) — **да, проверить в BE-03-7**.
14. Refresh-токен — httpOnly cookie через same-origin `/api` rewrite (03) — **да (по аудиту)**.
15. Лимиты outbox: 50 операций, 14 дней до `stale`, persist кэша 14 дней (03) — **да, подтверждено владельцем 2026-10-28 (D20)**.
16. Показывать «вашу долю» pending-расхода в `OutboxSheet` с явной подписью (03) — **да, подтверждено владельцем 2026-10-28 (D20)** (`money.split` точен).
17. Деньги: D10 снят → D21 — провод навсегда JSON-число scale 4 (backend — источник истины), домен `Money { minor: bigint }` scale 4, модуль `src/shared/money/` (03) — **подтверждено владельцем 2026-10-28 (D21)**; место конверсии — п. 34.
18. Backend не рассылает URL фронта (письма/push/бот) (04) — **да; если канал есть — добавить в таблицу 301**.
19. Prod/dev значения `OAUTH_ALLOWED_*` совпадают с ожиданием 04 §4.4 (04) — **проверить до 04-4 (BE-04-2)**.
20. ~~Установленный PWA подхватит новый `scope`~~ — снято review C: `scope` больше не меняется (п. 33).
21. Backend реализует BE-03-5 (новый заголовок `X-Client-Version` → 426) до включения outbox (03, 04) — **подтверждено владельцем 2026-10-28 (D19, вариант A); до этого — только 24-часовое принудительное обновление SW**.
22. Поддомены `site.chipin.one` / `site-dev.chipin.one` для site-проекта (04) — **да, подтверждено владельцем 2026-10-28 (D22; custom-домены на Hobby бесплатны)**.
23. Отклонения от D8: catch-all rewrite на сайт; `/join/group|friend/<token>` вместо `/join/<token>` (04) — **принято, подтверждено владельцем 2026-10-28 (D20)**.
24. ADR FE#498: вариант (d) Astro-сайт + Vite SPA (04) — **утвердить**.
25. Olive-оттенок в 21 styled-файле (ΔE ≈ 1–2), скриншоты 05-4 как контроль (05) — **принято, реализуется генератором (D23)**.
26. `theme_color` = grass-9 `#46a758` вместо `#3e9b4f` из `manifest-colors.json` (05) — **принято (D23), но посылка неверна**: `#3e9b4f` = Radix `grass-10` (review A-24). **Рекомендация по умолчанию: оставить grass-9 (D23); альтернатива без видимого изменения — `brand.primary` = `grass.10`. Владелец подтверждает.**
27. D9: полный свод — `docs/engineering/rules/` (на master), а не `docs/codex/rules` (02) — **принять (факт master)**.
28. Токены (05-2) переезжают из фазы 1 в фазу 2 — требуют npm workspaces (00) — **принять**.
29. Ротация локального Sentry-токена (D16) — **действие владельца в фазе 0**.
30. Исключения из D23 «нет raw hex» (05, review A-29): `brand.loader #80c837`, `media-on/scrim #fff/#000` только в `tokens.json`; файл `global-error-boundary/styles.css` — **принять как дополнение к D23**.
31. Правило отката cutover (04, review A-03): 04-3d — последний Promote перед 04-4; 48 ч после Promote 04-4 app-проект не промоутится (Hobby откатывает только на предыдущий prod-деплой) — **принять**; вместе с окном заморозки п. 39.
32. `site.chipin.one` как дубль-хост: только canonical, `X-Robots-Tag` по хосту отложен (04 §4.3, review A-33) — **принять**.
33. **C3-01, ASSUMPTION (owner decision): SW и установленные PWA при cutover** (04 §2.11). У текущих установок `start_url`/`scope` = `/`, iOS манифест не обновляет; SW только на `/app/` + kill-switch лишили бы их запуска офлайн (D2). — **Рекомендация по умолчанию (в спеке): SW приложения — `/sw.js` со scope `/` бессрочно**, регистрирует только приложение, precache — только оболочка `/app/*`, `navigateFallbackAllowlist` — только `/app/*`, страницы сайта идут в сеть, офлайн-навигация на `/` → `offline-root.html` → `/app/`; манифест `start_url: '/app/'`, `scope` и `id` = `/` без изменений. Нет kill-switch, нет миграции scope, нет второй регистрации; отклонение от буквы D8 «SW registered only under /app/». Альтернатива (b): SW на `/app/` по D8 + kill-switch, текущие установки теряют офлайн до переустановки.
34. Деньги — толкование D21 «at the API boundary (generated types + wrapper)»: обёртка `api()` = lossless-транспорт (`wireJson.ts`, opaque `WireAmount`, без double), конверсия `WireAmount` ↔ `Money` — только в мапперах `entities/*/model` (02 инв. 3, 03 шапка/§4.3; C1-11, C2-06, C3-14; до 03-4b) — **принять**.
35. Outbox-мутации с `networkMode: 'always'` и своим ожиданием сети в `runOutboxOp` вместо «paused mutations» D3 (03 §2.1; C1-16a, C3-27) — **принять**; 03-15a не стартует до подписи.
36. D9 «правило — lint/CI или удаляется» исполняется с классом `REVIEW` для семантических инвариантов AGENTS.md (02 §Решение 2; C1-16b) — **принять**; 02-A1 не стартует до подписи.
37. D4 «zod на IDB-кэше»: для кэша запросов вместо zod — buster по форме доменной модели (03 §1.4; до 03-7a); zod остаётся на outbox и localStorage (C3-14) — **принять**.
38. Отложено (C1-28): D2 фаза 2 (группы и участники офлайн) — без PR-id до 03-17, отдельной спекой после 03-17 и BE-03-8 (03 §2.9); D16 «narrow img-src» — FU-2 (#539) — **принять как одобренные отсрочки**.
39. Окно заморозки merge на cutover (04 «Откат», C1-07): от merge 04-3d до 48 ч после Promote 04-4 — только 04-3d/04-4/revert (2–4 дня), исключение из «no feature freeze» — **принять** (проще release-ветки: Promote остаётся «точный деплой master»).
40. Vercel Hobby — лицензия для некоммерческого использования, а в app есть premium/early-supporter промо (C1-30) — **владелец сверяет тариф с условиями Vercel до 04-3a** (второй проект); не меняет архитектуру (D18).
41. Отозванная сессия на потерянном устройстве (C3-09, 03 §1.5): данные под `AuthModal` скрыты (`inert` + `visibility: hidden`, 04 §2.3); офлайн-доступ к кэшу после expiry отключён; различать `REVOKED`/`EXPIRED` на backend и стирать кэш при `REVOKED` — да/нет (до решения backend-issue не создаётся) — **рекомендация: да**.
43. Settle-up «досыпает» до точного долга, если ввод отличается меньше чем на 1 минорную единицу, с подписью под полем (03 §4.5, C3-19; до 03-21) — **принять**.
42. BE-04-3 снят (C3-24): статистика лендинга без CDN-кэша, как сейчас; закрыть chipin-backend#208 — **принять**.

Итого: 43 пункта (20 снят); открытыми остаются действия владельца 2 (проверить `/auth/test-register`), 19 (проверить OAuth env до 04-4), 29 (ротация Sentry-токена), 40 (тариф Vercel) и подтверждения 26, 30, 31, 32, 33 (C3-01, ASSUMPTION по умолчанию), 34–39, 41–43. Блокируют старт: 36 → 02-A1, 35 → 03-15a, 33 → 04-2d (конфиг SW), 39 → 04-3d. Действия владельца без выбора: Root Directory = `apps/app` в момент merge 04-0a; создание `chipin-site` в Vercel (Production Branch `main`, `site-dev` на `master`) и поддоменов перед 04-3a; Promote 04-3d последним перед 04-4 и соблюдение окна заморозки; Instant Rollback на 04-3d при критерии отката 04-4.

## Объём

| Спека | PR | Примечание |
|---|---|---|
| 01 | 3 | ~820 строк всего |
| 02 | 31 (30 FE + 02-A0 в ai-workflow; 02-D1 снят — правило `React.FC` удалено, 02 §Д0) | 02-C2a–c и 02-D2/D3 — механические |
| 03 | 25 (03-19 снят по D21; +03-21; review C: 03-4a/b, 03-7a/b, 03-15a–c, 03-16a/b) | 03-17/20 ждут backend |
| 04 | 24 (было 14: 04-0 → 0a/0b, 04-2a → 2a1–a4, +04-2f, 04-2g, 04-3d; review C: +04-2a2b, +04-2h, 04-3b → 3b1/3b2) | 04-0a — скрипт переноса, ревью = перезапуск + просмотр не-rename правок |
| 05 | 8 (review C: 05-2 → 05-2a/2b) | 05-4 — единственный «пиксельный» PR |
| **Итого** | **91** (3 + 31 + 25 + 24 + 8; прежние «82/83» устарели, C1-29) + 13 backend-issue (BE-03-3 и BE-04-3 сняты) | ≈ 80 PR по ориентиру ~400 строк (≈ 15–20 тыс. строк ручного диффа) + ~11 механических |

## GitHub-issues во frontend-репо (при создании: Type, Priority, assignee, Project 5)

- Epic: `Refactor for agent predictability: rulebook, data layer, offline, routing, site, tokens`
- `01-1 Fix: encode API path segments, validate invite tokens, redact invite telemetry, CSP hardening`
- `01-2 Fix: confirm before joining a group or accepting a friend invite`
- `01-3 Fix: single half-up rounding, zero balance is settled, PublicLocaleRoute spinner`
- `02-A Single rulebook: AGENTS.md invariants, rules 00–70 cleanup, remove .ai duplicates`
- `02-B Remove dead dependencies, fix vendor-react chunk, stop icon regeneration`
- `02-C Tooling: Prettier, zero warnings, type-aware ESLint, a11y, boundaries, hooks, version policy, TS strictness`
- `02-D Codemods: named exports, no nested barrels`
- `03-A Money module src/shared/money and balance entities`
- `03-B OpenAPI-generated API types and typed client`
- `03-C TanStack Query core: client, persister, connectivity, session expiry`
- `03-D Migrate server stores to TanStack Query (store by store, remove useConnect)`
- `03-E Offline outbox for expenses: queue, conflicts, online-only actions`
- `03-F Client version gate: X-Client-Version header and blocking update screen on 426 (before offline writes)`
- `04-A Monorepo: npm workspaces, apps/app move, i18n-content package, CI path filters`
- `04-B App routing: React Router data router, route manifest, generated vercel.json, lazy locales, single service worker`
- `04-C Public site on Astro: landing, legal, invite landing`
- `04-D Cutover: /app base path, redirects, root-scope service worker` (#530: заголовок и тело синхронизировать после review C — kill-switch снят, окно заморозки)
- `04-E Remove PublicApp, prerender and public routes from the app`
- `05-A Radix CSS split and asset optimization`
- `05-B packages/tokens: DTCG tokens and generator`
- `05-C Single theme-switching mechanism (light/dark/system) without FOUC, remove next-themes`
- `05-D Retire styled-themes: themeColor codemod, styled allowlist, stylelint, CSS Modules`
- `05-E basics/components boundary and Radix wrappers cleanup`
- `05-F ds-gallery on app tokens and theme`
- Синхронизация после review C (координатор): новые PR id (03-4a/b, 03-7a/b, 03-15a–c, 03-16a/b, 04-2a2b, 04-2h, 04-3b1/b2, 05-2a/b) — в телах #522, #523, #525, #528, #529, #530, #533; закрыть chipin-backend#208.
- Follow-ups вне спек: `Telemetry: generic token redaction`, `Security: CSP img-src, report-to, Sentry tunnel`, `Auth: client PKCE after BE-01-1`, `Invites: group preview on confirmation screen after BE-01-3`.
- В `syllik/ai-workflow`: `02-A0 Routing block: read .ai/context.md and .ai/decisions.md only if present`.

## Риски (топ-10)

| # | Риск | Митигация |
|---|---|---|
| 1 | Массовые PR (Prettier, 04-0 rename, codemod'ы) и окна заморозки тормозят фичевую работу; параллелизм ниже ожидаемого | календарь окон 1–5 (План фаз), file-lock `expenseModal*`, codemod по слою без открытых 03-PR, `.git-blame-ignore-revs`; критический путь офлайна 16 PR — планировать по нему |
| 2 | Cutover ломает OAuth, инвайты, SEO, CSP сайта или deep links | одна константа `CUTOVER`, `base` никогда не `''` + `check-built-html` и deep-link smoke (04 критерий 12); проверка на preview 04-4 до merge (одна CSP, curl §4.2, вход Google); BE-04-2 до cutover; цель отката 04-3d (обратные redirect'ы, redirect не матчит файлы — тест), окно заморозки + 48 ч без Promote, обратимые redirect'ы 302 до 04-5a; 7 дней до удаления |
| 3 | Установленные PWA теряют офлайн или застревают на старой оболочке при cutover | SW `/sw.js` scope `/` бессрочно (ASSUMPTION C3-01, п. 33): та же регистрация, обычное обновление, precache только `/app/*`, офлайн `/` → `offline-root.html` → `/app/`; E2E 04-2h на preview 04-4 (одна регистрация, офлайн `/app/dashboard` и `/`) |
| 4 | Outbox теряет или дублирует операции | запись офлайн за флагом до BE-03-1/2, отдельный персист, 03-15 разбит на a/b/c, msw-тесты reload/вкладок, лимиты 50/14 дней (детали — спека 03) |
| 5 | Регрессия денег (округление, знак, деление) | snapshot до/после, векторы BE-03-7, money-PR изолированы, единые lint-правила 03 §4.3 |
| 6 | Backend-зависимости затягиваются | money без backend-изменений (D21), флаги, 24-часовое обновление SW; фронт не блокируется кроме 03-17/20 |
| 7 | Переходный период «старое + новое» путает агентов; lint/format-правила заставляют агентов делать лишние круги | правила без автофикса и не про корректность удалены (02 §Д0), pre-commit только чинит, проверка на агентах перед merge 02-C (0 повторов из-за автофиксимых правил); текст `L:`-правила меняется в том же PR, что и lint (02-A2 — только DEL/RW без lint); один граф слоёв; единый реестр правил с классом (02 §Д0); инварианты AGENTS.md не противоречат спеке 03 (переходные помечены); baseline — нативные suppressions, ratchet по base SHA из `steps.gate.outputs`, не протекает; один владелец на тему (таблица выше) |
| 8 | Ошибка конфигурации Vercel (Root Directory, файлы вне root, версия из cwd) при 04-0a; лимиты Hobby на два проекта | действие владельца в момент merge, smoke-чеклист §1.6, сравнение состава `dist`, version-скрипты от `import.meta.dirname`; Ignored Build Step по `VERCEL_GIT_PREVIOUS_SHA`, замер CI/деплоев после 02-C6 и 04-3a (04 §1.5) |
| 9 | Визуальный сдвиг gray → olive и токены | изолированный 05-4, 10 пар скриншотов, подтверждение владельца |
| 10 | IndexedDB недоступен/квота (Safari private), незашифрованные финансовые данные | fallback без персиста + Sentry, `clearUserData` при logout и смене аккаунта |

## Что НЕ делаем

- Next.js, SSR, RR framework mode, RR actions/`<Form>`; Turborepo (пока CI < 10 мин); `packages/ui` и `apps/ds-gallery`.
- Tailwind, shadcn, отказ от Radix Themes, big-bang перевод styled-components, Storybook, автоматический visual regression, облачные VR.
- Settle-up/платежи офлайн; локальный пересчёт балансов; Background Sync; фейковые события в activity-кэшах; API в SW `runtimeCaching`.
- zod на ответах API; замена axios на fetch/`openapi-fetch`.
- Biome/oxlint, `exactOptionalPropertyTypes`, `import-x/no-cycle` в pre-commit; перевод свода правил на русский.
- Стилевые lint-правила без автофикса (`handle*`, `React.FC`, PascalCase типов, вложенные тернарники, `no-multi-comp`, имена файлов/папок, `toMatchSnapshot`, полный `jsx-a11y/recommended`) и блокирующий pre-commit/pre-push — 02 §Д0.
- Deploy-workflow'ы, перенос домена/DNS, переименование app-проекта Vercel.
- Миграция хостинга с Vercel (и замена Analytics) — отдельное исследование, в работе (D18); спеки только изолируют провайдера (04 §1.5a).
- Префикс локали в URL приложения; изменения `ModalRouter`; превью группы на `/join/*` до BE-01-3 и решения владельца.
- Figma сейчас (DS v1/D17: Pencil-макеты одноразовые, источник — `tokens.json`).
- UUID-валидация в API-слое (только в loaders), generic-редакция токенов и сужение `img-src` в хотфиксе.
