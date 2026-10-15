import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import { useAuthStore } from 'store/authStore';

const initializeApi = () => {
    initChipInApiInterceptors(() => {
        useAuthStore.getState().expireSession();
    });
};

export { initializeApi };
