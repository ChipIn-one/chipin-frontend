import { DEFAULT_LOCALE } from 'constants/locales';
import { getPublicPath, getPublicRoute } from 'helpers/publicRoutes';
import type { PublicLocale } from 'types/publicRoutes';

// This flag suppresses a toast; it does not store a public language preference.
const SESSION_KEY = 'chipin.publicLanguageSuggestionShown';

// A blocked or full sessionStorage must not break page navigation. Fall back
// to document-local suppression only when persistence is unavailable.
let isSuppressedWithoutStorage = false;

const isPublicLocaleSuggestionSuppressed = (): boolean => {
    if (typeof window === 'undefined') {
        return true;
    }
    try {
        return window.sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
        return isSuppressedWithoutStorage;
    }
};

const suppressPublicLocaleSuggestion = (): void => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
        isSuppressedWithoutStorage = true;
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
