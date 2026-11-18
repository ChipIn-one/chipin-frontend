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
    accent: 'grass',
    neutral: 'gray',
    debtOwed: 'green',
    debtOwing: 'red',
    debtSettled: 'gray',
    success: 'green',
    danger: 'red',
    warning: 'amber',
    info: 'blue',
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

/**
 * The only brand hex outside tokens.css (D23): the PWA manifest, `<meta name="theme-color">`
 * and the site read it. `themeColor` is the light value of `--cp-brand-primary` (grass-9),
 * `backgroundColor` the light value of `--cp-surface-base` (olive-1).
 */
export const BRAND_COLORS = {
    themeColor: '#46a758',
    backgroundColor: '#fcfdfc',
} as const;
