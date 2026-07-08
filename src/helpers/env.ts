import { ENV_DEV, ENV_PROD, ENV_URLS } from 'constants/env';
import type { Environment } from 'constants/env.types';

export const getEnv = (): Environment => {
    const explicitEnv = import.meta.env.VITE_CHIPIN_ENV;

    if (explicitEnv === ENV_DEV || explicitEnv === ENV_PROD) {
        return explicitEnv;
    }

    if (typeof window === 'undefined') {
        return ENV_PROD;
    }

    const hostname = window.location.hostname;
    const isDevHostname = hostname === 'localhost' || hostname.endsWith('dev.chipin.one');

    return isDevHostname ? ENV_DEV : ENV_PROD;
};

export const getIsDevEnv = (): boolean => getEnv() === ENV_DEV;

export const getIsProdEnv = (): boolean => getEnv() === ENV_PROD;

export const getChipInApiUrl = () => ENV_URLS[getEnv()].apiBaseUrl;

export const getChipInAppUrl = (): string => {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return ENV_URLS[getEnv()].siteBaseUrl;
};
