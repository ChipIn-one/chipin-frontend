import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { KnownUser } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useErrorsStore } from 'store/errorsStore';
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
    useErrorsStore.getState().resetErrors();
    useUsersStore.setState({
        user: null,
        localUser: null,
        friends: [],
    });
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('dashboard', 'data', 'fetched');
    useLoadingStore.getState().setLoading('group', 'list', 'fetched');
    useLoadingStore.getState().setLoading('group', 'data', 'fetched');
    useLoadingStore.getState().setLoading('users', 'friends', 'fetched');
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

    expect((await screen.findAllByText('Add friends or group members to start')).length).toBeGreaterThan(0);
    expect(useExpenseModalStore.getState().isOpened).toBe(false);
});

test('uses the friends-specific unavailable message', async () => {
    renderButton(ROUTES.FRIENDS);

    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect((await screen.findAllByText('Add a friend to start')).length).toBeGreaterThan(0);
});

test('uses the group-specific unavailable message', async () => {
    renderButton(`${ROUTES.GROUP}/group-1`);

    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect((await screen.findAllByText('Add group members to start')).length).toBeGreaterThan(0);
});

test('enables the add-expense action when a friend is available', () => {
    useUsersStore.setState({ friends: [friend] });

    renderButton(ROUTES.FRIENDS);

    expect(
        screen.getByRole('button', { name: 'Add expense' }).getAttribute('aria-disabled'),
    ).toBeNull();
});

test('keeps unresolved target availability loading during a cold sign-in', () => {
    useLoadingStore.getState().setLoading('group', 'list', 'loading');
    useLoadingStore.getState().setLoading('users', 'friends', 'loading');

    renderButton(ROUTES.DASHBOARD);

    const button = screen.getByRole('button', { name: 'Add expense' });

    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByText('Add friends or group members to start')).toBeNull();
});

test('does not treat a failed friends load as an empty dashboard', () => {
    useErrorsStore.getState().setError('users', 'friends', {
        message: 'Friends unavailable',
    });

    renderButton(ROUTES.DASHBOARD);

    const button = screen.getByRole('button', { name: 'Add expense' });

    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByText('Add friends or group members to start')).toBeNull();
});

test('does not treat a failed friends load as an empty Friends page', () => {
    useErrorsStore.getState().setError('users', 'friends', {
        message: 'Friends unavailable',
    });

    renderButton(ROUTES.FRIENDS);

    const button = screen.getByRole('button', { name: 'Add expense' });

    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByText('Add a friend to start')).toBeNull();
});

test('does not treat a failed group load as an empty group', () => {
    useErrorsStore.getState().setError('group', 'data', {
        message: 'Group unavailable',
    });

    renderButton(`${ROUTES.GROUP}/group-1`);

    const button = screen.getByRole('button', { name: 'Add expense' });

    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByText('Add group members to start')).toBeNull();
});

test('shows the unavailable mobile tooltip after target lists settle empty', async () => {
    const interaction = userEvent.setup();
    useLoadingStore.getState().setLoading('dashboard', 'data', 'loading');

    renderButton(ROUTES.DASHBOARD);

    const button = screen.getByRole('button', { name: 'Add expense' });

    expect(button).toHaveProperty('disabled', false);
    expect(button.getAttribute('aria-disabled')).toBe('true');

    await interaction.click(button);

    expect(
        (await screen.findAllByText('Add friends or group members to start')).length,
    ).toBeGreaterThan(0);
    expect(useExpenseModalStore.getState().isOpened).toBe(false);
});

test('shows the unavailable tooltip from the desktop sidebar', async () => {
    const interaction = userEvent.setup();

    renderButton(ROUTES.DASHBOARD, 'sidebar');

    const button = screen.getByRole('button', { name: 'Add expense' });

    expect(button).toHaveProperty('disabled', false);

    await interaction.hover(button);

    expect(
        (await screen.findAllByText('Add friends or group members to start')).length,
    ).toBeGreaterThan(0);
});

test('preserves loading behavior when an expense target is available', () => {
    useUsersStore.setState({ friends: [friend] });
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
