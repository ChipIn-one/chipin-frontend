# Spec 05: стили, токены, тёмная тема, ассеты

Решения владельца: D14 (стили), D16 (ассеты, vendor regex), D7 (`packages/tokens`), D8 (Astro-сайт использует токены).
Опирается на DS v1: `docs/superpowers/specs/2026-10-22-design-system-v1-design.md` (на master с 01312ea).
Решения DS v1 не пересматриваются, кроме перечисленных в разделе «Изменения относительно DS v1».
Идентификаторы PR — `05-<n>` (глобальная схема, `00-overview.md`). Отклонений от DECISIONS нет; отклонения от DS v1 — в отдельном разделе.

**Порядок относительно монорепо (04-0):** 05-1 — до или после 04-0 (работает в `src/`); 05-2…05-7 — только после 04-0 (нужны npm workspaces). Кодмод 05-4 идёт после 04-0, чтобы не конфликтовать с rename.
**Владение пересекающимися темами:** vendor-regex и удаление `dexie` — 02-B1; lazy-load локалей — 04-2c; регистрация SW (`PWABadge`) — 04-2d; ESLint-конфиг и хелпер `restrictedImports()` — 02-C4; boundaries — 02-C9; jsx-a11y — 02-C8; алиасы ds-gallery — 02-C3; typecheck ds-gallery — 02-C5. Эта спека — единственный владелец `packages/tokens`, next-themes, stylelint, styled allowlist и `no-raw-colors`.

## Цель

1. Один источник токенов для app, Astro-сайта и ds-gallery: `packages/tokens/tokens.json` (DTCG). Из него генератор строит `tokens.css` и `tokens.ts`.
2. Один механизм тёмной темы.
   - Сейчас их 4. Нужен один: значение в store → класс на `<html>` → `<Theme appearance>`.
   - Без мигания при загрузке (FOUC).
3. Вывести `styled-themes.ts` и `themeColor()`.
   - styled-components больше не растёт: правка файла означает перевод на CSS Modules, новых импортов нет. Всё это проверяют lint и CI.
4. Чёткая граница между `basics` и `components`.
5. Меньше Radix CSS, исправлен vendor-чанк, ассеты подготовлены под офлайн-PWA (D2).
6. Агент должен однозначно знать, куда добавить цвет, где менять тему и чем стилизовать.

## Контекст (ссылки на аудит)

- Палитра поставляется дважды.
  - `src/constants/styled-themes.ts:1-269` импортирует 31 шкалу из фантомного `@radix-ui/colors`.
  - Используется через `themeColor()` (`src/helpers/colors.ts:5-8`): 21 файл, около 62 вызовов, 15 шкал.
  - Это около 126 KB исходника в чанке `useScrollToTop` (`05-deps-styling.md`, finding 1).
- Расхождение серых.
  - `<Theme grayColor="olive">` (`src/main.tsx:43`, `src/public-routes/PublicApp.tsx:66`, `ds-gallery/gallery.tsx:403`).
  - При этом `themeColor('gray11')` отдаёт чистый серый hex.
  - Внутри `.radix-themes` переменная `--gray-N` переназначается на olive (`@radix-ui/themes/tokens/base.css:951`). Поэтому styled-поверхности сейчас выбиваются из темы.
- Тёмная тема реализована 4 способами (finding 8):
  - `next-themes` в `src/root.tsx:57-63`. Читатели: `main.tsx:31`, `components/DevMenu.tsx:35`, `components/ThemeSwitcherDev.tsx:10`, `hooks/useSyncUserSettings.tsx:16,23`;
  - `useSyncExternalStore` в `PublicApp.tsx:24-50`;
  - `<Theme>`, продублированный в 3 файлах;
  - styled `ThemeProvider`.
  - Кроме того, `global-error-boundary/styles.css:12-18` зависит от классов `.light`/`.dark`.
- Radix CSS: `vendor-radix.css` весит 683 KB raw / 80 KB gz из-за полного импорта `@radix-ui/themes/styles.css` (`src/root.tsx:20`). `tokens.css` внутри него весит 177 KB (finding 5).
- Слой `basics`:
  - `basics/RelativeTime.tsx:6` импортирует store;
  - `basics/BalanceBadges.tsx:8` импортирует `components/skeletons`;
  - `basics/PWABadge.tsx` имеет сайд-эффект (регистрация SW).
  - 6 тонких обёрток (finding 7).
- Ассеты:
  - `src/assets/dashboard-onboarding.png`: 354 KB, 1254×1254, показывается в ≈352 px, попадает в precache (`vite.config.ts:198`);
  - `src/assets/apple-icon.svg` не используется;
  - иконки PWA пересоздаются при каждой сборке (`package.json:8,17`).
- Regex `vendor-react` (`vite.config.ts:263`) не ловит `react-router`, поэтому появляется анонимный чанк в 41 KB (чинит 02-B1, не эта спека).
- В DS v1 реализовано 0% (`05-deps-styling.md`, «Plan vs reality»). Попаданий палитровых имён: 83.

## Решение

### 1. `packages/tokens`

Структура (имя пакета `@chipin/tokens` — по раскладке спеки 04 §1.1; все файлы ниже новые):

```
packages/tokens/
  package.json            # private, без build-шага для потребителей; exports: ./tokens.css, ./radix-colors.css,
                          # ./tokens (ts), ./theme-init (ts), ./assets/*
  tokens.json             # ИСТОЧНИК ПРАВДЫ, DTCG 2025.10 ($type, $value, алиасы, режимы light/dark)
  scripts/build-tokens.mjs  # генератор (~120 строк, без зависимостей): tokens.json -> generated/*
  scripts/check-tokens.mjs  # tokens:check — см. «Проверки»
  generated/tokens.css    # НЕ РЕДАКТИРОВАТЬ: --cp-* для light и dark
  generated/tokens.ts     # НЕ РЕДАКТИРОВАТЬ: RADIX_THEME, RADIX_PALETTES, PROP_COLOR, тип CpToken
  generated/manifest-colors.json  # НЕ РЕДАКТИРОВАТЬ: { theme_color, background_color } в hex (D23, п. 6)
  src/radix-colors.css    # 22 @import шкал Radix (см. п. 5); список сверяется с RADIX_PALETTES
  src/theme-init.ts       # строка inline-скрипта против FOUC + её sha256 (п. 2)
  assets/logo.svg, assets/favicon.svg   # бренд-марки (перенос из src/assets и public/)
```

