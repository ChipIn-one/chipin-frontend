import { API_URLS, ENV_DEV, ENV_PROD } from 'constants/env';
import type { Environment } from 'constants/env.types';

export const getIsDevEnv = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    const hostname = window.location.hostname;

    return hostname === 'localhost' || hostname.endsWith('dev.chipin.one');
};

export const getIsProdEnv = (): boolean => !getIsDevEnv();

export const getEnv = (): Environment => (getIsDevEnv() ? ENV_DEV : ENV_PROD);

export const getChipInApiUrl = () => API_URLS[getEnv()].baseUrl;
