# Spec 01 — Хотфикс перед рефакторингом: безопасность инвайтов, деньги, спиннер

Решение: D1 (+ однострочные пункты D16). Репозиторий: `chipin-frontend`, целевая ветка `master` (канонический после FE#497).
Пути и строки проверены на коммите `3d0086e` (ветка `chore/issue-456-ds-gallery`); пути `src/**`, `vercel.json`, `.gitignore` пересверены с `origin/master` `522973a` (код `src/` совпадает); backend — `origin/develop` `0901ebb`.
Идентификаторы PR — глобальная схема `<спека>-<n>` (см. `00-overview.md`): здесь `01-1`, `01-2`, `01-3`; backend-issue — `BE-01-<n>`.
Порядок: все три PR мержатся **до** массового форматирования (02-C2) и до монорепо-переноса (04-0); пути ниже — `src/…` текущего корня.
Ревизия 2026-10-28 по review C1/C2/C3 (`review-C*.md`, колонка Resolution): C2-20 (состояние `error` + session guard), Minor C1-26/27, C2-21…24, C3-16/17/28/29. Хотфикс можно мержить.

## Цель

До старта рефакторинга (спеки 02–05) закрыть критичные дефекты маленькими PR, которые не зависят от будущей архитектуры:
1. Нельзя превратить ссылку-приглашение в произвольный авторизованный запрос (CSPT, F1).
2. Вход в группу/дружба по ссылке — только после явного подтверждения (F4).
3. Токены приглашений не уходят в Sentry/Vercel Analytics (F2).
4. Деньги в редакторе расходов округляются одной корректной функцией.
5. Нулевой баланс везде означает «рассчитались».
6. Публичная страница не зависает на `PageLoader` после синхронизации настроек.
7. Безопасные однострочные правки заголовков, `.gitignore`, роли в localStorage (D16).

## Контекст

- F1: `src/api/chipin.ts:87` — `` `/groups/invite/${inviteToken}` `` без кодирования; `src/hooks/useJoinInviteLink.tsx:16-30` шлёт POST сразу при открытии страницы. React Router 7 превращает `%2F` в параметре в `/` (`04-security.md`, §5 F1). Ссылка `/group/join/..%2F<groupId>%2Fmembers%2F<userId>%2Fkick` → `POST /api/groups/<groupId>/members/<userId>/kick` с токеном жертвы.
- Второе звено цепочки — Vercel external rewrite `/api/:path*` → `https://api.chipin.one/:path*` (`vercel.json:12-19`). Если Vercel декодирует `%2F` при подстановке `:path*`, upstream получает `/groups/invite/../<g>/members/<u>/kick` и нормализует его — тогда одного `encodeURIComponent` мало для любого непроверенного id-параметра (`/group/:groupId`, `/activity/:parentActivityId`). Поэтому `apiPath` не полагается на поведение прокси: каждый сегмент проходит allowlist `^[A-Za-z0-9_-]+$` (review B, M1).
- Важное уточнение к открытому вопросу «нормализует ли Ktor `..`»: для этого вектора **не важно**. Literal `..` в URL нормализует сам браузер (WHATWG URL при `XMLHttpRequest.open`) ещё до отправки — backend получает уже «чистый» `/groups/<uuid>/members/<uuid>/kick`, который проходит `asValidUuid`. Поэтому фикс обязан быть на клиенте; backend-проверка — только defense-in-depth для закодированных `%2E%2E`/`%2F`.
- Все интерполяции path-параметров в API-слое (14 мест, кодирует только одно):
  - `src/api/chipin.ts:52, 69, 74, 82 (groupId, userId), 87`
  - `src/api/groupsApi.ts:25, 44`
  - `src/api/ledgerApi.ts:67, 74, 86`
  - `src/api/activityApi.ts:46, 71`
  - `src/api/usersApi.ts:67` (уже `encodeURIComponent`), `:72`
- Формат токена на backend: `src/main/kotlin/common/InviteTokenGenerator.kt:9-16` — 32 случайных байта → Base64 URL-safe без паддинга → `.take(32)`. Итог: ровно 32 символа из `[A-Za-z0-9_-]` (192 бита). Генератор не менялся с создания (`5ff82cd`). Один генератор для групп (`GroupService.kt:70`) и друзей (`UserInviteRepository.kt:30`). Колонки `invite_token VARCHAR(64)` (`V3__…_add_groups.sql:62`, `V16__…_create_user_invite_links.sql:3`).
- Preview-эндпоинта для инвайта в группу **нет**: в `GroupRoutes.kt:109` только `post("/invite/{inviteToken}")`; GET-аналога нет.
- F2: `src/constants/telemetry.ts:1-3` + `src/helpers/telemetry.ts:19-27` закрывают `/group/join/`, `/friends/join/`, `/users/invite/`, но не API-путь `/groups/invite/<token>`. Sanitizer используется в `src/bootstrap/initializeSentry.ts:20-43` (breadcrumbs `url/from/to`) и `:44-70` (request, transaction), и в Vercel Analytics через `sanitizeTelemetryEvent`.
- Деньги: `roundMoney = Math.round(v*100)/100` — `src/store/expenseModalStore.ts:161` и `src/store/expenseModalSelectors.ts:14`; корректный `roundHalfUp` — `src/helpers/numbers.ts:95` (не экспортирован). `01-architecture.md:86-90`.
- Знак баланса: 6 мест разделения по знаку (`01-architecture.md:91-95`), ошибочное — `CurrencyGroupCard.tsx:13`.
- Спиннер: `src/features/routing/PublicLocaleRoute.tsx:28-50` + `src/hooks/useSyncUserSettings.tsx:18-33` (`02-routing-state-pwa.md`, п.3).
- D16: `vercel.json:120` (CSP), `:136` (Permissions-Policy), `.gitignore:30-31`, `src/helpers/localStorage.ts:10-13, 93-99`, `src/store/users-store/selectors.ts:35`.

## Решение

Три PR, каждый релизится независимо:

| PR | Название | Содержание |
|----|----------|-----------|
| 01-1 | `fix(security): encode API path segments, validate invite tokens, redact group invite telemetry` | helper `apiPath`, 14 call sites, валидация токенов в 2 хуках, sanitizer, CSP/Permissions-Policy, `.gitignore`, очистка роли |
| 01-2 | `fix(security): confirm before joining group or accepting friend invite` | экран подтверждения для `/group/join/:inviteToken` и `/friends/join/:inviteToken` + i18n 5 локалей |
| 01-3 | `fix(money): single half-up rounding, zero balance is settled, public locale spinner` | замена `roundMoney`, helper направления баланса в 6 местах, фикс `PublicLocaleRoute` |

Порядок мержа: 01-1 → 01-2 (01-2 опирается на `isInviteToken` из 01-1). 01-3 независим.

## Детали

### 01-1.1 Helper `apiPath`

Новый файл `src/api/apiPath.ts`:

```ts
// UUID, base64url invite tokens, test fixtures (`group-1`, `activity-parent`). No `.`, `/`, `%`, `\`.
export const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export class InvalidPathSegmentError extends Error {
    constructor() {
        super('Invalid API path segment');
        this.name = 'InvalidPathSegmentError';
    }
}

export const apiPath = (strings: TemplateStringsArray, ...segments: string[]): string =>
    strings.reduce((path, chunk, index) => {
        if (index >= segments.length) {
            return path + chunk;
        }
        return path + chunk + encodePathSegment(segments[index]);
    }, '');

// Single implementation, reused by the generated-client wrapper `api()` (spec 03 §5.4).
export const encodePathSegment = (segment: string): string => {
    if (!PATH_SEGMENT_PATTERN.test(segment)) {
        throw new InvalidPathSegmentError();
    }
    return encodeURIComponent(segment); // no-op for the allowlist; kept as defense-in-depth
};
```

- Почему allowlist, а не только кодирование: (1) `encodeURIComponent('..') === '..'` — одно кодирование не спасает от dot-segment (`/groups/..` → `/`); (2) `%2F` может быть декодирован Vercel-прокси до backend (Контекст). Allowlist исключает `.`, `..`, `''`, `/`, `%`, `\` — защита не зависит ни от браузера, ни от прокси, ни от Ktor.
- Все API-функции, которые зовут `apiPath`, строят путь **внутри `.then`** — одна форма, без `async`: `` Promise.resolve().then(() => apiInstance.post(apiPath`/groups/invite/${inviteToken}`)) ``. Так `InvalidPathSegmentError` становится **rejected Promise**, а не синхронным throw: route-параметр `%2E` (RR декодирует в `.`) иначе бросит внутри store-экшена из `useEffect` и уронит error boundary (review B, m1). `async` не используем: до 02-C4 в `eslint.config.js:99-122` действует warn-селектор «async без await» (его удаление — PR 02-C4, спека 02).
- Текст ошибки не содержит значение сегмента (не утекает в Sentry).
- Все 14 call sites переписываются на `` apiPath`/groups/${groupId}` `` и т.д.; `usersApi.ts:67` — тоже (убрать ручной `encodeURIComponent`, иначе будет двойное кодирование).
- Валидацию UUID для `groupId`/`entryId`/`parentActivityId` в API-слой **не** добавляем: тестовые фикстуры используют `group-1`, `activity-parent` (оба проходят allowlist), а backend и так делает `asValidUuid`. Все 14 мест — id/токены (проверено grep), других символов в легитимных сегментах нет; фикстура, не проходящая allowlist, заменяется на валидную. Валидация route-параметров переезжает в loaders (D6, спека 04, PR 04-2e).

### 01-1.2 Валидация токена приглашения

Новый файл `src/helpers/inviteToken.ts`:

```ts
// Backend InviteTokenGenerator: base64url alphabet; DB column VARCHAR(64).
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const isInviteToken = (value: string | undefined): value is string =>
    typeof value === 'string' && INVITE_TOKEN_PATTERN.test(value);
```

- Алфавит — точно из генератора (это и есть защитное свойство: нет `/`, `.`, `%`). Длина — не жёстко 32, а `16..64`: нижняя граница отсекает мусор, верхняя = размер колонки; так клиент не ломается, если backend поменяет длину генератора.
- Применение: в `useJoinInviteLink.tsx` и `useFriendInviteLink.tsx` — если `!isInviteToken(inviteToken)`, запрос не отправляется, показывается `toast.error(i18n.t('toasts:group.inviteJoinError'))` / `toasts:friend.inviteJoinError` (ключи уже есть) и `navigate(ROUTES.DASHBOARD, { replace: true })`. В 01-2 этот же предикат определяет состояние «ссылка недействительна» на экране подтверждения.
- Фикстуры в тестах хуков (`invite-token`, `friend-token` и т.п. короче 16 символов) заменить на константу `TEST_INVITE_TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345'` (тот же пример, что в backend `UserOpenApiExamples.kt:19`) в `src/test/fixtures/inviteToken.ts`. Фикстуры API-слоя менять не нужно — API-слой токен не валидирует.

### 01-1.3 Sanitizer токенов в телеметрии

- `src/constants/telemetry.ts`: добавить `export const GROUP_INVITE_API_PATTERN = /\/groups\/invite\/[^/?#]+/;`.
- `src/helpers/telemetry.ts:26-28`: добавить `.replace(GROUP_INVITE_API_PATTERN, '/groups/invite/:inviteToken')`.
- Дополнительно в `initializeSentry.ts` `beforeBreadcrumb`: если `typeof breadcrumb.message === 'string'`, прогонять его через `sanitizeTelemetryUrl` (fetch/xhr/navigation breadcrumbs иногда кладут URL в `message`).
- Вместо списка ключей `['url','from','to']` — shallow-обход: `sanitizeTelemetryUrl` применяется к **каждому** строковому значению `breadcrumb.data`, `event.extra`, `event.tags` (одним helper `sanitizeStringValues(obj)`; только 4 явных паттерна, без generic-регэкспа). Закрывает будущие `captureException(err, { extra: { url } })` (review B, m2).
- Generic-правило «любой сегмент ≥20 символов base64url» **не** вводим в хотфиксе: ложные срабатывания на UUID без дефисов/хэшах ассетов, отладку ломает. Не входит ни в одну спеку: follow-up issue «telemetry: generic token redaction» (список в `00-overview.md`).

### 01-1.4 Однострочные пункты D16 (все безопасны, входят в 01-1)

1. CSP (`vercel.json:120`): добавить `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`; убрать `blob:` из `script-src` (появился как наследие при `606bdb0`, в коде нет blob-скриптов; `URL.createObjectURL` используется только для превью картинок — `UserAvatarModal.tsx:96`, `create-update-group-modal/internal/hooks.ts:58` — это `img-src`); убрать `https://fonts.googleapis.com` из `style-src` и `https://fonts.gstatic.com` из `font-src` (ссылок на Google Fonts нет). `worker-src 'self' blob:` не трогаем. `form-action 'self'` безопасен: в `src` нет `<form action>`, OAuth-старт — навигация, а не submit формы.
   Обновить `vercel.config.test.js:128`: `expect(directives['script-src']).toBe("'self'")` + ассерты на 4 новые директивы и отсутствие `googleapis`/`gstatic`.
2. Permissions-Policy (`vercel.json:136`): `camera=(), microphone=(), geolocation=(), payment=(), usb=()`. Тест в `vercel.config.test.js`.
3. `.gitignore`: заменить блок `:30-31` на
   ```
   # Env files (secrets)
   .env*
   !.env.example
   ```
   В репо нет трекаемых `.env*` файлов (`git ls-files` пуст), `.env.sentry-build-plugin` остаётся покрыт.
4. Роль в localStorage: удалять **только `role`**, не весь объект под ключом `LS_KEY_USER` (`'Chipin_user'`, `src/constants/localstorage.ts:3`; в коде и тестах — только константа). Весь объект удалять нельзя — `settings.language/theme` из него читают `helpers/publicRoutes.ts:38` (локаль лендинга после выхода), `helpers/theme.ts:6`, `helpers/locale.ts:115`, `store/dashboardStore.ts:49`. Изменения:
   - `src/helpers/localStorage.ts:10-13`: `role?: UserRole`.
   - новая функция `clearLocalUserRole()` в том же файле: читает `getLocalUser()`, если есть — `saveLocalUser({ settings: localUser.settings })`.
   - вызов в `resetAuthScopedStores` (`src/store/authStore.ts:46`) **первой строкой** — до `useUsersStore.getState().setInitialUsersStore()`, который перечитывает localStorage (`users-store/initialState.ts:6`).
   - Эффект: `selectIsUserAdmin` (`users-store/selectors.ts:35`) после выхода/истечения сессии больше не возвращает `true` по старой роли до загрузки `users/self` нового аккаунта.

Отложено (не однострочно, не входит в спеки 02–05): сужение `img-src` (нужен список хостов аватаров/обложек — открытый вопрос аудита), `report-to`, Sentry tunnel — follow-up issue «security: CSP img-src/report-to/Sentry tunnel» (список в `00-overview.md`). Источник CSP приложения: до PR 04-2b — `vercel.json`, после — `apps/app/hosting.base.json` (из него генерируется `vercel.json`); директивы этого PR переносятся туда без изменений и повторяются в CSP сайта (`apps/site/vercel.json`, спека 04 §3.6).

### 01-2 Экран подтверждения

- `src/pages/GroupJoinPage.tsx` и `src/pages/FriendJoinPage.tsx` перестают быть «хук + `PageLoader`». Хуки `useJoinInviteLink`/`useFriendInviteLink` больше не вызывают POST в `useEffect`; они возвращают `{ status: 'invalid' | 'ready' | 'joining' | 'error', errorMessage?: string, confirm: () => void, cancel: () => void }`.
- `confirm()` сохраняет guard текущего `useFriendInviteLink.tsx:21-25` (`getAuthSessionVersion()` + `isAuthSessionCurrent()` + флаг `isActive` при размонтировании) в **обоих** хуках: ответ, пришедший после выхода/смены сессии или ухода со страницы, не меняет состояние и не навигирует.
- Состояния экрана:
  - `invalid` (`!isInviteToken`): текст «Ссылка-приглашение недействительна», кнопка «На главную».
  - `ready`: заголовок «Вступить в группу по приглашению?» / «Добавить пользователя в друзья?», пояснение «Участники группы увидят ваше имя и аватар», кнопки «Вступить»/«Принять» (primary) и «Отмена». Отмена → `navigate(ROUTES.DASHBOARD, { replace: true })`.
  - `joining`: primary-кнопка в loading, повторный клик игнорируется.
  - `error` (reject join): 404 (неизвестный/отозванный токен, `GroupRoutes.kt:113-114`) → состояние `invalid`; любая другая ошибка (403, 409 `GROUP.ALREADY_MEMBER`, сеть, 5xx) → `error`: текст `resolveApiErrorMessageFromError(error, <inviteJoinError>)`, кнопки «Повторить» (снова `confirm()`, ровно один запрос) и «На главную». Toast при ошибке не показывается (экран и так её показывает).
  - Фокус при открытии — на «Отмена» (или ни на чём); у primary-кнопки **нет** `autoFocus`, чтобы Enter/двойной тап сразу после открытия не вступал без чтения экрана (review B, m11).
  - После успеха — текущее поведение (navigate в группу / toast + `ROUTES.FRIENDS`).
- Неавторизованный пользователь: `ProtectedRoute` в хотфиксе не меняется. Известное поведение (`ProtectedRoute.tsx:26-38`): причина `signed_out` → redirect на лендинг, токен приглашения теряется; остальные причины → AuthModal, после входа пользователь видит `ready`, а не автоматический join. Сохранение токена для `signed_out` — PR 04-2f (`/login?returnTo`, спека 04); RTL-тест 01-2 фиксирует оба пути, чтобы 04-2f менял поведение осознанно.
- Превью группы (имя, обложка, число участников) — **нет эндпоинта**, поэтому экран generic. После backend-issue BE-01-3 превью добавляется отдельным PR (не в хотфикс).
- i18n: новый блок `join` в `group.json` и `friends.json` во всех 5 локалях (`en, es, pt-BR, pt-PT, ru`): `title`, `description`, `confirm`, `cancel`, `invalidTitle`, `goHome`. Тексты en/ru пишет исполнитель, es/pt-BR/pt-PT — машинный перевод с ревью владельца.
- Компоненты — Radix `Card`, `Button`, `Flex`, `Text` (как в текущих страницах), без новых styled-components.

### 01-3.1 Округление денег

- `src/helpers/numbers.ts`: экспортировать `roundHalfUp`; добавить `export const MONEY_INPUT_PRECISION = 2;`.
- Удалить обе локальные `roundMoney` (`expenseModalStore.ts:161`, `expenseModalSelectors.ts:14`). Заменить вызовы на `roundHalfUp(x, MONEY_INPUT_PRECISION)` — полный список:
  1. `src/store/expenseModalSelectors.ts:106` — EQUAL, `totalAmount / includedUserCount`
  2. `:108` — PERCENT, доля участника
  3. `:110` — AMOUNTS, ввод участника
  4. `:113` — SHARES, доля по весам
  5. `:172` — PERCENT, `assignedAmount`
  6. `:174` — AMOUNTS, `assignedAmount`
  7. `src/store/expenseModalStore.ts:574` — шаг +/- в AMOUNTS (`.toFixed(2)`)
- Остальные вызовы `roundHalfUp` (`numbers.ts:118, 236, 263`) не трогаем.
- Precision 2 — временно (как и сейчас). Minor units по валюте (JPY=0, BHD=3) и `money.split` в единицах scale 4 — D10, спека 03 (PR 03-1, 03-2); в хотфиксе не вводим, чтобы не менять поведение.

### 01-3.2 Нулевой баланс = «рассчитались»

Определение: баланс считается нулевым («Settled up», серый цвет, ни в «вам должны», ни в «вы должны»), если `normalizeApiMoneyAmount(netBalance) === 0` (4 знака, `numbers.ts:117-120`; это убирает float-шум вида `5.5e-17` после сумм).

Новый helper в `src/helpers/currencies.ts`:

```ts
export type BalanceDirection = 'owed' | 'owe' | 'settled';
export const getBalanceDirection = (netBalance: number): BalanceDirection => {
    const normalized = normalizeApiMoneyAmount(netBalance);
    if (normalized > 0) return 'owed';
    if (normalized < 0) return 'owe';
    return 'settled';
};
```

6 мест разделения по знаку:

| # | Место | Сейчас | Действие |
|---|-------|--------|---------|
| 1 | `src/basics/BalanceSummaryText.tsx:29-33` | `>0` / `<0` | заменить на `getBalanceDirection` |
| 2 | `src/store/dashboardSelectors.ts:21-25` | `>0` / `<0` | заменить на `getBalanceDirection` |
| 3 | `src/components/dashboard-summary/internal/useConnect.ts:19, 31` | повторная фильтрация уже разделённых списков | удалить повторную проверку (вход уже разделён в #2) |
| 4 | `src/store/groupsSelectors.ts:52-58` | `<0` / `>0` | заменить на `getBalanceDirection` |
| 5 | `src/store/groupsSelectors.ts:90-94` | `===0` skip, `>0` | заменить на `getBalanceDirection`; сумму на `:98` прогонять через `normalizeApiMoneyAmount` |
| 6 | `src/pages/friends-page/components/CurrencyGroupCard.tsx:13` | **`>= 0` — ошибка**: ноль показан зелёным «Вам должны» | `const direction = getBalanceDirection(netBalance)`; `settled` → цвет `gray`, текст `balances.settledUp` |

Плюс источник суммы для #6: `src/store/users-store/selectors.ts:76` (`group.netBalance += balance.netAmount`) — после цикла нормализовать `group.netBalance = normalizeApiMoneyAmount(group.netBalance)`.
Эталон поведения уже есть в `src/basics/DebtAmount.tsx` (`isZero` → `settledUp`, серый) — после фикса все 6 мест согласованы с ним. Сам `DebtAmount` переводится на helper тоже (7-я правка, 2 строки).

### 01-3.3 Зависание `PublicLocaleRoute`

Причина: `useSyncUserSettings.tsx:29` меняет язык при каждом новом объекте `settings`; эффект `PublicLocaleRoute.tsx:28-46` не перезапускается (его deps не изменились), а рендер `:48-50` возвращает `PageLoader`, пока `resolvedLanguage !== locale` → вечный спиннер.

Фикс в `PublicLocaleRoute.tsx` — разделить на два эффекта и убрать блокирующий рендер:
1. **Assert-эффект** без cleanup, deps `[i18n, locale, i18n.resolvedLanguage]`: ставит `document.documentElement.lang = locale`; если `i18n.resolvedLanguage !== locale` — `i18n.changeLanguage(locale)`. Срабатывает и при внешней смене языка, поэтому возвращает язык URL. Цикла нет: `useSyncUserSettings` перезапускается только при смене `settings`, не языка.
2. **Restore-эффект** deps `[]`, только cleanup при размонтировании: значения `isLoggedIn`/`savedLanguage`/`previousDocumentLanguage` берутся из `useRef`, обновляемых каждым рендером. Логика восстановления — та же, что сейчас в `:37-45`. Причина deps `[]`: при переходе между публичными страницами React Router может переиспользовать экземпляр компонента с новым `locale`; cleanup между ними дал бы гонку двух `changeLanguage`.
3. `PageLoader` остаётся только для первого рендера, пока язык ещё не переключён, — но с гарантией выхода: assert-эффект реагирует на `resolvedLanguage`.

Полное устранение множества «писателей» языка (5 мест) — спека 04 (PR 04-2c `setAppLanguage`; PR 04-5a удаляет `PublicLocaleRoute` целиком). Хотфикс нужен, т.к. до D8 несколько недель.

## Ньюансы и подводные камни

- `apiPath` сам бросает синхронно, но вызывается только внутри `.then` (01-1.1) → наружу выходит rejected Promise, который store-экшены обрабатывают как любую ошибку запроса (loading-флаг сбрасывается). Тест фиксирует именно rejection, а не синхронный throw.
- Двойное кодирование: после перевода `usersApi.ts:67` на `apiPath` ручной `encodeURIComponent` обязательно убрать.
- Валидные токены не меняются при `encodeURIComponent` (алфавит base64url безопасен) — для легитимных ссылок URL идентичен текущему.
- Смена `roundMoney` → `roundHalfUp` меняет результат только на «половинных» float-значениях (1.005, 2.675, −1.005). Отрицательные округляются от нуля (как `roundHalfUp` сейчас), `Math.round` — к +∞. Сумма долей EQUAL по-прежнему может отличаться от total на 0.01 — это не регрессия, распределение остатка — D10.
- Порог «ноль» = 4 знака, не 2: баланс `0.004` — не «в расчёте» (backend его хранит и блокирует удаление друга `USER.OUTSTANDING_DEBT`). Это **окончательное** правило и в спеке 03 (`displaySign` = знак scale 4, §4.2); отображение такой суммы как «< 0.01» и settle точной суммой — спека 03 §4.5.
- CSP: проверить на preview-деплое Vercel, что Sentry, Speed Insights, SW-регистрация и загрузка аватаров работают (консоль без `Refused to …`).
- `.env*` в `.gitignore` спрячет и будущий `.env.example`, если забыть `!`-исключение — оно включено.

## Расширение в будущем

- `apiPath` становится единственным способом строить путь до перехода на сгенерированный клиент (D4, спека 03 PR 03-4: обёртка `api()` подставляет `{param}` через тот же `encodePathSegment` — allowlist и dot-segment правило не теряются; файл переезжает в `shared/api/pathSegment.ts`); lint-правило `no-restricted-syntax` на template literal внутри `apiInstance.*(…)` — спека 02 (PR 02-C12).
- `getBalanceDirection` заменяется в PR 03-3 на `partitionBalances`/`displaySign` (`src/shared/money`, `src/entities/balance`). Порог «ноль» остаётся scale 4 (`0.0040 USD` ≠ «в расчёте»), поведение хотфикса сохраняется.
- Экран подтверждения получает превью группы после BE-01-3; на Astro-сайте (D8) лендинги `/join/group/<token>` и `/join/friend/<token>` (спека 04 §3.5) ведут кнопкой на этот же экран (`app.chipin.one/group/join/<token>`, `app.chipin.one/friends/join/<token>`; путь в приложении не меняется, меняется только хост, D26).

## Что НЕ делаем

- PKCE/state для OAuth на клиенте (нужен backend, BE-01-1).
- UUID-валидация route-параметров — спека 04 (04-2e); сужение `img-src`, CSP reporting, Sentry tunnel — follow-up issue вне спек.
- Minor units по валюте, модуль `src/shared/money/`, lint на `Number()`/`parseFloat` — D10, спека 03 (03-1, 03-3).
- Объединение 5 «писателей» языка — спека 04 (04-2c, 04-5a).
- Удаление зависимостей D16 (dexie, sharp и т.д.) и vendor-regex — спека 02 (02-B1, 02-B2).
- Ротация локального Sentry-токена — действие владельца.
- `.gitignore` `.env*` здесь (01-1); спека 02 (02-A3) его не повторяет.

## Фазы/PR

| PR | Оценка диффа | Зависимости | Риск |
|----|-------------|-------------|------|
| 01-1 | ~250 строк (код ~90, тесты ~160) | — | низкий; URL легитимных запросов не меняется |
| 01-2 | ~350 строк (2 страницы, 2 хука, 10 json, тесты) | 01-1 | средний (UX-изменение, нужен ревью текстов) |
| 01-3 | ~220 строк | — | средний (деньги) — тесты-снимки до/после |

Каждый PR — свой FE-issue (Type=Bug, Priority=P1 для 01-1/01-2, P2 для 01-3, Project 5), ссылка на D1 и этот файл.

## Тесты/критерии приёмки

01-1:
- `src/api/apiPath.test.ts`: (a) UUID, `TEST_INVITE_TOKEN`, `group-1`, `activity-parent` → без изменений; (b) `..`, `.`, `''`, `'a/b'`, `'../x'`, `'a%2Fb'`, `'a.b'`, `'a\b'`, пробел → `InvalidPathSegmentError`; (c) сообщение ошибки не содержит значение сегмента; (d) API-функция с `'..'` в параметре возвращает rejected Promise (`return expect(...).rejects…`; стиль `await` свободный, D24), синхронно не бросает.
- `src/api/chipin.test.ts`, `groupsApi.test.ts`, `ledgerApi.test.ts`, `activityApi.test.ts`, `usersApi.test.ts`: по одному кейсу на функцию с `/` в параметре — промис rejected `InvalidPathSegmentError`, mock `apiInstance` не вызван.
- **E2E-ish traversal** `src/features/routing/inviteTraversal.integration.test.tsx`: реальный `apiInstance` с custom axios `adapter`, который записывает `new URL(axios.getUri(config), 'https://chipin.one').pathname` (с `baseURL: '/api'` `getUri` относительный — без base `new URL` бросает) и отвечает 200; `MemoryRouter` с `initialEntries={['/group/join/..%2F11111111-1111-1111-1111-111111111111%2Fmembers%2F22222222-2222-2222-2222-222222222222%2Fkick']}` и маршрутом из `AppRouter`; авторизованный auth store. Ожидания: адаптер не вызван ни разу; показан toast `inviteJoinError`; ни один записанный pathname не матчит `/\/kick$/`. Второй кейс того же файла: прямой вызов `inviteApiUserToGroup({ inviteToken: '../g/members/u/kick' })` → rejected `InvalidPathSegmentError`, адаптер не вызван.
- Preview-deploy check (ручной, чек-лист PR): `curl -i https://<preview>/api/groups/..%2Fhealth` не возвращает тело `/health` (`{"status":"UP"}`); результат (декодирует ли Vercel `%2F`) записать в BE-01-2.
- `src/helpers/inviteToken.test.ts`: валиден `TEST_INVITE_TOKEN`; невалидны `''`, `'abc'` (короткий), 65 символов, `'../x'`, `'a%2Fb'`, `'a.b'`, пробел.
- `useJoinInviteLink`/`useFriendInviteLink` тесты: невалидный токен → API не вызван, navigate на dashboard.
- `src/helpers/telemetry.test.ts`: `https://chipin.one/api/groups/invite/AbC…?x=1` → `https://chipin.one/api/groups/invite/:inviteToken`; существующие кейсы зелёные. `initializeSentry` тест: breadcrumb с токеном в `message` и в произвольном ключе `data`, событие с токеном в `extra` и `tags` — санитизированы.
- `vercel.config.test.js`: новые ассерты CSP/Permissions-Policy.
- `src/helpers/localStorage.test.ts` + `authStore` тест: после `signOut()`/`expireSession()` в значении `LS_KEY_USER` нет `role`, `settings` сохранены; `selectIsUserAdmin` на свежем store = `false`. (Спека 03, PR 03-7b, сохраняет это поведение: при expiry удаляется только `role`.)

01-2:
- RTL-тесты `GroupJoinPage.test.tsx`, `FriendJoinPage.test.tsx`: при монтировании API не вызывается; primary-кнопка не в фокусе после mount, Enter сразу после mount не вызывает API; клик «Вступить» → ровно один вызов; повторный клик во время `joining` не даёт второго; «Отмена» → navigate на dashboard без вызова; невалидный токен → экран `invalid`; API reject 404 → `invalid`; reject 409/сеть → `error`, «Повторить» → ровно один новый вызов; ответ после размонтирования/смены сессии не навигирует; неавторизованный с `signed_out` → лендинг, с `expired` → AuthModal, затем `ready`.
- 01-2 обновляет `inviteTraversal.integration.test.tsx` из 01-1: вместо toast `inviteJoinError` ожидается экран `invalid` (адаптер по-прежнему не вызван).
- i18n parity: локальный тест 01-2 — ключи `join.*` есть во всех 5 локалях `group.json`/`friends.json`. Общий тест паритета всех namespace — PR 04-2c (единственный владелец).

01-3:
- `src/helpers/numbers.test.ts`: `roundHalfUp(1.005, 2) === 1.01`, `(2.675, 2) === 2.68`, `(-1.005, 2) === -1.01`, `(10/3, 2) === 3.33`.
- `src/store/expenseModalSelectors.test.ts`: EQUAL `3.015 / 1` → `3.02` (старый код давал `3.01`); PERCENT 50% от `2.01` → `1.01`; шаг +/- в AMOUNTS (`expenseModalStore`) из `1.004` → `1.00`, `.toFixed(2)`.
- `src/helpers/currencies.test.ts`: `getBalanceDirection` для `1`, `-1`, `0`, `-0`, `5.5e-17`, `0.00004` → `owed`, `owe`, `settled`, `settled`, `settled`, `settled`.
- `CurrencyGroupCard.test.tsx`: `netBalance: 0` → текст `balances.settledUp`, не `balances.youAreOwed`; `getFriendsView` с балансами `+5` и `-5` одной валюты → `netBalance === 0`.
- Snapshot до/после для `selectDashboardSummary`, `selectGroupBalances`, settlement-options на текущих фикстурах — для ненулевых значений вывод не меняется.
- `PublicLocaleRoute.test.tsx`: залогиненный пользователь (`savedLanguage='ru'`) на `locale='en'`; внешний `i18n.changeLanguage('ru')` (имитация `useSyncUserSettings`) → в течение `waitFor` рендерятся children, `i18n.resolvedLanguage === 'en'`; размонтирование → язык `ru`, `documentElement.lang === 'ru'`; смена prop `locale` `en → es` без размонтирования → `es`, без промежуточного переключения на `ru`.
- Все: `npm run lint`, `npm run test:run`, `npm run build` зелёные.

## Требования к backend

Создать 3 issue в `chipin-backend` (Type, Priority, assignee, Project 5 — при создании):

- **BE-01-1 (P1) OAuth: привязка кода к браузеру (PKCE).** `/auth/login/google` принимает `code_challenge` (S256) и сохраняет вместе с одноразовым кодом; `/auth/oauth/exchange` требует `code_verifier`, иначе 400. Альтернатива — короткоживущая `__Host-chipin_oauth_tx` cookie (HttpOnly, SameSite=Lax, 10 мин), проверяемая на exchange. Контекст: `OAuthTokenExchangeService.kt:44-75` принимает только `code` (`04-security.md` F3). FE-часть — отдельный FE-issue (#540) после BE-01-1. Предпочтительна cookie-вариант: установленный iOS-PWA (standalone) может вернуть OAuth-редирект в другом browsing context, и verifier из `sessionStorage` потеряется; вход идёт same-origin через `/api` (`src/constants/env.ts:3`), поэтому `__Host-` cookie работает. Если выбран PKCE — в приёмку #540 входит проверка входа из iOS standalone.
- **BE-01-2 (P3) Отклонять закодированные dot-segments/слэши в path-параметрах.** Глобальный interceptor/plugin: если сырой путь содержит `%2F`, `%2E%2E`, `%5C` (без учёта регистра) — 400. Integration-тесты: `POST /groups/invite/..%2Fx%2Fkick` → 400, не роутится. Явно указать в issue: literal `..` нормализует браузер, это защита только от закодированных вариантов и от не-браузерных клиентов. В issue записать результат preview-check из 01-1 (декодирует ли Vercel `%2F` при rewrite): если декодирует, backend-проверка сырого пути `%2F` бесполезна для трафика через прокси, и защита держится на FE-allowlist + `asValidUuid`.
- **BE-01-3 (P2) Валидация invite-токена + preview-эндпоинт.** (a) `POST /groups/invite/{inviteToken}` и `POST /users/invite/{inviteToken}`: `inviteToken` проверяется по `^[A-Za-z0-9_-]{16,64}$` до обращения к БД, иначе 400 с кодом `INVALID_INVITE_TOKEN`; (b) `GET /groups/invite/{inviteToken}` (требует auth, rate-limited) → `{ groupId, name, coverUrl, memberCount, isAlreadyMember }` без списка участников; 404 на неизвестный токен. Описать в OpenAPI (`GroupOpenApi`).

## Открытые вопросы

- ASSUMPTION: экран подтверждения добавляется и для `/friends/join/:inviteToken` (D1/F4 упоминают только группу, но механизм тот же — авто-POST по ссылке).
- ASSUMPTION: длина токена `16..64`, а не строго 32 — чтобы смена генератора на backend не ломала ссылки.
- ASSUMPTION: порог нуля — 4 знака (`normalizeApiMoneyAmount`), а не точность отображения.
- ASSUMPTION: тексты es/pt-BR/pt-PT для экрана подтверждения — машинный перевод, ревью владельца.
- ASSUMPTION (проверяется preview-check 01-1): Vercel может декодировать `%2F` в `:path*`; фикс от этого не зависит (allowlist).
- Вопрос «нормализует ли Ktor `..`» для F1 снят: браузер нормализует literal `..` до отправки; остаётся только BE-01-2 для закодированных вариантов.
