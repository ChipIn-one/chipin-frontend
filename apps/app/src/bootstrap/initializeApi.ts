import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { showUpdateRequired } from 'app/pwa/updateRequired';
import { reconcileRestoredSelf } from 'entities/users';
import { setAccessTokenRefreshListener } from 'helpers/authSession';
import { getLocalUser } from 'helpers/localStorage';
import { classifyRequestError } from 'shared/api/errors';
import { bootstrapNetwork } from 'shared/offline/network';
import {
    setCacheOwnerReader,
    setCacheRestoredHandler,
    setUserClientSetup,
} from 'shared/offline/userCaches';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { onConnectivityChange, onResponseSuccess } from 'store/connectivityStore';

import { recheckOutboxOwnerOnToken, startUserOutbox } from './outboxWiring';

const initializeApi = () => {
    // Before the first request: `onlineManager` from `navigator.onLine`, plus the offline re-check.
    bootstrapNetwork();
    // A refreshed token of another user (another tab switched the account), spec 03 §1.5.
    setAccessTokenRefreshListener(onAccessTokenRefreshed);
    // Only the shared cached user's query cache is written (another tab may have switched).
    setCacheOwnerReader(() => getLocalUser()?.id);
    // A user's new client starts its expense outbox (only with `VITE_FEATURE_OFFLINE_WRITES`).
    setUserClientSetup(startUserOutbox);
    // A restored self user older than the cached language and theme takes them (#719).
    setCacheRestoredHandler(reconcileRestoredSelf);
    initChipInApiInterceptors(
        () => {
            useAuthStore.getState().expireSession();
        },
        (error, requestStartedAt) =>
            classifyRequestError(error).then(classification => {
                onConnectivityChange(classification, requestStartedAt);
            }),
        onResponseSuccess,
        recheckOutboxOwnerOnToken,
        // 03-20: a 426 `CLIENT.OUTDATED` or a higher `X-Min-Client-Version` closes the outbox gate
        // `outdated` and shows the "Update required" screen (never called while the backend has no
        // `MIN_CLIENT_VERSION`, API-005).
        showUpdateRequired,
    );
};

export { initializeApi };
