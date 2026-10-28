# Спека 03 — Data layer: TanStack Query, offline-outbox, money, OpenAPI-типы

Реализует решения D2, D3, D4, D5, D21 (заменяет D10), D19 (в части outbox) (и D12 в части сторов) из `specs/DECISIONS.md`.
Пути ниже даны относительно `src/` текущего репозитория `chipin-frontend`; после монорепо-переезда (D7)
префикс становится `apps/app/src/`. Целевые папки `shared/`, `entities/`, `features/` — из
`01-architecture.md` §8.

Идентификаторы PR — `03-<n>`, backend-issue — `BE-03-<n>` (глобальная схема, `00-overview.md`).

D10 withdrawn → D21: backend — источник истины, на проводе **навсегда** JSON-число scale 4 (строк на проводе нет,
backend-issue на строки не создаётся). Конверсия `number` ↔ `bigint` scale 4 — **только** в мапперах
`entities/*/model/toX()` / `toXWire()` (обёртка `api()` деньги не трогает; сырые суммы в сгенерированных типах —
opaque `WireAmount`, §4.3); домен — `Money { minor: bigint /* scale 4 */, currency }`, арифметики на float нет. Уточнения: (1) «integer
units» D21 — ledger units scale 4, как backend (`ShareDistribution.kt`); минорные единицы валюты — только для
отображения/ввода. (2) Модуль `money/` размещается как `src/shared/money/`. (3) D5 `version`/409 —
backend этого пока не имеет; офлайн-запись включается флагом только после BE-03-1/BE-03-2 (PR 03-17) **и** при
наличии runtime-capabilities от backend (§2.7).

Ревизия 2026-10-28 по review B (`../review-B-data.md`): B1–B3, M1–M14, m1–m11 — см. колонку Resolution там.

Зависимости от других спек:
- спека 01 (хотфикс D1: дедуп `roundMoney`, знак нулевого баланса — PR 01-3) смержена до PR 03-1;
- спека 04 (D6: data router, loaders, guards) использует `queryOptions` из этой спеки; loaders с prefetch
  (PR 04-2e) появляются только после PR 03-5; экран «Нужно обновить» и SW — PR 04-2d;
- спека 01 (PR 01-1 `clearLocalUserRole`, D16 «role из localStorage») — в PR 03-7 поглощается
  функцией `clearUserData()` из этой спеки (сохраняет только `settings`, как требует 01-1);
- спека 02: удаление `dexie` — PR 02-B1; запрет новых `useConnect.ts` — PR 02-C12; хелпер
  `restrictedSyntax()`/`restrictedImports()` и `config/eslint/project.js` — PR 02-C4.
- Монорепо (04-0): 03-1…03-4 можно делать до или после 04-0; 03-5 и далее — рекомендуемо после 04-0
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
5. HTTP остаётся на **axios** + типы `openapi-typescript` + тонкая типизированная обёртка.
6. `shared/money/`: `Money { minor: bigint; currency }` (scale 4), арифметика в `bigint` (как backend),
   округление до минорных единиц валюты только для отображения.

---

## Детали

### 1. Query layer

#### 1.1 Зависимости

Добавить: `@tanstack/react-query`, `@tanstack/react-query-persist-client`,
`@tanstack/query-async-storage-persister`, `idb-keyval`, `zod`; dev: `@tanstack/eslint-plugin-query`,
`@tanstack/react-query-devtools` (только dev-сборка), `msw`, `fake-indexeddb`, `openapi-typescript`.
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

`queryRetry(failureCount, error)`: network error → `true` (в v5 `offlineFirst` ставит на паузу **только между
ретраями**: после неудачной первой попытки retryer видит offline и держит запрос `fetchStatus: 'paused'`,
`status` остаётся `success` с кэшем; с `retry: false` запрос ушёл бы в `error`); 5xx и 409 `SYSTEM.CONFLICT` →
`failureCount < 2` (backoff по умолчанию TanStack); остальные 4xx → `false`.

Правила, которые из этого следуют (проверяются ревью и тестом §8):
- Компоненты рендерят `data`, если она есть; ошибку показывают **только** при `data === undefined`
  (паттерн `const { data, error } = useXQuery(); if (data) … else if (error) …`). `isError` без проверки `data` запрещён.
