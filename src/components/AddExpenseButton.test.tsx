import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { KnownUser } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import AddExpenseButton from './AddExpenseButton';

import '@radix-ui/themes/styles.css';

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
                <Theme>
                    <AddExpenseButton type={type} />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    useExpenseModalStore.getState().reset();
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
    'keeps the unavailable %s add-expense action visible',
    type => {
        renderButton(ROUTES.DASHBOARD, type);

        expect(
            screen.getByRole('button', { name: 'Add expense' }).getAttribute('aria-disabled'),
        ).toBe('true');
    },
);

test('explains an unavailable dashboard action on click', async () => {
    renderButton(ROUTES.DASHBOARD);

    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Add friends or group members')).not.toBeNull();
    expect(useExpenseModalStore.getState().isOpened).toBe(false);
});

test('uses the Friends-specific unavailable message', async () => {
    renderButton(ROUTES.FRIENDS);

    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Add a friend')).not.toBeNull();
});

test('uses the group-specific unavailable message', async () => {
    renderButton(`${ROUTES.GROUP}/group-1`);

    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Add group members')).not.toBeNull();
});

test('enables the add-expense action when a friend is available', () => {
    useUsersStore.setState({ friends: [friend] });

    renderButton(ROUTES.FRIENDS);

    expect(
        screen.getByRole('button', { name: 'Add expense' }).getAttribute('aria-disabled'),
    ).toBeNull();
});

test('preserves loading behavior while availability is unresolved', () => {
    useLoadingStore.getState().setLoading('dashboard', 'data', 'loading');

    renderButton(ROUTES.DASHBOARD);

    const button = screen.getByRole('button', { name: 'Add expense' });

    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-disabled')).toBeNull();
});

test('enables the add-expense action immediately after a valid target becomes available', () => {
    renderButton(ROUTES.DASHBOARD);

    expect(
        screen.getByRole('button', { name: 'Add expense' }).getAttribute('aria-disabled'),
    ).toBe('true');

    act(() => {
        useUsersStore.setState({ friends: [friend] });
    });

    expect(
        screen.getByRole('button', { name: 'Add expense' }).getAttribute('aria-disabled'),
    ).toBeNull();
});
