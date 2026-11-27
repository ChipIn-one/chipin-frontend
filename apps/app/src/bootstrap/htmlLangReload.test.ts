// #708, end to end: a reload with Russian saved as the cached user's language starts i18next in
// Russian, and `<html lang>` (synced as `root.tsx` does at boot) is `ru` from the start.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { saveLocalUser } from 'helpers/localStorage';

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'ru',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} as const;

beforeEach(() => {
    // A fresh `i18n` module: its `init` reads the saved language, as on a reload.
    vi.resetModules();
    // What `index.html` ships with.
    document.documentElement.lang = 'en';
});

afterEach(() => {
    window.history.pushState({}, '', '/');
    document.documentElement.lang = 'en';
});

// 04-5a: no URL picks the language, not `/` (the PWA start URL, the `home` redirect) nor an old
// public path.
test.each(['/settings', '/', '/privacy', '/ru/privacy'])(
    'a reload of %s with Russian saved starts with html lang ru',
    path => {
        window.history.pushState({}, '', path);
        saveLocalUser({ id: 'user-1', role: 'USER', settings });

        return Promise.all([import('i18n'), import('i18n/htmlLang')]).then(
            ([{ i18n, i18nReady }, { syncHtmlLang }]) => {
                const stop = syncHtmlLang(i18n);

                // The locale chunks load lazily (spec 04 §2.10); the boot renders only after this.
                return i18nReady.then(() => {
                    expect(i18n.resolvedLanguage).toBe('ru');
                    expect(document.documentElement.lang).toBe('ru');
                    stop();
                });
            },
        );
    },
);
