import { ENV_DEV, ENV_PROD, ENV_URLS } from 'constants/env';
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

export const getChipInApiUrl = () => ENV_URLS[getEnv()].apiBaseUrl;

export const getChipInAppUrl = (): string => {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return ENV_URLS[getEnv()].siteBaseUrl;
};
