import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

import { checkBackendHealth } from 'api/healthApi';
import type { RequestErrorClass } from 'shared/api/errors';
import { isNetworkUsable } from 'shared/offline/network';

/**
 * Connectivity (spec 03 §1.8): `offline` mirrors TanStack `onlineManager` (the store keeps no
 * network flag of its own), `backend-down` is set by a classified failed request and cleared by a
 * successful health retry or a network change.
 */
export type ConnectivityMode = 'online' | 'offline' | 'backend-down';

export interface ConnectivityStore {
    mode: ConnectivityMode;
    retryBackendHealth: () => Promise<void>;
}

const networkMode = (): ConnectivityMode => (isNetworkUsable() ? 'online' : 'offline');

export const useConnectivityStore = create<ConnectivityStore>(set => ({
    mode: networkMode(),
    retryBackendHealth: () => {
        return checkBackendHealth().then(() => {
            set({ mode: networkMode() });
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
export const onConnectivityChange = (classification: RequestErrorClass): void => {
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
 */
export const onResponseSuccess = (): void => {
    if (!isNetworkUsable()) {
        onlineManager.setOnline(true);
    }
};
