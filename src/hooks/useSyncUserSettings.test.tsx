import { renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/users-store';

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
    useUsersStore.setState({
        user: null,
        localUser: { role: 'ADMIN', settings },
    });
});

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
                useUsersStore.setState({
                    localUser: { role: 'USER', settings: { ...settings, language } },
                });
                useAuthStore.setState({ status: 'authenticated' });

                renderHook(() => useSyncUserSettings());

                expect(locale.matchLocale).toHaveBeenCalledWith(language);
                expect(locale.saveLocalePreference).toHaveBeenCalledWith('en');
                expect(changeLanguage).toHaveBeenCalledWith('en');
                expect(captureException).not.toHaveBeenCalled();
            }),
);
