// This flag suppresses a toast; it does not store a public language preference.
const SESSION_KEY = 'chipin.publicLanguageSuggestionShown';

const isPublicLocaleSuggestionSuppressed = (): boolean =>
    typeof window === 'undefined' || window.sessionStorage.getItem(SESSION_KEY) === '1';

const suppressPublicLocaleSuggestion = (): void => {
    if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SESSION_KEY, '1');
    }
};

export { isPublicLocaleSuggestionSuppressed, suppressPublicLocaleSuggestion };
