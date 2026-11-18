// #708: `<html lang>` follows the active UI language, for screen readers, hyphenation and browser
// translation. It is the only writer of it in the SPA; `index.html` ships `en`, and the SSG
// prerender writes the route locale at build time.
import type { i18n as I18n } from 'i18next';

// Only a resolved (supported) language: `cimode` or an unknown code leaves the attribute as is.
const applyHtmlLang = (instance: I18n): void => {
    if (instance.resolvedLanguage) {
        document.documentElement.lang = instance.resolvedLanguage;
    }
};

/**
 * Sets `<html lang>` to the language `instance` runs in now and on every change; returns the
 * unsubscribe.
 */
export const syncHtmlLang = (instance: I18n): (() => void) => {
    const onLanguageChanged = (): void => {
        applyHtmlLang(instance);
    };

    applyHtmlLang(instance);
    instance.on('languageChanged', onLanguageChanged);
    return () => {
        instance.off('languageChanged', onLanguageChanged);
    };
};
