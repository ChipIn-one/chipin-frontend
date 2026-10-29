# Спека 03 — Data layer: TanStack Query, offline-outbox, money, OpenAPI-типы

Реализует решения D2, D3, D4, D5, D21 (заменяет D10), D19 (в части outbox) (и D12 в части сторов) из `specs/DECISIONS.md`.
Пути ниже даны относительно `src/` текущего репозитория `chipin-frontend`; после монорепо-переезда (D7)
префикс становится `apps/app/src/`. Целевые папки `shared/`, `entities/`, `features/` — из
`01-architecture.md` §8.

Идентификаторы PR — `03-<n>`, backend-issue — `BE-03-<n>` (глобальная схема, `00-overview.md`).

D10 withdrawn → D21: backend — источник истины, на проводе **навсегда** JSON-число scale 4 (строк на проводе нет,
backend-issue на строки не создаётся). Граница провода — два слоя, у каждого одна задача (ревизия C1-03/C1-11/C2-06/C3-14):
- **транспорт** `shared/api/wireJson.ts` (только в обёртке `api()`): тело ответа разбирается из **текста** без double
  (`lossless-json` + реестр полей §4.3); денежное поле становится opaque `WireAmount`, исходящее тело пишется тем же
  модулем decimal-литералом. Транспорт суммы не интерпретирует и не конвертирует в `Money`;
- **конверсия** `WireAmount` ↔ `Money` — **только** в мапперах `entities/*/model/toX()` / `toXWire()`
  (`moneyFromWire`/`moneyToWire`, lint §4.3).
Это толкование D21 «at the API boundary (generated types + wrapper)»: обёртка = lossless-транспорт, конверсия = мапперы;
вынесено в подтверждения владельца в 00 (вместе с отклонениями D3 `networkMode: 'always'` §2.1 и D4 buster вместо zod
для кэша §1.4). Домен — `Money { minor: bigint /* scale 4 */, currency }`, арифметики на float нет. Уточнения: (1) «integer
units» D21 — ledger units scale 4, как backend (`ShareDistribution.kt`); минорные единицы валюты — только для
отображения/ввода. (2) Модуль `money/` размещается как `src/shared/money/`. (3) D5 `version`/409 —
backend этого пока не имеет; офлайн-запись включается флагом только после BE-03-1/BE-03-2 (PR 03-17) **и** при
наличии runtime-capabilities от backend (§2.7).

Ревизия 2026-10-28 по review B (`review-B-data.md`): B1–B3, M1–M14, m1–m11 — см. колонку Resolution там.
Ревизия 2026-10-28 по review C1/C2/C3 (`review-C1.md`, `-C2.md`, `-C3.md`, колонка Resolution): деньги без double
(§4.1, доказательство Node-sweep), outbox — guard restore, отмена, `seq`, фенсинг лидера, привязка к аккаунту (§2),
таблица «причина выхода → что удаляется» (§1.5), settlement только онлайн (§2.9), точный контракт backend (§7),
разбиение PR: 03-4a/b, 03-7a/b, 03-15a/b/c, 03-16a/b.

Зависимости от других спек:
- спека 01 (хотфикс D1: дедуп `roundMoney`, знак нулевого баланса — PR 01-3) смержена до PR 03-1;
- спека 04 (D6: data router, loaders, guards) использует `queryOptions` из этой спеки; loaders с prefetch
  (PR 04-2e) появляются только после PR 03-5; экран «Нужно обновить» и SW — PR 04-2d;
- спека 01 (PR 01-1 `clearLocalUserRole`, D16 «role из localStorage») — в PR 03-7b поглощается
  функцией `clearUserData()` из этой спеки (сохраняет только `settings`, как требует 01-1);
- спека 02: удаление `dexie` — PR 02-B1; запрет новых `useConnect.ts` — PR 02-C12; хелпер
  `restrictedSyntax()`/`restrictedImports()` и `config/eslint/project.js` — PR 02-C4.
- Монорепо (04-0): 03-1…03-4b можно делать до или после 04-0; 03-5 и далее — рекомендуемо после 04-0
  (новые папки `src/app`, `src/shared`, `src/entities` сразу создаются в `apps/app/src/`).
- Эта спека **единственный владелец** удаления `useConnect` (D12) — в PR миграции своего стора, остатки в 03-18.
  Ленивая загрузка локалей (04-2c), регистрация SW (04-2d), vendor-regex (02-B1) — не здесь.

---

## Цель

1. Один предсказуемый способ работы с серверными данными: TanStack Query вместо 11 рукописных
   zustand-сторов с loading/error-мешками и `createRequestChannel`.
2. Офлайн-PWA: чтение закэшированных данных без сети; создание/изменение/удаление расходов офлайн через
   очередь (outbox), которая отправляется по порядку при восстановлении сети.
3. Деньги без float: единый модуль `money/`, конверсия число ↔ `bigint` на границе, целые единицы внутри, правило остатка
   совпадает с backend.
4. Типы API генерируются из OpenAPI backend, расхождение ловит CI.

## Контекст (аудит)

- 11 сторов, ручной кэш, нет staleness/refetch: `02-routing-state-pwa.md:15`, `01-architecture.md:111-130`;
  флаг-мешки `loadingStore.ts`/`errorsStore.ts` (`01-architecture.md:118-121`); `resourceRequests.ts` (:79-80).
- Циклы `groupsStore.ts:18` ↔ `activity-store/actions.ts:14`, `expenseModalStore.ts:16` ↔ `expenseModalSelectors.ts` (:63-64).
- `authStore.ts:46-53` сбрасывает 6 сторов, истечение сессии теряет черновик (`02-routing-state-pwa.md:22`).
- Офлайн = «backend недоступен» на весь экран: `02-routing-state-pwa.md:16`, `helpers/errors.ts:127-139`,
  `api/chipin.interceptors.ts:75-91`.
- Деньги: `roundMoney` в `expenseModalStore.ts:161`, `expenseModalSelectors.ts:14`; 6 копий разбиения по знаку,
  `CurrencyGroupCard.tsx:13` с `>= 0` (`01-architecture.md:86-101`). Типы ручные (`api/chipin.raw.types.ts`, :141-149).
- axios: `api/chipin.interceptors.ts` (223 строки), `onUploadProgress` в `api/usersApi.ts:45`, `api/groupsApi.ts:46`.

Проверено в backend (`chipin-backend`, `develop`, read-only):
- Суммы на проводе — **JSON-числа**, не строки: `BigDecimalJsonNumberSerializer` пишет literal scale 4
  (`85.5000`) и **отклоняет строку** на входе (`common/serialization/BigDecimalJsonNumberSerializer.kt`).
- БД `decimal(19,4)` (`ledger/models/database/LedgerDbObjects.kt:26`). Доли: целые единицы scale 4 для всех
  валют, наибольший остаток, ничьи по порядку участников (`ledger/shares/ShareDistribution.kt:9-60`).
- `version`/409/`If-Match` нет; есть только `createdAt`/`updatedAt` в **Unix-секундах** (expense, entry, group).
  Ledger event-sourced: `expense_events` (`CREATED|CORRECTED|REVERSED`, `seq`) — `LedgerDbObjects.kt:13-36`.
- `POST /ledger/entries` id не принимает (`LedgerCrudRequests.kt:17-22`), а неизвестное поле тела → **400**
  (`ignoreUnknownKeys = false`: `SerializationPlugin.kt:8-9`, `OpenApiSchemaOverrides.kt:73-76`). `DELETE` удалённой → уже 204
  (`LedgerEntryCommandService.kt:182`), `PATCH` удалённой → 404.
- Транзиентная гонка транзакций (serialization failure/deadlock после ретраев Exposed) → **409 `SYSTEM.CONFLICT`**,
  клиент должен просто повторить запрос (`ExceptionHandlingPlugin.kt:59-70`). Тело ошибки — только
  `ErrorResponse { code, details?: Map<String,String> }` (`common/dto/ErrorResponse.kt:30-42`), сущность в нём не передать.
- `GET /health` (public, есть на prod) → `{ status: "UP" }` (`features/health/HealthRoutes.kt`).
- OpenAPI 3.1 только runtime, `/swagger/documentation.yaml` под Basic auth, на prod выключен; snapshot в
  backend запрещён (`docs/openapi.md`).
- Access 1 ч, refresh 30 дней (`resources/application.yaml:16,18`). CORS (develop): только `Content-Type`, `Authorization`
  (`plugins/CORSPlugin.kt:21-23,37-41`); для FE не важно — запросы идут same-origin через Vercel-прокси `/api`.
  Заголовка версии клиента нет.

## Решение

1. TanStack Query v5, `networkMode: 'offlineFirst'`; кэш в IndexedDB (`idb-keyval`), ключ по `userId`, buster = хэш спеки.
2. Outbox = paused-мутации с `mutationDefaults` и общим `scope`, но **персист отдельно** от кэша запросов
   (свой ключ IDB, zod-схема), чтобы смена buster не стирала неотправленные операции.
3. Конфликты — `version` + `If-Match` + 409 с текущей сущностью (backend добавляет).
4. Офлайн-баланс **не пересчитывается**; серверный баланс с пометкой «без учёта неотправленных операций».
5. HTTP остаётся на **axios** + типы `openapi-typescript` + тонкая типизированная обёртка с lossless-JSON транспортом (деньги без double, §4.1).
6. `shared/money/`: `Money { minor: bigint; currency }` (scale 4), арифметика в `bigint` (как backend),
   округление до минорных единиц валюты только для отображения.

---

## Детали

### 1. Query layer

#### 1.1 Зависимости

Добавить: `@tanstack/react-query`, `@tanstack/react-query-persist-client`,
`@tanstack/query-async-storage-persister` (все TanStack — одна точная версия, `5.105.0`), `idb-keyval` (`6.3.0`, нужен
`update()` — атомарный read-modify-write в одной IDB-транзакции, §2.3), `lossless-json` (точно `4.3.3`, MIT, §4.1), `zod`;
dev: `@tanstack/eslint-plugin-query`, `@tanstack/react-query-devtools` (только dev-сборка), `msw` (точно `2.15.0`: `latest`
на npm — `3.0.3` с другим API, тесты §8 написаны под v2 `setupServer`), `fake-indexeddb`, `openapi-typescript`.
`dexie`, `dexie-react-hooks` удаляются в PR 02-B1 (не в этой спеке; в `src/` они не используются).

#### 1.2 QueryClient

Файл `shared/api/queryClient.ts`, фабрика `createQueryClient()` (новый клиент на каждого пользователя, см. 1.5).

```ts
export const PERSIST_MAX_AGE = 14 * DAY;
export const createQueryClient = (): QueryClient => {
  const client = new QueryClient({ defaultOptions: {
    queries: { networkMode: 'offlineFirst', staleTime: 30_000, gcTime: PERSIST_MAX_AGE, // gcTime >= maxAge
               retry: queryRetry, refetchOnWindowFocus: true, refetchOnReconnect: true },
    mutations: { networkMode: 'offlineFirst', retry: false } } });
  registerMutationDefaults(client); // до hydrate, см. 2.1
  return client;
};
```

`queryRetry(failureCount, error)`: network error → `!isNetworkUsable() || failureCount < 3` (в v5 `offlineFirst` ставит
на паузу **только между ретраями**: после неудачной первой попытки retryer видит offline и держит запрос
`fetchStatus: 'paused'`, `status` остаётся `success` с кэшем; с `retry: false` запрос ушёл бы в `error`; при
`onlineManager` ещё online — не больше 3 попыток, иначе `isFetching` не завершается до probe, C1-31); 5xx и 409
`SYSTEM.CONFLICT` → `failureCount < 2` (backoff по умолчанию TanStack); остальные 4xx → `false`.

Правила, которые из этого следуют (проверяются ревью и тестом §8):
- Компоненты рендерят `data`, если она есть; ошибку показывают **только** при `data === undefined`
  (паттерн `const { data, error } = useXQuery(); if (data) … else if (error) …`). `isError` без проверки `data` запрещён.
- Loaders (спека 04): `restoreReady.then(…)` (§1.6; стиль `await`/`.then` свободный, D24), внутри
  `void queryClient.prefetchQuery(opts)` — не блокирует. Вернуть из цепочки `queryClient.ensureQueryData(opts)`
  разрешено только если `isNetworkUsable()` (§1.7) **и** `queryClient.getQueryData(opts.queryKey) === undefined`;
  иначе — `getQueryData` + prefetch. Причина: ожидание paused-запроса (offline) вешает навигацию до reconnect.

staleTime по сущностям (задаётся в `queryOptions` сущности, не в компонентах):

| Сущность | queryKey | staleTime | Persist |
|---|---|---|---|
| self user | `['users','self']` | 5 мин | да |
| known users (друзья) | `['users','known']` | 60 с | да |
| premium promo | `['users','premiumPromo']` | 10 мин | нет |
| dashboard (балансы) | `['dashboard']` | 30 с | да |
| groups list | `['groups','list']` | 60 с | да |
| group detail (+ балансы группы) | `['groups','detail',id]` | 30 с | да |
| group activity previews | `['groups','activity',id]` (infinite) | 30 с | да, только первая страница |
| self activities / previews | `['activity','self',filters]` (infinite) | 30 с | да, только первая страница |
| activity children | `['activity','children',parentId]` | 60 с | да |
| ledger entry | `['ledger','entry',id]` | 30 с | да |
| currency rates | `['currencyRates']` | 6 ч (backend обновляет раз в 12 ч) | да |
| landing stats | `['stats']` | 10 мин | нет (публичное, уходит на Astro по D8) |
| health | не query | — | нет |

Infinite-запросы: при персисте обрезаются до первой страницы (`pages.slice(0,1)`, `pageParams.slice(0,1)`), иначе
кэш растёт неограниченно. У `dehydrateOptions` нет хука трансформации данных, поэтому обрезка — в обёртке персистера:
`trimmingPersister(base)` = `{ ...base, persistClient: c => base.persistClient(trimInfinitePages(c)) }`
(`shared/offline/queryPersister.ts`; `trimInfinitePages` узнаёт infinite по форме `{ pages, pageParams }`).

#### 1.3 Фабрика ключей

Конвенция: у каждой сущности файл `entities/<entity>/api/queries.ts`. Он экспортирует объект ключей и
функции `…QueryOptions`. Компоненты и loaders не пишут массивы ключей руками. Это проверяет lint:
`no-restricted-syntax` на литерал-массив в свойстве `queryKey` вне `entities/*/api/queries.ts`.

```ts
// entities/group/api/queries.ts
export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  detail: (groupId: string) => [...groupKeys.all, 'detail', groupId] as const,
  activity: (groupId: string) => [...groupKeys.all, 'activity', groupId] as const,
};
export const groupDetailQueryOptions = (groupId: string) => queryOptions({
  queryKey: groupKeys.detail(groupId), staleTime: 30_000,
  queryFn: ({ signal }) => api('get', '/groups/{groupId}', { params: { groupId }, signal }).then(toGroup) });
```

Правила: первый элемент ключа — сущность во мн. числе (`groups`, `users`, `ledger`, `activity`, `dashboard`,
`currencyRates`, `stats`), инвалидация сущности = `invalidateQueries({ queryKey: groupKeys.all })`; `queryFn`
возвращает **доменную модель** (маппер `toGroup` в `entities/<e>/model/`, деньги уже `Money`); хук
`useGroupQuery` в том же файле; производные значения — через `select`, а не zustand-селекторы; ESLint
`plugin:@tanstack/query/recommended`.

#### 1.4 Персистер кэша запросов

Файл `shared/offline/queryPersister.ts`.

```ts
export const queryCacheKey = (userId: string) => `chipin:rq:${userId}`;
const idbStringStorage: AsyncStorage<string> = { getItem: get, setItem: set, removeItem: del };  // idb-keyval, значения — строки
export const persistOptions = (userId: string) => ({
  persister: trimmingPersister(createAsyncStoragePersister({ key: queryCacheKey(userId), throttleTime: 1000,
    storage: idbStringStorage,
    serialize: persistCodec.stringify,          // JSON + тег bigint: Money.minor переживает запись (C1-05)
    deserialize: persistCodec.parse,
    retry: ({ error }) => { reportPersistFailed(error); return undefined; } })),   // иначе ошибка записи проглатывается
  maxAge: PERSIST_MAX_AGE,
  buster: `${QUERY_CACHE_EPOCH}:${MODEL_SHAPE_HASH}`,
  dehydrateOptions: { shouldDehydrateQuery: q => q.state.status === 'success' && q.meta?.persist !== false
                        && !isEntryWithPendingOp(q.queryKey),     // оптимистичный entry не персистим (2.2)
                      shouldDehydrateMutation: () => false },   // мутации персистит outbox (2.3)
});
```

