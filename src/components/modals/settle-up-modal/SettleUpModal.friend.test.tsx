import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import type { Balance } from 'entities/balance';
import type { SettlementDraft } from 'entities/ledger';
import { currencyCode, fromUnits, type Money } from 'shared/money';
import { getOrThrow } from 'test/getOrThrow';
import { seedSelfUser } from 'test/selfUserSeed';

import SettleUpModal from './SettleUpModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { name?: string; amount?: string; currency?: string }) => {
            if (options?.amount) {
                return `${key}:${options.amount} ${options.currency ?? ''}`;
            }
            return options?.name ? `${key}:${options.name}` : key;
        },
    }),
}));

// An amount written as a ledger decimal of scale 4 ("-24.5678" → -245_678n).
const money = (decimal: string, currency = 'USD'): Money => {
    const [integer = '0', fraction = ''] = decimal.split('.');

    return fromUnits(BigInt(`${integer}${fraction.padEnd(4, '0')}`), currencyCode(currency));
};

const balance = (net: string, currency = 'USD'): Balance => ({ net: money(net, currency) });

const FULL_SETTLEMENT_HINT = 'friends:settleUp.fullSettlementHint';

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
    seedSelfUser(currentUser);
});

test('provides an accessible dialog description', () => {
    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[balance('-100', 'USD')]}
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

test('renders amounts with two-digit precision and prefills the debt rounded to minor units', () => {
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[balance('-24.5678', 'BZD')]}
            initialCurrency="BZD"
            onSubmit={vi.fn()}
        />,
    );

    const amountInput = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    expect(amountInput).toHaveProperty('value', '24.57');
    expect(screen.getByText('24.57 BZD')).toBeTruthy();

    return user
        .clear(amountInput)
        .then(() => user.type(amountInput, '4'))
        .then(() => {
            expect(screen.getByText('20.57 BZD')).toBeTruthy();
        });
});

test('allows editing the prefilled amount', () => {
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[balance('-30.1234', 'EUR')]}
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
            expect(amountInput).toHaveProperty('value', '30.1');
        });
});

test('SET-003 prevents submitting more than the selected backend balance', () => {
    const onSubmit = vi.fn<(params: SettlementDraft) => Promise<void>>();
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[balance('-100', 'USD')]}
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
            balances={[balance('-100', 'USD')]}
            initialCurrency="USD"
            onSubmit={vi.fn()}
        />,
    );

    const amountInput = screen.getByRole('textbox');

    const debtSummary = screen.getByText('friends:settleUp.youOwe:Bob Builder').parentElement
        ?.parentElement;

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
            balances={[balance('-100', 'USD')]}
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
            balances={[balance('-100', 'USD'), balance('-30', 'EUR')]}
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
                screen.getByText('friends:settleUp.youOwe:Bob Builder').parentElement?.parentElement
                    ?.textContent,
            ).toContain('30 EUR');
            expect(screen.getByText('friends:settleUp.debtWillBeSettled')).toBeTruthy();
        });
});

test('submits a partial payment through the provided action and closes after success', () => {
    const onSubmit = vi
        .fn<(params: SettlementDraft) => Promise<void>>()
        .mockResolvedValue(undefined);
    const onOpenChange = vi.fn<(isOpen: boolean) => void>();
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={onOpenChange}
            friend={friend}
            balances={[balance('-100', 'USD')]}
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
                amount: money('40'),
            });
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
});

test('closes and shows success when the backend mutation succeeds', () => {
    const onSubmit = vi
        .fn<(params: SettlementDraft) => Promise<void>>()
        .mockResolvedValue(undefined);
    const onOpenChange = vi.fn<(isOpen: boolean) => void>();
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={onOpenChange}
            friend={friend}
            balances={[balance('-100', 'USD')]}
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
        .fn<(params: SettlementDraft) => Promise<void>>()
        .mockRejectedValue(new Error('Settlement failed'));
    const onOpenChange = vi.fn<(isOpen: boolean) => void>();
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={onOpenChange}
            friend={friend}
            balances={[balance('-100', 'USD')]}
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
    onSubmit = vi.fn<(params: SettlementDraft) => Promise<void>>(),
    balances = [balance('-24.5678', 'BZD')],
) =>
    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={balances}
            initialCurrency={getOrThrow(balances, 0).net.currency}
            onSubmit={onSubmit}
        />,
    );

test('labels the amount as an editable payment amount field', () => {
    renderFriendSettleUp();

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    expect(input).toHaveProperty('value', '24.57');
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
            expect(input).toHaveProperty('selectionEnd', '24.57'.length);
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

    const debtSummary = screen.getByText('friends:settleUp.youOwe:Bob Builder').parentElement
        ?.parentElement;

    expect(debtSummary?.textContent).toContain('24.57 BZD');
    expect(debtSummary?.querySelector('button')).toBeNull();
    expect(screen.queryByRole('button', { name: /24.57 BZD/ })).toBeNull();
});

test('restores the full debt with the Full debt quick pick', () => {
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
            expect(input).toHaveProperty('value', '24.57');
            expect(screen.getByText('friends:settleUp.debtWillBeSettled')).toBeTruthy();
            expect(screen.getByText(`${FULL_SETTLEMENT_HINT}:24.5678 BZD`)).toBeTruthy();
        });
});

test('submits half of the debt with the Half quick pick and shows the remaining debt', () => {
    const onSubmit = vi
        .fn<(params: SettlementDraft) => Promise<void>>()
        .mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderFriendSettleUp(onSubmit, [balance('-100', 'USD')]);

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
                amount: money('50'),
            });
        });
});

