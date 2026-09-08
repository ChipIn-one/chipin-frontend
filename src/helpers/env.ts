import { ENV_DEV, ENV_PROD, ENV_URLS } from 'constants/env';
import type { Environment } from 'constants/env.types';

export const getEnv = (): Environment => {
    const explicitEnv: unknown = import.meta.env.VITE_CHIPIN_ENV;

    if (explicitEnv === ENV_DEV || explicitEnv === ENV_PROD) {
        return explicitEnv;
    }

    if (explicitEnv !== undefined) {
        throw new Error(
            'Invalid ChipIn environment configuration: VITE_CHIPIN_ENV must be "dev" or "prod".',
        );
    }

    if (typeof window === 'undefined') {
        throw new Error(
            'Unable to resolve ChipIn environment configuration without explicit VITE_CHIPIN_ENV.',
        );
    }

    const hostname = window.location.hostname;
    const isDevHostname =
        hostname === 'localhost' ||
        hostname === ENV_URLS[ENV_DEV].hostname ||
        hostname.endsWith(`.${ENV_URLS[ENV_DEV].hostname}`);

    if (isDevHostname) {
        return ENV_DEV;
    }

    throw new Error(
        `Unable to resolve ChipIn environment configuration for hostname "${hostname}".`,
    );
};

export const getIsDevEnv = (): boolean => getEnv() === ENV_DEV;

export const getIsProdEnv = (): boolean => getEnv() === ENV_PROD;

export const getChipInApiUrl = (): string => ENV_URLS[getEnv()].apiBaseUrl;

export const getChipInAppUrl = (): string => {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return ENV_URLS[getEnv()].siteBaseUrl;
};
