# Спека 03 — Data layer: TanStack Query, offline-outbox, money, OpenAPI-типы

Реализует решения D2, D3, D4, D5, D21 (заменяет D10), D19 (в части outbox) (и D12 в части сторов) из `specs/DECISIONS.md`.
Пути ниже даны относительно `src/` текущего репозитория `chipin-frontend`; после монорепо-переезда (D7)
префикс становится `apps/app/src/`. Целевые папки `shared/`, `entities/`, `features/` — из
`01-architecture.md` §8.

Идентификаторы PR — `03-<n>`, backend-issue — `BE-03-<n>` (глобальная схема, `00-overview.md`).

D10 withdrawn → D21: backend — источник истины, на проводе **навсегда** JSON-число scale 4 (строк на проводе нет,
backend-issue на строки не создаётся). Обёртка API конвертирует `number` → `bigint` scale 4 на входе и обратно на
выходе; домен — `Money { minor: bigint /* scale 4 */, currency }`, арифметики на float нет. Уточнения: (1) «integer
units» D21 — ledger units scale 4, как backend (`ShareDistribution.kt`); минорные единицы валюты — только для
отображения/ввода. (2) Модуль `money/` размещается как `src/shared/money/`. (3) D5 `version`/409 —
backend этого пока не имеет; офлайн-запись включается флагом только после BE-03-1/BE-03-2 (PR 03-17).

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
- `POST /ledger/entries` id не принимает (`LedgerCrudRequests.kt:17-22`). `DELETE` удалённой → уже 204
  (`LedgerEntryCommandService.kt:182`), `PATCH` удалённой → 404.
- OpenAPI 3.1 только runtime, `/swagger/documentation.yaml` под Basic auth, на prod выключен; snapshot в
  backend запрещён (`docs/openapi.md`).
- Access 1 ч, refresh 30 дней (`resources/application.yaml:16,18`). CORS: `Content-Type`, `Authorization`,
  `X-Refresh-Token` (`plugins/CORSPlugin.kt:13-15`). Заголовка версии клиента нет.

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

`queryRetry(failureCount, error)`: 4xx → `false`; network error → `false` (offlineFirst сам ставит запрос на
паузу до reconnect); 5xx → `failureCount < 2`.

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

