import {
    LOCALE_PREFIX,
    PUBLIC_HOME_PAGE,
    PUBLIC_PAGES,
    PUBLIC_ROUTE_ENTRIES,
} from 'constants/publicRouteManifest';
import { DEFAULT_LOCALE } from 'constants/locales';
import { HOME_CANONICAL_URL } from 'constants/seo';
import { matchLocale } from 'helpers/locale';
import type { PublicLocale, PublicPage, PublicRoute } from 'types/publicRoutes';

const getPublicPath = (page: PublicPage, locale: PublicLocale): string => {
    const definition = PUBLIC_PAGES.find(item => item.id === page);
    if (!definition) {
        throw new Error('Unsupported public page: ' + page);
    }
    const base = LOCALE_PREFIX[locale];
    return definition.segment ? base + '/' + definition.segment : base + '/';
};

const getPublicRoute = (pathname: string): PublicRoute | null => {
    if (pathname.includes('//')) return null;
    const exact = PUBLIC_ROUTE_ENTRIES.find(route => route.path === pathname);
    if (exact) return exact;
    // Vercel serves both single-trailing-slash forms. Never guess unknown URLs.
    const alternate = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname + '/';
    return PUBLIC_ROUTE_ENTRIES.find(route => route.path === alternate) ?? null;
};

const getPublicCanonical = (route: PublicRoute): string =>
    HOME_CANONICAL_URL.slice(0, -1) + route.path;

const selectRootLocale = (
    override: string | null,
    persisted: string | null,
    browserLanguages: readonly string[],
): PublicLocale => {
    if (override !== null) {
        const selected = matchLocale(override);
        if (selected) return selected;
    }
    if (persisted !== null) {
        const selected = matchLocale(persisted);
        if (selected) return selected;
    }
    for (const language of browserLanguages) {
        const selected = matchLocale(language);
        if (selected) return selected;
    }
    return DEFAULT_LOCALE;
};

// Only low-cardinality, non-sensitive acquisition fields survive root selection.
const ROOT_QUERY_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign']);

const getRootLocaleRedirect = (
    locale: PublicLocale,
    originalSearch: string,
    originalHash: string,
): string | null => {
    if (locale === DEFAULT_LOCALE) return null;
    const params = new URLSearchParams(originalSearch);
    const allowed = new URLSearchParams();
    for (const [key, value] of params) {
        if (ROOT_QUERY_KEYS.has(key) && /^[a-zA-Z0-9_\\-.]{1,80}$/.test(value)) {
            allowed.set(key, value);
        }
    }
    const query = allowed.toString();
    const fragment = /^#[a-zA-Z0-9_-]{1,80}$/.test(originalHash) ? originalHash : '';
    return getPublicPath(PUBLIC_HOME_PAGE, locale) + (query ? '?' + query : '') + fragment;
};

export {
    getPublicCanonical,
    getPublicPath,
    getPublicRoute,
    getRootLocaleRedirect,
    selectRootLocale,
};
