interface ApiStatsResponse {
    usersCount: number;
    groupsCount: number;
    expensesCount: number;
    settlementsCount: number;
}

type LandingStats = ApiStatsResponse;

export type { ApiStatsResponse, LandingStats };
