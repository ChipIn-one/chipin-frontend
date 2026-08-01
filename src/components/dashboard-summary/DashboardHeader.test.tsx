import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import type { User } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import DashboardHeader from './DashboardHeader';

import 'i18n/index';

const admin = {
    id: 'user-1',
    email: 'admin@example.com',
    displayName: 'Admin',
    firstName: null,
    lastName: null,
    picture: null,
    role: 'ADMIN',
    subscriptionUntil: null,
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
} satisfies User;

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
