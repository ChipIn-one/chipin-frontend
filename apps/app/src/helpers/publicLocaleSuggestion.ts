import { DEFAULT_LOCALE } from 'constants/locales';
import { SS_KEY_PUBLIC_LOCALE_SUGGESTION_SHOWN } from 'constants/localstorage';
import { SessionStorage } from 'helpers/localStorage';
import { getPublicPath, getPublicRoute } from 'helpers/publicRoutes';
import type { PublicLocale } from 'types/publicRoutes';

// The flag suppresses a toast; it does not store a public language preference.
// A blocked or full session storage must not break page navigation (the helpers never throw).
// Fall back to document-local suppression only when the write fails.
let isSuppressedWithoutStorage = false;

const isPublicLocaleSuggestionSuppressed = (): boolean => {
    if (typeof window === 'undefined' || isSuppressedWithoutStorage) {
        return true;
    }
    return SessionStorage.getRaw(SS_KEY_PUBLIC_LOCALE_SUGGESTION_SHOWN) === '1';
};

const suppressPublicLocaleSuggestion = (): void => {
    if (typeof window === 'undefined') {
        return;
    }
    if (!SessionStorage.setRaw(SS_KEY_PUBLIC_LOCALE_SUGGESTION_SHOWN, '1')) {
        isSuppressedWithoutStorage = true;
    }
};

// Use the current URL at action time; an infinite toast may survive an SPA
// navigation between English public pages after it was first displayed.
const getPublicLocaleSuggestionTarget = (pathname: string, locale: PublicLocale): string | null => {
    const route = getPublicRoute(pathname);
    return route?.locale === DEFAULT_LOCALE ? getPublicPath(route.page, locale) : null;
};

export {
    getPublicLocaleSuggestionTarget,
    isPublicLocaleSuggestionSuppressed,
    suppressPublicLocaleSuggestion,
};