- Loaders (спека 04): `restoreReady.then(…)` (§1.6, без `await` — инвариант 7 спеки 02), внутри
  `void queryClient.prefetchQuery(opts)` — не блокирует. Вернуть из цепочки `queryClient.ensureQueryData(opts)`
  разрешено только если `onlineManager.isOnline()` **и** `queryClient.getQueryData(opts.queryKey) === undefined`;
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
export const persistOptions = (userId: string) => ({
  persister: trimmingPersister(createAsyncStoragePersister({ key: queryCacheKey(userId), throttleTime: 1000,
    storage: { getItem: get, setItem: set, removeItem: del },   // idb-keyval
    serialize: identity, deserialize: identity })),             // structured clone, без JSON
  maxAge: PERSIST_MAX_AGE,
  buster: `${QUERY_CACHE_SCHEMA}:${OPENAPI_SPEC_HASH}`,
  dehydrateOptions: { shouldDehydrateQuery: q => q.state.status === 'success' && q.meta?.persist !== false
                        && !isEntryWithPendingOp(q.queryKey),     // оптимистичный entry не персистим (2.2)
                      shouldDehydrateMutation: () => false },   // мутации персистит outbox (2.3)
});
```

- `persistOptions(userId)` и `clientFor(userId)` мемоизируются по `userId` (`useMemo` в `QueryProvider` / `Map` в модуле):
  новый объект персистера на каждый рендер = повторный restore.
- `isEntryWithPendingOp(key)`: ключ `['ledger','entry',id]` и `id` есть в `outboxState.entryIds` (§2.3). После
  `restoreOutbox` все `entryId` из outbox инвалидируются — persisted-кэш и outbox пишутся независимо, после краша
  они могут расходиться, сервер — арбитр.

- `OPENAPI_SPEC_HASH` пишет генератор (§5) — sha256 нормализованных `paths` + `components.schemas` без ключей
  `description`/`example`/`examples` (правка текста документации кэш не сбрасывает): любое изменение контракта отбрасывает кэш — это замена
  zod-валидации кэша. `QUERY_CACHE_SCHEMA` (`shared/offline/constants.ts`) поднимается руками при смене маппера.
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
  leader-lock (§2.3); (2) `queryClient.clear()`; (3) `del` query-ключа, `chipin:outbox:<userId>` и
  `chipin:outbox-failed:<userId>`; (4) размонтировать провайдер (смена `key`). Иначе throttled-запись (1 с) или
  событие `mutationCache` после `del` возвращают данные X. В `LS_KEY_USER` остаётся только `{ settings }` (без `id`/`role` — как
  `clearLocalUserRole` из 01-1: язык/тема лендинга после выхода читаются из `settings`). Вызывается при `signOut`, при
  BroadcastChannel logout и при входе Y, когда `LocalUser.id === X ≠ Y` (диалог «На устройстве N
  неотправленных операций аккаунта X. Удалить и войти?»). Непустой outbox → `signOut` спрашивает подтверждение.
- **Истечение сессии ≠ logout**: `expireSession` не вызывает `resetAuthScopedStores()`; кэш, outbox и
  черновик сохраняются, показывается `AuthModal`, после входа тем же `userId` очередь продолжается
  (закрывает finding 11, `02-routing-state-pwa.md:22`).

#### 1.6 Гейт гидрации при старте

- Restore выполняется **до** создания роутера, вне React: `shared/offline/restore.ts` экспортирует
  `restoreReady: Promise<void>` (`persistQueryClientRestore` + `restoreOutbox`). Промис резолвится и при таймауте 3 с,
  и при ошибке IDB (Sentry `offline.restore_timeout` / `offline.persist_failed`) — никогда не reject. Все loaders
  (спека 04) возвращают цепочку `restoreReady.then(…)` (без `await`, инвариант 7 спеки 02); data router запускает начальные loaders при `createBrowserRouter`,
  до первого рендера, поэтому React-гейт `useIsRestoring()` один не спасает.
- После таймаута restore **отменяется**: флаг `restoreAborted = true`, поздний результат IDB игнорируется (не делает
  `hydrate`), иначе он перезапишет данные, загруженные после старта.
- Поэтому провайдер — обычный `QueryClientProvider` (не `PersistQueryClientProvider`, который стартует restore сам при mount): `bootstrapUserCache(userId)` = `persistQueryClientRestore` → `persistQueryClientSubscribe` (unsubscribe хранится для `clearUserData`), `onRestored` из §1.5 — его продолжение. Пока `restoreReady` не резолвлен, рендерится shell (header + skeleton), не роуты (`useRestoreReady()` вместо `useIsRestoring()`).
- Офлайн-холодный старт: `useCheckSignIn` (`hooks/useCheckSignIn.tsx:55-91`) при network error на refresh и
  наличии `LocalUser.id` + session hint ставит `AUTHENTICATED` + новое поле `sessionMode = 'offline-cached'`;
  guards (спека 04 §2.3, `requireSession`) пускают к кэшу. При reconnect `refreshAuthSession()`: 401 → `expireSession()`, успех →
  `sessionMode = 'online'`, `outboxGate.open('auth')` (§2.4).

#### 1.7 Refetch на focus/reconnect

- `focusManager` (`visibilitychange`) закрывает «PWA открыт днями со старыми балансами».
- `onlineManager`: v5 стартует с `online = true`; при bootstrap — `onlineManager.setOnline(navigator.onLine)`, затем
  probe ниже (иначе офлайн-холодный старт не паузит запросы до первого события `offline`).
- Дефолтные события + network error при `navigator.onLine === true` → `GET /health`
  (таймаут 5 с); неудача → `setOnline(false)` и проверка каждые 15 с (captive portal, «Wi-Fi без интернета»).

#### 1.8 Офлайн vs backend down

Новая классификация в `shared/api/errors.ts` (заменяет `isLikelyBackendOutageError`):

| Ситуация | Классификация | UI |
|---|---|---|
| `!navigator.onLine` или network error + `/health` тоже network error | `offline` | баннер «Нет сети. Показаны сохранённые данные» (неблокирующий), offline-only действия разрешены |
| online, ответ 502/503/504, `/health` отвечает 5xx | `backend-down` | текущий `BackendUnavailablePage` |
| online, одиночный 500 на конкретный запрос, `/health` = 200 | `request-error` | ошибка запроса (toast / errorElement роута) |
| 4xx | `client-error` | обработка в месте вызова |

- `backendAvailabilityStore` → `connectivityStore` (zustand): `{ mode: 'online' | 'offline' | 'backend-down' }`.
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

```ts
export const ledgerMutationKeys = { createExpense: ['ledger','createExpense'], updateExpense: ['ledger','updateExpense'],
                                    deleteEntry: ['ledger','deleteEntry'] } as const;   // контракт, не переименовывать (m9)
client.setMutationDefaults(ledgerMutationKeys.createExpense, {
  mutationFn: (op: CreateExpenseOp) => runOutboxOp(op),
  scope: { id: OUTBOX_SCOPE },   // 'outbox' — одна мутация за раз, строго по порядку постановки
  networkMode: 'always',         // ожидание сети/гейта — внутри runOutboxOp (2.4), не в retryer TanStack
  retry: false,                  // единственный механизм повторов — цикл runOutboxOp (2.4)
  // Отклонение от буквы D3 (offlineFirst + paused): пауза TanStack срабатывает только между ретраями и не знает
  // про гейт; ожидание в runOutboxOp покрывает и сеть, и auth/426. Restore по-прежнему через hydrate (isPaused=true)
  // + resumePausedMutations().
  onMutate, onError, onSettled,  // 2.2
  meta: { outbox: true } });
