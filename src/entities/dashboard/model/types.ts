import type { Money } from 'shared/money';

/**
 * The user's whole balance per currency (`GET /dashboard/balances`), across groups and direct
 * debts: `> 0` the user is owed, `< 0` the user owes. One entry per currency.
 */
export type DashboardBalances = readonly Money[];
