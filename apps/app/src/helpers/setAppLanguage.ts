// Spec 04 §2.10: the only place that switches the UI language. Each namespace of a language is a
// lazy chunk, so the language is loaded first and the UI never shows raw keys. Lives in `helpers`
// (not `app/i18n`): `hooks/useSyncUserSettings` calls it, and `hooks` may not import `app`.
// `<html lang>` is written only by `syncHtmlLang` (i18n/htmlLang.ts, #708), on `languageChanged`.
import type { SupportedLocale } from 'constants/locales';
import { saveLocalePreference } from 'helpers/locale';
import { i18n, I18N_NAMESPACES } from 'i18n';

// Latest wins, by call: each switch takes the next id, and only the latest one (`latestCall`) may
// apply; `pendingLanguage` is its target while it is in flight.
let latestCall = 0;
let pendingLanguage: SupportedLocale | null = null;

/** The language a switch in flight goes to, else null. */
const getPendingLanguage = (): SupportedLocale | null => pendingLanguage;

const missingNamespaces = (lng: SupportedLocale): string[] =>
    I18N_NAMESPACES.filter(ns => !i18n.hasResourceBundle(lng, ns));

// i18next never rejects a failed load and never reads a failed namespace again (its state stays
// "failed"). `reloadResources` reads the missing namespaces again; afterwards every namespace must
// be there, or the language is not usable and the switch rejects.
const loadLanguage = (lng: SupportedLocale): Promise<void> => {
    if (missingNamespaces(lng).length === 0) {
        return Promise.resolve();
    }
    return i18n.reloadResources([lng], missingNamespaces(lng)).then(() => {
        const missing = missingNamespaces(lng);

        if (missing.length > 0) {
            throw new Error(`Locale ${lng} not loaded: ${missing.join(', ')}`);
        }
    });
};

/** Loads and switches to `lng`; resolves false when a newer switch superseded this one. */
const switchTo = (lng: SupportedLocale): Promise<boolean> => {
    latestCall += 1;
    const call = latestCall;
    const isLatest = () => call === latestCall;
    const finish = () => {
        if (isLatest()) {
            pendingLanguage = null;
        }
    };

    pendingLanguage = lng;

    return loadLanguage(lng)
        .then(() => {
            if (!isLatest()) {
                return false;
            }
            // eslint-disable-next-line no-restricted-syntax -- the one call site (spec 04 §2.10)
            return i18n.changeLanguage(lng).then(isLatest);
        })
        .then(
            applied => {
                finish();
                return applied;
            },
            (error: unknown) => {
                finish();
                throw error;
            },
        );
};

/**
 * Switches to `lng` and saves it as the user's language preference (only if it was applied).
 * Rejects, without switching, when the language cannot be loaded; a newer switch wins over this one.
 */
const setAppLanguage = (lng: SupportedLocale): Promise<void> =>
    switchTo(lng).then(applied => {
        if (applied) {
            saveLocalePreference(lng);
        }
    });

export { getPendingLanguage, setAppLanguage };