```

`variables` — сериализуемый `OutboxOp` (JSON-примитивы, суммы — wire-числа scale 4 через `moneyToWire`):

```ts
type OutboxOpBase = { opId: string; createdAt: number; schema: 1 };
type CreateExpenseOp = OutboxOpBase & { kind: 'createExpense'; entryId: string; groupId: string | null; draft: ExpenseDraftWire };
type UpdateExpenseOp = OutboxOpBase & { kind: 'updateExpense'; entryId: string; baseVersion: string | null; patch: ExpensePatchWire };
type DeleteEntryOp   = OutboxOpBase & { kind: 'deleteEntry'; entryId: string; baseVersion: string | null };
```

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

Файлы `shared/offline/outboxLeader.ts`, `outboxPersistence.ts`, `outboxChannel.ts`.
- **Лидер.** Каждая вкладка с `userId` вызывает
  `navigator.locks.request('chipin-outbox:<userId>', () => leaderSession())`, где `leaderSession` возвращает промис,
  резолвящийся только при logout/смене пользователя/unload. Вкладка, чей колбэк выполняется, — **единственный писатель**:
  восстанавливает, исполняет и персистит очередь. Остальные стоят в очереди за lock; при закрытии лидера браузер
  отдаёт lock следующей вкладке, она делает `restoreOutbox` из того же ключа — сирот и их адопции нет.
- **Один ключ** `chipin:outbox:<userId>` = `{ mutations: DehydratedState['mutations'], versions: Record<entryId, version> }`.
  Запись — только лидер, по событиям `mutationCache` для `meta.outbox`: `dehydrate(client, { shouldDehydrateQuery: () => false,
  shouldDehydrateMutation: m => m.meta?.outbox === true && m.state.status !== 'success' })`; `pending` пишется с
  `isPaused = true` (иначе in-flight после hydrate «висит»). Failed — `chipin:outbox-failed:<userId>` (2.5).
- **Последователи** (вкладки без lock) — read-only вид очереди: `outboxState` из сообщений лидера по
  `BroadcastChannel('chipin-outbox:<userId>')` (`state` при каждом изменении; при старте последователь шлёт
  `state-request`, а до ответа показывает содержимое IDB-ключа). Новая операция или действие из `OutboxSheet`
  («Повторить», «Отменить», решение конфликта) в последователе — сообщение `command { opId, … }` лидеру; лидер
  выполняет его, персистит и отвечает `ack { opId }`. Тост «Сохранено, отправим при появлении сети» — только после
  `ack` (в лидере — после `persistNow()`); нет `ack` за 3 с (смена лидера) → повтор команды; лидер дедуплицирует по
  `opId` (уже есть в `mutationCache` или в persisted → только `ack`). Сообщения — zod `OutboxChannelMessageSchema` (§5.7).
- `restoreOutbox(client, userId)` (только лидер): ключ → каждая `variables` → zod `OutboxOpSchema` (union по `kind`,
  `schema` для миграций), невалидные → failed `unreadable`; сортировка по `createdAt`; пропуск `opId`, уже
  присутствующих в `mutationCache` (идемпотентно при remount/StrictMode); `hydrate`; восстановление `outboxVersions`;
  если есть failed — гейт закрыт по `blocked` **до** `resumePausedMutations()`.
- Повтор in-flight операции после смены лидера/reload безопасен по D5: create идемпотентен по `id` (BE-03-2), delete
  удалённого = успех, PATCH несёт `X-Client-Op-Id: <opId>` — повтор уже применённой операции backend отвечает 200 с
  текущей записью (BE-03-1), глубокое сравнение `current` с `patch` не нужно.
- **Нет `navigator.locks` или `BroadcastChannel`** (старые браузеры): офлайн-запись выключена
  (`offlineWritesAvailable = false`), создание/правка/удаление расходов — только онлайн, как до 03-17; чтение кэша
  офлайн работает. Выборы лидера через `localStorage`/`storage`-события не делаем (гонка check-then-act).

#### 2.4 Порядок и гейт

- `scope: { id: 'outbox' }` — TanStack v5 запускает следующую мутацию scope только после того, как предыдущая
  **settled** (success или error), и в порядке постановки; после reload — в порядке hydrate. Поэтому порядок держится
  на одном правиле: **`runOutboxOp` settle-ится только успехом или терминальной ошибкой**; всё нетерминальное
  ждёт внутри него, мутация остаётся pending во главе scope и ничто её не обгоняет.
- `outboxGate` (`shared/offline/outboxGate.ts`) — **в памяти** лидера: `close(reason)`, `open(reason)`,
  `whenOpen(opts?): Promise<void>`, причины `auth | outdated | blocked`. Персистентные данные (failed-ключ) лишь
  восстанавливают `blocked` при restore; решение «можно ли отправлять» никогда не читается из IDB.

```ts
// Без async/await (инвариант 7 спеки 02): повтор = рекурсивный вызов из .catch, не цикл.
function runOutboxOp(op: OutboxOp, opts?: { ignore?: GateReason[] }, attempt = 0): Promise<OutboxResult> {
  const retry = (): Promise<OutboxResult> => runOutboxOp(op, opts, attempt + 1);
  return outboxGate.whenOpen(opts)                    // auth / outdated / blocked
    .then(() => waitForOnline())                      // shared/offline: подписка на onlineManager до isOnline()
    .then(() => { setStatus(op.opId, 'sending'); return sendOutboxOp(op); })   // 2xx и «успех-no-op» строки таблицы 2.5
    .catch((error: unknown) => {                      // retry() возвращается из catch — его reject сюда не попадает
      const c = classifyOutboxError(error);           // таблица 2.5
      if (c.kind === 'network') { setStatus(op.opId, 'waiting-network'); return retry(); }
      if (c.kind === 'transient') { setStatus(op.opId, 'server-unavailable'); return sleep(backoff(attempt)).then(retry); }
      if (c.kind === 'auth' || c.kind === 'outdated') { outboxGate.close(c.kind); return retry(); }
      outboxGate.close('blocked');                    // синхронно, ДО throw — следующая операция встанет на whenOpen
      recordFailed(op, c);                            // сначала в outboxState (память), затем асинхронно в IDB
      throw new OutboxTerminalError(c);
    });
}
const backoff = (n: number) => Math.min(1000 * 2 ** n, 60_000) * (0.8 + Math.random() * 0.4);
```

Единая политика повторов (заменяет прежние `outboxRetry`/`retry: outboxRetry`):

| Класс | Ответы | Поведение | Статус в UI |
|---|---|---|---|
| `network` | network error, timeout | ждать `online`, повтор сразу | «ждёт сети» |
| `transient` | 5xx, 409 `SYSTEM.CONFLICT` | backoff 1 с → 60 с ±20 %, бесконечно | «сервер недоступен, повторим» |
| `auth` | 401 после неудачного refresh (interceptor уже вызвал `expireSession()`) | гейт `auth`; открывает успешный вход тем же `userId` (`sessionMode = 'online'`) | «нужно войти» |
| `outdated` | 426 `CLIENT.OUTDATED` | гейт `outdated`; экран обновления (03-20) | «нужно обновить приложение» |
| терминальный | 400/422, 403, 404 PATCH, 409 `LEDGER.VERSION_CONFLICT`, 409 `LEDGER.ID_CONFLICT`, неизвестная версия | гейт `blocked`, failed, throw | причина failed |

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

Failed-операция удаляется из mutation cache и пишется в `chipin:outbox-failed:<userId>` (zod-схема
`FailedOpSchema = { op: OutboxOp, reason, current?: LedgerEntry, failedAt }`).
**Любая failed-операция блокирует очередь** (гейт `blocked`): следующие могут зависеть от неё (правка того же расхода).

`features/offline-queue/OutboxSheet.tsx` (из баннера/бейджа в header): pending со статусом из `statusByOpId`
(«ждёт сети» / «отправляется» / «сервер недоступен» / «нужно войти» / «нужно обновить») и failed с причиной.
Действия failed: «Повторить» (кроме `conflict`), «Отменить операцию», для `conflict` — «Разобраться» (2.6), для
`deletedRemotely` — «Создать как новый расход». «Повторить» вызывает `runOutboxOp(op, { ignore: ['blocked'] })`
**напрямую, вне scope** (ждёт `auth`/`outdated`, но не `blocked`) — остальные операции стоят на `whenOpen`, ничто не
обгоняет; успех → операция убрана из failed, и если failed пуст — `outboxGate.open('blocked')`. Discard pending =
`mutationCache.remove`; для create удаляются и зависимые операции того же `entryId` (подтверждение «и N связанных
правок»). В последователе эти действия — `command` лидеру (2.3).

#### 2.6 Конфликт 409

`ConflictDialog` (`features/offline-queue/`): «Расход изменили на другом устройстве», таблица отличающихся
полей (сумма, валюта, описание, дата, плательщик, участники, деление, категория), «Ваша версия» / «Сейчас на
сервере». «Оставить мою» — повтор с `baseVersion = current.version` (осознанный last-write-wins, напрямую);
«Взять с сервера» — discard + `setQueryData(entry, current)`. Delete-конфликт: «Удалить всё равно» / «Не
удалять». Пока конфликт не разобран, гейт закрыт.

#### 2.7 Client UUID, create и capabilities backend

`entryId = crypto.randomUUID()` создаётся при открытии формы (повторный сабмит несёт тот же id). Поле `id` в теле
`POST /ledger/entries` backend до BE-03-2 отвергает **400** (неизвестное поле), поэтому:
- Источник правды — runtime-capabilities: BE-03-2 добавляет в `GET /health` поле `capabilities: string[]`
  (`"ledger.clientEntryId"`; BE-03-1 — `"ledger.entryVersion"`; BE-03-5 — `"client.minVersion"`).
  FE: `capabilitiesQueryOptions` (`['meta','capabilities']`, staleTime 10 мин, persist да, `queryFn` = тот же `/health`;
  нет поля → `[]`). `useBackendCapability(name)` — единственный читатель.
- Тело create строит одна функция `toCreateLedgerEntryWire(draft, { clientEntryId })`; `id` кладётся, **только** если
  в момент отправки есть `ledger.clientEntryId`. Без него create — **только онлайн** (обычная мутация без outbox,
  `<OnlineOnly>` на кнопке сохранения в офлайне), id не отправляется. Поле `id` в типах появляется только после
  синхронизации OpenAPI с релизом backend, где оно есть (§5.3), — со старым снимком код с `id` не компилируется.
- `offlineWritesAvailable = VITE_FEATURE_OFFLINE_WRITES && capabilities ⊇ {ledger.clientEntryId, ledger.entryVersion,
  client.minVersion} && navigator.locks && BroadcastChannel` (§2.3). Отдельного `VITE_FEATURE_CLIENT_ENTRY_ID` нет.
- Откат backend после того, как capability закэширована: create с `id` → 400 → failed `validation`; следующий
  `/health` (refetch на focus/reconnect) снимает capability. Приемлемо, Sentry `outbox.capability_mismatch`.

#### 2.8 Лимиты

- Максимум **50** pending+failed на пользователя; дальше офлайн-создание/правка выключены («Слишком много
  неотправленных операций — подключитесь к сети»).
- Старше **14 дней** (refresh token 30 дней, `application.yaml:18`) → failed `stale` («Отправить всё равно» /
  «Отменить»), без автоудаления.

#### 2.9 Что разрешено офлайн

| Операция | Офлайн |
|---|---|
| Создать / изменить / удалить расход (группа и личный) | да, фаза 1 |
| Создать/переименовать группу, участники, обложка, выход, kick, инвайты | нет в фазе 1; фаза 2 — переименование и участники через тот же outbox |
| Settle-up / погашение / платёж | **никогда** |
| Аватар/обложка (upload) | никогда (multipart, прогресс) |
| Настройки пользователя (`PATCH /users/self`) | нет (фаза 2 по желанию) |
| Удалить друга, logout other devices | нет |

Механизм: `useRequiresOnline()` (из `connectivityStore` + `sessionMode`) и `<OnlineOnly>` вокруг кнопки:
офлайн → `disabled`, `aria-disabled`, tooltip «Нужно подключение к интернету»; вход в `GroupSettleUpFlow`
закрыт целиком. Константа `ONLINE_ONLY_ACTIONS` + тест, что каждое действие обёрнуто.

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

Провод — `number` scale 4 **навсегда** (D21). Почему это безопасно: (1) double точно различает все
4-знаковые суммы до ~9·10¹¹ (2⁵³ ≈ 9·10¹⁵ ledger units), поэтому `Math.round(v * 10⁴)` восстанавливает ровно то
значение, которое backend записал как `decimal(19,4)`; (2) backend никогда не отдаёт больше 4 знаков
(`BigDecimalJsonNumberSerializer` пишет literal scale 4); (3) `moneyFromWire` отклоняет `|v| ≥ 9e11` и значения,
не являющиеся 4-знаковыми, проверкой **round-trip** `r = Math.round(v * 1e4); Number(r) / 1e4 === v` (иначе
`MoneyRangeError` + Sentry, а не молчаливое округление). Проверка «`v * 10⁴` целое с допуском 1e-6» **запрещена**:
выше ~1e8 погрешность произведения больше 1e-6 (`746251344.6807 * 1e4 = 7462513446806.999`) — sweep 400k случайных
4-знаковых сумм < 9e11: допуск отклоняет ~15k валидных, round-trip — 0 отказов, 0 неверных `minor`, а `1.23456`,
`0.00005`, `85.50001` отклоняет; (4) смена scale —
одна константа с каждой стороны (`LEDGER_SCALE` на FE, `MONEY_SCALE` на backend), меняются синхронно.

Арифметика в `bigint` «ledger units» = 10⁻⁴; минорные единицы валюты — **только** для отображения и
ограничения ввода. Причина: backend делит и считает балансы со scale 4 для всех валют
(`ShareDistribution.kt:7`); делёж в центах даёт другой остаток — текущая ошибка `expenseModalSelectors.ts:106-174`.

#### 4.2 API (`shared/money/index.ts` — единственный публичный вход)

| Функция | Сигнатура | Поведение |
|---|---|---|
| `currencyCode` | `(s: string) => CurrencyCode` | upper-case + проверка `^[A-Z]{3}$`, иначе throw |
| `minorUnits` | `(c: CurrencyCode) => 0 \| 2 \| 3` | таблица `MINOR_UNITS` (ISO 4217): 0 — BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF; 3 — BHD IQD JOD KWD LYD OMR TND; остальные 2. Не через Intl (у разных движков расхождения) |
| `moneyFromWire` | `(v: WireAmount, c) => Money` | `Number.isFinite(v)`, `|v| < 9e11`, `r = Math.round(v * 1e4)`, `Number(r) / 1e4 === v` (round-trip), иначе throw `MoneyRangeError` + Sentry; результат `BigInt(r)`, `-0` → `0n`. Вызывается **только** в мапперах `entities/*/model/toX()` |
| `moneyToWire` | `(m: Money) => WireAmount` | `Number(m.minor) / 10 ** LEDGER_SCALE` (единственное разрешённое место; точно в пределах 9e11); вызывается только в мапперах `toXWire()` |
| `parseMoneyInput` | `(raw: string, c) => Money \| null` | ввод пользователя: trim, убрать пробелы/NBSP, один разделитель `,` или `.`, дробных цифр ≤ `minorUnits(c)`, ≥ 0. Заменяет `parseAmountInput` (`helpers/numbers.ts:302`) |
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
```

Главная защита — типы, lint — страховка:
- Сырые суммы в сгенерированных типах — opaque `WireAmount` (`type WireAmount = { readonly __wire: unique symbol }`,
  **не** number-brand): `openapi-typescript` `transform(schemaObject)` в `scripts/api/openapi-ts.config.mjs` заменяет
  `type: number` + `multipleOf: 0.0001` (backend аннотирует так каждое денежное поле, `@JsonSchema.MultipleOf(0.0001)`,
  `models/dto/LedgerCrudRequests.kt`) на `WireAmount`. Арифметика, сравнение и `Number()` над ним не компилируются;
  прочитать можно только через `moneyFromWire`.
- Домен — `minor: bigint` (`a.minor * 2` и `a.minor + 0.5` не скомпилируются).
- Единственное место конверсии — мапперы `entities/*/model/toX()` (вход) и `toXWire()` (выход). `api()` деньги не трогает.
- Lint эвристичен (по именам свойств) и ловит остатки в ещё не мигрированном коде; `Number(amount)` с идентификатором
  (как `settle-up-modal/internal/helpers.ts:50`) он не видит — такие места перечислены в §4.4. Не-денежные
`toFixed`/Intl (проценты, KMB `helpers/numbers.ts:236`) переезжают в `shared/lib/formatNumber.ts` (в `ignores`).
Правило вводится в `warn` (03-1), после миграции → `error` (03-3 для `entities/`, `features/`; остальное — по мере миграции, последним 03-18).
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
basics/`, не все про деньги. Финальный список даёт lint в режиме warn в PR 03-1.

