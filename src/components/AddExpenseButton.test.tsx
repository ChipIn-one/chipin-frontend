import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { fireEvent, render, screen } from '@testing-library/react';

import type { Group, KnownUser, SelfUser } from 'api/chipin.types';
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

const groupCreator = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    firstName: 'Owner',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const selfUser = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    createdAt: 1,
    updatedAt: 1,
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
} satisfies SelfUser;

const groupMember = {
    ...groupCreator,
    id: 'user-2',
    email: 'member@example.com',
    displayName: 'Member',
    firstName: 'Member',
};

const singleMemberGroup = {
    id: 'group-1',
    name: 'Group',
    inviteToken: 'invite-token',
    description: null,
    creator: groupCreator,
    members: [{ user: groupCreator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

const readyGroup = {
    ...singleMemberGroup,
    members: [
        { user: groupCreator, balancesByCurrency: {} },
        { user: groupMember, balancesByCurrency: {} },
    ],
} satisfies Group;

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

const resolveGlobalTargets = () => {
    useLoadingStore
        .getState()
        .setLoading('group', 'list', 'fetched');
    useLoadingStore
        .getState()
        .setLoading('users', 'friends', 'fetched');
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    useExpenseModalStore.getState().reset();
    useGroupsStore.getState().setInitialGroupsStore();
    useErrorsStore.getState().resetErrors();
    useUsersStore.setState({
        user: selfUser,
        localUser: null,
        friends: [],
    });
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('users', 'self', 'fetched');
});

test.each(['mobile', 'desktop', 'sidebar'] as const)(
    'EXP-061 hides the unresolved %s Add Expense action',
    type => {
        renderButton(ROUTES.DASHBOARD, type);

        expect(
            screen.queryByRole('button', {
                name: 'Add expense',
            }),
        ).toBeNull();
    },
);

test('EXP-061 hides a stale friend target while its data is unresolved', () => {
    useUsersStore.setState({ friends: [friend] });

    renderButton(ROUTES.DASHBOARD);

    expect(
        screen.queryByRole('button', { name: 'Add expense' }),
    ).toBeNull();
});

test('EXP-061 does not expose Add Expense before current user resolves', () => {
    resolveGlobalTargets();
    useUsersStore.setState({ friends: [friend] });
    useLoadingStore.getState().setLoading('users', 'self', 'loading');

    renderButton(ROUTES.DASHBOARD);

    expect(
        screen.queryByRole('button', { name: 'Add expense' }),
    ).toBeNull();
});

test('EXP-061 does not expose Add Expense when self request resolves without a user', () => {
    resolveGlobalTargets();
    useUsersStore.setState({ user: null, friends: [friend] });

    renderButton(ROUTES.DASHBOARD);

    expect(
        screen.queryByRole('button', { name: 'Add expense' }),
    ).toBeNull();
});

test.each([
    ROUTES.DASHBOARD,
    ROUTES.ACTIVITY,
    ROUTES.SETTINGS,
])('EXP-060 uses the global friend target rule on %s', route => {
    resolveGlobalTargets();
    useUsersStore.setState({ friends: [friend] });

    renderButton(route);

    expect(
        screen.getByRole('button', { name: 'Add expense' }),
    ).toBeTruthy();
});

test.each([
    ROUTES.DASHBOARD,
    ROUTES.ACTIVITY,
    ROUTES.SETTINGS,
])('EXP-060 excludes a one-member group from global targets on %s', route => {
    resolveGlobalTargets();
    useGroupsStore.setState({ groups: [singleMemberGroup] });

    renderButton(route);

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
});

test('EXP-060 hides the global action when resolved targets are empty', () => {
    resolveGlobalTargets();

    renderButton(ROUTES.DASHBOARD);

    expect(
        screen.queryByRole('button', { name: 'Add expense' }),
    ).toBeNull();
});

test('EXP-060 shows Add Expense for a two-member group', () => {
    resolveGlobalTargets();
    useGroupsStore.setState({ groups: [readyGroup] });

    renderButton(ROUTES.DASHBOARD);

    expect(
        screen.getByRole('button', { name: 'Add expense' }),
    ).toBeTruthy();
});

test('EXP-060 Friends ignores a ready group when there is no friend', () => {
    resolveGlobalTargets();
    useGroupsStore.setState({ groups: [readyGroup] });

    renderButton(ROUTES.FRIENDS);

    expect(
        screen.queryByRole('button', { name: 'Add expense' }),
    ).toBeNull();
});

test('EXP-060 Friends shows Add Expense when a friend is resolved', () => {
    useLoadingStore
        .getState()
        .setLoading('users', 'friends', 'fetched');
    useUsersStore.setState({ friends: [friend] });

    renderButton(ROUTES.FRIENDS);

    expect(
        screen.getByRole('button', { name: 'Add expense' }),
    ).toBeTruthy();
});

test('EXP-060 Group hides Add Expense with one member', () => {
    useGroupsStore.setState({ groups: [singleMemberGroup] });
    useLoadingStore
        .getState()
        .setLoading('group', 'list', 'fetched');

    renderButton(`${ROUTES.GROUP}/group-1`);

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
});

test('EXP-060 Group shows Add Expense with enough members', () => {
    useGroupsStore.setState({ groups: [readyGroup] });
    useLoadingStore
        .getState()
        .setLoading('group', 'list', 'fetched');

    renderButton(`${ROUTES.GROUP}/group-1`);

    expect(
        screen.getByRole('button', { name: 'Add expense' }),
    ).toBeTruthy();
});

test('EXP-061 hides Add Expense after target-load failure without a valid target', () => {
    resolveGlobalTargets();
    useErrorsStore.getState().setError('users', 'friends', {
        message: 'Friends unavailable',
    });
    useErrorsStore.getState().setError('group', 'list', {
        message: 'Groups unavailable',
    });

    renderButton(ROUTES.DASHBOARD);

    expect(
        screen.queryByRole('button', { name: 'Add expense' }),
    ).toBeNull();
});

test('opens Add Expense when a valid target exists', () => {
    resolveGlobalTargets();
    useUsersStore.setState({ friends: [friend] });

    renderButton(ROUTES.DASHBOARD);

    fireEvent.click(
        screen.getByRole('button', { name: 'Add expense' }),
    );

    expect(useExpenseModalStore.getState().isOpened).toBe(true);
});

test('EXP-060 keeps global Add Expense for a friend even if a one-member group exists', () => {
    resolveGlobalTargets();
    useUsersStore.setState({ friends: [friend] });
    useGroupsStore.setState({ groups: [singleMemberGroup] });

    renderButton(ROUTES.DASHBOARD);

    expect(screen.getByRole('button', { name: 'Add expense' })).toBeTruthy();
});

test('EXP-060 excludes a one-member group on its own route even with a direct friend', () => {
    resolveGlobalTargets();
    useUsersStore.setState({ friends: [friend] });
    useGroupsStore.setState({ groups: [singleMemberGroup] });

    renderButton(`${ROUTES.GROUP}/group-1`);

    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
});
