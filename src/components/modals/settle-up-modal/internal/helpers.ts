// The settle-up form on `Money` (spec 03 §4.5): `owed` is the exact `abs(balance.net)`, the field
// is parsed in currency minor units, and `resolveSettleAmount` decides what is sent.
import type { FriendUser } from 'api/chipin.types';
import {
    type Balance,
    halfSettlePrefill,
    resolveSettleAmount,
    settlePrefill,
} from 'entities/balance';
import type { SettlementDraft } from 'entities/ledger';
import {
    abs,
    compare,
    displaySign,
    isZero,
    type Money,
    moneyInputText,
    parseMoneyInput,
    sub,
} from 'shared/money';
import type { GroupSettlementOption } from 'store/groupsSelectors';

import type { SettlementUser } from '../types';

import type { DebtOption } from './types';

interface SettlementViewModelInput {
    user: SettlementUser;
    friend: FriendUser;
    balance: Balance;
    amount: string;
}

export interface SettlementViewModel {
    /** What the submit sends; `null` when the field holds no amount that can be sent. */
    settlement: SettlementDraft | null;
    /** The exact debt: `abs(balance.net)`. */
    owed: Money;
    /** The debt left after this settlement: zero or at least one minor unit. */
    remaining: Money;
    isFriendPayer: boolean;
    isSubmitDisabled: boolean;
    isDebtSettled: boolean;
    /** The field holds text that is not an amount of the currency (too many fraction digits). */
    isAmountInvalid: boolean;
    /** The exact debt when the input differs from it by less than one minor unit, else `null`. */
    fullSettlementAmount: Money | null;
    debtColor: 'green' | 'red';
    summaryUser: SettlementUser;
}

export const selectSettlementBalance = (
    balances: readonly Balance[],
    currency: string,
): Balance => {
    const balance = balances.find(item => item.net.currency === currency) ?? balances[0];
    if (!balance) {
        throw new Error('Settlement requires at least one balance');
    }
    return balance;
};

/** The field text of the full debt: rounded to minor units, at least one minor unit. */
export const getSettlementAmount = (balance: Balance): string =>
    moneyInputText(settlePrefill(abs(balance.net)));

/** The field text of half the debt, in minor units. */
export const getHalfSettlementAmount = (balance: Balance): string =>
    moneyInputText(halfSettlePrefill(abs(balance.net)));

export const getDebtOptions = (options: GroupSettlementOption[]): DebtOption[] =>
    options.flatMap(option =>
        option.balances.map(balance => ({
            user: option.user,
            balance,
            balances: option.balances,
        })),
    );

export const getSettlementViewModel = ({
    user,
    friend,
    balance,
    amount,
}: SettlementViewModelInput): SettlementViewModel => {
    const owed = abs(balance.net);
    const isFriendPayer = displaySign(balance.net) > 0;
    const input = parseMoneyInput(amount, owed.currency);
    const resolved = input && !isZero(input) ? resolveSettleAmount(input, owed) : null;
    const remaining = resolved ? sub(owed, resolved) : owed;
    const isDebtSettled = resolved !== null && isZero(remaining);

    return {
        settlement: resolved && {
            fromUserId: isFriendPayer ? friend.id : user.id,
            toUserId: isFriendPayer ? user.id : friend.id,
            amount: resolved,
        },
        owed,
        remaining,
        isFriendPayer,
        isSubmitDisabled: resolved === null,
        isDebtSettled,
        isAmountInvalid: amount.trim() !== '' && input === null,
        fullSettlementAmount: isDebtSettled && input && compare(input, owed) !== 0 ? owed : null,
        debtColor: isFriendPayer ? 'green' : 'red',
        summaryUser: isFriendPayer ? friend : user,
    };
};