#### 4.5 Settle-up: остаток меньше минорной единицы невозможен

Доли считаются в scale 4 (10/3 → 3.3334/3.3333/3.3333), ввод — в минорных единицах валюты. Правило:
- `owed: Money` — точный `abs(balance.net)` scale 4 из ответа backend, **никогда** не пересобирается из текста поля.
- Prefill поля = `roundToMinor(owed)`; если он `0` (долг < 1 минорной единицы) — одна минорная единица.
- `resolveSettleAmount(input: Money, owed: Money): Money | null` (`entities/balance/model/settle.ts`):
  `|input − owed| < oneMinor(c)` → **`owed` точно** (scale 4, «погасить полностью»); иначе `input > owed` → `null`
  (кнопка disabled); иначе `input` (частичное погашение, остаток ≥ одной минорной единицы).
  `oneMinor(c) = 10^(4 − minorUnits(c))` ledger units.
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
- `openapi/BACKEND_VERSION` — тег релиза backend, из которого взят снимок; это **версия, развёрнутая на prod** (не staging).
- `src/shared/api/generated/schema.d.ts` (commit, руками не правится, eslint/prettier ignore) и `specHash.ts`
  (`OPENAPI_SPEC_HASH` = первые 12 символов sha256 yaml).
- `src/shared/api/client.ts` — обёртка `api()`; `src/shared/api/http.ts` — `apiInstance` + interceptors из `api/`.

