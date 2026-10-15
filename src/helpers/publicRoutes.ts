import { DEFAULT_LOCALE } from 'constants/locales';
import {
    LOCALE_PREFIX,
    PUBLIC_HOME_PAGE,
    PUBLIC_PAGES,
    PUBLIC_ROUTE_ENTRIES,
} from 'constants/publicRouteManifest';
import { HOME_CANONICAL_URL } from 'constants/seo';
import { matchLocale, resolveBrowserLocale } from 'helpers/locale';
import { getLocalUser } from 'helpers/localStorage';
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
    if (pathname.includes('//')) {
        return null;
    }
    const exact = PUBLIC_ROUTE_ENTRIES.find(route => route.path === pathname);
    if (exact) {
        return exact;
    }
    // Vercel serves both single-trailing-slash forms. Never guess unknown URLs.
    const alternate = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname + '/';
    return PUBLIC_ROUTE_ENTRIES.find(route => route.path === alternate) ?? null;
};

// Explicit sign-out uses the previous account's local-only language setting.
// Direct public visits still resolve their content exclusively from the URL.
const getLastAccountLandingPath = (): string => {
    const locale = matchLocale(getLocalUser()?.settings.language ?? '') ?? DEFAULT_LOCALE;
    return getPublicPath(PUBLIC_HOME_PAGE, locale);
};

const getPublicCanonical = (route: PublicRoute): string =>
    HOME_CANONICAL_URL.slice(0, -1) + route.path;

// The unprefixed English SSG route is not an explicit registration locale.
const resolveRegistrationLocale = (
    pathname: string,
    browserLanguages?: readonly string[],
): PublicLocale => {
    const route = getPublicRoute(pathname);
    if (route && route.locale !== DEFAULT_LOCALE) {
        return route.locale;
    }
    return resolveBrowserLocale(browserLanguages);
};

export { getLastAccountLandingPath, getPublicCanonical, getPublicPath, getPublicRoute, resolveRegistrationLocale };
