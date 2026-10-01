import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import type { KnownUser } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import AddExpenseButton from './AddExpenseButton';

import 'i18n/index';

const friend = {
    user: {
        id: 'friend-1',
        email: 'friend@example.com',
        displayName: 'Friend',
        firstName: 'Friend',
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    },
    balances: [],
    lastUsedCurrency: null,
} satisfies KnownUser;

const renderButton = (
    pathname: string,
    type: 'mobile' | 'desktop' | 'sidebar' = 'mobile',
) => {
    return render(
        <MemoryRouter initialEntries={[pathname]}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseButton type={type} />
            </ThemeProvider>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    useGroupsStore.getState().setInitialGroupsStore();
    useUsersStore.setState({
        user: null,
        localUser: null,
        friends: [],
    });
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('dashboard', 'data', 'fetched');
});

test.each(['mobile', 'desktop', 'sidebar'] as const)(
    'hides the %s add-expense action when no valid target exists',
    type => {
        renderButton(ROUTES.DASHBOARD, type);

        expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
    },
);

test('shows the add-expense action when a friend is available', () => {
    useUsersStore.setState({ friends: [friend] });

    renderButton(ROUTES.FRIENDS);

    expect(screen.getByRole('button', { name: 'Add expense' })).not.toBeNull();
});

test('hides the add-expense action on a group route without selected group members', () => {
    useUsersStore.setState({ friends: [friend] });

    renderButton(`${ROUTES.GROUP}/group-1`);

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
});

test('keeps an unavailable add-expense action hidden while the dashboard is loading', () => {
    useLoadingStore.getState().setLoading('dashboard', 'data', 'loading');

    renderButton(ROUTES.DASHBOARD);

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
});

test('preserves loading behavior when the add-expense action is available', () => {
    useUsersStore.setState({ friends: [friend] });
    useLoadingStore.getState().setLoading('dashboard', 'data', 'loading');

    renderButton(ROUTES.DASHBOARD);

    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);
});

test('shows the add-expense action immediately after a valid target becomes available', () => {
    renderButton(ROUTES.DASHBOARD);

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();

    act(() => {
        useUsersStore.setState({ friends: [friend] });
    });

    expect(screen.getByRole('button', { name: 'Add expense' })).not.toBeNull();
});