#### 5.3 Скрипты

```jsonc
"api:fetch": "node scripts/api/fetch-openapi.mjs",   // скачивает documentation.yaml из релиза backend с тегом openapi/BACKEND_VERSION (BE-03-4, `gh release download`); пишет openapi/chipin.yaml с сортировкой ключей
"api:fetch:staging": "node scripts/api/fetch-openapi.mjs --staging", // только для drift-отчёта: GET $CHIPIN_CONTRACT_BASE_URL/swagger/documentation.yaml, Basic auth
"api:gen":   "node scripts/api/gen-types.mjs && node scripts/api/write-spec-hash.mjs", // openapi-typescript (точная версия в devDependencies, без ^) + transform WireAmount (§4.3)
"api:check": "npm run api:gen && git diff --exit-code -- src/shared/api/generated"
```

- Синхронизация на новый тег backend — PR «chore(api): sync openapi to BE vX» с label `requires-backend: vX`;
  мержится только когда prod backend ≥ vX (чек-лист PR). Пока BE-03-4 не сделан — временно `api:fetch:staging`, и
  sync-PR требует подтверждения владельца, что prod на том же коммите backend.
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
- `api()` не конвертирует деньги (§4.3).

#### 5.5 CI

- PR-check (блокирующий, без сети): `npm run api:check`.
- Drift-check (раз в сутки + `workflow_dispatch`, рядом с `contract-smoke.yml`): `api:fetch:staging` →
  `api:gen` → при diff открыть/обновить issue «OpenAPI drift». Только отчёт, источником типов staging не бывает
  (staging опережает prod — `contract-smoke.yml:30` `api-dev`, на prod swagger выключен `SwaggerRoutes.kt:16-19`).
