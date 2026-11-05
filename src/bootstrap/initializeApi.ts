import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { setAccessTokenRefreshListener } from 'helpers/authSession';
import { classifyRequestError } from 'shared/api/errors';
import { bootstrapNetwork } from 'shared/offline/network';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { onConnectivityChange, onResponseSuccess } from 'store/connectivityStore';

const initializeApi = () => {
    // Before the first request: `onlineManager` from `navigator.onLine`, plus the offline re-check.
    bootstrapNetwork();
    // A refreshed token of another user (another tab switched the account), spec 03 §1.5.
    setAccessTokenRefreshListener(onAccessTokenRefreshed);
    initChipInApiInterceptors(
        () => {
            useAuthStore.getState().expireSession();
        },
        (error, requestStartedAt) =>
            classifyRequestError(error).then(classification => {
                onConnectivityChange(classification, requestStartedAt);
            }),
        onResponseSuccess,
    );
};

export { initializeApi };
