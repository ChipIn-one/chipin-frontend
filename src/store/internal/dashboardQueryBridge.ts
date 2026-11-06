// Bridge (spec 03 §6): a legacy store action that changes balances or the activity feed marks the
// dashboard queries stale on the signed-in user's QueryClient; active ones refetch now, the rest on
// their next mount. Never the reverse direction. Goes with the last legacy caller (03-11, 03-12).
import { dashboardKeys } from 'entities/dashboard';
import { getLocalUser } from 'helpers/localStorage';
import { cachesByUser } from 'shared/offline/userCaches';

/** Settles when the active dashboard queries have refetched; never rejects. */
export const invalidateDashboard = (): Promise<void> => {
    const userId = getLocalUser()?.id;
    const client = userId === undefined ? undefined : cachesByUser.get(userId)?.client;

    return client ? client.invalidateQueries({ queryKey: dashboardKeys.all }) : Promise.resolve();
};
