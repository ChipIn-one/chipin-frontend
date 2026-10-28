# Спека 04: монорепо, роутинг приложения и публичный сайт (D6, D7, D8; ADR для FE#498)

Статус: черновик для владельца, 2026-10-28. Репо: `ChipIn-one/chipin-frontend`. Проверено read-only на ветке `chore/issue-456-ds-gallery` @ `3d0086e`; пути пересверены с `origin/master` `522973a` (там уже нет deploy-workflow'ов — delivery = Vercel Git integration + Promote; правила в `docs/engineering/rules/`). Backend проверен на `chipin-backend` (ветка `develop`).

Идентификаторы PR — `04-<n>` (глобальная схема, `00-overview.md`); «фаза N» в тексте = PR `04-N`. После review A: `04-0` → `04-0a`/`04-0b`, `04-2a` → `04-2a1…04-2a4`, новые `04-2f`, `04-2g`, `04-3d`. После review C (2026-10-28): `04-2a2` делится на `04-2a2`/`04-2a2b`, новый `04-2h` (Playwright E2E SW), `04-3b` → `04-3b1`/`04-3b2`; kill-switch SW снят (ASSUMPTION C3-01, §2.11). Backend-issue — `BE-04-<n>`.

Отклонение от DECISIONS: (1) D8 перечисляет rewrites `/`, `/<locale>/*`, `/help/*`, `/blog/*` → сайт; здесь — catch-all на сайт последним правилом (надмножество, без пятого ручного списка, §4.1). (2) D8 «invite landing `/join/<token>`» → `/join/group/<token>` и `/join/friend/<token>`: токены группы и друга — разные сущности backend (§3.5). (3) D15 «one deploy workflow» — на master deploy-workflow'ов нет, единственный путь — Vercel Git integration + Promote; для двух проектов это и остаётся (§1.4). (4) D8 «SW registered only under /app/» → SW приложения `/sw.js` со scope `/` бессрочно, precache и fallback только `/app/*`, сайт воркер не регистрирует (**ASSUMPTION, решение владельца C3-01**, §2.11; альтернатива (b) — там же). (5) D6 «per-route errorElement» → три уровня: корень, `AuthLayout`, `InternalLayout` (§2.5; route-модуль может добавить свой `ErrorBoundary`).

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
- Домен `chipin.one` остаётся на **текущем** Vercel-проекте. Его Root Directory = `apps/app`, он отдаёт `/app/*`, `/api/*`, `/.well-known/*`, `/sw.js`, а **всё остальное** внешним rewrite проксирует в новый проект `chipin-site` (Root Directory `apps/site`). Откат — Instant Rollback на заранее выпущенный совместимый деплой 04-3d (раздел «Откат cutover» в «Фазах»).
- Одна константа `CUTOVER` (`apps/app/app-base.config.ts`) задаёт `APP_BASE` (`'/'` до cutover, `'/app/'` после; никогда не `''`), Vite `base`/`outDir`, basename роутера, `start_url` манифеста и правила хостинга (§2.1). SW приложения — всегда `/sw.js` со scope `/` (ASSUMPTION C3-01, §2.11): установленные PWA сохраняют регистрацию и офлайн, kill-switch и миграции scope нет.
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
| нынешний (оставить **имя** без изменений, см. Требования к backend) | `apps/app` | `chipin.one`, `dev.chipin.one`, preview `*.vercel.app` | `npm run vercel-build` | `dist` |
| `chipin-site` (новый) | `apps/site` | `site.chipin.one` (prod), `site-dev.chipin.one` (dev) | `astro build` | `dist` |

- В обоих проектах включить «Include source files outside of the Root Directory», иначе не найдутся корневой lockfile и `packages/*`.
- Домен переносить не нужно, поэтому откат не требует DNS. Хост сайта прячется за rewrite (§4.1).
- Включить «Ignored Build Step» по путям, чтобы проект не пересобирался на чужие изменения (A-30): `[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ../../packages ../../package-lock.json ../../package.json ../../tsconfig.base.json ../../scripts`. Без `VERCEL_GIT_PREVIOUS_SHA` (первый деплой ветки) или при ошибке git команда даёт ненулевой код, и проект собирается. `HEAD^` не используется: при push из нескольких коммитов он видит только последний.
- Custom-домены на Vercel Hobby бесплатны (D22), поэтому `site.chipin.one` / `site-dev.chipin.one` остаются; запасной вариант `*.vercel.app` не нужен.
- Лимиты Hobby (A-31): 1 одновременная сборка на аккаунт и дневной лимит деплоев (на 2026-10 — 100/день; сверить со страницей Limits перед 04-3a). Пропущенные Ignored Build Step деплои тоже создаются (как cancelled). Два проекта × push каждого PR удваивают очередь. Действие: после 02-C6 и после 04-3a замерить длительность CI (`timeout-minutes: 20`) и число деплоев за неделю; если CI > 15 мин или деплоев > 60/день — вынести `import-x/no-cycle` в nightly и включить Ignored Build Step для preview всех веток, кроме PR с `apps/site/**`.

**Модель релиза двух проектов (A-08).** Сайт выпускается так же, как приложение (`DEPLOYMENT.md:42-66`): только ручной Promote.
- В `chipin-site`: Production Branch = `main`, `git.deploymentEnabled.main: false` (через `vercel.passthrough`, §1.5a), домен `site-dev.chipin.one` привязан к ветке `master`, `site.chipin.one` — к Production. Merge в `master` даёт только dev/preview, prod сайта меняется только Promote'ом. Настройку делает владелец при создании проекта (04-3a).
- Порядок Promote после cutover: сначала app, затем site, оба из одного SHA `master`. Причина: страницы сайта (`/join/*`, кнопки входа) ссылаются на маршруты приложения, а не наоборот. До cutover (04-4) сайт на `chipin.one` не виден, порядок не важен.
- Release-QA и completion: GitHub Deployment `Production` создают оба проекта; Issue закрывает только деплой app-проекта (environment `Production – <имя app-проекта>`). В `docs/engineering/release-qa.md` добавляется раздел «Два проекта» с этими тремя правилами. Если org-sweep в `ChipIn-one/.github` фильтрует только по `environment == 'Production'`, нужна правка фильтра там (owner-issue в `.github`, создаётся в 04-3a; без него site-деплой может закрыть Issue раньше app).

#### 1.5a Изоляция провайдера (D18)

Владелец планирует уйти с Vercel (отдельное исследование hosting + аналитики, в работе), поэтому спека не углубляет lock-in:
- Всё Vercel-специфичное живёт только в `apps/app/vercel.json`, `apps/site/vercel.json` и в генераторе (`generate-routing-artifacts.ts`, для сайта — `seoGuard`). Оба `vercel.json` — сгенерированные файлы, руками не правятся.
- Таблица rewrites/redirects/headers хранится в провайдер-нейтральном JSON: `apps/app/hosting.base.json` и `apps/site/hosting.base.json`. Генератор манифеста маршрутов эмитит из него `vercel.json` (`emitters/vercel.ts`); переезд на Cloudflare/Netlify/nginx = новый emitter (`_redirects`/`_headers`, `nginx.conf`), манифест и таблица не меняются.
- Схема `hosting.base.json` (A-07):
  ```jsonc
  {
    "legacyRedirectStatus": 302,            // 302 в 04-4, 301 в 04-5a (§2.9); флага cutover здесь нет — CUTOVER в app-base.config.ts (§2.1)
    "env": { "prod": "chipin.one", "dev": "dev.chipin.one", "preview": "*.vercel.app" },
    "headers":   [{ "source": "/app/(.*)", "set": { "X-Robots-Tag": "noindex, nofollow" } }],
    "redirects": [{ "from": "/sitemap.xml", "to": "/sitemap-index.xml", "status": 301 }],
    "rewrites":  [{ "from": "/api/:path*", "to": "https://api.chipin.one/:path*", "env": "prod" }],
    "vercel":    { "passthrough": { "$schema": "…", "buildCommand": "…", "git": { "deploymentEnabled": { "dev": false, "main": false } } } }
  }
  ```
  - `env` у правила — `'prod' | 'dev' | 'preview'` (без поля — для всех). Таблица `env` → хост — единственная; emitter Vercel превращает `env` в `has: [{ type: 'host', value: … }]` (для `preview` — `{ "suf": ".vercel.app" }`, как сейчас в `vercel.json`).
  - `vercel.passthrough` emitter копирует в корень `vercel.json` дословно; это единственное место для Vercel-полей без нейтрального аналога (`$schema`, `buildCommand`, `git`). Другой emitter его игнорирует.
  - Тест генератора: при `CUTOVER = false` сгенерированный `apps/app/vercel.json` семантически равен нынешнему `vercel.json` (порядок и состав rewrites, redirects, headers, `has`, `git`).
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

#### 2.1 Базовый путь

- **Одна константа `CUTOVER`** (C1-01, C2-01). Файл `apps/app/app-base.config.ts` (только erasable-синтаксис; его импортируют `vite.config.ts`, `pwa.config.ts` и генератор §2.9 без сборки) — единственное место, где меняется режим:
  ```ts
  export const CUTOVER = false;                           // 04-4 ставит true; больше нигде не меняется
  export const APP_BASE = CUTOVER ? '/app/' : '/';        // всегда начинается и кончается '/', никогда не ''
  export const APP_OUT_DIR = CUTOVER ? 'dist/app' : 'dist';
  export const DIST_APP_PREFIX = APP_BASE.slice(1);       // '' | 'app/': где app-файлы лежат внутри dist/
  export const APP_SHELL = 'app.html';                    // 04-5a переименовывает в 'index.html'
  ```
  - Vite: `base: APP_BASE`, `build.outDir: APP_OUT_DIR`. `base: ''` и `'./'` запрещены: в Vite 8.3 это относительный base (`vite/dist/node/chunks/node.js:37456`), и deep link `/group/<id>` грузил бы `/group/assets/*`, получал бы `app.html` вместо JS и показывал пустой экран.
  - Переключатели по `CUTOVER` (все в `vite.config.ts`, других нет): `rolldownOptions.input` = `{ index, app }` при `false` (как сейчас) и только `{ app: APP_SHELL }` при `true` (иначе публичный `index.html` лёг бы в `dist/app/index.html`, и Vercel отдал бы его на `/app/` раньше rewrite'ов); prerender (`integration.beforeBuildServiceWorker`) и `verify:public-precache` работают только при `false`.
  - Код приложения константу не импортирует. `src/app/router/appBase.ts`: `APP_BASE = import.meta.env.BASE_URL` (его подставляет Vite из `base`), `ROUTER_BASENAME = APP_BASE === '/' ? '/' : APP_BASE.slice(0, -1)`; `createBrowserRouter(routes, { basename: ROUTER_BASENAME })`. Признак cutover в коде — `APP_BASE !== '/'`.
  - SW, манифест и хостинг выводятся из тех же констант (§2.9, §2.11). Так 04-4 меняет одно значение, а не код (A-10). Константы `ROUTES` остаются относительными к basename (`'/dashboard'`), поэтому `navigate`, `<Link>` и `matchPath` по `useLocation().pathname` не меняются.
  - Тесты: `app-base.config.test.ts` (04-2d) — для обоих значений `CUTOVER` `APP_BASE` матчит `/^\/(?:app\/)?$/`, `vite.config` отдаёт `base === APP_BASE`; `scripts/check-built-html.mjs` (04-2g, шаг `build`) — каждый `src`/`href` ассета в собранном `APP_SHELL` начинается с `APP_BASE`; deep-link smoke на preview-деплое (критерий 12).
- Код, который читает `window.location.pathname` в обход роутера, переводится на хелпер `getRouterPathname()`, который снимает префикс `ROUTER_BASENAME` (до cutover — no-op). Места (A-26, `grep window.location src` на master): `src/helpers/url.ts:31-35` (`getSocialAuthUrl`), `src/i18n/index.ts:12`, `src/root.tsx:31` (уходит в 04-5a), `src/components/Header.tsx:55` и `src/components/header/LandingMobileMenu.tsx:21` (`window.location.assign/href` на публичные пути → `SITE_PATHS`). Паттерны маскировки токенов лежат в `src/constants/telemetry.ts` (не в `helpers/telemetry.ts`) и получают обе формы путей в 04-2g. Lint-правило `no-restricted-properties` запрещает `window.location.pathname` вне хелпера.
- Ссылки из приложения на сайт (A-16). `ROUTES.HOME`, `ROUTES.PRIVACY`, `ROUTES.TERMS` удаляются из `ROUTES` в 04-2f и заменяются `SITE_PATHS` (`apps/app/src/app/router/sitePaths.ts`: `home: '/'`, `privacy: '/privacy'`, `terms: '/terms'`, `localeHome(l)`), которые используются только как `<a href>` или `window.location.assign`, никогда в `navigate`/`<Link>` (под basename `'/'` превратился бы в `/app/`). Потребители: `Page404.tsx:18`, `Header.tsx:47,70`, `resolveOAuthReturnTo` (`url.ts:9-34`). Lint: `no-restricted-syntax` на `MemberExpression[object.name='ROUTES'][property.name=/^(HOME|PRIVACY|TERMS)$/]`. До cutover `SITE_PATHS` ведут на те же URL, что и сейчас, поведение не меняется.
- После cutover Vercel Output остаётся `dist`: app-файлы физически лежат в `dist/app/…`, SW — в `dist/sw.js` (его пишет VitePWA с `outDir: 'dist'`, §2.11). Root-файлы (A-05): Vite копирует `publicDir` в `outDir`, то есть в `dist/app`, поэтому `/.well-known/assetlinks.json` туда не попадёт сам. Он лежит в `apps/app/public-root/` и копируется шагом `apps/app/scripts/copy-root-files.mjs` (`public-root/**` → `dist/`), который вызывают `build` и `vercel-build` после `vite build`; скрипт падает при коллизии с файлом сборки. `/.well-known` Vercel зарезервирован и не переписывается, поэтому файл обязан физически лежать в `dist/.well-known`; no-op rewrite `.well-known` из `hosting.base.json` удаляется. Тест сборки (оба `CUTOVER`): `dist/sw.js` и `dist/.well-known/assetlinks.json` есть, `dist/app/.well-known` и `dist/app/sw.js` нет.

#### 2.2 Манифест маршрутов

Файл `apps/app/src/app/router/routeManifest.ts` — чистые данные. В нём нет импортов, кроме типов, и только erasable-синтаксис, чтобы Node 24 мог импортировать его из скрипта без сборки.

```ts
type RouteAccess = 'public' | 'protected';
type RouteLayout = 'internal' | 'bare' | 'public';  // 'public' — только переходные id до cutover

interface AppRouteDef {
    id: AppRouteId;                 // 'dashboard' | 'solo' | 'group' | ...
    path: string;                   // относительно basename: 'group/:groupId'
    access: RouteAccess;
    layout: RouteLayout;            // internal = InternalPageLayout с навигацией
    guard?: 'solo';                 // доп. layout-guard
    meta: { titleKey: string; entityTitleKey?: string };  // ключи ns 'meta'
    legacyPaths: readonly string[]; // старые абсолютные пути, для 301
    onlyBeforeCutover?: true;       // переходный маршрут; удаляется в 04-5a
    localePrefix?: true;            // путь повторяется под 5 префиксами LOCALE_PREFIX
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
| `notFound` | `not-found` | public | bare | — | — (старый `/not-found` после cutover уходит catch-all'ом на 404 сайта, §4.2) |
| `publicHome` | `` (index) | public | public | — | — (`onlyBeforeCutover`, `localePrefix`) |
| `publicPrivacy` | `privacy` | public | public | — | — (`onlyBeforeCutover`, `localePrefix`) |
| `publicTerms` | `terms` | public | public | — | — (`onlyBeforeCutover`, `localePrefix`) |

- Переходные маршруты (C2-10). До cutover `/`, `/privacy`, `/terms` и их формы с префиксами `LOCALE_PREFIX` (`publicRouteManifest.ts:4-20`) — это `publicHome`/`publicPrivacy`/`publicTerms` (`layout: 'public'`, элемент — нынешний `PublicLocaleRoute`, на `/` — с `HomeRouteGuard`, как сейчас). `createAppRouter` и генератор берут `onlyBeforeCutover`-маршруты только при `CUTOVER = false`, а `home` (index) — только при `CUTOVER = true`. Rewrites для переходных id генератор не выпускает (это prerender-файлы), в SW-allowlist их нет (точные precache-записи, как сейчас). 04-5a удаляет три id.
- `home` (index, только при `CUTOVER = true`) — loader с `redirect` в предпочитаемый режим (`dashboard` или `solo`). Он заменяет `HomeRouteGuard`.
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
└─ AuthLayout         loader=requireSession; errorElement=RouteErrorBoundary; <Outlet/> + AuthModal поверх при истёкшей сессии
   ├─ bare routes     group/join/:inviteToken, friends/join/:inviteToken
   └─ InternalLayout  errorElement=RouteErrorBoundary; InternalPageLayout + <Outlet/>
      ├─ index (home redirect), dashboard, group/:groupId, activity, activity/:id, friends, settings
      └─ SoloGuardLayout → solo
```

- `AuthLayout` заменяет `ProtectedRoute`, `InternalRoute` (8 обёрток) и отступы, вшитые в guard (`ProtectedRoute.tsx:43-47`, они уходят в `InternalLayout`).
- `requireSession` (loader) возвращает цепочку промисов (стиль `await`/`.then` свободный, D24): `({ request }) => { const url = new URL(request.url); const returnTo = stripAppBase(url.pathname) + url.search; return restoreReady.then(() => authReady()).then(session => (isSignedOut(session) ? redirect('/login?returnTo=' + encodeURIComponent(returnTo)) : null)); }` (`stripAppBase` снимает `ROUTER_BASENAME`, §2.1). `authReady()` — промис первичной проверки сессии, который выносится из `useCheckSignIn` в `src/app/auth/session.ts`. `isSignedOut(session)` истинно ровно для строки «redirect» таблицы ниже.
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
- Явный sign-out — полная навигация `window.location.assign(getLastAccountLandingPath())` на сайт.
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

1. `apps/app/vercel.json` — `hosting.base.json` (headers, `/api` rewrites, `vercel.passthrough`) плюс сгенерированное. **Одна константа `CUTOVER` из `app-base.config.ts` управляет всеми тремя группами** (A-06; в `hosting.base.json` флага нет):
   - `CUTOVER = false` (04-2b … 04-3d): генератор выдаёт нынешние rewrites из `path` манифеста (`/dashboard/:path*` → `/app.html` и т. д.), без legacy-redirect'ов и без catch-all. Тест: результат семантически равен нынешнему `vercel.json` (§1.5a);
   - `CUTOVER = true` (04-4): `redirects` для каждого `legacyPaths` → `/app/<path>` и фиксированные redirect'ы §4.2; `rewrites` приложения: для каждого первого сегмента маршрута `/app/<segment>` и `/app/<segment>/:path*` → `/app/app.html` (`APP_BASE + APP_SHELL`; 04-5a → `/app/index.html`), плюс `/app/` → `/app/app.html`, `/manifest.webmanifest` → `/app/manifest.webmanifest` (rewrite: URL манифеста у установленных PWA не меняется, §2.11) и redirect `/app` → `/app/` (308; одна каноническая форма, A-41); catch-all на сайт (`/:path*` → хост сайта по окружению, §4.1) **последним**. Кэш внешнего rewrite (A-34): app-проект создан до 2026-04-06, поэтому Vercel его по умолчанию не включает; эмиттер добавляет header-блок `x-vercel-enable-rewrite-caching: 1` на тот же `source`, что у catch-all. Это единственное разрешённое исключение из правила «нет app-headers на проксируемых путях» (служебный заголовок, CSP и прочие не затрагивает). Проверка на preview PR 04-4: повторный `curl -sI /` даёт `x-vercel-cache: HIT`; если нет — сайт считается некэшируемым через proxy, и это фиксируется в `DEPLOYMENT.md`;
   - статус обратимых redirect'ов (legacy-пути, `/group/join`, `/friends/join`, `/oauth/callback`; §4.2) задаёт поле `legacyRedirectStatus`: `302` в 04-4 на время окна отката (браузеры кэшируют 301 бессрочно, и после отката на 04-3d кэшированный 301 `/dashboard` → `/app/dashboard` вместе с redirect'ом 04-3d `/app/*` → `/*` дал бы цикл), `301` — в 04-5a после окна отката.
   - headers приложения (A-02): каждый header-блок `hosting.base.json` имеет `source` из списка `/app/(.*)`, `/api/(.*)`, `/sw.js`, `/.well-known/(.*)`, `/manifest.webmanifest`; `source: "/(.*)"` запрещён. До cutover (`CUTOVER = false`) приложение отдаёт и публичные страницы, поэтому эмиттер добавляет к нынешним путям приложения и публичным путям те же headers, что сейчас (семантическое равенство с текущим файлом). После cutover проксируемые на сайт пути не получают ни одного header'а app-проекта: CSP, `Referrer-Policy` и `X-Frame-Options` для них задаёт только site-проект (§3.6).
2. `apps/app/src/app/router/routing.generated.ts` — `PRIVATE_SPA_NAVIGATION_ALLOWLIST`: при `CUTOVER = false` — ровно нынешние два regex `scripts/private-spa-navigation.ts` (тест сверяет), при `true` — вида `/^\/app(?:\/(?:dashboard|solo|group|activity|friends|settings|oauth|login|not-found)(?:\/|$)|\/?$)/`. Его импортирует `pwa.config.ts` (заменяет `scripts/private-spa-navigation.ts`).
3. Скрипт `npm run routes:generate -w @chipin/app` и шаг `routes:check` в `verify:full`.

Тест `apps/app/scripts/generate-routing-artifacts.test.ts`:
- генерирует в памяти и сравнивает с закоммиченными `vercel.json` и `routing.generated.ts`. При расхождении выдаёт «run npm run routes:generate»;
- каждый `path` манифеста (с подставленными тестовыми параметрами) матчится SW-allowlist **и** хотя бы одним rewrite;
- каждый `legacyPaths` имеет redirect, и ни один redirect не указывает на путь вне манифеста или сайта;
- `vercel.config.test.js` (проверки `/api`) остаётся и работает на сгенерированном файле;
- каждый ключ `ROUTE_MODULES` есть в манифесте и наоборот (это проверяет и TS, тест дублирует для понятного сообщения);
- при `CUTOVER = true` ни один header в `apps/app/vercel.json` не имеет `source`, который матчит `/`, `/ru/`, `/privacy`, `/join/group/x` (A-02);
- при `CUTOVER = false` результат семантически равен нынешнему `vercel.json`, legacy-redirect'ов и catch-all нет (A-06);
- ни один `redirects[].source` не матчит файл собранного `dist/` (redirect Vercel срабатывает раньше файла, §4.1; C1-19, C3-11): `routes:check --dist apps/app/dist` после `build` проходит по списку файлов (`sw.js`, `manifest.webmanifest`, `.well-known/*`, `app/**`, иконки) для обоих `CUTOVER` и для группы `preCutoverCompat`.

Перечисленные rewrites, а не один `/app/:path*`, нужны, чтобы неизвестный `/app/foo` получал настоящий 404 (через catch-all на 404 сайта) и чтобы SW не отдавал на него offline-оболочку. Это поведение совпадает с нынешним (`private-spa-navigation.ts:1-2`).

#### 2.10 i18n в приложении

- В URL приложения префикса локали нет.
- Ленивая загрузка: `i18next-resources-to-backend` с `(lng, ns) => ns === 'common' ? loadCommon(lng) : import(`./locales/${lng}/${ns}.json`)` (относительный шаблон `./` Vite бандлит через dynamic-import-vars). Неймспейс `common` берётся из `@chipin/i18n-content`: bare-специфайер с переменной (`import(`@chipin/i18n-content/common/${lng}.json`)`) Vite **не** бандлит и оставляет runtime-импортом с 404 (A-13). Поэтому пакет экспортирует `loadCommon(lng: SupportedLocale): Promise<Record<string, unknown>>` из `packages/i18n-content/src/loadCommon.ts`, построенный на `import.meta.glob('../common/*.json', { import: 'default' })` (ключ `../common/${lng}.json`; неизвестная локаль → reject). `package.json` пакета: `exports` `".": "./src/index.ts"`, `"./common/*": "./common/*"`. В entry ничего из JSON не попадает. `src/i18n/resources.ts` удаляется. Тест сборки: в `dist/app/assets` ровно 5 чанков `common`.
- `SUPPORTED_LOCALES` и `DEFAULT_LOCALE` импортируются из `@chipin/i18n-content`, а `src/constants/locales.ts` становится реэкспортом.
- Язык меняется **в одном месте**: `src/app/i18n/setAppLanguage.ts` возвращает цепочку (стиль свободный, D24): `i18n.loadLanguages(lng).then(() => i18n.changeLanguage(lng)).then(() => { document.documentElement.lang = lng; LocalStorage.set(LS_KEY_LOCALE, lng); })`. `i18n.changeLanguage` вне этого файла запрещён lint-правилом `no-restricted-syntax`.
- Начальный язык выбирается один раз при init, в таком порядке: `?locale=` на `/app/login` (приходит с сайта) → `LocalUser.settings.language` → сохранённая `locale` → `navigator.languages` → `en`. После загрузки профиля `useSyncUserSettings` вызывает `setAppLanguage` только если язык сервера отличается от текущего.
- Пока язык грузится, работает `Suspense` в `RootLayout`. `PublicLocaleRoute` удаляется, вместе с ним уходит и баг с зависшим спиннером (D1).
- В CI добавляется тест паритета ключей по всем локалям (аудит 02 §5).

#### 2.11 Service worker

**ASSUMPTION (owner decision C3-01).** SW приложения живёт по адресу `/sw.js` со scope `/` **бессрочно** — до и после cutover. Регистрирует его только приложение; сайт воркер не регистрирует, его страницы попадают в scope, но проходят в сеть без перехвата. Причина: у PWA, установленных до cutover, `start_url: '/'` и `scope: '/'`, а iOS манифест установленного PWA не обновляет (A-41). С SW только на `/app/` такие установки после cutover не открывались бы офлайн (нарушение D2 для всех текущих пользователей). С `/sw.js`/scope `/` регистрация у них та же, новый воркер приходит обычным обновлением; kill-switch, вторая регистрация и миграция scope не нужны. Отклонение от D8 «SW registered only under /app/» — пункт подтверждений владельца в `00-overview.md`.

- Регистрация одна: `useRegisterSW` из `virtual:pwa-register/react` в `src/app/pwa/ServiceWorkerManager.tsx`. При `buildBase: '/'` и `scope: '/'` (таблица ниже) она регистрирует `/sw.js` со scope `/` — ровно то, что сегодня делает ручной `register('/sw.js', { scope: '/' })` (`swUpdates.tsx:221-289`), поэтому 04-2d не создаёт вторую регистрацию и до cutover поведение SW не меняется (C2-01). `src/helpers/swUpdates.tsx` и ручной `register('/sw.js')` удаляются; второй путь обновления `src/helpers/serviceWorkerRecovery.ts` (`SKIP_WAITING` postMessage, `:107-128`) тоже удаляется, а `GlobalErrorFallback.tsx:19` вызывает `updateServiceWorker(true)` из `ServiceWorkerManager` (A-26), `src/basics/PWABadge.tsx` (спека 05 его не переносит) переименовывается в `ServiceWorkerManager` (TODO в `PWABadge.tsx:6`). `workbox-window` удалён раньше в 02-B1 (в коде не используется). Это единственный PR, который меняет регистрацию SW.
- Конфиг VitePWA строит чистая функция `buildPwaOptions()` в `apps/app/pwa.config.ts` из констант §2.1 (тест `pwa.config.test.ts` проверяет таблицу для обоих `CUTOVER`; цвета манифеста — из `@chipin/tokens/generated/manifest-colors.json`, спека 05 §6):

  | опция | `CUTOVER = false` (04-2d … 04-3d) | `CUTOVER = true` (04-4) |
  |---|---|---|
  | `outDir` VitePWA (куда пишется `sw.js`; он же `globDirectory`) | `dist` | `dist` |
  | `buildBase` (путь регистрации и `<link rel="manifest">`) | `/` | `/` |
  | `scope` (регистрация и манифест) | `/` | `/` |
  | файл SW → URL | `dist/sw.js` → `/sw.js` | `dist/sw.js` → `/sw.js` |
  | файл манифеста → URL | `dist/manifest.webmanifest` → `/manifest.webmanifest` | `dist/app/manifest.webmanifest`; URL прежний `/manifest.webmanifest` (rewrite §2.9) |
  | манифест `start_url` / `scope` / `id` | `/` / `/` / `/` | `/app/` / `/` / `/` (`id` не менять: иначе второе приложение) |
  | иконки манифеста | `/pwa-*.png` и т. д. | `/app/pwa-*.png` и т. д. (`APP_BASE` + имя) |
  | `globPatterns` | `**/*.{js,css,html,svg,png,ico,webp}` (как сейчас) | `app/**/*.{js,css,html,svg,png,ico,webp}` — только оболочка и ассеты приложения |
  | `navigateFallback` | `app.html` | `app/app.html` (`DIST_APP_PREFIX + APP_SHELL`) |
  | `navigateFallbackAllowlist` | `PRIVATE_SPA_NAVIGATION_ALLOWLIST` (= нынешние regex) | то же из `routing.generated.ts`: только `/app/…` |
  | `runtimeCaching` | нет | одна запись: `urlPattern: ({ request, url }) => request.mode === 'navigate' && url.pathname === '/'`, `handler: 'NetworkOnly'`, `options.precacheFallback: { fallbackURL: '/app/offline-root.html' }` |

  Общее для обоих: `registerType: 'prompt'`, `injectRegister: false`, `skipWaiting: false`, `clientsClaim: true`, `cleanupOutdatedCaches: true`, `inlineWorkboxRuntime: true` (рядом с `/sw.js` не появляется `workbox-*.js`); `manifestTransforms: [addPublicDirectoryAliases]` — только при `false`. Кэша API в SW нет (это TanStack persister, спека 03). Опции сверены с `vite-plugin-pwa@1.3.0` (`dist/index.js`: `swDest = outDir/filename`, `globDirectory = outDir`, путь регистрации и `<link rel="manifest">` = `buildBase` + `filename`/`manifestFilename`, манифест эмитится в сборку Vite, то есть в `APP_OUT_DIR`) и `workbox-build@7.4.1` (`navigateFallbackAllowlist`/`Denylist`, `runtimeCaching[].options.precacheFallback`, функция в `urlPattern`, `inlineWorkboxRuntime`).
- Что получают пути после cutover: `/app/…` из allowlist — оболочка из precache (офлайн работает); страницы сайта (`/`, `/ru/`, `/privacy`, `/join/*` …) — у SW нет маршрута, запрос идёт в сеть, ничего не кэшируется; навигация ровно на `/` без сети получает `apps/app/public/offline-root.html` — статичный файл без скриптов (`<meta http-equiv="refresh" content="0; url=/app/">` + ссылка «Открыть ChipIn»), который ведёт в `/app/`. Так открываются офлайн PWA, установленные с `start_url: '/'`. Онлайн `/` отдаёт сайт, а его inline-скрипт ведёт standalone/залогиненного в `/app/` (§3.6). Неизвестный `/app/foo` не матчит allowlist и получает 404, как сейчас.
- `id` и `scope` манифеста не меняются никогда, меняется только `start_url` (новые установки сразу открывают `/app/`). Обновит ли браузер `start_url` у старой установки, неважно: оба пути работают онлайн и офлайн.
- Политика обновления:
  1. Обнаружение: при старте, на `visibilitychange → visible` (`registration.update()`), и раз в час, если online.
  2. Prompt: тост «Доступно обновление» с кнопками «Обновить» и «Позже». «Позже» скрывает тост до следующего `visible` после 4 ч.
  3. Принудительно: если ожидающий воркер висит **больше 24 ч** с первого обнаружения (время в `localStorage`), обновление применяется само в ближайшей безопасной точке. Безопасная точка — смена маршрута или `visible`, при этом нет открытой модалки с грязным черновиком, `queryClient.isMutating() === 0` и нет outbox-операции в статусе `sending` (`outboxState` спеки 03 §2.3; до 03-15a outbox нет — условие истинно) (C3-12). Outbox хранится в IndexedDB и переживает reload (спека 03).
  4. Минимальная версия: экран «Нужно обновить приложение» (блокирующий, одна кнопка `updateServiceWorker(true)` или reload) и функция `showUpdateRequired()` живут здесь (04-2d, за флагом). Кнопка экрана вызывает `registration.update()`, ждёт `waiting` до 10 с и только тогда `updateServiceWorker(true)`; если нового воркера нет, экран пишет «Обновление ещё не опубликовано, попробуйте позже» и не перезагружает (иначе цикл reload той же версии, C3-26). Перед любым reload вызываются колбэки `onBeforeAppReload` из `ServiceWorkerManager` (03-13 регистрирует сохранение черновика расхода в `sessionStorage`). Экран показывается, когда `outboxGate` (`shared/offline/outboxGate.ts`, спека 03 §2.4; до 03-15a — no-op-заглушка) закрыт с причиной `outdated` (replay остановлен до обновления); `showUpdateRequired()` переводит гейт в это состояние, outbox не удаляется. Детект — спека 03 (03-20): ответ 426 `CLIENT.OUTDATED` или заголовок `X-Min-Client-Version` больше semver-ядра `APP_VERSION` (сравнение только `major.minor.patch`, суффикс `-dev-<sha>` отбрасывается, §1.2), контракт BE-03-5. Сейчас (D19, вариант A) работает только п. 3. До включения outbox (03-17) обязательны BE-03-5 (новый заголовок `X-Client-Version` + `MIN_CLIENT_VERSION` → 426) и 03-20 (заголовок одной строкой в axios-interceptor из `APP_VERSION`, `src/constants/version.ts`, Vite `define`); экран п. 4 тогда включается. Правило 72 ч: `MIN_CLIENT_VERSION` поднимается только после ≥ 72 ч новой FE-версии в prod (спека 03 §7).
- Переход со старого SW: отдельного механизма нет. Существующая регистрация (scope `/`, скрипт `/sw.js`) при проверке обновления получает новый `/sw.js` и проходит обычный цикл prompt / принудительно через 24 ч (п. 3). Пока новый воркер не активен, старый может ещё один раз отдать из своего precache прежний лендинг и прежнее приложение; это обычное «доступно обновление», данные и API те же. `Cache-Control: no-cache` для `/sw.js`.
- **Альтернатива (b): принять потерю офлайна у текущих установок.** SW по букве D8: `/app/sw.js` со scope `/app/`; на `/sw.js` — kill-switch (удаляет только caches старого scope, `unregister()`, хранить ≥ 6 месяцев); в 04-3d — kill-switch `/app/sw.js` для отката, а redirect `/app/:path*` → `/:path*` исключает `sw.js` (`source: "/app/:path((?!sw\\.js$).*)"`, потому что redirect Vercel срабатывает раньше файла, §4.1). Цена: PWA, установленные до cutover, офлайн не открываются, пока пользователь не переустановит приложение (одноразовый баннер в standalone). Выбирается только явным решением владельца; тогда 04-2d, 04-3d и 04-4 получают пункты kill-switch обратно, а критерий 5 — E2E двух регистраций.

### 3. Сайт (Astro, D8)

#### 3.1 Раскладка `apps/site`

```
astro.config.ts           output: 'static', trailingSlash: 'ignore', build.format: 'directory', i18n, sitemap
vercel.json               cleanUrls, headers (CSP сайта), rewrites /join/*
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
public/                   robots.txt, favicon.*, og/*.png
```

#### 3.2 i18n

- `@chipin/i18n-content/locales.ts` экспортирует `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` и `LOCALE_PATH: { en: '', ru: 'ru', es: 'es', 'pt-BR': 'pt-br', 'pt-PT': 'pt-pt' }`. Значения совпадают с `LOCALE_PREFIX` (`publicRouteManifest.ts:11-13`).
- `astro.config.ts`: `i18n: { defaultLocale: 'en', locales: ['en', 'ru', 'es', { path: 'pt-br', codes: ['pt-BR'] }, { path: 'pt-pt', codes: ['pt-PT'] }], routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false } }`. Список строится из `LOCALE_PATH`, а не пишется руками.
- URL не меняются: `/`, `/privacy`, `/terms`, `/ru/`, `/ru/privacy` … `/pt-pt/terms` (15 URL; домашние страницы локалей — со слешем, остальные — без, как в `publicRouteManifest.ts:14-19`). Дубли по слешу (A-33): `trailingSlash: 'ignore'` отдаёт и `/privacy`, и `/privacy/` с 200, поэтому `apps/site/hosting.base.json` получает сгенерированные из `LOCALE_PATH` × страницы redirect'ы 301: `/<page>/` → `/<page>` для не-домашних и `/<locale>` → `/<locale>/` для домашних локалей. Одна форма URL = canonical.
- hreflang в `BaseLayout`: для каждой страницы `<link rel="alternate" hreflang="<code>">` на все локали, у которых есть перевод (`getRelativeLocaleUrl`), плюс `x-default` → en. Canonical — абсолютный `https://chipin.one/...` (`site` в конфиге). Хост `site.chipin.one` никогда не попадает в canonical.
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

- URL: `/join/group/<token>` и `/join/friend/<token>`. Тип в пути нужен, потому что токены группы и друга — разные сущности на backend (`GroupDtos.kt:11` и `UserService.kt:91-96`). Под один `/join/<token>` их не свести без запроса к API.
- Статика: `pages/join/group.astro` и `pages/join/friend.astro`. Rewrite в `apps/site/vercel.json`: `/join/:kind(group|friend)/:token` → `/join/:kind`.
- Страница `noindex` (`<meta name="robots" content="noindex">`), не попадает в sitemap, `Referrer-Policy: no-referrer`, чтобы токен не утёк в Referer.
- Inline-скрипт:
  1. Достаёт token из `location.pathname` и проверяет его тем же regex, что хотфикс D1. Формат токена — доменная константа, ей не место ни в `packages/tokens`, ни в `packages/i18n-content`, поэтому regex копируется в `apps/site/src/lib/inviteToken.ts`. Тест в `apps/app` импортирует оба regex и падает при расхождении.
  2. Если токен валиден, кнопка «Открыть приглашение» получает href `PUBLIC_APP_ORIGIN` (§4.4) + явная таблица `{ group: '/app/group/join/', friend: '/app/friends/join/' }[kind] + encodeURIComponent(token)`. Если невалиден, страница показывает «Ссылка повреждена» и ссылку на `/`.
  3. Язык: страница содержит строки всех 5 локалей (≈6 строк × 5) из `apps/site/src/i18n/locales/<locale>/join.json` (те же JSON, что у остального сайта, проверяются тестом паритета §3.2; inline-строк в `.astro` нет) и выбирает по порядку: `localStorage['Chipin_locale']` → `settings.language` из `localStorage['Chipin_user']` (оба через `JSON.parse` в try/catch; тот же origin) → `navigator.languages` → `en`. Кнопка передаёт выбранный код как `?locale=<код>` (и внутри `returnTo`), чтобы регистрация нового пользователя получила верный язык (`url.ts:39-41`; C3-25). Префиксных `/ru/join/...` нет, потому что ссылки строит приложение без локали.
- Автоматического перехода в приложение **нет**, только явная кнопка. Приложение на `/app/group/join/:token` показывает экран подтверждения из спеки 01 (PR 01-2: generic-текст и кнопка «Вступить»; имя группы — только после BE-01-3) и только после клика вызывает `joinGroup`. Неавторизованный пользователь проходит `/app/login?returnTo=…` и возвращается на экран подтверждения.
- В приложении `buildGroupInviteLink` и `buildFriendInviteLink` (`src/helpers/url.ts:46-50`) меняются на `${origin}/join/group/${encodeURIComponent(t)}` и `/join/friend/…`.

#### 3.6 Стили, islands, SW, 404, аналитика

- Стили: только `@chipin/tokens/radix-colors.css` + `@chipin/tokens/tokens.css` (раскладка пакета — спека 05 §1; шрифт системный, webfont нет) и scoped `<style>` в `.astro`. Favicon (A-28): `BaseLayout` ставит `<link rel="icon" href={faviconUrl}>`, где `faviconUrl` — `import faviconUrl from '@chipin/tokens/assets/favicon.svg?url'` (Astro выпускает хешированный файл в `/_astro/`); `/favicon.*` на домене отдаёт сайт через catch-all, иконки манифеста PWA — `/app/…` из app-проекта. Radix Themes, styled-components и Tailwind не используются. Тёмная тема — тот же механизм, что в приложении: `THEME_INIT_SCRIPT` из `@chipin/tokens/theme-init` (спека 05, PR 05-3) inline в `<head>` ставит `html.light|dark` по ключу `Chipin_theme` и `prefers-color-scheme`.
- React-islands — только для виджета, которому нужно состояние и которого нельзя сделать на `<script>` до ~50 строк. Каждое добавление island'а — отдельный PR с обоснованием. Директивы только `client:visible` или `client:idle`, `client:load` запрещён. Бюджет JS на страницу сайта ≤ 30 KB gz (проверка в `seoGuard`). Сейчас island'ов **ноль**.
- Залогиненный на `/` и `/<locale>/`: inline-скрипт в `<head>` главной проверяет `localStorage.getItem('Chipin_authSessionHint') === 'true'` (`src/constants/localstorage.ts:7`; после выхода там хранится JSON `"false"`, поэтому проверка на истинность строки запрещена — тест с `"false"`, C3-18) и делает `location.replace('/app/')`. То же при `matchMedia('(display-mode: standalone)').matches` (A-41): iOS не обновляет манифест установленного PWA, и разлогиненный пользователь в standalone иначе попадёт на маркетинговый сайт; `/app/` сам отправит на `/app/login`. Это повторяет `HomeRouteGuard`. Страница при этом отдаётся всем одинаково, для краулеров ничего не меняется.
- Сайт не регистрирует воркер. `/sw.js` (SW приложения со scope `/`) отдаёт app-проект; навигации на страницы сайта этот SW пропускает в сеть и не кэширует, кроме офлайн-fallback для `/` (§2.11, ASSUMPTION C3-01).
- 404: `src/pages/404.astro` с текстом на en и ссылками на локали. Vercel отдаёт его со статусом 404 для любого неизвестного пути, который пришёл через catch-all.
- Аналитика (D18, оставлена пока): сайт подключает только `<script defer src="/_vercel/insights/script.js">`. Путь `/_vercel/*` обслуживает проект, который держит домен (app), поэтому статистика сайта и приложения в одном проекте. Speed Insights на сайте — тем же способом. Sentry на сайте не ставится.
- Токен инвайта не уходит в аналитику (A-15, D1): `BaseLayout` подключает скрипты analytics/speed-insights только при `includeAnalytics !== false`, а `join/group.astro` и `join/friend.astro` передают `includeAnalytics={false}`. Дополнительно (review B M13) на всех страницах сайта перед скриптом аналитики стоит inline-скрипт `window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); }; window.va('beforeSend', e => ({ ...e, url: e.url.replace(/\/join\/(group|friend)\/[^/?#]+/, '/join/$1/[token]') }));` — его sha256 входит в CSP сайта (`seoGuard`, §3.6). Тест `apps/site/src/lib/analyticsRedact.test.ts`: `/join/group/abc?x=1` → `/join/group/[token]?x=1`. `seoGuard` валит сборку, если HTML под `join/` содержит `_vercel/insights` или `_vercel/speed-insights`. Спекам 01 и 03 ничего менять не нужно: app-санитайзер `sanitizeTelemetryEvent` остаётся как есть.
- CSP сайта — **только** в site-проекте (`apps/site/hosting.base.json` → `apps/site/vercel.json`); после cutover app-проект не ставит на проксируемые пути ни одного header'а (§2.9, A-02), поэтому браузер видит ровно одну CSP. Site-проект задаёт для своих путей CSP, `Referrer-Policy: strict-origin-when-cross-origin` (для `/join/(.*)` — `no-referrer`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`. Базовые директивы те же, что у приложения после 01-1 (`object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`, без Google Fonts), плюс `script-src 'self' 'sha256-…'` для **всех** inline-скриптов (theme-init из 05-3, редирект залогиненного, `/join/*`); хеши считает `seoGuard` и пишет в `vercel.json` при сборке, проверка «закоммиченное = посчитанное». CSP приложения после 04-2b живёт в `apps/app/hosting.base.json` (туда же 05-3 кладёт хеш theme-init).

### 4. Маршрутизация домена

#### 4.1 Кто что отдаёт (порядок правил в `apps/app/vercel.json`)

Порядок Vercel (C1-19, C3-11; проверено по `@vercel/routing-utils@6.6.0`, `getTransformedRoutes`: `cleanUrls`/`trailingSlash` → `redirects` → `headers` → `{ handle: 'filesystem' }` → `rewrites`; в документации vercel.json — «`redirects` are always processed before `rewrites`» и «precedence is given to the filesystem prior to rewrites being applied»): **redirect срабатывает раньше файла**, файл — раньше rewrite. Поэтому `source` redirect'а не должен матчить файл сборки (тест генератора §2.9).

1. `redirects` (§4.2).
2. `headers` (добавляются к итоговому ответу). Headers app-проекта действуют только на пути app-проекта и `/api/(.*)` (§2.9); проксируемые на сайт ответы несут только headers сайта.
3. Файлы app-проекта: `/app/**` (ассеты, `app.html`, `offline-root.html`, manifest), `/sw.js` (SW приложения, scope `/`), `/.well-known/assetlinks.json` (кладёт `copy-root-files.mjs`, §2.1).
4. `rewrites`:
   - `/api/:path*` → backend по хосту (как сейчас, 3 правила);
   - SPA-rewrites `/app…` → `/app/app.html` (сгенерированные; 04-5a → `/app/index.html`), `/manifest.webmanifest` → `/app/manifest.webmanifest`;
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
| `/not-found` | без redirect: catch-all → сайт → `404.astro` со статусом 404 (redirect на `/404` дал бы soft 404 с 200, C3-23) | — |
| `/sitemap.xml` | `/sitemap-index.xml` | фиксированное |
| `/manifest.webmanifest` | **rewrite** (не redirect) на `/app/manifest.webmanifest`: URL манифеста у установленных PWA не меняется (§2.11) | фиксированное |
| `/pwa-:name.png`, `/apple-touch-icon-180x180.png`, `/maskable-icon-512x512.png`, `/favicon.ico` | `/app/…` | фиксированное, обратимое: старые манифесты, обновление WebAPK и закладки iOS (C3-22) |
| `/index.html`, `/app.html` | `/`, `/app/` | фиксированное (A-33: индексированные варианты нынешних html-entry) |
| `/app` | `/app/` (308) | фиксированное (A-41: одна каноническая форма; `/app` не матчит allowlist SW) |
| `/`, `/privacy`, `/terms`, `/ru/…`, `/es/…`, `/pt-br/…`, `/pt-pt/…` | **без изменений** (200 с сайта) | — |

301 вместо 308: все исходные запросы — GET-навигации, а 301 лучше понимают старые краулеры. В Vercel это `"statusCode": 301`. Исключение — окно отката: в 04-4 все redirect'ы, у которых в 04-3d есть обратное правило (строки «manifest», `/group/join`, `/friends/join`, `/oauth/callback`, иконки — обратное им `/app/:path*`), отдаются с `302` (`legacyRedirectStatus`, §2.9), в 04-5a переключаются на `301`. Причина: браузер кэширует 301 бессрочно, и после отката на 04-3d пара «кэшированный 301 `/group/join/<t>` → `/join/group/<t>`» + «redirect 04-3d `/join/group/<t>` → `/group/join/<t>`» дала бы цикл. `/sitemap.xml`, `/index.html`, `/app.html` обратных правил не имеют и сразу 301. Открытые до cutover вкладки, которые догружают старые `/assets/*`, получают 404 чанка и экран «Вышла новая версия» (§2.5) — это ожидаемо (C3-22).

#### 4.3 Индексация

- `apps/app/vercel.json` headers: `/app/(.*)` → `X-Robots-Tag: noindex, nofollow`.
- `robots.txt` сайта: `Disallow: /app/`, `Disallow: /api/`, `Disallow: /join/`, а старые `Disallow` на `/dashboard` и т. п. убираются, потому что там теперь 301.
- Проверка в критериях: на prod `curl -I` по `/app/dashboard` показывает `X-Robots-Tag`, по `/ru/` — `200` без noindex.
- Прямой хост `site.chipin.one` — дубль `chipin.one`; защищает canonical на `https://chipin.one/...` (§3.2). `X-Robots-Tag: noindex` по хосту `site*` **отложен** (A-33): при внешнем rewrite запрос к сайту приходит с Host `site.chipin.one`, и такой заголовок закрыл бы от индексации и основной сайт; условие по `x-forwarded-host` не проверено на Hobby. Пересмотреть, если Search Console покажет `site.chipin.one` в индексе.

#### 4.4 OAuth

- Новый `redirect_to`: `<origin>/app/oauth/callback?returnTo=<router-path>`. `returnTo` хранится **без** `/app` (это путь роутера). `resolveOAuthReturnTo` (`src/helpers/url.ts:7-26`) принимает обе формы и снимает префикс `/app`, а callback-путь сравнивает в обеих формах.
- Backend: allowlist проверяет только origin (`OAuthRedirectValidator.kt:21-27`). Смена пути **не требует** изменений в `OAUTH_ALLOWED_REDIRECT_ORIGINS`, origin `chipin.one` и `dev.chipin.one` остаются. `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` привязан к имени Vercel-проекта, поэтому app-проект **не переименовывать**. Google Console не затрагивается: в Google зарегистрирован callback backend'а, а не фронта (`OAuthPlugin.kt:28-36`).
- Логины в процессе cutover: backend вернёт пользователя на старый `/oauth/callback?code=…`, 301 отправит на `/app/oauth/callback?code=…`, `code` сохранится.
- С сайта кнопка «Войти/Начать» — ссылка `${PUBLIC_APP_ORIGIN}/app/login?locale=<locale>` (A-42). `PUBLIC_APP_ORIGIN` — env site-проекта: prod `https://chipin.one`, dev и preview `https://dev.chipin.one`; без него вход с `site*.chipin.one` или preview сайта давал бы 404 (в site-проекте приложения нет). Тот же origin используют кнопка `/join/*` и редирект залогиненного. Там приложение вызывает `getSocialAuthUrl` с `locale` для регистрации (`url.ts:39-41`, `resolveRegistrationLocale` читает `?locale` вместо публичного пути).

#### 4.5 Ссылки, которые живут вне приложения

- Backend URL фронта не генерирует. grep по `chipin-backend/src/main` нашёл: писем, push и Telegram нет, invite-ответы содержат только токен. Единственное упоминание — пример в OpenAPI `OAuthOpenApi.kt:30` (`https://app.chipin.one/oauth/callback`). Это документация, её поменять на `https://chipin.one/app/oauth/callback` (Требования к backend).
- Ссылки-приглашения, которые уже разосланы (`/group/join/<t>`, `/friends/join/<t>`), покрывают redirect'ы §4.2. Держать бессрочно.
- Закладки и установленные PWA с `start_url: '/'` открывают `/`: онлайн — редирект для залогиненных и standalone (§3.6) на `/app/`, офлайн — `offline-root.html` из SW (§2.11) на `/app/`.
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

- **SW со scope `/` (ASSUMPTION C3-01).** Kill-switch нет: `/sw.js` остаётся адресом SW приложения навсегда. После активации нового воркера precache старого лендинга удаляется (`cleanupOutdatedCaches`), сайт на `/` приходит из сети. Цена — воркер стартует и на навигациях сайта (без перехвата). Если владелец выберет альтернативу (b) §2.11, kill-switch возвращается.
- **Установленные PWA.** `scope` и `id` не меняются, меняется только `start_url`. Старые установки открывают `/`: онлайн — сайт → `/app/`, офлайн — `offline-root.html` → `/app/`; навигация внутри `/app/` остаётся в окне PWA (scope `/`).
- **`base: '/app/'` и абсолютные пути.** Всё, что ссылается на `/pwa-*.png`, `/favicon.*` и прочее из `public/`, должно идти через `import.meta.env.BASE_URL`. Правило lint: строковый литерал, начинающийся с `/` и оканчивающийся на `.png|.svg|.ico|.webp`, запрещён в `apps/app/src`.
- **Session hint на сайте** — это только подсказка. Если сессия протухла, `/app/` отправит на `/app/login`, цикла нет: `/app/login` с сайта не редиректит.
- **Порядок redirect'ов**: `/group/join/:token` должен стоять раньше `/group/:path*`. Тест генератора проверяет порядок.
- **Внешний rewrite** добавляет к запросам сайта hop через edge. Кэш на CDN app-проекта включается явно (`x-vercel-enable-rewrite-caching`, §2.9; проект создан до 2026-04-06, A-34) и работает по заголовкам сайта: сайт отдаёт `Cache-Control: public, max-age=0, must-revalidate` для HTML и `immutable` для `/_astro/*`.
- **Preview-деплой app** проксирует сайт на `site-dev.chipin.one`, то есть на dev-сборку сайта, а не на preview той же ветки. Для PR, которые меняют оба приложения, сайт проверяется на собственном preview-URL.
- **Telemetry/Sentry**: шаблоны в `src/constants/telemetry.ts` маскируют токены по старым путям. В 04-2g (до cutover) они получают обе формы — старые и `/app/group/join/:inviteToken`, `/app/friends/join/:inviteToken`, `/join/group/:token`, `/join/friend/:token`, иначе после 04-4 токены утекут (связь с D1); старые формы удаляются в 04-5a.
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
- Не переносим домен на новый проект и не меняем DNS.
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
| 04-2b | Генератор артефактов + тест синхронизации; `vercel.json` и allowlist становятся сгенерированными из `hosting.base.json` (схема §1.5a; `CUTOVER = false` читается из `app-base.config.ts` — до 04-2d генератор считает его `false`; scoped headers §2.9; содержимое семантически то же) | 04-2a1 | 04-3a |
| 04-2c | Lazy i18n (`loadCommon`) + `setAppLanguage` + паритет ключей (единственный владелец lazy-load локалей) | 04-1a | 04-2b, 04-3a |
| 04-2d | `app-base.config.ts` (`CUTOVER = false`) + `app-base.config.test.ts`; `pwa.config.ts` (`buildPwaOptions`, таблица §2.11) + `pwa.config.test.ts`; единая регистрация `/sw.js` со scope `/` + политика обновления (п. 1–3; экран п. 4 за флагом до BE-03-5); `public/offline-root.html`; удаление `serviceWorkerRecovery.ts`, `swUpdates.tsx`, `PWABadge.tsx` | 04-2a2 | 04-2c |
| 04-2h | Playwright: `@playwright/test` в devDependencies `apps/app`, `apps/app/e2e/sw.spec.ts` (сценарии критерия 5), workflow `e2e-sw.yml` (`workflow_dispatch` + PR, меняющие `apps/app/src/app/pwa/**`, `app-base.config.ts`, `pwa.config.ts`; не обязательный check, `BASE_URL` = preview-деплой PR) (C1-25, C2-19) | 04-2d | 04-2e, 04-2f |
| 04-2e | Loaders с prefetch по фабрикам спеки 03 | 04-2a4, 03-5 и PR миграции соответствующих сторов (03-8…03-12) | — |
| 04-2f | Подготовка cutover, часть 1 (путь-агностично): экран `login` на `/login` (`?returnTo`, `?locale`), `requireSession` → `/login`; `SITE_PATHS` вместо `ROUTES.HOME/PRIVACY/TERMS` + lint (§2.1) | 04-2a4 | 04-2g |
| 04-2g | Подготовка cutover, часть 2: переключатели §2.1 по `CUTOVER` (`input`, prerender, `verify:public-precache`; пока в ветке `false`), `appBase.ts` (`APP_BASE`/`ROUTER_BASENAME` из `import.meta.env.BASE_URL`), `getRouterPathname`/`stripAppBase` (no-op) + lint `window.location.pathname`; telemetry-шаблоны в обеих формах; `BASE_URL` для ассетов + lint литералов `/…png\|svg\|ico\|webp`; `resolveOAuthReturnTo` в обеих формах; `public-root/` + `copy-root-files.mjs` (переезд `.well-known`); `check-built-html.mjs` | 04-2a4, 04-2d | 04-2f |
| 04-3a | `apps/site`: каркас Astro (`astro@^7.4`, `content.config.ts`), i18n + тест паритета, BaseLayout, 404, robots, sitemap, seoGuard, `astro check`; создание `chipin-site` с релизной моделью §1.5 (владелец); деплой на `site-dev.chipin.one`/`site.chipin.one` | 04-1a, 04-1b, 05-2a | 04-2* |
| 04-3b1 | Сайт: главная (5 локалей) — паритет `<title>`/description и текстов `landing.json`; theme-init из 05-3 | 04-3a, 05-3 | 04-2*, 04-3b2 |
| 04-3b2 | Сайт: legal-коллекция privacy/terms × 5 локалей + тест паритета текста: нормализованный текст старых `PRIVACY_SECTIONS`/i18n против текста собранного HTML по каждой локали (C2-35) | 04-3a | 04-2*, 04-3b1 |
| 04-3c | Сайт: `/join/group`, `/join/friend` (без аналитики + `beforeSend`-редакция в `BaseLayout`, `PUBLIC_APP_ORIGIN`) + тест равенства regex токена | 04-3a, 01-2 | 04-3b1, 04-3b2 |
| 04-3d | **Цель отката** (старая раскладка, `CUTOVER = false`): группа `preCutoverCompat` в `hosting.base.json`, которую генератор выдаёт только при `CUTOVER = false` — `/join/group/:t` → `/group/join/:t`, `/join/friend/:t` → `/friends/join/:t`, `/app/oauth/callback` → `/oauth/callback` (query сохраняется), `/app/:path*` → `/:path*` (все 302; в `dist` 04-3d нет файлов под `app/`, тест §2.9). Kill-switch не нужен (§2.11). Merge открывает окно заморозки (ниже); Promote в prod **последним** перед 04-4 | 04-2b, 04-2d, 04-2g | 04-3b1, 04-3b2, 04-3c |
| 04-4 | **Cutover — только переключения**: `CUTOVER = true` (из него — `APP_BASE`, `outDir`, SW-конфиг, `start_url`, хостинг) + `routes:generate`, `legacyRedirectStatus: 302`, новые invite-ссылки (`url.ts:46-50`), OAuth `redirect_to` на `/app/oauth/callback`. Проверка на preview до merge (критерии 5, 9, 12); merge в окне заморозки | 04-2b, 04-2d, 04-2f, 04-2g, 04-2h, 04-3b1, 04-3b2, 04-3c, 04-3d (в prod), BE-04-2 | — |
| 04-5a/b | Удаление (§5) — двумя PR: (a) public-routes + prerender + scripts, ветки `CUTOVER = false` в `vite.config.ts`/`pwa.config.ts`/генераторе и переходные id манифеста, `APP_SHELL = 'index.html'` (переименование `app.html`), старые формы telemetry-шаблонов, `legacyRedirectStatus: 301`, удаление группы `preCutoverCompat`; (b) landing/legal страницы, store, дубли | 04-4 + 7 дней без отката | спеки 02, 05 |

Откат cutover (A-03):
- **Цель отката — prod-деплой 04-3d.** На Vercel Hobby Instant Rollback возможен только на непосредственно предыдущий production-деплой. Поэтому: 04-3d — последний Promote перед 04-4; после Promote 04-4 app-проект **не промоутится**, пока не закрыто окно решения об откате (48 ч мониторинга по критерию ниже). Любой Promote в окне (в т. ч. hotfix поверх 04-4) лишает Instant Rollback цели 04-3d; после него откат = revert-PR 04-4 + Promote.
- **Окно заморозки merge (C1-07).** Без него Promote 04-4 выкатил бы всё, что влито в `master` после 04-3d, а Instant Rollback откатил бы и эти фичи. Выбрана заморозка, а не release-ветка: Promote остаётся «точный деплой `master`», второго процесса нет. От merge 04-3d до конца 48 ч после Promote 04-4 в `master` мержатся только 04-3d, 04-4 и revert-PR этого окна; остальные PR ждут (на практике 2–4 дня; PR только в `apps/site/**` и docs-only — можно, они не меняют app-деплой). Критерий 04-4: `git log --oneline <SHA 04-3d>..<SHA 04-4>` = ровно один коммит. Правило — в `DEPLOYMENT.md` (раздел «Rollback», PR 04-4) и в Issue 04-D; исключение из «no feature freeze» подтверждает владелец (`00-overview.md`).
- **Быстрый (минуты):** Instant Rollback app-проекта на 04-3d. Что получают пользователи: `/app/*` → 302 на старые пути; новые invite-ссылки `/join/group|friend/<t>` → 302 на `/group/join/<t>`, `/friends/join/<t>`; логины в процессе `/app/oauth/callback?code=…` → `/oauth/callback?code=…`; адрес SW тот же (`/sw.js`), поэтому SW 04-3d приходит обычным обновлением (prompt, принудительно ≤ 24 ч, §2.11 п. 3); до этого SW 04-4 отдаёт на `/app/…` оболочку 04-4 из precache — она работает с тем же backend, а навигации на старые пути и `/` идут в сеть (04-3d). Кэшированных 301 нет: обратимые redirect'ы 04-4 отдаются с 302 (§4.2).
- После Instant Rollback Vercel выключает auto-assign production-доменов. Возврат: «Undo Rollback» в Vercel либо Promote нового деплоя. Это правило и запрет Promote в окне записываются в `DEPLOYMENT.md` (раздел «Rollback», в PR 04-4).
- **Плановый (PR):** revert-PR 04-4 → merge → Promote. Revert возвращает `CUTOVER = false` (и с ним `APP_BASE = '/'`) и группу `preCutoverCompat`, то есть собирает эквивалент 04-3d. Отдельного «точечного» флага нет: после 04-4 приложение собрано с `base: '/app/'`, и одним флагом публичные страницы не вернуть.
- Site-проект не откатывается: без catch-all он на `chipin.one` не виден.
- Критерий отката: рост 404 или 5xx на `/app/*` или `/join/*` > 1 % за час, ошибка OAuth-логина, сайт недоступен через proxy.

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
   - `resolveOAuthReturnTo` принимает `/app/x` и `/x` и отклоняет callback в обеих формах.
4. i18n: в entry-чанке нет JSON локалей (проверка размера: entry ≤ текущего минус 200 KB raw). `changeLanguage` вне `setAppLanguage` валит lint. Тест паритета ключей зелёный.
5. SW. `pwa.config.test.ts` — таблица §2.11 для обоих `CUTOVER`. 04-2d (C2-01): собранный `dist/sw.js` — регистрация `/sw.js` со scope `/`, allowlist = нынешний, `navigateFallback` = `app.html`, офлайн-reload `/dashboard` отдаёт оболочку из precache. 04-4: `dist/sw.js` есть, в precache только `app/**` и нет HTML сайта, есть `app/offline-root.html`; `dist/app/sw.js` и `dist/app/.well-known` нет, `dist/.well-known/assetlinks.json` есть (`copy-root-files.mjs` падает при коллизии). E2E (Playwright, 04-2h, на preview 04-4 до merge): (a) зарегистрировать SW текущей prod-сборки → открыть сборку 04-4 → `navigator.serviceWorker.getRegistrations()` = одна регистрация, scope `/`, скрипт `/sw.js`, после обновления активен новый воркер; (b) офлайн-reload `/app/dashboard` — оболочка из precache; (c) офлайн-навигация на `/` (установка с `start_url: '/'`) → `/app/` с оболочкой (C3-01); (d) онлайн `/` — HTML сайта, не оболочка.
6. Сайт: `astro build` с `seoGuard` зелёный. 15 публичных URL отдают 200 с тем же `<title>` и description, что сейчас (снапшот до/после). hreflang на каждой странице указывает на все существующие переводы этой страницы (сейчас 5) и `x-default`. В sitemap 15 URL. JS на странице ≤ 30 KB gz.
7. Prod после cutover: каждая строка §4.2 проверена `curl -sI` (статус и `Location`; `/not-found` → `404`, `/manifest.webmanifest` → `200` без `Location`). Логин Google проходит с сайта и со старого `/oauth/callback`. Старая invite-ссылка `/group/join/<t>` → лендинг → кнопка → экран подтверждения → вступление.
8. QA владельца, не gate PR (C2-34): Lighthouse SEO и производительность главной не хуже базовой линии; базовая линия записывается в FE#498 до 04-3b1 (числа прикладываются в FE#496).
9. Preview PR 04-4 до merge (A-02): `curl -sI <preview>/join/group/x` показывает ровно один заголовок `Content-Security-Policy`, и в нём хеши сайта; `/` и `/ru/` — HTML сайта без `X-Robots-Tag`; `/app/dashboard` — `X-Robots-Tag: noindex, nofollow`; inline-скрипты theme-init, редиректа и `/join/*` выполняются (нет CSP-ошибок в консоли); вход Google на preview проходит. То же повторяется на `dev.chipin.one` после merge, до Promote.
10. 04-3d в prod (до 04-4): `curl -sI https://chipin.one/app/dashboard` → 302 `Location: /dashboard`; `/join/group/x` → 302 `/group/join/x`; `/app/oauth/callback?code=c` → 302 `/oauth/callback?code=c`; `/sw.js` — `200` с `Cache-Control: no-cache`. Это и есть проверка цели отката.
11. Сайт: `seoGuard` валит сборку, если HTML под `join/` содержит `_vercel/insights` или `_vercel/speed-insights` (A-15); фикстура с невалидным frontmatter валит `astro build` (A-14); скрипт главной не редиректит при `Chipin_authSessionHint = "false"` (C3-18); `/join/*` берёт сохранённую локаль и передаёт `?locale` (C3-25).
12. Deep links (C1-01): на preview 04-2g и 04-4 reload `/group/<uuid>` и `/activity/<uuid>` (после cutover — `/app/group/<uuid>`, `/app/activity/<uuid>`) даёт `200`, все JS/CSS-ассеты страницы — `200` с `text/javascript`/`text/css`, приложение отрисовано; `check-built-html.mjs` зелёный в обоих режимах.
13. 04-4 (C1-07): `git log --oneline <SHA 04-3d>..<SHA 04-4>` = один коммит; в окне заморозки нет других merge в `master`, кроме revert-PR.

## Требования к backend

**BE-04-1 (P3).** Поменять пример в `OAuthOpenApi.kt:30` на `https://chipin.one/app/oauth/callback` (документация).
**BE-04-2 (P1, до 04-4).** Подтвердить, что `OAUTH_ALLOWED_REDIRECT_ORIGINS` на prod и dev содержит `https://chipin.one` и `https://dev.chipin.one`, а `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` — имя текущего app-проекта. Новый site-проект туда добавлять не нужно, он OAuth не инициирует.
Минимальная версия клиента — не отдельный issue: контракт нового заголовка `X-Client-Version` / ответного `X-Min-Client-Version` / 426 `CLIENT.OUTDATED` задаёт BE-03-5 (спека 03 §7; проверено: версионирования API в backend нет, FE версию сейчас не шлёт). BE-03-5 включает `X-Min-Client-Version` в `Access-Control-Expose-Headers`. Обязателен до включения outbox (03-17).
~~**BE-04-3**~~ — снят (C3-24): app-header `/api/(.*)` ставит `Cache-Control: private, no-store` и `X-Vercel-Enable-Rewrite-Caching: 0`, поэтому `public, max-age=300` backend'а не действует; статистика лендинга остаётся без CDN-кэша, как сейчас. Issue chipin-backend#208 закрыть как not planned (действие координатора).

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
| PWA/offline | работает, но SW делит scope с публичными страницами | App Router и SW-offline для приватного приложения конфликтуют (RSC, серверные запросы); `next-pwa` не поддерживается | SPA-режим возможен, но prerender и SW снова в одном билде | SW приложения отдельно от сайта: precache и fallback только `/app/*`; scope `/` ради старых установок (ASSUMPTION C3-01) |
| Стоимость миграции | 0 | высокая: переписать роутинг, data-слой, auth (in-memory токен + Web Locks), стили (styled-components SSR), все тесты | средняя: перенос на `routes.ts` и route modules, тот же клубок prerender+SW | средняя: только 3 страницы × 5 локалей и раздел; приложение меняется в роутере (D6 нужен в любом варианте) |
| Риск | растёт с каждой SEO-страницей | высокий, big-bang, конфликт с D2/D3 | средний | низкий: сайт выкатывается рядом, откат на подготовленный деплой 04-3d |
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
- Обязательства: SW приложения на `/sw.js` со scope `/` бессрочно (ASSUMPTION C3-01); redirect'ы старых URL бессрочно; app-проект не переименовывать (OAuth preview allowlist).
- Пересмотр: если сайту понадобятся персонализированные или серверные страницы (например, превью приглашения с именем группы), рассмотреть Astro `output: 'server'` для отдельных маршрутов на Vercel, не меняя приложение.

## Открытые вопросы

1. ASSUMPTION: backend не отправляет пользователям URL фронта (писем, push и Telegram нет; grep `chipin-backend/src/main` 2026-10-28). Если есть внешний канал (KB, бот, шаблоны в Slack), его ссылки нужно добавить в §4.2.
2. ASSUMPTION: prod- и dev-значения `OAUTH_ALLOWED_REDIRECT_ORIGINS` и `OAUTH_ALLOWED_VERCEL_PREVIEW_PROJECTS` в окружении backend совпадают с тем, что ожидает §4.4 (в репо только дефолт `http://localhost:3000`). Владелец проверяет до фазы 4.
3. ASSUMPTION (owner decision C3-01): SW приложения — `/sw.js` со scope `/` бессрочно, kill-switch и смены scope нет (§2.11). Альтернатива (b) — SW по букве D8 на `/app/` с потерей офлайн-запуска у текущих установок до переустановки. По умолчанию — рекомендуемый вариант.
4. Решено (D19, вариант A, подтверждено владельцем 2026-10-28): сейчас — только принудительное обновление SW через 24 ч; до включения outbox — BE-03-5 (`X-Client-Version` + `MIN_CLIENT_VERSION` → 426) и 03-20, правило 72 ч.
5. Решено (D18, подтверждено владельцем 2026-10-28): Vercel Analytics и Speed Insights остаются; изолированы по §1.5a; уход с Vercel — отдельное исследование.
6. Решено (D22, подтверждено владельцем 2026-10-28): поддомены `site.chipin.one` и `site-dev.chipin.one`; custom-домены на Hobby бесплатны.
