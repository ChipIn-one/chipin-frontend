import { afterEach, expect, test } from 'vitest';

import { getSiteOrigin } from 'helpers/env';
import { type LocalUser, saveLocalUser } from 'helpers/localStorage';

import { getLastAccountLandingPath, SITE_PATHS } from './sitePaths';

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
} satisfies LocalUser['settings'];

afterEach(() => {
    window.localStorage.clear();
});

test('site links are the site origin plus the page path', () => {
    expect(SITE_PATHS.home()).toBe(`${getSiteOrigin()}/`);
    expect(SITE_PATHS.privacy()).toBe(`${getSiteOrigin()}/privacy`);
    expect(SITE_PATHS.terms()).toBe(`${getSiteOrigin()}/terms`);
});

test('the sign-out landing path follows the last account language, English without one', () => {
    expect(getLastAccountLandingPath()).toBe('/');

    saveLocalUser({ settings });
    expect(getLastAccountLandingPath()).toBe('/ru/');

    saveLocalUser({ settings: { ...settings, language: 'xx' } });
    expect(getLastAccountLandingPath()).toBe('/');
});
