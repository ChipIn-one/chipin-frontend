import { localizedPath, SUPPORTED_LOCALES } from '../i18n/locales';

// Locale homes keep their trailing slash (`/`, `/ru/`); every other page has none (spec 04 §3.2).
const LOCALE_HOMES = new Set(SUPPORTED_LOCALES.map(locale => localizedPath(locale, '')));

/**
 * The canonical form of a sitemap URL. `@astrojs/sitemap` writes `build.format: 'directory'` pages
 * as `/privacy/`, but the canonical URL (`BaseLayout`) is `/privacy`.
 */
const canonicalSitemapUrl = (href: string): string => {
    const url = new URL(href);

    if (!LOCALE_HOMES.has(url.pathname) && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.href;
};

export { canonicalSitemapUrl };
