import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';
import { useExpenseModalStore } from 'store/expenseModalStore';

import ExpenseUsersList from './ExpenseUsersList';

const stepperRender = vi.hoisted(() => vi.fn());

vi.mock('../expense-input-actions', () => ({
    ExpenseInputActions: () => {
        stepperRender();

        return <input aria-label="Value" />;
    },
}));

const currentUser = { id: 'user-1', displayName: 'Alex', picture: null };
const groupMember = { id: 'user-2', displayName: 'Sam', picture: null };

beforeEach(() => {
    stepperRender.mockClear();
    useExpenseModalStore.getState().reset();
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser, groupMember] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    useExpenseModalStore.getState().setAmount('50');
});

test('renders the calculated amount with the participant identity', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ExpenseUsersList />
        </ThemeProvider>,
    );

    const participantDetails = screen.getByText('Alex').parentElement;

    expect(participantDetails?.textContent).toContain('Alex');
    expect(participantDetails?.textContent).toContain('25 USD');
});

test('rerenders only the participant whose split value changed', () => {
    useExpenseModalStore.getState().setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ExpenseUsersList />
        </ThemeProvider>,
    );

    expect(stepperRender).toHaveBeenCalledTimes(2);

    act(() => {
        useExpenseModalStore.getState().setSplitValue(currentUser.id, '60');
    });

    expect(stepperRender).toHaveBeenCalledTimes(3);
});
