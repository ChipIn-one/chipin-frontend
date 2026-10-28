import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CreateSettlementParams, SelfUser } from 'api/chipin.types';
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
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
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
} satisfies SelfUser;

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

    const amountInput = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

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

    const amountInput = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    return user
        .click(amountInput)
        .then(() => user.click(amountInput))
        .then(() => user.keyboard('{End}{Backspace}'))
        .then(() => {
            expect(amountInput).toHaveProperty('value', '30.123');
        });
});

test('SET-003 prevents submitting more than the selected backend balance', () => {
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
    const onSubmit = vi
        .fn<(params: CreateSettlementParams) => Promise<void>>()
        .mockResolvedValue(undefined);
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

test('closes and shows success when the backend mutation succeeds', () => {
    const onSubmit = vi
        .fn<(params: CreateSettlementParams) => Promise<void>>()
        .mockResolvedValue(undefined);
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
            expect(onOpenChange).toHaveBeenCalledWith(false);
            expect(toast.success).toHaveBeenCalledWith('toasts:settlement.created');
            expect(toast.warning).not.toHaveBeenCalled();
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
            expect(toast.error).toHaveBeenCalledWith('toasts:common.requestFailed');
        });
});

const renderFriendSettleUp = (
    onSubmit = vi.fn<(params: CreateSettlementParams) => Promise<void>>(),
    balances = [{ currency: 'BZD', netAmount: -24.5678 }],
) =>
    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={balances}
            initialCurrency={balances[0].currency}
            onSubmit={onSubmit}
        />,
    );

