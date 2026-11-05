import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { classifyRequestError } from 'shared/api/errors';
import { bootstrapNetwork } from 'shared/offline/network';
import { useAuthStore } from 'store/authStore';
import { onConnectivityChange, onResponseSuccess } from 'store/connectivityStore';

const initializeApi = () => {
    // Before the first request: `onlineManager` from `navigator.onLine`, plus the offline re-check.
    bootstrapNetwork();
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
