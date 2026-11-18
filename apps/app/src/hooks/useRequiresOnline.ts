// Spec 03 §2.9 (03-16a part C): whether an online-only action is blocked now. Blocked = offline
// writes on (`VITE_FEATURE_OFFLINE_WRITES`) and either the network is not usable (`onlineManager`,
// re-rendered on its change) or the session runs on the cache (`offline-cached`, §1.6). Flag off:
// never blocked, nothing subscribed (every action keeps today's own refusal).
import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

import type { OnlineOnlyAction } from 'constants/onlineOnlyActions';
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

/**
 * `useRequiresOnline(action)` of §2.9: true while `action` may not be done. Every action needs the
 * same network; the argument names the entry point for the coverage test of `ONLINE_ONLY_ACTIONS`.
 */
export const useRequiresOnline = (_action: OnlineOnlyAction): boolean => {
    const isOn = isOfflineWritesFlagOn();

    return useSyncExternalStore(
        isOn ? subscribeBlocked : subscribeNothing,
        isOn ? isBlockedNow : neverBlocked,
        neverBlocked,
    );
};
