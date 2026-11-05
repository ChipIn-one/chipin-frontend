import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

import { checkBackendHealth } from 'api/healthApi';
import type { RequestErrorClass } from 'shared/api/errors';
import { isNetworkUsable } from 'shared/offline/network';

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
    retryBackendHealth: () => {
        return checkBackendHealth().then(() => {
            lastRecoveryAt = performance.now();
            // `/health` answered 2xx: the network is usable whatever `onlineManager` last heard.
            onlineManager.setOnline(true);
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
 * the network unusable; the `online` window event or the next successful response
 * (`onResponseSuccess`) brings it back.
 * TODO(03-7a): the 15 s `/health` re-check (shared/offline/network.ts) for a network that does
 * neither.
 */
export const onConnectivityChange = (
    classification: RequestErrorClass,
    requestStartedAt?: number,
): void => {
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
 * The success callback of the API interceptors: any response that got through proves the network
 * is usable, e.g. after an `offline` classification on a captive portal that never fires `online`.
 * Intentionally this includes a non-2xx `/health` probe answer (`validateStatus: () => true`):
 * any HTTP answer proves the network, not the backend. 03-7a must not read it as "backend up".
 */
export const onResponseSuccess = (): void => {
    if (!isNetworkUsable()) {
        onlineManager.setOnline(true);
    }
};
