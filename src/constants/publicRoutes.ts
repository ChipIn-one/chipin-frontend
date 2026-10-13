import {
    matchLocale,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from 'helpers/locale';

const PUBLIC_PAGES = [
    { id: 'home', segment: '', metaKey: 'home' },
    { id: 'privacy', segment: 'privacy', metaKey: 'privacy' },
    { id: 'terms', segment: 'terms', metaKey: 'terms' },
] as const;

type PublicPage = (typeof PUBLIC_PAGES)[number]['id'];
type PublicLocale = SupportedLocale;

const LOCALE_PREFIX: Record<PublicLocale, string> = {
    en: '',
    ru: '/ru',
    es: '/es',
    'pt-BR': '/pt-br',
    'pt-PT': '/pt-pt',
};

const getPublicPath = (page: PublicPage, locale: PublicLocale): string => {
    const definition = PUBLIC_PAGES.find(item => item.id === page);
    if (!definition) {
        throw new Error('Unsupported public page: ' + page);
    }
    const base = LOCALE_PREFIX[locale];
    return definition.segment
        ? base + '/' + definition.segment
        : (base || '') + '/';
};

const PUBLIC_ROUTE_ENTRIES = SUPPORTED_LOCALES.flatMap(locale =>
    PUBLIC_PAGES.map(page => ({
        page: page.id,
        locale,
        path: getPublicPath(page.id, locale),
        metaKey: page.metaKey,
    })),
);

type PublicRoute = (typeof PUBLIC_ROUTE_ENTRIES)[number];

const getPublicRoute = (pathname: string): PublicRoute | null => {
    return PUBLIC_ROUTE_ENTRIES.find(route => route.path === pathname) ?? null;
};

const getPublicCanonical = (route: PublicRoute): string =>
    'https://chipin.one' + route.path;

const selectRootLocale = (
    override: string | null,
    persisted: string | null,
    browserLanguages: readonly string[],
): PublicLocale => {
    if (override !== null) {
        const selected = matchLocale(override);
        if (selected) {
            return selected;
        }
    }
    if (persisted !== null) {
        const selected = matchLocale(persisted);
        if (selected) {
            return selected;
        }
    }
    for (const language of browserLanguages) {
        const selected = matchLocale(language);
        if (selected) {
            return selected;
        }
    }
    return 'en';
};

// Only low-cardinality, non-sensitive acquisition fields survive root locale selection.
const ROOT_QUERY_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign']);

const getRootLocaleRedirect = (
    locale: PublicLocale,
    originalSearch: string,
    originalHash: string,
): string | null => {
    if (locale === 'en') {
        return null;
    }

    const params = new URLSearchParams(originalSearch);
    const allowed = new URLSearchParams();
    for (const [key, value] of params) {
        if (ROOT_QUERY_KEYS.has(key) && /^[a-zA-Z0-9_\-.]{1,80}$/.test(value)) {
            allowed.set(key, value);
        }
    }
    const query = allowed.toString();
    const fragment = /^#[a-zA-Z0-9_-]{1,80}$/.test(originalHash) ? originalHash : '';
    return getPublicPath('home', locale) + (query ? '?' + query : '') + fragment;
};

export {
    getPublicCanonical,
    getPublicPath,
    getPublicRoute,
    getRootLocaleRedirect,
    PUBLIC_PAGES,
    PUBLIC_ROUTE_ENTRIES,
    selectRootLocale,
};
export type { PublicLocale, PublicPage, PublicRoute };
