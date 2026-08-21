import * as authApi from 'api/authApi';
import { logoutApiAuthTokens, refreshApiAuthTokens } from 'api/chipin';
import { getApiErrorStatus } from 'helpers/errors';
import { type AuthTokens, clearAuthTokens, getAuthTokens, saveAuthTokens } from 'helpers/localStorage';

const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 60;
const AUTH_GOOGLE_EXCHANGE_PATH = '/auth/oauth/google/exchange';
const AUTH_LOGOUT_PATH = '/auth/logout';
const AUTH_REFRESH_PATH = '/auth/refresh';

let refreshPromise: Promise<AuthTokens | null> | null = null;
let logoutPromise: Promise<void> | null = null;
let logoutOtherDevicesPromise: Promise<void> | null = null;
let isLogoutInProgress = false;
let authSessionVersion = 0;

export class AuthTokenPersistenceError extends Error {
    constructor() {
        super('Auth tokens could not be persisted');
    }
}

const assertCurrentAuthSession = (version: number) => {
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
    clearAuthTokens();
};

export const establishAuthSession = (tokens: AuthTokens): void => {
    authSessionVersion += 1;
    clearAuthTokens();

    if (!saveAuthTokens(tokens)) {
        throw new AuthTokenPersistenceError();
    }
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

const isAccessTokenExpiring = (token: string) => {
    const expiration = getJwtExpiration(token);

    if (!expiration) {
        return true;
    }

    return Date.now() / 1000 >= expiration - ACCESS_TOKEN_REFRESH_BUFFER_SECONDS;
};

const isAuthSessionRequest = (url?: string) => {
    return (
        url?.endsWith(AUTH_GOOGLE_EXCHANGE_PATH) ||
        url?.endsWith(AUTH_REFRESH_PATH) ||
        url?.endsWith(AUTH_LOGOUT_PATH)
    );
};

const refreshAuthTokens = (refreshToken: string) => {
    if (!refreshPromise) {
        const version = authSessionVersion;

        refreshPromise = refreshApiAuthTokens(refreshToken)
            .then(({ token, refresh_token: refreshToken }) => {
                assertCurrentAuthSession(version);

                const nextTokens = { accessToken: token, refreshToken };
                const isSaved = saveAuthTokens(nextTokens);

                if (!isSaved) {
                    return Promise.reject(new AuthTokenPersistenceError());
                }

                return nextTokens;
            })
            .catch(error => {
                if (getApiErrorStatus(error) === 401) {
                    assertCurrentAuthSession(version);
                    console.error('Auth refresh failed with backend error response:', error);
                    invalidateAuthSession();

                    return null;
                }

                throw error;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

export const validateAuthSession = (): Promise<AuthTokens | null> => {
    if (isLogoutInProgress) {
        return Promise.resolve(null);
    }

    const tokens = getAuthTokens();

    if (!tokens) {
        return Promise.resolve(null);
    }

    return refreshAuthTokens(tokens.refreshToken);
};

export const getFreshAccessToken = () => {
    if (isLogoutInProgress) {
        return Promise.resolve(null);
    }

    const tokens = getAuthTokens();

    if (!tokens) {
        return Promise.resolve(null);
    }

    if (!isAccessTokenExpiring(tokens.accessToken)) {
        return Promise.resolve(tokens.accessToken);
    }

    return refreshAuthTokens(tokens.refreshToken).then(nextTokens => {
        return nextTokens?.accessToken ?? null;
    });
};

export const prepareAuthRequest = (url?: string) => {
    if (isAuthSessionRequest(url)) {
        return Promise.resolve(undefined);
    }

    return getFreshAccessToken();
};

export const startAuthLogout = () => {
    if (logoutPromise) {
        return logoutPromise;
    }

    isLogoutInProgress = true;

    logoutPromise = Promise.resolve(getAuthTokens())
        .then(tokens => {
            if (!tokens) {
                return undefined;
            }

            return logoutApiAuthTokens(tokens).then(
                () => undefined,
                () => {
                    // Local logout must continue when the backend logout request fails.
                },
            );
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
        .then(accessToken => {
            const tokens = getAuthTokens();

            if (!accessToken || !tokens) {
                return Promise.reject(new Error('Auth tokens are missing'));
            }

            return authApi.logoutOtherDevices(tokens.refreshToken).catch((error: unknown) => {
                if (error instanceof authApi.InvalidLogoutOtherDevicesResponseError) {
                    return Promise.reject(new AuthTokenPersistenceError());
                }

                return Promise.reject(error);
            });
        })
        .then(({ token, refresh_token: refreshToken }) => {
            assertCurrentAuthSession(version);

            const isSaved = saveAuthTokens({ accessToken: token, refreshToken });

            if (!isSaved) {
                return Promise.reject(new AuthTokenPersistenceError());
            }
        })
        .finally(() => {
            logoutOtherDevicesPromise = null;
        });

    return logoutOtherDevicesPromise;
};

export const clearExpiredAuthSession = () => {
    invalidateAuthSession();
    return Promise.resolve();
};
