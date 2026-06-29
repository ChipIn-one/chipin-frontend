import axios from 'axios';

import { logoutApiAuthTokens, refreshApiAuthTokens } from 'api/chipin';
import { type AuthTokens, clearAuthTokens, getAuthTokens, saveAuthTokens } from 'helpers/localStorage';

const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 60;
const AUTH_GOOGLE_EXCHANGE_PATH = '/auth/oauth/google/exchange';
const AUTH_LOGOUT_PATH = '/auth/logout';
const AUTH_REFRESH_PATH = '/auth/refresh';

let refreshPromise: Promise<AuthTokens | null> | null = null;
let logoutPromise: Promise<void> | null = null;
let isLogoutInProgress = false;

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

const isRefreshResponseError = (error: unknown) => {
    if (!axios.isAxiosError(error)) {
        return false;
    }

    return Boolean(error.response);
};

const refreshAuthTokens = (refreshToken: string) => {
    if (!refreshPromise) {
        refreshPromise = refreshApiAuthTokens(refreshToken)
            .then(({ token, refresh_token: refreshToken }) => {
                const nextTokens = { accessToken: token, refreshToken };

                saveAuthTokens(nextTokens);

                return nextTokens;
            })
            .catch(error => {
                if (isRefreshResponseError(error)) {
                    console.error('Auth refresh failed with backend error response:', error);
                    clearAuthTokens();

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

            return logoutApiAuthTokens(tokens).catch(() => undefined);
        })
        .then(() => {
            clearAuthTokens();
        })
        .finally(() => {
            isLogoutInProgress = false;
            logoutPromise = null;
        });

    return logoutPromise;
};

export const clearExpiredAuthSession = () => {
    clearAuthTokens();
    return Promise.resolve();
};
