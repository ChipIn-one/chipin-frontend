import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { setAccessTokenRefreshListener } from 'helpers/authSession';
import { getLocalUser } from 'helpers/localStorage';
import { classifyRequestError } from 'shared/api/errors';
import { bootstrapNetwork } from 'shared/offline/network';
import { setCacheOwnerReader } from 'shared/offline/userCaches';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { onConnectivityChange, onResponseSuccess } from 'store/connectivityStore';

const initializeApi = () => {
    // Before the first request: `onlineManager` from `navigator.onLine`, plus the offline re-check.
    bootstrapNetwork();
    // A refreshed token of another user (another tab switched the account), spec 03 §1.5.
    setAccessTokenRefreshListener(onAccessTokenRefreshed);
    // Only the shared cached user's query cache is written (another tab may have switched).
    setCacheOwnerReader(() => getLocalUser()?.id);
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