Проверено по исходникам `5.105.0` (C1-05): `createAsyncStoragePersister` принимает только `storage: AsyncStorage<string>`,
`serialize: (c) => MaybePromise<string>` (по умолчанию `JSON.stringify`, который бросает на `BigInt`)
(`query-async-storage-persister/src/index.ts`); ошибка `serialize`/`setItem` ловится внутри `trySave` и без `retry`
молча теряется. Поэтому:
- `persistCodec` (`shared/offline/persistCodec.ts`): `stringify(c) = JSON.stringify(c, (_, v) => typeof v === 'bigint' ?
  { $bigint: v.toString() } : v)`, `parse(s) = JSON.parse(s, (_, v) => isBigintTag(v) ? BigInt(v.$bigint) : v)`;
  `isBigintTag` = объект ровно с одним ключом `$bigint` и строкой `^-?\d+$`. `WireAmount` (plain-объект, §4.1) проходит
  без тегов. Коллизии нет: доменные поля — camelCase без `$`. Тест: `Money { minor: 9999999999999999999n }` → persist → restore → `typeof minor === 'bigint'`,
  значение то же.
- `persistQueryClientRestore` при ошибке restore/deserialize **сам удаляет ключ кэша и бросает**
  (`query-persist-client-core/src/persist.ts:125-160`) — для кэша это приемлемо (сервер — источник), обёртка §1.6 ловит.
  Outbox этой функцией не восстанавливается никогда (§2.3).

- `persistOptions(userId)` и `clientFor(userId)` мемоизируются по `userId` (`useMemo` в `QueryProvider` / `Map` в модуле):
  новый объект персистера на каждый рендер = повторный restore.
- `isEntryWithPendingOp(key)`: ключ `['ledger','entry',id]` и `id` есть в `outboxState.entryIds` (§2.3). После
  `restoreOutbox` все `entryId` из outbox инвалидируются — persisted-кэш и outbox пишутся независимо, после краша
  они могут расходиться, сервер — арбитр. До 03-15a (outbox ещё нет) 03-7a экспортирует заглушку
  `isEntryWithPendingOp = () => false` из того же пути; 03-15a меняет реализацию, не путь (C2-08).

- Buster — **единственное** определение (C2-07, C3-14, C3-30): `${QUERY_CACHE_EPOCH}:${MODEL_SHAPE_HASH}`. Персистится
  доменная модель (результат мапперов), поэтому buster зависит от её формы, а не от OpenAPI-спеки:
  `MODEL_SHAPE_HASH` пишет `scripts/offline/write-model-hash.mjs` (вызывается из `api:gen`, расхождение ловит `api:check`):
  первые 12 hex sha256 от `entities/*/model/types.ts` (пути отсортированы, каждый файл перепечатан TypeScript printer с
  `removeComments: true` — комментарии и форматирование хэш не меняют) → `shared/offline/modelHash.generated.ts`.
  Смена формы доменного типа сбрасывает кэш автоматически (руками поднимать нечего); sync OpenAPI без изменения
  доменных типов кэш не сбрасывает. `QUERY_CACHE_EPOCH` (`shared/offline/constants.ts`, целое) поднимается руками
  только при смене **смысла** поля без смены типа (например, секунды → мс; пункт чек-листа PR, трогающего
  `entities/*/model/to*.ts`). `OPENAPI_SPEC_HASH`/`specHash.ts` не существуют. Отклонение от D4 («zod на кэше IDB»)
  вынесено в подтверждения владельца (00).
- `meta: { persist: false }` — premium promo, stats. Ошибка IDB (Safari private, квота) → Sentry
  `offline.persist_failed` раз за сессию, работа без персиста.

#### 1.5 Привязка к пользователю, logout, смена аккаунта

- `LocalUser` (`helpers/localStorage.ts`) получает `id: string`, чтение через zod `LocalUserSchema`
  (невалидно → fallback): `userId` нужен до restore, а офлайн `users/self` не загрузить.
- `app/providers/QueryProvider.tsx`: нет `userId` → `QueryClientProvider` без персиста; есть →
  `<QueryClientProvider key={userId} client={clientFor(userId)}>`, а restore/subscribe с `persistOptions(userId)` идёт вне
  React до создания роутера (§1.6, `bootstrapUserCache`). Два пользователя никогда не делят один `QueryClient`.
  `onRestored` резолвит `restoreReady` (§1.6). Outbox восстанавливает и запускает **только вкладка-лидер** при получении
  lock (§2.3): `restoreOutbox(client, userId).then(() => client.resumePausedMutations())`.
- `clearUserData(userId)` (`shared/offline/clearUserData.ts`), строго в этом порядке: (1) отписать персистер
  (unsubscribe из `persistQueryClientSubscribe`/провайдера) и подписчика outbox на `mutationCache`, выйти из
  leader-lock (§2.3); (2) `queryClient.clear()`; (2a) `resetAuthScopedStores()` — все ещё живые legacy zustand-сторы
  **и** черновик `expenseModalStore.reset()` (C1-02: иначе между 03-7b и 03-12 Y увидит группы/балансы/друзей X из
  `groupsStore`/`users-store`/`dashboardStore` и отправит черновик X); (3) `del` query-ключа, `chipin:outbox:<userId>`,
  `chipin:outbox-failed:<userId>`, `chipin:outbox-inbox:<userId>`; (4) размонтировать провайдер (смена `key`). Иначе
  throttled-запись (1 с) или событие `mutationCache` после `del` возвращают данные X. В `LS_KEY_USER` остаётся только
  `{ settings }` (без `id`/`role` — как `clearLocalUserRole` из 01-1: язык/тема лендинга после выхода читаются из `settings`).
- `resetAuthScopedStores()` (`store/authStore.ts:46-53`) **остаётся** до конца миграции и по-прежнему вызывается при
  **любом** переходе в `unauthenticated` (как сегодня: `setUnauthenticated`, `expireSession`, ошибка OAuth exchange) —
  legacy-сторы держат данные в памяти и перезагружаются после входа. Каждый PR миграции стора (03-8…03-12, 03-18)
  удаляет **свою** строку из `resetAuthScopedStores` вместе со стором (тест PR: строки нет, стора нет). Единственное
  изменение 03-7b: строка `useExpenseModalStore.getState().reset()` переезжает из `resetAuthScopedStores` в шаг (2a)
  `clearUserData`; черновик получает поле `ownerId` и при входе пользователя ≠ `ownerId` сбрасывается.

Таблица «причина → что удаляется» (C3-08; реальные константы `store/authConstants.ts:9-16`). `clearUserData` вызывают
**только** строки с ним; любая другая причина ничего пользовательского в IDB не удаляет. Тест — на каждую строку.

| Переход (код сегодня) | `unauthReason` | Кэш запросов (IDB) | Outbox / failed / inbox | Черновик | `LS_KEY_USER` |
|---|---|---|---|---|---|
| `signOut()` в этой вкладке (`authStore.ts:164`) | `signed_out` | `clearUserData` | удалить; непустой outbox → confirm «N неотправленных операций будут удалены» | сброс | `{ settings }` |
| remote logout по BroadcastChannel (`useCheckSignIn.tsx:41-52`) | `signed_out` | `clearUserData` | удалить (confirm был в вкладке-инициаторе) | сброс | `{ settings }` |
| `expireSession()` (refresh 401: `authStore.ts:69,128`, `bootstrap/initializeApi.ts:6`); `logoutOtherDevices` → 401 (`authStore.ts:155`) | `expired` | сохранить | сохранить, гейт `auth` закрыт | сохранить | удалить только `role` (`clearLocalUserRole`, 01-1) |
| `invalid` (зарезервирована, `useAuthToasts.tsx:23`) | `invalid` | сохранить | сохранить, гейт `auth` | сохранить | удалить только `role` |
| холодный старт без session hint (`useCheckSignIn.tsx:64`) | `missing` | сохранить (без входа не восстанавливается) | сохранить | сохранить | без изменений |
| refresh при старте упал не 401 (`useCheckSignIn.tsx:89`); ошибка OAuth exchange (`authStore.ts:100-122`, `OAuthCallbackPage.tsx:37`) | `error` / `persistence_error` | сохранить | сохранить | сохранить | без изменений |
| вход Y при `LocalUser.id === X ≠ Y` или `sub` токена ≠ владелец outbox (§2.3) | — (после входа) | `clearUserData(X)` | удалить; непустой → диалог «На устройстве N неотправленных операций аккаунта X. Удалить и войти?»; «Отмена» → `signOut()` Y, данные X остаются | сброс | `{ id: Y, settings }` |

- **Истечение сессии ≠ logout** (finding 11, `02-routing-state-pwa.md:22`): кэш, outbox и черновик сохраняются,
  показывается `AuthModal`, после входа тем же `userId` очередь продолжается (гейт `auth` открывает только проверка
  владельца, §2.3). Legacy-сторы сбрасываются (см. выше) и перезагружаются после входа.
- Session hint после expiry: `invalidateAuthSession()` пишет hint `false` (`helpers/authSession.ts:46-55`), поэтому
  **офлайн-холодный старт после истечения сессии невозможен** — осознанно (C3-09): после «выйти на других устройствах»
  потерянное устройство не показывает финансы без сети; кэш и outbox остаются в IDB и продолжаются после онлайн-входа тем
  же `userId`. Скрытие данных под `AuthModal` онлайн — спека 04 §2.3. Различение REVOKED/EXPIRED на backend и
  `clearUserData` при REVOKED — вопрос владельцу (00, «Подтверждения»); до решения backend-issue не создаётся.

#### 1.6 Гейт гидрации при старте

- Restore выполняется **до** создания роутера, вне React: `shared/offline/restore.ts` экспортирует
  `restoreReady: Promise<void>` = restore **кэша запросов** (`persistQueryClientRestore`). Промис резолвится и при
  таймауте 3 с, и при ошибке IDB/десериализации (Sentry `offline.restore_timeout` / `offline.persist_failed`) — никогда
  не reject. До 03-7a (спека 04, 04-2a2) тот же путь экспортирует `restoreReady = Promise.resolve()`. Все loaders
  (спека 04) возвращают цепочку `restoreReady.then(…)` (стиль свободный, D24); data router запускает начальные loaders при `createBrowserRouter`,
  до первого рендера, поэтому React-гейт `useIsRestoring()` один не спасает.
- После таймаута restore кэша **отменяется**: флаг `restoreAborted = true`, поздний результат IDB игнорируется (не
  делает `hydrate`), иначе он перезапишет данные, загруженные после старта.
- **Outbox восстанавливается отдельно и не входит в `restoreReady`** (C3-02): лидер (§2.3) держит
  `outboxRestore: 'pending' | 'ok' | 'failed'`. Таймаута нет — restore идёт до конца. Инвариант: **пока
  `outboxRestore !== 'ok'`, ключ `chipin:outbox:<userId>` не пишется никогда** (ни подписка на `mutationCache`, ни
  `persistNow`), а новые операции идут онлайн-путём (§2.1: `offlineWritesAvailable === false`, офлайн — `<OnlineOnly>`).
  `failed` (ошибка IDB, ключ целиком не проходит `OutboxStateSchema`, `owner !== userId`) → офлайн-запись выключена до
  перезапуска, неблокирующий баннер `offline:outboxUnavailable` «Офлайн-сохранение недоступно. Операции на устройстве
  сохранены — перезапустите приложение», ключ **не удаляется**, Sentry `outbox.restore_failed`. Отдельные невалидные
  операции → failed `unreadable`, restore при этом `ok`.
- Поэтому провайдер — обычный `QueryClientProvider` (не `PersistQueryClientProvider`, который стартует restore сам при mount): `bootstrapUserCache(userId)` = `persistQueryClientRestore` → `persistQueryClientSubscribe` (unsubscribe хранится для `clearUserData`), `onRestored` из §1.5 — его продолжение. Пока `restoreReady` не резолвлен, рендерится shell (header + skeleton), не роуты (`useRestoreReady()` вместо `useIsRestoring()`).
- Офлайн-холодный старт (PR 03-7b): `useCheckSignIn` (`hooks/useCheckSignIn.tsx:55-91`) при network error на refresh и
  наличии `LocalUser.id` + session hint `=== true` (hint хранится как JSON `true`/`false`, `helpers/localStorage.ts`)
  ставит `AUTHENTICATED` + новое поле `sessionMode = 'offline-cached'`; guards (спека 04 §2.3, `requireSession`) пускают к
  кэшу. При reconnect `refreshAuthSession()`: 401 → `expireSession()`; успех → `sessionMode = 'online'`. Гейт outbox `auth`
  открывает **не** успешный refresh, а проверка владельца (§2.3: `sub` нового access-токена === `userId` outbox).
  До 03-15a `outboxGate` — no-op-заглушка из `shared/offline/outboxGate.ts` (тот же путь).

#### 1.7 Refetch на focus/reconnect

- `focusManager` (`visibilitychange`) закрывает «PWA открыт днями со старыми балансами».
- **Единственный источник «сеть пригодна» — TanStack `onlineManager`** (C1-06): `shared/offline/network.ts` экспортирует
  `isNetworkUsable = () => onlineManager.isOnline()` и `waitForOnline()`. Спека 04 (await-правило loaders, офлайн-ветка
  auth-guards), `connectivityStore`, `useRequiresOnline()` и outbox читают только их. `navigator.onLine` читается только
  внутри `shared/offline/**` (bootstrap и probe ниже); lint `no-restricted-properties` `{ object: 'navigator', property:
  'onLine' }` вне `shared/offline/**` (правило регистрируется в 02 §Д0, класс «корректность», подсказка «используй
  isNetworkUsable()»).
- `onlineManager`: v5 стартует с `online = true`; при bootstrap — `onlineManager.setOnline(navigator.onLine)`, затем
  probe ниже (иначе офлайн-холодный старт не паузит запросы до первого события `offline`).
- Дефолтные события + network error при `navigator.onLine === true` → `GET /health`
  (таймаут 5 с); неудача → `setOnline(false)` и проверка каждые 15 с (captive portal, «Wi-Fi без интернета»).

#### 1.8 Офлайн vs backend down

Новая классификация в `shared/api/errors.ts` (заменяет `isLikelyBackendOutageError`):

| Ситуация | Классификация | UI |
|---|---|---|
| `!isNetworkUsable()` или network error + `/health` тоже network error | `offline` | баннер «Нет сети. Показаны сохранённые данные» (неблокирующий), offline-only действия разрешены |
| online, ответ 502/503/504, `/health` отвечает 5xx | `backend-down` | текущий `BackendUnavailablePage` |
| online, одиночный 500 на конкретный запрос, `/health` = 200 | `request-error` | ошибка запроса (toast / errorElement роута) |
| 4xx | `client-error` | обработка в месте вызова |

- `backendAvailabilityStore` → `connectivityStore` (zustand): `{ mode: 'online' | 'offline' | 'backend-down' }`;
  `offline` выводится из подписки на `onlineManager` (не хранит свою копию сетевого флага).
  Interceptors больше не импортируют store (V5, `01-architecture.md:53`), а зовут колбэк `onConnectivityChange`
  из `app/bootstrap`.
- `BackendUnavailableGate` — только при `backend-down`; при `offline` — `<OfflineBanner/>` в
  `InternalPageLayout`; тост `useCheckOnlineStatus` (`hooks/pwaHooks.tsx:23-54`) удаляется.

### 2. Мутации и outbox

#### 2.1 Mutation defaults

Слои (граф спеки 02 Д5): `entities/**` и `shared/offline/**` **не импортируют `store`** (`entities → store` запрещён).
`userId`, `sessionMode` и прочее из сторов передаются аргументом (`registerLedgerMutationDefaults(client)`,
`clientFor(userId)`) или колбэком из `app/bootstrap`; вызовы `outboxGate.open/close` делает `store`/`app`, не наоборот.

