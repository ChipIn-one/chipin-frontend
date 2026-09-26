import type { CreateSettlementParams, FriendBalance, FriendUser } from 'api/chipin.types';
import type { GroupSettlementOption } from 'store/groupsSelectors';

import type { SettlementUser } from '../types';

import type { DebtOption } from './types';

interface SettlementViewModelInput {
    user: SettlementUser;
    friend: FriendUser;
    balance: FriendBalance;
    amount: string;
}

export interface SettlementViewModel {
    params: CreateSettlementParams;
    maxAmount: number;
    remainingAmount: number;
    isFriendPayer: boolean;
    isSubmitDisabled: boolean;
    isDebtSettled: boolean;
    debtColor: 'green' | 'red';
    summaryUser: SettlementUser;
}

export const selectSettlementBalance = (
    balances: FriendBalance[],
    currency: string,
): FriendBalance => balances.find(balance => balance.currency === currency) ?? balances[0];

export const getSettlementAmount = (balance: FriendBalance): string =>
    String(Math.abs(balance.netAmount));

export const getDebtOptions = (options: GroupSettlementOption[]): DebtOption[] =>
    options.flatMap(option => {
        const balances = option.balances.map(balance => ({
            currency: balance.currency,
            netAmount: balance.netBalance,
        }));

        return balances.map(balance => ({ user: option.user, balance, balances }));
    });

export const getSettlementViewModel = ({
    user,
    friend,
    balance,
    amount,
}: SettlementViewModelInput): SettlementViewModel => {
    const parsedAmount = Number(amount);
    const maxAmount = Math.abs(balance.netAmount);
    const isFriendPayer = balance.netAmount > 0;
    const isSubmitDisabled =
        !Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > maxAmount;
    const remainingAmount = Number.isFinite(parsedAmount)
        ? Math.max(maxAmount - Math.max(parsedAmount, 0), 0)
        : maxAmount;

    return {
        params: {
            fromUserId: isFriendPayer ? friend.id : user.id,
            toUserId: isFriendPayer ? user.id : friend.id,
            amount: parsedAmount,
            currency: balance.currency,
        },
        maxAmount,
        remainingAmount,
        isFriendPayer,
        isSubmitDisabled,
        isDebtSettled: remainingAmount === 0 && !isSubmitDisabled,
        debtColor: isFriendPayer ? 'green' : 'red',
        summaryUser: isFriendPayer ? friend : user,
    };
};