**Уровни в `tokens.json`** (те же, что в DS v1, «Token levels»):

1. Примитивы — алиасы шкал Radix (`grass.1..12`, `olive.1..12`, alpha) и литералы:
   - `space.1..9` = 4, 8, 12, 16, 24, 32, 40, 48, 64 px (равно Radix при scaling 100%);
   - `radius.1..6` = 4.5, 6, 9, 12, 18, 24 px (база Radix × factor 1.5 для `radius="large"`) и `radius.pill` = 9999px;
   - `font.family.sans` = стек `--default-font-family` из Radix (системный шрифт, webfont нет);
   - `font.size.1..9` = 12, 14, 16, 18, 20, 24, 28, 35, 60 px; `font.weight.{regular 400, medium 500, bold 700}`;
   - `shadow.{card,popover}` из `olive.a*` и `rgba` (литерал допустим только в tokens.json);
   - `z.{content 0, raised 1, floating 2}` — сейчас в коде только эти значения; модальным окнам слои задают порталы Radix;
   - `motion.duration.{fast 120ms, base 160ms}`, `motion.easing.{standard ease, out ease-out}` (сейчас в коде 120/150/160 ms, 150 сводится к 160);
   - `brand.loader` = `#80c837` (литерал из `basics/ChipInLoader.tsx:10`, сохраняет вид);
   - `brand.primary` = алиас `grass.9` (D23) — единственный источник главного цвета бренда.
2. Семантика с режимами light/dark: `color.text.*`, `color.surface.*`, `color.border.*`, `color.fill.*`, `color.accent.*`, `color.status.*`, `color.debt.{owed,owing,settled}`, `color.selection.*`, `color.focus.ring`, `color.media.*`.
3. Компонентные токены — минимум, только то, что нужно для кодмода (таблица в «Деталях»): `fab.border*`, `nav.highlight*`, `logo.mode.*`, `avatar.placeholder.*`, `landing.*`.

**Что выдаёт генератор:**

- `generated/tokens.css`. Каждый токен становится `--cp-<путь через ->`: `color.text.secondary` → `--cp-text-secondary` (префикс `color.` отбрасывается), `space.3` → `--cp-space-3`.
  - Цвета ссылаются **на конкретную шкалу**: `--cp-text-secondary: var(--olive-11)`. Ссылки на `--accent-*` и `--gray-*` запрещены. Причина:
    - `--accent-*` существует только внутри `.radix-themes`, а на Astro-сайте Radix Themes нет;
    - custom property, объявленная на `:root`, вычисляет `var()` в месте объявления и при ссылке на несуществующую переменную становится invalid.
  - Селектор объявления: `:root, .light, .light-theme, .dark, .dark-theme`. Так токен пересчитывается во вложенной теме, например в `<Theme appearance="dark">` внутри светлой страницы.
  - Режим `dark` в tokens.json нужен только там, где значение отличается не одной шкалой. Шкалы Radix и так переключаются по `.dark`.
- `generated/tokens.ts`:
  - `RADIX_THEME = { accentColor: 'grass', grayColor: 'olive', radius: 'large', panelBackground: 'solid', scaling: '100%' } as const`;
  - `PROP_COLOR = { debtOwed: 'green', debtOwing: 'red', debtSettled: 'gray', danger: 'red', warning: 'amber', ... } as const` — роли для `color`-пропсов Radix, которые не принимают CSS-переменные;
  - `RADIX_PALETTES` — список шкал, которые импортирует `radix-colors.css`;
  - тип `CpToken` — union имён `--cp-*`.
- `generated/manifest-colors.json` (D23): `theme_color` = `brand.primary` (= `grass.9`, light), `background_color` = роль фона `color.surface.base` (light). Генератор разрешает алиасы в hex — это единственное место, где hex бренда появляется вне `tokens.json`.

**Подключение в app** (`apps/app/src/styles/index.css`, единственный CSS-вход, импортируется из `root.tsx` вместо `@radix-ui/themes/styles.css`):

```css
@import '@radix-ui/themes/tokens/base.css';
@import '@chipin/tokens/radix-colors.css';
@import '@radix-ui/themes/components.css';
@import '@radix-ui/themes/utilities.css';
@import '@chipin/tokens/tokens.css';
@import './radixStylesOverwrite.css';
```

`<Theme>` настраивается ровно в одном месте: `apps/app/src/design-system/AppTheme.tsx`. Это `<Theme {...RADIX_THEME} appearance={appearance} hasBackground>`; `appearance` приходит пропом (store читает вызывающий), поэтому `design-system/` — уровень `basics` в графе слоёв (спека 02 Д5). Его используют `main.tsx` и ds-gallery. `PublicApp.tsx` использует `RADIX_THEME` до своего удаления в spec 04.

**Подключение в Astro** (`apps/site`, spec 04): в базовом layout

```css
@import '@chipin/tokens/radix-colors.css';
@import '@chipin/tokens/tokens.css';
```

- Без `base.css`/`components.css`, так как в D8 нет Radix Themes.
- `@radix-ui/themes` ставится в site только как devDependency ради CSS-файлов шкал, JS не попадает в бандл.
- Для сайта используются только `--cp-*`, включая `--cp-space-*`, `--cp-radius-*`, `--cp-font-*`.

**Olive против gray: выбран olive** (решение DS v1, owner decision 3).

- Визуальный эффект. Поверхности из 21 styled-файла переходят с нейтрального серого на olive со слабым зелёным оттенком:
  - `gray-11 #646464` → `olive-11 #60655f`;
  - `gray-6 #d9d9d9` → `olive-6 #d7dad7`;
  - `gray-12 #202020` → `olive-12 #1d211c`.
- Разница ΔE около 1–2: на глаз заметна только рядом с чистым серым, то есть именно на нынешних стыках styled-кода и Radix-компонентов.
- 198 файлов на Radix Themes уже olive и не меняются.
- Обратный выбор (`grayColor="gray"`) изменил бы весь интерфейс.
- Флаг для владельца: см. «Открытые вопросы».

### 2. Тёмная тема: один механизм

