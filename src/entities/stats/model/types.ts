/** Public platform counters shown on the landing page (`GET /stats`). Plain counts, not money. */
export interface Stats {
    usersCount: number;
    groupsCount: number;
    expensesCount: number;
    settlementsCount: number;
}