Infinite-запросы: при персисте обрезаются до первой страницы (`dehydrate` → `pages.slice(0,1)`,
`pageParams.slice(0,1)`), иначе кэш растёт неограниченно.

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
  persister: createAsyncStoragePersister({ key: queryCacheKey(userId), throttleTime: 1000,
    storage: { getItem: get, setItem: set, removeItem: del },   // idb-keyval
    serialize: identity, deserialize: identity }),              // structured clone, без JSON
  maxAge: PERSIST_MAX_AGE,
  buster: `${QUERY_CACHE_SCHEMA}:${OPENAPI_SPEC_HASH}`,
  dehydrateOptions: { shouldDehydrateQuery: q => q.state.status === 'success' && q.meta?.persist !== false,
                      shouldDehydrateMutation: () => false },   // мутации персистит outbox (2.3)
});
```

- `OPENAPI_SPEC_HASH` пишет генератор (§5): любое изменение контракта отбрасывает кэш — это замена
  zod-валидации кэша. `QUERY_CACHE_SCHEMA` (`shared/offline/constants.ts`) поднимается руками при смене маппера.
- `meta: { persist: false }` — premium promo, stats. Ошибка IDB (Safari private, квота) → Sentry
  `offline.persist_failed` раз за сессию, работа без персиста.

#### 1.5 Привязка к пользователю, logout, смена аккаунта

- `LocalUser` (`helpers/localStorage.ts`) получает `id: string`, чтение через zod `LocalUserSchema`
  (невалидно → fallback): `userId` нужен до restore, а офлайн `users/self` не загрузить.
- `app/providers/QueryProvider.tsx`: нет `userId` → `QueryClientProvider` без персиста; есть →
  `<PersistQueryClientProvider key={userId} client={clientFor(userId)} persistOptions={persistOptions(userId)}
  onSuccess={onRestored}>`. Два пользователя никогда не делят один `QueryClient`.
  `onRestored` = `await restoreOutbox(client, userId)` (2.3) → `client.resumePausedMutations()`.
- `clearUserData(userId)` (`shared/offline/clearUserData.ts`): `queryClient.clear()`, `del` query-ключа и всех
  outbox-ключей пользователя; в `LS_KEY_USER` остаётся только `{ settings }` (без `id`/`role` — как
  `clearLocalUserRole` из 01-1: язык/тема лендинга после выхода читаются из `settings`). Вызывается при `signOut`, при
  BroadcastChannel logout и при входе Y, когда `LocalUser.id === X ≠ Y` (диалог «На устройстве N
  неотправленных операций аккаунта X. Удалить и войти?»). Непустой outbox → `signOut` спрашивает подтверждение.
- **Истечение сессии ≠ logout**: `expireSession` не вызывает `resetAuthScopedStores()`; кэш, outbox и
  черновик сохраняются, показывается `AuthModal`, после входа тем же `userId` очередь продолжается
  (закрывает finding 11, `02-routing-state-pwa.md:22`).

#### 1.6 Гейт гидрации при старте

- Пока `useIsRestoring()`, рендерится shell (header + skeleton), не роуты — иначе запросы затрут кэш.
  Таймаут restore 3 с → старт без кэша, Sentry `offline.restore_timeout`.
- Офлайн-холодный старт: `useCheckSignIn` (`hooks/useCheckSignIn.tsx:55-91`) при network error на refresh и
  наличии `LocalUser.id` + session hint ставит `AUTHENTICATED` + новое поле `sessionMode = 'offline-cached'`;
  guards (спека 04 §2.3, `requireSession`) пускают к кэшу. При reconnect `refreshAuthSession()`: 401 → `expireSession()`, успех →
  `sessionMode = 'online'`, outbox-гейт открывается.

#### 1.7 Refetch на focus/reconnect

- `focusManager` (`visibilitychange`) закрывает «PWA открыт днями со старыми балансами».
- `onlineManager`: дефолтные события + network error при `navigator.onLine === true` → `GET /health`
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

`entities/ledger/api/mutations.ts` → `registerLedgerMutationDefaults(client)`, вызывается в `createQueryClient()`
**до hydrate**: иначе у восстановленных мутаций нет `mutationFn` и `resumePausedMutations` их не выполнит.

```ts
export const ledgerMutationKeys = { createExpense: ['ledger','createExpense'], updateExpense: ['ledger','updateExpense'],
                                    deleteEntry: ['ledger','deleteEntry'] } as const;
client.setMutationDefaults(ledgerMutationKeys.createExpense, {
  mutationFn: (op: CreateExpenseOp) => runOutboxOp(op),
  scope: { id: OUTBOX_SCOPE },   // 'outbox' — строго последовательно
  networkMode: 'offlineFirst', retry: outboxRetry,
  retryDelay: attempt => Math.min(1000 * 2 ** attempt, 60_000), meta: { outbox: true } });