test('labels the amount as an editable payment amount field', () => {
    renderFriendSettleUp();

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    expect(input).toHaveProperty('value', '24.5678');
    expect(screen.getByRole('button', { name: 'friends:settleUp.fullDebt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'friends:settleUp.half' })).toBeTruthy();
});

test('selects the amount on tap so typing replaces it', () => {
    const user = userEvent.setup();

    renderFriendSettleUp();

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    return user
        .click(input)
        .then(() => {
            expect(input).toHaveProperty('selectionStart', 0);
            expect(input).toHaveProperty('selectionEnd', '24.5678'.length);
            return user.keyboard('5');
        })
        .then(() => {
            expect(input).toHaveProperty('value', '5');
        });
});

test('keeps the caret after the user has typed into the autofocused amount', () => {
    const user = userEvent.setup();

    renderFriendSettleUp();

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    expect(document.activeElement).toBe(input);

    return user
        .keyboard('40')
        .then(() => {
            expect(input).toHaveProperty('value', '40');
            return user.click(input);
        })
        .then(() => user.keyboard('5'))
        .then(() => {
            expect(input).toHaveProperty('value', '405');
        });
});

test('selects the amount again when the field regains focus', () => {
    const user = userEvent.setup();

    renderFriendSettleUp();

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    return user
        .click(screen.getByRole('button', { name: 'friends:settleUp.half' }))
        .then(() => user.click(input))
        .then(() => user.keyboard('7'))
        .then(() => {
            expect(input).toHaveProperty('value', '7');
        });
});

test('keeps the debt summary amount as plain text', () => {
    renderFriendSettleUp();

    const debtSummary = screen.getByText(
        'friends:settleUp.youOwe:Bob Builder',
    ).parentElement?.parentElement;

    expect(debtSummary?.textContent).toContain('24.57 BZD');
    expect(debtSummary?.querySelector('button')).toBeNull();
    expect(screen.queryByRole('button', { name: /24.57 BZD/ })).toBeNull();
});

test('restores the exact full debt with the Full debt quick pick', () => {
    const user = userEvent.setup();

    renderFriendSettleUp();

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    return user
        .click(input)
        .then(() => user.keyboard('4'))
        .then(() => {
            expect(input).toHaveProperty('value', '4');
            return user.click(screen.getByRole('button', { name: 'friends:settleUp.fullDebt' }));
        })
        .then(() => {
            expect(input).toHaveProperty('value', '24.5678');
            expect(screen.getByText('friends:settleUp.debtWillBeSettled')).toBeTruthy();
        });
});

test('submits half of the debt with the Half quick pick and shows the remaining debt', () => {
    const onSubmit = vi
        .fn<(params: CreateSettlementParams) => Promise<void>>()
        .mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderFriendSettleUp(onSubmit, [{ currency: 'USD', netAmount: -100 }]);

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    return user
        .click(screen.getByRole('button', { name: 'friends:settleUp.half' }))
        .then(() => {
            expect(input).toHaveProperty('value', '50');
            expect(
                screen.getByText('friends:settleUp.remainingDebt').nextElementSibling?.textContent,
            ).toContain('50 USD');
            return user.click(
                screen.getByRole('button', { name: 'friends:settleUp.recordPayment' }),
            );
        })
        .then(() => {
            expect(onSubmit).toHaveBeenCalledWith({
                fromUserId: currentUser.id,
                toUserId: friend.id,
                amount: 50,
                currency: 'USD',
            });
        });
});

test('keeps Half within the API money precision and the debt', () => {
    const user = userEvent.setup();

    renderFriendSettleUp(undefined, [{ currency: 'BZD', netAmount: -0.0003 }]);

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    return user
        .click(screen.getByRole('button', { name: 'friends:settleUp.half' }))
        .then(() => {
            expect(input).toHaveProperty('value', '0.0002');
            expect(
                screen.getByRole('button', { name: 'friends:settleUp.recordPayment' }),
            ).toHaveProperty('disabled', false);
        });
});

test('resets a quick-picked amount to the full debt when the currency changes', () => {
    const user = userEvent.setup();

    renderFriendSettleUp(undefined, [
        { currency: 'USD', netAmount: -100 },
        { currency: 'EUR', netAmount: -30 },
    ]);

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    return user
        .click(screen.getByRole('button', { name: 'friends:settleUp.half' }))
        .then(() => {
            expect(input).toHaveProperty('value', '50');
            return user.click(screen.getByRole('combobox'));
        })
        .then(() => user.click(screen.getByRole('option', { name: 'EUR' })))
        .then(() => user.click(screen.getByRole('button', { name: 'friends:settleUp.half' })))
        .then(() => {
            expect(input).toHaveProperty('value', '15');
        });
});

test('submits only once while an earlier settlement request is pending', () => {
    let onResolve: (() => void) | undefined;
    const pendingRequest = new Promise<void>(resolve => {
        onResolve = resolve;
    });
    const onSubmit = vi.fn<(params: CreateSettlementParams) => Promise<void>>()
        .mockReturnValue(pendingRequest);
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

    const submit = screen.getByRole('button', { name: 'friends:settleUp.recordPayment' });

    return user
        .click(submit)
        .then(() => {
            expect(submit).toHaveProperty('disabled', true);
            expect(onSubmit).toHaveBeenCalledOnce();
            return user.click(submit);
        })
        .then(() => {
            expect(onSubmit).toHaveBeenCalledOnce();
            expect(onOpenChange).not.toHaveBeenCalledWith(false);
            onResolve?.();
            return pendingRequest;
        })
        .then(() => {
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
});

test('re-enables payment after rejection so the user can retry', () => {
    let onReject: ((reason: Error) => void) | undefined;
    const pendingRequest = new Promise<void>((_resolve, reject) => {
        onReject = reject;
    });
    const onSubmit = vi.fn<(params: CreateSettlementParams) => Promise<void>>()
        .mockReturnValueOnce(pendingRequest)
        .mockResolvedValueOnce(undefined);
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

    const submit = screen.getByRole('button', { name: 'friends:settleUp.recordPayment' });

    return user
        .click(submit)
        .then(() => {
            expect(submit).toHaveProperty('disabled', true);
            onReject?.(new Error('Request failed'));
            return waitFor(() => {
                expect(submit).toHaveProperty('disabled', false);
            });
        })
        .then(() => user.click(submit))
        .then(() => {
            expect(onSubmit).toHaveBeenCalledTimes(2);
        });
});
