import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';
import { useExpenseModalStore } from 'store/expenseModalStore';

import ExpenseAmountFields from './ExpenseAmountFields';

const currentUser = { id: 'self', displayName: 'You', picture: null };
const friend = { id: 'friend', displayName: 'Friend', picture: null };

const initialize = (currency: string) => {
    useExpenseModalStore.getState().reset();
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: currency,
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group', members: [currentUser, friend] }],
        knownFriends: [],
    });
};

const renderFields = () =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ExpenseAmountFields />
        </ThemeProvider>,
    );

const amountInput = () => screen.getByPlaceholderText('0.00');

beforeEach(() => initialize('USD'));

test('EXP-064 limits the total to the currency minor units: JPY "100.50" is not enterable', () => {
    initialize('JPY');
    renderFields();

    fireEvent.change(amountInput(), { target: { value: '100' } });
    fireEvent.change(amountInput(), { target: { value: '100.5' } });
    fireEvent.change(amountInput(), { target: { value: '100.50' } });

    expect(useExpenseModalStore.getState().amount).toBe('100');
});

test('EXP-064 accepts KWD thousandths and USD cents only', () => {
    initialize('KWD');
    const { unmount } = renderFields();
    fireEvent.change(amountInput(), { target: { value: '1.235' } });
    expect(useExpenseModalStore.getState().amount).toBe('1.235');
    unmount();

    initialize('USD');
    renderFields();
    fireEvent.change(amountInput(), { target: { value: '1.25' } });
    fireEvent.change(amountInput(), { target: { value: '1.255' } });
    expect(useExpenseModalStore.getState().amount).toBe('1.25');
});

test('EXP-064 keeps a USD total on a switch to JPY and still lets it be erased', () => {
    renderFields();
    fireEvent.change(amountInput(), { target: { value: '100.50' } });
    useExpenseModalStore.getState().setCurrency('JPY');

    expect(useExpenseModalStore.getState().amount).toBe('100.50');
    fireEvent.change(amountInput(), { target: { value: '100.5' } });
    fireEvent.change(amountInput(), { target: { value: '100.' } });
    expect(useExpenseModalStore.getState().amount).toBe('100.');
});
