import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CreateSettlementParams, User } from 'api/chipin.types';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import SettleUpModal from './SettleUpModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { name?: string }) =>
            options?.name ? `${key}:${options.name}` : key,
    }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies User;

const friend = {
    id: 'user-2',
    email: 'bob@example.com',
    displayName: 'Bob Builder',
    firstName: 'Bob',
    lastName: 'Builder',
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

beforeEach(() => {
    vi.clearAllMocks();
    useUsersStore.setState({ user: currentUser });
    useLoadingStore.getState().setInitialLoadingStore();
});

test('provides an accessible dialog description', () => {
    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[{ currency: 'USD', netAmount: -100 }]}
            initialCurrency="USD"
            onSubmit={vi.fn()}
        />,
    );

    const dialog = screen.getByRole('dialog');
    const descriptionId = dialog.getAttribute('aria-describedby');

    expect(descriptionId).not.toBeNull();
    expect(document.getElementById(descriptionId ?? '')?.textContent).toBe(
        'friends:settleUp.noMoneyMoves',
    );
});

test('renders non-input amounts with two-digit precision and keeps the input exact', () => {
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[{ currency: 'BZD', netAmount: -24.5678 }]}
            initialCurrency="BZD"
            onSubmit={vi.fn()}
        />,
    );

    const amountInput = screen.getByRole('textbox', { name: 'common:fields.amount' });

    expect(amountInput).toHaveProperty('value', '24.5678');
    expect(screen.getByText('24.57 BZD')).toBeTruthy();

    return user
        .clear(amountInput)
        .then(() => user.type(amountInput, '4'))
        .then(() => {
            expect(screen.getByText('20.57 BZD')).toBeTruthy();
        });
});

test('allows editing a prefilled amount with more than two decimal places', () => {
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[{ currency: 'EUR', netAmount: -30.1234 }]}
            initialCurrency="EUR"
            onSubmit={vi.fn()}
        />,
    );

    const amountInput = screen.getByRole('textbox', { name: 'common:fields.amount' });

    return user.type(amountInput, '{backspace}').then(() => {
        expect(amountInput).toHaveProperty('value', '30.123');
    });
});

test('prevents submitting more than the selected backend balance', () => {
    const onSubmit = vi.fn<(params: CreateSettlementParams) => Promise<void>>();
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[{ currency: 'USD', netAmount: -100 }]}
            initialCurrency="USD"
            onSubmit={onSubmit}
        />,
    );

    const amountInput = screen.getByRole('textbox');

    return user
        .clear(amountInput)
        .then(() => user.type(amountInput, '100.01'))
        .then(() => {
            expect(
                screen.getByRole('button', { name: 'friends:settleUp.recordPayment' }),
            ).toHaveProperty('disabled', true);
        });
});

test('shows compact debt context and the remaining amount for a partial payment', () => {
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[{ currency: 'USD', netAmount: -100 }]}
            initialCurrency="USD"
            onSubmit={vi.fn()}
        />,
    );

    const amountInput = screen.getByRole('textbox');

    const debtSummary = screen.getByText(
        'friends:settleUp.youOwe:Bob Builder',
    ).parentElement?.parentElement;

    expect(debtSummary?.textContent).toContain('100 USD');
    expect(screen.queryByText('friends:settleUp.you')).toBeNull();

    return user
        .clear(amountInput)
        .then(() => user.type(amountInput, '40'))
        .then(() => {
            const remainingLabel = screen.getByText('friends:settleUp.remainingDebt');
            const remainingAmount = remainingLabel.nextElementSibling;

            expect(remainingLabel.getAttribute('data-accent-color')).toBe('gray');
            expect(remainingAmount?.getAttribute('data-accent-color')).toBe('red');
            expect(remainingAmount?.textContent).toContain('60 USD');
        });
});

test('shows that the debt will be settled when the full amount is entered', () => {
    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[{ currency: 'USD', netAmount: -100 }]}
            initialCurrency="USD"
            onSubmit={vi.fn()}
        />,
    );

    const settledStatus = screen.getByText('friends:settleUp.debtWillBeSettled');

    expect(settledStatus.getAttribute('data-accent-color')).toBe('green');
    expect(settledStatus.parentElement?.querySelector('svg')).not.toBeNull();
});

test('updates the amount, context, and remaining debt when the currency changes', () => {
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[
                { currency: 'USD', netAmount: -100 },
                { currency: 'EUR', netAmount: -30 },
            ]}
            initialCurrency="USD"
            onSubmit={vi.fn()}
        />,
    );

    return user
        .click(screen.getByRole('combobox'))
        .then(() => user.click(screen.getByRole('option', { name: 'EUR' })))
        .then(() => {
            expect(screen.getByRole('textbox')).toHaveProperty('value', '30');
            expect(
                screen.getByText('friends:settleUp.youOwe:Bob Builder').parentElement
                    ?.parentElement
                    ?.textContent,
            ).toContain('30 EUR');
            expect(screen.getByText('friends:settleUp.debtWillBeSettled')).toBeTruthy();
        });
});

test('submits a partial payment through the provided action and closes after success', () => {
    const onSubmit = vi.fn<(params: CreateSettlementParams) => Promise<void>>().mockResolvedValue();
    const onOpenChange = vi.fn<(isOpen: boolean) => void>();
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={onOpenChange}
            friend={friend}
            balances={[{ currency: 'USD', netAmount: -100 }]}
            initialCurrency="USD"
            onSubmit={onSubmit}
        />,
    );

    const amountInput = screen.getByRole('textbox');

    return user
        .clear(amountInput)
        .then(() => user.type(amountInput, '40'))
        .then(() =>
            user.click(screen.getByRole('button', { name: 'friends:settleUp.recordPayment' })),
        )
        .then(() => {
            expect(onSubmit).toHaveBeenCalledWith({
                fromUserId: currentUser.id,
                toUserId: friend.id,
                amount: 40,
                currency: 'USD',
            });
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
});

test('keeps the modal open when the provided action rejects', () => {
    const onSubmit = vi
        .fn<(params: CreateSettlementParams) => Promise<void>>()
        .mockRejectedValue(new Error('Settlement failed'));
    const onOpenChange = vi.fn<(isOpen: boolean) => void>();
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={onOpenChange}
            friend={friend}
            balances={[{ currency: 'USD', netAmount: -100 }]}
            initialCurrency="USD"
            onSubmit={onSubmit}
        />,
    );

    return user
        .click(screen.getByRole('button', { name: 'friends:settleUp.recordPayment' }))
        .then(() => {
            expect(onSubmit).toHaveBeenCalledOnce();
            expect(onOpenChange).not.toHaveBeenCalledWith(false);
        });
});