`entities/ledger/api/mutations.ts` → `registerLedgerMutationDefaults(client)`, вызывается в `createQueryClient()`
**до hydrate**: иначе у восстановленных мутаций нет `mutationFn` и `resumePausedMutations` их не выполнит.
**Все** lifecycle-колбэки (`onMutate`, `onError`, `onSuccess`, `onSettled`) живут здесь же, в defaults: колбэки,
переданные в `useMutation`/`mutate()`, после reload теряются. Хуки `useCreateExpense()` и т.д. передают только
`mutationKey`; переопределять `scope`, `retry`, `mutationFn` и колбэки в хуке запрещено (тест §8 проверяет
`mutation.options.scope.id === OUTBOX_SCOPE` и `retry === false` у созданной хуком мутации).

Два набора ключей, у каждого свои defaults (C1-10); третьего пути нет:

```ts
// Outbox: только расходы (D2). Замороженный контракт после 03-17 (m9): ключи не переименовывать.
export const ledgerOutboxMutationKeys = { createExpense: ['ledger','outbox','createExpense'],
  updateExpense: ['ledger','outbox','updateExpense'], deleteExpense: ['ledger','outbox','deleteExpense'] } as const;
// Онлайн: любой вид записи (expense и settlement), без outbox. Используется, когда offline-запись недоступна,
// и всегда — для settlement (C2-02).
export const ledgerOnlineMutationKeys = { createEntry: ['ledger','online','createEntry'],
  updateEntry: ['ledger','online','updateEntry'], deleteEntry: ['ledger','online','deleteEntry'] } as const;
for (const key of Object.values(ledgerOnlineMutationKeys)) client.setMutationDefaults(key, {
  mutationFn: runOnlineLedgerOp,   // api() напрямую; тело — те же мапперы toXWire()
  networkMode: 'online', retry: false, onSettled: invalidateAfterLedgerOp });
client.setMutationDefaults(ledgerOutboxMutationKeys.createExpense, {
  mutationFn: (op: CreateExpenseOp) => runOutboxOp(op),
  scope: { id: OUTBOX_SCOPE },   // 'outbox' — одна мутация за раз, строго по порядку постановки
  networkMode: 'always',         // ожидание сети/гейта — внутри runOutboxOp (2.4), не в retryer TanStack
  retry: false,                  // единственный механизм повторов — цикл runOutboxOp (2.4)
  // Отклонение от буквы D3 (offlineFirst + paused): пауза TanStack срабатывает только между ретраями и не знает
  // про гейт; ожидание в runOutboxOp покрывает и сеть, и auth/426. Restore по-прежнему через hydrate (isPaused=true)
  // + resumePausedMutations(). Пункт подтверждения владельца в 00 (C1-16a/C3-27); 03-15a не стартует до него.
  onMutate, onError, onSettled,  // 2.2
  meta: { outbox: true } });
```

Выбор пути — одна функция на действие, хуки компонентов передают только её результат (тест обеих веток):
`useCreateExpense()`, `useUpdateLedgerEntry(entry)`, `useDeleteLedgerEntry(entry)` в `entities/ledger/api/mutations.ts`
берут outbox-ключ, **только если** `offlineWritesAvailable` (§2.7) **и** `entry.type === 'EXPENSE'` (для create — всегда
расход); иначе — онлайн-ключ (офлайн его кнопка обёрнута `<OnlineOnly>`, §2.9).

**Реестр операций — guard «только расходы» (C2-02).** `enqueueOutboxOp(op)` (`shared/offline/outboxRegistry.ts`, лидер) —
единственный вход в outbox; `OUTBOX_OPS: Record<OutboxKind, { entryKind: 'expense' }>`. Для `updateExpense`/`deleteExpense`
он требует `ledger.entry(entryId)` в кэше с `type === 'EXPENSE'`; нет записи в кэше или другой тип → throw
`OnlineOnlyError` (операция не создаётся, UI показывает «Нужно подключение»). Settlement/платёж в outbox попасть не может ни
из UI, ни из `command` вкладки-последователя (лидер повторяет ту же проверку). zod `OutboxOpSchema` требует
`entryKind: 'expense'` — persisted-операция другого вида при restore → failed `unreadable`.

`variables` — сериализуемый `OutboxOp` (JSON-примитивы; суммы — `WireAmount` (plain-объект `{ __wireDecimal }`, §4.1)
через `moneyToWire`):

```ts
type OutboxOpBase = { opId: string; seq: number; owner: string; entryKind: 'expense'; createdAt: number; schema: 1 };
type CreateExpenseOp = OutboxOpBase & { kind: 'createExpense'; entryId: string; groupId: string | null; draft: ExpenseDraftWire };
type UpdateExpenseOp = OutboxOpBase & { kind: 'updateExpense'; entryId: string; baseVersion: string | null; patch: ExpensePatchWire };
type DeleteExpenseOp = OutboxOpBase & { kind: 'deleteExpense'; entryId: string; baseVersion: string | null };
```

- `seq` (C2-16) — монотонный номер, который присваивает **лидер** при `enqueueOutboxOp` из счётчика `nextSeq`
  persisted-ключа (§2.3); последователь шлёт операцию без `seq`. Порядок очереди везде (restore, hydrate, overlay) —
  по `seq`; `createdAt` (часы устройства) используется только для 14-дневного `stale` (§2.8).
- `owner` = `userId` владельца outbox; проверяется перед каждой отправкой (§2.3).

Версия (opaque-строка, BE-03-1) разрешается **внутри outbox**, не из query-кэша:
- `baseVersion` при постановке = версия из кэша `ledger.entry(id)`; `null` — если в очереди есть неотправленный create
  того же `entryId` (версии ещё нет).
- `outboxVersions: Map<entryId, version>` (в памяти лидера + в persisted outbox, §2.3): после успеха любой операции
  с `entryId`, если в очереди остались операции того же `entryId`, — `set(entryId, response.version)`, иначе `delete`.
  «Оставить мою» в `ConflictDialog` тоже пишет `current.version`.
- При отправке: `effective = outboxVersions.get(entryId) ?? op.baseVersion` (запись карты приоритетна — это наша
  последняя запись). `effective === null` → терминальный `conflict` (GET `ledger.entry(id)` даёт `current`).
  PATCH/DELETE **без** `If-Match` из outbox не отправляются никогда.

#### 2.2 Оптимистичные обновления и откат

Activity — серверная проекция событий (`api/activity.types.ts`); подделывать события хрупко. Поэтому
**оптимистичное состояние — оверлей из очереди, а не запись в серверные кэши**:
- `useOutboxOverlay()` читает `outboxState` (§2.3; во вкладке-лидере его пишет подписка на `mutationCache`, в
  остальных — сообщения лидера) → `{ pendingCreates, pendingUpdatesByEntryId, pendingDeletes, failed, statusByOpId }`.
  В ленте: сверху блок «Не отправлено»; `entryId ∈ pendingDeletes` — зачёркнуто, «будет удалено»; pending update —
  «изменено, не отправлено» (`entryId` есть в activity, `api/activity.types.ts:51,95`). Откат автоматический:
  мутация ушла — оверлей пересчитан.
- `['ledger','entry',id]`: `onMutate` (в defaults) — `cancelQueries` + `setQueryData` оптимистично; snapshot **не**
  используется. `onError` (только терминальные ошибки, 2.4) → `invalidateQueries(ledger.entry(id))`: persisted
  snapshot после reload может быть на дни старше сервера. `onSettled` → `invalidateAfterLedgerOp(client, op)`:
  `ledger.entry(id)`, `groupKeys.detail/activity(groupId)`, `['activity']`, `['dashboard']`, `['users','known']`.
  Этот список заменяет fan-out `groupsStore.ts:133-155`; вкладки-последователи вызывают ту же функцию по сообщению
  `settled` от лидера. После reload `onMutate` не перезапускается — достаточно оверлея и инвалидации из §1.4.

#### 2.3 Персист outbox и вкладки: один писатель на пользователя

Файлы `shared/offline/outboxLeader.ts`, `outboxPersistence.ts`, `outboxChannel.ts`, `outboxInbox.ts`.
- **Лидер.** Каждая вкладка с `userId` вызывает
  `navigator.locks.request('chipin-outbox:<userId>', () => leaderSession())`, где `leaderSession` возвращает промис,
  резолвящийся только при logout/смене пользователя/unload. Вкладка, чей колбэк выполняется, — **единственный писатель**:
  восстанавливает, исполняет и персистит очередь. Остальные стоят в очереди за lock; при закрытии лидера браузер
  отдаёт lock следующей вкладке, она делает `restoreOutbox` из того же ключа — сирот и их адопции нет.
- **Один ключ** `chipin:outbox:<userId>` = `OutboxState { owner: userId, epoch: number, nextSeq: number,
  mutations: DehydratedState['mutations'], versions: Record<entryId, version>, cancelled: opId[] }` (zod
  `OutboxStateSchema`, §5.7). Запись — только лидер, только при `outboxRestore === 'ok'` (§1.6), по событиям
  `mutationCache` для `meta.outbox`: `dehydrate(client, { shouldDehydrateQuery: () => false, shouldDehydrateMutation:
  m => m.meta?.outbox === true && m.state.status === 'pending' && !cancelled.has(opId(m)) })` — **только `pending`**
  (C3-05: `error`-мутация после hydrate не paused и никогда не возобновится; failed живут в своём ключе). `pending`
  пишется с `isPaused = true` (иначе in-flight после hydrate «висит»). Failed — `chipin:outbox-failed:<userId>` (2.5).
- **Фенсинг (C3-06).** Каждая запись — `idb-keyval` `update(key, prev => …)` (одна readwrite-транзакция): если
  `prev.epoch !== myEpoch`, updater возвращает `prev` без изменений и помечает «лидерство потеряно» — вкладка немедленно
  перестаёт быть писателем (§ ниже). Новый лидер первым действием делает `update(key, prev => ({ ...prev, epoch:
  prev.epoch + 1 }))` и восстанавливает очередь из этого значения.
- **Последователи** (вкладки без lock) — read-only вид очереди: `outboxState` из сообщений лидера по
  `BroadcastChannel('chipin-outbox:<userId>')` (`state` при каждом изменении; при старте последователь шлёт
  `state-request`, а до ответа показывает содержимое IDB-ключа). Новая операция или действие из `OutboxSheet`
  («Повторить», «Отменить», решение конфликта) в последователе: (1) запись в **IDB-inbox** `chipin:outbox-inbox:<userId>`
  (`update`, map по `opId`) — с этого момента операция на устройстве не теряется, тост «Сохранено, отправим при
  появлении сети» показывается после этой записи; (2) сообщение `command { opId }` лидеру. Лидер забирает inbox при
  старте и по каждому `command`: `enqueueOutboxOp` (присваивает `seq`) → персист → удаляет запись inbox → `ack { opId }`.
  Дедупликация по `opId` (уже в `mutationCache`, в persisted или в failed → только удалить из inbox и `ack`).
  Сообщения — zod `OutboxChannelMessageSchema` (§5.7).
- **Замороженный лидер (C3-06).** Лидер шлёт `heartbeat { epoch }` каждые 2 с. Если у видимой
  (`document.visibilityState === 'visible'`) вкладки-последователя есть запись inbox без `ack` 5 с **и** heartbeat не
  приходил 5 с, она вызывает `navigator.locks.request(name, { steal: true }, leaderSession)` и становится лидером (epoch+1,
  restore, забирает inbox). Скрытая вкладка не крадёт lock. Без `ack` 10 с — тост `offline:saveDelayed` «Сохранено на
  устройстве, отправка начнётся, когда приложение снова станет активным» (операция в inbox, не потеряна).
  Бывший лидер после разморозки: его промис lock отклоняется (`AbortError`) **или** фенсинг в `update` срабатывает — он
  ставит `isLeader = false`, отписывает персист, его `runOutboxOp` на ближайшей проверке резолвится `leadershipLost`
  без запроса (2.4) и переходит в режим последователя. Уже отправленный им запрос безопасен благодаря идемпотентности
  (BE-03-1 `X-Client-Op-Id`, BE-03-2 `id`, DELETE удалённого = 204).
- **Привязка к аккаунту (C3-07).** Ключи и lock содержат `userId`; `OutboxState.owner` проверяется при restore
  (`owner !== userId` → `outboxRestore = 'failed'`). Гейт `auth` при старте лидера **закрыт** и открывается только когда
  `sessionUserId() === owner`, где `sessionUserId()` = `sub` текущего access-токена (backend: `JwtTokenService.kt:29`
  `withSubject(userId)`; декод без проверки подписи, только для сравнения). Проверка повторяется на каждом обновлении
  токена (колбэк interceptor `onAccessTokenChanged`) и синхронно **непосредственно перед каждой** отправкой
  (`sendOutboxOp`). Несовпадение → `outboxGate.close('auth')` + поток смены аккаунта (§1.5); операции X никогда не
  уходят с токеном Y (например, Y вошёл в соседней вкладке, а refresh cookie общая).
- `restoreOutbox(client, userId)` (только лидер): ключ → `OutboxStateSchema` → каждая `variables` → zod `OutboxOpSchema`
  (union по `kind`, `schema` для миграций), невалидные → failed `unreadable`; пропуск `opId` из `cancelled`, из
  failed-ключа (C3-05: после краша между записью failed и перезаписью outbox операция может быть в обоих — failed
  приоритетен) и уже присутствующих в `mutationCache` (идемпотентно при remount/StrictMode); **сортировка по `seq`**;
  `hydrate`; восстановление `outboxVersions`; если есть failed — гейт закрыт по `blocked` **до**
  `resumePausedMutations()`; затем забрать inbox; `outboxRestore = 'ok'`.
- Повтор in-flight операции после смены лидера/reload безопасен по D5: create идемпотентен по `id` (BE-03-2), delete
  удалённого = 204, PATCH несёт `X-Client-Op-Id: <opId>` — повтор уже применённой операции backend отвечает 200 с
  текущей записью до проверки `If-Match` (BE-03-1, §7), глубокое сравнение `current` с `patch` не нужно.
- **Нет `navigator.locks` или `BroadcastChannel`** (старые браузеры): офлайн-запись выключена
  (`offlineWritesAvailable = false`), создание/правка/удаление расходов — только онлайн, как до 03-17; чтение кэша
  офлайн работает. Выборы лидера через `localStorage`/`storage`-события не делаем (гонка check-then-act).

#### 2.4 Порядок и гейт

- `scope: { id: 'outbox' }` — TanStack v5 запускает следующую мутацию scope только после того, как предыдущая
  **settled** (success или error), и в порядке постановки; после reload — в порядке hydrate (= `seq`). Поэтому порядок
  держится на одном правиле: **`runOutboxOp` settle-ится только успехом, no-op-результатом или терминальной ошибкой**;
  всё нетерминальное ждёт внутри него, мутация остаётся pending во главе scope и ничто её не обгоняет.
- **`mutationCache.remove()` на pending outbox-мутации запрещён** (C3-04). Проверено в `query-core@5.105.0`
  `mutationCache.ts`: `remove` только вырезает мутацию из scope, работающий `mutationFn` продолжается, а `canRun` (первая
  `pending` в scope) тут же пускает следующую — `resumePausedMutations` запустит её параллельно с «удалённой».
  Отмена — только через `cancelledOpIds` (2.5); settled-мутации убирает gc.
- `outboxGate` (`shared/offline/outboxGate.ts`) — **в памяти** лидера: `close(reason)`, `open(reason)`,
  `whenOpen(opts?): Promise<void>`, причины `auth | outdated | blocked`. Персистентные данные (failed-ключ) лишь
  восстанавливают `blocked` при restore; решение «можно ли отправлять» никогда не читается из IDB.

