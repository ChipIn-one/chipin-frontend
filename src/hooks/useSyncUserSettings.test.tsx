import { beforeEach, expect, test, vi } from 'vitest';

import { renderHook } from '@testing-library/react';

import type { UserSettings } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/users-store';

import { useSyncUserSettings } from './useSyncUserSettings';

const setTheme = vi.hoisted(() => vi.fn());
const locale = vi.hoisted(() => ({
    matchLocale: vi.fn(() => 'en'),
    onChangeLocale: vi.fn(),
}));

vi.mock('next-themes', () => ({
    useTheme: () => ({ setTheme }),
}));

vi.mock('helpers/locale', () => ({
    matchLocale: locale.matchLocale,
    onChangeLocale: locale.onChangeLocale,
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

test('does not reapply cached user theme settings after logout', () => {
    useAuthStore.setState({ status: 'unauthenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setTheme).not.toHaveBeenCalled();
    expect(locale.onChangeLocale).toHaveBeenCalledWith('en');
});

test('applies cached user theme settings while the authenticated user is loading', () => {
    useAuthStore.setState({ status: 'authenticated' });

    renderHook(() => useSyncUserSettings());

    expect(setTheme).toHaveBeenCalledWith('light');
});