test('Half of a debt below one minor unit is one minor unit, which settles it in full', () => {
    const user = userEvent.setup();

    renderFriendSettleUp(undefined, [balance('-0.0003', 'BZD')]);

    const input = screen.getByRole('textbox', { name: 'friends:settleUp.paymentAmount' });

    return user.click(screen.getByRole('button', { name: 'friends:settleUp.half' })).then(() => {
        expect(input).toHaveProperty('value', '0.01');
        expect(screen.getByText(`${FULL_SETTLEMENT_HINT}:0.0003 BZD`)).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'friends:settleUp.recordPayment' }),
        ).toHaveProperty('disabled', false);
    });
});

test('resets a quick-picked amount to the full debt when the currency changes', () => {
    const user = userEvent.setup();

    renderFriendSettleUp(undefined, [balance('-100', 'USD'), balance('-30', 'EUR')]);

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
    const onSubmit = vi
        .fn<(params: SettlementDraft) => Promise<void>>()
        .mockReturnValue(pendingRequest);
    const onOpenChange = vi.fn<(isOpen: boolean) => void>();
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={onOpenChange}
            friend={friend}
            balances={[balance('-100', 'USD')]}
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
    const onSubmit = vi
        .fn<(params: SettlementDraft) => Promise<void>>()
        .mockReturnValueOnce(pendingRequest)
        .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={vi.fn()}
            friend={friend}
            balances={[balance('-100', 'USD')]}
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

const recordPayment = () => screen.getByRole('button', { name: 'friends:settleUp.recordPayment' });

test('prefills the debt rounded to minor units and sends the exact debt (spec 03 §4.5)', () => {
    const onSubmit = vi
        .fn<(params: SettlementDraft) => Promise<void>>()
        .mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderFriendSettleUp(onSubmit, [balance('-3.3333')]);

    expect(screen.getByRole('textbox')).toHaveProperty('value', '3.33');
    expect(screen.getByText(`${FULL_SETTLEMENT_HINT}:3.3333 USD`)).toBeTruthy();

    return user.click(recordPayment()).then(() => {
        expect(onSubmit).toHaveBeenCalledWith({
            fromUserId: currentUser.id,
            toUserId: friend.id,
            amount: money('3.3333'),
        });
    });
});

test('the full-settlement caption disappears for a partial payment and for the exact debt', () => {
    const user = userEvent.setup();

    renderFriendSettleUp(undefined, [balance('-3.3333')]);

    const input = screen.getByRole('textbox');
    const caption = `${FULL_SETTLEMENT_HINT}:3.3333 USD`;

    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText(caption).id);

    return user
        .clear(input)
        .then(() => user.type(input, '3.32'))
        .then(() => {
            expect(screen.queryByText(caption)).toBeNull();
            expect(input.getAttribute('aria-describedby')).toBeNull();
            expect(
                screen.getByText('friends:settleUp.remainingDebt').nextElementSibling?.textContent,
            ).toContain('0.01 USD');
            return user.clear(input);
        })
        .then(() => user.type(input, '3.34'))
        .then(() => {
            expect(screen.getByText(caption)).toBeTruthy();
            expect(recordPayment()).toHaveProperty('disabled', false);
        });
});

test('a debt below one minor unit shows "< 0.01", prefills 0.01 and sends exactly 0.0040', () => {
    const onSubmit = vi
        .fn<(params: SettlementDraft) => Promise<void>>()
        .mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderFriendSettleUp(onSubmit, [balance('-0.0040')]);

    expect(
        screen.getByText('friends:settleUp.youOwe:Bob Builder').parentElement?.parentElement
            ?.textContent,
    ).toContain('< 0.01 USD');
    expect(screen.getByRole('textbox')).toHaveProperty('value', '0.01');
    expect(screen.getByText(`${FULL_SETTLEMENT_HINT}:0.0040 USD`)).toBeTruthy();

    return user.click(recordPayment()).then(() => {
        expect(onSubmit).toHaveBeenCalledWith({
            fromUserId: currentUser.id,
            toUserId: friend.id,
            amount: money('0.0040'),
        });
    });
});

test('SET-003 an input above the debt by a minor unit or more disables the payment', () => {
    const onSubmit = vi.fn<(params: SettlementDraft) => Promise<void>>();
    const user = userEvent.setup();

    renderFriendSettleUp(onSubmit, [balance('-3.3333')]);

    const input = screen.getByRole('textbox');

    return user
        .clear(input)
        .then(() => user.type(input, '3.35'))
        .then(() => {
            expect(recordPayment()).toHaveProperty('disabled', true);
            expect(screen.queryByText(`${FULL_SETTLEMENT_HINT}:3.3333 USD`)).toBeNull();
            return user.click(recordPayment());
        })
        .then(() => {
            expect(onSubmit).not.toHaveBeenCalled();
        });
});

test('an amount with more fraction digits than the currency has is invalid and never sent', () => {
    const onSubmit = vi.fn<(params: SettlementDraft) => Promise<void>>();
    const user = userEvent.setup();

    renderFriendSettleUp(onSubmit, [balance('-100')]);

    const input = screen.getByRole('textbox');

    return user
        .clear(input)
        .then(() => user.type(input, '0.0000001'))
        .then(() => {
            expect(input).toHaveProperty('value', '0.0000001');
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(recordPayment()).toHaveProperty('disabled', true);
            return user.click(recordPayment());
        })
        .then(() => {
            expect(onSubmit).not.toHaveBeenCalled();
        });
});
