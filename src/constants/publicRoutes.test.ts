import { expect, test } from 'vitest';

import { DEFAULT_LOCALE } from 'constants/locales';
import { HOME_CANONICAL_URL } from 'constants/seo';

import {
    getPublicCanonical,
    getPublicPath,
    getPublicRoute,
    getRootLocaleRedirect,
    PUBLIC_ROUTE_ENTRIES,
    selectRootLocale,
} from './publicRoutes';

test('public manifest is the unique, indexable set of three pages in five locales', () => {
    expect(PUBLIC_ROUTE_ENTRIES).toHaveLength(15);
    expect(new Set(PUBLIC_ROUTE_ENTRIES.map(route => route.path)).size).toBe(15);
    expect(getPublicPath('home', 'en')).toBe('/');
    expect(getPublicPath('privacy', 'ru')).toBe('/ru/privacy');
    expect(getPublicPath('terms', 'pt-PT')).toBe('/pt-pt/terms');
    expect(getPublicRoute('/group/join/secret')).toBeNull();
    expect(getPublicRoute('/xx/')).toBeNull();
    expect(getPublicCanonical(getPublicRoute('/es/')!)).toBe('https://chipin.one/es/');
});

test('equivalent trailing-slash forms hydrate the same canonical public route', () => {
    expect(getPublicRoute('/ru')?.path).toBe('/ru/');
    expect(getPublicRoute('/es')?.path).toBe('/es/');
    expect(getPublicRoute('/pt-br')?.path).toBe('/pt-br/');
    expect(getPublicRoute('/pt-pt')?.path).toBe('/pt-pt/');
    expect(getPublicRoute('/ru/privacy/')?.path).toBe('/ru/privacy');
    expect(getPublicRoute('/privacy/')?.path).toBe('/privacy');
    expect(getPublicRoute('/terms/')?.path).toBe('/terms');

    expect(getPublicRoute('/ru//')).toBeNull();
    expect(getPublicRoute('/unknown')).toBeNull();
    expect(getPublicRoute('/dashboard/')).toBeNull();
});

test('explicit URL, manual locale, browser and English fallback are deterministic', () => {
    expect(selectRootLocale('en', 'ru', ['pt-PT'])).toBe('en');
    expect(selectRootLocale('es-MX', 'ru', ['pt-PT'])).toBe('es');
    expect(selectRootLocale(null, 'pt-PT', ['ru'])).toBe('pt-PT');
    expect(selectRootLocale(null, null, ['ja-JP', 'pt-AO'])).toBe('pt-BR');
    expect(selectRootLocale(null, null, ['ja-JP'])).toBe('en');
});

test('redirect strips private and unknown query fields; does not bounce for English', () => {
    expect(getRootLocaleRedirect('en', '?lang=ru', '')).toBeNull();
    expect(getRootLocaleRedirect(
        'ru',
        '?lang=ru&code=oauth-secret&inviteToken=secret&utm_source=google&utm_campaign=ok',
        '#features',
    )).toBe('/ru/?utm_source=google&utm_campaign=ok#features');
    expect(getRootLocaleRedirect('es', '?utm_source=%2Fsecret', '#invalid/fragment')).toBe('/es/');
});

test('canonical home URL and locale fallback reuse shared policy constants', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(getPublicCanonical(getPublicRoute('/')!)).toBe(HOME_CANONICAL_URL);
    expect(selectRootLocale(null, null, [])).toBe(DEFAULT_LOCALE);
    expect(PUBLIC_ROUTE_ENTRIES.map(route => getPublicCanonical(route))).toEqual(
        PUBLIC_ROUTE_ENTRIES.map(route => HOME_CANONICAL_URL.slice(0, -1) + route.path),
    );
});
