import type { Money } from 'shared/money';

/**
 * The domain balance with one counterpart (a friend, a group member) in one currency (spec 03
 * §4.4): `net > 0` — you are owed, `net < 0` — you owe. Both wire shapes (`BalanceEntry.netBalance`,
 * `ApiFriendBalance.netAmount`) map to it.
 */
export interface Balance {
    readonly net: Money;
}