- Синхронизация — отдельный PR «chore(api): sync openapi».

#### 5.6 Вывод ручных типов из оборота

1. `api/chipin.raw.types.ts`: `Api*` → алиасы `components['schemas'][…]`, по домену за PR; затем файл удаляется.
2. `api/chipin.types.ts` → доменные типы `entities/*/model/types.ts` с `Money`; мапперы `toX()` — граница
   (`moneyFromWire`, Unix-секунды → ms). `api/chipin.params.ts` удаляется (`Body<Op<…>>`).
3. `contract-tests/core-api.contract.ts` (877 строк): проверки путей полей удаляются (их гарантирует
   компилятор); остаются auth/session и runtime-семантика (`hasExpectedAutoShares`).

#### 5.7 zod только на границах

zod-схемы есть ровно для: `LocalUserSchema` (localStorage), `OutboxOpSchema`, `FailedOpSchema` (IDB),
`BroadcastChannel`-сообщений logout и outbox (`OutboxChannelMessageSchema`, §2.3), тела 409
`LedgerConflictResponseSchema` (§2.5). Ответы API zod **не** валидируются: формат гарантирует генерация +
drift-check. Кэш запросов в IDB защищён buster = хэш спеки (1.4).

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
| 6 | `expenseModalStore.ts` + selectors/mapping/update (~1.6k) — порядок = таблица PR (авторитет) | (a) **03-2**: split-математика превью → `money.split` + snapshot-тесты превью долей; (b) **03-13**: сетевые вызовы submit/update/delete → `entities/ledger/api/mutations.ts` (online, без outbox); черновик остаётся в zustand; (c) **03-14**: цикл store↔selectors убрать (`expenseModalSelectors.ts` получает state аргументом) + co-location в `features/add-expense/` | высокий: деньги. Snapshot-тесты 03-2 обязаны оставаться зелёными **без изменений** в 03-13/03-14. Outbox (03-15) зависит от 03-13. File-lock ниже |
| 7 | `authStore.ts` (183) | остаётся zustand (статус сессии — клиентское состояние); `resetAuthScopedStores` → `clearUserData` (logout) и ничего (expiry) | средний: импорт 7 сторов исчезает |
| 8 | `loadingStore.ts`, `errorsStore.ts` (+ selectors) | удаляются; `isPending`/`error` из хуков | низкий, но последний: удаляется, когда счётчик `useLoadingStore` = 0 |
| 9 | `backendAvailabilityStore.ts` | `connectivityStore` (1.8) | низкий |
| 10 | `pwaStore.ts` | остаётся (UI) | — |
| 11 | `store/internal/resourceRequests.ts` | удаляется после шага 5 (dedupe/abort даёт Query через `signal`) | низкий |

**File-lock `src/store/expenseModal*` (+ `mapping`/`update`).** Последовательность PR по этим файлам:
01-3 → 02-C2 (Prettier) → 03-2 → 03-13 → 03-14 → затем 02-D-кодмоды и 05-4 (они пропускают эти файлы до мержа 03-14).
Одновременно открыт только один PR, трогающий эти файлы.

`store/index.ts` (мёртвый barrel) удаляется в PR 03-5. `src/test/renderWithQueryClient.tsx` — новый клиент
на тест (`retry: false`, `gcTime: Infinity`). В zustand остаются: `authStore`, `expenseModalStore` (черновик),
`uiPrefsStore` (appMode, view mode) и `appearanceStore` (тема, спека 05 PR 05-3) — оба в `src/store/ui-prefs/`,
`pwaStore`, `connectivityStore`, модалки; `no-restricted-imports` разрешает `zustand` только в `src/store/**`
и `src/app/**`.

**useConnect → useShallow (D12).** 17 файлов `useConnect.ts`, на них ссылаются 47 прод-файлов; удаляются в PR миграции своего стора (единственный владелец — эта спека).
Сервер — `useXQuery()`, UI — `useExpenseModalStore(useShallow(s => ({ amount: s.amount, setAmount: s.setAmount })))`.
Новые `useConnect` запрещает `scripts/check-file-layout.mjs` из спеки 02 (PR 02-C12, baseline только уменьшается).

### 7. Требования к backend (issues)

