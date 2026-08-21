import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen, within } from '@testing-library/react';

import type { SelfUser } from 'api/chipin.types';
import { PROJECT_NAME } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import DesktopSidebar from './DesktopSidebar';

import '@radix-ui/themes/styles.css';

import 'i18n/index';

vi.mock('assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('users', 'self', 'fetched');
    useUsersStore.setState({ user, localUser: null, friends: [] });
});

test('shows the Add expense action on Settings', () => {
    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DesktopSidebar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Add expense' })).toBeTruthy();
});

test('shows the authenticated navigation and profile actions', () => {
    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DesktopSidebar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    const brandLink = screen.getByRole('link', { name: `${PROJECT_NAME} Group` });

    expect(within(brandLink).getByText('Group')).toBeTruthy();
    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });

    expect(dashboardLink.getAttribute('aria-current')).toBe('page');
    expect(getComputedStyle(dashboardLink).marginLeft).toBe('0px');
    expect(
        screen.getByRole('link', { name: 'Activity' }).getAttribute('aria-current'),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Friends' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Group mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Alex.*user@example\.com/i })).toBeTruthy();
});

test('shows the Solo badge for the active Solo mode', () => {
    useDashboardStore.setState({ appMode: APP_MODES.SOLO });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DesktopSidebar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: `${PROJECT_NAME} Solo` })).toBeTruthy();
});

test('shows the developer menu for an admin', () => {
    useUsersStore.setState({
        user: { ...user, role: 'ADMIN' },
        localUser: null,
        friends: [],
    });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DesktopSidebar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(
        screen.getByRole('button', { name: 'Developer menu' }).textContent,
    ).toContain('Developer menu');
});
