import { afterEach, expect, test } from 'vitest';

import { clearLocalUserIdentity } from 'helpers/localStorage';
import { mountUserDashboardCache, type UserDashboardCache } from 'test/userDashboardCache';

import { invalidateDashboard } from './dashboardQueryBridge';

let cache: UserDashboardCache | undefined;

afterEach(() => {
    cache?.dispose();
    cache = undefined;
});

test("marks the signed-in user's dashboard balances stale", async () => {
    cache = mountUserDashboardCache();

    await invalidateDashboard();

    expect(cache.isDashboardInvalidated()).toBe(true);
});

test('without a signed-in user or a mounted client it does nothing and resolves', async () => {
    clearLocalUserIdentity();

    await expect(invalidateDashboard()).resolves.toBeUndefined();
});
