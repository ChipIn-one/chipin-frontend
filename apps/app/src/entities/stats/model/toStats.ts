import type { components } from 'shared/api/generated/schema';
import { currencyCode, moneyFromWire } from 'shared/money';

import type { Stats } from './types';

type StatsResponse = components['schemas']['StatsResponse'];

const USD = currencyCode('USD');

/** `StatsResponse` (wire) → `Stats` (domain); `debtsTrackedUsd` becomes USD `Money`. */
export const toStats = (response: StatsResponse): Stats => ({
    expensesCount: response.expensesCount,
    debtsTracked: moneyFromWire(response.debtsTrackedUsd, USD),
    activeGroupsCount: response.activeGroupsCount,
    peopleSharingCount: response.peopleSharingCount,
});
