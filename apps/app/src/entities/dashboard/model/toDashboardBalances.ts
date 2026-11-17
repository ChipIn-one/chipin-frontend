import type { components } from 'shared/api/generated/schema';
import type { CurrencyCode, Money } from 'shared/money';
import { currencyCode, mapItems, moneyFromWire, MoneyWireError } from 'shared/money';

import type { DashboardBalances } from './types';

type DashboardBalanceResponse = components['schemas']['DashboardBalanceResponse'];
type CurrencyBalance = components['schemas']['CurrencyBalance'];

const toCurrency = (code: string): CurrencyCode => {
    try {
        return currencyCode(code);
    } catch {
        // Rejected like a malformed amount: the entry is left out and reported, the rest shows.
        throw new MoneyWireError('shape');
    }
};

const toBalance = (balance: CurrencyBalance): Money =>
    moneyFromWire(balance.netBalance, toCurrency(balance.currency));

const isMoney = (item: Money | { kind: 'invalid' }): item is Money => !('kind' in item);

/**
 * `DashboardBalanceResponse` (wire) → `DashboardBalances` (domain), in response order. An entry
 * with an unreadable amount or currency is left out (reported once by `mapItems`).
 */
export const toDashboardBalances = (response: DashboardBalanceResponse): DashboardBalances =>
    mapItems(Object.values(response.balances), toBalance, balance => balance.currency).filter(
        isMoney,
    );
