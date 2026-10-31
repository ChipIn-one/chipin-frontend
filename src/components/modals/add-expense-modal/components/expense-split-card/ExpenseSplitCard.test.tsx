import i18n from 'i18n/index';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { ExpenseButtons } from '../expense-buttons';
import { ExpensePayerSearchSelect } from '../expense-payer-search-select';

import ExpenseSplitCard from './ExpenseSplitCard';

const currentUser = { id: 'user-1', displayName: 'You', picture: null };
const friend = { id: 'user-2', displayName: 'Friend', picture: null };

const initializeDirectExpense = (skipCategory: boolean) => {
    const store = useExpenseModalStore.getState();
    store.initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory,
        groups: [],
        knownFriends: [friend],
        preferredFriendId: friend.id,
    });
    store.setAmount('10');
    store.setSplitMode(EXPENSE_SPLIT_MODES.SHARES);
    store.setSplitValue(currentUser.id, '1');
    store.setSplitValue(friend.id, '0');
};

const renderSplitCard = () =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ExpenseSplitCard />
            <ExpenseButtons onClose={vi.fn()} />
        </ThemeProvider>,
    );

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('EXP-064 announces the self-only blocker once beside submit when category is skipped', () => {
    initializeDirectExpense(true);
    renderSplitCard();

    expect(screen.getByRole('status').textContent).toBe(
        i18n.t('group:expenses.modal.submitFeedback.noDebt'),
    );
    expect(screen.queryByRole('alert')).toBeNull();

    act(() => {
        useExpenseModalStore.getState().setSplitValue(friend.id, '1');
    });
    expect(screen.getByRole('status').textContent).toBe('');

    act(() => {
        const store = useExpenseModalStore.getState();
        store.setSplitValue(currentUser.id, '0');
        store.setPaidById(friend.id);
    });
    expect(screen.getByRole('status').textContent).toContain('creates no debt');
    expect(screen.queryByRole('alert')).toBeNull();
});

test('EXP-064 reports only the first cause even when the payer control is visible', () => {
    initializeDirectExpense(false);
    renderSplitCard();
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ExpensePayerSearchSelect />
        </ThemeProvider>,
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getAllByText(i18n.t('group:expenses.modal.submitFeedback.noDebt'))).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();

    act(() => useExpenseModalStore.getState().setAmount(''));
    expect(screen.getByRole('status').textContent).toBe('Enter an amount greater than zero.');
    expect(screen.queryByText(i18n.t('group:expenses.modal.submitFeedback.noDebt'))).toBeNull();
});
