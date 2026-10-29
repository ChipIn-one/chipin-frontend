import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import type { UserSettings } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/users-store';

import { PublicLocaleRoute } from './PublicLocaleRoute';

type Listener = () => void;

const PAGE_TEXT = 'Public page';

const i18nMock = vi.hoisted(() => {
    const listeners = new Set<Listener>();
    const instance = {
        resolvedLanguage: 'en',
        changeLanguage: (language: string) => {
            instance.resolvedLanguage = language;
            listeners.forEach(listener => listener());
            return Promise.resolve();
        },
    };

    return { instance, listeners };
});

vi.mock('react-i18next', () =>
    import('react').then(({ useEffect, useReducer }) => ({
        useTranslation: () => {
            const [, forceRender] = useReducer((count: number) => count + 1, 0);

            useEffect(() => {
                i18nMock.listeners.add(forceRender);
                return () => {
                    i18nMock.listeners.delete(forceRender);
                };
            }, []);

            return { i18n: i18nMock.instance };
        },
    })),
);

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
    i18nMock.instance.resolvedLanguage = 'en';
    document.documentElement.lang = 'en';
    useAuthStore.setState({ status: 'authenticated' });
    useUsersStore.getState().setInitialUsersStore();
    useUsersStore.setState({ localUser: { role: 'USER', settings } });
});

afterEach(() => {
    i18nMock.listeners.clear();
});

test('renders children after switching to the URL locale', () => {
    render(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    expect(screen.getByText(PAGE_TEXT)).toBeTruthy();
    expect(i18nMock.instance.resolvedLanguage).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
});

test('re-asserts the URL locale when settings sync switches the language', () => {
    render(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    act(() => {
        void i18nMock.instance.changeLanguage('en');
    });

    expect(i18nMock.instance.resolvedLanguage).toBe('ru');
    expect(screen.getByText(PAGE_TEXT)).toBeTruthy();
});

test('restores the saved user language on unmount', () => {
    const { unmount } = render(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    expect(i18nMock.instance.resolvedLanguage).toBe('ru');

    unmount();

    expect(i18nMock.instance.resolvedLanguage).toBe('en');
    expect(document.documentElement.lang).toBe('en');
});

test('does not restore the user language when switching between public locales', () => {
    const changeLanguage = vi.spyOn(i18nMock.instance, 'changeLanguage');
    const { rerender } = render(
        <PublicLocaleRoute locale="ru">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    rerender(
        <PublicLocaleRoute locale="es">
            <p>{PAGE_TEXT}</p>
        </PublicLocaleRoute>,
    );

    expect(changeLanguage.mock.calls.map(([language]) => language)).toEqual(['ru', 'es']);
    expect(i18nMock.instance.resolvedLanguage).toBe('es');
});
