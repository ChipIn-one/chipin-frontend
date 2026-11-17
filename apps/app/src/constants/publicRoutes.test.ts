import { expect, test } from 'vitest';

import { DEFAULT_LOCALE } from 'constants/locales';
import { HOME_CANONICAL_URL } from 'constants/seo';

import {
    getPublicCanonical,
    getPublicPath,
    getPublicRoute,
    PUBLIC_ROUTE_ENTRIES,
    resolveRegistrationLocale,
} from './publicRoutes';

test('public manifest is the unique, indexable set of three pages in two locales', () => {
    expect(PUBLIC_ROUTE_ENTRIES).toHaveLength(6);
    expect(new Set(PUBLIC_ROUTE_ENTRIES.map(route => route.path)).size).toBe(6);
    expect(getPublicPath('home', 'en')).toBe('/');
    expect(getPublicPath('privacy', 'ru')).toBe('/ru/privacy');
    expect(getPublicPath('terms', 'ru')).toBe('/ru/terms');
    expect(getPublicRoute('/group/join/secret')).toBeNull();
    expect(getPublicRoute('/xx/')).toBeNull();
    expect(getPublicCanonical(getPublicRoute('/ru/')!)).toBe('https://chipin.one/ru/');
    // Removed locales (#609) are no longer public routes; vercel.json redirects them.
    expect(getPublicRoute('/es/')).toBeNull();
    expect(getPublicRoute('/pt-br/privacy')).toBeNull();
    expect(getPublicRoute('/pt-pt/terms')).toBeNull();
});

test('equivalent trailing-slash forms hydrate the same canonical public route', () => {
    expect(getPublicRoute('/ru')?.path).toBe('/ru/');
    expect(getPublicRoute('/ru/privacy/')?.path).toBe('/ru/privacy');
    expect(getPublicRoute('/privacy/')?.path).toBe('/privacy');
    expect(getPublicRoute('/terms/')?.path).toBe('/terms');

    expect(getPublicRoute('/ru//')).toBeNull();
    expect(getPublicRoute('/unknown')).toBeNull();
    expect(getPublicRoute('/dashboard/')).toBeNull();
});

test('registration language is selected from localized URL, then browser, then English', () => {
    expect(resolveRegistrationLocale('/ru/privacy', ['en-US'])).toBe('ru');
    expect(resolveRegistrationLocale('/ru/', ['en-US'])).toBe('ru');
    expect(resolveRegistrationLocale('/', ['ru-RU'])).toBe('ru');
    expect(resolveRegistrationLocale('/privacy', ['ru-RU'])).toBe('ru');
    expect(resolveRegistrationLocale('/privacy', ['pt-BR', 'ru-RU'])).toBe('en');
    expect(resolveRegistrationLocale('/', ['ja-JP'])).toBe('en');
    expect(resolveRegistrationLocale('/dashboard', ['es-ES'])).toBe('en');
});

test('canonical home URL and locale fallback reuse shared policy constants', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(getPublicCanonical(getPublicRoute('/')!)).toBe(HOME_CANONICAL_URL);
    expect(resolveRegistrationLocale('/', [])).toBe(DEFAULT_LOCALE);
    expect(PUBLIC_ROUTE_ENTRIES.map(route => getPublicCanonical(route))).toEqual(
        PUBLIC_ROUTE_ENTRIES.map(route => HOME_CANONICAL_URL.slice(0, -1) + route.path),
    );
});
