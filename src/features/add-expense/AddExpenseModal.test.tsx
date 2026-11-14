import { screen } from '@testing-library/react';
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
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';

import AddExpenseModal from './AddExpenseModal';

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
