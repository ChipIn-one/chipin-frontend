import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SelfUser } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import DashboardHeader from './DashboardHeader';

import 'i18n/index';

const admin = {
    id: 'user-1',
    email: 'admin@example.com',
    displayName: 'Admin',
    picture: null,
    role: 'ADMIN',
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
    useLoadingStore.getState().setLoading('users', 'self', 'fetched');
    useUsersStore.setState({ user: admin });
});

test('keeps the developer menu available in the mobile dashboard header for an admin', () => {
    render(
        <MemoryRouter>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DashboardHeader />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Developer menu' })).toBeTruthy();
});

const CurrentRoute = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

const renderDashboardHeader = () =>
    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DashboardHeader />
                    <CurrentRoute />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

test('shows the profile Settings shortcut beside the dashboard greeting', () => {
    renderDashboardHeader();

    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hi, Admin' })).toBeTruthy();
    expect(screen.getByText("Here's your summary")).toBeTruthy();
});

test('opens Settings from the shared profile avatar shortcut', () => {
    const interaction = userEvent.setup();
    renderDashboardHeader();

    return interaction.click(screen.getByRole('link', { name: 'Settings' })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe('/settings');
    });
});

test('retains the Settings shortcut while the current user is loading', () => {
    useLoadingStore.getState().setLoading('users', 'self', 'loading');
    renderDashboardHeader();

    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
});
