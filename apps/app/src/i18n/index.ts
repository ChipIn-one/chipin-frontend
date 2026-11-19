import { loadCommon } from '@chipin/i18n-content';
import i18n from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from 'constants/locales';
import { getPublicRoute } from 'constants/publicRoutes';
import { resolveLocale } from 'helpers/locale';

const isSupportedLocale = (lng: string): lng is SupportedLocale =>
    (SUPPORTED_LOCALES as readonly string[]).includes(lng);

// Spec 04 §2.10: every namespace is a lazy chunk per language, none is in the entry. `common` comes
// from `@chipin/i18n-content` (`loadCommon`, which rejects an unknown locale); the app namespaces are
// bundled by Vite from the relative template. `supportedLngs` keeps i18next from asking for any
// other code (`en-US`, `cimode`).
const loadNamespace = (lng: string, ns: string): Promise<unknown> => {
    if (!isSupportedLocale(lng)) {
        return Promise.reject(new Error(`Unsupported locale: ${lng}`));
    }
    return ns === 'common' ? loadCommon(lng) : import(`./locales/${lng}/${ns}.json`);
};

/** Every namespace of a language: the language is usable only when all of them are loaded. */
const I18N_NAMESPACES = [
    'common',
    'auth',
    'errors',
    'currencies',
    'toasts',
    'landing',
    'activity',
    'group',
    'dashboard',
    'settings',
    'friends',
    'skeletons',
    'meta',
    'pwa',
] as const;

/** Settles once the initial language and the fallback were read; a failed namespace shows `en` or keys. */
const i18nReady = i18n
    .use(resourcesToBackend(loadNamespace))
    .use(initReactI18next)
    .init({
        lng:
            (typeof window !== 'undefined' && getPublicRoute(window.location.pathname)?.locale) ||
            resolveLocale(),
        fallbackLng: DEFAULT_LOCALE,
        supportedLngs: SUPPORTED_LOCALES,
        nonExplicitSupportedLngs: false,
        load: 'languageOnly',
        // The initial language and the fallback (14 namespaces each) load in one wave.
        maxParallelReads: 32,

        ns: [...I18N_NAMESPACES],
        defaultNS: 'common',

        interpolation: {
            escapeValue: false,
        },
    })
    .then(() => undefined);

export { i18n, I18N_NAMESPACES, i18nReady };
