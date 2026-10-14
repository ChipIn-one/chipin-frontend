import { DEFAULT_LOCALE } from 'constants/locales';
import { getPublicPath, getPublicRoute } from 'helpers/publicRoutes';
import type { PublicLocale } from 'types/publicRoutes';

// This flag suppresses a toast; it does not store a public language preference.
const SESSION_KEY = 'chipin.publicLanguageSuggestionShown';

const isPublicLocaleSuggestionSuppressed = (): boolean =>
    typeof window === 'undefined' || window.sessionStorage.getItem(SESSION_KEY) === '1';

const suppressPublicLocaleSuggestion = (): void => {
    if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SESSION_KEY, '1');
    }
};

// Use the current URL at action time; an infinite toast may survive an SPA
// navigation between English public pages after it was first displayed.
const getPublicLocaleSuggestionTarget = (
    pathname: string,
    locale: PublicLocale,
): string | null => {
    const route = getPublicRoute(pathname);
    return route?.locale === DEFAULT_LOCALE ? getPublicPath(route.page, locale) : null;
};

export {
    getPublicLocaleSuggestionTarget,
    isPublicLocaleSuggestionSuppressed,
    suppressPublicLocaleSuggestion,
};
