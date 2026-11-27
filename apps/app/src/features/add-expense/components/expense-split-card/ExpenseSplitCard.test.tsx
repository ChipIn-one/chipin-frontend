import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';
import { i18n } from 'i18n';
import { useExpenseModalStore } from 'store/expenseModalStore';

import fillStyles from 'basics/SegmentedControl.module.css';

import { ExpenseButtons } from '../expense-buttons/ExpenseButtons';
import { ExpensePayerSearchSelect } from '../expense-payer-search-select/ExpensePayerSearchSelect';

import ExpenseSplitCard from './ExpenseSplitCard';

import controlStyles from './components/expense-split-mode-control/ExpenseSplitModeControl.module.css';

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
    expect(screen.getAllByText(i18n.t('group:expenses.modal.submitFeedback.noDebt'))).toHaveLength(
        1,
    );
    expect(screen.queryByRole('alert')).toBeNull();

    act(() => useExpenseModalStore.getState().setAmount(''));
    expect(screen.getByRole('status').textContent).toBe('Enter an amount greater than zero.');
    expect(screen.queryByText(i18n.t('group:expenses.modal.submitFeedback.noDebt'))).toBeNull();
});

test.each([
    [EXPENSE_SPLIT_MODES.AMOUNTS, 'participantAmount'],
    [EXPENSE_SPLIT_MODES.PERCENT, 'participantPercent'],
    [EXPENSE_SPLIT_MODES.SHARES, 'participantShares'],
] as const)('#725 names each %s split input after its participant', (splitMode, labelKey) => {
    const store = useExpenseModalStore.getState();
    store.initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser, friend] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    store.setAmount('30');
    store.setSplitMode(splitMode);
    renderSplitCard();

    for (const participant of [currentUser, friend]) {
        const name = i18n.t(`group:expenses.modal.split.${labelKey}`, {
            name: participant.displayName,
        });

        expect(name).toContain(participant.displayName);
        expect(screen.getByRole('textbox', { name })).toBeTruthy();
    }
});

const SPLIT_MODE_LABELS = [
    [EXPENSE_SPLIT_MODES.EQUAL, 'equal'],
    [EXPENSE_SPLIT_MODES.PERCENT, 'percent'],
    [EXPENSE_SPLIT_MODES.AMOUNTS, 'amounts'],
    [EXPENSE_SPLIT_MODES.SHARES, 'shares'],
] as const;

const splitModeLabel = (key: (typeof SPLIT_MODE_LABELS)[number][1]) =>
    i18n.t(`group:expenses.modal.split.${key}`);

const renderGroupSplitCard = () => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser, friend] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    renderSplitCard();
};

test('#970 the split-mode control fills the card, keeps the phone tap target and all four labels', () => {
    renderGroupSplitCard();

    const root = screen
        .getByRole('radio', { name: splitModeLabel('equal') })
        .closest('.rt-SegmentedControlRoot');
    if (!(root instanceof HTMLElement)) {
        throw new Error('SegmentedControl root not found');
    }

    expect(fillStyles.fill).toBeTruthy();
    expect(controlStyles.tapTarget).toBeTruthy();
    expect(root.classList).toContain(fillStyles.fill);
    expect(root.classList).toContain(controlStyles.tapTarget);
    expect(root.classList).toContain('rt-r-size-2');
    expect(root.classList).toContain('sm:rt-r-size-3');
    for (const [, key] of SPLIT_MODE_LABELS) {
        expect(screen.getByRole('radio', { name: splitModeLabel(key) })).toBeTruthy();
    }
});

test('#970 switching the split mode by click and keyboard still updates the store', async () => {
    const user = userEvent.setup();
    renderGroupSplitCard();

    await user.click(screen.getByRole('radio', { name: splitModeLabel('shares') }));
    expect(useExpenseModalStore.getState().splitMode).toBe(EXPENSE_SPLIT_MODES.SHARES);

    const percent = screen.getByRole('radio', { name: splitModeLabel('percent') });
    act(() => percent.focus());
    await user.keyboard('{Enter}');
    expect(useExpenseModalStore.getState().splitMode).toBe(EXPENSE_SPLIT_MODES.PERCENT);
    expect(percent.getAttribute('aria-checked')).toBe('true');
});