```ts
// Стиль свободный (D24); здесь: повтор = рекурсивный вызов из .catch, не цикл.
function runOutboxOp(op: OutboxOp, opts?: { ignore?: GateReason[] }, attempt = 0): Promise<OutboxResult> {
  const retry = (): Promise<OutboxResult> => runOutboxOp(op, opts, attempt + 1);
  const noOp = (): OutboxResult | null =>            // проверка после каждого await и прямо перед отправкой
    !isLeader() ? LEADERSHIP_LOST : isCancelled(op.opId) ? CANCELLED : null;
  return outboxGate.whenOpen(opts)                    // auth / outdated / blocked
    .then(() => waitForOnline())                      // shared/offline/network.ts (§1.7)
    .then(() => {
      const skip = noOp(); if (skip) return skip;     // discard / потеря лидерства: ни одного запроса
      if (sessionUserId() !== op.owner) { outboxGate.close('auth'); return retry(); }   // C3-07
      setStatus(op.opId, 'sending'); return sendOutboxOp(op);   // 2xx и «успех-no-op» строки таблицы 2.5
    })
    .catch((error: unknown) => {                      // retry() возвращается из catch — его reject сюда не попадает
      const c = classifyOutboxError(error);           // таблица 2.5
      if (c.kind === 'network') { setStatus(op.opId, 'waiting-network'); return retry(); }
      if (c.kind === 'transient') { setStatus(op.opId, 'server-unavailable'); return sleep(backoff(attempt)).then(retry); }
      if (c.kind === 'auth' || c.kind === 'outdated') { outboxGate.close(c.kind); return retry(); }
      outboxGate.close('blocked');                    // синхронно, ДО записи — следующая операция встанет на whenOpen
      return recordFailed(op, c)                      // C3-05: память + IDB failed-ключ, запись ДОЖИДАЕМСЯ
        .then(() => { throw new OutboxTerminalError(c); },
              () => { setStatus(op.opId, 'failed-unsaved'); reportPersistFailed(); return retry(); });
      // запись failed не удалась → операция остаётся pending во главе scope (persisted outbox её содержит),
      // гейт blocked; действия OutboxSheet работают с записью в памяти. Никогда «ни в outbox, ни в failed».
    });
}
const backoff = (n: number) => Math.min(1000 * 2 ** n, 60_000) * (0.8 + Math.random() * 0.4);
```

`CANCELLED`/`LEADERSHIP_LOST` — успешные результаты без побочных эффектов: `onSettled` в defaults по ним не инвалидирует
кэш и не трогает `outboxVersions`.

Единая политика повторов (заменяет прежние `outboxRetry`/`retry: outboxRetry`):

| Класс | Ответы | Поведение | Статус в UI |
|---|---|---|---|
| `network` | network error, timeout | ждать `online`, повтор сразу | «ждёт сети» |
| `transient` | 5xx, 409 `SYSTEM.CONFLICT` | backoff 1 с → 60 с ±20 %, бесконечно | «сервер недоступен, повторим» |
| `auth` | 401 после неудачного refresh (interceptor уже вызвал `expireSession()`); `sub` токена ≠ `owner` | гейт `auth`; открывает только проверка владельца (2.3) | «нужно войти» |
| `outdated` | 426 `CLIENT.OUTDATED` | гейт `outdated`; экран обновления (03-20) | «нужно обновить приложение» |
| терминальный | 400/422, 403, 404 PATCH, 409 `LEDGER.VERSION_CONFLICT`, 409 `LEDGER.ID_CONFLICT`, неизвестная версия | гейт `blocked`, failed (запись дождались), throw | причина failed |

Запросы TanStack-**queries** используют свою политику `queryRetry` (§1.2); у outbox-мутаций `retry: false`.

#### 2.5 Обработка ошибок

409 различается **по `code`**, не по статусу: `SYSTEM.CONFLICT` — транзиентный (повтор), `LEDGER.VERSION_CONFLICT` —
конфликт версий (UI), `LEDGER.ID_CONFLICT` — ошибка данных.

| Ответ | Действие |
|---|---|
| 2xx | успех; `setQueryData` для entry из ответа (включая новую `version`), обновить `outboxVersions` (2.1) |
| network | ждать сети (2.4), операция pending |
| 5xx, 409 `SYSTEM.CONFLICT` | backoff (2.4), операция pending |
| 401 | interceptor делает refresh. Если refresh не удался → `expireSession()`, гейт `auth`, операция pending (не failed) |
| 400 / 422 (валидация) | failed `validation`, гейт `blocked` |
| 403 (нет доступа к группе / исключён) | failed `forbidden`, гейт `blocked` |
| 404 на PATCH | failed `deletedRemotely`, гейт `blocked` |
| 404/204 на DELETE | успех |
| 409 `LEDGER.VERSION_CONFLICT` | failed `conflict`, `current` из тела `LedgerConflictResponse` (BE-03-1, парсится zod), гейт `blocked` |
| 409 `LEDGER.ID_CONFLICT` на create | failed `idConflict` (не должно случаться; Sentry), гейт `blocked` |
| 410 `LEDGER.ENTRY_DELETED` на create-дубль | успех-no-op, убрать из оверлея |
| 426 `CLIENT.OUTDATED` | гейт `outdated`, операция pending, экран обновления |

Failed-операция пишется в `chipin:outbox-failed:<userId>` (zod-схема `FailedOpSchema = { op: OutboxOp, reason,
current?: LedgerEntry, failedAt }`) **до** того, как мутация settle-ится ошибкой и уходит из persisted outbox (2.4).
**Любая failed-операция блокирует очередь** (гейт `blocked`): следующие могут зависеть от неё (правка того же расхода).

`features/offline-queue/OutboxSheet.tsx` (из баннера/бейджа в header): pending со статусом из `statusByOpId`
(«ждёт сети» / «отправляется» / «сервер недоступен» / «нужно войти» / «нужно обновить») и failed с причиной.
Действия failed: «Повторить» (кроме `conflict`), «Отменить операцию», для `conflict` — «Разобраться» (2.6), для
`deletedRemotely` — «Создать как новый расход». «Повторить» вызывает `runOutboxOp(op, { ignore: ['blocked'] })`
**напрямую, вне scope** (ждёт `auth`/`outdated`, но не `blocked`) — остальные операции стоят на `whenOpen`, ничто не
обгоняет; успех → операция убрана из failed, и если failed пуст — `outboxGate.open('blocked')`.

**Отмена (discard), C2-15/C3-04** — одна функция `discardOps(opIds)` у лидера (в последователе — `command`):
одной `update`-записью добавляет `opIds` в `OutboxState.cancelled` и убирает их из `mutations`/failed; затем
`cancelledOpIds` в памяти. Отменённая операция, где бы она ни ждала (`whenOpen`, `waitForOnline`, backoff), на ближайшей
проверке резолвится `CANCELLED` **без запроса**; следующая операция стартует только после её settle (порядок scope
сохраняется). Операция в статусе `sending` (запрос уже ушёл) отмене не подлежит — кнопка скрыта до ответа.
- Discard pending (в т.ч. головы очереди): `discardOps([opId])`.
- Discard failed **create**: `discardOps([createOpId, …все pending/failed с тем же `entryId`])` — зависимые правки и
  удаление того же клиентского id отменяются вместе с ним (подтверждение «и N связанных правок»); ни один PATCH/DELETE
  на несуществующую запись не уходит.
- Discard failed update/delete: только эта операция; последующие операции того же `entryId` остаются (их версия — из
  `outboxVersions`/`baseVersion`, конфликт ловит backend).
- После discard: failed пуст → `outboxGate.open('blocked')`. `cancelled` чистится от `opId`, когда его мутация settled.

#### 2.6 Конфликт 409

`ConflictDialog` (`features/offline-queue/`): «Расход изменили на другом устройстве», таблица отличающихся
полей (сумма, валюта, описание, дата, плательщик, участники, деление, категория), «Ваша версия» / «Сейчас на
сервере». «Оставить мою» — повтор с `baseVersion = current.version` (осознанный last-write-wins, напрямую);
«Взять с сервера» — `discardOps` (2.5) + `setQueryData(entry, current)`. Delete-конфликт: «Удалить всё равно» / «Не
удалять». Пока конфликт не разобран, гейт закрыт.

#### 2.7 Client UUID, create и capabilities backend

`entryId = crypto.randomUUID()` создаётся при открытии формы (повторный сабмит несёт тот же id). Поле `id` в теле
`POST /ledger/entries` backend до BE-03-2 отвергает **400** (неизвестное поле), поэтому:
- Источник правды — runtime-capabilities: `GET /health` → `{ status: "UP", capabilities: string[] }` (поле вводит
  первый влитый из BE-03-1/2/5; контракт §7.0): `"ledger.clientEntryId"` (BE-03-2), `"ledger.entryVersion"` (BE-03-1),
  `"client.minVersion"` (BE-03-5).
  FE: `capabilitiesQueryOptions` (`['meta','capabilities']`, staleTime 10 мин, persist да, `queryFn` = тот же `/health`;
  нет поля → `[]`). `useBackendCapability(name)` — единственный читатель.
- Тело create строит одна функция `toCreateLedgerEntryWire(draft, { clientEntryId })`; `id` кладётся, **только** если
  в момент отправки есть `ledger.clientEntryId`. Без него create — **только онлайн** (`ledgerOnlineMutationKeys.createEntry`, 2.1;
  `<OnlineOnly>` на кнопке сохранения в офлайне), id не отправляется. Поле `id` в типах появляется только после
  синхронизации OpenAPI с релизом backend, где оно есть (§5.3), — со старым снимком код с `id` не компилируется.
- `offlineWritesAvailable = VITE_FEATURE_OFFLINE_WRITES && capabilities ⊇ {ledger.clientEntryId, ledger.entryVersion,
  client.minVersion} && navigator.locks && BroadcastChannel && outboxRestore === 'ok' && !persistFailedThisSession`
  (§1.6, §2.3, §2.8). Отдельного `VITE_FEATURE_CLIENT_ENTRY_ID` нет.
- Откат backend после того, как capability закэширована: create с `id` → 400 → failed `validation`; следующий
  `/health` (refetch на focus/reconnect) снимает capability. Приемлемо, Sentry `outbox.capability_mismatch`.

#### 2.8 Лимиты

- Максимум **50** pending+failed на пользователя; дальше офлайн-создание/правка выключены («Слишком много
  неотправленных операций — подключитесь к сети»).
- Старше **14 дней** по `createdAt` (refresh token 30 дней, `application.yaml:18`) → failed `stale` («Отправить всё
  равно» / «Отменить»), без автоудаления. Лимиты и `stale` — PR 03-15b.
- **Надёжность хранения (C3-10).** Первая офлайн-операция вызывает `navigator.storage.persist()` (один раз за сессию);
  если `navigator.storage.persisted()` === `false` — в `OutboxSheet` подпись `offline:storageNotPersisted` «Браузер может
  удалить несохранённые данные этого устройства (Safari — через 7 дней без открытия; приватное окно — при закрытии)».
  Тост «Сохранено, отправим при появлении сети» в лидере — только после успешного `persistNow()` (немедленная запись
  ключа без throttle). `persistNow()` отклонён (квота, приватный режим): если операция ещё не в `sending` —
  `discardOps([opId])`, тост-ошибка `offline:saveFailed` «Не удалось сохранить на устройстве — подключитесь к сети»,
  `persistFailedThisSession = true` (офлайн-запись выключена до перезапуска); если уже `sending` — дождаться ответа,
  Sentry `outbox.persist_failed`. Тост успеха без успешной записи невозможен.

#### 2.9 Что разрешено офлайн

| Операция | Офлайн |
|---|---|
| Создать / изменить / удалить расход (группа и личный) | да, фаза 1 |
| Создать/переименовать группу, участники, обложка, выход, kick, инвайты | нет в фазе 1; фаза 2 (D2) — переименование и участники через тот же outbox после BE-03-8; PR-id фазы 2 не назначены — отсрочка вынесена в подтверждения владельца (00, C1-28) |
| Settle-up / погашение / платёж, удаление и правка settlement | **никогда** (см. ниже) |
| Аватар/обложка (upload) | никогда (multipart, прогресс) |
| Настройки пользователя (`PATCH /users/self`) | нет (фаза 2 по желанию) |
| Удалить друга, logout other devices | нет |

Механизм: `useRequiresOnline()` (из `isNetworkUsable()` + `sessionMode`) и `<OnlineOnly>` вокруг кнопки:
офлайн → `disabled`, `aria-disabled`, tooltip «Нужно подключение к интернету»; вход в `GroupSettleUpFlow`
закрыт целиком. Константа `ONLINE_ONLY_ACTIONS` + тест, что каждое действие обёрнуто.

**Settlement — только онлайн, на двух уровнях (C2-02).** Удаление (reverse) и правка settlement идут по тем же
`DELETE`/`PATCH /ledger/entries/{id}`, что и расходы (backend `LedgerEntryCommandService.deleteEntry` обрабатывает
`EXPENSE` и `SETTLEMENT`), поэтому: (1) реестр outbox (2.1) отвергает любую запись не `EXPENSE`; (2)
`ONLINE_ONLY_ACTIONS` включает `settlement.delete` и `settlement.edit`, а `ActivitySubeventsButtons.tsx:68-75` (`onRemove`
сегодня без проверки `isExpense`, в отличие от `onEdit` `:52-54`) получает `<OnlineOnly>` для не-расхода; хук
`useDeleteLedgerEntry(entry)` для settlement всегда берёт онлайн-ключ. Тест: офлайн settlement-delete → 0 outbox-мутаций,
кнопка disabled; онлайн → `DELETE` ушёл онлайн-путём.

**Правка офлайн требует закэшированной записи (C2-33):** форма правки/удаления расхода в офлайне доступна, только если
`ledger.entry(id)` есть в кэше (иначе нет ни `baseVersion`, ни типа записи) — иначе «Нужно подключение»; тест.

Создание расхода офлайн требует закэшированных группы и участников. Если `groupKeys.detail(id)` нет в
кэше, форма показывает «Данные группы не загружены — подключитесь к сети».

### 3. Баланс офлайн

**Решение: локальный пересчёт не делаем.**

Обоснование: точное совпадение доказуемо только для долей одного расхода — `money.split` повторяет
`distributeAmount` бит-в-бит. Отображаемые балансы строит серверная проекция (`ledger/balances/GroupDebtProjection.kt`,
`LedgerDebtRefreshService.kt`, переносы `EXPENSE_TRANSFERRED_*`), агрегирует по группам/валютам
(`netBalance`/`netAmount`) и конвертирует по курсам (`helpers/currencies.ts:3-18`). Повтор на клиенте —
дубль бизнес-логики без доказуемого равенства; «прыгающая» цифра в деньгах хуже честной пометки.

UI: пока есть pending/failed операции, у каждого баланса (dashboard summary, шапка группы, карточка друга) —
подпись «без учёта неотправленных операций» (`offline:balanceExcludesPending`) и счётчик N со ссылкой на
`OutboxSheet`. В `OutboxSheet` у pending-расхода — «ваша доля: X» (`money.split`; EXACT как есть). Кэш
балансов старше 24 ч → подпись «обновлено <relative time>».

### 4. Модуль `shared/money/`

#### 4.1 Модель

```ts
export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };   // /^[A-Z]{3}$/
export interface Money { readonly minor: bigint; readonly currency: CurrencyCode }
// minor — целые ledger units = 10⁻⁴ (85.5 → 855000n); -0 не существует
export const LEDGER_SCALE = 4;                     // как backend MONEY_SCALE / AMOUNT_SCALE — единственная константа на FE
```

Провод — `number` scale 4 **навсегда** (D21), но на FE сумма **никогда не проходит через double** (ревизия C1-03, спор
review B ↔ C1 решён запуском Node 24.21, seeded-sweep 400k на диапазон, `../evidence/money/double-path-sweep.mjs`):

| Диапазон значения | `JSON.parse` → `Math.round(v*1e4)` + round-trip (прежняя спека) | `JSON.parse` → `v.toFixed(4)` | разбор из текста (решение) |
|---|---|---|---|
| [0, 1e11) | 0 неверных, 0 отказов | 0 / 0 | 0 / 0 |
| [1e11, 2³⁹ ≈ 5.4976e11) | 0 неверных, **13 858 ложных отказов** (`365963032346.3555`) | 0 / 0 | 0 / 0 |
| [2³⁹, 9e11) | **72 224 молча неверных**, 0 отказов (`899999999999.9997` → `…9998n`) | 72 231 неверных | 0 / 0 |
| [9e11, 1e15) | ~89 % неверных или отказов | ~99 % неверных | 0 / 0 |

