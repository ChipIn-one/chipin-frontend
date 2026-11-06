// Bridge (spec 03 §6): a legacy store action that changes balances or the activity feed marks the
// dashboard queries stale on the signed-in user's QueryClient; active ones refetch now, the rest on
// their next mount. Never the reverse direction. Goes with the last legacy caller (03-11, 03-12).
import { dashboardKeys, trimDashboardFeed } from 'entities/dashboard';
import { getLocalUser } from 'helpers/localStorage';
import { cachesByUser } from 'shared/offline/userCaches';

import { useUsersStore } from '../users-store';

/** Settles when the active dashboard queries have refetched; never rejects. */
export const invalidateDashboard = (): Promise<void> => {
    // The user of this tab as `authStore` reads it: in memory first, then the cached `LocalUser`.
    const userId = useUsersStore.getState().localUser?.id ?? getLocalUser()?.id;
    const client = userId === undefined ? undefined : cachesByUser.get(userId)?.client;

    if (!client) {
        return Promise.resolve();
    }
    // One feed request for the refetch, not one per loaded page.
    trimDashboardFeed(client);
    return client.invalidateQueries({ queryKey: dashboardKeys.all });
};
