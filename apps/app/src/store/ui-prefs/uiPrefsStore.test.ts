import { expect, test } from 'vitest';

import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';

import { APP_MODES, selectIsSoloMode, useUiPrefsStore } from './uiPrefsStore';

test('switches the app mode and applies the user default', () => {
    useUiPrefsStore.getState().setAppMode(APP_MODES.GROUP);
    expect(selectIsSoloMode(useUiPrefsStore.getState())).toBe(false);

    useUiPrefsStore.getState().setDefaultAppMode(true);
    expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.SOLO);
    expect(selectIsSoloMode(useUiPrefsStore.getState())).toBe(true);

    useUiPrefsStore.getState().setDefaultAppMode(false);
    expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.GROUP);
});

test('resetUiPrefs returns to the default of the cached settings', () => {
    saveLocalUser({
        settings: {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'en',
            theme: 'system',
            simplifyDebts: true,
            skipCategory: false,
            soloModeByDefault: true,
            saveGroupExpensesToSolo: false,
            sex: 'male',
        },
    });
    useUiPrefsStore.getState().setAppMode(APP_MODES.GROUP);

    useUiPrefsStore.getState().resetUiPrefs();

    expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.SOLO);
    clearLocalUserIdentity();
});
