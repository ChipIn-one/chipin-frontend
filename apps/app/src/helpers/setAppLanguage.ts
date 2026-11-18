// Spec 04 §2.10: the only place that switches the UI language. Each namespace of a language is a
// lazy chunk, so the language is loaded first and the UI never shows raw keys. Lives in `helpers`
// (not `app/i18n`): `hooks/useSyncUserSettings` calls it, and `hooks` may not import `app`.
import type { SupportedLocale } from 'constants/locales';
import { saveLocalePreference } from 'helpers/locale';
import { i18n } from 'i18n';

/**
 * Switches to `lng` without saving it: a public page's URL language, or the user's language
 * restored on leaving the public pages.
 */
const applyLanguage = (lng: SupportedLocale): Promise<void> =>
    i18n
        .loadLanguages(lng)
        // eslint-disable-next-line no-restricted-syntax -- the one call site (spec 04 §2.10)
        .then(() => i18n.changeLanguage(lng))
        .then(() => {
            document.documentElement.lang = lng;
        });

/** Switches to `lng` and saves it as the user's language preference. */
const setAppLanguage = (lng: SupportedLocale): Promise<void> =>
    applyLanguage(lng).then(() => {
        saveLocalePreference(lng);
    });

export { applyLanguage, setAppLanguage };
