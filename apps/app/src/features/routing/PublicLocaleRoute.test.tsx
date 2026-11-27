import { captureException } from '@sentry/react';
import { act, render, screen } from '@testing-library/react';
import type { i18n as I18n } from 'i18next';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { saveLocalUser } from 'helpers/localStorage';
import { syncHtmlLang } from 'i18n/htmlLang';
import { useAuthStore } from 'store/authStore';

import { PublicLocaleRoute } from './PublicLocaleRoute';

const PAGE_TEXT = 'Public page';

// A real i18next instance behind `useTranslation`: `<html lang>` is written only by its
// `languageChanged` listener (`syncHtmlLang`, #708), as at boot.
const i18nMock = vi.hoisted(() => ({
    instance: null as I18n | null,
    failure: null as Error | null,
    // A switch still loading: it neither switches nor settles.
    held: false,
}));

vi.mock('react-i18next', () =>
    Promise.all([import('react'), import('i18next')]).then(
        ([{ useEffect, useReducer }, { default: i18next }]) => {
            const instance = i18next.createInstance();

            void instance.init({
                lng: 'en',
                fallbackLng: 'en',
                supportedLngs: ['en', 'ru'],
                resources: {
                    en: { common: { page: 'Page' } },
                    ru: { common: { page: 'Page (ru)' } },
                },
            });
            i18nMock.instance = instance;

            return {
                useTranslation: () => {
                    const [, forceRender] = useReducer((count: number) => count + 1, 0);

                    useEffect(() => {
                        instance.on('languageChanged', forceRender);
                        return () => {
                            instance.off('languageChanged', forceRender);
                        };
                    }, []);

                    return { i18n: instance, t: instance.t };
                },
            };
        },
    ),
);

// The real `applyLanguage` loads the language's lazy chunks first (its own test); here it switches
// the test instance at once, as `changeLanguage` did before.
// A set `failure` is a language whose chunks cannot load: the switch rejects without switching.
vi.mock('helpers/setAppLanguage', () => ({
    applyLanguage: (lng: string) => {
        if (i18nMock.failure) {
            return Promise.reject(i18nMock.failure);
        }
        if (i18nMock.held) {
            return new Promise<void>(() => undefined);
        }
        return (
            i18nMock.instance?.changeLanguage(lng).then(() => undefined) ??
            Promise.reject(new Error('react-i18next mock not loaded'))
        );
    },
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const i18n = (): I18n => {
    if (!i18nMock.instance) {
        throw new Error('react-i18next mock not loaded');
    }
    return i18nMock.instance;
};

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

let stopHtmlLang: () => void = () => undefined;

beforeEach(() => {
    stopHtmlLang = syncHtmlLang(i18n());
    void i18n().changeLanguage('en');
    document.documentElement.lang = 'en';
    useAuthStore.setState({ status: 'authenticated' });
    saveLocalUser({ role: 'USER', settings });
});

afterEach(() => {
    stopHtmlLang();
});

test('renders children after switching to the URL locale', () => {
    render(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    expect(screen.getByText(PAGE_TEXT)).toBeTruthy();
    expect(i18n().resolvedLanguage).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
});

test('re-asserts the URL locale when settings sync switches the language', () => {
    render(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    act(() => {
        void i18n().changeLanguage('en');
    });

    expect(i18n().resolvedLanguage).toBe('ru');
    expect(screen.getByText(PAGE_TEXT)).toBeTruthy();
});

test('restores the saved user language on unmount', () => {
    const { unmount } = render(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    expect(i18n().resolvedLanguage).toBe('ru');

    unmount();

    expect(i18n().resolvedLanguage).toBe('en');
    expect(document.documentElement.lang).toBe('en');
});

test('does not restore the user language when switching between public locales', () => {
    const changeLanguage = vi.spyOn(i18n(), 'changeLanguage');
    const { rerender } = render(
        <PublicLocaleRoute locale="en">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    rerender(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    expect(changeLanguage.mock.calls.map(([language]) => language)).toEqual(['ru']);
    expect(i18n().resolvedLanguage).toBe('ru');
});

// #708: signed out with the Russian UI, a visit of an English public page and back. The page
// switched i18next to English; leaving it must not put back `ru` while the UI stays English.
test('after leaving a public page the html lang is the UI language', () => {
    useAuthStore.setState({ status: 'unauthenticated' });
    void i18n().changeLanguage('ru');
    expect(document.documentElement.lang).toBe('ru');

    const { unmount } = render(
        <PublicLocaleRoute locale="en">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );
    expect(document.documentElement.lang).toBe('en');
    unmount();

    expect(document.documentElement.lang).toBe(i18n().resolvedLanguage);
    expect(document.documentElement.lang).toBe('en');
});

// R1 M1: when the URL language cannot load, the page shows in the active language instead of a
// loader that never ends, and the failure is reported.
test('renders children in the active language when the URL language fails to load', async () => {
    const error = new Error('Locale ru not loaded');
    i18nMock.failure = error;

    try {
        render(
            <PublicLocaleRoute locale="ru">
                <p>{PAGE_TEXT}</p>
            </PublicLocaleRoute>,
        );

        expect(await screen.findByText(PAGE_TEXT)).toBeTruthy();
        expect(i18n().resolvedLanguage).toBe('en');
        expect(captureException).toHaveBeenCalledWith(error);
    } finally {
        i18nMock.failure = null;
    }
});

// R2-N1: once the URL language loads after a failure, a later switch away from it shows the
// loader again instead of the page in another language.
test('a URL language that loads after a failure clears the failure', async () => {
    i18nMock.failure = new Error('Locale ru not loaded');
    const { rerender } = render(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );
    expect(await screen.findByText(PAGE_TEXT)).toBeTruthy();

    try {
        // The next visit of the URL language loads it.
        i18nMock.failure = null;
        rerender(
            <PublicLocaleRoute locale="en">
                <p>{PAGE_TEXT}</p>
            </PublicLocaleRoute>,
        );
        rerender(
            <PublicLocaleRoute locale="ru">
                <p>{PAGE_TEXT}</p>
            </PublicLocaleRoute>,
        );
        await vi.waitFor(() => {
            expect(i18n().resolvedLanguage).toBe('ru');
        });

        // Something switches away; the re-assert is still loading.
        i18nMock.held = true;
        await act(async () => {
            await i18n().changeLanguage('en');
        });

        expect(screen.queryByText(PAGE_TEXT)).toBeNull();
    } finally {
        i18nMock.failure = null;
        i18nMock.held = false;
    }
});
