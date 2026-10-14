import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';
import i18n from 'i18n/index';
import { useExpenseModalStore } from 'store/expenseModalStore';

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
        </ThemeProvider>,
    );

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('shows the self-only Callout near shares when Skip category hides the payer control', () => {
    initializeDirectExpense(true);
    renderSplitCard();

    expect(screen.getByRole('alert').textContent).toContain(
        i18n.t('group:expenses.modal.directSelfOnlyWarning'),
    );

    act(() => {
        useExpenseModalStore.getState().setSplitValue(friend.id, '1');
    });
    expect(screen.queryByRole('alert')).toBeNull();

    act(() => {
        const store = useExpenseModalStore.getState();
        store.setSplitValue(currentUser.id, '0');
        store.setPaidById(friend.id);
    });
    expect(screen.getByRole('alert').textContent).toContain('creates no debt');
});

test('does not duplicate the payer Callout near shares when the payer control is visible', () => {
    initializeDirectExpense(false);
    renderSplitCard();

    expect(screen.queryByRole('alert')).toBeNull();
});
