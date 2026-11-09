import { Theme } from '@radix-ui/themes';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import { PROJECT_NAME } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { createKnownUser, seedKnownUsers } from 'test/knownUsers';
import { seedSelfUser } from 'test/selfUserSeed';

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

const friend = createKnownUser('friend-1');

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
    useLoadingStore.getState().setInitialLoadingStore();
    seedSelfUser(user);
});

test('shows the Add expense action on Settings when a valid target exists', () => {
    seedKnownUsers([friend]);

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
    expect(screen.getByRole('link', { name: 'Activity' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'Friends' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Group mode' })).toBeNull();
    expect(screen.getByRole('button', { name: /Alex.*user@example\.com/i })).toBeTruthy();
});

test('shows Group branding when Solo mode is stale for an admin', () => {
    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });
    seedSelfUser({ ...user, role: 'ADMIN' });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DesktopSidebar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: `${PROJECT_NAME} Group` })).toBeTruthy();
});

test('renders Group branding for a non-admin with stale Solo state', () => {
    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DesktopSidebar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: `${PROJECT_NAME} Group` })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Group mode' })).toBeNull();
});

test('shows the developer menu for an admin', () => {
    seedSelfUser({ ...user, role: 'ADMIN' });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DesktopSidebar />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Developer menu' }).textContent).toContain(
        'Developer menu',
    );
});
