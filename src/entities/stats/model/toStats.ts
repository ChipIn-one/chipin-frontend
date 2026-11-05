import type { components } from 'shared/api/generated/schema';

import type { Stats } from './types';

type StatsResponse = components['schemas']['StatsResponse'];

/** `StatsResponse` (wire) → `Stats` (domain). */
export const toStats = (response: StatsResponse): Stats => ({
    usersCount: response.usersCount,
    groupsCount: response.groupsCount,
    expensesCount: response.expensesCount,
    settlementsCount: response.settlementsCount,
});
