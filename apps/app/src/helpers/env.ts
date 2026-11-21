import { API_BASE_PATH, ENV_DEV, ENV_PROD, ENV_URLS } from 'constants/env';
import type { Environment } from 'constants/env.types';

const ENVIRONMENTS: readonly Environment[] = [ENV_PROD, ENV_DEV];

export const getEnv = (): Environment => {
    const explicitEnv: unknown = import.meta.env.VITE_CHIPIN_ENV;

    if (explicitEnv !== undefined && explicitEnv !== ENV_DEV && explicitEnv !== ENV_PROD) {
        throw new Error(
            'Invalid ChipIn environment configuration: VITE_CHIPIN_ENV must be "dev" or "prod".',
        );
    }

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;

        if (hostname.endsWith('.vercel.app')) {
            if (explicitEnv === undefined) {
                throw new Error(
                    'Unable to resolve ChipIn environment configuration without explicit VITE_CHIPIN_ENV.',
                );
            }

            return ENV_DEV;
        }
    }

    if (explicitEnv === ENV_DEV || explicitEnv === ENV_PROD) {
        return explicitEnv;
    }

    if (typeof window === 'undefined') {
        throw new Error(
            'Unable to resolve ChipIn environment configuration without explicit VITE_CHIPIN_ENV.',
        );
    }

    const hostname = window.location.hostname;

    if (hostname === 'localhost') {
        return ENV_DEV;
    }

    const hostEnv = ENVIRONMENTS.find(environment =>
        ENV_URLS[environment].appHostnames.some(appHostname => appHostname === hostname),
    );

    if (hostEnv !== undefined) {
        return hostEnv;
    }

    throw new Error(
        `Unable to resolve ChipIn environment configuration for hostname "${hostname}".`,
    );
};

export const getIsDevEnv = (): boolean => getEnv() === ENV_DEV;

export const getIsProdEnv = (): boolean => getEnv() === ENV_PROD;

export const getChipInAppUrl = (): string => {
    const environment = getEnv();

    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return ENV_URLS[environment].siteBaseUrl;
};

/**
 * The origin of the public site (no trailing slash) for links from the app to the site (spec 04
 * §2.1, 04-2g): `https://chipin.one` in production, `https://site-dev.chipin.one` in development
 * and on previews. Unlike `getChipInAppUrl()` it never follows `window.location`.
 */
export const getSiteOrigin = (): string => ENV_URLS[getEnv()].siteOrigin;

export const getChipInApiUrl = (): string => {
    return new URL(API_BASE_PATH, `${getChipInAppUrl()}/`).toString();
};