Прежнее утверждение «400k: 0 отказов, 0 неверных до 9e11» было ложным: выше 2³⁹ шаг double (2⁻¹³ ≈ 1.22·10⁻⁴) больше
10⁻⁴, два соседних 4-знаковых значения дают один double — никакая проверка на FE это не восстановит. Поэтому:
1. **Разбор из текста.** Транспорт `shared/api/wireJson.ts` (только в `api()`, §5.4) = `lossless-json` `parse(text,
   reviver)`: все числа сначала `LosslessNumber` (исходная строка), reviver по реестру полей §4.3 превращает денежные
   в `WireAmount`, проценты/веса/курсы — в `WireDecimal` (строка), остальные — в `number`. Runtime `WireAmount` —
   замороженный plain-объект `{ __wireDecimal: '85.5000' }` (переживает structured clone, JSON и persist-codec §1.4);
   тип — opaque brand `{ readonly __wire: unique symbol }`. `moneyFromWire` разбирает строку regex-ом в `bigint` без
   арифметики. Тот же sweep (от 10⁰ до 10¹⁹ ledger units, знак ±): **0 неверных, 0 отказов**.
2. **Документированная граница** = колонка backend `decimal(19,4)` (`LedgerDbObjects.kt:26`): `|v| ≤
   999 999 999 999 999.9999`, regex `^-?\d{1,15}(\.\d{1,4})?$` (backend пишет `toPlainString` scale 4 без экспоненты,
   `BigDecimalJsonNumberSerializer.kt`). Вне границы, > 4 дробных знаков, экспонента → `MoneyWireError` + Sentry
   `money.wire_reject` — **жёсткий отказ, никогда не молчаливое значение**. Отказ локализуется в элементе (`mapItems`,
   §4.2), страница не падает (C3-13). Backend-лимит суммы не нужен: границу держит колонка БД.
3. **Исходящие тела с деньгами** пишет тот же модуль: `lossless-json` `stringify(body, null, undefined,
   [{ test: isWireAmount, stringify: w => w.__wireDecimal }])` — decimal-литерал без экспоненты (проверено: `{"amount":
   899999999999.9997}`). `JSON.stringify` для таких тел запрещён: backend принимает только `^-?\d+(\.\d+)?$`, а
   `JSON.stringify(1e-7) === '1e-7'`.
4. **Стоимость:** 4.1 МБ JSON — `JSON.parse` 33 мс, `parseWireJson` 156 мс (Node 24, тот же прогон); типичный ответ
   < 100 КБ — единицы мс. Не-JSON ответы (204, HTML 502) транспорт пропускает как есть.
5. Legacy-слой `src/api/*` до миграции своего стора остаётся на `JSON.parse` + `normalizeApiMoneyAmount` (поведение как
   сегодня, без регрессии); lossless-транспорт подключается только через `api()` (per-request `transformResponse`/
   `transformRequest`, глобальные defaults `apiInstance` не меняются).
6. Смена scale — одна константа с каждой стороны (`LEDGER_SCALE` на FE, `MONEY_SCALE` на backend), меняются синхронно.

Арифметика в `bigint` «ledger units» = 10⁻⁴; минорные единицы валюты — **только** для отображения и
ограничения ввода. Причина: backend делит и считает балансы со scale 4 для всех валют
(`ShareDistribution.kt:7`); делёж в центах даёт другой остаток — текущая ошибка `expenseModalSelectors.ts:106-174`.

#### 4.2 API (`shared/money/index.ts` — единственный публичный вход)

| Функция | Сигнатура | Поведение |
|---|---|---|
| `currencyCode` | `(s: string) => CurrencyCode` | upper-case + проверка `^[A-Z]{3}$`, иначе throw |
| `minorUnits` | `(c: CurrencyCode) => 0 \| 2 \| 3` | таблица `MINOR_UNITS` (ISO 4217): 0 — BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF; 3 — BHD IQD JOD KWD LYD OMR TND; остальные 2. Не через Intl (у разных движков расхождения) |
| `moneyFromWire` | `(v: WireAmount, c) => Money` | `v.__wireDecimal` по `^(-?)(\d{1,15})(?:\.(\d{1,4}))?$` → `BigInt(sign + int + frac.padEnd(4,'0'))`, `-0` → `0n`; не совпало → throw `MoneyWireError` + Sentry `money.wire_reject` (§4.1). Без `Number`/double. Вызывается **только** в мапперах `entities/*/model/toX()` |
| `moneyToWire` | `(m: Money) => WireAmount` | decimal-строка из `minor` (`|minor| < 10¹⁹`, иначе throw `MoneyWireError`), `{ __wireDecimal }`; без double. Вызывается только в мапперах `toXWire()` |
| `mapItems` | `<T, X>(list: readonly T[], toX: (t: T) => X, id: (t: T) => string) => (X \| InvalidItem)[]` | `MoneyWireError` в маппере элемента → `{ kind: 'invalid', id }` + Sentry один раз на `id`; UI рендерит строку «Запись не может быть показана» (`common:invalidAmount`), остальной список работает (C3-13). Другие ошибки пробрасываются |
| `parseMoneyInput` | `(raw: string, c) => Money \| null` | ввод пользователя: trim, убрать пробелы/NBSP, один разделитель `,` или `.`, целых цифр ≤ 15 (граница §4.1), дробных цифр ≤ `minorUnits(c)`, ≥ 0. Заменяет `parseAmountInput` (`helpers/numbers.ts:302`). Правка записи с более точной суммой (backend допускает scale 4 для любой валюты, напр. `10.5 JPY`, C3-20): поле показывает сумму с её знаками; пока текст поля не менялся, форма отправляет исходный `Money` без разбора; изменённый текст разбирается по `minorUnits(c)` |
| `toUnits` / `fromUnits` | `Money → bigint` / `(bigint, c) → Money` | |
| `add`, `sub`, `negate`, `abs` | `(a, b) => Money` | разные валюты → throw `CurrencyMismatchError` |
| `sum` | `(list: Money[], c) => Money` | пустой → zero |
| `compare`, `isZero`, `sign` | | `sign` → `-1 \| 0 \| 1` |
| `roundToMinor` | `(m) => Money` | half-up **от нуля** (как `RoundingMode.HALF_UP` и текущий `roundHalfUp` из `helpers/numbers.ts:95`) до `minorUnits`, результат снова scale 4 |
| `displaySign` | `(m) => -1 \| 0 \| 1` | `sign(m)` на scale 4. **Единственное правило «должен/должны/в расчёте»**: «в расчёте» только при `minor === 0n`; `0.0040 USD` → 1 (backend считает это долгом и блокирует удаление друга `USER.OUTSTANDING_DEBT`). Отображение такой суммы — `formatMoney` «< $0.01» (§4.5) |
| `split` | `(total: Money, entries: readonly { userId: string; weight: string }[]) => Money[]` | точная копия `distributeAmount` (`ShareDistribution.kt:41-63`): decimal-веса приводятся к общей целой шкале как `toCommonScaleIntegers` (по max числу дробных знаков), `floor(units*w/W)`, остаток по 1 единице на наибольшие остатки, ничьи — по индексу (стабильная сортировка). `entries` — **в точном порядке `participantIds` тела запроса** (тот же массив передаётся в маппер `toCreateLedgerEntryWire`). Веса: AUTO = все `'1'`, SHARES = веса, PERCENTAGE = проценты; нулевые веса допустимы. Пустой список → `[]`, `W <= 0` → throw |
| `convert` | `(m, rate: string, target) => Money` | приблизительно (курсы), half-up до scale 4; результат помечен в типах `ApproxMoney` (brand) — нельзя передать в `moneyToWire` |
| `formatMoney` | `(m, opts?: { locale?; currencyDisplay?: 'symbol' \| 'code'; signDisplay?: 'auto' \| 'always' \| 'exceptZero'; compact?: boolean }) => string` | `roundToMinor` → `Intl.NumberFormat(locale, { style:'currency', currency, minimumFractionDigits: mu, maximumFractionDigits: mu })`. Если `m ≠ 0`, а `roundToMinor(m) = 0` → «< » + формат одной минорной единицы со знаком `m` («< $0.01»); знак передаётся текстом «вы должны / вам должны», не символом. | На вход идёт decimal-строка, собранная из `minor` (ES2023 `format(string)` — без потери точности); кэш форматтеров по `locale+currency+opts` |
| `formatMoneyParts` | то же → `Intl.NumberFormatPart[]` | для `basics/numbers/amount/Amount.tsx`, которому нужны отдельные части |

Правила: все функции чистые, без React и i18n. Locale передаётся аргументом (берётся из `i18n.resolvedLanguage`
в хуке `useFormatMoney()` в `shared/i18n`, не в money).

#### 4.3 Lint-ограничение

Блок для `src/**/*.{ts,tsx}`, `ignores: ['src/shared/money/**', 'src/shared/lib/formatNumber.ts', '**/*.test.*']`:

```js
'no-restricted-syntax': ['error',
  { selector: "CallExpression[callee.name='parseFloat']", message: 'Money: use shared/money (parseMoneyInput/moneyFromWire).' },
  { selector: "CallExpression[callee.name='Number'] > MemberExpression[property.name=/^(amount|minor|netBalance|netAmount|shareAmount)$/]", message: 'Money: no Number() on money fields.' },
  { selector: "CallExpression[callee.property.name='toFixed']", message: 'Money: use formatMoney/roundToMinor.' },
  { selector: "CallExpression[callee.object.name='Math'][callee.property.name='round'] BinaryExpression[operator='*']", message: 'Money: no Math.round(x*N) rounding.' },
  { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']", message: 'Use formatMoney or shared/lib/formatNumber.' },
  { selector: "BinaryExpression[operator=/^[<>]=?$/] > MemberExpression[property.name=/^(amount|minor)$/]", message: 'Money: compare via money.compare/sign.' },
],
'no-restricted-imports': ['error', { patterns: [{ group: ['shared/money/*'], message: 'Import from shared/money only.' }] }],
// вне entities/*/model/** дополнительно (C1-11): importNames moneyFromWire/moneyToWire из 'shared/money' запрещены —
// 'Wire↔Money conversion only in entities/*/model mappers.'
```

Главная защита — типы, lint — страховка:
- Сырые суммы в сгенерированных типах — opaque `WireAmount` (`type WireAmount = { readonly __wire: unique symbol }`,
  **не** number-brand; тип, `isWireAmount` и `WireDecimal` — `shared/money/wire.ts`, PR 03-1). Решение «деньги или нет» —
  по **реестру полей** `scripts/api/wire-fields.mjs`, а не по одному `multipleOf` (C1-04: backend ставит
  `multipleOf: 0.0001` и на проценты/веса, `LedgerSharing.kt:30-62,91-101`):

  | Список | Поля (backend `64f9dd8`) | Тип в `schema.d.ts` | Runtime (транспорт §4.1) |
  |---|---|---|---|
  | `MONEY_FIELDS` | `amount`, `netBalance`, `netAmount`, `shareAmount` (`CurrencyBalance.kt`, `ActivityDtos.kt`, `LedgerEntryDtos.kt`, `LedgerBalanceDtos.kt`, `LedgerCrudRequests.kt`, `LedgerExpenseDtos.kt`, `KnownUserDtos.kt`) | `WireAmount` | `{ __wireDecimal }` |
  | `MONEY_MAP_FIELDS` | `customShares` (EXACT, суммы по `userId`) | `Record<string, WireAmount>` | то же для значений |
  | `DECIMAL_MAP_FIELDS` | `percentageShares`, `shares` (`LedgerSharing.kt`), `rates` (`CurrencyRatesDtos.kt:109`) | `Record<string, WireDecimal>` (`string & { __brand: 'WireDecimal' }`) | decimal-строка; в `moneyFromWire` не передаётся, `split` берёт веса строками |

  `openapi-typescript` `transform(schemaObject, { path })` в `scripts/api/openapi-ts.config.mjs` применяет реестр;
  проверки генератора (exit 1, тест `scripts/api/wire-fields.test.mjs`): (a) каждое свойство с `multipleOf: 0.0001` (или
  map таких чисел) есть ровно в одном списке; (b) свойство из `MONEY_FIELDS` в **любой** схеме имеет `multipleOf: 0.0001`;
  (c) `percentageShares` в выходе — `Record<string, WireDecimal>`, не `WireAmount`. Тот же реестр пишется в
  `shared/api/generated/wireFields.ts` и управляет reviver-ом транспорта — тип и runtime не расходятся. После BE-03-4
  (`x-chipin-money` / `x-chipin-decimal`, §7) генератор сверяет реестр с расширениями и падает при расхождении.
  Арифметика, сравнение и `Number()` над `WireAmount` не компилируются; прочитать можно только через `moneyFromWire`.
- Домен — `minor: bigint` (`a.minor * 2` и `a.minor + 0.5` не скомпилируются).
- Единственное место конверсии — мапперы `entities/*/model/toX()` (вход) и `toXWire()` (выход). `api()` деньги не трогает.
- Lint эвристичен (по именам свойств) и ловит остатки в ещё не мигрированном коде; `Number(amount)` с идентификатором
  (как `settle-up-modal/internal/helpers.ts:50`) он не видит — такие места перечислены в §4.4. Не-денежные
`toFixed`/Intl (проценты, KMB `helpers/numbers.ts:236`) переезжают в `shared/lib/formatNumber.ts` (в `ignores`).
Правило вводится **сразу `error`** (C2-03: `warn` несовместим с `--max-warnings 0` 02-C4 и запретом `warn` в 02 §Д0);
существующие нарушения (~29 строк) — в baseline механизма спеки 02 (02 §Д7); если 03-1 влит раньше 02-C4 — нативные
suppressions ESLint 9 (`eslint --suppress-rule no-restricted-syntax`, файл `eslint-suppressions.json`), которые 02 подхватывает
как есть. Baseline только уменьшается: 03-3 (`entities/`, `features/`), далее по мере миграции, последним 03-18.
Все правила этой спеки (§1.3 queryKey-литерал, §1.7 `navigator.onLine`, §4.3 деньги и импорт `moneyFromWire`, §6
`zustand`) регистрируются в реестре правил 02 §Д0 с классом «корректность/граница» и подсказкой (C1-14).
Это **единственное** определение денежных lint-правил во всех спеках (02 Д4 R1 и 02-C12 на него ссылаются).
Расположение: `config/eslint/project.js` через хелпер `restrictedSyntax()` (02-C4); если 02-C4 ещё не влит —
`eslint.config.js`, с переносом при 02-C4. Пути — от `APP_DIR` (после 04-0 — `apps/app/src/shared/money/**`).

#### 4.4 Миграция существующих мест

| Место (аудит) | Замена |
|---|---|
| `store/expenseModalStore.ts:161`, `store/expenseModalSelectors.ts:14` `roundMoney` (после D1 — `roundHalfUp`) | `split` / `roundToMinor`; превью долей = `split(total, weights)` — совпадает с backend AUTO/SHARES/PERCENTAGE |
| `expenseModalStore.ts:574` `roundMoney(v).toFixed(2)` | `formatMoney` / ввод через `parseMoneyInput` |
| 6 копий разбиения по знаку (`basics/BalanceSummaryText.tsx:29`, `store/dashboardSelectors.ts:21`, `components/dashboard-summary/internal/useConnect.ts:19,31`, `store/groupsSelectors.ts:52,94`, `pages/friends-page/components/CurrencyGroupCard.tsx:13`) | одна функция `partitionBalances` в `entities/balance/model/partition.ts` на `displaySign` |
| агрегация по валютам ×3 (`store/groupsSelectors.ts:85-106`, `store/users-store/selectors.ts:76`, `features/activity/internal/selectors.ts:70`) | `entities/balance/model/aggregate.ts` на `sum` |
| `helpers/currencies.ts:20 getBalanceEntriesSummary` + `store/commonSelectors.ts:4 calcBalancesSummary` | `entities/balance/model/summary.ts` на `convert` (`ApproxMoney`); pass-through удалить |
| `helpers/numbers.ts` `normalizeApiMoneyAmount`, `parseAmountInput`, `getNumberData({isPrice})` | `moneyFromWire`, `parseMoneyInput`, `formatMoneyParts`; не-денежная часть `getNumberData` остаётся в `shared/lib/formatNumber.ts` |
| `components/modals/early-supporter-promo-modal/EarlySupporterPromoModal.tsx:49` `new Intl.NumberFormat` | `formatMoney` |
| `BalanceEntry.netBalance` vs `ApiFriendBalance.netAmount` (`api/chipin.raw.types.ts:5,127`) | маппер на границе: доменный `Balance { net: Money }` для обоих |
| `components/modals/settle-up-modal/internal/helpers.ts:31-32` (`String(Math.abs(netAmount))`), `:50-55` (`Number(amount)`, `maxAmount`, `remainingAmount`) | §4.5: `resolveSettleAmount`, prefill `roundToMinor`, расчёт в `Money` (PR 03-21) |

