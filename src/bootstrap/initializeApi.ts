import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { classifyRequestError } from 'shared/api/errors';
import { useAuthStore } from 'store/authStore';
import { onConnectivityChange, onResponseSuccess } from 'store/connectivityStore';

const initializeApi = () => {
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
