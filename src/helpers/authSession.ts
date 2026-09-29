import * as authApi from 'api/authApi';
import { logoutApiAuthTokens, refreshApiAuthTokens } from 'api/chipin';
import { getApiErrorStatus } from 'helpers/errors';
import { clearLegacyAuthTokens } from 'helpers/localStorage';

const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 60;
const AUTH_GOOGLE_EXCHANGE_PATH = '/auth/oauth/google/exchange';
const AUTH_LOGOUT_PATH = '/auth/logout';
const AUTH_REFRESH_PATH = '/auth/refresh';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let logoutPromise: Promise<void> | null = null;
let logoutOtherDevicesPromise: Promise<void> | null = null;
let isLogoutInProgress = false;
let authSessionVersion = 0;

const assertCurrentAuthSession = (version: number): void => {
    if (version !== authSessionVersion) {
        throw new Error('Auth session changed during token rotation');
    }
};

export const getAuthSessionVersion = (): number => authSessionVersion;

export const isAuthSessionCurrent = (version: number): boolean => {
    return version === authSessionVersion;
};

export const invalidateAuthSession = (): void => {
    authSessionVersion += 1;
    accessToken = null;
    clearLegacyAuthTokens();
};

export const establishAuthSession = (nextAccessToken: string): void => {
    authSessionVersion += 1;
    clearLegacyAuthTokens();
    accessToken = nextAccessToken;
};

const decodeJwtPayload = (token: string): unknown => {
    const [, payloadBase64] = token.split('.');

    if (!payloadBase64) {
        return null;
    }

    const normalizedPayload = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
        Math.ceil(normalizedPayload.length / 4) * 4,
        '=',
    );

    try {
        return JSON.parse(atob(paddedPayload));
    } catch {
        return null;
    }
};

const getJwtExpiration = (token: string): number | null => {
    const payload = decodeJwtPayload(token);

    if (!payload || typeof payload !== 'object' || !('exp' in payload)) {
        return null;
    }

    const { exp } = payload;

    if (typeof exp !== 'number') {
        return null;
    }

    return exp;
};

const isAccessTokenExpiring = (token: string): boolean => {
    const expiration = getJwtExpiration(token);

    if (!expiration) {
        return true;
    }

    return Date.now() / 1000 >= expiration - ACCESS_TOKEN_REFRESH_BUFFER_SECONDS;
};

const isAuthSessionRequest = (url?: string): boolean => {
    return (
        url?.endsWith(AUTH_GOOGLE_EXCHANGE_PATH) ||
        url?.endsWith(AUTH_REFRESH_PATH) ||
        url?.endsWith(AUTH_LOGOUT_PATH)
    );
};

const refreshAccessToken = (): Promise<string | null> => {
    if (!refreshPromise) {
        const version = authSessionVersion;

        refreshPromise = refreshApiAuthTokens()
            .then(({ token }) => {
                assertCurrentAuthSession(version);
                accessToken = token;
                return token;
            })
            .catch((error: unknown) => {
                if (getApiErrorStatus(error) === 401) {
                    assertCurrentAuthSession(version);
                    invalidateAuthSession();
                    return null;
                }

                return Promise.reject(error);
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

export const refreshAuthSession = (): Promise<string | null> => {
    if (isLogoutInProgress) {
        return Promise.resolve(null);
    }

    clearLegacyAuthTokens();
    return refreshAccessToken();
};

export const validateAuthSession = (): Promise<string | null> => {
    return refreshAuthSession();
};

export const getFreshAccessToken = (): Promise<string | null> => {
    if (isLogoutInProgress) {
        return Promise.resolve(null);
    }

    clearLegacyAuthTokens();

    if (!accessToken || isAccessTokenExpiring(accessToken)) {
        return refreshAccessToken();
    }

    return Promise.resolve(accessToken);
};

export const prepareAuthRequest = (
    url?: string,
): Promise<string | null | undefined> => {
    if (isAuthSessionRequest(url)) {
        return Promise.resolve(undefined);
    }

    return getFreshAccessToken();
};

export const startAuthLogout = (): Promise<void> => {
    if (logoutPromise) {
        return logoutPromise;
    }

    isLogoutInProgress = true;

    logoutPromise = logoutApiAuthTokens()
        .catch(() => {
            // Local logout must continue when the backend logout request fails.
        })
        .then(() => {
            invalidateAuthSession();
        })
        .finally(() => {
            isLogoutInProgress = false;
            logoutPromise = null;
        });

    return logoutPromise;
};

export const logoutOtherDevicesSession = (): Promise<void> => {
    if (logoutOtherDevicesPromise) {
        return logoutOtherDevicesPromise;
    }

    const version = authSessionVersion;

    logoutOtherDevicesPromise = getFreshAccessToken()
        .then(currentAccessToken => {
            if (!currentAccessToken) {
                return Promise.reject(new Error('Auth access token is missing'));
            }

            return authApi.logoutOtherDevices();
        })
        .then(({ token }) => {
            assertCurrentAuthSession(version);
            accessToken = token;
        })
        .finally(() => {
            logoutOtherDevicesPromise = null;
        });

    return logoutOtherDevicesPromise;
};

export const clearExpiredAuthSession = (): Promise<void> => {
    invalidateAuthSession();
    return Promise.resolve();
};
