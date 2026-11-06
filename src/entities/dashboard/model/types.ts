import type { ActivityFeedItem } from 'api/chipin.types';
import type { Money } from 'shared/money';

/**
 * The user's whole balance per currency (`GET /dashboard/balances`), across groups and direct
 * debts: `> 0` the user is owed, `< 0` the user owes. One entry per currency.
 */
export type DashboardBalances = readonly Money[];

/**
 * One page of the dashboard activity feed (`GET /users/self/activity-previews`). LEGACY until the
 * activity migration (03-12): the items keep the `src/api` shape (number amounts) that the activity
 * list and the expense editor read today.
 */
export interface DashboardActivityPage {
    readonly items: readonly ActivityFeedItem[];
    readonly nextCursor: number | null;
}