- **Store.** `src/store/ui-prefs/appearanceStore.ts` (Zustand, UI-состояние по D3; путь закреплён спекой 03 §6: UI-сторы живут в `src/store/ui-prefs/`):
  - `preference: 'light' | 'dark' | 'system'`, `resolved: 'light' | 'dark'`, `setPreference(p)`;
  - хранение в localStorage, ключ `LS_KEY_THEME` (`Chipin_theme`), через `helpers/localStorage.ts`;
  - значение — сырая строка: тот же формат, что писал next-themes, поэтому пользователи не теряют выбор.
- **Применение.** `applyAppearance(resolved)` ставит на `<html>` класс `light` или `dark` (второй убирает) и `style.colorScheme`. Класс выбран вместо `[data-theme]`, потому что файлы шкал Radix сами переключаются по `.dark, .dark-theme`. `<Theme appearance={resolved}>` и `<Toaster theme={resolved}>` читают тот же `resolved`.
- **System.** При `preference === 'system'` store подписывается на `matchMedia('(prefers-color-scheme: dark)')` и обновляет `resolved`. Подписка снимается при смене preference.
- **Источник предпочтения.**
  - `useSyncUserSettings` вызывает `setPreference(settings.theme)`, когда приходят серверные настройки.
  - Если серверных настроек нет, действует локальный ключ.
  - Разовая миграция при инициализации store: если ключа нет, а у `getLocalUser()?.settings.theme` значение есть, оно записывается в ключ. Это заменяет `resolveStoredTheme` в `root.tsx:59`.
  - Эту ветку удалить через 2 релиза (Issue создаётся в PR 05-3).
- **FOUC.** `packages/tokens/src/theme-init.ts` экспортирует `THEME_INIT_SCRIPT`, IIFE около 12 строк в try/catch:
  - читает `localStorage['Chipin_theme']`;
  - `dark` или (`system`/нет значения и `matchMedia` dark) → класс `dark`, иначе `light`;
  - при исключении → `light`.
  - Vite-плагин в `apps/app/vite.config.ts` (`transformIndexHtml`, 10 строк) вставляет скрипт первым элементом `<head>` в `app.html`. Astro вставляет его так: `<script is:inline set:html={THEME_INIT_SCRIPT} />`.
  - CSP: в `script-src` добавляется `'sha256-<hash>'`. Тест `theme-init.test.ts` считает хеш и проверяет, что он есть в сгенерированном `vercel.json` (D6). При расхождении тест печатает ожидаемое значение.
  - Ключ продублирован в строке скрипта. Тест проверяет, что строка содержит `LS_KEY_THEME`.
- **Удаляется:**
  - `next-themes` (dependency) и `ThemeProvider` в `root.tsx`;
  - `useTheme` в 4 файлах (`main`, `DevMenu`, `ThemeSwitcherDev`, `useSyncUserSettings`) и их тестовые моки;
  - `isThemeDark`, `resolveStoredTheme` из `helpers/theme.ts`.
  - `isPreferredPublicThemeDark` и логика `PublicApp.tsx:24-50` удаляются вместе с `public-routes/` в spec 04. Здесь их не трогаем.

### 3. Вывод styled-components из оборота

**Кодмод `themeColor()` → `var(--cp-*)`.**

- Скрипт `scripts/codemods/theme-color-to-vars.mjs` выполняется один раз и удаляется в том же PR.
- Он заменяет `${themeColor('k')}` на `var(--cp-…)`, а голый `themeColor('k')` в выражении — на `'var(--cp-…)'`.
- Динамические вызовы (`AddExpenseButton.tsx:17`, `desktop-sidebar/styled.ts:12`, `interactiveCardStyles.ts:41-56`) правятся вручную по таблице в «Деталях».
- В тех же файлах заменяются `var(--space-N)` → `var(--cp-space-N)` и `var(--radius-N)` → `var(--cp-radius-N)` (98 мест, 1:1 по значению), а также 14 прямых `var(--<palette>-N)`.

Затем удаляются:

- `src/constants/styled-themes.ts`;
- `src/helpers/colors.ts` (`hexToRgba` не используется);
- `src/types/styled.d.ts`;
- `<ThemeProvider>` styled-components в `main.tsx`, `PublicApp.tsx` и `ds-gallery/gallery.tsx`.

Фантомный `@radix-ui/colors` попадает в `no-restricted-imports`.

**Правило «нет новых styled-components».**

