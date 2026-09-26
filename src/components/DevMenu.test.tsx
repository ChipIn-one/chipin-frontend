import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserSettings } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/users-store';

import DevMenu from './DevMenu';

const theme = vi.hoisted(() => ({
    resolvedTheme: 'light',
    setTheme: vi.fn(),
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

vi.mock('next-themes', () => ({
    useTheme: () => theme,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
    vi.clearAllMocks();
    theme.resolvedTheme = 'light';
    useAuthStore.setState({ status: 'unauthenticated' });
    useUsersStore.setState({
        user: null,
        localUser: { role: 'ADMIN', settings },
        setUserSettings: vi.fn().mockResolvedValue(undefined),
    });
});

test('switches the local theme without saving user settings on the landing page', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <DevMenu />
        </Theme>,
    );

    return user
        .click(screen.getByRole('button', { name: 'header.devMenu' }))
        .then(() => user.click(screen.getByRole('menuitem', { name: 'header.switchTheme' })))
        .then(() => {
            expect(theme.setTheme).toHaveBeenCalledWith('dark');
            expect(useUsersStore.getState().setUserSettings).not.toHaveBeenCalled();
        });
});

test('persists the theme while an authenticated user is still loading', () => {
    const user = userEvent.setup();
    useAuthStore.setState({ status: 'authenticated' });

    render(
        <Theme>
            <DevMenu />
        </Theme>,
    );

    return user
        .click(screen.getByRole('button', { name: 'header.devMenu' }))
        .then(() => user.click(screen.getByRole('menuitem', { name: 'header.switchTheme' })))
        .then(() => {
            expect(useUsersStore.getState().setUserSettings).toHaveBeenCalledWith({
                settings: { theme: 'dark' },
            });
            expect(theme.setTheme).not.toHaveBeenCalled();
        });
});