```

Компоненты зовут только `useCreateExpense()`/`useUpdateExpense()`/`useDeleteEntry()` (передают `mutationKey`,
не `mutationFn`). `variables` — сериализуемый `OutboxOp` (JSON-примитивы, суммы — wire-числа scale 4 через `moneyToWire`):

```ts
type OutboxOpBase = { opId: string; createdAt: number; schema: 1 };
type CreateExpenseOp = OutboxOpBase & { kind: 'createExpense'; entryId: string; groupId: string | null; draft: ExpenseDraftWire };
type UpdateExpenseOp = OutboxOpBase & { kind: 'updateExpense'; entryId: string; baseVersion: number | 'fromCache'; patch: ExpensePatchWire };
type DeleteEntryOp   = OutboxOpBase & { kind: 'deleteEntry'; entryId: string; baseVersion: number | 'fromCache' };
```

`baseVersion: 'fromCache'` — правка/удаление за неотправленным create того же `entryId`: `runOutboxOp` берёт
версию из `['ledger','entry',entryId]` в момент выполнения (её записал `onSuccess` create).

`outboxRetry(failureCount, error)`: network error → `true` (offlineFirst держит паузу, пока offline);
5xx → `true` (бесконечно, backoff до 60 с, в UI статус «Сервер недоступен, повторим»); 4xx/409 → `false`.

#### 2.2 Оптимистичные обновления и откат

Activity — серверная проекция событий (`api/activity.types.ts`); подделывать события хрупко. Поэтому
**оптимистичное состояние — оверлей из очереди, а не запись в серверные кэши**:
- `useOutboxOverlay()` = `useMutationState({ filters: { mutationKey: ['ledger'], status: 'pending' } })` + failed
  (2.5) → `{ pendingCreates, pendingUpdatesByEntryId, pendingDeletes }`. В ленте: сверху блок «Не отправлено»;
  `entryId ∈ pendingDeletes` — зачёркнуто, «будет удалено»; pending update — «изменено, не отправлено»
  (`entryId` есть в activity, `api/activity.types.ts:51,95`). Откат автоматический: мутация ушла — оверлей пересчитан.
- `['ledger','entry',id]` — классика: `onMutate` (`cancelQueries` + snapshot + `setQueryData`), `onError` для
  4xx/409 → snapshot, `onSettled` → инвалидация `ledger.entry(id)`, `groupKeys.detail/activity(groupId)`,
  `['activity']`, `['dashboard']`, `['users','known']`. Этот список заменяет fan-out `groupsStore.ts:133-155`.

#### 2.3 Персист outbox

Файл `shared/offline/outboxPersistence.ts`.
- Ключ `chipin:outbox:<userId>:<tabId>`; `tabId = crypto.randomUUID()`, вкладка держит Web Lock `chipin-tab:<tabId>`.
- Запись по событиям `mutationCache` для `meta.outbox`: `dehydrate(client, { shouldDehydrateQuery: () => false,
  shouldDehydrateMutation: m => m.meta?.outbox === true && m.state.status !== 'success' })`, `pending` пишется
  с `isPaused = true` (иначе in-flight после hydrate «висит»). `enqueue()` ждёт `persistNow()` до тоста
  «Сохранено, отправим при появлении сети».
- `restoreOutbox`: свой ключ + **осиротевшие** ключи того же `userId` (их `chipin-tab:*` нет в
  `navigator.locks.query().held`); каждая `variables` → zod `OutboxOpSchema` (union по `kind`, `schema` для
  миграций), невалидные → failed `unreadable`; сортировка по `createdAt`; после `hydrate` сироты удаляются.
- Дубли между вкладками безопасны по D5: create идемпотентен, delete удалённого = успех, PATCH-дубль → 409,
  который `runOutboxOp` считает успехом, если `current` совпадает с `patch` («self-conflict»).

#### 2.4 Порядок

- `scope: { id: 'outbox' }` — TanStack v5 выполняет мутации по одной в порядке постановки, и после reload тоже.
- `outboxGate` (`shared/offline/outboxGate.ts`) — барьер перед отправкой в `runOutboxOp`; закрыт при
  `sessionMode !== 'online'`, блокирующей failed-операции, 426. Выводится из персистентных данных.

#### 2.5 Обработка ошибок

| Ответ | Действие |
|---|---|
| 2xx | успех; `setQueryData` для entry из ответа (включая новую `version`) |
| network / 5xx | retry (2.1), операция остаётся pending |
| 401 | interceptor делает refresh. Если refresh не удался → `expireSession()`, гейт закрыт по `auth`, операция не считается упавшей |
| 400 / 422 (валидация) | failed `validation`, гейт закрыт |
| 403 (нет доступа к группе / исключён) | failed `forbidden`, гейт закрыт |
| 404 на PATCH | failed `deletedRemotely` |
| 404/204 на DELETE | успех |
| 409 `LEDGER.VERSION_CONFLICT` | failed `conflict` с `current` из тела |
| 409 `LEDGER.ID_CONFLICT` на create | failed `idConflict` (не должно случаться; Sentry) |
| 410 `LEDGER.ENTRY_DELETED` на create-дубль | успех-no-op, убрать из оверлея |
| 426 `CLIENT.OUTDATED` | гейт закрыт по `outdated`, операция pending, экран обновления |

Failed-операция удаляется из mutation cache и пишется в `chipin:outbox-failed:<userId>` (zod-схема
`FailedOpSchema = { op: OutboxOp, reason, current?: LedgerEntry, failedAt }`).
**Любая failed-операция блокирует очередь**: следующие могут зависеть от неё (правка того же расхода).

`features/offline-queue/OutboxSheet.tsx` (из баннера/бейджа в header): pending со статусом («ждёт сети» /
«отправляется» / «сервер недоступен») и failed с причиной. Действия failed: «Повторить» (кроме `conflict`),
«Отменить операцию», для `conflict` — «Разобраться» (2.6), для `deletedRemotely` — «Создать как новый расход».
«Повторить» вызывает `runOutboxOp(op)` **напрямую, вне scope** при закрытом гейте — ничего не обгоняет; успех →
гейт открыт. Discard pending = `mutationCache.remove`; для create удаляются и зависимые операции того же
`entryId` (подтверждение «и N связанных правок»).

#### 2.6 Конфликт 409

`ConflictDialog` (`features/offline-queue/`): «Расход изменили на другом устройстве», таблица отличающихся
полей (сумма, валюта, описание, дата, плательщик, участники, деление, категория), «Ваша версия» / «Сейчас на
сервере». «Оставить мою» — повтор с `baseVersion = current.version` (осознанный last-write-wins, напрямую);
«Взять с сервера» — discard + `setQueryData(entry, current)`. Delete-конфликт: «Удалить всё равно» / «Не
удалять». Пока конфликт не разобран, гейт закрыт.

#### 2.7 Client UUID и create

`entryId = crypto.randomUUID()` создаётся при открытии формы (повторный сабмит несёт тот же id) и уходит
полем `id` в `POST /ledger/entries` (BE-03-2). До BE-03-2 офлайн-create выключен флагом.

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
(`BigDecimalJsonNumberSerializer` пишет literal scale 4); (3) `moneyFromWire` отклоняет `|v| ≥ 9e11` и
нецелый результат `v * 10⁴` (с допуском 1e-6) с `MoneyRangeError` + Sentry, а не округляет молча; (4) смена scale —
одна константа с каждой стороны (`LEDGER_SCALE` на FE, `MONEY_SCALE` на backend), меняются синхронно.

Арифметика в `bigint` «ledger units» = 10⁻⁴; минорные единицы валюты — **только** для отображения и
ограничения ввода. Причина: backend делит и считает балансы со scale 4 для всех валют
(`ShareDistribution.kt:7`); делёж в центах даёт другой остаток — текущая ошибка `expenseModalSelectors.ts:106-174`.

#### 4.2 API (`shared/money/index.ts` — единственный публичный вход)

| Функция | Сигнатура | Поведение |
|---|---|---|
| `currencyCode` | `(s: string) => CurrencyCode` | upper-case + проверка `^[A-Z]{3}$`, иначе throw |
| `minorUnits` | `(c: CurrencyCode) => 0 \| 2 \| 3` | таблица `MINOR_UNITS` (ISO 4217): 0 — BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF; 3 — BHD IQD JOD KWD LYD OMR TND; остальные 2. Не через Intl (у разных движков расхождения) |
| `moneyFromWire` | `(v: number, c) => Money` | `BigInt(Math.round(v * 10 ** LEDGER_SCALE))` после проверок `Number.isFinite`, `|v| < 9e11` и «`v * 10⁴` целое» (иначе throw `MoneyRangeError` + Sentry). Вызывается только в обёртке `api()`/мапперах `toX()` |
| `moneyToWire` | `(m: Money) => number` | `Number(m.minor) / 10 ** LEDGER_SCALE` (единственное разрешённое место; точно в пределах 9e11) |
| `parseMoneyInput` | `(raw: string, c) => Money \| null` | ввод пользователя: trim, убрать пробелы/NBSP, один разделитель `,` или `.`, дробных цифр ≤ `minorUnits(c)`, ≥ 0. Заменяет `parseAmountInput` (`helpers/numbers.ts:302`) |
| `toUnits` / `fromUnits` | `Money → bigint` / `(bigint, c) → Money` | |
| `add`, `sub`, `negate`, `abs` | `(a, b) => Money` | разные валюты → throw `CurrencyMismatchError` |
| `sum` | `(list: Money[], c) => Money` | пустой → zero |
| `compare`, `isZero`, `sign` | | `sign` → `-1 \| 0 \| 1` |
| `roundToMinor` | `(m) => Money` | half-up **от нуля** (как `RoundingMode.HALF_UP` и текущий `roundHalfUp` из `helpers/numbers.ts:95`) до `minorUnits`, результат снова scale 4 |
| `displaySign` | `(m) => -1 \| 0 \| 1` | `sign(roundToMinor(m))`. **Единственное правило «должен/должны/в расчёте»**: 0.0040 USD → 0 («в расчёте»), так как пользователь видит 0.00 |
| `split` | `(total: Money, weights: readonly string[]) => Money[]` | точная копия `distributeAmount`: `floor(units*w/W)`, остаток по 1 единице на наибольшие остатки, ничьи — по индексу (стабильная сортировка). Веса: AUTO = все `'1'`, SHARES = веса, PERCENTAGE = проценты. Пустой список → `[]`, `W <= 0` → throw |
| `convert` | `(m, rate: string, target) => Money` | приблизительно (курсы), half-up до scale 4; результат помечен в типах `ApproxMoney` (brand) — нельзя передать в `moneyToWire` |
| `formatMoney` | `(m, opts?: { locale?; currencyDisplay?: 'symbol' \| 'code'; signDisplay?: 'auto' \| 'always' \| 'exceptZero'; compact?: boolean }) => string` | `roundToMinor` → `Intl.NumberFormat(locale, { style:'currency', currency, minimumFractionDigits: mu, maximumFractionDigits: mu })`. На вход идёт decimal-строка, собранная из `minor` (ES2023 `format(string)` — без потери точности); кэш форматтеров по `locale+currency+opts` |
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

Lint эвристичен; главная защита — тип `minor: bigint` (`a.minor * 2` и `a.minor + 0.5` не скомпилируются). Не-денежные
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

Grep-оценка: 29 строк с `roundMoney|parseFloat|Number(` в `store/ helpers/ components/ features/ pages/
basics/`, не все про деньги. Финальный список даёт lint в режиме warn в PR 03-1.

### 5. Генерация типов из OpenAPI

#### 5.1 Выбор: axios + `openapi-typescript` + тонкая обёртка

`openapi-fetch` не берём: (1) 223 строки interceptors (refresh-on-401 с версией сессии, Web Locks,
retry-флаг, детект аутэйджа) покрыты `chipin.interceptors*.test.ts` — переписывать auth на middleware без
пользы рискованно; (2) `fetch` не даёт upload-прогресс (`usersApi.ts:45`, `groupsApi.ts:46`); (3) 10 файлов
`api/*.test.ts` мокают axios. Обёртка даёт ту же типобезопасность путь→тело→ответ.

#### 5.2 Где лежит

- `openapi/chipin.yaml` — снимок спеки **в FE** (запрет `docs/openapi.md` касается backend).
- `src/shared/api/generated/schema.d.ts` (commit, руками не правится, eslint/prettier ignore) и `specHash.ts`
  (`OPENAPI_SPEC_HASH` = первые 12 символов sha256 yaml).
- `src/shared/api/client.ts` — обёртка `api()`; `src/shared/api/http.ts` — `apiInstance` + interceptors из `api/`.

#### 5.3 Скрипты

```jsonc
"api:fetch": "node scripts/api/fetch-openapi.mjs",   // GET $CHIPIN_CONTRACT_BASE_URL/swagger/documentation.yaml, Basic auth из env (те же секреты, что contract-tests); пишет openapi/chipin.yaml с сортировкой ключей
"api:gen":   "openapi-typescript openapi/chipin.yaml -o src/shared/api/generated/schema.d.ts && node scripts/api/write-spec-hash.mjs",
"api:check": "npm run api:gen && git diff --exit-code -- src/shared/api/generated"
```

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

- Подстановка `{param}` **всегда** через `encodeURIComponent` — закрывает класс path traversal из D1 для
  всех эндпоинтов, а не только invite.
- Ошибки — `ApiError { status, code, details, current? }` из `getApiErrorPayload` (`helpers/errors.ts`).

#### 5.5 CI

- PR-check (блокирующий, без сети): `npm run api:check`.
- Drift-check (раз в сутки + `workflow_dispatch`, рядом с `contract-smoke.yml`): `api:fetch` со staging →
  `api:gen` → при diff открыть/обновить issue «OpenAPI drift». PR не блокирует (staging опережает prod).
- Синхронизация — отдельный PR «chore(api): sync openapi».

#### 5.6 Вывод ручных типов из оборота

1. `api/chipin.raw.types.ts`: `Api*` → алиасы `components['schemas'][…]`, по домену за PR; затем файл удаляется.
2. `api/chipin.types.ts` → доменные типы `entities/*/model/types.ts` с `Money`; мапперы `toX()` — граница
   (`moneyFromWire`, Unix-секунды → ms). `api/chipin.params.ts` удаляется (`Body<Op<…>>`).
3. `contract-tests/core-api.contract.ts` (877 строк): проверки путей полей удаляются (их гарантирует
   компилятор); остаются auth/session и runtime-семантика (`hasExpectedAutoShares`).

#### 5.7 zod только на границах

zod-схемы есть ровно для: `LocalUserSchema` (localStorage), `OutboxOpSchema`, `FailedOpSchema` (IDB),
`BroadcastChannel`-сообщений logout. Ответы API zod **не** валидируются: формат гарантирует генерация +
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
| 6 | `expenseModalStore.ts` + selectors/mapping/update (~1.6k) — **сначала split, потом outbox** | (a) PR: сетевые вызовы submit/update/delete → `entities/ledger/api/mutations.ts` (online, без outbox); черновик остаётся в zustand; (b) PR: split-математика → `money.split`, цикл store↔selectors убрать (`expenseModalSelectors.ts` получает state аргументом, store его не импортирует); (c) PR: co-location в `features/add-expense/` | высокий: деньги. Перед (b) — snapshot-тесты текущих превью долей, расхождения с backend фиксируются как исправления. Не последним: outbox (фаза 1) зависит от (a) |
| 7 | `authStore.ts` (183) | остаётся zustand (статус сессии — клиентское состояние); `resetAuthScopedStores` → `clearUserData` (logout) и ничего (expiry) | средний: импорт 7 сторов исчезает |
| 8 | `loadingStore.ts`, `errorsStore.ts` (+ selectors) | удаляются; `isPending`/`error` из хуков | низкий, но последний: удаляется, когда счётчик `useLoadingStore` = 0 |
| 9 | `backendAvailabilityStore.ts` | `connectivityStore` (1.8) | низкий |
| 10 | `pwaStore.ts` | остаётся (UI) | — |
| 11 | `store/internal/resourceRequests.ts` | удаляется после шага 5 (dedupe/abort даёт Query через `signal`) | низкий |

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
| BE-03-1 | Ledger: `version` + optimistic locking | `version: Long` в `LedgerEntryInfo`/`LedgerExpenseInfo` = число событий записи (CREATED=1, +1 на CORRECTED), из `expense_events`/`settlement_events`. `PATCH`/`DELETE` принимают `If-Match: "<version>"`. Несовпадение → **409** `{ code: "LEDGER.VERSION_CONFLICT", current: LedgerEntryInfo }`. Без `If-Match` — как сейчас (last-write-wins) до enforcement через BE-03-5. CORS: `allowHeader(If-Match)` | PR 03-17 (offline update/delete) |
| BE-03-2 | Идемпотентный create по client id | `CreateLedgerEntryRequest.id: uuid` (optional). Новый → 201. Тот же id, тот же автор, тот же payload → 200 с существующей записью. Тот же id, другой payload/автор → 409 `LEDGER.ID_CONFLICT`. Id удалённой записи → 410 `LEDGER.ENTRY_DELETED` | PR 03-17 (offline create) |
| ~~BE-03-3~~ | — | **снят по D21**: провод остаётся JSON-числом scale 4, backend не меняется. Номер не переиспользуется | — |
| BE-03-4 | Качество OpenAPI | уникальный `operationId` на каждую операцию; все тела — именованные `components.schemas`; ответы 409/410/426 в ошибках операций; детерминированный порядок ключей; gradle-задача/тест, который пишет `build/openapi/documentation.yaml` (CI artifact) — альтернатива fetch со staging; унификация `netBalance`/`netAmount` (опционально, с версионированием) | §5 |
| BE-03-5 | Новый заголовок `X-Client-Version` + конфиг `MIN_CLIENT_VERSION` → 426 | Проверено: версионирования API в backend нет, FE версию сейчас не шлёт. FE (03-20) добавляет заголовок `X-Client-Version: <APP_VERSION>` одной строкой в axios request-interceptor (`APP_VERSION` из `src/constants/version.ts`, инжектится через Vite `define`). Backend-конфиг `MIN_CLIENT_VERSION` (env, по умолчанию пусто = выключено). Ниже минимума → **426** `{ code: "CLIENT.OUTDATED", minVersion }` для всех `/api` кроме `/health`, `/auth/refresh`, `/auth/logout`. Каждый ответ несёт `X-Min-Client-Version`. Нет заголовка → пропуск (Postman, старые клиенты до rollout). CORS: `allowHeader(X-Client-Version)`, `X-Min-Client-Version` в `Access-Control-Expose-Headers` | **обязателен до включения outbox** (03-17); гейт outbox `outdated` |
| BE-03-6 | Тест-фиксатор «DELETE удалённого = 204» | поведение уже такое (`LedgerEntryCommandService.kt:182`), нужен тест, чтобы не регресснуло | — |
| BE-03-7 | Общие тест-векторы split | JSON `ledger-split-vectors.json` (total, weights, expected shares), который читают тесты backend и FE | §8 money |
| BE-03-8 (фаза 2) | `version` для групп + 409 на `PATCH /groups/{id}` и операциях с участниками | как BE-03-1 | фаза 2 |

Политика минимальной версии (D19, вариант A, подтверждено владельцем 2026-10-28). Сейчас — только принудительное
обновление SW через 24 ч (спека 04 §2.11 п. 3). До включения outbox (03-17) обязательны BE-03-5 и 03-20.
Правило 72 ч: `MIN_CLIENT_VERSION` поднимается **только** при несовместимом изменении контракта, и только
после того как новая версия FE пробыла в проде ≥ 72 ч. FE при 426 или
`X-Min-Client-Version > APP_VERSION` показывает блокирующий экран «Нужно обновить приложение»
(`updateServiceWorker(true)` или reload из `src/app/pwa/ServiceWorkerManager.tsx`, PR 04-2d; `helpers/swUpdates.tsx` к этому моменту удалён); outbox не удаляется, новая версия читает его
через `OutboxOpSchema` с миграциями по `schema`.

### 8. Тесты

Unit `shared/money/*.test.ts` (table-driven):
- `moneyFromWire`/`moneyToWire`: `85.5`→`855000n`→`85.5`, `-0`→`0n`, `0.1+0.2`→`3000n`, `9e11`→throw, `1.23456`→throw; round-trip 10⁵ случайных 4-знаковых сумм < 9e11 без потерь.
- `parseMoneyInput`: `"1 234,5"` (NBSP), `"0,"`, `"1.234"` USD→null / KWD→ok, `"-1"`→null.
- `roundToMinor`: `1.0050`→`1.0100`, `-1.0050`→`-1.0100`, `2.6750`→`2.6800` (USD); `0.5000 JPY`→`1.0000`; `1.2345 KWD`→`1.2350`.
- `displaySign`: `0.0040 USD`→0, `0.0050`→1, `-0.0049`→0.
- `split`: `100.0000/[1,1,1]`→`[33.3334,33.3333,33.3333]`; `0.0002/[1,1,1]`→`[0.0001,0.0001,0]`; 1000 случайных
  входов (seeded PRNG): сумма == total, каждая ≥ 0, детерминизм; векторы BE-03-7.
- `formatMoney`: `ru`/`en`/`pt-BR` × USD/JPY/KWD, отрицательные, `signDisplay`.

Persister (`fake-indexeddb/auto`): данные X не видны Y; buster mismatch чистит кэш, **outbox сохраняется**;
`maxAge` истёк → пусто; infinite персистится одной страницей; `clearUserData` удаляет все ключи пользователя;
IDB бросает на `set` → приложение работает, Sentry один раз.

Outbox (msw v2 `setupServer` + `onlineManager.setOnline`):
- create → update того же id → delete другого офлайн → online: запросы в этом порядке, update несёт `If-Match`
  из ответа create (`fromCache`).
- reload (новый клиент + `restoreOutbox` + `resumePausedMutations`) → те же запросы без дублей; «анти-пример»
  без `mutationDefaults` не выполняется (фиксирует 2.1).
- 422 на второй → третья не ушла, failed в `OutboxSheet`; discard → третья ушла.
- 409 → `ConflictDialog`; «Оставить мою» → повтор с `current.version`; «Взять с сервера» → кэш = current.
- DELETE 404 = успех; PATCH 404 = `deletedRemotely`; 5xx ×3 затем 200 → одна запись.
- 401 + refresh 401 → гейт `auth`; вход тем же userId → отправлено; другим → диалог и очистка.
- две «вкладки» (общий fake IDB, мок `navigator.locks`): сирота подхвачен, create-дубль → 200, без дублей.
- 51-я операция блокируется; старше 14 дней → `stale`.

Connectivity: `onLine=false` + network error → баннер; 503 + health 503 → страница; 500 + health 200 → ошибка запроса.

---

## Нюансы и подводные камни

- **Порядок hydrate**: `setMutationDefaults` до `hydrate`, иначе у восстановленных мутаций нет `mutationFn`.
- **In-flight при закрытии вкладки**: запрос мог дойти, ответ — нет; после reload он повторится. Безопасно
  только при BE-03-2 (create) и BE-03-1 (update/delete), поэтому офлайн-запись включается флагом после них.
- **`updatedAt` в секундах** не годится для locking (две правки в одну секунду неразличимы) → `version`.
- **JSON-числа**: `85.5000` после `JSON.parse` = `85.5`; `Math.round(v * 10⁴)` точен при `|v| < 9e11`; иначе Sentry.
- **`Intl.format(string)`** — ES2023; старый Safari приводит к number, в пределах 1e11 без потерь.
- **Финансовые данные в IDB не шифруются**: смягчение — `clearUserData` (см. 04-security).
- **Тесты с `vi.mock('store/…')`** (`01-architecture.md:259-261`) в PR миграции переписываются на msw +
  `renderWithQueryClient`, а не на новый мок-путь.
- **Нет Web Locks**: `tabId = 'single'`, одна очередь без адопции сирот.

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
| 03-4 | `openapi/chipin.yaml`, `api:*` скрипты, generated, обёртка `api()`, PR-check + drift-job | — |
| 03-5 | QueryClient, провайдер без персиста, `renderWithQueryClient`, eslint-plugin-query, пилот landing-stats, удалить `store/index.ts` | 03-4 |
| 03-6 | `connectivityStore`, классификация ошибок, `OfflineBanner`, страница только для backend-down | 03-5 |
| 03-7 | персистер кэша, `LocalUser.id` + zod, гейт гидрации, `clearUserData`, expiry без сброса | 03-5 |
| 03-8 | dashboard + currency rates | 03-5 |
| 03-9 | users-store | 03-5 |
| 03-10/11 | groups queries / groups mutations | 03-9 |
| 03-12 | activity + удаление `resourceRequests.ts` | 03-11 |
| 03-13 | expense modal: сеть → `entities/ledger/api/mutations.ts` (online) | 03-12 |
| 03-14 | expense modal: разрыв цикла store↔selectors, co-location `features/add-expense/` | 03-13 |
| 03-15 | outbox: mutationDefaults, персист outbox, гейт, вкладки; флаг `VITE_FEATURE_OFFLINE_WRITES=false` | 03-7, 03-13 |
| 03-16 | `OutboxSheet`, `ConflictDialog`, `<OnlineOnly>`, подпись у балансов | 03-15 |
| 03-17 | включить флаг для expenses | BE-03-1, BE-03-2, BE-03-5, 03-16, 03-20 |
| 03-18 | удалить `loadingStore`, `errorsStore`, их селекторы; остатки `useConnect` | 03-14 |
| ~~03-19~~ | снят по D21 (провод остаётся числом) | — |
| 03-20 | новый заголовок `X-Client-Version: APP_VERSION` (одна строка в axios-interceptor), обработка 426 и `X-Min-Client-Version` → блокирующий экран «Нужно обновить» из 04-2d | BE-03-5, 04-2d |

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

## Открытые вопросы

1. ASSUMPTION: порядок участников в `distributeAmount` = порядок `participantIds` в запросе (ничьи
   остатка). Проверить в backend при BE-03-7; если сервер сортирует, `money.split` сортирует так же.
2. ASSUMPTION: refresh token приходит httpOnly-cookie через same-origin `/api` rewrite
   (`02-routing-state-pwa.md:105`). Если FE хранит его сам, офлайн-старт (1.6) не меняется, но меняется
   спека 04.
3. Лимиты 50 операций / 14 дней / persist 14 дней — подтверждено владельцем 2026-10-28 (D20).
4. «Ваша доля» pending-расхода в `OutboxSheet` (§3) с явной подписью — подтверждено владельцем 2026-10-28 (D20).
