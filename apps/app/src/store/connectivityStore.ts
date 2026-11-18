import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

import { BackendHealthCheckError, probeBackendHealth } from 'api/healthApi';
import type { RequestErrorClass } from 'shared/api/errors';
import { getLastOfflineAt, isNetworkUsable } from 'shared/offline/network';

/**
 * Connectivity (spec 03 §1.8): `offline` mirrors TanStack `onlineManager` (the store keeps no
 * network flag of its own), `backend-down` is set by a classified failed request and cleared by a
 * successful health retry or a network change. The retry (backend page, offline banner) is the
 * user's way out of an `offline` the browser never ends with an `online` event.
 */
export type ConnectivityMode = 'online' | 'offline' | 'backend-down';

export interface ConnectivityStore {
    mode: ConnectivityMode;
    retryBackendHealth: () => Promise<void>;
}

const networkMode = (): ConnectivityMode => (isNetworkUsable() ? 'online' : 'offline');

// `performance.now()` of the last successful retry: a request that started before it and fails
// after it describes the state the retry has just disproved, so its classification is dropped.
let lastRecoveryAt = Number.NEGATIVE_INFINITY;

export const useConnectivityStore = create<ConnectivityStore>(set => ({
    mode: networkMode(),
    // Resolves on a 2xx `/health`, otherwise rejects (the caller shows its failure text). Only a
    // probe sent after the app last went offline counts (#746): an older shared probe is not
    // joined, and an answer that a new outage overtook proves nothing, like no answer.
    retryBackendHealth: () => {
        const offlineAt = getLastOfflineAt();
        return probeBackendHealth(offlineAt).then(health => {
            if (health === 'unreachable' || getLastOfflineAt() !== offlineAt) {
                // Still no network (or a hanging backend): the mode stays as it is.
                return Promise.reject(new BackendHealthCheckError());
            }
            // Any `/health` answer: the network is usable whatever `onlineManager` last heard.
            onlineManager.setOnline(true);
            if (health === 'error') {
                // Reachable but not serving: the blocking backend-down page, not the banner.
                set({ mode: 'backend-down' });
                return Promise.reject(new BackendHealthCheckError());
            }
            lastRecoveryAt = performance.now();
            set({ mode: 'online' });
        });
    },
}));

// A network change resets `backend-down`: the reconnect refetch classifies the backend again.
onlineManager.subscribe(online => {
    useConnectivityStore.setState({ mode: online ? 'online' : 'offline' });
});

/**
 * The connectivity callback of the API interceptors, wired in `bootstrap/initializeApi`. A request
 * classified `offline` while `onlineManager` still says online (e.g. an offline cold start) marks
 * the network unusable; the `online` window event or the next successful response to a request
 * sent after that (`onResponseSuccess`) brings it back, and for a network that does neither, the
 * 15 s `/health` re-check of `bootstrapNetwork` (shared/offline/network.ts).
 */
export const onConnectivityChange = (
    classification: RequestErrorClass,
    requestStartedAt?: number,
): void => {
    // Trade-off: a long request sent before a successful retry that fails after a new outage is
    // dropped too; the next request catches that outage.
    if (requestStartedAt !== undefined && requestStartedAt < lastRecoveryAt) {
        return;
    }
    if (classification === 'offline') {
        onlineManager.setOnline(false);
        return;
    }
    if (classification === 'backend-down' && isNetworkUsable()) {
        useConnectivityStore.setState({ mode: 'backend-down' });
    }
};

/**
 * The success callback of the API interceptors: a response to a request sent while offline proves
 * the network is usable again, e.g. after an `offline` classification on a captive portal that
 * never fires `online`. A request sent before the app last went offline (`requestStartedAt` not
 * after `getLastOfflineAt()`) proves only the network it was sent on: its late success is ignored,
 * or a refetch in flight at the outage would hide the offline banner it just showed (#746).
 * Without `requestStartedAt` (a caller outside the interceptors) there is no evidence of staleness:
 * the success restores the network, as `onConnectivityChange` applies such a failure.
 * Intentionally this includes a non-2xx `/health` probe answer (`validateStatus: () => true`):
 * any HTTP answer proves the network, not the backend. 03-7a must not read it as "backend up".
 * The `/health` retry and the 15 s re-check set `onlineManager` themselves, and with the same
 * cut-off: each trusts only a probe sent after the app last went offline.
 */
export const onResponseSuccess = (requestStartedAt?: number): void => {
    if (requestStartedAt !== undefined && requestStartedAt <= getLastOfflineAt()) {
        return;
    }
    if (!isNetworkUsable()) {
        onlineManager.setOnline(true);
    }
};
