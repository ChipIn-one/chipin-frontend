import type { Balance } from 'entities/balance';
import type { components } from 'shared/api/generated/schema';
import type { CurrencyCode, InvalidItem } from 'shared/money';
import { currencyCode, mapItems, moneyFromWire, MoneyWireError } from 'shared/money';

import type { KnownUser } from './types';

type KnownUsersResponse = components['schemas']['KnownUsersResponse'];
type KnownUserResponse = components['schemas']['KnownUserResponse'];
type KnownUserBalanceResponse = components['schemas']['KnownUserBalanceResponse'];

const toCurrency = (code: string): CurrencyCode => {
    try {
        return currencyCode(code);
    } catch {
        // Rejected like a malformed amount: the balance is left out and reported.
        throw new MoneyWireError('shape');
    }
};

const toBalance = (balance: KnownUserBalanceResponse): Balance => ({
    net: moneyFromWire(balance.netAmount, toCurrency(balance.currency)),
});

const isBalance = (item: Balance | InvalidItem): item is Balance => !('kind' in item);

const toKnownUser = (response: KnownUserResponse): KnownUser => {
    // Reported once per currency: never a user id or an amount.
    const mapped = mapItems(response.balances, toBalance, balance => `known:${balance.currency}`);
    const balances = mapped.filter(isBalance);

    return {
        user: {
            id: response.user.id,
            email: response.user.email,
            displayName: response.user.displayName,
            firstName: response.user.firstName ?? null,
            lastName: response.user.lastName ?? null,
            picture: response.user.picture ?? null,
            createdAt: response.user.createdAt,
            updatedAt: response.user.updatedAt,
        },
        balances,
        hasUnreadableBalance: balances.length !== mapped.length,
        lastUsedCurrency: response.lastUsedCurrency,
    };
};

/**
 * `KnownUsersResponse` (wire) → `KnownUser[]` (domain), in response order. A balance with an
 * unreadable amount or currency is left out of its friend's `balances` (the friend keeps
 * `hasUnreadableBalance`), the rest of the list works.
 */
export const toKnownUsers = (response: KnownUsersResponse): KnownUser[] =>
    response.friends.map(toKnownUser);