Grep-оценка: 29 строк с `roundMoney|parseFloat|Number(` в `store/ helpers/ components/ features/ pages/
basics/`, не все про деньги. Финальный список — файл suppressions/baseline, который создаёт PR 03-1 (§4.3).

#### 4.5 Settle-up: остаток меньше минорной единицы невозможен

Доли считаются в scale 4 (10/3 → 3.3334/3.3333/3.3333), ввод — в минорных единицах валюты. Правило:
- `owed: Money` — точный `abs(balance.net)` scale 4 из ответа backend, **никогда** не пересобирается из текста поля.
- Prefill поля = `roundToMinor(owed)`; если он `0` (долг < 1 минорной единицы) — одна минорная единица.
- `resolveSettleAmount(input: Money, owed: Money): Money | null` (`entities/balance/model/settle.ts`):
  `|input − owed| < oneMinor(c)` → **`owed` точно** (scale 4, «погасить полностью»); иначе `input > owed` → `null`
  (кнопка disabled); иначе `input` (частичное погашение, остаток ≥ одной минорной единицы).
  `oneMinor(c) = 10^(4 − minorUnits(c))` ledger units. Когда срабатывает первая ветка и `input ≠ owed`, под полем —
  подпись `settle:fullSettlementHint` «Будет погашено полностью: <owed, 4 знака>» (C3-19; пункт подтверждения в 00).
- Следствие: после settle-up остаток либо 0, либо ≥ 0.01 (USD) — «хвост» 0.0033 невозможен. Исторические хвосты
  (созданы до 03-21 или распределением долей) показываются как «< $0.01», с прежней кнопкой settle-up; prefill даёт
  0.01, `resolveSettleAmount` отправляет точный `owed`.
- «Рассчитались» (серый, `balances.settledUp`) — только `displaySign === 0`, т.е. `minor === 0n` (§4.2), как в 01-3.
- Тело запроса settle-up строит маппер `toSettleUpWire(amount: Money)` → `moneyToWire`. Settle-up остаётся online-only (§2.9).

### 5. Генерация типов из OpenAPI

#### 5.1 Выбор: axios + `openapi-typescript` + тонкая обёртка

`openapi-fetch` не берём: (1) 223 строки interceptors (refresh-on-401 с версией сессии, Web Locks,
retry-флаг, детект аутэйджа) покрыты `chipin.interceptors*.test.ts` — переписывать auth на middleware без
пользы рискованно; (2) `fetch` не даёт upload-прогресс (`usersApi.ts:45`, `groupsApi.ts:46`); (3) 10 файлов
`api/*.test.ts` мокают axios. Обёртка даёт ту же типобезопасность путь→тело→ответ.

#### 5.2 Где лежит

- `openapi/chipin.yaml` — снимок спеки **в FE** (запрет `docs/openapi.md` касается backend).
- `openapi/BACKEND_VERSION` — **git SHA** backend, из которого взят снимок; это версия, развёрнутая на prod (не staging).
  Тегов и релизов у backend нет (C3-15): prod = образ, промоутнутый `deploy-production.yml` (`workflow_dispatch`,
  `image_tag` = SHA). Значение берётся командой `gh api 'repos/ChipIn-one/chipin-backend/deployments?environment=production&per_page=1' --jq '.[0].sha'`.
- `src/shared/api/generated/schema.d.ts` и `wireFields.ts` (commit, руками не правятся, eslint/prettier ignore).
  `specHash.ts` не генерируется — buster кэша определён только в §1.4 (C2-07).
- `src/shared/api/client.ts` — обёртка `api()`; `src/shared/api/http.ts` — `apiInstance` + interceptors из `api/`.

#### 5.3 Скрипты

```jsonc
"api:fetch": "node scripts/api/fetch-openapi.mjs",   // скачивает artifact `openapi-documentation` CI-прогона backend для SHA из openapi/BACKEND_VERSION (BE-03-4, `gh run download -R ChipIn-one/chipin-backend`); пишет openapi/chipin.yaml с сортировкой ключей
"api:fetch:staging": "node scripts/api/fetch-openapi.mjs --staging", // только CI: GET https://api-dev.chipin.one/swagger/documentation.yaml, Basic auth
"api:gen":   "node scripts/api/gen-types.mjs && node scripts/offline/write-model-hash.mjs", // openapi-typescript (точная версия, без ^) + реестр полей (§4.3) + MODEL_SHAPE_HASH (§1.4)
"api:check": "npm run api:gen && git diff --exit-code -- src/shared/api/generated src/shared/offline/modelHash.generated.ts"
```

- Синхронизация — PR «chore(api): sync openapi to BE <sha7>» с label `requires-backend: <sha7>`; мержится только когда
  prod-деплой backend содержит этот SHA (`gh api …/compare/<sha>...<prod-sha>` = `ahead`/`identical`; чек-лист PR).
- **Входы без секретов у агента (C2-17).** До BE-03-4 снимок даёт drift-workflow (§5.5), он же создаётся в 03-4a первым
  коммитом: использует уже существующие секреты FE-репо `CHIPIN_CONTRACT_SWAGGER_USER` / `CHIPIN_CONTRACT_SWAGGER_PASSWORD`
  (их читает `contract-smoke.yml`) и выкладывает `chipin.yaml` как artifact; агент берёт его `gh run download`. Чек-лист
  sync-PR: владелец подтверждает, что SHA staging, с которого снят снимок, = SHA prod-деплоя. Других ручных входов нет.
- `openapi-typescript` пинуется точной версией: вывод меняется между версиями.

#### 5.4 Обёртка

```ts
type Op<P extends keyof paths, M extends Method> = NonNullable<paths[P][M]>;
// PathParams<O>, Query<O>, Body<O> (application/json), Success<O> (200 | 201 json, иначе void) — infer из Op
export function api<P extends keyof paths, M extends Method & keyof paths[P]>(
  method: M, path: P,
  opts: { params?: PathParams<Op<P, M>>; query?: Query<Op<P, M>>; body?: Body<Op<P, M>>;
          headers?: Record<string, string>; signal?: AbortSignal; onUploadProgress?: AxiosProgressHandler },
): Promise<Success<Op<P, M>>>;
```

- Подстановка `{param}` **всегда** через `encodePathSegment()` из спеки 01 (01-1.1; файл переезжает в
  `shared/api/pathSegment.ts`): allowlist `^[A-Za-z0-9_-]+$` (отсекает `.`, `..`, `''`, `/`, `%`) + `encodeURIComponent`.
  Только `encodeURIComponent` нельзя: `encodeURIComponent('..') === '..'`. Невалидный сегмент → rejected Promise
  `InvalidPathSegmentError`. Кейсы `apiPath.test.ts` копируются в `client.test.ts`.
- Ошибки — `ApiError { status, code, details, current? }` из `getApiErrorPayload` (`helpers/errors.ts`); `current`
  заполняется только для 409 `LEDGER.VERSION_CONFLICT` разбором тела zod `LedgerConflictResponseSchema` (BE-03-1).
- Тело ответа и запроса идёт через lossless-транспорт `shared/api/wireJson.ts` (§4.1): per-request
  `transformResponse: [parseWireJson]` (только `application/json`; 204/не-JSON — как есть; тела ошибок тоже — поэтому
  `LedgerConflictResponse.current` приходит с `WireAmount`) и `transformRequest: [stringifyWireJson]` для JSON-тел
  (multipart upload — без изменений). Глобальные defaults `apiInstance` не трогаются (legacy `src/api/*` живёт как раньше).
- `api()` не конвертирует деньги в `Money` (§4.3) — это делают мапперы.

#### 5.5 CI

- PR-check (блокирующий, без сети): `npm run api:check`.
- Drift-check `.github/workflows/openapi-drift.yml` (раз в сутки + `workflow_dispatch`, рядом с `contract-smoke.yml`,
  секреты те же): `api:fetch:staging` → artifact `chipin.yaml` → `api:gen` → при diff открыть/обновить issue «OpenAPI drift». Только отчёт, источником типов staging не бывает
  (staging опережает prod — `contract-smoke.yml:30` `api-dev`, на prod swagger выключен `SwaggerRoutes.kt:16-19`).
- Синхронизация — отдельный PR «chore(api): sync openapi».

#### 5.6 Вывод ручных типов из оборота

1. `api/chipin.raw.types.ts`: `Api*` → алиасы `components['schemas'][…]`, по домену за PR; затем файл удаляется.
2. `api/chipin.types.ts` → доменные типы `entities/*/model/types.ts` с `Money`; мапперы `toX()` — граница
   (`moneyFromWire`, Unix-секунды → ms). `api/chipin.params.ts` удаляется (`Body<Op<…>>`).
3. `contract-tests/core-api.contract.ts` (877 строк): проверки путей полей удаляются (их гарантирует
   компилятор); остаются auth/session и runtime-семантика (`hasExpectedAutoShares`).

#### 5.7 zod только на границах

zod-схемы есть ровно для: `LocalUserSchema` (localStorage), `OutboxStateSchema` (ключ outbox целиком), `OutboxOpSchema`,
`FailedOpSchema`, `OutboxInboxSchema` (IDB), `BroadcastChannel`-сообщений logout и outbox (`OutboxChannelMessageSchema`:
`state | state-request | command | ack | heartbeat | settled`, §2.3), тела 409 `LedgerConflictResponseSchema` (§2.5;
денежные поля — `z.custom<WireAmount>(isWireAmount)`). Ответы API zod **не** валидируются: формат гарантирует
генерация + drift-check + реестр полей. Кэш запросов в IDB защищён buster = форма доменной модели (§1.4).

### 6. Миграция сторов (порядок и риски)

Каждый шаг — отдельный PR (или два), старый стор удаляется в том же PR, где уходит последний читатель.
Пока стор жив, его action может вызывать `queryClient.invalidateQueries` (мост) — обратного направления нет.

| # | Стор | Что становится | Риск / заметки |
|---|---|---|---|
| 1 | `landing-stats-store/` | `entities/stats/api/queries.ts` | низкий; пилот паттерна; после D8 уходит в Astro |
| 2 | `dashboardStore.ts` (198) | `dashboard`, `currencyRates` queries; `appMode` → `uiPrefsStore` (zustand) | средний: пагинация активности на dashboard → `useInfiniteQuery` |
| 3 | `users-store/` (283) | `users.self`, `users.known`, `users.premiumPromo` + мутации `updateSelf`, `removeKnownUser`, `uploadAvatar`; `localUser` остаётся в `helpers/localStorage` | средний: `useSyncUserSettings` (`hooks/useSyncUserSettings.tsx:18-33`) пишет язык — читать из `select`, без эффекта на каждый объект `settings` |
| 4 | `groupsStore.ts` (660) — 2 PR | (a) queries `groups.list` (cursor → infinite), `groups.detail`; (b) мутации create/update/leave/kick/remove/join/cover | **высокий**: module-level `inaccessibleGroupIds` и mutation generation (`groupsStore.ts:105-131`) → 403/404 на detail = `ApiError`, роут показывает errorElement (спека 04 §2.5). Цикл с activity исчезает: пагинация активности группы уходит в `groups.activity` query |
| 5 | `activity-store/` (443) | `activity.self` (infinite), `activity.children` | средний: cursor-пагинация, фильтры в ключе |
| 6 | `expenseModalStore.ts` + selectors/mapping/update (~1.6k) — порядок = таблица PR (авторитет) | (a) **03-2**: split-математика превью → `money.split` + snapshot-тесты превью долей; (b) **03-13**: сетевые вызовы submit/update/delete → `entities/ledger/api/mutations.ts` (online, без outbox); черновик остаётся в zustand, перед reload сохраняется в `sessionStorage` колбэком `onBeforeAppReload` (04 §2.11 п. 4); (c) **03-14**: цикл store↔selectors убрать (`expenseModalSelectors.ts` получает state аргументом) + co-location в `features/add-expense/` | высокий: деньги. Snapshot-тесты 03-2 обязаны оставаться зелёными **без изменений** в 03-13/03-14. Outbox (03-15a) зависит от 03-13. File-lock ниже |
| 7 | `authStore.ts` (183) | остаётся zustand (статус сессии — клиентское состояние); таблица «причина → что удаляется» §1.5: `clearUserData` только для `signed_out` и смены аккаунта; `resetAuthScopedStores` живёт, пока жив хоть один legacy-стор (каждый PR миграции убирает свою строку) | средний: импорт 7 сторов исчезает по мере миграции |
| 8 | `loadingStore.ts`, `errorsStore.ts` (+ selectors) | удаляются; `isPending`/`error` из хуков | низкий, но последний: удаляется, когда счётчик `useLoadingStore` = 0 |
| 9 | `backendAvailabilityStore.ts` | `connectivityStore` (1.8) | низкий |
| 10 | `pwaStore.ts` | остаётся (UI) | — |
| 11 | `store/internal/resourceRequests.ts` | удаляется после шага 5 (dedupe/abort даёт Query через `signal`) | низкий |

**File-lock `src/store/expenseModal*` (+ `mapping`/`update`).** Последовательность PR по этим файлам:
01-3 → 02-C2 (Prettier) → 03-1 (только suppressions) → 03-2 → 03-13 → 03-14 → затем 02-D-кодмоды и 05-4 (они пропускают
эти файлы до мержа 03-14). Остальные PR, механически задевающие эти файлы (02-C3 import-sort, 02-C6 type-imports,
02-C7a floating promises, 02-C11 `noUncheckedIndexedAccess`, 04-0a перенос) — либо до 03-2, либо `--exclude` этих файлов
до 03-14, как 02-D (C2-13; порядок записывается в граф 00). Одновременно открыт только один PR, трогающий эти файлы.

`store/index.ts` (мёртвый barrel) удаляется в PR 03-5 — единственный владелец (из 02-D3 убирается, C2-28). `src/test/renderWithQueryClient.tsx` — новый клиент
на тест (`retry: false`, `gcTime: Infinity`). В zustand остаются: `authStore`, `expenseModalStore` (черновик),
`uiPrefsStore` (appMode, view mode) и `appearanceStore` (тема, спека 05 PR 05-3) — оба в `src/store/ui-prefs/`,
`pwaStore`, `connectivityStore`, модалки; `no-restricted-imports` `paths: [{ name: 'zustand' }]` (ровно модуль
`zustand`) запрещён вне `src/store/**` и `src/app/**`; `zustand/react/shallow` (`useShallow`, 39 импортов в UI) разрешён
везде (C1-18).

**useConnect → useShallow (D12).** 17 файлов `useConnect.ts`, на них ссылаются 47 прод-файлов; удаляются в PR миграции своего стора (единственный владелец — эта спека).
Сервер — `useXQuery()`, UI — `useExpenseModalStore(useShallow(s => ({ amount: s.amount, setAmount: s.setAmount })))`.
Новые `useConnect` запрещает `scripts/check-file-layout.mjs` из спеки 02 (PR 02-C12, baseline только уменьшается).

### 7. Требования к backend (issues)

Ревизия C3-03: тексты issue #199, #200, #201, #202, #203 переписаны из этого раздела дословно по смыслу (2026-10-28).
Каждое требование — проверяемый integration-тест. Коды ошибок — существующий `ErrorResponse { code, details? }`
(`common/dto/ErrorResponse.kt:30-42`), кроме 409 `LEDGER.VERSION_CONFLICT` (своя схема, ниже).

#### 7.0 Общий контракт (вводит первый влитый из BE-03-1/2/5)

- `GET /health` (public) → `{ "status": "UP", "capabilities": string[] }`; поле присутствует всегда (может быть `[]`).
  Значения: `"ledger.clientEntryId"` (BE-03-2), `"ledger.entryVersion"` (BE-03-1), `"client.minVersion"` (BE-03-5).
  Флаг появляется только в том деплое, где фича включена; откат фичи убирает флаг. Тест: каждый флаг ↔ поведение.