| ID | Issue | Детали | Блокирует |
|---|---|---|---|
| BE-03-1 | Ledger: `version` + optimistic locking + id операции | `version: String` (opaque, сравнение на равенство) в `LedgerEntryInfo`/`LedgerExpenseInfo` = `seq` последнего события записи (`expense_events`/`settlement_events`, `LedgerDbObjects.kt:35,61`) — без COUNT на каждом list-запросе. `PATCH`/`DELETE` принимают `If-Match: "<version>"` (до мержа — проверить на preview-деплое, что Vercel-прокси передаёт `If-Match`; если нет — заголовок `X-Entry-Version`, FE меняет одну константу). Несовпадение → **409** `LedgerConflictResponse { code: "LEDGER.VERSION_CONFLICT", current: LedgerEntryInfo }` — отдельная схема, описанная в OpenAPI как 409-ответ PATCH/DELETE (в `ErrorResponse` сущность не помещается). Транзиентный 409 `SYSTEM.CONFLICT` остаётся как есть (`ErrorResponse`). `PATCH` принимает `X-Client-Op-Id: <uuid>`, сохраняет его в событии; повтор с тем же op-id → 200 с текущей записью (не 409). Без `If-Match` — как сейчас (last-write-wins) до enforcement через BE-03-5. `/health.capabilities` += `"ledger.entryVersion"` | PR 03-17 (offline update/delete) |
| BE-03-2 | Идемпотентный create по client id | `CreateLedgerEntryRequest.id: uuid` (optional). Новый → 201. Тот же id + тот же автор → 200 с существующей записью **независимо от payload** (сравнение нормализованных тел не нужно). Тот же id, другой автор → 409 `LEDGER.ID_CONFLICT`. Id удалённой записи → 410 `LEDGER.ENTRY_DELETED`. `HealthResponse` получает optional `capabilities: List<String>` с `"ledger.clientEntryId"` (FE шлёт `id` только при нём, §2.7). Contract-тест на dev: POST с `id` → 201 | PR 03-17 (offline create); `id` в теле create вообще |
| ~~BE-03-3~~ | — | **снят по D21**: провод остаётся JSON-числом scale 4, backend не меняется. Номер не переиспользуется | — |
| BE-03-4 | Качество OpenAPI + артефакт по релизу | уникальный `operationId` на каждую операцию; все тела — именованные `components.schemas`; ответы 409/410/426 в ошибках операций; детерминированный порядок ключей; денежные поля сохраняют `multipleOf: 0.0001` (на нём держится `WireAmount`, §4.3); gradle-задача/тест (на базе `src/test/kotlin/common/testing/GeneratedOpenApiDocument.kt`) пишет `build/openapi/documentation.yaml`, CI прикладывает его к **каждому релизу-тегу** backend (release asset) — **основной** источник FE-типов (§5.3); унификация `netBalance`/`netAmount` (опционально, с версионированием) | §5 |
| BE-03-5 | Новый заголовок `X-Client-Version` + конфиг `MIN_CLIENT_VERSION` → 426 | Проверено: версионирования API в backend нет, FE версию сейчас не шлёт. `/health.capabilities` += `"client.minVersion"`. FE (03-20) добавляет заголовок `X-Client-Version: <APP_VERSION>` одной строкой в axios request-interceptor (`APP_VERSION` из `src/constants/version.ts`, инжектится через Vite `define`). Backend-конфиг `MIN_CLIENT_VERSION` (env, по умолчанию пусто = выключено). Ниже минимума → **426** `{ code: "CLIENT.OUTDATED", minVersion }` для всех `/api` кроме `/health`, `/auth/refresh`, `/auth/logout`. Каждый ответ несёт `X-Min-Client-Version`. Нет заголовка → пропуск (Postman, старые клиенты до rollout). CORS: `allowHeader(X-Client-Version)`, `X-Min-Client-Version` в `Access-Control-Expose-Headers` | **обязателен до включения outbox** (03-17); гейт outbox `outdated` |
| BE-03-6 | Тест-фиксатор «DELETE удалённого = 204» | поведение уже такое (`LedgerEntryCommandService.kt:182`), нужен тест, чтобы не регресснуло | — |
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
fixture-тест «старый dehydrated outbox → отправлен новым клиентом без 400». `ledgerMutationKeys` — замороженный контракт.

### 8. Тесты

Unit `shared/money/*.test.ts` (table-driven):
- `moneyFromWire`/`moneyToWire`: `85.5`→`855000n`→`85.5`, `-0`→`0n`, `0.3`→`3000n`, `9e11`→throw, `1.23456`→throw,
  `0.00005`→throw, `85.50001`→throw; **`746251344.6807`→`7462513446807n`**, **`96689212322.2351`→`966892123222351n`**,
  `±899999999999.9999` ok. Sweep: 10⁵ случайных (seeded) `bigint` units с равномерным порядком 10⁰…10¹⁵ (< 9e15) →
  decimal-строка → `JSON.parse` → `moneyFromWire` даёт те же units, `moneyToWire` → то же число; 0 отказов
  (эталон: 400k без отказов, ветка с допуском 1e-6 давала ~15k отказов).
- `parseMoneyInput`: `"1 234,5"` (NBSP), `"0,"`, `"1.234"` USD→null / KWD→ok, `"-1"`→null.
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
правка `description` в yaml не меняет `OPENAPI_SPEC_HASH`; `maxAge` истёк → пусто; infinite персистится одной
страницей (через `trimmingPersister`); `clearUserData` удаляет все ключи пользователя, и событие `mutationCache` /
throttled-persist **после** logout ничего не пишет; IDB бросает на `set` → приложение работает, Sentry один раз;
restore дольше 3 с → старт без кэша, поздний результат не применяется; холодный старт с persisted-кэшем → 0 сетевых
запросов до резолва `restoreReady`; повторный mount провайдера не дублирует восстановленные мутации (`opId`).

Query retry: офлайн refetch запроса с кэшем → `fetchStatus: 'paused'`, `status: 'success'`, `data` прежняя, компонент
не показывает ошибку; loader при офлайне и пустом кэше не ждёт сеть (навигация завершается, скелетон).

