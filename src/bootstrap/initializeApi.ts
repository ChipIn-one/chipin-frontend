import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { classifyRequestError } from 'shared/api/errors';
import { useAuthStore } from 'store/authStore';
import { onConnectivityChange, onResponseSuccess } from 'store/connectivityStore';

const initializeApi = () => {
    initChipInApiInterceptors(
        () => {
            useAuthStore.getState().expireSession();
        },
        error => classifyRequestError(error).then(onConnectivityChange),
        onResponseSuccess,
    );
};

export { initializeApi };
