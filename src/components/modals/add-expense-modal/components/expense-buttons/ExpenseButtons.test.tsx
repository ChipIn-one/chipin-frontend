import i18n from 'i18n/index';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useLoadingStore } from 'store/loadingStore';

import ExpenseButtons from './ExpenseButtons';

const currentUser = { id: 'self', displayName: 'You', picture: null };
const friend = { id: 'friend', displayName: 'Friend', picture: null };

beforeEach(() => {
    useLoadingStore.getState().setInitialLoadingStore();
    useExpenseModalStore.getState().reset();
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group', members: [currentUser, friend] }],
        knownFriends: [friend],
    });
});

afterEach(() => i18n.changeLanguage('en'));

test('EXP-064 describes the first blocking amount with a polite atomic status', () => {
    render(<ExpenseButtons onClose={vi.fn()} />);

    const status = screen.getByRole('status');
    const button = screen.getByRole('button', { name: 'Add expense' });
    expect(status.textContent).toBe('Enter an amount greater than zero.');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(button.getAttribute('aria-describedby')).toBe(status.id);
    expect(button).toHaveProperty('disabled', true);
});

test('EXP-064 keeps the status mounted as participant feedback clears and returns', () => {
    render(<ExpenseButtons onClose={vi.fn()} />);
    const status = screen.getByRole('status');
    const button = screen.getByRole('button', { name: 'Add expense' });

    act(() => {
        const store = useExpenseModalStore.getState();
        store.toggleAllParticipants();
        store.setAmount('10');
    });
    expect(status.textContent).toBe('Select eligible participants for this expense. For a direct expense, select a friend whose invitation has been accepted.');
    expect(button).toHaveProperty('disabled', true);

    act(() => useExpenseModalStore.getState().toggleAllParticipants());
    expect(screen.getByRole('status')).toBe(status);
    expect(status.textContent).toBe('');
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(button).toHaveProperty('disabled', false);

    act(() => useExpenseModalStore.getState().setAmount('0'));
    expect(screen.getByRole('status')).toBe(status);
    expect(button.getAttribute('aria-describedby')).toBe(status.id);
});

test.each([
    ['40', '40', 'Percentages total 80%. Add the remaining 20% to reach 100%.'],
    ['60', '60', 'Percentages total 120%. Remove the excess 20% to reach 100%.'],
])('EXP-064 shows exact percentage totals for %s + %s', (self, other, message) => {
    const store = useExpenseModalStore.getState();
    store.setAmount('10');
    store.setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);
    store.setSplitValue(currentUser.id, self);
    store.setSplitValue(friend.id, other);
    render(<ExpenseButtons onClose={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toBe(message);
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);

    act(() => store.setSplitValue(friend.id, String(100 - Number(self))));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', false);
});

test.each([
    ['9.998', 'Allocated 9.998 USD of 10 USD. Add the remaining 0.002 USD so the amounts equal the expense total.'],
    ['10.002', 'Allocated 10.002 USD of 10 USD. Remove the excess 0.002 USD so the amounts equal the expense total.'],
])('EXP-064 preserves the visible exact amount mismatch for %s', (allocated, message) => {
    useExpenseModalStore.setState({
        amount: '10',
        splitMode: EXPENSE_SPLIT_MODES.AMOUNTS,
        amountShares: { self: allocated, friend: '0' },
    });
    render(<ExpenseButtons onClose={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toBe(message);
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);

    act(() => useExpenseModalStore.setState({ amountShares: { self: '5', friend: '5' } }));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', false);
});

test('EXP-064 explains a non-positive total share weight', () => {
    useExpenseModalStore.setState({
        amount: '10',
        splitMode: EXPENSE_SPLIT_MODES.SHARES,
        shareWeights: { self: '0', friend: '0' },
    });
    render(<ExpenseButtons onClose={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('Give at least one participant a positive share. The total share weight must be greater than zero.');

    act(() => useExpenseModalStore.getState().setSplitValue(friend.id, '1'));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', false);
});

test('EXP-064 distinguishes an unchanged Save from invalid input and submission in progress', () => {
    useExpenseModalStore.setState({
        amount: '10',
        mode: 'edit',
        editContext: {
            entryId: 'entry',
            original: {
                description: null,
                amount: 10,
                payerId: currentUser.id,
                participantIds: [currentUser.id, friend.id],
                currency: 'USD',
                category: 'food',
                subcategory: null,
                sharingMode: { type: 'AUTO' },
            },
        },
    });
    render(<ExpenseButtons onClose={vi.fn()} />);
    const status = screen.getByRole('status');
    const button = screen.getByRole('button', { name: 'Save' });
    expect(status.textContent).toBe('Make a change to save this expense.');
    expect(button).toHaveProperty('disabled', true);

    act(() => useExpenseModalStore.getState().setDescription('Lunch'));
    expect(status.textContent).toBe('');
    expect(button).toHaveProperty('disabled', false);

    act(() => useLoadingStore.getState().setLoading('expense', 'update', 'loading'));
    expect(status.textContent).toBe('');
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(button).toHaveProperty('disabled', true);

    act(() => useExpenseModalStore.getState().setAmount(''));
    expect(status.textContent).toBe('');
    act(() => useLoadingStore.getState().setLoading('expense', 'update', 'fetched'));
    expect(status.textContent).toBe('Enter an amount greater than zero.');
    expect(button.getAttribute('aria-describedby')).toBe(status.id);
});

test.each(['en', 'ru', 'es', 'pt-BR', 'pt-PT'])('EXP-064 localizes all blocker messages in %s', language => {
    const reasons = ['amount', 'target', 'participants', 'payer', 'percentUnder', 'percentOver', 'amountsUnder', 'amountsOver', 'shares', 'noDebt', 'unchanged'];
    return i18n.changeLanguage(language).then(() => {
        for (const reason of reasons) {
            expect(i18n.exists(`group:expenses.modal.submitFeedback.${reason}`, { lng: language, fallbackLng: false })).toBe(true);
        }
        render(<ExpenseButtons onClose={vi.fn()} />);
        const status = screen.getByRole('status');
        expect(status.textContent).not.toBe('');
        expect(status.textContent).not.toContain('submitFeedback');
        if (language !== 'en') {
            expect(status.textContent).not.toBe('Enter an amount greater than zero.');
        }
    });
});

test('keeps cancellation available while input is invalid', () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseButtons onClose={onClose} />);
    return user.click(screen.getByRole('button', { name: 'Cancel' })).then(() => {
        expect(onClose).toHaveBeenCalledOnce();
    });
});
