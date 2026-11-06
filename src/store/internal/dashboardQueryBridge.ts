// Bridge (spec 03 §6): a legacy store action that changes balances or the activity feed marks the
// dashboard queries stale on the signed-in user's QueryClient; active ones refetch now, the rest on
// their next mount. Never the reverse direction. Goes with the last legacy caller (03-11, 03-12).
import { dashboardKeys, trimDashboardFeed } from 'entities/dashboard';

import { tabUserClient } from './sessionUser';

/** Settles when the active dashboard queries have refetched; never rejects. */
export const invalidateDashboard = (): Promise<void> => {
    // The user of this tab as `authStore` reads it: this tab's user, then the cached `LocalUser`.
    const client = tabUserClient();

    if (!client) {
        return Promise.resolve();
    }
    // One feed request for the refetch, not one per loaded page.
    trimDashboardFeed(client);
    return client.invalidateQueries({ queryKey: dashboardKeys.all });
};
