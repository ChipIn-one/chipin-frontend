// Theme constants for Radix Themes, the PWA manifest and the site (spec 05 §1, D23, D31).
// Written by hand; tokens.test.ts keeps them in sync with tokens.css and radix-colors.css.

/** The props of the single `<Theme>` (`AppTheme`); `appearance` comes from the store. */
export const RADIX_THEME = {
    accentColor: 'grass',
    grayColor: 'olive',
    radius: 'large',
    panelBackground: 'solid',
    scaling: '100%',
} as const;

/**
 * Roles for Radix `color` props, which do not accept CSS variables. Each role matches the
 * scale of the `--cp-*` role of the same meaning in tokens.css (`gray` is the olive gray of
 * `RADIX_THEME.grayColor` inside `<Theme>`).
 */
export const PROP_COLOR = {
    accent: RADIX_THEME.accentColor,
    neutral: 'gray',
    debtOwed: 'green',
    debtOwing: 'red',
    debtSettled: 'gray',
    success: 'green',
    danger: 'red',
    warning: 'amber',
    info: 'blue',
    solo: 'violet',
} as const;

/**
 * Type roles for Radix `<Text>`: `size` is the Radix step ('1'..'9'), the same step as
 * `--cp-font-size-N`/`--cp-line-height-N` of `--cp-type-<role>` in tokens.css. Not for
 * `<Heading>`, which has its own line heights and letter spacing: a title is
 * `<Text as="h2" …>`. `display` is for the site/landing only and also needs
 * `letterSpacing: var(--cp-type-display-tracking)`; `amountHero` also takes tabular numbers.
 */
export const TYPE_ROLES = {
    display: { size: '8', weight: 'bold' },
    amountHero: { size: '7', weight: 'bold' },
    title1: { size: '6', weight: 'bold' },
    title2: { size: '5', weight: 'bold' },
    title3: { size: '3', weight: 'bold' },
    body: { size: '3', weight: 'regular' },
    bodySm: { size: '2', weight: 'regular' },
    label: { size: '2', weight: 'medium' },
    caption: { size: '1', weight: 'regular' },
} as const;

/** Icon sizes in px for the lucide `size` prop; equal to `--cp-icon-*`. */
export const ICON_SIZE = {
    sm: 16,
    md: 20,
    lg: 24,
    tile: 32,
    hero: 48,
} as const;

/** Radix breakpoints (min-width, px); `--cp-gutter` grows from `sm`. */
export const BREAKPOINTS = {
    xs: 520,
    sm: 768,
    md: 1024,
    lg: 1280,
    xl: 1640,
} as const;

/** The Radix color scales imported by radix-colors.css, in the same order. */
export const RADIX_PALETTES = [
    'gray',
    'olive',
    'amber',
    'blue',
    'brown',
    'crimson',
    'cyan',
    'gold',
    'grass',
    'green',
    'indigo',
    'jade',
    'mint',
    'orange',
    'pink',
    'purple',
    'red',
    'sky',
    'teal',
    'tomato',
    'violet',
    'yellow',
] as const;

export type RadixPalette = (typeof RADIX_PALETTES)[number];

/** The scales the `--cp-*` roles of tokens.css reference (the component block excluded). */
export const ROLE_SCALES = ['olive', 'amber', 'blue', 'grass', 'green', 'red', 'violet'] as const;

/** The palette of the expense categories (`constants/category-ui.ts` in the app). */
export const CATEGORY_PALETTE = [
    'gray',
    'amber',
    'blue',
    'brown',
    'crimson',
    'gold',
    'green',
    'indigo',
    'mint',
    'orange',
    'pink',
    'purple',
    'red',
    'sky',
    'teal',
    'violet',
    'yellow',
] as const;

/**
 * Legacy: palettes still used directly in apps/app/src or apps/site (Radix `color` props,
 * `var(--<palette>-N)`) but by no role or category. They go when their usages move to roles
 * (#1007); `jade` also stays for `--cp-avatar-placeholder-from`.
 */
export const LEGACY_PALETTES = ['cyan', 'jade', 'tomato'] as const;

/**
 * The only brand hex outside tokens.css (D23): the PWA manifest, `<meta name="theme-color">`
 * and the site read it. `themeColor` is the light value of `--cp-brand-primary` (grass-9),
 * `backgroundColor` the light value of `--cp-surface-base` (olive-1).
 *
 * `pwaThemeColor`/`pwaBackgroundColor` are interim: by the owner decision of 2026-11-20 the PWA
 * manifest `theme_color`/`background_color` and `<meta name="theme-color">` keep the values the
 * app shipped before 05-2b (grass-10 `#3e9b4f`; `#ffffff`, the vite-plugin-pwa default) until the
 * design system sets the PWA colours; then they are replaced by `themeColor`/`backgroundColor`.
 */
export const BRAND_COLORS = {
    themeColor: '#46a758',
    backgroundColor: '#fcfdfc',
    pwaThemeColor: '#3e9b4f',
    pwaBackgroundColor: '#ffffff',
} as const;
