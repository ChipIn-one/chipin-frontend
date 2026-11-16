import type { Money } from 'shared/money';

/** Public platform metrics shown on the landing page (`GET /stats`, chipin-backend#180). */
export interface Stats {
    /** Currently valid user-created shared expenses, all time. */
    expensesCount: number;
    /** Obligations those expenses represent, in USD at current rates; not netted, not settled. */
    debtsTracked: Money;
    /** Groups with at least two active members and an expense created in the last 60 days. */
    activeGroupsCount: number;
    /** Distinct registered users in the shares of at least one valid expense, all time. */
    peopleSharingCount: number;
}
