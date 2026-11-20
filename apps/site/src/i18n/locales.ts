import {
    DEFAULT_LOCALE,
    LOCALE_PATH,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from '@chipin/i18n-content';

// The site's locale list comes from @chipin/i18n-content (spec 04 §3.2), never by hand.
// Astro's i18n takes plain codes, so every locale path must be its code (the default one has none).
const astroLocales = (): SupportedLocale[] => {
    for (const code of SUPPORTED_LOCALES) {
        const path: string = LOCALE_PATH[code];
        const expected = code === DEFAULT_LOCALE ? '' : code;

        if (path !== expected) {
            throw new Error(`LOCALE_PATH.${code} must be '${expected}', got '${path}'`);
        }
    }

    return [...SUPPORTED_LOCALES];
};

const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter(code => code !== DEFAULT_LOCALE);

/**
 * The site path of a page in a locale. `slug` has no leading slash; `''` is the home page.
 * Locale home pages end with a slash (`/`, `/ru/`), other pages do not (`/privacy`, `/ru/privacy`).
 */
const localizedPath = (locale: SupportedLocale, slug: string): string => {
    const prefix: string = LOCALE_PATH[locale];

    if (slug === '') {
        return prefix === '' ? '/' : `/${prefix}/`;
    }

    return prefix === '' ? `/${slug}` : `/${prefix}/${slug}`;
};

export { astroLocales, DEFAULT_LOCALE, localizedPath, NON_DEFAULT_LOCALES, SUPPORTED_LOCALES };
export type { SupportedLocale };
