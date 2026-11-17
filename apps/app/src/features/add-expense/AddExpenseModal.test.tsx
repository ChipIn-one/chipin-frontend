import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import type { Group } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { currencyRatesKeys, EMPTY_CURRENCY_RATES } from 'entities/currency-rates';
import { useAuthStore } from 'store/authStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { seedGroupsList } from 'test/groupsList';
import { createKnownUser, seedKnownUsers } from 'test/knownUsers';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';

import { AddExpenseModal } from './AddExpenseModal';

import 'i18n/index';

// Rates already loaded: the currency picker does not request them.
const ratesClient = () => {
    const client = createTestQueryClient();

    client.setQueryData(currencyRatesKeys.all, EMPTY_CURRENCY_RATES);
    return client;
};

const creator = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: 'https://cdn.example.com/group.webp',
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

beforeEach(() => {
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP, lastGroupId: group.id });
    useExpenseModalStore.getState().reset();
    useAuthStore.setState({ status: 'authenticated' });
    seedGroupsList([group]);
    useExpenseModalStore.getState().open();
});

test('does not render a single-member notice in the modal', () => {
    renderWithQueryClient(
        <MemoryRouter initialEntries={['/group/group-1']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );

    expect(screen.getByRole('status').textContent).toBe('Enter an amount greater than zero.');
    expect(screen.queryByText(/invite.*members/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);
});

test('uses the edit title and Save action in edit mode', () => {
    useExpenseModalStore.setState({ mode: 'edit', isOpened: true });

    renderWithQueryClient(
        <MemoryRouter initialEntries={['/activity']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );

    expect(screen.getByText('Edit expense')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
});

// Spec 03 §4.3 (03-14b): the form has no date field (removed in #327), so an edit never changes
// the date and the update patch has no `date`.
test('EXP-064 the edit form shows no date field: the date of an expense is read-only', () => {
    useExpenseModalStore.setState({ mode: 'edit', isOpened: true, date: 1_717_200_000 });

    renderWithQueryClient(
        <MemoryRouter initialEntries={['/activity']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );

    const dialog = screen.getByRole('dialog');

    expect(screen.getByText('Edit expense')).not.toBeNull();
    expect(screen.queryByLabelText('Date')).toBeNull();
    expect(dialog.querySelector('input[type="datetime-local"], input[type="date"]')).toBeNull();
});

const member = { ...creator, id: 'user-2', email: 'bob@example.com', displayName: 'Bob' };

// #718: a group of two (an expense needs two participants) with a currency, and a newer group the
// list shows first.
const tripGroup = {
    ...group,
    members: [
        { user: creator, balancesByCurrency: {} },
        { user: member, balancesByCurrency: {} },
    ],
    lastUsedCurrency: 'USD',
} satisfies Group;
const newerGroup = { ...tripGroup, id: 'group-2', name: 'Flat', updatedAt: 2 } satisfies Group;

const renderAt = (path: string) =>
    renderWithQueryClient(
        <MemoryRouter initialEntries={[path]}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );

/** The groups list resolves; the query notifies its observers on a later task. */
const receiveGroupsList = async (groups: Parameters<typeof seedGroupsList>[0]) => {
    await act(async () => {
        seedGroupsList(groups);
        await new Promise(resolve => {
            setTimeout(resolve, 0);
        });
    });
};

const enterAmount = (value: string) => {
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value } });
};

const submitButton = () => screen.getByRole('button', { name: 'Add expense' });

// #718: Add expense opened before `GET /groups` resolved.
test('EXP-063 a group page opened before the groups list loads uses that group once it arrives', async () => {
    seedGroupsList([]);
    renderAt('/group/group-1');

    expect(useExpenseModalStore.getState().groupId).toBe('');

    await receiveGroupsList([newerGroup, tripGroup]);
    enterAmount('10');

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('group');
    expect(state.groupId).toBe(tripGroup.id);
    expect(submitButton()).toHaveProperty('disabled', false);
});

test('EXP-063 a group page whose group is not in the loaded list picks no other group', async () => {
    useUiPrefsStore.setState({ lastGroupId: newerGroup.id });
    seedGroupsList([]);
    renderAt('/group/group-9');

    await receiveGroupsList([newerGroup, tripGroup]);

    expect(useExpenseModalStore.getState().groupId).toBe('');
});

test('EXP-063 a group picked on the dashboard after the groups list arrived has its members', async () => {
    const interaction = userEvent.setup();

    useUiPrefsStore.setState({ lastGroupId: null });
    seedKnownUsers([createKnownUser('user-5')]);
    seedGroupsList([]);
    renderAt('/');

    expect(useExpenseModalStore.getState().targetMode).toBe('friends');

    await receiveGroupsList([newerGroup, tripGroup]);
    await interaction.click(screen.getByRole('radio', { name: 'Group' }));
    await interaction.click(screen.getByRole('button', { name: /Group/ }));
    await interaction.click(screen.getByText(tripGroup.name));
    enterAmount('10');

    const state = useExpenseModalStore.getState();

    expect(state.groupId).toBe(tripGroup.id);
    expect(state.paidById).not.toBe('');
    expect(submitButton()).toHaveProperty('disabled', false);
});

test('EXP-063 a friend target the user chose before the groups list arrived is kept', async () => {
    const interaction = userEvent.setup();

    useUiPrefsStore.setState({ lastGroupId: null });
    seedKnownUsers([createKnownUser('user-5')]);
    seedGroupsList([]);
    renderAt('/');

    await interaction.click(screen.getByRole('radio', { name: 'Friends' }));
    await receiveGroupsList([newerGroup, tripGroup]);

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('friends');
    expect(state.groupId).toBe('');
});

test('EXP-063 an edit-expense modal is not reinitialized when the groups list arrives', async () => {
    seedGroupsList([]);
    useExpenseModalStore.setState({
        mode: 'edit',
        isOpened: true,
        targetMode: 'group',
        groupId: '',
        description: 'Dinner',
    });
    renderAt('/group/group-1');

    await receiveGroupsList([tripGroup]);

    const state = useExpenseModalStore.getState();

    expect(state.mode).toBe('edit');
    expect(state.groupId).toBe('');
    expect(state.description).toBe('Dinner');
});
