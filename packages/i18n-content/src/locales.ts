// Released locales, shared by the app (client locale resolver, site links) and the site.
const SUPPORTED_LOCALES = ['en', 'ru'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: SupportedLocale = SUPPORTED_LOCALES[0];

// URL path segment of each locale; the default locale has none. The app builds its links to the
// site pages from it (`SITE_PAGE_PATHS`).
const LOCALE_PATH = {
    en: '',
    ru: 'ru',
} as const satisfies Record<SupportedLocale, string>;

export { DEFAULT_LOCALE, LOCALE_PATH, SUPPORTED_LOCALES };
export type { SupportedLocale };