- `config/eslint/styled-components-allowlist.json` генерируется один раз скриптом `scripts/generate-styled-allowlist.mjs` из текущих импортёров (55 не-тестовых файлов + тесты, которые импортируют `styled-components`).
- `no-restricted-imports` для `styled-components` действует на `src/**`, `ds-gallery/**`, а для файлов из allowlist выключен.
- Ловушка flat config: одноимённое правило в более позднем блоке **заменяет** опции, а не объединяет их. Поэтому все блоки `no-restricted-imports` строятся через общий хелпер `restrictedImports(extraPaths, extraPatterns)` из `config/eslint/project.js`, иначе пропадут ограничения на axios и api (`eslint.config.js:143-210`). Рефакторинг конфига и хелпер `restrictedImports()` — спека 02 (PR 02-C4); 05-5 от него зависит и только добавляет свои пути.
- `scripts/check-styled-allowlist.mjs` (в `lint`, около 60 строк):
  1. каждая запись существует и всё ещё импортирует `styled-components`, иначе ошибка «удали запись»;
  2. число записей ≤ числа в `git show $BASE_SHA:config/eslint/styled-components-allowlist.json` (только уменьшение). Скрипт принимает `--base "$BASE_SHA"` (CI экспортирует его в шаге «Resolve verification mode»; ref `origin/master` в CI нет); локально по умолчанию `git merge-base HEAD origin/master` (A-19);
  3. правило касания: если в PR изменён файл из allowlist и это `**/styled.ts` либо в добавленных строках есть `styled[.(]`, `` css` ``, `` keyframes` ``, `createGlobalStyle`, то файл обязан уйти из allowlist, то есть быть переведён на CSS Modules. Не считается касанием diff, в котором все изменённые строки — `import …`/`export … from …` (codemod'ы 02-D2/02-D3 меняют импорты в 31 `styled.ts`, A-18);
  4. исключение — запись в `config/eslint/styled-touch-exempt.json` (`{path, reason, issue}`) в том же PR. Записи без `issue` — ошибка.

**Конвенции CSS Modules.**

- Файл `Component.module.css` лежит рядом с `Component.tsx`. Один модуль на компонент. Модули, общие для нескольких компонентов, запрещены. Для общего стиля нужен компонент.
- Импорт: `import styles from './Component.module.css'`. Default-импорт CSS-модуля не нарушает D11, потому что правило касается экспортов.
- Имена классов camelCase. Корневой класс — `.root`, части — `.header`, `.amount`.
- Состояния и варианты задаются data-атрибутами (`data-active`, `data-variant="solo"`), а не условными классами. CSS: `.root[data-variant='solo']`.
- Внешний `className` склеивается хелпером `src/helpers/cx.ts` (5 строк, без зависимости).
- `composes:` разрешён только из того же файла.
- Vite: `css.modules = { localsConvention: 'camelCaseOnly', generateScopedName: dev ? '[name]__[local]' : '[hash:base64:6]' }`. Тесты не проверяют имена классов.
- Брейкпоинты задаются литералами, равными Radix: `min-width` 520/768/1024/1280/1640px, `max-width` на 0.02px меньше. Проверяет stylelint `media-feature-name-value-allowed-list`. `@custom-media` не используем: нужен ещё один плагин, а определения видны только внутри файла.
- Глобальные стили допустимы только в `apps/app/src/styles/*.css`. `createGlobalStyle` из `overlay-layout/styled.ts:7` переносится в `styles/modal-overlay.css` при касании.

**Сначала пропсы Radix** (порядок выбора; правило дублируется в новом `docs/design-system/process.md` (создаётся задачами DS v1)):

1. Пропсы компонента Radix: `size`, `variant`, `color` (только через `PROP_COLOR`), `highContrast`, `radius`.
2. Layout-пропсы `Box`/`Flex`/`Grid`/`Text`: `p`, `m`, `gap`, `width`, `display`, адаптивные объекты `{ initial, xs, sm }`.
3. CSS Module с `--cp-*` — только для того, чего нет в пропсах: градиенты, псевдоэлементы, `:has`, transitions, `position: fixed` и safe-area, сложный grid, кастомные переменные компонентов Radix.
4. Запрещено:
   - селекторы `.rt-*` вне `styles/radixStylesOverwrite.css`;
   - `style={{…}}` с обычными свойствами. Разрешены только кастомные свойства (`style={{ '--cover-url': url }}`). ESLint: `no-restricted-syntax` по `JSXAttribute[name.name='style'] ObjectExpression > Property[key.type='Identifier']`. Существующие 6 мест в 2 файлах переводятся в PR 05-5.

**Запрет хардкода (D23: никакого hex/rgb вне `packages/tokens`; stylelint для `*.css` и `<style>` в `*.astro` в apps/*; `packages/tokens` исключён).**

Новые devDeps: `stylelint`, `stylelint-value-no-unknown-custom-properties`. Правила:

- `color-no-hex`, `color-named: 'never'`;
- `function-disallowed-list: [rgb, rgba, hsl, hsla, hwb, lab, lch, oklch, color]`;
- `declaration-property-value-disallowed-list: { '/.*/': ['/var\\(--(?!cp-|_)/'] }` — в CSS только `--cp-*` и локальные `--_*`;
- `csstools/value-no-unknown-custom-properties` с `importFrom: packages/tokens/generated/tokens.css` (ловит опечатки агентов);
- `unit-disallowed-list: ['px', { ignoreProperties: { px: ['/^border/', '/^outline/', 'box-shadow'] }, ignoreMediaFeatureNames: { px: ['min-width', 'max-width'] } }]`;
- `selector-disallowed-list: ['/\\.rt-/']`, исключение — `radixStylesOverwrite.css` через `overrides`;
- `reportDescriptionlessDisables: true`.

Исключения из D23 «нет raw hex» (A-29; записываются как дополнение к D23 и выносятся владельцу в `00-overview.md` п. 30): `brand.loader #80c837` и `media-on/scrim #fff/#000` живут только в `tokens.json` (вне его hex нет), и файл `components/global-error-boundary/styles.css`. Исключение файлом: `components/global-error-boundary/styles.css`. Он намеренно использует системные цвета и fallback-hex, потому что обязан отрисоваться даже без загруженного CSS приложения. Его `.light`/`.dark` продолжают работать от класса на `<html>`.

Для TS/TSX (все файлы, включая замороженные styled и `vite.config.ts`) и frontmatter `*.astro` действует ESLint `no-raw-colors` из DS v1 (rule 1): hex/rgb/hsl и `var(--<palette>-N)` — ошибка; `packages/tokens/**` исключён. Реализация (A-17) — без своего плагина: блок `no-restricted-syntax` в `config/eslint/project.js` (через хелпер `restrictedSyntax()` из 02-C4) с двумя селекторами по одному regex `RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|var\(--(?!cp-|_)[a-z]+-a?\d+\)/`: `Literal[value=RAW_COLOR]` и `TemplateElement[value.raw=RAW_COLOR]` (styled-шаблоны), сообщение «use var(--cp-*) from @chipin/tokens». Фикстуры: `'#fff'`, `` `color: rgb(0 0 0)` ``, `'var(--gray-11)'` — 3 ошибки; `'var(--cp-text-primary)'` — 0. Для CSS и `<style>` в `.astro` — stylelint ниже (`color-no-hex`, `function-disallowed-list`, `declaration-property-value-disallowed-list`). Оба вводит 05-5. Stylelint для `.astro` — через `postcss-html` (`customSyntax`). `no-palette-theme-keys` не нужен (см. «Изменения»).

### 4. Граница `basics` и `components`

**Определение** (кладётся в новый `docs/design-system/components.md` и проверяется boundaries-правилом из спеки 02 (02-C9), D13):

- `basics/` — презентационные компоненты: только props → JSX.
  - Импортировать можно React, Radix, lucide, i18n, `helpers/*`, `@chipin/tokens` и другие `basics`.
  - Нельзя `store/*`, `api/*`, `components/*`, `features/*`, `pages/*`, а также сайд-эффекты (SW, подписки, таймеры, кроме анимации).
- `components/` — композиции, которым разрешено читать stores и хуки приложения.
- Презентационный компонент без store, используемый в 2 и более фичах, живёт в `basics`.

**Нарушения и исправления:**

| Файл | Нарушение | Действие |
|---|---|---|
| `basics/RelativeTime.tsx` | `store/users-store` (24h-формат) | перенос в `components/RelativeTime.tsx`, обновить 8 импортов в `features/activity/**` |
| `basics/BalanceBadges.tsx` | `components/skeletons` | `components/skeletons/BalanceBadgesSkeleton.tsx` (store не читает) переносится в `basics/skeletons/BalanceBadgesSkeleton.tsx` |
| `basics/PWABadge.tsx` | сайд-эффект регистрации SW | **не переносим** здесь: остаётся в baseline boundaries до 04-2d, который заменяет его на `src/app/pwa/ServiceWorkerManager.tsx` |

**Тонкие обёртки Radix** (DS v1: не оборачивать). Критерий: обёртка, которая только задаёт дефолты, удаляется. Обёртка, которая фиксирует решение ChipIn (размер, data-API, используемый в 3+ местах, нормализация значения), — это ChipIn-компонент с карточкой (DS v1 сам перечисляет SegmentedControl/Select/Dropdown/ProgressBar среди карточек).

| Обёртка | Строк / потребителей | Действие |
|---|---|---|
| `basics/Checkbox.tsx` | 21 / 1 | **удалить**: прямой `Checkbox` из Radix, `color='grass'` берётся из accent, `size='2'` — это дефолт |
| `basics/RadioGroup.tsx` | 29 / 1 | **удалить**, развернуть в единственном месте использования |
| `components/SegmentedControl.tsx` | 26 / 6 | **оставить**, перенести в `basics/`: фиксирует адаптивный size `{initial:'2', sm:'3'}` |
| `components/Select.tsx` | 91 / 2 + gallery | **оставить**, перенести в `basics/`: items/render-API |
| `components/Dropdown.tsx` | 135 / 4 + gallery | **оставить**, перенести в `basics/`: sections-API |
| `components/progress-bar/ProgressBar.tsx` | 31 / 1 | **оставить**, перенести в `basics/`: ограничивает value |

Перенесённые файлы сразу переходят на именованный экспорт (D11), потому что их импорты всё равно меняются.

**A11y-база для кастомных примитивов** (всё, что не является прямым компонентом Radix):

1. Используется нативный элемент (`button`, `a`, `label`, `input`) или примитив Radix. Кликабельные `div`/`span` запрещены (jsx-a11y из спеки 02, 02-C8).
2. Видимый фокус: `:focus-visible { outline: 2px solid var(--cp-focus-ring); outline-offset: 2px; }`. Убирать `outline` без замены запрещено.
3. У каждого контрола есть доступное имя. Для icon-only это `aria-label` через i18n.
4. Состояние передаётся атрибутом (`aria-pressed`, `aria-current`, `aria-expanded`, `aria-invalid`), а не только цветом.
5. Зона нажатия на мобильных не меньше 44×44 CSS px.
6. Текст: только `--cp-text-*` (шкалы 11–12) на `--cp-surface-*` (1–3). Контраст от 4.5:1 гарантирует Radix.
7. Анимации на `--cp-duration-*`. В `tokens.css` есть блок `@media (prefers-reduced-motion: reduce)`, который обнуляет длительности.

В PR 05-6 по этим пунктам проверяются 3 непроверенные кнопки из аудита: `SummaryCardButton`, `InviteActionButton`, `NavButton`.

### 5. Размер Radix CSS и чанки

- `@radix-ui/themes/styles.css` заменяется на 4 импорта из п. 1.
- `packages/tokens/src/radix-colors.css` импортирует 22 шкалы — все, что встречаются в коде, включая цвета категорий из `constants/category-ui.ts`:
  `amber blue brown crimson cyan gold grass gray green indigo jade mint olive orange pink purple red sky teal tomato violet yellow` (`@import '@radix-ui/themes/tokens/colors/<name>.css';`).
- Не импортируются 9: `bronze iris lime mauve plum ruby sage sand slate`. Экономия около 44 KB raw.
- Поправка к аудиту. Оценка 120–140 KB исходила из 8 палитр и не учитывала категории, которые используют 17 палитр. `base.css` (47 KB) содержит accent-маппинг для всех 31 цвета, и урезать его можно только форком — не делаем.
- `components.css`/`utilities.css` нужны целиком: на них работают адаптивные пропсы.
- Защита: `tokens:check` ищет в `src/**` литералы имён палитр Radix в JSX/TS (`color="x"`, `color: 'x'`) и падает, если палитры нет в `RADIX_PALETTES`. Без этой проверки отсутствующая шкала молча отрисуется прозрачной.
- `RADIX_PALETTES` задаётся в `tokens.json` (`$extensions.chipin.radixPalettes`). Проверка сверяет этот список с `radix-colors.css`.
- Vendor regex и `vendor-misc` без `dexie` — PR 02-B1 (единственный владелец). Здесь не трогаем.
- Ленивую загрузку локалей делает спека 04 (04-2c). Здесь не трогаем.

### 6. Ассеты

- `dashboard-onboarding.png` → `dashboard-onboarding.webp`, 704×704 (2× от 352 px), q80, цель ≤ 40 KB.
  - Конвертация один раз через `cwebp -resize 704 704 -q 80` (libwebp). Результат коммитится, в сборке зависимости нет (`sharp` удаляется по D16).
  - Сырой `<img>` в `DashboardOnboarding.tsx:52-62` заменяется на `basics/Image` с `alt=""` и `aria-hidden`.
  - Так же `group-invite-empty-state.png` (9.8 KB) → WebP.
  - `globPatterns` в precache сейчас `js,css,html,svg,png,ico` (`vite.config.ts:198`), то есть `webp` (включая существующий `auth-shared-expenses.webp`) офлайн недоступен. **05-1 сам добавляет `webp`** в `globPatterns` (одна строка); 04-2d переносит паттерн без изменений.
- `src/assets/apple-icon.svg` удаляется (0 ссылок).
- `logo.svg` и `favicon.svg` переносятся в `packages/tokens/assets/`.
  - App импортирует `@chipin/tokens/assets/logo.svg?react` (svgr).
  - Astro импортирует SVG-компонентом.
  - Раздача на общем домене (спека 04 §3.6): сайт ставит `<link rel="icon">` на `@chipin/tokens/assets/favicon.svg?url`, иконки манифеста PWA — `/app/…` из app-проекта (A-28). Источник для `pwa-assets.config.ts:8` — `packages/tokens/assets/favicon.svg`.
- Иконки PWA больше не пересоздаются на каждой сборке: `create-pwa-icons` убирается из `build`/`vercel-build`, запуск вручную — спека 02 (02-B1, `icons:generate`). Здесь только меняется путь к исходнику.
- `theme_color: '#3e9b4f'` (`vite.config.ts:149`) — это ровно `grass-10` Radix (`@radix-ui/themes/tokens/colors/grass.css`: `--grass-10: #3e9b4f`; A-24, прежний текст «не совпадает ни с одной ступенью» неверен).
  - D23 (принято владельцем 2026-10-28): `manifest` в `vite-plugin-pwa` (`theme_color`, `background_color`) и `<meta name="theme-color">` в `app.html` (через тот же `transformIndexHtml`-плагин, что theme-init) читаются из `@chipin/tokens/generated/manifest-colors.json`; Astro-сайт (`BaseLayout`) читает тот же файл. Литералов цвета в `vite.config.ts`, `app.html` и `.astro` нет.
  - Видимое изменение: цвет статус-бара PWA на Android (`#3e9b4f` → grass-9 `#46a758`) — принято в D23, но на ложной посылке. Флаг владельцу (`00-overview.md` п. 26): `brand.primary` = алиас `grass.10` сохраняет нынешний цвет без видимого изменения; по умолчанию остаётся grass-9 (D23, совпадает с `accent-solid`).
  - Главный цвет бренда одинаков в styled-коде (`var(--cp-*)`), Radix `<Theme accentColor>` (`RADIX_THEME`), PWA-манифесте/`theme-color` и на сайте, потому что все четыре выводятся из одного токена `brand.primary` в `tokens.json`; расхождение ловит `tokens:check` (п. 5 «Проверок»).
- Иконки: все UI-иконки берутся из `lucide-react` именованным импортом (размер задаётся пропом `size`, цвет — `currentColor`). svgr используется только для бренд-марок и логотипов третьих сторон: `logo.svg` и `google-icon.svg`.
  - ESLint: `no-restricted-imports` с паттерном `regex: '\\.svg\\?react$'` и allowlist из 3 файлов (`Footer.tsx`, `mode-logotype/styled.ts` или его будущий модуль, `AuthButtons.tsx`).
  - Новые SVG-иконки рисовать запрещено. Если в lucide нет нужной иконки, решает владелец.

### 7. ds-gallery

- Получает токены ровно так же, как приложение:
  - импортирует `apps/app/src/styles/index.css`;
  - оборачивается в `AppTheme`;
  - тему переключает через `appearanceStore.setPreference`.
- `ThemeProvider` и `styled-themes` удаляются (`gallery.tsx:28,402`). Ручной список алиасов в `ds-gallery/vite.config.ts` удаляет 02-C3 (не эта спека).
- Раздел «Tokens»: таблица образцов всех `--cp-*` цветовых ролей в light/dark. Строится из `generated/tokens.ts`, поэтому новый токен появляется в галерее автоматически.
- **Visual regression harness — нет.** Это YAGNI: DS v1 (owner decision 4) запрещает облачные VR-инструменты, а локальный Playwright с фикстурами данных для одного разработчика стоит дороже пользы. Галерея остаётся местом ручной сверки до/после на уровне компонентов. Автоматический VR — follow-up DS v1, не этот spec.

## Детали

**Таблица кодмода** (ключ `themeColor` → роль → значение в tokens.json). 15 шкал: gray, grayA, grass, grassA, green, jade, jadeA, mint, violet, violetA, red, redA, amber, amberA, white/black.

| Ключ | Роль `--cp-*` | Алиас |
|---|---|---|
| gray1 / gray2 / gray3 | surface-base / surface-subtle / surface-muted | olive-1 / 2 / 3 |
| gray6 / gray8 | border-default / border-strong | olive-6 / 8 |
| gray10 / gray11 / gray12 | text-muted / text-secondary / text-primary | olive-10 / 11 / 12 |
| grayA2 / grayA3 | fill-hover / fill-pressed | olive-a2 / a3 |
| grayA6 / grayA8 / grayA9 | border-translucent / border-translucent-strong / fill-scrim | olive-a6 / a8 / a9 |
| grass3 / grass7 / grass9 | accent-surface / fab-border / accent-solid | grass-3 / 7 / 9 |
| grassA8 | focus-ring | grass-a8 |
| green2 / green5 | landing-cta-to / landing-cta-from | green-2 / 5 |
| green4 | nav-highlight | green-4 |
| green6 | border-brand (Header), landing-step-marker (how-it-works) | green-6 |
| jade7 | selection-border-subtle; в градиенте `user-avatar-modal/styled.ts:10` — avatar-placeholder-from | jade-7 |
| jade8 / jade9 | selection-border / selection-solid | jade-8 / 9 |
| jade11 | landing-preview-gradient-to | jade-11 |
| jadeA2 / jadeA3 | selection-surface / selection-surface-hover | jade-a2 / a3 |
| mint7 | avatar-placeholder-to | mint-7 |
| violet4 / violet7 | nav-highlight-solo / fab-border-solo | violet-4 / 7 |
| violet9 / violet11 | logo-mode-primary / logo-mode-secondary | violet-9 / 11 |
| violetA8 | landing-preview-glow | violet-a8 |
| red8 / redA2 | status-danger-border / status-danger-surface | red-8 / a2 |
| amber11 / amberA3 | status-warning-text / status-warning-surface | amber-11 / a3 |
| white / black | media-on (текст поверх обложки) / media-scrim | `#ffffff` / `#000000`, оба режима |

Дополнительно, требование DS v1: `debt-owed` → green-11, `debt-owing` → red-11, `debt-settled` → olive-11, `status-success` → green-11, `status-info` → blue-11, `text-inverse` → olive-1. Для пропсов те же роли есть в `PROP_COLOR`.

`interactiveCardStyles.ts` меняет типы параметров с `ThemeColorToken` на `CpToken`, а вызовы в `group-card/styled.ts` и `activity-event/styled.ts` — на имена ролей.

**Проверки** (одна команда `tokens:check` в `lint`, укладывается в бюджет DS v1 до 30 с):

1. Генератор в dry-run, `generated/*` должен совпадать с закоммиченным.
2. Валидация `tokens.json`: известные `$type`, все алиасы разрешаются, нет неиспользуемых семантических токенов (поиск `--cp-x` по `apps/**`, `ds-gallery/**`).
3. `RADIX_PALETTES` совпадает с `radix-colors.css` и покрывает литералы палитр в коде.
4. Шкалы `accent`/`gray` в семантике совпадают с `RADIX_THEME.accentColor`/`grayColor`.
5. `manifest-colors.json.theme_color` = hex `brand.primary`, а `brand.primary` ссылается на шкалу `RADIX_THEME.accentColor`. Бренд меняется в tokens.json одной правкой `accentColor` плюс алиасами в группе accent; проверка ловит забытые места.

## Ньюансы и подводные камни

- Кастомное свойство на `:root` с `var(--accent-9)` невалидно (accent объявлен только внутри `.radix-themes`). Поэтому в генераторе ссылки только на конкретные шкалы.
- Класс на `<html>` — главный. Если `<Theme appearance>` с ним разойдётся, `--cp-*` (вычисленные на `:root`) и компоненты Radix покажут разные режимы. Оба значения берутся из одного `resolved`. Тест store проверяет, что класс html и `resolved` совпадают после каждого `setPreference`.
- Скрипт против FOUC вставляется только в `app.html` (после 04-5a он переименован в `index.html`; плагин ищет единственный html-entry). Публичный `index.html` (SSG) не трогаем до спеки 04: там своя логика в `PublicApp`, и двойное управление классом даст мигание.
- Кодмод — единственный PR, который меняет пиксели (gray → olive). Он изолирован от прочих изменений, чтобы скриншотный дифф объяснялся одной причиной.
- Тесты, которые мокают `next-themes` (`DevMenu.test.tsx`, `ThemeSwitcherDev.test.tsx`, `useSyncUserSettings.test.tsx`), переходят на реальный `appearanceStore` с `resetStore` в `beforeEach`.
- В jsdom нет `matchMedia`. Store обязан работать без него (fallback `light`), так же как текущий `PublicApp.tsx:24-27`.
- Правило касания styled может раздуть маленький фикс в большой styled-файле, например `settle-up-modal/styled.ts`, сверх 400 строк. Для этого есть `styled-touch-exempt.json` с Issue, а не молчаливое игнорирование.
- `csstools/value-no-unknown-custom-properties` не видит переменные, объявленные внутри модуля. Локальные переменные называются `--_name`, и regex их разрешает.

## Расширение в будущем

- Смена бренда: `RADIX_THEME.accentColor` и алиасы группы accent в tokens.json, затем `tokens:build`.
- Webfont: файлы в `packages/tokens/fonts/`, `@font-face` генерирует генератор, `font-src 'self'` (Google Fonts из CSP убираются по D16).
- Экспорт в Figma и Pencil: см. ниже. Style Dictionary может заменить генератор без смены входного формата (DS v1).

### Pencil/Figma

Макеты в Pencil или Figma одноразовые: они нужны для обсуждения и не являются источником правды. Источник один — `packages/tokens/tokens.json`. Когда появится дизайнер, токены выгружаются в Figma Variables через DTCG-совместимый плагин или нативный импорт (план онбординга в DS v1, `process.md`). Обратный поток (Figma → код) возможен только как PR в tokens.json, который проходит те же проверки. Никакой дизайн-инструмент не становится мастером без отдельного решения владельца.

## Что НЕ делаем

- Tailwind и shadcn (D14). Отказ от Radix Themes.
- Big-bang перевод 55 styled-файлов. Переводим только при касании.
- Обёртки над всеми примитивами Radix.
- Автоматический visual regression, Storybook, облачные сервисы.
- Ленивые локали (04-2c), регистрацию SW/precache (04-2d; кроме строки `webp` в 05-1), регенерацию иконок (02-B1), удаление `PublicApp` (04-5a/b), реструктуризацию ESLint-конфига (02-C4), vendor-regex (02-B1), алиасы ds-gallery (02-C3).
- Форк `base.css` ради accent-маппинга.

## Изменения относительно DS v1

1. Место токенов: `design-system/tokens.json` и `src/design-system/generated/*` переезжают в `packages/tokens/{tokens.json,generated/*}` (D7). Формат (DTCG 2025.10), генератор без зависимостей, «код — источник правды» не меняются.
2. `themeColor()` с семантическими ключами **не вводится, а удаляется**. Styled-код пишет `var(--cp-*)` напрямую. Генерируемые `DefaultTheme.colors` и `styled.d.ts` не нужны. ESLint `no-palette-theme-keys` (rule 2) отменяется, его заменяют stylelint и `no-raw-colors`.
3. Генератор дополнительно выдаёт `RADIX_THEME`, `PROP_COLOR`, `RADIX_PALETTES`, `CpToken` и `manifest-colors.json` (D23, вместо `PWA_THEME_COLOR`). `src/design-system/theme.ts` заменяется на `AppTheme.tsx`.
4. Семантика ссылается на конкретные шкалы (`--olive-11`), а не на `--gray-*`/`--accent-*`, иначе токены не работают на Astro-сайте и вне `.radix-themes`.
5. Добавлены примитивы `z.*`, `motion.*`, `brand.loader` и компонентные токены из таблицы кодмода. В DS v1 motion был out of scope, здесь в минимальном объёме: только существующие значения.
6. Долгосрочное направление стилей — CSS Modules. DS v1 оставлял styled-components в разрешённых, теперь он заморожен allowlist-ом (ответ на вопрос 3 аудита).
7. «Не оборачивать примитивы» уточнено критерием: 2 обёртки удаляются, 4 становятся ChipIn-компонентами в `basics`.
8. Тонкое уточнение DS v1 «basics без store»: добавлены запреты на импорт `components/*` и сайд-эффекты.

## Фазы/PR

| PR | Содержание | Файлы (≈) | Зависит от | Параллельно с |
|---|---|---|---|---|
| 05-1 | Импорт Radix CSS по частям (временно в новом `src/styles/index.css`, 22 шкалы), WebP ×2 + `webp` в `globPatterns`, `basics/Image` в onboarding, удаление `apple-icon.svg` | 8 | — | всё, включая 02/03/04 |
| 05-2 | `packages/tokens`: tokens.json, генератор, `generated/*`, `radix-colors.css` (переезд из 05-1), `tokens:check` + unit-тесты генератора, перенос logo/favicon, подключение в app, `manifest-colors.json` → манифест VitePWA и `<meta name="theme-color">` (D23) | 14 | 04-0 (npm workspaces) | 02, 03, 04-1a |
| 05-3 | `appearanceStore`, `AppTheme`, `theme-init` + Vite-плагин + CSP-хеш + тест, удаление next-themes (4 файла + 3 теста), `RADIX_THEME` в `main`/`PublicApp`/gallery | 16 | 05-2; хеш кладётся в `apps/app/hosting.base.json`, если 04-2b влит, иначе в `apps/app/vercel.json` (тест проверяет итоговый `vercel.json`) | 03 |
| 05-4 | Кодмод `themeColor` → `--cp-*` (21 файл + `interactiveCardStyles`; файлы `src/store/expenseModal*` и их styled пропускаются, пока не влит 03-14 — цепочка владения в `00-overview.md`), `--space/--radius` → `--cp-*` в styled-файлах, удаление `styled-themes.ts`, `colors.ts`, `styled.d.ts`, трёх `ThemeProvider`; запрет `@radix-ui/colors` | 30 (мелкие диффы, ≈350 строк) | 05-2 | 05-3 (разные файлы, кроме `main.tsx`: 05-4 вливается вторым) |
| 05-5 | stylelint + конфиг, `lint:css`, `no-raw-colors` (`no-restricted-syntax`, §3) + фикстуры, styled allowlist + `check-styled-allowlist.mjs --base`, правило `style`, svgr-правило (блоки через хелперы 02-C4), `css.modules` в Vite, `helpers/cx.ts`, эталонный перевод `mode-logotype/styled.ts` на CSS Module, 6 inline-style | 14 | 05-4, 02-C4 | 02 (кроме 02-C4) |
| 05-6 | Граница basics: перенос RelativeTime, BalanceBadgesSkeleton (PWABadge — нет, см. 04-2d); удаление Checkbox/RadioGroup; перенос SegmentedControl/Select/Dropdown/ProgressBar в basics с named exports; a11y-проверка 3 кнопок | 26 (импорты) | — (boundaries-правило включает 02-C9) | 05-2…05-5 |
| 05-7 | ds-gallery: `AppTheme` + store, раздел Tokens (алиасы удаляет 02-C3) | 4 | 05-3, 05-4 | 05-5, 05-6 |

- Каждый PR релизится независимо; поле `Version impact` убрано (бамп выбирает владелец в release-PR, спека 02 Д7). 05-4 видимо меняет оттенок (gray → olive) — отметить в release notes.
- Задачи DS v1 3–8 (документация, паттерны, карточки, маршрутизация, аудит экранов) идут после 05-4 по порядку DS v1. Их PR не пересекаются с файлами 05-5…05-7.

## Тесты/критерии приёмки

1. **Паритет скриншотов на 5 ключевых экранах в light и dark (10 пар):**
   - Dashboard;
   - страница группы (вкладка расходов);
   - модалка добавления расхода с открытым сплитом;
   - модалка settle-up;
   - лента Activity.
   - Процедура: `npm run dev`, тестовый аккаунт из seed проекта, viewport 390×844 и 1280×800, одинаковые данные и замороженное время. Снимки до (master) и после (ветка PR). Сравнение: `compare -metric AE -fuzz 1%` (ImageMagick). Пары прикладываются к PR.
   - Для 05-1, 05-2, 05-3, 05-5, 05-6, 05-7: 0 отличающихся пикселей сверх fuzz.
   - Для 05-4: отличия допустимы только в областях, которые рисуют 21 переведённый файл, и только как сдвиг оттенка серого. Владелец подтверждает пары в PR.
2. После 05-3 перезагрузка в dark (сохранённом и системном) не показывает светлый кадр. Проверка: запись производительности или скриншот при throttling Slow 4G. Кроме того, `document.documentElement.className` содержит `dark` до выполнения `root.tsx`.
3. `grep -rn "next-themes\|styled-themes\|themeColor\|@radix-ui/colors" apps ds-gallery` после 05-4 даёт 0 строк.
4. `vendor-radix.css` после 05-1 меньше текущих 683 KB как минимум на 40 KB raw. В precache `sw.js` есть `dashboard-onboarding.webp`.
5. `dashboard-onboarding.webp` ≤ 40 KB.
6. Lint-фикстуры:
   - новый файл с `import styled from 'styled-components'` — ошибка;
   - CSS Module с `#fff`, `16px` в `padding`, `var(--gray-11)`, `var(--cp-text-secndary)` — 4 ошибки;
   - правка `styled.ts` из allowlist без перевода — ошибка `check-styled-allowlist`.
7. Unit-тесты: генератор (фикстура tokens.json: алиасы, режимы, ошибки), `appearanceStore` (system/matchMedia, миграция ключа, класс html), `theme-init` (хеш в CSP, ключ).
8. Существующие тесты и `build:ds-gallery` зелёные.

## Требования к backend

Нет.

## Открытые вопросы

1. Решено (D23, принято владельцем 2026-10-28, реализуется генератором): olive-маппинг gray → olive в 21 styled-файле (ΔE около 1–2), скриншоты 05-4 — контроль, не вопрос.
2. Решено (D23, принято владельцем 2026-10-28, реализуется генератором): `theme_color` = grass-9 `#46a758` из `manifest-colors.json` вместо `#3e9b4f`.
3. Снято: имя пакета `@chipin/tokens` и пути `apps/app`, `apps/site` заданы спекой 04 §1.1; путь UI-стора `src/store/ui-prefs/` — спекой 03 §6.
4. Снято (правило, не допущение): хеш theme-init кладётся в `apps/app/hosting.base.json`, если 04-2b уже влит, иначе вручную в `apps/app/vercel.json`; тест всегда проверяет итоговый `vercel.json`.
