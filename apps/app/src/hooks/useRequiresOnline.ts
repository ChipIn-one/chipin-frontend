// Spec 03 §2.9 (03-16a part C, #866): whether an online-only action is blocked now. Blocked = the
// network is not usable (`onlineManager`, re-rendered on its change) or the session runs on the
// cache (`offline-cached`, §1.6), whether offline writes (`VITE_FEATURE_OFFLINE_WRITES`) are on or
// off (KB NET-006). The expense writes (`OFFLINE_WRITE_ACTIONS`: save and delete) are blocked the
// same way unless offline writes are on and the caller says the outbox can take this write
// (`canQueueOffline`, KB NET-007); then they go to the outbox offline. Backend down keeps the
// network usable: nothing is blocked, the NET-002 page is the only notice.
import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

import { OFFLINE_WRITE_ACTIONS, type OnlineOnlyAction } from 'constants/onlineOnlyActions';
import { isNetworkUsable } from 'shared/offline/network';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import { SESSION_MODE } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

const isBlockedNow = (): boolean =>
    !isNetworkUsable() || useAuthStore.getState().sessionMode === SESSION_MODE.OFFLINE_CACHED;

const subscribeBlocked = (listener: () => void): (() => void) => {
    const unsubscribeNetwork = onlineManager.subscribe(listener);
    const unsubscribeAuth = useAuthStore.subscribe(listener);

    return () => {
        unsubscribeNetwork();
        unsubscribeAuth();
    };
};

const subscribeNothing = (): (() => void) => () => undefined;

const neverBlocked = (): boolean => false;

export interface RequiresOnlineOptions {
    /**
     * For an expense write (`OFFLINE_WRITE_ACTIONS`): the outbox can take it now (offline writes
     * available and, for an edit or a delete, the entry cached as an expense). The caller reads it
     * (`useCanQueueLedgerWrite`), so this hook needs no query client. Ignored for other actions.
     */
    canQueueOffline?: boolean;
}

/**
 * `useRequiresOnline(action)` of §2.9: true while `action` may not be done. Every action needs the
 * same network; the argument names the entry point for the coverage test of `ONLINE_ONLY_ACTIONS`
 * and lets an expense write through while the outbox can take it.
 */
export const useRequiresOnline = (
    action: OnlineOnlyAction,
    { canQueueOffline = false }: RequiresOnlineOptions = {},
): boolean => {
    const isQueued =
        canQueueOffline && isOfflineWritesFlagOn() && OFFLINE_WRITE_ACTIONS.has(action);
    const isGated = !isQueued;

    return useSyncExternalStore(
        isGated ? subscribeBlocked : subscribeNothing,
        isGated ? isBlockedNow : neverBlocked,
        neverBlocked,
    );
};