- FE включает офлайн-запись только при всех трёх флагах (§2.7).

#### 7.1 Таблица issue

| ID | Issue | Контракт (тесты = приёмка) | Блокирует |
|---|---|---|---|
| BE-03-1 (#199) | Ledger: `version` + optimistic locking + id операции | **Версия:** `version: string` в `LedgerEntryInfo`/`LedgerExpenseInfo`/settlement-info — opaque (FE сравнивает только на равенство), = `seq` последнего события записи (`expense_events`/`settlement_events`, `LedgerDbObjects.kt:35,61`) десятичной строкой, без COUNT на list-запросах; меняется при **каждом** событии, включая `CORRECTED` и `REVERSED`. **Заголовки:** `If-Match: "<version>"` (в кавычках) и `X-Client-Op-Id: <uuid>` на `PATCH`/`DELETE /ledger/entries/{id}`; CORS `allowHeader` обоих; до мержа проверить на preview, что Vercel-прокси передаёт `If-Match` (иначе `X-Entry-Version`, FE меняет одну константу). **Порядок PATCH:** (1) auth/доступ; (2) событие с этим `X-Client-Op-Id` у записи уже есть → **200 с текущей записью, без нового события, независимо от `If-Match` и payload**; (3) запись удалена → 404; (4) `If-Match` есть и ≠ текущей → 409 `LedgerConflictResponse`; (5) применить, сохранить op-id в событии, 200 с новой записью. **Порядок DELETE:** (1) auth/доступ; (2) запись уже удалена (последнее событие `REVERSED`) → **204 независимо от `If-Match` и op-id**; (3) op-id уже есть → 204; (4) `If-Match` ≠ текущей → 409 `LedgerConflictResponse`; (5) `REVERSED` с op-id → 204. **409:** схема `LedgerConflictResponse { code: "LEDGER.VERSION_CONFLICT", current: LedgerEntryInfo }` (`application/json`), описана в OpenAPI отдельным 409-ответом PATCH и DELETE; транзиентный 409 `SYSTEM.CONFLICT` остаётся `ErrorResponse`. Без `If-Match` — как сейчас (last-write-wins). Op-id уникален в паре (`entry_id`, `client_op_id`), хранится в событии бессрочно. `/health.capabilities` += `"ledger.entryVersion"`. **Тесты:** (a) PATCH op-id A успех → повтор с op-id A и устаревшим `If-Match` → 200, событий не прибавилось; (b) DELETE удалённой записи с устаревшим `If-Match` → 204; (c) PATCH с устаревшим `If-Match` и новым op-id → 409, `current` равен `GET`; (d) `version` меняется после PATCH и после DELETE; (e) те же правила для settlement; (f) флаг в `/health` | PR 03-17 (offline update/delete) |
| BE-03-2 (#200) | Идемпотентный create по client id | `CreateLedgerEntryRequest.id?: uuid`. Поиск по `id` до валидации payload: нет → создать, **201**; есть, тот же автор, не удалена → **200 с существующей записью независимо от payload** (тела не сравниваются, запись не меняется); есть, другой автор → 409 `LEDGER.ID_CONFLICT` (`ErrorResponse`); есть и удалена → 410 `LEDGER.ENTRY_DELETED` (`ErrorResponse`). Сверить с chipin-backend#101 (idempotency key), не дублировать механизм. `/health.capabilities` += `"ledger.clientEntryId"`. **Тесты:** 201; повтор с **другим** payload тем же автором → 200, запись прежняя; другой автор → 409; удалённая → 410; флаг в `/health`; contract-тест на dev: POST с `id` → 201 | PR 03-17 (offline create); `id` в теле create вообще |
| ~~BE-03-3~~ | — | **снят по D21**: провод остаётся JSON-числом scale 4, backend не меняется. Номер не переиспользуется | — |
| BE-03-4 (#201) | Качество OpenAPI + артефакт по SHA | уникальный `operationId`; все тела — именованные `components.schemas`; ответы 409 (`LedgerConflictResponse`), 410, 426 в операциях; детерминированный порядок ключей; денежные поля сохраняют `multipleOf: 0.0001` **и** несут `x-chipin-money: true`, не-денежные decimal (`percentageShares`, `shares`, `rates`) — `x-chipin-decimal: true` (§4.3); gradle-задача/тест (на базе `src/test/kotlin/common/testing/GeneratedOpenApiDocument.kt`) пишет `build/openapi/documentation.yaml`; CI backend выкладывает его artifact-ом `openapi-documentation` на **каждый** push в `develop` (имя прогона содержит SHA) — **основной** источник FE-типов (§5.3); релиз-тегов нет, `BACKEND_VERSION` = SHA prod-деплоя (C3-15). **Тесты:** повторная сборка → идентичный YAML; snapshot-тест: каждое поле из реестра §4.3 имеет `multipleOf` и нужное расширение; унификация `netBalance`/`netAmount` — опционально, с версионированием | §5 |
| BE-03-5 (#202) | Заголовок `X-Client-Version` + `MIN_CLIENT_VERSION` → 426 | Проверено: версионирования API нет, FE версию не шлёт. Запрос: `X-Client-Version: <major.minor.patch[-suffix]>`; backend сравнивает **только** semver-ядро (суффикс после `-` отбрасывается). Конфиг `MIN_CLIENT_VERSION` (env; пусто = выключено). Ниже минимума → **426** `ErrorResponse { code: "CLIENT.OUTDATED", details: { minVersion: "<x.y.z>" } }` для всех путей, **кроме** `/health`, `/auth/refresh`, `/auth/logout`. Заголовка нет или он не парсится → пропуск (Postman, клиенты до rollout), лог `warn`. Каждый ответ при включённом конфиге несёт `X-Min-Client-Version: <x.y.z>`. CORS: `allowHeader(X-Client-Version)`, `X-Min-Client-Version` в `Access-Control-Expose-Headers`. `/health.capabilities` += `"client.minVersion"` при включённом конфиге. FE (03-20): заголовок одной строкой в axios request-interceptor (`APP_VERSION`, Vite `define`). **Тесты:** 426 ниже минимума; равная/выше → 200; суффикс игнорируется (`1.2.0-dev-abc` = `1.2.0`); три исключения → 200; без заголовка → 200; заголовок ответа; флаг | **обязателен до включения outbox** (03-17); гейт outbox `outdated` |
| BE-03-6 (#203) | Тест-фиксатор «DELETE удалённого = 204» | поведение уже такое (`entries/LedgerEntryCommandService.kt:179-183`: `lockAndReload` → `null` → return); тест сейчас + после BE-03-1: DELETE удалённой записи **с устаревшим `If-Match` и любым op-id** → 204 | — |
| BE-03-7 | Общие тест-векторы split | JSON `ledger-split-vectors.json` (total, weights, expected shares), который читают тесты backend и FE | §8 money |
| BE-03-8 (фаза 2) | `version` для групп + 409 на `PATCH /groups/{id}` и операциях с участниками | как BE-03-1 | фаза 2 |

Политика минимальной версии (D19, вариант A, подтверждено владельцем 2026-10-28). Сейчас — только принудительное
обновление SW через 24 ч (спека 04 §2.11 п. 3). До включения outbox (03-17) обязательны BE-03-5 и 03-20.
Правило 72 ч: `MIN_CLIENT_VERSION` поднимается **только** при несовместимом изменении контракта, и только
после того как новая версия FE пробыла в проде ≥ 72 ч. FE при 426 или
`X-Min-Client-Version > APP_VERSION` показывает блокирующий экран «Нужно обновить приложение».
Сравнение — только semver-ядро `major.minor.patch` обеих сторон (суффикс после `-` отбрасывается; prod-версия —
чистая `x.y.z`, вне prod — `x.y.z-dev-<sha7>`; нормализацию задают спека 02 Д7 и спека 04 §1.2/04-0a). Экран
(`showUpdateRequired()`, 04-2d) переводит гейт outbox в `outdated` (§2.4)
(`updateServiceWorker(true)` или reload из `src/app/pwa/ServiceWorkerManager.tsx`, PR 04-2d; `helpers/swUpdates.tsx` к этому моменту удалён); outbox не удаляется, новая версия читает его
через `OutboxOpSchema` с миграциями по `schema`.

Правило для PR (m9): PR, который поднимает `MIN_CLIENT_VERSION` **или** меняет схему ledger-запроса
(`ExpenseDraftWire`/`ExpensePatchWire`), обязан добавить миграцию `OutboxOpSchema` (`schema: n → n+1`) и
fixture-тест «старый dehydrated outbox → отправлен новым клиентом без 400». `ledgerOutboxMutationKeys` — замороженный
контракт. Такой PR (и любой, меняющий ledger-провод или `OutboxStateSchema`) требует release-bump версии до Promote
(C3-21): без bump два деплоя делят одно semver-ядро, и `MIN_CLIENT_VERSION` не может отличить их; пункт чек-листа PR.

### 8. Тесты

Unit `shared/money/*.test.ts` (table-driven):
- `moneyFromWire`/`moneyToWire` (через `parseWireJson`/`stringifyWireJson` на тексте, не на числе): `"85.5000"`→`855000n`;
  `"85.5"`→`855000n`; `"-0.0000"`→`0n`; `"0.3000"`→`3000n`; `"746251344.6807"`→`7462513446807n`;
  `"96689212322.2351"`→`966892123222351n`; **`"365963032346.3555"`→`3659630323463555n`** (прежний метод ложно отклонял);
  **`"899999999999.9997"`→`8999999999999997n`** (double даёт `…9998n`); `"632097188007.2934"`→`6320971880072934n`;
  `"999999999999999.9999"`→`9999999999999999999n` (максимум `decimal(19,4)`); throw `MoneyWireError`:
  `"1000000000000000.0000"`, `"1.23456"`, `"0.00005"`, `"85.50001"`, `"1e3"`, `"-1E-7"`. `moneyToWire` для каждого
  ok-вектора → `stringifyWireJson({ amount })` содержит ровно исходный литерал (без экспоненты).
- **Sweep (точный, C1-03):** PRNG `mulberry32(20261028)`; 400 000 случаев; на каждый: порядок `e = floor(rnd()*19)`
  (0…18), `u = randBigInt(10^(e+1))` (4 × 32 бита `% 10^(e+1)`), знак `rnd() < 0.5 ? −u : u`; текст `T` = decimal со
  ровно 4 дробными знаками; JSON `{"amount":T,"sharingMode":{"type":"EXACT","customShares":{"u1":T},"percentageShares":{"u1":33.3333}},"rate":1}`
  → `parseWireJson` → `moneyFromWire(amount) === u`, `moneyFromWire(customShares.u1) === u`, `percentageShares.u1` —
  строка `'33.3333'` (не `WireAmount`), `rate === 1` (number); затем `stringifyWireJson` → `amount` в тексте === `T`.
  Ожидание: **0 неверных, 0 отказов** (эталон Node 24.21, `../evidence/money/lossless-wire-sweep.mjs`: 400 000 / 0 / 0).
- **Регрессионный якорь:** тест `money-double-path.test.ts` фиксирует, почему путь через double запрещён:
  `Math.round(JSON.parse('899999999999.9997') * 1e4) !== 8999999999999997` и `JSON.parse('365963032346.3555') * 1e4`
  не целое — чтобы «упрощение» обратно к `JSON.parse` падало с объяснением.
- Транспорт: ответ 204 / `text/html` 502 проходит как есть; тело ошибки 409 с `current.amount` → `WireAmount`; legacy
  `apiInstance` без `api()` по-прежнему отдаёт `number` (глобальные defaults не изменены).
- `parseMoneyInput`: `"1 234,5"` (NBSP), `"0,"`, `"1.234"` USD→null / KWD→ok, `"-1"`→null, 16 цифр целой части→null;
  правка `10.5000 JPY` без изменения текста → отправлен исходный `Money`, изменённый `"10,5"` JPY → null (C3-20).
- `mapItems`: список из 3, у второго `amount` `"1e3"` → `[X, invalid, X]`, Sentry один раз.
- `wire-fields.test.mjs`: схема с неклассифицированным `multipleOf`-полем → генератор exit 1; `percentageShares` →
  `Record<string, WireDecimal>`.
- `roundToMinor`: `1.0050`→`1.0100`, `-1.0050`→`-1.0100`, `2.6750`→`2.6800` (USD); `0.5000 JPY`→`1.0000`; `1.2345 KWD`→`1.2350`.
- `displaySign`: `0.0000`→0, `0.0040 USD`→1, `-0.0049`→-1; `formatMoney(0.0040 USD, en)` → `< $0.01`.
- `resolveSettleAmount` (owed USD): `3.3333`/ввод `3.33` → `3.3333`; `3.3350`/`3.33` → `3.3350`; `3.3350`/`3.34` →
  `3.3350`; `3.3333`/`3.32` → `3.32`; `3.3333`/`3.35` → `null`; `0.0001`/prefill `0.01` → `0.0001`; JPY `10.4000`/`10` →
  `10.4000`. Свойство (1000 seeded случаев): `owed − result` = 0 или ≥ `oneMinor`.
- `split`: `100.0000/[1,1,1]`→`[33.3334,33.3333,33.3333]`; `0.0002/[1,1,1]`→`[0.0001,0.0001,0]`; веса
  `['1.5','1']` = `['15','10']`; нулевой вес → 0; порядок entries меняет, кому достаётся остаток; 1000 случайных
  входов (seeded PRNG): сумма == total, каждая ≥ 0, детерминизм; векторы BE-03-7.
- `formatMoney`: `ru`/`en`/`pt-BR` × USD/JPY/KWD, отрицательные, `signDisplay`.

Persister (`fake-indexeddb/auto`): данные X не видны Y; buster mismatch чистит кэш, **outbox сохраняется**;
`Money { minor: 9999999999999999999n }` переживает persist → restore (`typeof minor === 'bigint'`, C1-05); ошибка
`setItem` доходит до `reportPersistFailed` (через `retry`); комментарий в `entities/*/model/types.ts` не меняет
`MODEL_SHAPE_HASH`, новое поле — меняет; `maxAge` истёк → пусто; infinite персистится одной
страницей (через `trimmingPersister`); `clearUserData` удаляет все ключи пользователя, и событие `mutationCache` /
throttled-persist **после** logout ничего не пишет; IDB бросает на `set` → приложение работает, Sentry один раз;
restore дольше 3 с → старт без кэша, поздний результат не применяется; холодный старт с persisted-кэшем → 0 сетевых
запросов до резолва `restoreReady`; повторный mount провайдера не дублирует восстановленные мутации (`opId`).

Сессия и выход (§1.5, по строке таблицы на тест): `signOut` → IDB без ключей пользователя, черновик и legacy-сторы
пусты; remote logout — то же; `expireSession` → кэш, outbox, черновик сохранены, `role` удалена, legacy-сторы
сброшены; `missing`/`error` — ничего не удалено; **expire X → вход Y → ни в одном сторе, ни в черновике, ни в IDB нет
данных X** (C1-02); expire X → вход X → черновик и очередь на месте; offline cold start после expiry (hint `false`) →
экран входа, а не кэш.

Query retry: офлайн refetch запроса с кэшем → `fetchStatus: 'paused'`, `status: 'success'`, `data` прежняя, компонент
не показывает ошибку; loader при офлайне и пустом кэше не ждёт сеть (навигация завершается, скелетон).

Outbox (msw `2.15.0` `setupServer` + `onlineManager.setOnline`):
- create → update → update того же id → delete другого офлайн → online: запросы в этом порядке, первый update несёт
  `If-Match` из ответа create, второй — из ответа первого update (`outboxVersions`), ни одного запроса без `If-Match`.
- **Строгий порядок при медленном IDB**: запись failed-ключа задержана на 2 с; 422 на op1 → op2 не отправлен
  (msw считает 0 запросов op2), пока op1 не решён; то же для 401 (refresh 401) и 426 — op1 остаётся pending, op2 не ушёл.
- 409 `SYSTEM.CONFLICT` ×2 затем 200 → одна запись, операция ни разу не failed, `ConflictDialog` не открывался.
- reload (новый клиент + `restoreOutbox` + `resumePausedMutations`) → те же запросы без дублей; «анти-пример»
  без `mutationDefaults` не выполняется (фиксирует 2.1).
- 422 на второй → третья не ушла, failed в `OutboxSheet`; discard → третья ушла.
- **Discard головы (C3-04):** офлайн create A, create B; discard A; online → 0 запросов A, B отправлен **после** settle A,
  ни в один момент две операции не `sending`; после reload A не воскресает (`cancelled`).
- **Discard failed create (C2-15):** create C → 422 (failed), update C — голова, ждёт `blocked`; discard failed C →
  0 запросов PATCH/DELETE на `entryId` C, гейт открыт, следующая операция ушла.
- **Порядок по `seq` (C2-16):** три операции одного `entryId` с убывающим `createdAt` (часы переведены назад) и растущим
  `seq` → после reload отправлены в порядке `seq`.
- **Restore не удался / медленный (C3-02):** restore outbox задержан 5 с, за это время пользователь сохраняет расход →
  он уходит онлайн-путём (или `<OnlineOnly>` офлайн), IDB-ключ не перезаписан, после restore все старые операции на месте
  и отправлены; IDB бросает на `get` → `outboxRestore = 'failed'`, баннер, ключ не изменён ни одной записью.
- **Окно failed-записи (C3-05):** прервать «вкладку» во время записи failed-ключа → после reload операция в outbox или в
  failed, никогда ни там ни там; ошибка записи failed → операция остаётся pending во главе; `error`-мутации не
  попадают в persisted outbox.
- **Квота (C3-10):** `persistNow` reject → тост успеха не показан, операция отменена до отправки,
  `offlineWritesAvailable === false`; `persisted() === false` → подпись в `OutboxSheet`.
- **Settlement (C2-02):** офлайн удаление/правка settlement → 0 outbox-мутаций, `OnlineOnlyError` из реестра, кнопка
  disabled; `command` от последователя с settlement-записью лидер отвергает.
- **Два пути create (C1-10):** без `offlineWritesAvailable` `useCreateExpense` создаёт мутацию с онлайн-ключом
  (`networkMode: 'online'`, без scope), с ним — outbox-ключ (`scope.id === OUTBOX_SCOPE`, `retry === false`).
- 409 → `ConflictDialog`; «Оставить мою» → повтор с `current.version`; «Взять с сервера» → кэш = current.
- DELETE 404 = успех; PATCH 404 = `deletedRemotely`; 5xx ×3 затем 200 → одна запись.
- 401 + refresh 401 → гейт `auth`; вход тем же userId → отправлено; другим → диалог и очистка.
- **Чужая сессия (C3-07):** две вкладки; Y входит во вкладке B; вкладка A (outbox X) переподключается и успешно делает
  refresh → `sub` = Y → 0 ledger-запросов из outbox X, гейт `auth` закрыт, поток смены аккаунта.
- две «вкладки» (общий fake IDB, мок `navigator.locks` с очередью lock, общий мок `BroadcastChannel`): лидер — первая;
  create во второй → `command` → выполнен лидером, `ack`, оверлей виден в обеих; закрыть лидера посреди запроса →
  вторая получает lock, restore, повтор (create-дубль → 200), итог без дублей; одновременный старт двух вкладок →
  ровно один restore; нет `navigator.locks` → офлайн-запись выключена, кнопки `OnlineOnly`.
- **Замороженный лидер (C3-06):** мок лидера, который перестал слать heartbeat и не отвечает; видимая вторая вкладка
  создаёт расход → запись в inbox, тост «Сохранено»; через 5 с `steal` → она лидер (epoch+1), операция отправлена ровно
  один раз; «размороженный» старый лидер: его `update` не меняет ключ (фенсинг), его `runOutboxOp` → `LEADERSHIP_LOST`
  без запроса; скрытая вкладка lock не крадёт.
- Без capability `ledger.clientEntryId` create уходит онлайн без поля `id`; с ней — с `id`.
- 51-я операция блокируется; старше 14 дней → `stale`.

Connectivity: `onLine=false` + network error → баннер; 503 + health 503 → страница; 500 + health 200 → ошибка запроса;
холодный старт с `navigator.onLine=false` → `onlineManager.isOnline() === false` до первого события.

---

## Нюансы и подводные камни

- **Порядок hydrate**: `setMutationDefaults` до `hydrate`, иначе у восстановленных мутаций нет `mutationFn`.
- **In-flight при закрытии вкладки**: запрос мог дойти, ответ — нет; после reload он повторится. Безопасно
  только при BE-03-2 (create) и BE-03-1 (update/delete), поэтому офлайн-запись включается флагом после них.
- **`updatedAt` в секундах** не годится для locking (две правки в одну секунду неразличимы) → `version`.
- **JSON-числа**: деньги никогда не проходят через `JSON.parse`/double в новом слое — только lossless-транспорт (§4.1;
  выше 2³⁹ ≈ 5.5·10¹¹ double молча путает соседние суммы). `JSON.parse` для денег — только в legacy `src/api/*` до
  миграции стора (как сегодня).
- **`Intl.format(string)`** — ES2023; старый Safari приводит строку к number: точно до 15 значащих цифр, выше —
  округление **только на экране** (данные и провод остаются точными).
- **Финансовые данные в IDB не шифруются**: смягчение — `clearUserData` (см. 04-security).
- **Тесты с `vi.mock('store/…')`** (`01-architecture.md:259-261`) в PR миграции переписываются на msw +
  `renderWithQueryClient`, а не на новый мок-путь.
- **Нет Web Locks / BroadcastChannel**: офлайн-запись выключена, только онлайн (§2.3).
- **Смена лидера во время запроса**: ответ мог не дойти — повтор безопасен только благодаря BE-03-2 (`id`) и
  BE-03-1 (`X-Client-Op-Id`).

## Расширение в будущем

- Фаза 2: группы (переименование, участники) — те же `mutationDefaults` + `scope: 'outbox'`, BE-03-8.
- Background Sync API в SW для отправки очереди без открытого приложения — только когда outbox
  стабилен; сейчас SW не трогает API (`02-routing-state-pwa.md:121`).
- Локальный пересчёт баланса — только если backend отдаст «дельту баланса» на каждый expense в ответе
  create и правило агрегации станет публичным контрактом.
- Переход на `openapi-fetch` возможен, если уйдёт потребность в upload-прогрессе и interceptors упростятся.

## Что НЕ делаем

Не валидируем ответы API zod-ом; не кладём API в SW `runtimeCaching`; не пересчитываем балансы офлайн;
settle-up офлайн никогда; не меняем axios на fetch; не пишем фейковые события в activity-кэши; не храним
outbox в ключе кэша запросов; не делаем big-bang миграцию сторов.

## Фазы / PR

Каждый PR ≤ ~400 строк диффа (без generated-файла) и релизится независимо.

| PR | Содержание | Зависит от |
|---|---|---|
| 03-1 | `shared/money/` (+ `wire.ts`: `WireAmount`/`WireDecimal`/`isWireAmount`) + unit-тесты, lint-правила §4.3 сразу `error` + suppressions/baseline (в `config/eslint/project.js`, если 02-C4 влит, иначе в `eslint.config.js`) | 01-3 |
| 03-2 | превью долей расхода на `money.split`, snapshot-тесты до/после | 03-1 |
| 03-3 | `entities/balance` (partition/aggregate/summary), удаление 6 копий, baseline → 0 в `entities/`, `features/` | 03-1 |
| 03-4a | `openapi/chipin.yaml` + `BACKEND_VERSION` (SHA), drift-workflow (первым коммитом, даёт снимок), `api:*` скрипты, реестр полей `wire-fields.mjs` + transform + проверки генератора, `MODEL_SHAPE_HASH`, generated, PR-check | 01-1, 03-1 |
| 03-4b | транспорт `shared/api/wireJson.ts` (`lossless-json`, reviver по `wireFields.ts`, stringify), обёртка `api()` на `encodePathSegment` + per-request transforms, `client.test.ts`, sweep §8; lint (C1-11, §4.3): `moneyFromWire`/`moneyToWire` импортируются только в `entities/*/model/**` (`no-restricted-imports` `importNames` для остальных путей, `error`) | 03-4a |
| 03-5 | QueryClient, провайдер без персиста, `renderWithQueryClient`, eslint-plugin-query, пилот landing-stats, удалить `store/index.ts` | 03-4b |
| 03-6 | `connectivityStore` (из `onlineManager`), классификация ошибок, `OfflineBanner`, страница только для backend-down | 03-5 |
| 03-7a | персистер кэша (string-storage + `persistCodec`, `retry`→Sentry, `trimmingPersister`), buster §1.4, `LocalUser.id` + zod, `restoreReady` + гейт гидрации, `shared/offline/network.ts` (`isNetworkUsable`, `setOnline`, probe, lint `navigator.onLine`), заглушки `isEntryWithPendingOp = () => false` и no-op `outboxGate` | 03-5 |
| 03-7b | `clearUserData` (порядок §1.5, включая legacy-сторы и черновик), таблица «причина → что удаляется» + тест на строку, черновик с `ownerId`, expiry: только `role`, офлайн-холодный старт + `sessionMode`, диалог смены аккаунта (без outbox-части) | 03-7a |
| 03-8 | dashboard + currency rates | 03-5 |
| 03-9 | users-store | 03-5 |
| 03-10/11 | groups queries / groups mutations | 03-9 |
| 03-12 | activity + удаление `resourceRequests.ts` | 03-11 |
| 03-13 | expense modal: сеть → `entities/ledger/api/mutations.ts` (`ledgerOnlineMutationKeys`, без `id` в теле), `capabilitiesQueryOptions`; регистрирует сохранение черновика расхода в `sessionStorage` через `onBeforeAppReload` (`ServiceWorkerManager`, спека 04 §2.11 п. 4) + восстановление при старте | 03-12 |
| 03-14 | expense modal: разрыв цикла store↔selectors, co-location `features/add-expense/` | 03-13 |
| 03-15a | outbox-ядро, одна вкладка, **в памяти**: `ledgerOutboxMutationKeys` + defaults/колбэки, хуки выбора пути (§2.1), реестр «только расходы», `seq`, `runOutboxOp` + гейт + `discardOps`/`cancelledOpIds` + `outboxVersions`, проверка `owner`; флаг `VITE_FEATURE_OFFLINE_WRITES=false`. Тесты: порядок, классы ошибок, discard, settlement-guard, два пути create | 03-7b, 03-13; подтверждение владельца по D3 (00) |
| 03-15b | персист outbox: `OutboxState` + zod, `outboxRestore` guard (§1.6), запись только `pending`, failed-ключ с ожиданием записи, `persistNow` + тост, `storage.persist()`, лимиты 50/14 дней + `stale`, гейт `auth` по `sub` токена. Тесты: reload, медленный/упавший restore, окно failed, квота, чужая сессия | 03-15a |
| 03-15c | несколько вкладок: Web Lock лидер, `BroadcastChannel` (`state`/`command`/`ack`/`heartbeat`), IDB-inbox, `steal` при замороженном лидере, фенсинг `epoch`. Тесты двух вкладок и замороженного лидера | 03-15b |
| 03-16a | `OutboxSheet`, `<OnlineOnly>` + `ONLINE_ONLY_ACTIONS` (включая `settlement.delete`/`edit`), подпись у балансов, confirm `signOut` при непустом outbox и outbox-часть диалога смены аккаунта, баннеры `outboxUnavailable`/`storageNotPersisted`, i18n ×5 | 03-15c |
| 03-16b | `ConflictDialog` (§2.6), i18n ×5 | 03-16a |
| 03-17 | включить флаг для expenses | BE-03-1, BE-03-2, BE-03-5, 03-16b, 03-20, 04-4 (в prod: outbox старого origin `chipin.one` на `app.chipin.one` не переезжает, спека 04 §4.1) |
| 03-18 | удалить `loadingStore`, `errorsStore`, их селекторы; остатки `useConnect` | 03-14 |
| ~~03-19~~ | снят по D21 (провод остаётся числом) | — |
| 03-21 | settle-up на `Money`: `resolveSettleAmount`, prefill `roundToMinor`, «< 0.01», подпись «погашено полностью», `toSettleUpWire` (§4.5) | 03-3, 03-4b |
| 03-20 | новый заголовок `X-Client-Version: APP_VERSION` (одна строка в axios-interceptor), обработка 426 и `X-Min-Client-Version` (сравнение только `major.minor.patch`, §7) → гейт `outdated` + блокирующий экран «Нужно обновить» из 04-2d | BE-03-5, 04-2d |

Переименования относительно прежней таблицы (для 00/04 и FE-issue): 03-4 → 03-4a + 03-4b; 03-7 → 03-7a + 03-7b
(`restoreReady` — из 03-7a); 03-15 → 03-15a + 03-15b + 03-15c; 03-16 → 03-16a + 03-16b. Итого PR спеки 03: 25
(было 20).

## Тесты / критерии приёмки

Разделение (C2-34): критерии 7–10 — gate PR (команды в CI); 1–6, 11, 12 — QA владельца на устройстве перед 03-17
(чек-лист в issue 03-E), их автоматические аналоги — тесты §8.

1. В airplane mode установленный PWA открывает dashboard, группу и активность с данными последней сессии,
   без `BackendUnavailablePage`, с баннером. Проверяется на установке с `app.chipin.one`; PWA, установленные на `chipin.one` до переезда приложения на поддомен, не поддерживаются: онлайн они открывают сайт, офлайн-запуск с их иконки не гарантируется (D26, спека 04 §2.11).
2. Офлайн создать, изменить и удалить расход. Перезагрузить приложение офлайн: операции видны в
   «Не отправлено». Включить сеть: на сервере ровно эти изменения, в этом порядке, без дублей.
3. Изменить расход на устройстве A офлайн, тот же расход на B онлайн. A online → конфликт-диалог, оба
   варианта работают.
4. Settle-up, удаление/правка settlement, загрузка аватара, создание группы офлайн недоступны (disabled + tooltip).
5. Logout с непустой очередью → предупреждение; после logout IDB не содержит ключей пользователя.
6. Истечение сессии во время редактирования не теряет черновик и очередь.
7. `npm run api:check` зелёный; drift-job открывает issue при изменении staging-спеки.
8. Money-правила lint — `error`, baseline/suppressions в `entities/`, `features/`, `pages/` пуст.
9. Превью долей в форме совпадает с `participantShares` ответа backend на 100% векторов BE-03-7.
10. В `src/` нет импортов `loadingStore`, `errorsStore`, `resourceRequests`, `dexie`.
11. Две открытые вкладки офлайн: расход, созданный во второй, отправлен ровно один раз и в общем порядке очереди.
12. Settle-up «полностью» по долгу `3.3333 USD` (поле показывает `3.33`) → баланс ровно 0, друга можно удалить.

## Открытые вопросы

1. Проверено (review B, m10): ничьи остатка — по порядку `participantIds` запроса (стабильная сортировка,
   `ShareDistribution.kt:41-63`, порядок сохраняется в `LedgerEntryCommandService.kt:408-421`). Вопрос закрыт.
2. ASSUMPTION: refresh token приходит httpOnly-cookie через same-origin `/api` rewrite
   (`02-routing-state-pwa.md:105`). Если FE хранит его сам, офлайн-старт (1.6) не меняется, но меняется
   спека 04.
3. Лимиты 50 операций / 14 дней / persist 14 дней — подтверждено владельцем 2026-10-28 (D20).
4. «Ваша доля» pending-расхода в `OutboxSheet` (§3) с явной подписью — подтверждено владельцем 2026-10-28 (D20).
5. Владельцу (вынесено в 00 «Подтверждения», до старта указанных PR): (a) толкование D21 — lossless-транспорт в обёртке
   + конверсия в мапперах (шапка; до 03-4b); (b) D3: outbox `networkMode: 'always'` вместо paused (§2.1; до 03-15a);
   (c) D4: buster по форме доменной модели вместо zod на кэше IDB (§1.4; до 03-7a); (d) после «выйти на других
   устройствах» — офлайн-доступ к кэшу после expiry отключён, различение REVOKED/EXPIRED на backend — да/нет (§1.5);
   (e) settle-up «досыпает» до точного долга при разнице < 1 минорной единицы с подписью (§4.5; до 03-21);
   (f) фаза 2 D2 (группы/участники офлайн) без PR-id до 03-17 (§2.9).
