import { beforeEach, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_USER } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';

import { APP_MODES, useDashboardStore } from './dashboardStore';

const settings = {
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
} satisfies UserSettings;

beforeEach(() => {
    LocalStorage.clear();
    useDashboardStore.getState().setInitialDashboardStore();
});

test('initializes the app mode from the cached default preference', () => {
    LocalStorage.set(LS_KEY_USER, { role: 'USER', settings });

    useDashboardStore.getState().setInitialDashboardStore();

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
});

test('falls back to Group mode without a cached preference', () => {
    useDashboardStore.getState().setInitialDashboardStore();

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.GROUP);
});

test('changes the active app mode independently of the default preference', () => {
    useDashboardStore.getState().setAppMode(APP_MODES.SOLO);

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
});

test('sets the app mode from a server default preference', () => {
    useDashboardStore.getState().setDefaultAppMode(true);

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
});