Outbox (msw v2 `setupServer` + `onlineManager.setOnline`):
- create → update → update того же id → delete другого офлайн → online: запросы в этом порядке, первый update несёт
  `If-Match` из ответа create, второй — из ответа первого update (`outboxVersions`), ни одного запроса без `If-Match`.
- **Строгий порядок при медленном IDB**: запись failed-ключа задержана на 2 с; 422 на op1 → op2 не отправлен
  (msw считает 0 запросов op2), пока op1 не решён; то же для 401 (refresh 401) и 426 — op1 остаётся pending, op2 не ушёл.
- 409 `SYSTEM.CONFLICT` ×2 затем 200 → одна запись, операция ни разу не failed, `ConflictDialog` не открывался.
- reload (новый клиент + `restoreOutbox` + `resumePausedMutations`) → те же запросы без дублей; «анти-пример»
  без `mutationDefaults` не выполняется (фиксирует 2.1).
- 422 на второй → третья не ушла, failed в `OutboxSheet`; discard → третья ушла.
- 409 → `ConflictDialog`; «Оставить мою» → повтор с `current.version`; «Взять с сервера» → кэш = current.
- DELETE 404 = успех; PATCH 404 = `deletedRemotely`; 5xx ×3 затем 200 → одна запись.
- 401 + refresh 401 → гейт `auth`; вход тем же userId → отправлено; другим → диалог и очистка.
- две «вкладки» (общий fake IDB, мок `navigator.locks` с очередью lock, общий мок `BroadcastChannel`): лидер — первая;
  create во второй → `command` → выполнен лидером, `ack`, оверлей виден в обеих; закрыть лидера посреди запроса →
  вторая получает lock, restore, повтор (create-дубль → 200), итог без дублей; одновременный старт двух вкладок →
  ровно один restore; нет `navigator.locks` → офлайн-запись выключена, кнопки `OnlineOnly`.
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
- **JSON-числа**: `85.5000` после `JSON.parse` = `85.5`; `Math.round(v * 10⁴)` точен при `|v| < 9e11`; валидность —
  только round-trip (§4.1), не допуск; иначе Sentry.
- **`Intl.format(string)`** — ES2023; старый Safari приводит к number, в пределах 1e11 без потерь.
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
| 03-1 | `shared/money/` + unit-тесты, lint-правило §4.3 в `warn` (в `config/eslint/project.js`, если 02-C4 влит, иначе в `eslint.config.js`) | 01-3 |
| 03-2 | превью долей расхода на `money.split`, snapshot-тесты до/после | 03-1 |
| 03-3 | `entities/balance` (partition/aggregate/summary), удаление 6 копий, lint → `error` в `entities/`, `features/` | 03-1 |
| 03-4 | `openapi/chipin.yaml` + `BACKEND_VERSION`, `api:*` скрипты (transform `WireAmount`, пин версии), generated, обёртка `api()` на `encodePathSegment`, PR-check + drift-job | 01-1 |
| 03-5 | QueryClient, провайдер без персиста, `renderWithQueryClient`, eslint-plugin-query, пилот landing-stats, удалить `store/index.ts` | 03-4 |
| 03-6 | `connectivityStore`, классификация ошибок, `OfflineBanner`, страница только для backend-down | 03-5 |
| 03-7 | персистер кэша (`trimmingPersister`, skip entry с pending op), `LocalUser.id` + zod, `restoreReady` + гейт гидрации, `clearUserData` (порядок §1.5), expiry без сброса, `setOnline(navigator.onLine)` | 03-5 |
| 03-8 | dashboard + currency rates | 03-5 |
| 03-9 | users-store | 03-5 |
| 03-10/11 | groups queries / groups mutations | 03-9 |
| 03-12 | activity + удаление `resourceRequests.ts` | 03-11 |
| 03-13 | expense modal: сеть → `entities/ledger/api/mutations.ts` (online, без `id` в теле), `capabilitiesQueryOptions` | 03-12 |
| 03-14 | expense modal: разрыв цикла store↔selectors, co-location `features/add-expense/` | 03-13 |
| 03-15 | outbox: mutationDefaults + колбэки, `runOutboxOp` + in-memory гейт, `outboxVersions`, leader-lock + BroadcastChannel, персист outbox; флаг `VITE_FEATURE_OFFLINE_WRITES=false` | 03-7, 03-13 |
| 03-16 | `OutboxSheet`, `ConflictDialog`, `<OnlineOnly>`, подпись у балансов | 03-15 |
| 03-17 | включить флаг для expenses | BE-03-1, BE-03-2, BE-03-5, 03-16, 03-20 |
| 03-18 | удалить `loadingStore`, `errorsStore`, их селекторы; остатки `useConnect` | 03-14 |
| ~~03-19~~ | снят по D21 (провод остаётся числом) | — |
| 03-21 | settle-up на `Money`: `resolveSettleAmount`, prefill `roundToMinor`, «< 0.01», `toSettleUpWire` (§4.5) | 03-3 |
| 03-20 | новый заголовок `X-Client-Version: APP_VERSION` (одна строка в axios-interceptor), обработка 426 и `X-Min-Client-Version` (сравнение только `major.minor.patch`, §7) → гейт `outdated` + блокирующий экран «Нужно обновить» из 04-2d | BE-03-5, 04-2d |

## Тесты / критерии приёмки

1. В airplane mode установленный PWA открывает dashboard, группу и активность с данными последней сессии,
   без `BackendUnavailablePage`, с баннером.
2. Офлайн создать, изменить и удалить расход. Перезагрузить приложение офлайн: операции видны в
   «Не отправлено». Включить сеть: на сервере ровно эти изменения, в этом порядке, без дублей.
3. Изменить расход на устройстве A офлайн, тот же расход на B онлайн. A online → конфликт-диалог, оба
   варианта работают.
4. Settle-up, загрузка аватара, создание группы офлайн недоступны (disabled + tooltip).
5. Logout с непустой очередью → предупреждение; после logout IDB не содержит ключей пользователя.
6. Истечение сессии во время редактирования не теряет черновик и очередь.
7. `npm run api:check` зелёный; drift-job открывает issue при изменении staging-спеки.
8. Lint без warnings по money-правилам в `entities/`, `features/`, `pages/`.
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
