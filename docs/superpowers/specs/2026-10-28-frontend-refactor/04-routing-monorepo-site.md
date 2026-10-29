# Спека 04: монорепо, роутинг приложения и публичный сайт (D6, D7, D8; ADR для FE#498)

Статус: черновик для владельца, 2026-10-28. Репо: `ChipIn-one/chipin-frontend`. Проверено read-only на ветке `chore/issue-456-ds-gallery` @ `3d0086e`; пути пересверены с `origin/master` `522973a` (там уже нет deploy-workflow'ов — delivery = Vercel Git integration + Promote; правила в `docs/engineering/rules/`). Backend проверен на `chipin-backend` (ветка `develop`).

Идентификаторы PR — `04-<n>` (глобальная схема, `00-overview.md`); «фаза N» в тексте = PR `04-N`. После review A: `04-0` → `04-0a`/`04-0b`, `04-2a` → `04-2a1…04-2a4`, новые `04-2f`, `04-2g`, `04-3d`. После review C (2026-10-28): `04-2a2` делится на `04-2a2`/`04-2a2b`, новый `04-2h` (Playwright E2E SW), `04-3b` → `04-3b1`/`04-3b2`. 2026-10-29 (D26, решение владельца): приложение переезжает на поддомен `app.chipin.one` (dev — `app-dev.chipin.one`) вместо пути `/app/`, сайт остаётся на `chipin.one` (dev — `site-dev.chipin.one`). D26 упрощает D25: базового пути `/app/`, константы `CUTOVER`, смены scope SW, баннера переустановки и окна заморозки больше нет; cutover = перенос доменов в Vercel с откатом обратным переносом (§4.5). Id PR сохранены, содержание `04-2g`, `04-3d`, `04-4` переписано. Backend-issue — `BE-04-<n>`.

Отклонение от DECISIONS: (1) D8 «Hosting: same domain … `/app/*` → SPA» и «SW registered only under /app/» заменены D26: два хоста, `chipin.one` — сайт, `app.chipin.one` — приложение; проекты друг друга не проксируют, SW приложения — `/sw.js` со scope `/` на своём хосте (§2.11, §4). (2) D8 «invite landing `/join/<token>`» → `/join/group/<token>` и `/join/friend/<token>`: токены группы и друга — разные сущности backend (§3.5). (3) D15 «one deploy workflow» — на master deploy-workflow'ов нет, единственный путь — Vercel Git integration + Promote; для двух проектов это и остаётся (§1.4). (4) D6 «per-route errorElement» → три уровня: корень, `AuthLayout`, `InternalLayout` (§2.5; route-модуль может добавить свой `ErrorBoundary`). (5) D20 «catch-all rewrite» снят D26: проксировать сайт через app-проект больше не нужно (§4.1).

Владение пересекающимися темами: lazy-load локалей (D16) — **эта спека** (04-2c); регистрация SW и её дедупликация — **эта спека** (04-2d); vendor-regex и удаление `dexie`/`workbox-window` — спека 02 (02-B1); `packages/tokens` целиком — спека 05 (05-2); ds-gallery остаётся в `apps/app/ds-gallery/` (§6), токены получает по спеке 05 (05-7), typecheck — спека 02 (02-C5).

## Цель

1. Перевести репозиторий в монорепо на npm workspaces: `apps/app` (нынешний SPA), `apps/site` (Astro), `packages/tokens`, `packages/i18n-content`. Первый PR — чистый перенос файлов без изменения поведения.
2. Перевести приложение на data router React Router 7. Источник маршрутов один — манифест. Из него генерируются `vercel.json` (rewrites и redirects) и allowlist навигации SW, а тест проверяет, что они совпадают.
3. Перенести публичные SEO-страницы в Astro (`apps/site`). Удалить из приложения второе дерево `PublicApp`, prerender и проверку precache.
4. Развести сайт и приложение по хостам (D26): сайт на `chipin.one`, приложение на `app.chipin.one` (dev — `site-dev.chipin.one` и `app-dev.chipin.one`); старые URL приложения на `chipin.one` отдают redirect на тот же путь `app.chipin.one`.
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
- Два Vercel-проекта и два хоста (D26). Текущий проект (имя не меняется) — Root Directory `apps/app`, домены `app.chipin.one` (Production) и `app-dev.chipin.one` (ветка `master`); он отдаёт приложение, `/api/*` (same-origin proxy на backend) и `/.well-known/*`. Новый проект `chipin-site` (Root Directory `apps/site`) — домены `chipin.one` (Production) и `site-dev.chipin.one` (`master`). Проекты друг друга не проксируют. Cutover — перенос доменов `dev.chipin.one`, затем `chipin.one` с app-проекта на site-проект; DNS на Vercel, записи не меняются. Откат — вернуть домен на app-проект, это минуты (§4.5).
- Vite `base` = `'/'` и SW `/sw.js` со scope `/` на хосте приложения — как сейчас; базового пути и флага режима нет (§2.1, §2.11). PWA, установленные на `chipin.one` до переезда, не поддерживаются: баннера переустановки нет, офлайн-запуск с их иконки не гарантируется (D26). На `chipin.one` сайт отдаёт самоудаляющийся `/sw.js` (kill-switch) не меньше 6 месяцев (§3.6).
- Один манифест маршрутов (чистые данные) и типизированная карта lazy-модулей. Guard реализован как layout route, `errorElement` есть на корне и на layout. Loaders прогревают TanStack Query (спека 03) и не блокируют навигацию.
- Сайт — Astro static: встроенный i18n с прежними URL (`/`, `/ru/`, `/pt-br/privacy`…), content collections, hreflang, sitemap, только tokens CSS; воркер не регистрирует (только kill-switch `/sw.js`). Лендинг приглашения — `/join/group/<token>` и `/join/friend/<token>` с явной кнопкой на экран подтверждения в `app.chipin.one`. Старые URL приложения на `chipin.one` обслуживают redirect'ы site-проекта (§4.2).
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
      index.html          (бывший app.html после 04-5a; в 04-0a — оба html как есть)
      src/  public/  contract-tests/  ds-gallery/
      scripts/            prerender*, verify-public-precache, private-spa-navigation, run-task-tests,
                          taskTestArgs (пока живы), затем generate-routing-artifacts
    site/                 @chipin/site — Astro
      package.json astro.config.ts tsconfig.json vercel.json src/ public/
  packages/
    tokens/               @chipin/tokens — раскладка и наполнение задаёт спека 05 §1 (generated/, assets/, src/)
    i18n-content/         @chipin/i18n-content — locales.ts, common/<locale>.json
```

#### 1.2 Корневой `package.json`

- `"private": true`, `"workspaces": ["apps/*", "packages/*"]`, `"engines": { "node": "24.21.0" }`. Поле `version` остаётся здесь, это единая версия продукта (D15, спека 02 Д9). **Единственный источник версии — корневой `package.json`**; в `apps/*/package.json` и `packages/*/package.json` поля `version` нет.
- Корень репо в version-скриптах (A-01). Сейчас `scripts/version-resolver.mjs:9` (`REPOSITORY_ROOT = resolve(process.cwd())`) и `scripts/version-check.mjs:8-9` берут путь от `process.cwd()`. После переноса Vite запускается с cwd = `apps/app` (Vercel Root Directory, `npm run -w`), и `readPackageVersion` падает «package.json must contain a version string». Поэтому в 04-0a `version-resolver.mjs`, `version-check.mjs` и `version-bump.mjs` считают корень от своего файла: `const REPOSITORY_ROOT = resolve(import.meta.dirname, '..')`, от него же `PACKAGE_PATH` и `LOCKFILE_PATH`; `process.cwd()` в этих скриптах не используется. `apps/app/vite.config.ts` импортирует `../../scripts/version-resolver.mjs`. Тест в `version-resolver.test.mjs`: после `process.chdir('apps/app')` `resolveAppVersion()` возвращает версию корня.
- Нормализация версии (A-09). Prod собирается Promote'ом коммита `master` (`VERCEL_GIT_COMMIT_REF=master`), а `MAIN_BRANCH = 'main'` (`version-resolver.mjs:6`), поэтому сейчас prod отдаёт `1.0.8-dev-<sha>`. В 04-0a резолвер возвращает чистую `x.y.z`, если `VERCEL_ENV === 'production'` или ветка `main`; иначе `x.y.z-dev-<sha7>`. Тест: `{ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'master' }` → `1.0.8`. Правило для всех потребителей `APP_VERSION` (заголовок `X-Client-Version`, сравнение с `X-Min-Client-Version` в 03-20, Sentry release): сравнивается только semver-ядро `major.minor.patch`, суффикс после `-` отбрасывается до сравнения (контракт для 03-20, см. `00-overview.md` «Кросс-правки для 03»).
- `devDependencies` в корне: `typescript ~5.9.3`, `eslint` и плагины, `prettier`, `husky`, `vitest`, `vite`. Версии для всех workspaces одни.
- `dependencies` в корне: `react`, `react-dom` в точной версии (`19.3.0` без `^`), а также `overrides`: `{ "react": "$react", "react-dom": "$react-dom" }`. Так Astro-интеграция `@astrojs/react` и приложение получают один экземпляр React.
- Прокси-скрипты, чтобы CI и husky не менялись: `"verify:full": "npm run verify:full -w @chipin/app && npm run build -w @chipin/site --if-present"`, `"lint": "eslint ."`, `"test:full": "npm run test:full -w @chipin/app"`, `"build": "npm run build -w @chipin/app"`, `"vercel-build"` не нужен в корне (Vercel собирает в Root Directory), `"version:check"` и `"version:bump"` без изменений.
- `apps/app/package.json`: `"name": "@chipin/app"`, `"private": true`, без поля `version`. Сюда переезжают все runtime-зависимости приложения и его скрипты с прежними именами (`build`, `vercel-build`, `test:task`, `build:ds-gallery` …).
- `packages/*` объявляют `"exports"` на исходники (`"./tokens.css": "./tokens.css"`, `".": "./src/index.ts"`). Сборки пакетов нет, потребители бандлят исходники сами.

#### 1.3 Общие конфиги

- `tsconfig.base.json` (создаёт 02-C5; если он ещё не влит — создаётся здесь по составу 02 Д8) содержит только `compilerOptions` без `baseUrl`, `paths`, `include` и `tsBuildInfoFile`. В 04-0 он переезжает в корень. `apps/app/tsconfig.app.json` делает `extends: "../../tsconfig.base.json"` и сам задаёт `paths` **без `baseUrl`** (формат 02-C3: `"api/*": ["./src/api/*"]`) и `include: ["src", "ds-gallery"]` (02-C5). `apps/site/tsconfig.json` расширяет `astro/tsconfigs/strict` и повторяет строгие флаги из base.
- `eslint.config.js` в корне. Если 02-C4 влит — он импортирует `config/eslint/*` и задаёт `APP_DIR = 'apps/app'` (02 Д9), иначе нынешние блоки получают `files: ['apps/app/src/**/*.{ts,tsx}']`, правило про axios/api (`eslint.config.js:167-193`) переносится как есть. Для `apps/site` отдельный блок с `eslint-plugin-astro`, для `packages/**` — блок без React-правил. Type-aware lint (D13) использует `parserOptions.projectService: true`.
- Prettier и lint-staged подключаются один раз в корне (D13).
- Typecheck всех TS-файлов (A-21): у `packages/tokens` и `packages/i18n-content` свой `tsconfig.json` (`extends: "../../tsconfig.base.json"`, `include: ["src", "*.ts"]`); корневой `tsconfig.json` — solution-файл с `references` на `apps/app`, `packages/*`. `apps/app/scripts/**/*.ts` входят в `apps/app/tsconfig.node.json`. ESLint `projectService.allowDefaultProject` — только для корневых `*.config.js`. Сайт проверяется `astro check` (шаг site в CI, §1.4), потому что `astro build` типы не проверяет.

#### 1.4 CI

- `frontend-ci.yml` (единственный CI-workflow на master) остаётся **одним job'ом `frontend-ci`** — это имя обязательного check'а в ruleset, менять его нельзя (A-20). Второго механизма фильтрации (`dorny/paths-filter`, сторонние actions, job `ci-ok`) нет. Выбор режима делает существующий шаг «Resolve verification mode» через `scripts/ci-gate-policy.mjs`, который расширяется: вместо `docs-only|full` он выдаёт `docs-only|app|site|full`.
  - `app`: изменены только `apps/app/**`;
  - `site`: изменены только `apps/site/**`;
  - `full`: любое изменение в `packages/**`, `package-lock.json`, корневом `package.json`, `tsconfig.base.json`, `eslint.config.js`, `config/**`, `scripts/**`, `.github/**`, а также сочетание app + site;
  - шаги job'а выполняются условно по `steps.mode.outputs.mode`: app → `npm run verify:full -w @chipin/app`; site → `npm run lint` по `apps/site`, `astro check`, `astro build`; full → оба. Шаг admission не дублируется и не пропускается. Новые режимы покрываются кейсами в `scripts/ci-gate-policy.test.mjs`.
- `npm ci` выполняется один раз в корне. Кэш `actions/setup-node` с ключом по корневому `package-lock.json`.
- Пути артефактов: `dist/` → `apps/app/dist/`, `apps/site/dist/`.
- Deploy-workflow'ов нет и не добавляется (D15, спека 02 Д7): оба Vercel-проекта собираются Vercel Git integration из `master`, prod — ручной Promote (`DEPLOYMENT.md` §«Vercel delivery from master»). Release-QA workflow'ы (`prepare-release-qa.yml`, `release-qa-result.yml`) получают префикс `apps/app/` в путях к артефактам.

#### 1.5 Vercel: два проекта

| Проект | Root Directory | Домены | Build | Output |
|---|---|---|---|---|
| нынешний (оставить **имя** без изменений, см. Требования к backend) | `apps/app` | `app.chipin.one` (Production), `app-dev.chipin.one` (`master`), preview `*.vercel.app`; до cutover ещё `chipin.one` и `dev.chipin.one` | `npm run vercel-build` | `dist` |
| `chipin-site` (новый) | `apps/site` | `site-dev.chipin.one` (`master`) с 04-3a; `dev.chipin.one` (`master`) и `chipin.one` (Production) — с cutover (§4.5) | `astro build` | `dist` |

- В обоих проектах включить «Include source files outside of the Root Directory», иначе не найдутся корневой lockfile и `packages/*`.
- DNS-зона `chipin.one` на Vercel (D26). Поддомены `app`, `app-dev`, `site-dev` добавляются в проекты как custom-домены. Cutover и откат — перенос домена между проектами одного team, DNS-записи не меняются. Будущий уход с Vercel = перенос DNS и двух независимых сборок, без внешнего rewrite между проектами (D18).
- Включить «Ignored Build Step» по путям, чтобы проект не пересобирался на чужие изменения (A-30): `[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ../../packages ../../package-lock.json ../../package.json ../../tsconfig.base.json ../../scripts`. Без `VERCEL_GIT_PREVIOUS_SHA` (первый деплой ветки) или при ошибке git команда даёт ненулевой код, и проект собирается. `HEAD^` не используется: при push из нескольких коммитов он видит только последний.
- Тариф владельца — не Hobby (org-проект, D26): custom-домены бесплатны и без лимита, запасной вариант `*.vercel.app` не нужен.
- Лимиты тарифа (A-31): одновременные сборки и дневной лимит деплоев сверить со страницей Limits перед 04-3a. Пропущенные Ignored Build Step деплои тоже создаются (как cancelled). Два проекта × push каждого PR удваивают очередь. Действие: после 02-C6 и после 04-3a замерить длительность CI (`timeout-minutes: 20`) и число деплоев за неделю; если CI > 15 мин или деплоев > 60/день — вынести `import-x/no-cycle` в nightly и включить Ignored Build Step для preview всех веток, кроме PR с `apps/site/**`.

**Модель релиза двух проектов (A-08).** Сайт выпускается так же, как приложение (`DEPLOYMENT.md:42-66`): только ручной Promote.
- В `chipin-site`: Production Branch = `main`, `git.deploymentEnabled.main: false` (через `vercel.passthrough`, §1.5a), домен `site-dev.chipin.one` привязан к ветке `master`. Merge в `master` даёт только dev/preview, prod сайта меняется только Promote'ом. До cutover у Production сайта нет custom-домена: dev-правила проверяются на `site-dev.chipin.one`, prod-правила — сразу после переноса `chipin.one` (§4.5). Настройку делает владелец при создании проекта (04-3a).
- Порядок Promote: сначала app, затем site, оба из одного SHA `master`. Причина: страницы сайта (`/join/*`, кнопки входа) ссылаются на маршруты приложения, а не наоборот.
- Release-QA и completion: GitHub Deployment `Production` создают оба проекта; Issue закрывает только деплой app-проекта (environment `Production – <имя app-проекта>`). В `docs/engineering/release-qa.md` добавляется раздел «Два проекта» с этими тремя правилами. Если org-sweep в `ChipIn-one/.github` фильтрует только по `environment == 'Production'`, нужна правка фильтра там (owner-issue в `.github`, создаётся в 04-3a; без него site-деплой может закрыть Issue раньше app).

#### 1.5a Изоляция провайдера (D18)

Владелец планирует уйти с Vercel (отдельное исследование hosting + аналитики, в работе), поэтому спека не углубляет lock-in:
- Всё Vercel-специфичное живёт только в `apps/app/vercel.json`, `apps/site/vercel.json` и в генераторе (`generate-routing-artifacts.ts`, для сайта — `seoGuard`). Оба `vercel.json` — сгенерированные файлы, руками не правятся.
- Таблица rewrites/redirects/headers хранится в провайдер-нейтральном JSON: `apps/app/hosting.base.json` и `apps/site/hosting.base.json`. Генератор манифеста маршрутов эмитит из него `vercel.json` (`emitters/vercel.ts`); переезд на Cloudflare/Netlify/nginx = новый emitter (`_redirects`/`_headers`, `nginx.conf`), манифест и таблица не меняются.
- Схема `hosting.base.json` (A-07); пример — `apps/app/hosting.base.json` после 04-2g:
  ```jsonc
  {
    "env": {
      "prod": ["app.chipin.one"], "dev": ["app-dev.chipin.one"], "preview": ["*.vercel.app"],
      "legacyProd": ["chipin.one"], "legacyDev": ["dev.chipin.one"]   // до 04-5a: прежние хосты и цель отката (§4.5)
    },
    "headers":   [{ "source": "/(.*)", "env": ["prod", "dev", "preview"], "set": { "X-Robots-Tag": "noindex, nofollow" } }],
    "redirects": [{ "from": "/join/group/:token", "to": "https://app.chipin.one/group/join/:token", "env": ["legacyProd"], "status": 302 },
                  { "from": "/join/friend/:token", "to": "https://app.chipin.one/friends/join/:token", "env": ["legacyProd"], "status": 302 },
                  { "from": "/join/group/:token", "to": "https://app-dev.chipin.one/group/join/:token", "env": ["legacyDev"], "status": 302 },
                  { "from": "/join/friend/:token", "to": "https://app-dev.chipin.one/friends/join/:token", "env": ["legacyDev"], "status": 302 }],
    "rewrites":  [{ "from": "/api/:path*", "to": "https://api.chipin.one/:path*", "env": ["prod", "legacyProd"] },
                  { "from": "/api/:path*", "to": "https://api-dev.chipin.one/:path*", "env": ["dev", "legacyDev", "preview"] }],
    "vercel":    { "passthrough": { "$schema": "…", "buildCommand": "…", "git": { "deploymentEnabled": { "dev": false, "main": false } } } }
  }
  ```
  - `env` у правила — список ключей таблицы `env` (без поля — для всех хостов проекта). Таблица `env` → хосты — единственная; emitter Vercel превращает каждый хост в `has: [{ type: 'host', value: … }]` (для `*.vercel.app` — `{ "suf": ".vercel.app" }`, как сейчас в `vercel.json`), правило с несколькими хостами — в несколько правил.
  - `apps/site/hosting.base.json` — та же схема: `env` = `{ "prod": ["chipin.one"], "dev": ["site-dev.chipin.one", "dev.chipin.one"], "preview": ["*.vercel.app"] }` и поле `appOrigin` по ключу env (`prod` → `https://app.chipin.one`, `dev` и `preview` → `https://app-dev.chipin.one`) для redirect'ов §4.2; там же `legacyRedirectStatus` (`302` до 04-5a, `301` с 04-5a).
  - `vercel.passthrough` emitter копирует в корень `vercel.json` дословно; это единственное место для Vercel-полей без нейтрального аналога (`$schema`, `buildCommand`, `git`). Другой emitter его игнорирует.
  - Тест генератора: в 04-2b сгенерированный `apps/app/vercel.json` семантически равен нынешнему `vercel.json` (порядок и состав rewrites, redirects, headers, `has`, `git`); с 04-2g для хостов `legacyProd`/`legacyDev` он равен нынешнему плюс compat-redirect'ы `/join/*` на хост приложения своего окружения.
- `@vercel/*` в коде — только в одном модуле `apps/app/src/app/telemetry/vercelAnalytics.ts` (bootstrap Analytics + Speed Insights), который удаляется целиком (перенос импортов туда — в PR 04-2b); на сайте — одна строка `<script>` в `BaseLayout` (§3.6). Lint `no-restricted-imports` запрещает `@vercel/*` везде, кроме этого файла. Vercel-only API (Edge Config, KV, Functions, `@vercel/og`) не используются.
- Analytics и Speed Insights пока остаются (D18).

#### 1.6 PR механического переноса (04-0a и 04-0b) — без изменения поведения

Два PR (A-40). **04-0a** — пункты 1–5 и 7: rename и конфиги; команды переноса лежат в закоммиченном `scripts/move-to-workspace.sh`, ревью = перезапустить скрипт на base и сравнить дерево (`git diff --stat` пуст), плюс ручной просмотр не-rename правок (корневой и app `package.json`, lockfile, пути в version-скриптах, workflows). **04-0b** — пункт 6 (замена путей в документации), сразу после 04-0a. Ссылки «04-0» в других спеках означают 04-0a.

1. `git mv` в `apps/app/`: `src`, `public`, `index.html`, `app.html`, `contract-tests`, `ds-gallery`, `vite.config.ts`, `vitest.config.ts`, `vitest.contract.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `pwa-assets.config.ts`, `vercel.json`, `vercel.config.test.js`, а также app-скрипты (`prerender-public.mjs`, `prerender-before-workbox.*`, `verify-public-precache.mjs`, `private-spa-navigation.*`, `run-task-tests.mjs`, `taskTestArgs.*`).
2. Создать корневой `package.json` (§1.2) и `apps/app/package.json`; перенести в корень `tsconfig.base.json` (из 02-C5) и tooling-конфиги спеки 02 (`prettier.config.js`, `config/eslint/`, `.husky/`) и перегенерировать lockfile. Версии зависимостей не меняются: `npm ci` должен дать тот же набор пакетов (сравнить `npm ls --all --json`).
3. Поправить пути: импорт `./scripts/version-resolver.mjs` в `vite.config.ts` → `../../scripts/…`; в `scripts/version-{resolver,check,bump}.mjs` корень от `import.meta.dirname` и нормализация prod-версии (§1.2, A-01/A-09); `root` в `ds-gallery/vite.config.ts` (он считается от `__dirname`, поэтому не меняется), `readFileSync('vercel.json')` в `vercel.config.test.js` → путь от `import.meta.dirname`, пути в `prerender-before-workbox.mjs`, глобы в `eslint.config.js`.
4. `.github/workflows/*`: `node scripts/<repo-level>.mjs` остаются как есть. Ссылки на app-скрипты и `dist/` получают префикс `apps/app/`. `paths-ignore` в `native-development-link.yml` не меняется.
5. `.husky/pre-commit` не меняется, потому что корневые прокси-скрипты сохраняют имена (pre-push удалён в 02-C10, спека 02 §Д0).
6. Документы: `AGENTS.md`, `CLAUDE.md`, `docs/**`, `DEPLOYMENT.md` — замена `src/` → `apps/app/src/` в путях.
7. Vercel: Root Directory → `apps/app` выставить **в момент merge** (владелец, Settings). Порядок действий — в «Фазы». После смены Root Directory preview открытых PR со старой раскладкой не собираются (нет `apps/app`): до merge 04-0a авторы открытых PR делают rebase или ждут; в окне merge открытых feature-PR нет. После 04-0a деплои, собранные до него, не промоутятся (пересборка под новым Root Directory падает); откат prod — только Instant Rollback (правило в `DEPLOYMENT.md`, C1-30).

Критерии «нет изменения поведения»:
- Число тестов и их результат те же (сейчас 1230/1230).
- Из корня `npm run build -w @chipin/app` и из `apps/app` `npx vite build` дают одну и ту же `APP_VERSION` = версии корневого `package.json` (с суффиксом `-dev-<sha>` вне prod); `npm run version:check` из корня и из `apps/app` проходит.
- Набор файлов в `apps/app/dist` совпадает с прежним `dist` с точностью до хешей. Prerender-HTML совпадает побайтно после нормализации хешей в именах ассетов. Число записей precache в `sw.js` то же.
- Preview PR 04-0a не собирается: Root Directory проекта до merge ещё `.`, а `vercel.json` уже в `apps/app` (C2-11). Поэтому до merge — локально: `npm run build -w @chipin/app`, сравнение `dist` (выше). Smoke по `/`, `/ru/`, `/dashboard`, `/group/join/<test>`, `/oauth/callback`, `/api/health` (`200`, то же содержимое) — на `dev.chipin.one` сразу после merge и смены Root Directory, до любого Promote; prod не меняется, пока нет Promote.
- Откат 04-0a: Root Directory → `.` + revert-PR. Критерий: любой smoke-URL не `200` или с другим содержимым.

### 2. Роутинг приложения (D6)

#### 2.1 Базовый путь и хосты

- **Базовый путь не меняется (D26).** Vite `base: '/'`, `build.outDir: 'dist'`, у роутера нет `basename`. Константы `CUTOVER`/`APP_BASE` и файла `app-base.config.ts` нет: приложение живёт в корне своего хоста и до, и после cutover. `base: ''` и `'./'` по-прежнему запрещены: в Vite 8.3 это относительный base (`vite/dist/node/chunks/node.js:37456`), и deep link `/group/<id>` грузил бы `/group/assets/*`, получал бы `app.html` вместо JS и показывал пустой экран. Тест `vite.config.test.ts` (04-2d): `base === '/'`.
- `APP_SHELL = 'app.html'` — константа в `apps/app/pwa.config.ts` (04-2d); 04-5a переименовывает файл в `index.html` и меняет константу. Константы `ROUTES` (`'/dashboard'`), `navigate`, `<Link>` и `matchPath` по `useLocation().pathname` не меняются; `window.location.pathname` читается как сейчас, хелпер для снятия префикса не нужен.
- **Хосты (04-2g).** `src/constants/env.ts` `ENV_URLS` получает для каждого окружения `appHostnames` и `siteOrigin`: prod — `['app.chipin.one', 'chipin.one']` и `https://chipin.one`; dev — `['app-dev.chipin.one', 'dev.chipin.one']` и `https://site-dev.chipin.one` (`chipin.one` и `dev.chipin.one` удаляются в 04-5a). Сейчас `getEnv()` (`src/helpers/env.ts:17-50`) знает только `dev.chipin.one` и бросает ошибку на неизвестном hostname без `VITE_CHIPIN_ENV`, поэтому без этой правки `app-dev.chipin.one` мог бы упасть на старте. `getChipInAppUrl()` остаётся `window.location.origin`; новый `getSiteOrigin()` возвращает `siteOrigin` окружения (preview → dev). Тест `env.test.ts`: каждый хост из `ENV_URLS` даёт ожидаемое окружение и `siteOrigin`.
- Ссылки из приложения на сайт (A-16). `ROUTES.HOME`, `ROUTES.PRIVACY`, `ROUTES.TERMS` удаляются из `ROUTES` в 04-2f и заменяются `SITE_PATHS` (`apps/app/src/app/router/sitePaths.ts`: `home: '/'`, `privacy: '/privacy'`, `terms: '/terms'`, `localeHome(l)`), которые используются только как `<a href>` или `window.location.assign`, никогда в `navigate`/`<Link>`. В 04-2g `SITE_PATHS` становятся абсолютными: `getSiteOrigin()` + путь. До cutover `https://chipin.one/privacy` отдаёт сам app-проект (prerender), после — сайт; поведение для пользователя не меняется. Потребители: `Page404.tsx:18`, `Header.tsx:47,70`, `src/components/Header.tsx:55` и `src/components/header/LandingMobileMenu.tsx:21` (`window.location.assign/href` на публичные пути), `resolveOAuthReturnTo` (`url.ts:9-34`). Lint: `no-restricted-syntax` на `MemberExpression[object.name='ROUTES'][property.name=/^(HOME|PRIVACY|TERMS)$/]`.
- `.well-known/assetlinks.json` остаётся в `apps/app/public/.well-known/` (base `/`, Vite копирует его в `dist/.well-known` сам; отдельной папки `public-root/` и шага копирования нет). В 04-2g в него добавляются `https://app.chipin.one` и `https://app-dev.chipin.one`; та же копия лежит в `apps/site/public/.well-known/assetlinks.json` (04-3d), равенство двух файлов проверяет тест генератора (§2.9).

#### 2.2 Манифест маршрутов

Файл `apps/app/src/app/router/routeManifest.ts` — чистые данные. В нём нет импортов, кроме типов, и только erasable-синтаксис, чтобы Node 24 мог импортировать его из скрипта без сборки.

```ts
type RouteAccess = 'public' | 'protected';
type RouteLayout = 'internal' | 'bare' | 'public';  // 'public' — только переходные id до 04-5a

interface AppRouteDef {
    id: AppRouteId;                 // 'dashboard' | 'solo' | 'group' | ...
    path: string;                   // относительно basename: 'group/:groupId'
    access: RouteAccess;
    layout: RouteLayout;            // internal = InternalPageLayout с навигацией
    guard?: 'solo';                 // доп. layout-guard
    meta: { titleKey: string; entityTitleKey?: string };  // ключи ns 'meta'
    legacyPaths: readonly string[]; // пути на chipin.one, с которых site-проект ведёт redirect на app.chipin.one (§4.2)
    transitional?: true;            // переходный публичный маршрут; удаляется в 04-5a
    localePrefix?: true;            // путь повторяется под 5 префиксами LOCALE_PREFIX
}
```

Маршруты (полная таблица на момент спеки):

| id | path | access | layout | guard | legacyPaths |
|---|---|---|---|---|---|
| `home` | `` (index) | protected | internal | — | — (с 04-5a; до него `/` — переходный `publicHome`) |
| `login` | `login` | public | bare | — | — |
| `oauthCallback` | `oauth/callback` | public | bare | — | `/oauth/callback` |
| `dashboard` | `dashboard` | protected | internal | — | `/dashboard` |
| `solo` | `solo` | protected | internal | solo | `/solo` |
| `group` | `group/:groupId` | protected | internal | — | `/group/:groupId` |
| `groupJoin` | `group/join/:inviteToken` | protected | bare | — | — (на `chipin.one` старый путь ведёт на лендинг сайта, §4.2) |
| `activity` | `activity` | protected | internal | — | `/activity` |
| `activityDetails` | `activity/:parentActivityId` | protected | internal | — | `/activity/:parentActivityId` |
| `friends` | `friends` | protected | internal | — | `/friends` |
| `friendJoin` | `friends/join/:inviteToken` | protected | bare | — | — (§4.2) |
| `settings` | `settings` | protected | internal | — | `/settings` |
| `notFound` | `not-found` | public | bare | — | — (на `chipin.one` после cutover — `404.astro` сайта, §4.2) |
| `publicHome` | `` (index) | public | public | — | — (`transitional`, `localePrefix`) |
| `publicPrivacy` | `privacy` | public | public | — | — (`transitional`, `localePrefix`) |
| `publicTerms` | `terms` | public | public | — | — (`transitional`, `localePrefix`) |

- Переходные маршруты (C2-10). До 04-5a `/`, `/privacy`, `/terms` и их формы с префиксами `LOCALE_PREFIX` (`publicRouteManifest.ts:4-20`) — это `publicHome`/`publicPrivacy`/`publicTerms` (`layout: 'public'`, элемент — нынешний `PublicLocaleRoute`, на `/` — с `HomeRouteGuard`, как сейчас). Они нужны, пока app-проект держит `chipin.one` (до cutover) и служит целью отката (до 04-5a). На `app.chipin.one` они тоже отвечают, но хост целиком под `noindex` (§4.3). `createAppRouter` и генератор берут `transitional`-маршруты до 04-5a; `home` (index) появляется в 04-5a. Rewrites для переходных id генератор не выпускает (это prerender-файлы), в SW-allowlist их нет (точные precache-записи, как сейчас). 04-5a удаляет три id.
- `home` (index, с 04-5a) — loader с `redirect` в предпочитаемый режим (`dashboard` или `solo`). Он заменяет `HomeRouteGuard`.
- `login` — новый экран входа с кнопкой Google. Принимает `?returnTo=` и `?locale=`. На него ведут кнопки сайта и guard. Авторизованного пользователя `login` сразу отправляет на `returnTo` (по умолчанию `/dashboard`), поэтому кнопка сайта «Открыть ChipIn» ведёт на `/login` (§3.6). Сейчас неавторизованного отправляют на лендинг (`ProtectedRoute.tsx:18-48`); после переноса лендинга на другой хост это дало бы лишний круг приложение → сайт → приложение.
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
└─ AuthLayout         loader=requireSession; errorElement=RouteErrorBoundary; <Outlet/> + AuthModal поверх при истёкшей сессии
   ├─ bare routes     group/join/:inviteToken, friends/join/:inviteToken
   └─ InternalLayout  errorElement=RouteErrorBoundary; InternalPageLayout + <Outlet/>
      ├─ index (home redirect), dashboard, group/:groupId, activity, activity/:id, friends, settings
      └─ SoloGuardLayout → solo
```

- `AuthLayout` заменяет `ProtectedRoute`, `InternalRoute` (8 обёрток) и отступы, вшитые в guard (`ProtectedRoute.tsx:43-47`, они уходят в `InternalLayout`).
- `requireSession` (loader) возвращает цепочку промисов (стиль `await`/`.then` свободный, D24): `({ request }) => { const url = new URL(request.url); const returnTo = url.pathname + url.search; return restoreReady.then(() => authReady()).then(session => (isSignedOut(session) ? redirect('/login?returnTo=' + encodeURIComponent(returnTo)) : null)); }`. `authReady()` — промис первичной проверки сессии, который выносится из `useCheckSignIn` в `src/app/auth/session.ts`. `isSignedOut(session)` истинно ровно для строки «redirect» таблицы ниже.
- Решение `requireSession` по результату `authReady()` (C2-25, C3-08; константы `AUTH_STATUS`/`UNAUTH_REASON` из `src/store/authConstants.ts`):

  | статус / причина | действие loader'а |
  |---|---|
  | `AUTHENTICATED` | пропуск |
  | `UNAUTHENTICATED` + `SIGNED_OUT` или `MISSING` | redirect `/login?returnTo=…` (до 04-2f — как сейчас: `SIGNED_OUT` → лендинг, `MISSING` → `AuthModal`) |
  | `UNAUTHENTICATED` + `EXPIRED` или `INVALID` | пропуск; `AuthLayout` показывает `AuthModal` поверх скрытой страницы |
  | `UNAUTHENTICATED` + `ERROR` или `PERSISTENCE_ERROR`; `UNKNOWN_OFFLINE` (таймаут 5 с) | session hint `=== true` и `!isNetworkUsable()` → пропуск на кэш; иначе `AuthModal` (повтор входа); никогда не redirect |

  Loader ни в одной строке не стирает данные пользователя: какие причины вызывают `clearUserData`, задаёт только спека 03 §1.5.
- **Онлайн-предикат один (C1-06).** `isNetworkUsable()` из `src/shared/offline/network.ts` (= `onlineManager.isOnline()` TanStack; его же переключает `/health`-проба спеки 03 §1.2; вводит 03-5). Loaders, guard'ы и экраны этой спеки используют только его. `navigator.onLine` вне `src/shared/offline/**` запрещён lint (`no-restricted-properties`, реестр 02 §Д0). На lie-fi `navigator.onLine === true`, а `isNetworkUsable() === false`, поэтому loader не ждёт `ensureQueryData` и навигация не висит.
- Начальная загрузка (A-27): корневой маршрут задаёт `hydrateFallbackElement` = нынешний спиннер загрузчика, чтобы экран не был пустым, пока `authReady()` ждёт refresh. `authReady()` резолвится не позже чем через 5 с (`Promise.race` с таймером); по таймауту статус = `UNKNOWN_OFFLINE` (последняя строка таблицы выше).
- Offline (D2): если session hint (`LocalStorage.get(LS_KEY_AUTH_SESSION_HINT) === true`) и `!isNetworkUsable()`, loader **не** редиректит, а пропускает на кэшированные данные. Детали в спеке 03.
- Сессия истекла во время работы: `AuthLayout` показывает `AuthModal` поверх `<Outlet/>` и не размонтирует страницу. Черновик расхода не теряется, но только при условии, что спека 03 убирает сброс `expenseModalStore` из `expireSession` (аудит 02, находка 11). Страница под модалкой скрыта: контейнер `<Outlet/>` получает `inert`, `aria-hidden=true` и класс с `visibility: hidden` — состояние живо, но финансы не видны тому, у кого сессию отозвали (C3-09; решение владельца — `00-overview.md`, спека 03).
- Явный sign-out — полная навигация `window.location.assign(getSiteOrigin() + getLastAccountLandingPath())` на сайт (§2.1).
- `SoloGuardLayout` — до 03-9 loader читает `useUsersStore.getState()` (профиль не загружен → пропуск без redirect, как сейчас `SoloRouteGuard`); 03-9 меняет одну строку на `restoreReady.then(() => cachedOrEnsure(selfUserQuery))`. Целевой loader: `restoreReady.then(() => cachedOrEnsure(selfUserQuery)).then(user => (canAccessSolo(user) ? null : redirect('/dashboard')))`, где `cachedOrEnsure` берёт кэш и вызывает `ensureQueryData` только online при пустом кэше (§2.4); офлайн без кэша — пропуск без redirect. Заменяет `SoloRouteGuard.tsx:14-27`.

#### 2.4 Loaders и TanStack Query

- Loader получает `queryClient` через замыкание `createAppRouter(queryClient)`. Query options берутся только из фабрик спеки 03 (`entities/<x>/api/queries.ts`). Свои `queryFn` в loader запрещены.
- Каждый loader начинается с гейта гидрации персистера из спеки 03: `restoreReady` (промис восстановления кэша из IndexedDB), (`await` допустим, D24): `() => restoreReady.then(() => { … })`. Иначе первый loader увидит пустой кэш и уйдёт в сеть до восстановления офлайн-данных.
- Правило: loader **не ждёт сеть**. Он вызывает `void queryClient.prefetchQuery(opts)` для каждого запроса маршрута. Ждать данные (`return queryClient.ensureQueryData(opts)` внутри `.then`) loader может только если данные нужны для решения о redirect/404, `isNetworkUsable()` **и** кэш пуст (`queryClient.getQueryData(opts.queryKey) === undefined`); иначе он берёт кэш. Это касается и `SoloGuardLayout`. Компонент читает те же данные через `useQuery` и показывает существующие скелетоны. Из-за этого навигация не блокируется offline или на медленной сети (D2, `networkMode: 'offlineFirst'`).
- Исключения — loader может бросить ошибку или сделать redirect:
  - Невалидный параметр (`groupId`/`parentActivityId` не UUID) → `throw data(null, { status: 404 })`. Невалидный `inviteToken` (формат `isInviteToken` из 01-1) **не** даёт 404: страница join показывает состояние `invalid` экрана подтверждения 01-2.
  - Redirect'ы guard'ов (§2.3).
- Prefetch по маршрутам: `dashboard` → balances, groups, activity preview. `group` → group(id), groupActivity(id). `activity` → activity page 1. `activityDetails` → subevents(id). `friends` → friends. `settings` → self user. Точные ключи задаёт спека 03.
- Actions (RR7) не используются: мутации идут через `useMutation` и outbox (спека 03). Так у всех мутаций один путь.

#### 2.5 Ошибки

- `Sentry.ErrorBoundary` остаётся снаружи `RouterProvider` и ловит только падения провайдеров.
- `RootErrorBoundary` (корневой `errorElement`) и `RouteErrorBoundary` (на `InternalLayout`, рисуется внутри layout, поэтому шапка и навигация остаются; и на `AuthLayout` — для bare-маршрутов join, C2-32) используют один компонент `RouteErrorView`:
  - `isRouteErrorResponse(e) && e.status === 404` → NotFound без отправки в Sentry.
  - Ошибка загрузки чанка (`/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/`) → экран «Вышла новая версия» с кнопкой обновления: `updateServiceWorker(true)`, а если SW нет, `location.reload()`. Автоматический reload делается один раз за сессию (флаг в `sessionStorage`), чтобы не попасть в цикл.
  - Остальное → `Sentry.captureException(e, { tags: { routeId } })` и карточка восстановления (логика `GlobalErrorFallback.tsx:30-80`).
- `routeId` для тегов берётся из `useMatches()`. Сырой URL с токеном в Sentry не уходит (D1 — утечка токена).

#### 2.6 Meta и title

- `handle: { meta }` из манифеста. Хук `useDocumentTitle()` в `RootLayout` берёт последний match с `handle.meta`, переводит `titleKey` (а при наличии сущности — `entityTitleKey` с именем группы) и выставляет `document.title`. Description приложению не нужен, потому что хост приложения целиком отдаётся с noindex (§4.3).
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

Скрипт `apps/app/scripts/generate-routing-artifacts.ts` (запуск `node apps/app/scripts/…` без флагов, на Node 24 type stripping включён) читает `routeManifest.ts`, `apps/app/hosting.base.json` и из `apps/site/hosting.base.json` только `env`, `appOrigin` и `legacyRedirectStatus`, а пишет:

1. `apps/app/vercel.json` — `hosting.base.json` (headers, `/api` rewrites, compat-redirect'ы, `vercel.passthrough`) плюс SPA-rewrites из `path` манифеста (`/dashboard/:path*` → `/app.html` и т. д.; 04-5a → `/index.html`). Legacy-redirect'ов и catch-all в app-проекте нет. В 04-2b результат семантически равен нынешнему `vercel.json` (§1.5a).
   - headers приложения (A-02, упрощено D26): app-проект отдаёт только свои пути, поэтому CSP, `Referrer-Policy` и `X-Frame-Options` задаются на `source: "/(.*)"` для всех хостов проекта; `X-Robots-Tag: noindex, nofollow` — только для `prod`/`dev`/`preview` (не для `legacyProd`/`legacyDev`, где до cutover живут публичные страницы).
2. `apps/site/legacy-redirects.generated.json` — redirect'ы старых URL приложения на хостах сайта (§4.2): для каждого `legacyPaths` манифеста `<path>` и `<path>/:path*` → `<appOrigin>` + тот же путь, по env сайта, плюс фиксированные строки §4.2; статус — `legacyRedirectStatus`. Site-emitter (§1.5a) вливает файл в `apps/site/vercel.json`. Так список приватных путей остаётся в одном манифесте.
3. `apps/app/src/app/router/routing.generated.ts` — `PRIVATE_SPA_NAVIGATION_ALLOWLIST` из `path` манифеста; в 04-2b тест сверяет его с нынешними двумя regex `scripts/private-spa-navigation.ts`, в 04-5a к нему добавляется index `/` (публичных страниц в приложении больше нет). Его импортирует `pwa.config.ts` (заменяет `scripts/private-spa-navigation.ts`).
4. Скрипт `npm run routes:generate -w @chipin/app` и шаг `routes:check` в `verify:full`.

Тест `apps/app/scripts/generate-routing-artifacts.test.ts`:
- генерирует в памяти и сравнивает с закоммиченными `apps/app/vercel.json`, `apps/site/legacy-redirects.generated.json` и `routing.generated.ts`. При расхождении выдаёт «run npm run routes:generate»;
- каждый `path` манифеста (с подставленными тестовыми параметрами) матчится SW-allowlist **и** хотя бы одним rewrite;
- каждый `legacyPaths` имеет redirect в `legacy-redirects.generated.json`; его `destination` начинается с `appOrigin` своего env и сохраняет путь; ни один redirect не указывает на путь вне манифеста или сайта;
- `/group/join/:token` и `/friends/join/:token` стоят раньше `/group/:path*` и `/friends/:path*`;
- `vercel.config.test.js` (проверки `/api`) остаётся и работает на сгенерированном файле: для хостов `prod` и `legacyProd` `/api` ведёт на `api.chipin.one`, для остальных — на `api-dev.chipin.one`;
- каждый ключ `ROUTE_MODULES` есть в манифесте и наоборот (это проверяет и TS, тест дублирует для понятного сообщения);
- `X-Robots-Tag` есть для хостов `app.chipin.one`, `app-dev.chipin.one`, `*.vercel.app` и отсутствует для `chipin.one`, `dev.chipin.one`;
- в 04-2b результат семантически равен нынешнему `vercel.json`, legacy-redirect'ов и catch-all нет (A-06);
- ни один `redirects[].source` в `apps/site/vercel.json` не матчит файл собранного `apps/site/dist` (`sw.js`, `.well-known/*`, `_astro/**`, `favicon.*`): redirect Vercel срабатывает раньше файла (§4.1; C1-19, C3-11); `apps/app/public/.well-known/assetlinks.json` и `apps/site/public/.well-known/assetlinks.json` совпадают.

Перечисленные rewrites, а не один `/:path*`, нужны, чтобы неизвестный путь получал настоящий 404 и чтобы SW не отдавал на него offline-оболочку. Это поведение совпадает с нынешним (`private-spa-navigation.ts:1-2`).

#### 2.10 i18n в приложении

- В URL приложения префикса локали нет.
- Ленивая загрузка: `i18next-resources-to-backend` с `(lng, ns) => ns === 'common' ? loadCommon(lng) : import(`./locales/${lng}/${ns}.json`)` (относительный шаблон `./` Vite бандлит через dynamic-import-vars). Неймспейс `common` берётся из `@chipin/i18n-content`: bare-специфайер с переменной (`import(`@chipin/i18n-content/common/${lng}.json`)`) Vite **не** бандлит и оставляет runtime-импортом с 404 (A-13). Поэтому пакет экспортирует `loadCommon(lng: SupportedLocale): Promise<Record<string, unknown>>` из `packages/i18n-content/src/loadCommon.ts`, построенный на `import.meta.glob('../common/*.json', { import: 'default' })` (ключ `../common/${lng}.json`; неизвестная локаль → reject). `package.json` пакета: `exports` `".": "./src/index.ts"`, `"./common/*": "./common/*"`. В entry ничего из JSON не попадает. `src/i18n/resources.ts` удаляется. Тест сборки: в `dist/assets` ровно 5 чанков `common`.
- `SUPPORTED_LOCALES` и `DEFAULT_LOCALE` импортируются из `@chipin/i18n-content`, а `src/constants/locales.ts` становится реэкспортом.
- Язык меняется **в одном месте**: `src/app/i18n/setAppLanguage.ts` возвращает цепочку (стиль свободный, D24): `i18n.loadLanguages(lng).then(() => i18n.changeLanguage(lng)).then(() => { document.documentElement.lang = lng; LocalStorage.set(LS_KEY_LOCALE, lng); })`. `i18n.changeLanguage` вне этого файла запрещён lint-правилом `no-restricted-syntax`.
- Начальный язык выбирается один раз при init, в таком порядке: `LocalUser.settings.language` → сохранённая `locale` → `?locale=` на `/login` (приходит с сайта; `localStorage` сайта и приложения на разных origin, поэтому сайт знает только язык своей страницы или `navigator.languages`, §3.5) → `navigator.languages` → `en`. После загрузки профиля `useSyncUserSettings` вызывает `setAppLanguage` только если язык сервера отличается от текущего.
- Пока язык грузится, работает `Suspense` в `RootLayout`. `PublicLocaleRoute` удаляется, вместе с ним уходит и баг с зависшим спиннером (D1).
- В CI добавляется тест паритета ключей по всем локалям (аудит 02 §5).

#### 2.11 Service worker

**D26 (2026-10-29) упрощает D25.** SW приложения — `/sw.js` со scope `/` на хосте приложения (`app.chipin.one`, `app-dev.chipin.one`, preview), одна регистрация (C2-01). Scope не меняется ни при cutover, ни после: хост приложения отдаёт только приложение. PWA, установленные на `chipin.one` до переезда, не поддерживаются: баннера переустановки нет, офлайн-запуск с их иконки не гарантируется; онлайн такая иконка открывает сайт с кнопкой входа в приложение (принято владельцем, около 10 prod-пользователей). Новые установки делаются с `app.chipin.one`. На `chipin.one` site-проект отдаёт kill-switch `/sw.js` (§3.6); сайт воркер не регистрирует.

- Регистрация одна: `useRegisterSW` из `virtual:pwa-register/react` в `src/app/pwa/ServiceWorkerManager.tsx` регистрирует `/sw.js` со scope `/` — ровно то, что сегодня делает ручной `register('/sw.js', { scope: '/' })` (`swUpdates.tsx:221-289`), поэтому 04-2d не создаёт вторую регистрацию и поведение SW не меняется (C2-01). Других мест, где задаётся scope, нет. `src/helpers/swUpdates.tsx` и ручной `register('/sw.js')` удаляются; второй путь обновления `src/helpers/serviceWorkerRecovery.ts` (`SKIP_WAITING` postMessage, `:107-128`) тоже удаляется, а `GlobalErrorFallback.tsx:19` вызывает `updateServiceWorker(true)` из `ServiceWorkerManager` (A-26), `src/basics/PWABadge.tsx` (спека 05 его не переносит) переименовывается в `ServiceWorkerManager` (TODO в `PWABadge.tsx:6`). `workbox-window` удалён раньше в 02-B1 (в коде не используется). Это единственный PR, который меняет регистрацию SW.
- Конфиг VitePWA строит чистая функция `buildPwaOptions()` в `apps/app/pwa.config.ts` (тест `pwa.config.test.ts` проверяет таблицу; цвета манифеста — из `@chipin/tokens/generated/manifest-colors.json`, спека 05 §6):

  | опция | значение |
  |---|---|
  | `outDir` VitePWA (куда пишется `sw.js`; он же `globDirectory`) | `dist` |
  | `buildBase` (путь регистрации и `<link rel="manifest">`) | `/` |
  | `scope` (регистрация и манифест) | `/` |
  | файл SW → URL | `dist/sw.js` → `/sw.js` |
  | файл манифеста → URL | `dist/manifest.webmanifest` → `/manifest.webmanifest` |
  | манифест `start_url` / `scope` / `id` | `/` / `/` / `/` (как сейчас; на новом origin браузер считает установку новым приложением) |
  | иконки манифеста | `/pwa-*.png` и т. д. (как сейчас) |
  | `globPatterns` | `**/*.{js,css,html,svg,png,ico,webp}` (как сейчас) |
  | `navigateFallback` | `APP_SHELL` (`app.html`; 04-5a → `index.html`) |
  | `navigateFallbackAllowlist` | `PRIVATE_SPA_NAVIGATION_ALLOWLIST` из `routing.generated.ts` (§2.9) |

  Общее: `registerType: 'prompt'`, `injectRegister: false`, `skipWaiting: false`, `clientsClaim: true`, `cleanupOutdatedCaches: true`, `inlineWorkboxRuntime: true` (рядом с SW не появляется `workbox-*.js`), `runtimeCaching` нет; `manifestTransforms: [addPublicDirectoryAliases]` — до 04-5a, пока есть prerender. Кэша API в SW нет (это TanStack persister, спека 03). Опции сверены с `vite-plugin-pwa@1.3.0` (`dist/index.js`: `swDest = outDir/filename`, `globDirectory = outDir`, путь регистрации и `<link rel="manifest">` = `buildBase` + `filename`/`manifestFilename`) и `workbox-build@7.4.1` (`navigateFallbackAllowlist`, `inlineWorkboxRuntime`).
- Офлайн на хосте приложения: пути из allowlist — оболочка из precache; неизвестный путь не матчит allowlist и получает 404, как сейчас; переходные публичные страницы (до 04-5a) — точные precache-записи, как сейчас.
- `id` манифеста не меняется (`/`). Установка с `app.chipin.one` для браузера — другое приложение, чем старая установка с `chipin.one` (другой origin); миграции установок нет.
- Политика обновления:
  1. Обнаружение: при старте, на `visibilitychange → visible` (`registration.update()`), и раз в час, если online.
  2. Prompt: тост «Доступно обновление» с кнопками «Обновить» и «Позже». «Позже» скрывает тост до следующего `visible` после 4 ч.
  3. Принудительно: если ожидающий воркер висит **больше 24 ч** с первого обнаружения (время в `localStorage`), обновление применяется само в ближайшей безопасной точке. Безопасная точка — смена маршрута или `visible`, при этом нет открытой модалки с грязным черновиком, `queryClient.isMutating() === 0` и нет outbox-операции в статусе `sending` (`outboxState` спеки 03 §2.3; до 03-15a outbox нет — условие истинно) (C3-12). Outbox хранится в IndexedDB и переживает reload (спека 03).
  4. Минимальная версия: экран «Нужно обновить приложение» (блокирующий, одна кнопка `updateServiceWorker(true)` или reload) и функция `showUpdateRequired()` живут здесь (04-2d, за флагом). Кнопка экрана вызывает `registration.update()`, ждёт `waiting` до 10 с и только тогда `updateServiceWorker(true)`; если нового воркера нет, экран пишет «Обновление ещё не опубликовано, попробуйте позже» и не перезагружает (иначе цикл reload той же версии, C3-26). Перед любым reload вызываются колбэки `onBeforeAppReload` из `ServiceWorkerManager` (03-13 регистрирует сохранение черновика расхода в `sessionStorage`). Экран показывается, когда `outboxGate` (`shared/offline/outboxGate.ts`, спека 03 §2.4; до 03-15a — no-op-заглушка) закрыт с причиной `outdated` (replay остановлен до обновления); `showUpdateRequired()` переводит гейт в это состояние, outbox не удаляется. Детект — спека 03 (03-20): ответ 426 `CLIENT.OUTDATED` или заголовок `X-Min-Client-Version` больше semver-ядра `APP_VERSION` (сравнение только `major.minor.patch`, суффикс `-dev-<sha>` отбрасывается, §1.2), контракт BE-03-5. Сейчас (D19, вариант A) работает только п. 3. До включения outbox (03-17) обязательны BE-03-5 (новый заголовок `X-Client-Version` + `MIN_CLIENT_VERSION` → 426) и 03-20 (заголовок одной строкой в axios-interceptor из `APP_VERSION`, `src/constants/version.ts`, Vite `define`); экран п. 4 тогда включается. Правило 72 ч: `MIN_CLIENT_VERSION` поднимается только после ≥ 72 ч новой FE-версии в prod (спека 03 §7).
- **Отклонённые альтернативы.** (a) SW `/sw.js` со scope `/` бессрочно на общем домене с `offline-root.html` (вариант (a) C3-01). (b) D25: `/app/sw.js` со scope `/app/`, kill-switch на `/sw.js` того же origin и одноразовый баннер переустановки. Обе схемы нужны были только из-за общего origin сайта и приложения; D26 развёл их по хостам, и оба механизма не нужны.

### 3. Сайт (Astro, D8)

#### 3.1 Раскладка `apps/site`

```
astro.config.ts           output: 'static', trailingSlash: 'ignore', build.format: 'directory', i18n, sitemap
vercel.json               cleanUrls, headers (CSP сайта), rewrites /join/* и /api/stats, redirect'ы §4.2 (из legacy-redirects.generated.json)
src/
  i18n/                   ui.ts (t(locale, key)), locales/<locale>/{landing,meta,join}.json
  layouts/BaseLayout.astro  <head>: title, description, canonical, hreflang, OG, tokens.css
  components/             Header.astro, Footer.astro, LanguageLinks.astro, Hero.astro, ...
  content.config.ts       схемы коллекций (Astro 7: `src/content.config.ts`, не `src/content/config.ts`)
  content/                legal/, help/, blog/ (md/MDX)
  pages/
    index.astro                         en home
    [locale]/index.astro                ru/es/pt-br/pt-pt home (getStaticPaths из locales)
    privacy.astro, terms.astro, [locale]/privacy.astro, [locale]/terms.astro  (из коллекции legal)
    help/[...slug].astro, [locale]/help/[...slug].astro
    blog/[...slug].astro, [locale]/blog/[...slug].astro
    join/group.astro, join/friend.astro
    404.astro
public/                   robots.txt, favicon.*, og/*.png, sw.js (kill-switch, §3.6), .well-known/assetlinks.json
```

#### 3.2 i18n

- `@chipin/i18n-content/locales.ts` экспортирует `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` и `LOCALE_PATH: { en: '', ru: 'ru', es: 'es', 'pt-BR': 'pt-br', 'pt-PT': 'pt-pt' }`. Значения совпадают с `LOCALE_PREFIX` (`publicRouteManifest.ts:11-13`).
- `astro.config.ts`: `i18n: { defaultLocale: 'en', locales: ['en', 'ru', 'es', { path: 'pt-br', codes: ['pt-BR'] }, { path: 'pt-pt', codes: ['pt-PT'] }], routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false } }`. Список строится из `LOCALE_PATH`, а не пишется руками.
- URL не меняются: `/`, `/privacy`, `/terms`, `/ru/`, `/ru/privacy` … `/pt-pt/terms` (15 URL; домашние страницы локалей — со слешем, остальные — без, как в `publicRouteManifest.ts:14-19`). Дубли по слешу (A-33): `trailingSlash: 'ignore'` отдаёт и `/privacy`, и `/privacy/` с 200, поэтому `apps/site/hosting.base.json` получает сгенерированные из `LOCALE_PATH` × страницы redirect'ы 301: `/<page>/` → `/<page>` для не-домашних и `/<locale>` → `/<locale>/` для домашних локалей. Одна форма URL = canonical.
- hreflang в `BaseLayout`: для каждой страницы `<link rel="alternate" hreflang="<code>">` на все локали, у которых есть перевод (`getRelativeLocaleUrl`), плюс `x-default` → en. Canonical — абсолютный `https://chipin.one/...` (`site` в конфиге). Хосты `site-dev.chipin.one` и `dev.chipin.one` никогда не попадают в canonical.
- `@astrojs/sitemap` с `i18n: { defaultLocale: 'en', locales: { en: 'en', ru: 'ru', … 'pt-br': 'pt-BR' } }` пишет `sitemap-index.xml`. `robots.txt` указывает `Sitemap: https://chipin.one/sitemap-index.xml`. `/sitemap.xml` получает 301 на `/sitemap-index.xml`.
- Проверка сборки (перенос `prerender-public.mjs:55-70`): у каждой страницы есть title и description во всех локалях, в HTML нет строк, похожих на токены. Реализуется интеграцией `astro:build:done` в `apps/site/integrations/seoGuard.ts`, которая валит сборку. Паритет ключей сайта (A-32): тест `apps/site/src/i18n/parity.test.ts` сверяет ключи всех `apps/site/src/i18n/locales/<locale>/*.json`, включая `join.json`, с `en`; запускается в site-шаге CI.

#### 3.3 Content collections

`src/content.config.ts` (A-14: в astro 7.4 конфиг коллекций — `src/content.config.ts`; файл `src/content/config.ts` молча игнорируется; `z` импортируется из `astro/zod`). В 04-3a — `astro@^7.4`.

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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

Файлы лежат как `<collection>/<locale-path>/<slug>.md(x)`, папка локали — в форме пути (`en`, `ru`, `es`, `pt-br`, `pt-pt`, значения `LOCALE_PATH`), поле `locale` во frontmatter — код (`pt-BR`) (A-32). Критерий 04-3a: фикстура с невалидным frontmatter валит `astro build`. `draft: true` не попадает в сборку и в sitemap. Страницы без перевода не генерируются, и hreflang на них не ставится (на английский не подменяются).

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

- URL: `/join/group/<token>` и `/join/friend/<token>` на `chipin.one`. Тип в пути нужен, потому что токены группы и друга — разные сущности на backend (`GroupDtos.kt:11` и `UserService.kt:91-96`). Под один `/join/<token>` их не свести без запроса к API.
- Статика: `pages/join/group.astro` и `pages/join/friend.astro`. Rewrite в `apps/site/vercel.json`: `/join/:kind(group|friend)/:token` → `/join/:kind`.
- Страница `noindex` (`<meta name="robots" content="noindex">`), не попадает в sitemap, `Referrer-Policy: no-referrer`, чтобы токен не утёк в Referer.
- Inline-скрипт:
  1. Достаёт token из `location.pathname` и проверяет его тем же regex, что хотфикс D1. Формат токена — доменная константа, ей не место ни в `packages/tokens`, ни в `packages/i18n-content`, поэтому regex копируется в `apps/site/src/lib/inviteToken.ts`. Тест в `apps/app` импортирует оба regex и падает при расхождении.
  2. Если токен валиден, кнопка «Открыть приглашение» получает href `PUBLIC_APP_ORIGIN` (§4.4) + явная таблица `{ group: '/group/join/', friend: '/friends/join/' }[kind] + encodeURIComponent(token)`. Если невалиден, страница показывает «Ссылка повреждена» и ссылку на `/`.
  3. Язык: страница содержит строки всех 5 локалей (≈6 строк × 5) из `apps/site/src/i18n/locales/<locale>/join.json` (те же JSON, что у остального сайта, проверяются тестом паритета §3.2; inline-строк в `.astro` нет) и выбирает по `navigator.languages` → `en`. `localStorage` приложения сайту недоступен (другой origin, D26), а ключи `Chipin_*` на `chipin.one` после cutover — устаревшие данные старой установки, сайт их не читает. Кнопка передаёт выбранный код как `?locale=<код>` (и внутри `returnTo`), чтобы регистрация нового пользователя получила верный язык (`url.ts:39-41`; C3-25); у существующего пользователя приложение берёт сохранённый язык раньше `?locale` (§2.10). Префиксных `/ru/join/...` нет, потому что ссылки строит приложение без локали.
- Автоматического перехода в приложение **нет**, только явная кнопка. Приложение на `app.chipin.one/group/join/:token` показывает экран подтверждения из спеки 01 (PR 01-2: generic-текст и кнопка «Вступить»; имя группы — только после BE-01-3) и только после клика вызывает `joinGroup`. Неавторизованный пользователь проходит `/login?returnTo=…` и возвращается на экран подтверждения.
- В приложении `buildGroupInviteLink` и `buildFriendInviteLink` (`src/helpers/url.ts:46-50`) в 04-2g меняются на `${getSiteOrigin()}/join/group/${encodeURIComponent(t)}` и `/join/friend/…`. До cutover `chipin.one` ещё у app-проекта, и compat-redirect (§4.2, 302) ведёт `/join/group/<t>` сразу на `https://app.chipin.one/group/join/<t>` (dev — `app-dev.chipin.one`), чтобы новый участник не заводил данные на старом origin; после cutover ссылку открывает лендинг сайта.

#### 3.6 Стили, islands, SW, 404, аналитика

- Стили: только `@chipin/tokens/radix-colors.css` + `@chipin/tokens/tokens.css` (раскладка пакета — спека 05 §1; шрифт системный, webfont нет) и scoped `<style>` в `.astro`. Favicon (A-28): `BaseLayout` ставит `<link rel="icon" href={faviconUrl}>`, где `faviconUrl` — `import faviconUrl from '@chipin/tokens/assets/favicon.svg?url'` (Astro выпускает хешированный файл в `/_astro/`); `/favicon.*` на `chipin.one` отдаёт сайт, иконки манифеста PWA — app-проект на своём хосте. Radix Themes, styled-components и Tailwind не используются. Тёмная тема — тот же механизм, что в приложении: `THEME_INIT_SCRIPT` из `@chipin/tokens/theme-init` (спека 05, PR 05-3) inline в `<head>` ставит `html.light|dark` по ключу `Chipin_theme` и `prefers-color-scheme`.
- React-islands — только для виджета, которому нужно состояние и которого нельзя сделать на `<script>` до ~50 строк. Каждое добавление island'а — отдельный PR с обоснованием. Директивы только `client:visible` или `client:idle`, `client:load` запрещён. Бюджет JS на страницу сайта ≤ 30 KB gz (проверка в `seoGuard`). Сейчас island'ов **ноль**.
- Редиректа залогиненного с `/` на приложение **нет** (D26): признак сессии `Chipin_authSessionHint` живёт в `localStorage` приложения на `app.chipin.one`, сайту на `chipin.one` он недоступен, а одноимённый ключ на `chipin.one` после cutover — устаревший. Шапка сайта на всех страницах содержит кнопку «Открыть ChipIn» → `${PUBLIC_APP_ORIGIN}/login`: до 04-5a корень `/` хоста приложения — переходный `publicHome` (§2.2), а `/login` авторизованного сразу ведёт в приложение; с 04-5a кнопка может вести на `${PUBLIC_APP_ORIGIN}/`. Standalone-редиректа и метки `?src=root` тоже нет: старые установки PWA не поддерживаются (§2.11). `HomeRouteGuard` удаляется в 04-5a без замены на сайте.
- Сайт не регистрирует воркер. В `apps/site/public/sw.js` лежит kill-switch для старой регистрации приложения на `chipin.one` (scope `/`, D26): `install` → `self.skipWaiting()`; `activate` → `caches.keys()` и удаление **всех** caches origin (после cutover на `chipin.one` своих кэшей нет ни у кого) → `self.registration.unregister()` → `self.clients.matchAll({ type: 'window' })` и `client.navigate(client.url)`; обработчика `fetch` нет. IndexedDB и `localStorage` kill-switch не трогает. Header `Cache-Control: no-cache` для `/sw.js` (`apps/site/hosting.base.json`). Хранить не меньше 6 месяцев после cutover; удаление — отдельный PR не раньше этого срока. Что видит старая установка или вкладка онлайн: старый SW ещё один раз может отдать прежнюю оболочку из precache; её проверка обновления получает kill-switch, он активируется, чистит caches, снимает регистрацию и перезагружает окно; дальше `chipin.one` приходит из сети — сайт, а старые пути приложения — redirect'ом на `app.chipin.one` (§4.2). Офлайн старый SW отдаёт прежнюю оболочку до первого онлайн-запуска. Тест `apps/site/src/lib/swKillSwitch.test.ts` (fake `caches`, `registration`, `clients`): после `activate` caches пусты, `unregister` и `navigate` вызваны по разу.
- 404: `src/pages/404.astro` с текстом на en и ссылками на локали. Vercel отдаёт его со статусом 404 для любого неизвестного пути на хосте сайта.
- Аналитика (D18, оставлена пока): сайт подключает только `<script defer src="/_vercel/insights/script.js">`. Путь `/_vercel/*` обслуживает проект, который держит домен, поэтому статистика сайта — в site-проекте, приложения — в app-проекте. Speed Insights на сайте — тем же способом. Sentry на сайте не ставится.
- Токен инвайта не уходит в аналитику (A-15, D1): `BaseLayout` подключает скрипты analytics/speed-insights только при `includeAnalytics !== false`, а `join/group.astro` и `join/friend.astro` передают `includeAnalytics={false}`. Дополнительно (review B M13) на всех страницах сайта перед скриптом аналитики стоит inline-скрипт `window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); }; window.va('beforeSend', e => ({ ...e, url: e.url.replace(/\/join\/(group|friend)\/[^/?#]+/, '/join/$1/[token]') }));` — его sha256 входит в CSP сайта (`seoGuard`, §3.6). Тест `apps/site/src/lib/analyticsRedact.test.ts`: `/join/group/abc?x=1` → `/join/group/[token]?x=1`. `seoGuard` валит сборку, если HTML под `join/` содержит `_vercel/insights` или `_vercel/speed-insights`. Спекам 01 и 03 ничего менять не нужно: app-санитайзер `sanitizeTelemetryEvent` остаётся как есть.
- CSP сайта — **только** в site-проекте (`apps/site/hosting.base.json` → `apps/site/vercel.json`); проекты друг друга не проксируют, поэтому каждый хост получает ровно одну CSP своего проекта (A-02). Site-проект задаёт для своих путей CSP, `Referrer-Policy: strict-origin-when-cross-origin` (для `/join/(.*)` — `no-referrer`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`. Базовые директивы те же, что у приложения после 01-1 (`object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`, без Google Fonts), `connect-src 'self'` (статистика лендинга — через `/api/stats` того же хоста, §4.1), плюс `script-src 'self' 'sha256-…'` для **всех** inline-скриптов (theme-init из 05-3, `/join/*`, `beforeSend`-редакция); хеши считает `seoGuard` и пишет в `vercel.json` при сборке, проверка «закоммиченное = посчитанное». CSP приложения после 04-2b живёт в `apps/app/hosting.base.json` (туда же 05-3 кладёт хеш theme-init).

### 4. Маршрутизация доменов (D26)

#### 4.1 Кто что отдаёт

Порядок Vercel внутри проекта (C1-19, C3-11; проверено по `@vercel/routing-utils@6.6.0`, `getTransformedRoutes`: `cleanUrls`/`trailingSlash` → `redirects` → `headers` → `{ handle: 'filesystem' }` → `rewrites`; в документации vercel.json — «`redirects` are always processed before `rewrites`» и «precedence is given to the filesystem prior to rewrites being applied»): **redirect срабатывает раньше файла**, файл — раньше rewrite. Поэтому `source` redirect'а не должен матчить файл сборки (тест генератора §2.9).

| Хост | Проект | Что отдаёт |
|---|---|---|
| `app.chipin.one` (prod), `app-dev.chipin.one` (dev), `*.vercel.app` (preview app) | app | файлы `dist` (оболочка, ассеты, `sw.js`, `manifest.webmanifest`, `.well-known/assetlinks.json`), SPA-rewrites из манифеста → `/app.html` (04-5a → `/index.html`), `/api/:path*` → backend (`api.chipin.one` / `api-dev.chipin.one`), `X-Robots-Tag: noindex, nofollow` |
| `chipin.one` (prod), `site-dev.chipin.one` и `dev.chipin.one` (dev), `*.vercel.app` (preview site) | site; `chipin.one` и `dev.chipin.one` — с cutover, до него они у app-проекта (§4.5) | статика Astro, redirect'ы §4.2, kill-switch `/sw.js`, `.well-known/assetlinks.json`, `/api/stats` → `api.chipin.one/stats` (dev — `api-dev.chipin.one`) для статистики лендинга с headers `Cache-Control: private, no-store` и `X-Vercel-Enable-Rewrite-Caching: 0`, как у `/api/(.*)` app-проекта (без CDN-кэша, как сейчас), `404.astro` на неизвестный путь |

- Внешних rewrite'ов между проектами нет: app-проект не знает хост сайта, сайт ссылается на приложение только абсолютными URL с `PUBLIC_APP_ORIGIN` (§4.4), приложение на сайт — через `getSiteOrigin()` (§2.1). Catch-all D20 и кэш внешнего rewrite (A-34) не нужны.
- `/api` на хосте приложения — same-origin proxy, как сейчас. Refresh-cookie backend — `__Host-` с `Path=/` (`Cookies.kt`), поэтому она host-only по построению: выставленная в ответе `app.chipin.one/api/…`, она живёт только на `app.chipin.one`, и ни один ответ сайта её не ставит. У пользователей, входивших на `chipin.one` до cutover, в браузере остаётся прежняя host-only cookie `chipin.one` (до 30 дней); rewrite сайта `/api/stats` передаёт её backend'у вместе с запросом. Это безопасно: `/api/stats` — публичный endpoint и cookie не читает, а отрезать заголовок `Cookie` на rewrite нейтральная схема `hosting.base.json` не умеет. Проверка (критерий 7): `Set-Cookie` ответов входа и refresh на `app.chipin.one/api/…` с префиксом `__Host-` и без `Domain=`; ни один ответ хостов сайта не содержит `Set-Cookie`.
- Cookies и `localStorage` не переезжают: у `app.chipin.one` свой origin. Каждый пользователь один раз входит заново; черновики и сохранённые тема и язык со старого origin не переносятся (тема и язык приходят из профиля после входа, `useSyncUserSettings`). Данные на `chipin.one` (IndexedDB, `localStorage`) остаются в браузере и никем не читаются.
- Outbox спеки 03 хранится в IndexedDB своего origin. Поэтому cutover выполняется до включения записи офлайн в prod (флаг 03-17): иначе операции, не отправленные с `chipin.one` к моменту переключения, на `app.chipin.one` не попадут.

#### 4.2 Redirect'ы старых URL (site-проект; query string Vercel сохраняет)

Действуют на хостах сайта: `chipin.one` → `appOrigin` = `https://app.chipin.one`; `dev.chipin.one` и `site-dev.chipin.one` → `https://app-dev.chipin.one` (§1.5a). Генерируются в `apps/site/legacy-redirects.generated.json` (§2.9).

| Старый URL на `chipin.one` | Новый URL | Источник |
|---|---|---|
| `/group/join/:token` | `/join/group/:token` (лендинг сайта) | фиксированное, **до** правила `/group/*` |
| `/friends/join/:token` | `/join/friend/:token` (лендинг сайта) | фиксированное, до `/friends` |
| `/dashboard`, `/dashboard/:path*` | `<appOrigin>/dashboard`, `<appOrigin>/dashboard/:path*` | manifest |
| `/solo…`, `/group/:path*`, `/friends…`, `/activity…`, `/settings…` | `<appOrigin>` + тот же путь | manifest |
| `/oauth/callback` | `<appOrigin>/oauth/callback` (с `?code&returnTo`) | manifest; держать бессрочно |
| `/not-found` | без redirect: `404.astro` со статусом 404 (redirect на `/404` дал бы soft 404 с 200, C3-23) | — |
| `/sitemap.xml` | `/sitemap-index.xml` | фиксированное |
| `/index.html`, `/app.html` | `/` | фиксированное (A-33: индексированные варианты нынешних html-entry) |
| `/manifest.webmanifest`, иконки старого манифеста (`/pwa-*.png` и др.) | без redirect: 404 (старые установки не поддерживаются, D26) | — |
| `/`, `/privacy`, `/terms`, `/ru/…`, `/es/…`, `/pt-br/…`, `/pt-pt/…` | **без изменений** (200 с сайта) | — |

Статус — `legacyRedirectStatus`: `302` до 04-5a, `301` с 04-5a (`"statusCode"` в Vercel; 301 вместо 308: все исходные запросы — GET-навигации, а 301 лучше понимают старые краулеры). 302 на окно отката нужен, потому что браузер кэширует 301 бессрочно: после отката (§4.5) `chipin.one` снова отдаёт прежние страницы, и браузер должен следовать текущим правилам app-проекта, а не кэшированным redirect'ам сайта. Цикла при этом нет ни в одном направлении: compat-redirect'ы app-проекта ведут на хост приложения, а не обратно на `/group/join/<t>` старого хоста. Открытые до cutover вкладки, которые догружают старые `/assets/*` с `chipin.one`, получают 404 чанка; после reload страницы они попадают на redirect из этой таблицы (C3-22).

Compat-redirect'ы app-проекта (§1.5a; с 04-2g до 04-5a) действуют только на `chipin.one`/`dev.chipin.one`, пока эти хосты у app-проекта (до cutover и после отката): `/join/group/:token` → `<хост приложения>/group/join/:token`, `/join/friend/:token` → `<хост приложения>/friends/join/:token` (`chipin.one` → `https://app.chipin.one`, `dev.chipin.one` → `https://app-dev.chipin.one`), 302. Они делают рабочими новые invite-ссылки до cutover и после отката и сразу ведут новых участников на хост приложения, чтобы те не входили и не заводили локальные данные на старом origin.

#### 4.3 Индексация

- App-проект: header `X-Robots-Tag: noindex, nofollow` на `/(.*)` для хостов `app.chipin.one`, `app-dev.chipin.one` и `*.vercel.app` (§2.9). Хост приложения не попадает ни в sitemap, ни в canonical.
- `robots.txt` сайта: `Disallow: /api/`, `Disallow: /join/`; старые `Disallow` на `/dashboard` и т. п. убираются, потому что там теперь redirect.
- Dev-хосты сайта (`site-dev.chipin.one`, `dev.chipin.one`) и preview сайта получают `X-Robots-Tag: noindex, nofollow` по хосту (`apps/site/hosting.base.json`), `chipin.one` — нет. Прокси нет, поэтому условие по хосту однозначно (A-33 снят D26; дубль-хоста `site.chipin.one` нет).
- Проверка в критериях: на prod `curl -I https://app.chipin.one/dashboard` показывает `X-Robots-Tag`, `https://chipin.one/ru/` — `200` без noindex.

#### 4.4 OAuth

- `redirect_to` в коде не меняется: `<origin>/oauth/callback?returnTo=<путь>` (`src/helpers/url.ts:28-44`); на хосте приложения origin = `https://app.chipin.one` (dev — `https://app-dev.chipin.one`). `returnTo` — путь приложения, как сейчас; `resolveOAuthReturnTo` (`src/helpers/url.ts:7-26`) не меняется.
- Backend: allowlist проверяет только origin (`OAuthRedirectValidator.kt:21-27`). Новый origin нужно добавить (BE-04-2): `OAUTH_ALLOWED_REDIRECT_ORIGINS` на prod содержит `https://app.chipin.one`, на dev — `https://app-dev.chipin.one`; `https://chipin.one` и `https://dev.chipin.one` остаются до 04-5a (цель отката). То же для CORS: `CORS_ALLOWED_ORIGINS` на prod получает `https://app.chipin.one`, на dev — `https://app-dev.chipin.one`; старые origin тоже остаются до 04-5a. `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` и `CORS_ALLOWED_VERCEL_PREVIEW_PROJECTS` привязаны к имени Vercel-проекта, поэтому app-проект **не переименовывать**; site-проект OAuth не инициирует. Google Console не затрагивается: в Google зарегистрирован callback backend'а, а не фронта (`OAuthPlugin.kt:28-36`). Пример в OpenAPI (`OAuthOpenApi.kt:30`) уже `https://app.chipin.one/oauth/callback` и совпадает с целевым URL (BE-04-1 снят).
- Логины в момент переключения: backend вернёт пользователя на `https://chipin.one/oauth/callback?code=…`, redirect сайта (§4.2) отправит его на `https://app.chipin.one/oauth/callback?code=…`, `code` и `returnTo` сохранятся. Если после BE-01-1 одноразовый код привязан к браузеру через cookie старого origin, обмен на новом origin не пройдёт, и пользователь просто входит ещё раз.
- С сайта кнопки «Войти/Начать» и «Открыть ChipIn» — ссылки `${PUBLIC_APP_ORIGIN}/login?locale=<locale>` и `${PUBLIC_APP_ORIGIN}/login` (A-42; с 04-5a вторая — `${PUBLIC_APP_ORIGIN}/`, §3.6). `PUBLIC_APP_ORIGIN` — env site-проекта: prod `https://app.chipin.one`, dev и preview `https://app-dev.chipin.one`. Тот же origin использует кнопка `/join/*`. Приложение вызывает `getSocialAuthUrl` с `locale` для регистрации (`url.ts:39-41`, `resolveRegistrationLocale` читает `?locale` вместо публичного пути).

#### 4.5 Cutover: перенос доменов и откат

Cutover — не PR с переключателем, а действия владельца в Vercel по runbook'у в `DEPLOYMENT.md` (раздел «Domains and rollback», PR 04-4). Код к этому моменту уже работает на обоих хостах.

Предусловия:
1. BE-04-2 выполнен на prod и dev: новые origin в `OAUTH_ALLOWED_REDIRECT_ORIGINS` и `CORS_ALLOWED_ORIGINS`.
2. 04-2g в prod; домены `app.chipin.one` (Production) и `app-dev.chipin.one` (`master`) добавлены в app-проект. Smoke на `app.chipin.one`: вход Google, `/api`, deep link `/group/<uuid>`, офлайн-reload `/dashboard` из precache, `Set-Cookie` refresh — `__Host-`, без `Domain` (§4.1). С этого момента приложение работает на обоих хостах параллельно.
3. Site-проект в prod (Promote) с 04-3b1, 04-3b2, 04-3c и 04-3d; dev-проверка на `site-dev.chipin.one`.
4. Запись офлайн (флаг 03-17) в prod ещё не включена (§4.1).

Шаги:
1. Репетиция на dev: убрать `dev.chipin.one` из app-проекта и добавить в site-проект на ветку `master`. Проверить на `dev.chipin.one` критерий 7 в dev-варианте (redirect'ы на `app-dev.chipin.one`, kill-switch, одна CSP).
2. Prod: убрать `chipin.one` из app-проекта и добавить в site-проект как Production-домен. DNS-записи не меняются (зона на Vercel, оба проекта в одном team). Сразу после — критерий 7 на prod.
3. 48 ч мониторинга по критерию отката; 04-5a/b — не раньше чем через 7 дней без отката.

Окна заморозки merge и запрета Promote нет (C1-07 и A-03 сняты D26): откат не зависит от того, какой деплой app-проекта сейчас в Production. До 04-5a любая prod-сборка app-проекта умеет отдавать публичные страницы на `chipin.one` (переходные маршруты §2.2, compat-redirect'ы §4.2).

Откат (минуты):
- Вернуть домен: убрать `chipin.one` (или `dev.chipin.one`) из site-проекта и снова добавить в app-проект (Production или `master`). `chipin.one` снова отдаёт прежний лендинг, prerender и приложение; app-проект регистрирует свой `/sw.js` заново, потому что kill-switch на `chipin.one` больше не отдаётся. `app.chipin.one` продолжает работать.
- Кэшированных 301 нет: redirect'ы сайта до 04-5a идут с 302 (§4.2). Новые invite-ссылки `chipin.one/join/group|friend/<t>` после отката обрабатывает compat-redirect app-проекта.
- Критерий отката: рост 404 или 5xx на `chipin.one` или `app.chipin.one` > 1 % за час, ошибка OAuth-логина, сайт недоступен.
- После 04-5a откат переносом домена невозможен: 04-5a удаляет публичные страницы из app-проекта, поэтому он идёт только после 7 дней без отката.

#### 4.6 Ссылки, которые живут вне приложения

- Backend URL фронта не генерирует. grep по `chipin-backend/src/main` нашёл: писем, push и Telegram нет, invite-ответы содержат только токен. Единственное упоминание — пример в OpenAPI `OAuthOpenApi.kt:30` (`https://app.chipin.one/oauth/callback`); он уже совпадает с новым хостом.
- Ссылки-приглашения, которые уже разосланы (`chipin.one/group/join/<t>`, `chipin.one/friends/join/<t>`), покрывают redirect'ы §4.2. Держать бессрочно.
- Закладки на `chipin.one/<путь приложения>` ведут redirect'ом на `app.chipin.one`; PWA, установленные до переезда (`start_url: '/'` на `chipin.one`), онлайн открывают сайт, офлайн не гарантируются (D26, §2.11).
- `assetlinks.json` (namespace `web`): `chipin.one`, `dev.chipin.one`, `app.chipin.one`, `app-dev.chipin.one`; одна и та же копия у app- и site-проекта (§2.1).

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

- **Kill-switch на `chipin.one` обязателен (D26).** Без него старый SW со scope `/` продолжит отдавать из precache старый `index.html` на `/` и старые prerender-страницы, и пользователь не увидит сайт до обновления SW. Kill-switch должен быть в prod-деплое сайта **до** переноса домена (04-3d, предусловие 3 §4.5); хранить не меньше 6 месяцев.
- **Установленные PWA.** Старые установки на `chipin.one` не поддерживаются (D26): онлайн они открывают сайт, офлайн-запуск не гарантируется, баннера нет. Новые установки — с `app.chipin.one` (`start_url`, `scope`, `id` = `/`).
- **Один повторный вход.** Refresh-cookie host-only для `app.chipin.one`, `localStorage` не переезжает (§4.1). Сообщение пользователям — на усмотрение владельца, код ничего специально не показывает.
- **`getEnv()` и новые хосты.** Без правки `ENV_URLS` (04-2g) `app-dev.chipin.one` без `VITE_CHIPIN_ENV` падает на старте (§2.1).
- **Порядок redirect'ов**: `/group/join/:token` должен стоять раньше `/group/:path*`. Тест генератора проверяет порядок.
- **Preview-деплой app** ссылается на сайт `site-dev.chipin.one`, preview сайта — на `app-dev.chipin.one`. Для PR, которые меняют оба приложения, каждый проект проверяется на собственном preview-URL.
- **Telemetry/Sentry**: пути приложения не меняются, поэтому шаблоны маскировки токенов в `src/constants/telemetry.ts` остаются как есть (`/group/join/:inviteToken`, `/friends/join/:inviteToken`); токен `/join/*` редактируется в аналитике сайта (§3.6). Переход с лендинга в приложение идёт с `Referrer-Policy: no-referrer`, поэтому токен не попадает в Referer приложения.
- **`vi.mock('…')` по строковым путям** при переносе в `src/app/router` ломаются. Переносить вместе с тестами в одном PR.
- **Хотфикс D1** (стоп-спиннер `PublicLocaleRoute`, PR 01-3) делается на текущем коде **до** этой спеки. Его тест удаляется вместе с `PublicLocaleRoute` в 04-5a.

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
- Не проксируем один проект через другой и не ставим cookies на `.chipin.one`: общей сессии сайта и приложения нет (D26).
- Не поддерживаем PWA, установленные на `chipin.one` до переезда: нет баннера переустановки и офлайн-гарантии (D26).
- Не трогаем `ModalRouter`.

## Фазы / PR

Зависимости: 04-0a после merge FE#497 (оба меняют `.github/workflows`) и после хотфикса D1. PR ≤ ~400 строк diff'а, rename и сгенерированные файлы (`vercel.json`, `routing.generated.ts`) считаются как 0. Группа `04-2a1–a4` в других спеках упоминается как «04-2a» (завершение группы = 04-2a4); «04-0» = 04-0a.

| PR | Содержание | Зависит | Параллельно с |
|---|---|---|---|
| 04-0a | Механический перенос в `apps/app` + корневой workspace (§1.6 п. 1–5, 7) скриптом `scripts/move-to-workspace.sh`; version-скрипты считают корень от `import.meta.dirname`, prod-версия = чистая `x.y.z` (§1.2). Владелец в момент merge ставит Root Directory = `apps/app` | FE#497 (cutover на master выполнен, `e6d2f2e`), 01-1…01-3; рекомендуемо 02-C2c и 02-C5 | — (замораживает пути на час: открытые PR rebase'ятся, git сам распознаёт rename) |
| 04-0b | Замена путей `src/` → `apps/app/src/` в `AGENTS.md`, `CLAUDE.md`, `docs/**`, `DEPLOYMENT.md` (§1.6 п. 6) | 04-0a | 04-1a, 04-1b |
| 04-1a | `packages/i18n-content` (locales + common + `loadCommon`, §2.10) + `tsconfig.json` пакета. `packages/tokens` здесь **не** создаётся — его целиком делает 05-2 | 04-0a | 02, 03, 05-2 |
| 04-1b | CI: режимы `docs-only\|app\|site\|full` в `ci-gate-policy.mjs` + тесты, условные шаги в job `frontend-ci`, пути артефактов release-QA (§1.4) | 04-0a | 04-1a |
| 04-2a1 | Манифест `routeManifest.ts` (включая переходные id §2.2) + `routeModules.ts` + `route.ts` по страницам (named `Component`); роутер ещё старый, `route.ts` пока никем не импортируется, кроме теста «каждый id имеет модуль» | 04-0a (i18n-content не нужен, C2-14) | спека 03, 04-1a |
| 04-2a2 | `createAppRouter(queryClient)` + `RootLayout`/`InternalLayout`, `hydrateFallbackElement`, `main.tsx` на `RouterProvider` без `BrowserRouter`; маршруты 1:1 с нынешними, guard'ы пока — нынешние `ProtectedRoute`/`SoloRouteGuard` как element. **Без** `basename` (`ROUTER_BASENAME = '/'`); переходные публичные id (§2.2) через `PublicLocaleRoute`. Если 03-7a ещё не влит — заглушка `src/shared/offline/restore.ts`: `export const restoreReady: Promise<void> = Promise.resolve();` (03-7a меняет реализацию, не путь и не имя; C1-08, C2-09) | 04-2a1, **03-5** (`queryClient`, `onlineManager`, `isNetworkUsable`) | спека 03 (loaders пока без prefetch) |
| 04-2a2b | `AuthLayout` (`requireSession` по таблице §2.3, `errorElement`, скрытие страницы под `AuthModal`) + `SoloGuardLayout` (до 03-9 — `users-store`, §2.3), `session.ts` из `useCheckSignIn` (`authReady` с таймаутом 5 с); неавторизованный — как сейчас (на `/login` переключает 04-2f); перенос тестов guard'ов | 04-2a2 | 04-2c, 04-2d |
| 04-2a3 | `RouteErrorView` + `errorElement` на корне, `AuthLayout` и `InternalLayout`, `ScrollRestoration`, `handle.meta` + `useDocumentTitle` вместо `useRoutesMeta` для маршрутов приложения | 04-2a2b | 04-2c |
| 04-2a4 | Удаление старого роутера: `AppRouter`, `ProtectedRoute`, `HomeRouteGuard`, `SoloRouteGuard`, `internal/useConnect.ts` и их тесты (`PublicLocaleRoute` живёт до 04-5a) | 04-2a3 | 04-2b |
| 04-2b | Генератор артефактов + тест синхронизации; `vercel.json` и allowlist становятся сгенерированными из `hosting.base.json` (схема §1.5a; содержимое семантически то же, что сейчас) | 04-2a1 | 04-3a |
| 04-2c | Lazy i18n (`loadCommon`) + `setAppLanguage` + паритет ключей (единственный владелец lazy-load локалей) | 04-1a | 04-2b, 04-3a |
| 04-2d | `pwa.config.ts` (`buildPwaOptions`, `APP_SHELL`, таблица §2.11) + `pwa.config.test.ts`, `vite.config.test.ts` (`base === '/'`); единая регистрация `/sw.js` со scope `/` (как сейчас) + политика обновления (п. 1–3; экран п. 4 за флагом до BE-03-5); удаление `serviceWorkerRecovery.ts`, `swUpdates.tsx`, `PWABadge.tsx` | 04-2a2 | 04-2c |
| 04-2h | Playwright: `@playwright/test` в devDependencies `apps/app`, `apps/app/e2e/sw.spec.ts` (сценарии критерия 5), workflow `e2e-sw.yml` (`workflow_dispatch` + PR, меняющие `apps/app/src/app/pwa/**`, `pwa.config.ts`, `apps/site/public/sw.js`; не обязательный check, `BASE_URL` = preview-деплой PR) (C1-25, C2-19) | 04-2d; сценарий kill-switch — после 04-3d | 04-2e, 04-2f |
| 04-2e | Loaders с prefetch по фабрикам спеки 03 | 04-2a4, 03-5 и PR миграции соответствующих сторов (03-8…03-12) | — |
| 04-2f | Подготовка cutover, часть 1 (путь-агностично): экран `login` на `/login` (`?returnTo`, `?locale`), `requireSession` → `/login`; `SITE_PATHS` вместо `ROUTES.HOME/PRIVACY/TERMS` + lint (§2.1) | 04-2a4 | 04-2g |
| 04-2g | Хост приложения (D26): `ENV_URLS` (`appHostnames`, `siteOrigin`) + `getSiteOrigin()` + `env.test.ts` (§2.1); `SITE_PATHS` абсолютные; invite-ссылки `${getSiteOrigin()}/join/group\|friend/<t>` (§3.5); `apps/app/hosting.base.json`: хосты `app.chipin.one`/`app-dev.chipin.one` + `legacyProd`/`legacyDev`, `X-Robots-Tag` по хосту, compat-redirect'ы `/join/*` (302) с прежних хостов на хост приложения (§1.5a, §4.2); `assetlinks.json` + app-хосты. После merge и Promote владелец добавляет домены `app.chipin.one`/`app-dev.chipin.one` в app-проект (предусловие 2 §4.5) | 04-2a4, 04-2d, 04-2f, 04-3c, BE-04-2 | 04-3b1, 04-3b2 |
| 04-3a | `apps/site`: каркас Astro (`astro@^7.4`, `content.config.ts`), i18n + тест паритета, BaseLayout, 404, robots, sitemap, seoGuard, `astro check`, `noindex` dev-хостов; создание `chipin-site` с релизной моделью §1.5 (владелец); деплой на `site-dev.chipin.one` | 04-1a, 04-1b, 05-2a | 04-2* |
| 04-3b1 | Сайт: главная (5 локалей) — паритет `<title>`/description и текстов `landing.json`; theme-init из 05-3; кнопки «Войти»/«Открыть ChipIn» на `PUBLIC_APP_ORIGIN` (§4.4); rewrite `/api/stats` для статистики лендинга с `no-store`-headers (§4.1) | 04-3a, 05-3 | 04-2*, 04-3b2 |
| 04-3b2 | Сайт: legal-коллекция privacy/terms × 5 локалей + тест паритета текста: нормализованный текст старых `PRIVACY_SECTIONS`/i18n против текста собранного HTML по каждой локали (C2-35) | 04-3a | 04-2*, 04-3b1 |
| 04-3c | Сайт: `/join/group`, `/join/friend` (без аналитики + `beforeSend`-редакция в `BaseLayout`, кнопка на `PUBLIC_APP_ORIGIN`) + тест равенства regex токена | 04-3a, 01-2 | 04-3b1, 04-3b2 |
| 04-3d | Сайт, слой совместимости для `chipin.one`: kill-switch `apps/site/public/sw.js` + `swKillSwitch.test.ts` + `Cache-Control: no-cache` (§3.6); redirect'ы старых URL §4.2 из `legacy-redirects.generated.json` (генератор §2.9, `legacyRedirectStatus: 302`); `.well-known/assetlinks.json`. Promote сайта в prod до 04-4 | 04-2b, 04-3a | 04-3b1, 04-3b2, 04-3c |
| 04-4 | **Cutover — перенос доменов** (§4.5): PR с runbook'ом в `DEPLOYMENT.md` (раздел «Domains and rollback»: предусловия, шаги, критерий и шаги отката); после merge владелец переносит `dev.chipin.one`, затем `chipin.one` на site-проект и проверяет критерии 7 и 9 | 04-2g (в prod, домены app добавлены), 04-2h, 04-3b1, 04-3b2, 04-3c, 04-3d (в prod), BE-04-2; до 03-17 в prod | — |
| 04-5a/b | Удаление (§5) — двумя PR: (a) public-routes + prerender + scripts, переходные id манифеста и `home` index (§2.2), `APP_SHELL = 'index.html'` (переименование `app.html`), хосты `legacyProd`/`legacyDev` и compat-redirect'ы из `apps/app/hosting.base.json`, `chipin.one`/`dev.chipin.one` из `ENV_URLS`, `legacyRedirectStatus: 301` в `apps/site/hosting.base.json`; (b) landing/legal страницы, store, дубли | 04-4 + 7 дней без отката | спеки 02, 05 |

Откат cutover — перенос домена обратно на app-проект (§4.5). Цели отката в виде отдельного деплоя, Instant Rollback, окна заморозки merge и правила «нет Promote 48 ч» нет (A-03, C1-07 сняты D26).

## Тесты / критерии приёмки

1. 04-0a: всё из §1.6 (тесты 1230/1230, тот же состав `dist`, одна `APP_VERSION` из корня и из `apps/app`, smoke на preview). Тест резолвера: prod-сборка из `master` (`VERCEL_ENV=production`) даёт `x.y.z` без суффикса.
2. `generate-routing-artifacts.test.ts` зелёный. Ручное изменение `vercel.json` без генератора валит CI.
3. Unit (RTL с `createMemoryRouter` поверх манифеста):
   - неавторизованный на `/dashboard` → `/login?returnTo=%2Fdashboard`;
   - истёкшая сессия на `/group/:id` показывает `AuthModal`, страница остаётся смонтированной;
   - `/solo` без доступа → `/dashboard`;
   - невалидный `groupId` → NotFound внутри `InternalLayout`, навигация видна;
   - ошибка рендера страницы не скрывает шапку;
   - ошибка загрузки чанка → экран обновления, авто-reload не больше одного раза;
   - открытая глобальная модалка закрывается при смене маршрута (как сейчас);
4. i18n: в entry-чанке нет JSON локалей (проверка размера: entry ≤ текущего минус 200 KB raw). `changeLanguage` вне `setAppLanguage` валит lint. Тест паритета ключей зелёный.
5. SW. `pwa.config.test.ts` — таблица §2.11; `vite.config.test.ts` — `base === '/'`. 04-2d (C2-01): собранный `dist/sw.js` — регистрация `/sw.js` со scope `/`, allowlist = нынешний, `navigateFallback` = `app.html`, офлайн-reload `/dashboard` отдаёт оболочку из precache. Kill-switch — `swKillSwitch.test.ts` (§3.6). E2E (Playwright, 04-2h): (a) на preview app офлайн-reload `/dashboard` отдаёт оболочку из precache, `navigator.serviceWorker.getRegistrations()` — одна регистрация со scope `/`; (b) на preview сайта (после 04-3d): создать cache с произвольным именем и зарегистрировать `/sw.js` → после активации `getRegistrations()` пуст, `caches.keys()` пуст, окно перезагружено; (c) онлайн `/` сайта — HTML сайта, регистраций SW после загрузки нет.
6. Сайт: `astro build` с `seoGuard` зелёный. 15 публичных URL отдают 200 с тем же `<title>` и description, что сейчас (снапшот до/после). hreflang на каждой странице указывает на все существующие переводы этой страницы (сейчас 5) и `x-default`. В sitemap 15 URL. JS на странице ≤ 30 KB gz.
7. После переноса домена (§4.5; сначала `dev.chipin.one`, затем `chipin.one`): каждая строка §4.2 проверена `curl -sI` (статус `302`, `Location` на `<appOrigin>` + тот же путь или на `/join/…`; `/not-found` → `404`); `/sw.js` — `200`, `Cache-Control: no-cache`, тело — kill-switch; `https://app.chipin.one/dashboard` — `X-Robots-Tag: noindex, nofollow`, `https://chipin.one/ru/` — `200` без него. Логин Google проходит с сайта (`/login?locale=`) и со старого `chipin.one/oauth/callback`; `Set-Cookie` ответов входа и refresh на `app.chipin.one/api/…` — `__Host-`, без `Domain=`; ответы `chipin.one` (страницы, redirect'ы, `/api/stats`) без `Set-Cookie` (§4.1). Старая invite-ссылка `chipin.one/group/join/<t>` → лендинг → кнопка → экран подтверждения на `app.chipin.one` → вступление.
8. QA владельца, не gate PR (C2-34): Lighthouse SEO и производительность главной не хуже базовой линии; базовая линия записывается в FE#498 до 04-3b1 (числа прикладываются в FE#496).
9. Одна CSP на хост (A-02): `curl -sI https://site-dev.chipin.one/join/group/x` показывает ровно один заголовок `Content-Security-Policy` с хешами сайта, `https://app-dev.chipin.one/dashboard` — ровно один, CSP приложения; inline-скрипты theme-init, `beforeSend`-редакции и `/join/*` выполняются (нет CSP-ошибок в консоли). На prod — то же после переноса `chipin.one`.
10. 04-2g в prod (до 04-4, это и проверка цели отката): `curl -sI https://chipin.one/join/group/x` → `302` `Location: https://app.chipin.one/group/join/x`; `https://chipin.one/` — `200` без `X-Robots-Tag`; `https://app.chipin.one/` и `/dashboard` — `200` с `X-Robots-Tag: noindex, nofollow`; вход Google на `app.chipin.one` проходит.
11. Сайт: `seoGuard` валит сборку, если HTML под `join/` содержит `_vercel/insights` или `_vercel/speed-insights` (A-15); фикстура с невалидным frontmatter валит `astro build` (A-14); `/join/*` выбирает локаль по `navigator.languages` и передаёт `?locale` (C3-25); на главной нет редиректа по `localStorage` (C3-18 снят D26, §3.6).
12. Deep links (C1-01): на preview 04-2g и на `app.chipin.one` reload `/group/<uuid>` и `/activity/<uuid>` даёт `200`, все JS/CSS-ассеты страницы — `200` с `text/javascript`/`text/css`, приложение отрисовано.
13. ~~04-4 (C1-07): один коммит между 04-3d и 04-4, окно заморозки~~ — снят D26: окна заморозки нет (§4.5).

## Требования к backend

~~**BE-04-1**~~ — снят (D26): пример `OAuthOpenApi.kt:30` уже `https://app.chipin.one/oauth/callback` и совпадает с целевым URL, правок нет. Issue chipin-backend#206 закрыть как not planned (действие координатора).
**BE-04-2 (P1, до 04-2g в prod).** На prod добавить в `OAUTH_ALLOWED_REDIRECT_ORIGINS` и `CORS_ALLOWED_ORIGINS` `https://app.chipin.one`, на dev — `https://app-dev.chipin.one`; `https://chipin.one` и `https://dev.chipin.one` оставить в обоих списках до 04-5a (цель отката, §4.5). `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` и `CORS_ALLOWED_VERCEL_PREVIEW_PROJECTS` — имя текущего app-проекта, без изменений (проект не переименовывается); site-проект туда не добавляется, он OAuth не инициирует. Подтвердить, что refresh-cookie остаётся `__Host-` с `Path=/` (host-only, §4.1).
Минимальная версия клиента — не отдельный issue: контракт нового заголовка `X-Client-Version` / ответного `X-Min-Client-Version` / 426 `CLIENT.OUTDATED` задаёт BE-03-5 (спека 03 §7; проверено: версионирования API в backend нет, FE версию сейчас не шлёт). BE-03-5 включает `X-Min-Client-Version` в `Access-Control-Expose-Headers`. Обязателен до включения outbox (03-17).
~~**BE-04-3**~~ — снят (C3-24): app-header `/api/(.*)` и header `/api/stats` в `apps/site/hosting.base.json` ставят `Cache-Control: private, no-store` и `X-Vercel-Enable-Rewrite-Caching: 0`, поэтому `public, max-age=300` backend'а не действует; статистика лендинга остаётся без CDN-кэша, как сейчас (§4.1). Issue chipin-backend#208 закрыть как not planned (действие координатора).

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
| PWA/offline | работает, но SW делит scope с публичными страницами | App Router и SW-offline для приватного приложения конфликтуют (RSC, серверные запросы); `next-pwa` не поддерживается | SPA-режим возможен, но prerender и SW снова в одном билде | не затронуты: SW приложения `/sw.js` со scope `/` на своём хосте `app.chipin.one`, сайт без SW (D26) |
| Стоимость миграции | 0 | высокая: переписать роутинг, data-слой, auth (in-memory токен + Web Locks), стили (styled-components SSR), все тесты | средняя: перенос на `routes.ts` и route modules, тот же клубок prerender+SW | средняя: только 3 страницы × 5 локалей и раздел; приложение меняется в роутере (D6 нужен в любом варианте) |
| Риск | растёт с каждой SEO-страницей | высокий, big-bang, конфликт с D2/D3 | средний | низкий: сайт выкатывается рядом, cutover и откат — перенос домена за минуты |
| CI/деплой | как сейчас | один проект, но серверный runtime и функции | один проект | два Vercel-проекта, path filters, два хоста без rewrite между ними |
| Поддержка | высокая (кастомный пайплайн, который знает один человек) | средняя, частые мажорные изменения | средняя | низкая: два стандартных инструмента с документацией |
| Предсказуемость для агентов | низкая (два дерева) | средняя | средняя | высокая: «маркетинг = `apps/site`, продукт = `apps/app`» |

**Решение.** Вариант (d): публичный и SEO-сайт на Astro (`apps/site`, статический), приложение остаётся SPA на Vite и RR7 data router (`apps/app`) на поддомене `app.chipin.one` (D26). Монорепо на npm workspaces с общими `packages/tokens` и `packages/i18n-content`.

**Почему отклонены остальные.**
- (a): стоимость каждой SEO-страницы и источник багов (дубли деревьев, i18n, precache) только растут. FE#499 прямо запрещает параллельные системы маршрутов, а (a) уже такую содержит.
- (b): серверный рендер не даёт выигрыша приватному noindex-приложению, но ломает offline-first модель (D2, D3), требует переписать auth и стили и не может выкатываться постепенно (режим DECISIONS: без feature freeze).
- (c): лучше (a) по роутингу, но оставляет публичные страницы и PWA в одном билде и одном scope SW, а контентной системы не даёт. D6 берёт из RR7 только data router — это то, что нужно приложению.

**Последствия.**
- Плюсы: удаляются `PublicApp`, prerender и проверка precache (§5); SEO-страница добавляется markdown-файлом; у приложения один источник маршрутов с тестом; JS на публичных страницах сводится к inline-скриптам.
- Минусы: два стека UI (Astro-компоненты и React). Общие только tokens и `common` i18n, так что шапку и футер придётся держать в двух видах. Два origin: каждый пользователь один раз входит заново, PWA, установленные до переезда, не поддерживаются. Два Vercel-проекта и matrix-деплой.
- Обязательства: kill-switch `/sw.js` на `chipin.one` минимум 6 месяцев после cutover (D26); redirect'ы старых URL бессрочно; app-проект не переименовывать (OAuth preview allowlist).
- Пересмотр: если сайту понадобятся персонализированные или серверные страницы (например, превью приглашения с именем группы), рассмотреть Astro `output: 'server'` для отдельных маршрутов на Vercel, не меняя приложение.

## Открытые вопросы

1. ASSUMPTION: backend не отправляет пользователям URL фронта (писем, push и Telegram нет; grep `chipin-backend/src/main` 2026-10-28). Если есть внешний канал (KB, бот, шаблоны в Slack), его ссылки нужно добавить в §4.2.
2. ASSUMPTION: refresh-cookie backend остаётся `__Host-` с `Path=/` (host-only), а prod- и dev-значения `OAUTH_ALLOWED_REDIRECT_ORIGINS`, `CORS_ALLOWED_ORIGINS`, `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` и `CORS_ALLOWED_VERCEL_PREVIEW_PROJECTS` в окружении backend совпадают с тем, что ожидает §4.4 (в репо только дефолт `http://localhost:3000`). Проверяется в BE-04-2 и smoke предусловия 2 §4.5.
3. Решено (D26, владелец 2026-10-29): приложение на `app.chipin.one` (dev `app-dev.chipin.one`), сайт на `chipin.one` (dev `site-dev.chipin.one`); PWA, установленные до переезда, не поддерживаются; kill-switch `/sw.js` на `chipin.one` не меньше 6 месяцев. D25 (SW `/app/`, kill-switch того же origin, баннер переустановки) упрощён D26 и не применяется.
4. Решено (D19, вариант A, подтверждено владельцем 2026-10-28): сейчас — только принудительное обновление SW через 24 ч; до включения outbox — BE-03-5 (`X-Client-Version` + `MIN_CLIENT_VERSION` → 426) и 03-20, правило 72 ч.
5. Решено (D18, подтверждено владельцем 2026-10-28): Vercel Analytics и Speed Insights остаются; изолированы по §1.5a; уход с Vercel — отдельное исследование.
6. Решено (D22, D26): поддомены `app`, `app-dev`, `site-dev`; тариф владельца не Hobby (org-проект), custom-домены бесплатны и без лимита, DNS на Vercel. `site.chipin.one` не нужен.
