import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { type SelfUser, usersKeys } from 'entities/users';
import { saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';

import { useSyncUserSettings } from './useSyncUserSettings';

const setTheme = vi.hoisted(() => vi.fn());
const changeLanguage = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const captureException = vi.hoisted(() => vi.fn());
const locale = vi.hoisted(() => ({
    matchLocale: vi.fn<(raw: string) => string | null>(() => 'en'),
    saveLocalePreference: vi.fn(),
}));

vi.mock('next-themes', () => ({
    useTheme: () => ({ setTheme }),
}));

vi.mock('@sentry/react', () => ({
    captureException,
}));

vi.mock('helpers/locale', () => ({
    matchLocale: locale.matchLocale,
    saveLocalePreference: locale.saveLocalePreference,
}));

vi.mock('i18n', () => ({
    default: { changeLanguage },
}));

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'light',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

beforeEach(() => {
    vi.clearAllMocks();
    saveLocalUser({ role: 'ADMIN', settings });
});

const selfUser = (overrides: Partial<UserSettings>): SelfUser => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token',
    settings: { ...settings, ...overrides },
    createdAt: 1,
    updatedAt: 1,
});

const seedSelfUser = (user: SelfUser) => {
    act(() => {
        getDefaultTestQueryClient().setQueryData(usersKeys.self(), user);
    });
};

test('does not reapply cached user settings after logout', () => {
    useAuthStore.setState({ status: 'unauthenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setTheme).not.toHaveBeenCalled();
    expect(locale.saveLocalePreference).not.toHaveBeenCalled();
    expect(changeLanguage).not.toHaveBeenCalled();
});

test('records locale sync failures', () => {
    const error = new Error('Failed to change language');
    changeLanguage.mockRejectedValueOnce(error);
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    return Promise.resolve().then(() => {
        expect(captureException).toHaveBeenCalledWith(error);
    });
});

test('applies cached user theme settings while the authenticated user is loading', () => {
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setTheme).toHaveBeenCalledWith('light');
    expect(locale.saveLocalePreference).toHaveBeenCalledWith('en');
    expect(changeLanguage).toHaveBeenCalledWith('en');
});

// #609: es, pt-BR and pt-PT were removed; a backend setting that still holds one
// is applied as English without an error and without changing the backend value.
test.each(['es', 'pt-BR', 'pt-PT', 'pt'])(
    'applies English for the removed saved language %s',
    language =>
        vi
            .importActual<{ matchLocale: (raw: string) => string | null }>('helpers/locale')
            .then(actual => {
                locale.matchLocale.mockImplementationOnce(actual.matchLocale);
                saveLocalUser({ role: 'USER', settings: { ...settings, language } });
                useAuthStore.setState({ status: 'authenticated' });

                renderHook(() => useSyncUserSettings());

                expect(locale.matchLocale).toHaveBeenCalledWith(language);
                expect(locale.saveLocalePreference).toHaveBeenCalledWith('en');
                expect(changeLanguage).toHaveBeenCalledWith('en');
                expect(captureException).not.toHaveBeenCalled();
            }),
);

test('applies the self query settings over the cached user', () => {
    useAuthStore.setState({ status: 'authenticated' });
    locale.matchLocale.mockImplementation(raw => raw);
    seedSelfUser(selfUser({ language: 'ru', theme: 'dark' }));

    renderHook(() => useSyncUserSettings());

    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(changeLanguage).toHaveBeenCalledWith('ru');
});

// Spec 03 §6 row 3: the language comes from `select`, so a new settings object with the same
// language does not run the language sync again.
test('changes the language only when the language changes', () =>
    Promise.resolve().then(() => {
        useAuthStore.setState({ status: 'authenticated' });
        locale.matchLocale.mockImplementation(raw => raw);
        seedSelfUser(selfUser({ language: 'ru' }));
        renderHook(() => useSyncUserSettings());
        expect(changeLanguage).toHaveBeenCalledTimes(1);

        seedSelfUser(selfUser({ language: 'ru', defaultCurrency: 'EUR' }));
        return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
            expect(changeLanguage).toHaveBeenCalledTimes(1);
            expect(setTheme).toHaveBeenCalledTimes(1);

            seedSelfUser(selfUser({ language: 'en' }));
            return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
                expect(changeLanguage).toHaveBeenCalledTimes(2);
                expect(changeLanguage).toHaveBeenLastCalledWith('en');
            });
        });
    }));
