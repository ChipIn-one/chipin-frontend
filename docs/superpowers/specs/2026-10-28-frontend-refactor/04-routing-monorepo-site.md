# Спека 04: монорепо, роутинг приложения и публичный сайт (D6, D7, D8; ADR для FE#498)

Статус: черновик для владельца, 2026-10-28. Репо: `ChipIn-one/chipin-frontend`. Проверено read-only на ветке `chore/issue-456-ds-gallery` @ `3d0086e`; пути пересверены с `origin/master` `522973a` (там уже нет deploy-workflow'ов — delivery = Vercel Git integration + Promote; правила в `docs/engineering/rules/`). Backend проверен на `chipin-backend` (ветка `develop`).

Идентификаторы PR — `04-<n>` (глобальная схема, `00-overview.md`); «фаза N» в тексте = PR `04-N`. Backend-issue — `BE-04-<n>`.

Отклонение от DECISIONS: (1) D8 перечисляет rewrites `/`, `/<locale>/*`, `/help/*`, `/blog/*` → сайт; здесь — catch-all на сайт последним правилом (надмножество, без пятого ручного списка, §4.1). (2) D8 «invite landing `/join/<token>`» → `/join/group/<token>` и `/join/friend/<token>`: токены группы и друга — разные сущности backend (§3.5). (3) D15 «one deploy workflow» — на master deploy-workflow'ов нет, единственный путь — Vercel Git integration + Promote; для двух проектов это и остаётся (§1.4).

Владение пересекающимися темами: lazy-load локалей (D16) — **эта спека** (04-2c); регистрация SW и её дедупликация — **эта спека** (04-2d); vendor-regex и удаление `dexie`/`workbox-window` — спека 02 (02-B1); `packages/tokens` целиком — спека 05 (05-2); ds-gallery остаётся в `apps/app/ds-gallery/` (§6), токены получает по спеке 05 (05-7), typecheck — спека 02 (02-C5).

## Цель

1. Перевести репозиторий в монорепо на npm workspaces: `apps/app` (нынешний SPA), `apps/site` (Astro), `packages/tokens`, `packages/i18n-content`. Первый PR — чистый перенос файлов без изменения поведения.
2. Перевести приложение на data router React Router 7. Источник маршрутов один — манифест. Из него генерируются `vercel.json` (rewrites и redirects) и allowlist навигации SW, а тест проверяет, что они совпадают.
3. Перенести публичные SEO-страницы в Astro (`apps/site`). Удалить из приложения второе дерево `PublicApp`, prerender и проверку precache.
4. Развести URL на одном домене: сайт на `/`, приложение на `/app/*`, старые URL отдают 301.
5. Зафиксировать ADR по FE#498: разделение на Astro + SPA против Next.js и против текущего состояния.

## Контекст

- В коде 4 списка приватных маршрутов, которые синхронизируются руками: `src/features/routing/AppRouter.tsx:58-146`, `src/constants/routes.ts:3-96` (`ROUTES` + `ROUTE_META`), rewrites в `vercel.json` (`/dashboard/:path*` … `/not-found`), `scripts/private-spa-navigation.ts:3-6`. Тест `private-spa-navigation.test.ts` проверяет только regex (аудит 02, находка 1).
- Публичные страницы рендерят два дерева: `src/root.tsx:28-52` гидрирует `PublicApp` при `data-public-ssg`, а внутри SPA те же страницы идут через `PublicLocaleRoute`. Из-за этого `Toaster`, `BackendUnavailableGate`, meta и редирект для залогиненного дублируются (`src/public-routes/PublicContent.tsx:24-58`, `PublicEffects.tsx:42-63,97-105`, `HomeRouteGuard.tsx:23-36`) (аудит 02, находка 2).
- Язык i18n пишут 4 и больше мест (`src/i18n/index.ts:12`, `PublicLocaleRoute.tsx:28-51`, `useSyncUserSettings.tsx:18-33`); есть риск, что лоадер зависнет (аудит 02, находка 3; хотфикс по D1).
- Роутер только декларативный: `<BrowserRouter>` в `src/main.tsx:57`, `InternalRoute` повторён 8 раз, один `Suspense`, нет `errorElement` (аудит 02, находки 9–10). `features/routing` импортирует `pages`, это нарушение V1 (аудит 01 §1.2).
- SW регистрируется дважды: `registerSW` в `src/basics/PWABadge.tsx:8-23` и ручной `navigator.serviceWorker.register('/sw.js', { scope: '/' })` в `src/helpers/swUpdates.tsx:221-289`. TTL «Later» равен 4 ч (`swUpdates.tsx:13`), проверки минимальной версии нет (аудит 02, находки 7–8).
- Манифест PWA: `start_url: '/'`, `scope: '/'`, `id: '/'` (`vite.config.ts:142-160`). Workbox `navigateFallback: 'app.html'` с allowlist (`vite.config.ts:197-211`).
- Все 5 локалей × 13 неймспейсов импортируются статически: `src/i18n/resources.ts`, 65 импортов (аудит 02, находка 12).
- Публичный манифест — 3 страницы × 5 локалей = 15 URL. Префиксы: `en: ''`, `/ru`, `/es`, `/pt-br`, `/pt-pt` (`src/constants/publicRouteManifest.ts:4-20`).
- Приложение само строит ссылки-приглашения: `src/helpers/url.ts:46-50` (`/friends/join/<t>`, `/group/join/<t>`). Backend возвращает только `inviteToken`: `GroupDtos.kt:11,30`, `UserService.kt:91-93`.
- OAuth: фронт передаёт `redirect_to=<origin>/oauth/callback?returnTo=…` (`src/helpers/url.ts:28-44`). Backend проверяет **только origin** (`OAuthRedirectValidator.kt:21-27`, `application.yaml:26-27` `OAUTH_ALLOWED_REDIRECT_ORIGINS`, `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS`).
- ds-gallery импортирует `basics/*` и `components/*` приложения напрямую (`ds-gallery/gallery.tsx`), а ещё `ds-gallery/vite.config.ts` с алиасами на `src/*`.
- FE#498 требует сравнить как минимум три варианта: (a) Vite + кастомный SSG, (b) Next.js, (c) RR framework mode или отдельный публичный сайт. FE#498 заблокирован FE#497 (перевод на canonical `master`). FE#499 требует одну систему маршрутов и SEO без параллельных копий, а app- и auth-маршруты должны остаться неиндексируемыми.

## Решение (кратко)

- npm workspaces без Turborepo. React, react-dom, TypeScript и Vite закреплены в корне. Сначала отдельный PR с механическим переносом `src/` → `apps/app/src/`.
- Домен `chipin.one` остаётся на **текущем** Vercel-проекте. Его Root Directory = `apps/app`, он отдаёт `/app/*`, `/api/*`, `/.well-known/*`, `/sw.js`, а **всё остальное** внешним rewrite проксирует в новый проект `chipin-site` (Root Directory `apps/site`). Откат — один флаг генератора, который выключает catch-all rewrite на сайт.
- В приложении `basename: '/app'`, Vite `base: '/app/'`, SW `/app/sw.js` со scope `/app/`. Старый `/sw.js` заменяется самоуничтожающимся воркером.
- Один манифест маршрутов (чистые данные) и типизированная карта lazy-модулей. Guard реализован как layout route, `errorElement` есть на корне и на layout. Loaders прогревают TanStack Query (спека 03) и не блокируют навигацию.
- Сайт — Astro static: встроенный i18n с прежними URL (`/`, `/ru/`, `/pt-br/privacy`…), content collections, hreflang, sitemap, только tokens CSS, без SW. Лендинг приглашения — `/join/group/<token>` и `/join/friend/<token>` с явной кнопкой в приложение.
- ds-gallery остаётся в `apps/app/ds-gallery/`.

## Детали

### 1. Монорепо (D7)

#### 1.1 Раскладка

```
/                         корень репо (workspace root, private)
  package.json            workspaces, корневые прокси-скрипты, версия продукта (D15)
  package-lock.json       единственный lockfile
  tsconfig.base.json      общие compilerOptions (strict, moduleResolution bundler, erasableSyntaxOnly …)
  eslint.config.js        один flat config, блоки по globs apps/app/**, apps/site/**, packages/**
  prettier.config.js      один (D13, спека 02 Д6), `.prettierignore`, `.editorconfig`, `lint-staged`
  config/eslint/          пресеты ESLint из спеки 02 (Д5, Д9), `APP_DIR` на workspace
  .husky/                 хуки вызывают корневые скрипты (тексты команд не меняются)
  scripts/                только repo-level: version-*, ci-gate-policy, create-pr, release-qa-*,
                          release-qa/ (+ их тесты)
  apps/
    app/                  @chipin/app — нынешний SPA
      package.json  vite.config.ts  vitest.config.ts  vitest.contract.config.ts
      tsconfig.json tsconfig.app.json tsconfig.node.json  pwa-assets.config.ts  vercel.json
      index.html          (бывший app.html после фазы 3; в фазе 0 — оба html как есть)
      src/  public/  contract-tests/  ds-gallery/
      scripts/            prerender*, verify-public-precache, private-spa-navigation, run-task-tests,
                          taskTestArgs (пока живы), затем generate-routing-artifacts
    site/                 @chipin/site — Astro
      package.json astro.config.ts tsconfig.json vercel.json src/ public/
  packages/
    tokens/               @chipin/tokens — tokens.css, fonts/, logo.svg (наполнение по D14)
    i18n-content/         @chipin/i18n-content — locales.ts, common/<locale>.json
```

#### 1.2 Корневой `package.json`

- `"private": true`, `"workspaces": ["apps/*", "packages/*"]`, `"engines": { "node": "24.21.0" }`. Поле `version` остаётся здесь, это единая версия продукта (D15). `scripts/version-*.mjs` продолжают читать корневой файл. `apps/app/vite.config.ts` импортирует `../../scripts/version-resolver.mjs`.
- `devDependencies` в корне: `typescript ~5.9.3`, `eslint` и плагины, `prettier`, `husky`, `vitest`, `vite`. Версии для всех workspaces одни.
- `dependencies` в корне: `react`, `react-dom` в точной версии (`19.3.0` без `^`), а также `overrides`: `{ "react": "$react", "react-dom": "$react-dom" }`. Так Astro-интеграция `@astrojs/react` и приложение получают один экземпляр React.
- Прокси-скрипты, чтобы CI и husky не менялись: `"verify:full": "npm run verify:full -w @chipin/app && npm run build -w @chipin/site --if-present"`, `"lint": "eslint ."`, `"test:full": "npm run test:full -w @chipin/app"`, `"build": "npm run build -w @chipin/app"`, `"vercel-build"` не нужен в корне (Vercel собирает в Root Directory), `"version:check"` и `"version:bump"` без изменений.
- `apps/app/package.json`: `"name": "@chipin/app"`, `"private": true`, без поля `version`. Сюда переезжают все runtime-зависимости приложения и его скрипты с прежними именами (`build`, `vercel-build`, `test:task`, `build:ds-gallery` …).
- `packages/*` объявляют `"exports"` на исходники (`"./tokens.css": "./tokens.css"`, `".": "./src/index.ts"`). Сборки пакетов нет, потребители бандлят исходники сами.

#### 1.3 Общие конфиги

- `tsconfig.base.json` (создаёт 02-C5; если он ещё не влит — создаётся здесь по составу 02 Д8) содержит только `compilerOptions` без `baseUrl`, `paths`, `include` и `tsBuildInfoFile`. В 04-0 он переезжает в корень. `apps/app/tsconfig.app.json` делает `extends: "../../tsconfig.base.json"` и сам задаёт `paths` **без `baseUrl`** (формат 02-C3: `"api/*": ["./src/api/*"]`) и `include: ["src", "ds-gallery"]` (02-C5). `apps/site/tsconfig.json` расширяет `astro/tsconfigs/strict` и повторяет строгие флаги из base.
- `eslint.config.js` в корне. Если 02-C4 влит — он импортирует `config/eslint/*` и задаёт `APP_DIR = 'apps/app'` (02 Д9), иначе нынешние блоки получают `files: ['apps/app/src/**/*.{ts,tsx}']`, правило про axios/api (`eslint.config.js:167-193`) переносится как есть. Для `apps/site` отдельный блок с `eslint-plugin-astro`, для `packages/**` — блок без React-правил. Type-aware lint (D13) использует `parserOptions.projectService: true`.
- Prettier и lint-staged подключаются один раз в корне (D13).

#### 1.4 CI

- `frontend-ci.yml` (единственный CI-workflow на master) получает два job'а с фильтрами путей. Фильтр делается шагом `dorny/paths-filter` по SHA, а не `on.paths`, иначе обязательный check не появится и PR заблокируется.
  - `app`: `apps/app/**`, `packages/**`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`.
  - `site`: `apps/site/**`, `packages/**`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`.
  - Обязательный агрегирующий job `ci-ok` зелёный, если пропущенные job'ы `skipped` или `success`.
- `npm ci` выполняется один раз в корне. Кэш `actions/setup-node` с ключом по корневому `package-lock.json`.
- Пути артефактов: `dist/` → `apps/app/dist/`, `apps/site/dist/`.
- Deploy-workflow'ов нет и не добавляется (D15, спека 02 Д7): оба Vercel-проекта собираются Vercel Git integration из `master`, prod — ручной Promote (`DEPLOYMENT.md` §«Vercel delivery from master»). Release-QA workflow'ы (`prepare-release-qa.yml`, `release-qa-result.yml`) получают префикс `apps/app/` в путях к артефактам.

#### 1.5 Vercel: два проекта

| Проект | Root Directory | Домены | Build | Output |
|---|---|---|---|---|
| нынешний (оставить **имя** без изменений, см. Требования к backend) | `apps/app` | `chipin.one`, `dev.chipin.one`, preview `*.vercel.app` | `npm run vercel-build` | `dist` |
| `chipin-site` (новый) | `apps/site` | `site.chipin.one` (prod), `site-dev.chipin.one` (dev) | `astro build` | `dist` |

- В обоих проектах включить «Include source files outside of the Root Directory», иначе не найдутся корневой lockfile и `packages/*`.
- Домен переносить не нужно, поэтому откат не требует DNS. Хост сайта прячется за rewrite (§4.1).
- Включить «Ignored Build Step» по путям, чтобы проект не пересобирался на чужие изменения: `git diff --quiet HEAD^ HEAD -- ../../packages . ../../package-lock.json`.
- Custom-домены на Vercel Hobby бесплатны (D22), поэтому `site.chipin.one` / `site-dev.chipin.one` остаются; запасной вариант `*.vercel.app` не нужен.

#### 1.5a Изоляция провайдера (D18)

Владелец планирует уйти с Vercel (отдельное исследование hosting + аналитики, в работе), поэтому спека не углубляет lock-in:
- Всё Vercel-специфичное живёт только в `apps/app/vercel.json`, `apps/site/vercel.json` и в генераторе (`generate-routing-artifacts.ts`, для сайта — `seoGuard`). Оба `vercel.json` — сгенерированные файлы, руками не правятся.
- Таблица rewrites/redirects/headers хранится в провайдер-нейтральном JSON: `apps/app/hosting.base.json` и `apps/site/hosting.base.json` (`{ headers: [{ source, set }], redirects: [{ from, to, status }], rewrites: [{ from, to, env? }], siteCutover }`, без Vercel-полей). Генератор манифеста маршрутов эмитит из него `vercel.json` (`emitters/vercel.ts`); переезд на Cloudflare/Netlify/nginx = новый emitter (`_redirects`/`_headers`, `nginx.conf`), манифест и таблица не меняются.
- `@vercel/*` в коде — только в одном модуле `apps/app/src/app/telemetry/vercelAnalytics.ts` (bootstrap Analytics + Speed Insights), который удаляется целиком (перенос импортов туда — в PR 04-2b); на сайте — одна строка `<script>` в `BaseLayout` (§3.6). Lint `no-restricted-imports` запрещает `@vercel/*` везде, кроме этого файла. Vercel-only API (Edge Config, KV, Functions, `@vercel/og`) не используются.
- Analytics и Speed Insights пока остаются (D18).

#### 1.6 PR механического переноса (фаза 0) — без изменения поведения

Состав, одним PR. Почти весь diff — rename, их ревьюят по `git diff -M --stat`.

1. `git mv` в `apps/app/`: `src`, `public`, `index.html`, `app.html`, `contract-tests`, `ds-gallery`, `vite.config.ts`, `vitest.config.ts`, `vitest.contract.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `pwa-assets.config.ts`, `vercel.json`, `vercel.config.test.js`, а также app-скрипты (`prerender-public.mjs`, `prerender-before-workbox.*`, `verify-public-precache.mjs`, `private-spa-navigation.*`, `run-task-tests.mjs`, `taskTestArgs.*`).
2. Создать корневой `package.json` (§1.2) и `apps/app/package.json`; перенести в корень `tsconfig.base.json` (из 02-C5) и tooling-конфиги спеки 02 (`prettier.config.js`, `config/eslint/`, `.husky/`) и перегенерировать lockfile. Версии зависимостей не меняются: `npm ci` должен дать тот же набор пакетов (сравнить `npm ls --all --json`).
3. Поправить пути: импорт `./scripts/version-resolver.mjs` в `vite.config.ts` → `../../scripts/…`, `root` в `ds-gallery/vite.config.ts` (он считается от `__dirname`, поэтому не меняется), `readFileSync('vercel.json')` в `vercel.config.test.js` → путь от `import.meta.dirname`, пути в `prerender-before-workbox.mjs`, глобы в `eslint.config.js`.
4. `.github/workflows/*`: `node scripts/<repo-level>.mjs` остаются как есть. Ссылки на app-скрипты и `dist/` получают префикс `apps/app/`. `paths-ignore` в `native-development-link.yml` не меняется.
5. `.husky/pre-push` не меняется, потому что корневые прокси-скрипты сохраняют имена.
6. Документы: `AGENTS.md`, `CLAUDE.md`, `docs/**`, `DEPLOYMENT.md` — замена `src/` → `apps/app/src/` в путях.
7. Vercel: Root Directory → `apps/app` выставить **в момент merge** (владелец, Settings). Порядок действий — в «Фазы».

Критерии «нет изменения поведения»:
- Число тестов и их результат те же (сейчас 1230/1230).
- Набор файлов в `apps/app/dist` совпадает с прежним `dist` с точностью до хешей. Prerender-HTML совпадает побайтно после нормализации хешей в именах ассетов. Число записей precache в `sw.js` то же.
- Preview-деплой: smoke по `/`, `/ru/`, `/dashboard`, `/group/join/<test>`, `/oauth/callback`, `/api/health` с `200` и тем же содержимым.

### 2. Роутинг приложения (D6)

#### 2.1 Базовый путь

- `createBrowserRouter(routes, { basename: '/app' })`. Константы `ROUTES` остаются относительными к basename (`'/dashboard'`), поэтому `navigate`, `<Link>` и `matchPath` по `useLocation().pathname` не меняются.
- Код, который читает `window.location.pathname` в обход роутера, переводится на хелпер `getRouterPathname()`, который снимает префикс `/app`. Таких мест три: `src/helpers/url.ts:31-35` (`getSocialAuthUrl`), `src/i18n/index.ts:12`, `src/helpers/telemetry.ts:24-25` (паттерны маршрутов). Lint-правило `no-restricted-properties` запрещает `window.location.pathname` вне этого хелпера.
- Vite `base: '/app/'`, `build.outDir: 'dist/app'`. Vercel Output остаётся `dist`, так что файлы физически лежат в `/app/…`, а root-файлы (`/sw.js` kill-switch, `/.well-known/assetlinks.json`) лежат в `dist/`.

#### 2.2 Манифест маршрутов

Файл `apps/app/src/app/router/routeManifest.ts` — чистые данные. В нём нет импортов, кроме типов, и только erasable-синтаксис, чтобы Node 24 мог импортировать его из скрипта без сборки.

```ts
type RouteAccess = 'public' | 'protected';
type RouteLayout = 'internal' | 'bare';

interface AppRouteDef {
    id: AppRouteId;                 // 'dashboard' | 'solo' | 'group' | ...
    path: string;                   // относительно basename: 'group/:groupId'
    access: RouteAccess;
    layout: RouteLayout;            // internal = InternalPageLayout с навигацией
    guard?: 'solo';                 // доп. layout-guard
    meta: { titleKey: string; entityTitleKey?: string };  // ключи ns 'meta'
    legacyPaths: readonly string[]; // старые абсолютные пути, для 301
}
```

Маршруты (полная таблица на момент спеки):

| id | path | access | layout | guard | legacyPaths |
|---|---|---|---|---|---|
| `home` | `` (index) | protected | internal | — | — (корень `/` занимает сайт) |
| `login` | `login` | public | bare | — | — |
| `oauthCallback` | `oauth/callback` | public | bare | — | `/oauth/callback` |
| `dashboard` | `dashboard` | protected | internal | — | `/dashboard` |
| `solo` | `solo` | protected | internal | solo | `/solo` |
| `group` | `group/:groupId` | protected | internal | — | `/group/:groupId` |
| `groupJoin` | `group/join/:inviteToken` | protected | bare | — | — (старый путь ведёт на сайт, §4) |
| `activity` | `activity` | protected | internal | — | `/activity` |
| `activityDetails` | `activity/:parentActivityId` | protected | internal | — | `/activity/:parentActivityId` |
| `friends` | `friends` | protected | internal | — | `/friends` |
| `friendJoin` | `friends/join/:inviteToken` | protected | bare | — | — (§4) |
| `settings` | `settings` | protected | internal | — | `/settings` |
| `notFound` | `not-found` | public | bare | — | `/not-found` |

- `home` (index) — loader с `redirect` в предпочитаемый режим (`dashboard` или `solo`). Он заменяет `HomeRouteGuard`.
- `login` — новый экран входа с кнопкой Google. Принимает `?returnTo=` и `?locale=`. На него ведут кнопки сайта и guard. Сейчас неавторизованного отправляют на лендинг (`ProtectedRoute.tsx:18-48`), и после переноса лендинга на сайт это дало бы цикл сайт → `/app/` → сайт.
- `*` → компонент NotFound на месте, без `<Navigate>`, чтобы URL сохранился.

Lazy-модули: `apps/app/src/app/router/routeModules.ts`.

```ts
export const ROUTE_MODULES = {
    dashboard: () => import('pages/dashboard/route'),
    // ...
} satisfies Record<AppRouteId, () => Promise<RouteModule>>;
```

У каждой страницы есть файл `route.ts` с **named** экспортами в формате RR7 `lazy`: `Component`, необязательные `loader` и `ErrorBoundary`. Default export не нужен, D11 соблюдается, shim'ы `.then(m => ({default: …}))` (`AppRouter.tsx:17-36`) удаляются. `satisfies Record<AppRouteId, …>` заставляет TS требовать модуль для каждого id.

#### 2.3 Дерево и guard как layout route

`createAppRouter(queryClient)` в `src/app/router/createAppRouter.tsx` строит дерево из манифеста:

```
RootLayout            errorElement=RootErrorBoundary; провайдеры UI, Toaster (один), ModalHost,
                      GlobalHooks, <ScrollRestoration/>
├─ public routes      login, oauth/callback, not-found, *
└─ AuthLayout         loader=requireSession; <Outlet/> + AuthModal поверх при истёкшей сессии
   ├─ bare routes     group/join/:inviteToken, friends/join/:inviteToken
   └─ InternalLayout  errorElement=RouteErrorBoundary; InternalPageLayout + <Outlet/>
      ├─ index (home redirect), dashboard, group/:groupId, activity, activity/:id, friends, settings
      └─ SoloGuardLayout → solo
```

- `AuthLayout` заменяет `ProtectedRoute`, `InternalRoute` (8 обёрток) и отступы, вшитые в guard (`ProtectedRoute.tsx:43-47`, они уходят в `InternalLayout`).
- `requireSession` (loader): `await authReady()`. Это промис первичной проверки сессии, который выносится из `useCheckSignIn` в `src/app/auth/session.ts`. Если статус `UNAUTHENTICATED` и причина `signedOut` или `noSession` → `redirect('/login?returnTo=' + encodeURIComponent(pathname + search))`.
- Offline (D2): если есть session hint (`LS_KEY_AUTH_SESSION_HINT`) и `navigator.onLine === false`, loader **не** редиректит, а пропускает на кэшированные данные. Детали в спеке 03.
- Сессия истекла во время работы: `AuthLayout` показывает `AuthModal` поверх `<Outlet/>` и не размонтирует страницу. Черновик расхода не теряется, но только при условии, что спека 03 убирает сброс `expenseModalStore` из `expireSession` (аудит 02, находка 11).
- Явный sign-out — полная навигация `window.location.assign(getLastAccountLandingPath())` на сайт.
- `SoloGuardLayout` — loader `ensureQueryData(selfUserQuery)` и `redirect('/dashboard')`, если `!canAccessSolo`. Заменяет `SoloRouteGuard.tsx:14-27`.

#### 2.4 Loaders и TanStack Query

- Loader получает `queryClient` через замыкание `createAppRouter(queryClient)`. Query options берутся только из фабрик спеки 03 (`entities/<x>/api/queries.ts`). Свои `queryFn` в loader запрещены.
- Правило: loader **не ждёт сеть**. Он вызывает `void queryClient.ensureQueryData({ ...opts, revalidateIfStale: true })` для каждого запроса маршрута. Компонент читает те же данные через `useQuery` и показывает существующие скелетоны. Из-за этого навигация не блокируется offline или на медленной сети (D2, `networkMode: 'offlineFirst'`).
- Исключения — loader может бросить ошибку или сделать redirect:
  - Невалидный параметр (`groupId`/`parentActivityId` не UUID) → `throw data(null, { status: 404 })`. Невалидный `inviteToken` (формат `isInviteToken` из 01-1) **не** даёт 404: страница join показывает состояние `invalid` экрана подтверждения 01-2.
  - Redirect'ы guard'ов (§2.3).
- Prefetch по маршрутам: `dashboard` → balances, groups, activity preview. `group` → group(id), groupActivity(id). `activity` → activity page 1. `activityDetails` → subevents(id). `friends` → friends. `settings` → self user. Точные ключи задаёт спека 03.
- Actions (RR7) не используются: мутации идут через `useMutation` и outbox (спека 03). Так у всех мутаций один путь.

#### 2.5 Ошибки

- `Sentry.ErrorBoundary` остаётся снаружи `RouterProvider` и ловит только падения провайдеров.
- `RootErrorBoundary` (корневой `errorElement`) и `RouteErrorBoundary` (на `InternalLayout`, рисуется внутри layout, поэтому шапка и навигация остаются) используют один компонент `RouteErrorView`:
  - `isRouteErrorResponse(e) && e.status === 404` → NotFound без отправки в Sentry.
  - Ошибка загрузки чанка (`/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/`) → экран «Вышла новая версия» с кнопкой обновления: `updateServiceWorker(true)`, а если SW нет, `location.reload()`. Автоматический reload делается один раз за сессию (флаг в `sessionStorage`), чтобы не попасть в цикл.
  - Остальное → `Sentry.captureException(e, { tags: { routeId } })` и карточка восстановления (логика `GlobalErrorFallback.tsx:30-80`).
- `routeId` для тегов берётся из `useMatches()`. Сырой URL с токеном в Sentry не уходит (D1 — утечка токена).

#### 2.6 Meta и title

- `handle: { meta }` из манифеста. Хук `useDocumentTitle()` в `RootLayout` берёт последний match с `handle.meta`, переводит `titleKey` (а при наличии сущности — `entityTitleKey` с именем группы) и выставляет `document.title`. Description приложению не нужен, потому что `/app/*` отдаётся с noindex (§4.3).
- Удаляются `ROUTE_META` (`routes.ts:30-96`), `useRoutesMeta`, дублирующиеся meta в `PublicEffects`.

#### 2.7 Совместимость с modal-router

- `ModalRouter` (`docs/architecture/modal-router.md`) держит историю в памяти и от URL не зависит. Переход на data router его **не затрагивает**, менять его не нужно.
- Глобальные модалки (`AddExpenseModal`, promo, `main.tsx:66-75`) монтируются в `RootLayout`, то есть внутри роутера, поэтому `useNavigate` в них работает. Модалка, открытая на странице, при смене `location.pathname` закрывается так же, как сейчас (поведение сохраняется, тест в критериях).
- В манифест модалки не попадают. Будущий URL-режим (#412) описан в «Расширении».

#### 2.8 Code-splitting

- Каждый `route.ts` — отдельный чанк. `RootLayout`, `AuthLayout` и `InternalLayout` входят в entry.
- Ручные vendor-группы (`vite.config.ts:258-285`): `dexie` убран и regex `vendor-react` (вместе с `react-router`) починен в 02-B1 — здесь не повторяется.
- Hover-prefetch чанков в фазах не делается (см. «Расширение»).

#### 2.9 Сгенерированные артефакты и тест синхронизации

Скрипт `apps/app/scripts/generate-routing-artifacts.ts` (запуск `node apps/app/scripts/…` без флагов, на Node 24 type stripping включён) читает `routeManifest.ts` и `apps/app/hosting.base.json`, а пишет:

1. `apps/app/vercel.json` — `hosting.base.json` (headers, `/api` rewrites, `.well-known`) плюс сгенерированное:
   - `redirects`: 301 для каждого `legacyPaths` → `/app/<path>` и фиксированные redirect'ы приглашений (§4.2);
   - `rewrites` приложения: для каждого первого сегмента маршрута `/app/<segment>` и `/app/<segment>/:path*` → `/app/index.html`, плюс `/app` и `/app/` → `/app/index.html`;
   - `rewrites` на сайт (catch-all `/:path*` → хост сайта по окружению, §4.1), **последним**, только если в `hosting.base.json` стоит `"siteCutover": true`. Поле вырезается из результата.
2. `apps/app/src/app/router/routing.generated.ts` — `PRIVATE_SPA_NAVIGATION_ALLOWLIST` вида `/^\/app(?:\/(?:dashboard|solo|group|activity|friends|settings|oauth|login|not-found)(?:\/|$)|\/?$)/`. Его импортирует `vite.config.ts` (заменяет `scripts/private-spa-navigation.ts`).
3. Скрипт `npm run routes:generate -w @chipin/app` и шаг `routes:check` в `verify:full`.

Тест `apps/app/scripts/generate-routing-artifacts.test.ts`:
- генерирует в памяти и сравнивает с закоммиченными `vercel.json` и `routing.generated.ts`. При расхождении выдаёт «run npm run routes:generate»;
- каждый `path` манифеста (с подставленными тестовыми параметрами) матчится SW-allowlist **и** хотя бы одним rewrite;
- каждый `legacyPaths` имеет redirect, и ни один redirect не указывает на путь вне манифеста или сайта;
- `vercel.config.test.js` (проверки `/api`) остаётся и работает на сгенерированном файле;
- каждый ключ `ROUTE_MODULES` есть в манифесте и наоборот (это проверяет и TS, тест дублирует для понятного сообщения).

Перечисленные rewrites, а не один `/app/:path*`, нужны, чтобы неизвестный `/app/foo` получал настоящий 404 (через catch-all на 404 сайта) и чтобы SW не отдавал на него offline-оболочку. Это поведение совпадает с нынешним (`private-spa-navigation.ts:1-2`).

#### 2.10 i18n в приложении

- В URL приложения префикса локали нет.
- Ленивая загрузка: `i18next-resources-to-backend` с `(lng, ns) => import(`./locales/${lng}/${ns}.json`)`. Неймспейс `common` берётся из `@chipin/i18n-content/common/${lng}.json`. В entry ничего из JSON не попадает. `src/i18n/resources.ts` удаляется.
- `SUPPORTED_LOCALES` и `DEFAULT_LOCALE` импортируются из `@chipin/i18n-content`, а `src/constants/locales.ts` становится реэкспортом.
- Язык меняется **в одном месте**: `src/app/i18n/setAppLanguage.ts` вызывает `await i18n.loadLanguages(lng)`, затем `i18n.changeLanguage(lng)`, `document.documentElement.lang = lng` и `LocalStorage.set(locale)`. `i18n.changeLanguage` вне этого файла запрещён lint-правилом `no-restricted-syntax`.
- Начальный язык выбирается один раз при init, в таком порядке: `?locale=` на `/app/login` (приходит с сайта) → `LocalUser.settings.language` → сохранённая `locale` → `navigator.languages` → `en`. После загрузки профиля `useSyncUserSettings` вызывает `setAppLanguage` только если язык сервера отличается от текущего.
- Пока язык грузится, работает `Suspense` в `RootLayout`. `PublicLocaleRoute` удаляется, вместе с ним уходит и баг с зависшим спиннером (D1).
- В CI добавляется тест паритета ключей по всем локалям (аудит 02 §5).

#### 2.11 Service worker

- Регистрация одна: `useRegisterSW` из `virtual:pwa-register/react` в `src/app/pwa/ServiceWorkerManager.tsx`. `src/helpers/swUpdates.tsx` и ручной `register('/sw.js')` удаляются, `src/basics/PWABadge.tsx` (спека 05 его не переносит) переименовывается в `ServiceWorkerManager` (TODO в `PWABadge.tsx:6`). `workbox-window` удалён раньше в 02-B1 (в коде не используется). Это единственный PR, который меняет регистрацию SW.
- Конфиг VitePWA: `scope: '/app/'`, `base: '/app/'`, манифест `start_url: '/app/'`, `scope: '/app/'`, **`id: '/'` не менять**: id задаёт идентичность установленного PWA, и при смене id пользователь получит второе приложение. `navigateFallback: '/app/index.html'`, allowlist из `routing.generated.ts`. `globPatterns` без `html` сайта (его в `dist/app` нет); `webp` в паттерне уже добавлен в 05-1. `registerType: 'prompt'`, `skipWaiting: false`, `clientsClaim: true`, `runtimeCaching` нет (кэш API — дело TanStack persister, спека 03).
- Политика обновления:
  1. Обнаружение: при старте, на `visibilitychange → visible` (`registration.update()`), и раз в час, если online.
  2. Prompt: тост «Доступно обновление» с кнопками «Обновить» и «Позже». «Позже» скрывает тост до следующего `visible` после 4 ч.
  3. Принудительно: если ожидающий воркер висит **больше 24 ч** с первого обнаружения (время в `localStorage`), обновление применяется само в ближайшей безопасной точке. Безопасная точка — смена маршрута или `visible`, при этом нет открытой модалки с грязным черновиком. Outbox хранится в IndexedDB и переживает reload (спека 03).
  4. Минимальная версия: экран «Нужно обновить приложение» (блокирующий, одна кнопка `updateServiceWorker(true)` или reload) и функция `showUpdateRequired()` живут здесь (04-2d, за флагом). Детект — спека 03 (03-20): ответ 426 `CLIENT.OUTDATED` или заголовок `X-Min-Client-Version` больше `APP_VERSION` (semver), контракт BE-03-5. Сейчас (D19, вариант A) работает только п. 3. До включения outbox (03-17) обязательны BE-03-5 (новый заголовок `X-Client-Version` + `MIN_CLIENT_VERSION` → 426) и 03-20 (заголовок одной строкой в axios-interceptor из `APP_VERSION`, `src/constants/version.ts`, Vite `define`); экран п. 4 тогда включается. Правило 72 ч: `MIN_CLIENT_VERSION` поднимается только после ≥ 72 ч новой FE-версии в prod (спека 03 §7).
- Миграция со старого SW (scope `/`): по пути `/sw.js` (`apps/app/public-root/sw.js` → `dist/sw.js`) отдаётся kill-switch воркер. Он делает `skipWaiting()`, на `activate` удаляет все caches с префиксом `workbox-precache`, выполняет `self.registration.unregister()` и перезагружает свои клиенты `client.navigate(client.url)`. Хранить не меньше 6 месяцев после cutover. Заголовок `Cache-Control: no-cache` для `/sw.js` и `/app/sw.js`.

### 3. Сайт (Astro, D8)

#### 3.1 Раскладка `apps/site`

```
astro.config.ts           output: 'static', trailingSlash: 'ignore', build.format: 'directory', i18n, sitemap
vercel.json               cleanUrls, headers (CSP сайта), rewrites /join/*
src/
  i18n/                   ui.ts (t(locale, key)), locales/<locale>/{landing,meta,join}.json
  layouts/BaseLayout.astro  <head>: title, description, canonical, hreflang, OG, tokens.css
  components/             Header.astro, Footer.astro, LanguageLinks.astro, Hero.astro, ...
  content/                config.ts + legal/, help/, blog/ (md/MDX)
  pages/
    index.astro                         en home
    [locale]/index.astro                ru/es/pt-br/pt-pt home (getStaticPaths из locales)
    privacy.astro, terms.astro, [locale]/privacy.astro, [locale]/terms.astro  (из коллекции legal)
    help/[...slug].astro, [locale]/help/[...slug].astro
    blog/[...slug].astro, [locale]/blog/[...slug].astro
    join/group.astro, join/friend.astro
    404.astro
public/                   robots.txt, favicon.*, og/*.png
```

#### 3.2 i18n

- `@chipin/i18n-content/locales.ts` экспортирует `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` и `LOCALE_PATH: { en: '', ru: 'ru', es: 'es', 'pt-BR': 'pt-br', 'pt-PT': 'pt-pt' }`. Значения совпадают с `LOCALE_PREFIX` (`publicRouteManifest.ts:11-13`).
- `astro.config.ts`: `i18n: { defaultLocale: 'en', locales: ['en', 'ru', 'es', { path: 'pt-br', codes: ['pt-BR'] }, { path: 'pt-pt', codes: ['pt-PT'] }], routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false } }`. Список строится из `LOCALE_PATH`, а не пишется руками.
- URL не меняются: `/`, `/privacy`, `/terms`, `/ru/`, `/ru/privacy` … `/pt-pt/terms` (15 URL). Redirect'ы для публичных страниц не нужны.
- hreflang в `BaseLayout`: для каждой страницы `<link rel="alternate" hreflang="<code>">` на все локали, у которых есть перевод (`getRelativeLocaleUrl`), плюс `x-default` → en. Canonical — абсолютный `https://chipin.one/...` (`site` в конфиге). Хост `site.chipin.one` никогда не попадает в canonical.
- `@astrojs/sitemap` с `i18n: { defaultLocale: 'en', locales: { en: 'en', ru: 'ru', … 'pt-br': 'pt-BR' } }` пишет `sitemap-index.xml`. `robots.txt` указывает `Sitemap: https://chipin.one/sitemap-index.xml`. `/sitemap.xml` получает 301 на `/sitemap-index.xml`.
- Проверка сборки (перенос `prerender-public.mjs:55-70`): у каждой страницы есть title и description во всех локалях, в HTML нет строк, похожих на токены. Реализуется интеграцией `astro:build:done` в `apps/site/integrations/seoGuard.ts`, которая валит сборку.

#### 3.3 Content collections

`src/content/config.ts`:

```ts
const base = z.object({
    title: z.string().min(1),
    description: z.string().min(50).max(160),
    locale: z.enum(['en', 'ru', 'es', 'pt-BR', 'pt-PT']),
    translationKey: z.string(),          // связывает переводы для hreflang
    updatedAt: z.coerce.date(),
    draft: z.boolean().default(false),
    ogImage: z.string().optional(),
});
export const collections = {
    legal: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/legal' }), schema: base }),
    help:  defineCollection({ loader: glob({ pattern: '**/*.mdx', base: './src/content/help' }), schema: base }),
    blog:  defineCollection({ loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
             schema: base.extend({ author: z.string(), tags: z.array(z.string()).default([]) }) }),
};
```

Файлы лежат как `<collection>/<locale>/<slug>.md(x)`. `draft: true` не попадает в сборку и в sitemap. Страницы без перевода не генерируются, и hreflang на них не ставится (на английский не подменяются).

#### 3.4 Какие страницы переезжают

| Сейчас (`src/`) | На сайте | Примечание |
|---|---|---|
| `pages/HomePage.tsx` + `features/landing/*` (hero, features, how-it-works, showcase, cta) | `pages/index.astro`, `[locale]/index.astro`, `components/*.astro` | тексты из `locales/*/landing.json` и `meta.json` (публичная часть) переезжают в `apps/site/src/i18n/locales` |
| `pages/PrivacyPage.tsx` | `content/legal/<locale>/privacy.md` | разделы `PRIVACY_SECTIONS` (`PrivacyPage.tsx:13`) → markdown |
| `pages/TermsPage.tsx` | `content/legal/<locale>/terms.md` | так же |
| `store/landing-stats-store` (публичная статистика) | `<script>` в `Hero.astro` (vanilla `fetch('/api/…')`, тот же endpoint, что в `src/api/statsApi.ts`) | progressive enhancement: при ошибке блок скрыт; не React-island |
| `public-routes/PublicLanguageLinks.tsx` | `components/LanguageLinks.astro` | |
| `components/Footer.tsx` (публичная версия, `PublicBuildYearContext`) | `components/Footer.astro` (год на этапе сборки) | футер приложения остаётся в app без `PublicBuildYearContext` |

Новые разделы `/help/*`, `/blog/*` в этой спеке только получают маршруты и схему. Наполнение — FE#499 и FE#147.

#### 3.5 Лендинг приглашения

- URL: `/join/group/<token>` и `/join/friend/<token>`. Тип в пути нужен, потому что токены группы и друга — разные сущности на backend (`GroupDtos.kt:11` и `UserService.kt:91-96`). Под один `/join/<token>` их не свести без запроса к API.
- Статика: `pages/join/group.astro` и `pages/join/friend.astro`. Rewrite в `apps/site/vercel.json`: `/join/:kind(group|friend)/:token` → `/join/:kind`.
- Страница `noindex` (`<meta name="robots" content="noindex">`), не попадает в sitemap, `Referrer-Policy: no-referrer`, чтобы токен не утёк в Referer.
- Inline-скрипт:
  1. Достаёт token из `location.pathname` и проверяет его тем же regex, что хотфикс D1. Формат токена — доменная константа, ей не место ни в `packages/tokens`, ни в `packages/i18n-content`, поэтому regex копируется в `apps/site/src/lib/inviteToken.ts`. Тест в `apps/app` импортирует оба regex и падает при расхождении.
  2. Если токен валиден, кнопка «Открыть приглашение» получает href из явной таблицы `{ group: '/app/group/join/', friend: '/app/friends/join/' }[kind] + encodeURIComponent(token)`. Если невалиден, страница показывает «Ссылка повреждена» и ссылку на `/`.
  3. Язык: страница содержит строки всех 5 локалей (≈6 строк × 5) и выбирает по `navigator.languages`. Префиксных `/ru/join/...` нет, потому что ссылки строит приложение без локали.
- Автоматического перехода в приложение **нет**, только явная кнопка. Приложение на `/app/group/join/:token` показывает экран подтверждения из спеки 01 (PR 01-2: generic-текст и кнопка «Вступить»; имя группы — только после BE-01-3) и только после клика вызывает `joinGroup`. Неавторизованный пользователь проходит `/app/login?returnTo=…` и возвращается на экран подтверждения.
- В приложении `buildGroupInviteLink` и `buildFriendInviteLink` (`src/helpers/url.ts:46-50`) меняются на `${origin}/join/group/${encodeURIComponent(t)}` и `/join/friend/…`.

#### 3.6 Стили, islands, SW, 404, аналитика

- Стили: только `@chipin/tokens/tokens.css` (CSS-переменные, шрифты из `packages/tokens/fonts`, `@font-face` self-hosted) и scoped `<style>` в `.astro`. Radix Themes, styled-components и Tailwind не используются. Тёмная тема — тот же механизм, что в приложении: `THEME_INIT_SCRIPT` из `@chipin/tokens/theme-init` (спека 05, PR 05-3) inline в `<head>` ставит `html.light|dark` по ключу `Chipin_theme` и `prefers-color-scheme`.
- React-islands — только для виджета, которому нужно состояние и которого нельзя сделать на `<script>` до ~50 строк. Каждое добавление island'а — отдельный PR с обоснованием. Директивы только `client:visible` или `client:idle`, `client:load` запрещён. Бюджет JS на страницу сайта ≤ 30 KB gz (проверка в `seoGuard`). Сейчас island'ов **ноль**.
- Залогиненный на `/` и `/<locale>/`: inline-скрипт в `<head>` главной проверяет `localStorage` `Chipin_authSessionHint` (`src/constants/localstorage.ts:7`) и делает `location.replace('/app/')`. Это повторяет `HomeRouteGuard`. Страница при этом отдаётся всем одинаково, для краулеров ничего не меняется.
- SW нет. Сайт не регистрирует воркер. Kill-switch `/sw.js` отдаёт проект приложения (§2.11).
- 404: `src/pages/404.astro` с текстом на en и ссылками на локали. Vercel отдаёт его со статусом 404 для любого неизвестного пути, который пришёл через catch-all.
- Аналитика (D18, оставлена пока): сайт подключает только `<script defer src="/_vercel/insights/script.js">`. Путь `/_vercel/*` обслуживает проект, который держит домен (app), поэтому статистика сайта и приложения в одном проекте. Speed Insights на сайте — тем же способом. Sentry на сайте не ставится.
- CSP сайта задаётся отдельно в `apps/site/vercel.json`: базовые директивы те же, что у приложения после 01-1 (`object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`, без Google Fonts), плюс `script-src 'self' 'sha256-…'` для **всех** inline-скриптов (theme-init из 05-3, редирект залогиненного, `/join/*`); хеши считает `seoGuard` и пишет в `vercel.json` при сборке, проверка «закоммиченное = посчитанное». CSP приложения после 04-2b живёт в `apps/app/hosting.base.json` (туда же 05-3 кладёт хеш theme-init).

### 4. Маршрутизация домена

#### 4.1 Кто что отдаёт (порядок правил в `apps/app/vercel.json`)

Vercel сначала проверяет файлы проекта, потом `redirects`, потом `rewrites` по порядку.

1. Файлы app-проекта: `/app/**` (ассеты, `index.html`, `sw.js`, manifest), `/sw.js` (kill-switch), `/.well-known/assetlinks.json`.
2. `redirects` (301), §4.2.
3. `rewrites`:
   - `/api/:path*` → backend по хосту (как сейчас, 3 правила);
   - SPA-rewrites `/app…` → `/app/index.html` (сгенерированные);
   - catch-all на сайт по хосту: `chipin.one` → `https://site.chipin.one/:path*`; `dev.chipin.one` и `*.vercel.app` → `https://site-dev.chipin.one/:path*`.

Catch-all вместо перечисления `/`, `/<locale>/*`, `/help/*`, `/blog/*` из D8 выбран, чтобы не заводить пятый список, который синхронизируется руками. Новые страницы сайта не требуют правок в app. По смыслу это надмножество D8.

#### 4.2 Таблица redirect'ов (301, query string Vercel сохраняет)

| Старый URL | Новый URL | Источник |
|---|---|---|
| `/dashboard`, `/dashboard/:path*` | `/app/dashboard`, `/app/dashboard/:path*` | manifest |
| `/solo`, `/solo/:path*` | `/app/solo…` | manifest |
| `/group/join/:token` | `/join/group/:token` | фиксированное, **до** правила `/group/*` |
| `/group/:path*` | `/app/group/:path*` | manifest |
| `/friends/join/:token` | `/join/friend/:token` | фиксированное, до `/friends` |
| `/friends`, `/friends/:path*` | `/app/friends…` | manifest |
| `/activity`, `/activity/:path*` | `/app/activity…` | manifest |
| `/settings`, `/settings/:path*` | `/app/settings…` | manifest |
| `/oauth/callback` | `/app/oauth/callback` (с `?code&returnTo`) | manifest; держать бессрочно |
| `/not-found` | `/404` | фиксированное |
| `/sitemap.xml` | `/sitemap-index.xml` | фиксированное |
| `/manifest.webmanifest` | `/app/manifest.webmanifest` | фиксированное |
| `/`, `/privacy`, `/terms`, `/ru/…`, `/es/…`, `/pt-br/…`, `/pt-pt/…` | **без изменений** (200 с сайта) | — |

301 вместо 308: все исходные запросы — GET-навигации, а 301 лучше понимают старые краулеры. В Vercel это `"statusCode": 301`.

#### 4.3 Индексация

- `apps/app/vercel.json` headers: `/app/(.*)` → `X-Robots-Tag: noindex, nofollow`.
- `robots.txt` сайта: `Disallow: /app/`, `Disallow: /api/`, `Disallow: /join/`, а старые `Disallow` на `/dashboard` и т. п. убираются, потому что там теперь 301.
- Проверка в критериях: на prod `curl -I` по `/app/dashboard` показывает `X-Robots-Tag`, по `/ru/` — `200` без noindex.

#### 4.4 OAuth

- Новый `redirect_to`: `<origin>/app/oauth/callback?returnTo=<router-path>`. `returnTo` хранится **без** `/app` (это путь роутера). `resolveOAuthReturnTo` (`src/helpers/url.ts:7-26`) принимает обе формы и снимает префикс `/app`, а callback-путь сравнивает в обеих формах.
- Backend: allowlist проверяет только origin (`OAuthRedirectValidator.kt:21-27`). Смена пути **не требует** изменений в `OAUTH_ALLOWED_REDIRECT_ORIGINS`, origin `chipin.one` и `dev.chipin.one` остаются. `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` привязан к имени Vercel-проекта, поэтому app-проект **не переименовывать**. Google Console не затрагивается: в Google зарегистрирован callback backend'а, а не фронта (`OAuthPlugin.kt:28-36`).
- Логины в процессе cutover: backend вернёт пользователя на старый `/oauth/callback?code=…`, 301 отправит на `/app/oauth/callback?code=…`, `code` сохранится.
- С сайта кнопка «Войти/Начать» — обычная ссылка `/app/login?locale=<locale>`. Там приложение вызывает `getSocialAuthUrl` с `locale` для регистрации (`url.ts:39-41`, `resolveRegistrationLocale` читает `?locale` вместо публичного пути).

#### 4.5 Ссылки, которые живут вне приложения

- Backend URL фронта не генерирует. grep по `chipin-backend/src/main` нашёл: писем, push и Telegram нет, invite-ответы содержат только токен. Единственное упоминание — пример в OpenAPI `OAuthOpenApi.kt:30` (`https://app.chipin.one/oauth/callback`). Это документация, её поменять на `https://chipin.one/app/oauth/callback` (Требования к backend).
- Ссылки-приглашения, которые уже разосланы (`/group/join/<t>`, `/friends/join/<t>`), покрывают redirect'ы §4.2. Держать бессрочно.
- Закладки и установленные PWA с `start_url: '/'` открывают `/`, где сработает редирект для залогиненных (§3.6) на `/app/`.
- `assetlinks.json` (namespace `web`, `chipin.one` и `dev.chipin.one`) остаётся на корне app-проекта.

### 5. Что удаляется из приложения после cutover

- `src/root.tsx`: ветка `data-public-ssg` и `hydrateRoot(PublicApp)`. Entry только `createRoot` → `RouterProvider`.
- `src/public-routes/**` целиком: `PublicApp`, `PublicContent`, `PublicEffects`, `PublicTelemetry`, `PublicLanguageLinks`, `PublicBuildYearContext`, `entry-server.tsx`, `internal/useConnect.ts` и тесты.
- `src/features/routing/**`: `AppRouter`, `PublicLocaleRoute`, `ProtectedRoute`, `HomeRouteGuard`, `SoloRouteGuard`, `internal/useConnect.ts` → заменяются `src/app/router/**`.
- `src/constants/publicRouteManifest.ts`, `constants/publicRoutes.ts`, `helpers/publicRoutes.ts` (кроме `getLastAccountLandingPath`, который переезжает в `app/auth`), `types/publicRoutes.ts`, `constants/seo.ts` (если других потребителей нет), `ROUTE_META`, `ROUTES.PRIVACY`, `ROUTES.TERMS`, `useRoutesMeta`.
- `pages/HomePage.tsx`, `PrivacyPage.tsx`, `TermsPage.tsx`, `LegalPages.test.tsx`, `features/landing/**`, `store/landing-stats-store/**`, `api/statsApi.ts` (если других потребителей нет).
- `scripts/prerender-public.mjs`, `prerender-before-workbox.*`, `verify-public-precache.mjs`, `private-spa-navigation.*`, `addPublicDirectoryAliases`, `integration.beforeBuildServiceWorker` в `vite.config.ts`, скрипты `prerender:public` и `verify:public-precache`, а также их вызовы в `build` и `vercel-build`.
- Второй html-entry: `index.html` (публичный) удаляется, `app.html` переименовывается в `index.html`. `rolldownOptions.input` — один.
- Дубли: второй `<Toaster>` и `BackendUnavailableGate` из `PublicContent`, установка темы и языка в `root.tsx` и `PublicEffects`, `helpers/swUpdates.tsx`, `basics/PWABadge.tsx`, `public/robots.txt`, `public/sitemap.xml` (переезжают на сайт). `next-themes` к этому моменту удалён в 05-3 (D14).
- Lint-проверка: после удаления `knip` не находит неиспользуемых экспортов из перечисленных модулей.

### 6. ds-gallery

**Решение: остаётся в `apps/app/ds-gallery/`.** Галерея рендерит реальные компоненты приложения (`basics/*`, `components/*`) через алиасы на `src/*` (`ds-gallery/vite.config.ts`). Отдельный `apps/ds-gallery` потребовал бы вынести эти компоненты в пакет (`packages/ui`), а это отдельный большой рефакторинг вне D7. Типы галереи проверяются в `typecheck` приложения (D13). Пересмотреть, когда появится `packages/ui`.

## Нюансы и подводные камни

- **Kill-switch SW обязателен.** Без него старый SW со scope `/` продолжит отдавать из precache старый `index.html` на `/` и старые prerender-страницы, и пользователь не увидит сайт до обновления SW. Kill-switch выкатывается в **том же** деплое, что и cutover.
- **Scope установленного PWA.** Браузеры обновляют манифест установленного приложения, но то, применится ли новый `scope` без переустановки, зависит от браузера (ASSUMPTION). Если нет, установленное приложение открывает `/`, redirect для залогиненного ведёт на `/app/`, и навигация внутри `/app/` остаётся в окне PWA, потому что `/app/` входит в старый scope `/`. Хуже не станет.
- **`base: '/app/'` и абсолютные пути.** Всё, что ссылается на `/pwa-*.png`, `/favicon.*` и прочее из `public/`, должно идти через `import.meta.env.BASE_URL`. Правило lint: строковый литерал, начинающийся с `/` и оканчивающийся на `.png|.svg|.ico|.webp`, запрещён в `apps/app/src`.
- **Session hint на сайте** — это только подсказка. Если сессия протухла, `/app/` отправит на `/app/login`, цикла нет: `/app/login` с сайта не редиректит.
- **Порядок redirect'ов**: `/group/join/:token` должен стоять раньше `/group/:path*`. Тест генератора проверяет порядок.
- **Внешний rewrite** добавляет к запросам сайта hop через edge. Статика кэшируется на CDN app-проекта по заголовкам сайта: сайт отдаёт `Cache-Control: public, max-age=0, must-revalidate` для HTML и `immutable` для `/_astro/*`.
- **Preview-деплой app** проксирует сайт на `site-dev.chipin.one`, то есть на dev-сборку сайта, а не на preview той же ветки. Для PR, которые меняют оба приложения, сайт проверяется на собственном preview-URL.
- **Telemetry/Sentry**: шаблоны в `helpers/telemetry.ts:24-25` маскируют токены по старым путям. Их нужно обновить на `/app/group/join/:inviteToken` и `/join/group/:token` в том же PR, иначе токены утекут (связь с D1).
- **`vi.mock('…')` по строковым путям** при переносе в `src/app/router` ломаются. Переносить вместе с тестами в одном PR.
- **Хотфикс D1** (стоп-спиннер `PublicLocaleRoute`, PR 01-3) делается на текущем коде **до** этой спеки. Его тест удаляется вместе с `PublicLocaleRoute` в фазе 5.

## Расширение в будущем

- URL-режим модалок (#412): `?modal=<id>&step=<step>` через `useSearchParams` в `ModalHost` и `push` в историю, чтобы кнопка Back на Android закрывала шаг. В манифест добавляется поле `modals?: ModalId[]` (допустимые на маршруте) и проверка в тесте генератора.
- `useBlocker` на грязный черновик расхода при уходе со страницы.
- Hover/viewport prefetch чанков: `preloadRoute(id)` вызывает `ROUTE_MODULES[id]()` на `pointerenter` у NavButton.
- Сайт: OG-картинки на этапе сборки (`satori`), JSON-LD, use-case страницы (#147) в коллекции `help`.
- `packages/ui`, если сайту понадобятся компоненты приложения. Тогда возможен `apps/ds-gallery`.
- Turborepo — когда CI по двум приложениям станет дольше 10 минут.

## Что НЕ делаем

- Не переводим приложение на SSR или RR framework mode: приложение приватное, noindex, offline-first.
- Не используем RR actions и `<Form>` для мутаций (единый путь — спека 03).
- Не вводим префикс локали в URL приложения.
- Не рендерим превью группы на `/join/*` (нужен публичный API; отдельное решение владельца).
- Не делаем Next.js и не кладём сайт и приложение в один Vercel-проект.
- Не переносим домен на новый проект и не меняем DNS.
- Не трогаем `ModalRouter`.

## Фазы / PR

Зависимости: фаза 0 после merge FE#497 (оба меняют `.github/workflows`) и после хотфикса D1. PR ≤ ~400 строк diff'а, rename считается как 0.

| PR | Содержание | Зависит | Параллельно с |
|---|---|---|---|
| 04-0 | Механический перенос в `apps/app` + корневой workspace (§1.6). Владелец в момент merge ставит Root Directory = `apps/app` | FE#497 (cutover на master выполнен, `e6d2f2e`), 01-1…01-3; рекомендуемо 02-C2c и 02-C5 | — (замораживает пути на час: открытые PR rebase'ятся, git сам распознаёт rename) |
| 04-1a | `packages/i18n-content` (locales + common). `packages/tokens` здесь **не** создаётся — его целиком делает 05-2 | 04-0 | 02, 03, 05-2 |
| 04-1b | CI: path filters, `ci-ok`, пути артефактов release-QA (§1.4) | 04-0 | 04-1a |
| 04-2a | Манифест + `routeModules` + `route.ts` по страницам + `createAppRouter` с layout-guard'ами, `errorElement`, `ScrollRestoration`, `useDocumentTitle`. **Пока без** `basename` (пути старые), публичные маршруты временно в манифесте как `access: 'public'` через `PublicLocaleRoute` | 04-1a | спека 03 (loaders пока без prefetch) |
| 04-2b | Генератор артефактов + тест синхронизации; `vercel.json` и allowlist становятся сгенерированными (содержимое то же, CSP переезжает в `hosting.base.json`) | 04-2a | 04-3a |
| 04-2c | Lazy i18n + `setAppLanguage` + паритет ключей (единственный владелец lazy-load локалей) | 04-1a | 04-2b, 04-3a |
| 04-2d | Единая регистрация SW + политика обновления (п. 1–3; экран п. 4 за флагом до BE-03-5) | 04-2a | 04-2c |
| 04-2e | Loaders с prefetch по фабрикам спеки 03 | 04-2a, 03-5 и PR миграции соответствующих сторов (03-8…03-12) | — |
| 04-3a | `apps/site`: каркас Astro, i18n, BaseLayout, 404, robots, sitemap, seoGuard; деплой на `site-dev.chipin.one`/`site.chipin.one` | 04-1a, 04-1b, 05-2 | 04-2* |
| 04-3b | Сайт: главная (5 локалей) + legal-коллекция (privacy/terms) — паритет текстов с текущими страницами; theme-init из 05-3 | 04-3a, 05-3 | 04-2* |
| 04-3c | Сайт: `/join/group`, `/join/friend` + тест равенства regex токена | 04-3a, 01-2 | 04-3b |
| 04-4 | **Cutover**: `basename '/app'`, `base '/app/'`, scope `/app/`, `/app/login`, kill-switch `/sw.js`, redirect'ы §4.2, `siteCutover: true`, новые invite-ссылки, OAuth `redirect_to`, telemetry-шаблоны | 04-2b, 04-2d, 04-3b, 04-3c | — |
| 04-5a/b | Удаление (§5) — двумя PR: (a) public-routes + prerender + scripts; (b) landing/legal страницы, store, дубли | 04-4 + 7 дней без отката | спеки 02, 05 |

Откат cutover (фаза 4):
- **Быстрый (минуты):** в Vercel «Instant Rollback» app-проекта на деплой до фазы 4. Старый деплой ещё содержит prerender-страницы и старый SW, домен и `/api` не менялись. Пользователи, которые уже получили kill-switch, просто зарегистрируют старый `/sw.js` заново.
- **Точечный (PR):** `siteCutover: false` в `hosting.base.json` → `routes:generate` → публичные URL снова отдаёт app. Это возможно только до фазы 5, поэтому фаза 5 ждёт 7 дней.
- Redirect'ы старых приватных URL при откате на старый деплой исчезают вместе с ним. Это безопасно, потому что старые пути там рабочие.
- Критерий отката: рост 404 или 5xx на `/app/*` или `/join/*` > 1 % за час, ошибка OAuth-логина, сайт недоступен через proxy.

## Тесты / критерии приёмки

1. Фаза 0: всё из §1.6 (тесты 1230/1230, тот же состав `dist`, smoke на preview).
2. `generate-routing-artifacts.test.ts` зелёный. Ручное изменение `vercel.json` без генератора валит CI.
3. Unit (RTL с `createMemoryRouter` поверх манифеста):
   - неавторизованный на `/dashboard` → `/login?returnTo=%2Fdashboard`;
   - истёкшая сессия на `/group/:id` показывает `AuthModal`, страница остаётся смонтированной;
   - `/solo` без доступа → `/dashboard`;
   - невалидный `groupId` → NotFound внутри `InternalLayout`, навигация видна;
   - ошибка рендера страницы не скрывает шапку;
   - ошибка загрузки чанка → экран обновления, авто-reload не больше одного раза;
   - открытая глобальная модалка закрывается при смене маршрута (как сейчас);
   - `resolveOAuthReturnTo` принимает `/app/x` и `/x` и отклоняет callback в обеих формах.
4. i18n: в entry-чанке нет JSON локалей (проверка размера: entry ≤ текущего минус 200 KB raw). `changeLanguage` вне `setAppLanguage` валит lint. Тест паритета ключей зелёный.
5. SW: в собранном `dist/app/sw.js` scope `/app/`, allowlist совпадает со сгенерированным, в precache нет HTML сайта. `dist/sw.js` — kill-switch. E2E (Playwright, один сценарий): установить старый SW → задеплоить новый → на `/` получить HTML сайта, а в `navigator.serviceWorker.getRegistrations()` остаётся только scope `/app/`.
6. Сайт: `astro build` с `seoGuard` зелёный. 15 публичных URL отдают 200 с тем же `<title>` и description, что сейчас (снапшот до/после). hreflang на каждой странице указывает на 5 локалей и `x-default`. В sitemap 15 URL. JS на странице ≤ 30 KB gz.
7. Prod после cutover: каждая строка §4.2 проверена `curl -sI` (статус и `Location`). Логин Google проходит с сайта и со старого `/oauth/callback`. Старая invite-ссылка `/group/join/<t>` → лендинг → кнопка → экран подтверждения → вступление.
8. Lighthouse SEO и производительность главной не хуже базовой линии FE#498 (числа прикладываются в FE#496).

## Требования к backend

**BE-04-1 (P3).** Поменять пример в `OAuthOpenApi.kt:30` на `https://chipin.one/app/oauth/callback` (документация).
**BE-04-2 (P1, до 04-4).** Подтвердить, что `OAUTH_ALLOWED_REDIRECT_ORIGINS` на prod и dev содержит `https://chipin.one` и `https://dev.chipin.one`, а `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` — имя текущего app-проекта. Новый site-проект туда добавлять не нужно, он OAuth не инициирует.
Минимальная версия клиента — не отдельный issue: контракт нового заголовка `X-Client-Version` / ответного `X-Min-Client-Version` / 426 `CLIENT.OUTDATED` задаёт BE-03-5 (спека 03 §7; проверено: версионирования API в backend нет, FE версию сейчас не шлёт). BE-03-5 включает `X-Min-Client-Version` в `Access-Control-Expose-Headers`. Обязателен до включения outbox (03-17).
**BE-04-3 (P3, до 04-3b).** Публичный endpoint статистики лендинга остаётся анонимным и кэшируемым (`Cache-Control: public, max-age=300`), потому что его будут звать со статической страницы.

## ADR: публичный сайт и роутинг (ответ на FE#498)

**Статус:** предложено, ждёт решения владельца (D8 одобрено 2026-10-28, формальная запись в FE#498 после FE#497).

**Контекст.**
- Фронт — SPA на Vite 8, React 19 и RR7 с PWA и кастомным SSG для 15 публичных URL (#153).
- SSG держится на дублирующем дереве `PublicApp`, prerender через Vite SSR в хуке Workbox (`prerender-before-workbox.mjs`) и проверке MD5 precache (`verify-public-precache.mjs`). Есть 4 списка маршрутов, которые синхронизируются руками, и 4 места, где пишется язык (аудит 02, находки 1–3).
- SEO-рост (FE#147 use-case страницы, FE#158 метаданные, блог и help) требует много статических локализованных страниц с контентом в markdown.
- Приложение приватное (noindex), offline-first (D2), а код пишут в основном AI-агенты, поэтому важна предсказуемость структуры (DECISIONS: цель 1).

**Рассмотренные варианты.**

| | (a) Статус-кво: Vite + кастомный SSG | (b) Next.js для всего | (c) RR7 framework mode (prerender) | (d) **Astro-сайт + Vite SPA** |
|---|---|---|---|---|
| SEO-возможности | есть, но каждая новая страница = правка манифеста, prerender, precache, двух деревьев | лучшие (SSG/ISR, metadata API) | хорошие (prerender, `meta`) | лучшие для статики: 0 JS, i18n-роутинг, hreflang, sitemap, коллекции из коробки |
| Контент (md/MDX) | нет, тексты в i18n JSON | через MDX-плагины | вручную | встроено, со схемой |
| PWA/offline | работает, но SW делит scope с публичными страницами | App Router и SW-offline для приватного приложения конфликтуют (RSC, серверные запросы); `next-pwa` не поддерживается | SPA-режим возможен, но prerender и SW снова в одном билде | не затронуты: SW только `/app/` |
| Стоимость миграции | 0 | высокая: переписать роутинг, data-слой, auth (in-memory токен + Web Locks), стили (styled-components SSR), все тесты | средняя: перенос на `routes.ts` и route modules, тот же клубок prerender+SW | средняя: только 3 страницы × 5 локалей и раздел; приложение меняется в роутере (D6 нужен в любом варианте) |
| Риск | растёт с каждой SEO-страницей | высокий, big-bang, конфликт с D2/D3 | средний | низкий: сайт выкатывается рядом, откат одним флагом |
| CI/деплой | как сейчас | один проект, но серверный runtime и функции | один проект | два Vercel-проекта, path filters, один домен через rewrite |
| Поддержка | высокая (кастомный пайплайн, который знает один человек) | средняя, частые мажорные изменения | средняя | низкая: два стандартных инструмента с документацией |
| Предсказуемость для агентов | низкая (два дерева) | средняя | средняя | высокая: «маркетинг = `apps/site`, продукт = `apps/app`» |

**Решение.** Вариант (d): публичный и SEO-сайт на Astro (`apps/site`, статический), приложение остаётся SPA на Vite и RR7 data router (`apps/app`) под `/app/*` на том же домене. Монорепо на npm workspaces с общими `packages/tokens` и `packages/i18n-content`.

**Почему отклонены остальные.**
- (a): стоимость каждой SEO-страницы и источник багов (дубли деревьев, i18n, precache) только растут. FE#499 прямо запрещает параллельные системы маршрутов, а (a) уже такую содержит.
- (b): серверный рендер не даёт выигрыша приватному noindex-приложению, но ломает offline-first модель (D2, D3), требует переписать auth и стили и не может выкатываться постепенно (режим DECISIONS: без feature freeze).
- (c): лучше (a) по роутингу, но оставляет публичные страницы и PWA в одном билде и одном scope SW, а контентной системы не даёт. D6 берёт из RR7 только data router — это то, что нужно приложению.

**Последствия.**
- Плюсы: удаляются `PublicApp`, prerender и проверка precache (§5); SEO-страница добавляется markdown-файлом; у приложения один источник маршрутов с тестом; JS на публичных страницах сводится к inline-скриптам.
- Минусы: два стека UI (Astro-компоненты и React). Общие только tokens и `common` i18n, так что шапку и футер придётся держать в двух видах. Hop через внешний rewrite. Два Vercel-проекта и matrix-деплой.
- Обязательства: kill-switch `/sw.js` минимум 6 месяцев; redirect'ы старых URL бессрочно; app-проект не переименовывать (OAuth preview allowlist).
- Пересмотр: если сайту понадобятся персонализированные или серверные страницы (например, превью приглашения с именем группы), рассмотреть Astro `output: 'server'` для отдельных маршрутов на Vercel, не меняя приложение.

## Открытые вопросы

1. ASSUMPTION: backend не отправляет пользователям URL фронта (писем, push и Telegram нет; grep `chipin-backend/src/main` 2026-10-28). Если есть внешний канал (KB, бот, шаблоны в Slack), его ссылки нужно добавить в §4.2.
2. ASSUMPTION: prod- и dev-значения `OAUTH_ALLOWED_REDIRECT_ORIGINS` и `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` в окружении backend совпадают с тем, что ожидает §4.4 (в репо только дефолт `http://localhost:3000`). Владелец проверяет до фазы 4.
3. ASSUMPTION: браузеры подхватят новый `scope` у установленного PWA без переустановки. Если нет, остаётся приемлемый fallback (Нюансы).
4. Решено (D19, вариант A, подтверждено владельцем 2026-10-28): сейчас — только принудительное обновление SW через 24 ч; до включения outbox — BE-03-5 (`X-Client-Version` + `MIN_CLIENT_VERSION` → 426) и 03-20, правило 72 ч.
5. Решено (D18, подтверждено владельцем 2026-10-28): Vercel Analytics и Speed Insights остаются; изолированы по §1.5a; уход с Vercel — отдельное исследование.
6. Решено (D22, подтверждено владельцем 2026-10-28): поддомены `site.chipin.one` и `site-dev.chipin.one`; custom-домены на Hobby бесплатны.
