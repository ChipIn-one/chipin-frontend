import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';
import { i18n } from 'i18n';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { ExpenseAmountFields } from './ExpenseAmountFields';

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

test('#725 names the amount and description inputs for assistive technology', () => {
    renderFields();

    const amount = screen.getByRole('textbox', { name: i18n.t('common:fields.amount') });
    const description = screen.getByRole('textbox', {
        name: i18n.t('common:fields.description'),
    });

    expect(amount).toBe(amountInput());
    expect(screen.getByLabelText(i18n.t('common:fields.amount'))).toBe(amount);
    expect(description).toBe(
        screen.getByPlaceholderText(i18n.t('group:expenses.modal.fields.descriptionPlaceholder')),
    );
});

test.each([
    ['100.', ['100.']],
    ['100.50', ['100.50', '100.5', '100.']],
])(
    '#706 EXP-064 a USD total %s switched to JPY can still be edited around its separator',
    (_, typed) => {
        renderFields();
        for (const value of typed) {
            fireEvent.change(amountInput(), { target: { value } });
        }
        act(() => useExpenseModalStore.getState().setCurrency('JPY'));

        fireEvent.change(amountInput(), { target: { value: '10.' } });
        expect(useExpenseModalStore.getState().amount).toBe('10.');
        fireEvent.change(amountInput(), { target: { value: '510.' } });
        expect(useExpenseModalStore.getState().amount).toBe('510.');
        fireEvent.change(amountInput(), { target: { value: '510.5' } });
        expect(useExpenseModalStore.getState().amount).toBe('510.');
        fireEvent.change(amountInput(), { target: { value: '200' } });
        expect(useExpenseModalStore.getState().amount).toBe('200');
        // Once the separator is gone, a JPY total does not take it back (#706).
        fireEvent.change(amountInput(), { target: { value: '200.' } });
        expect(useExpenseModalStore.getState().amount).toBe('200');
    },
);

test('#966 EXP-064 shows the zero-amount blocker below the amount field and links it', () => {
    renderFields();
    fireEvent.change(amountInput(), { target: { value: '0' } });

    const message = screen.getByRole('alert');
    expect(message.textContent).toBe(i18n.t('group:expenses.modal.submitFeedback.amount'));
    expect(amountInput().getAttribute('aria-invalid')).toBe('true');
    expect(amountInput().getAttribute('aria-describedby')).toBe(message.id);
    expect(message.compareDocumentPosition(amountInput())).toBe(Node.DOCUMENT_POSITION_PRECEDING);

    fireEvent.change(amountInput(), { target: { value: '10' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(amountInput().getAttribute('aria-invalid')).toBe('false');
    expect(amountInput().getAttribute('aria-describedby')).toBeNull();
});

test('#966 EXP-064 leaves another first blocker off the amount field', () => {
    renderFields();
    act(() => {
        const store = useExpenseModalStore.getState();
        store.toggleAllParticipants();
        store.setAmount('10');
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(amountInput().getAttribute('aria-invalid')).toBe('false');
    expect(amountInput().getAttribute('aria-describedby')).toBeNull();
});
