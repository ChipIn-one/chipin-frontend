import axios from 'axios';

import { API_ERROR_CODE } from 'constants/errors';
import {
    getAuthSessionVersion,
    isAuthSessionCurrent,
    prepareAuthRequest,
} from 'helpers/authSession';
import { getChipInApiUrl } from 'helpers/env';
import { getApiErrorPayload } from 'helpers/errors';

import { apiInstance } from './chipin.instance';

const AUTH_LOGOUT_PATH = '/auth/logout';
const AUTH_OAUTH_EXCHANGE_PATH = '/auth/oauth/google/exchange';
const AUTH_REQUEST_CANCELLED_MESSAGE = 'Auth request cancelled';

let areChipInApiInterceptorsConfigured = false;
let onUnauthorizedSession: (() => void) | undefined;
const requestAuthSessionVersions = new WeakMap<object, number>();

class AuthRequestCancelledError extends Error {
    constructor() {
        super(AUTH_REQUEST_CANCELLED_MESSAGE);
    }
}

const getRequestPathname = (url?: string) => {
    if (!url) {
        return '';
    }

    try {
        return new URL(url, getChipInApiUrl()).pathname;
    } catch {
        return url;
    }
};

const isUnauthorizedError = (error: unknown) => {
    if (!axios.isAxiosError(error)) {
        return false;
    }

    const data = getApiErrorPayload(error);

    return error.response?.status === 401 || data?.code === API_ERROR_CODE.AUTH_UNAUTHORIZED;
};

const isPublicAuthFlowUnauthorizedError = (error: unknown) => {
    if (!isUnauthorizedError(error) || !axios.isAxiosError(error)) {
        return false;
    }

    const pathname = getRequestPathname(error.config?.url);

    return pathname === AUTH_LOGOUT_PATH || pathname === AUTH_OAUTH_EXCHANGE_PATH;
};

export const initChipInApiInterceptors = (
    onUnauthorizedSessionCallback?: () => void,
) => {
    onUnauthorizedSession = onUnauthorizedSessionCallback;

    if (areChipInApiInterceptorsConfigured) {
        return;
    }

    areChipInApiInterceptorsConfigured = true;

    apiInstance.interceptors.request.use(config => {
        const authSessionVersion = getAuthSessionVersion();

        return prepareAuthRequest(config.url).then(accessToken => {
            requestAuthSessionVersions.set(config, authSessionVersion);

            if (accessToken === null) {
                return Promise.reject(new AuthRequestCancelledError());
            }

            if (accessToken) {
                config.headers.Authorization = `Bearer ${accessToken}`;
            }

            return config;
        });
    });

    apiInstance.interceptors.response.use(
        response => response,
        (error: unknown) => {
            if (error instanceof AuthRequestCancelledError) {
                return Promise.reject(error);
            }

            if (isPublicAuthFlowUnauthorizedError(error)) {
                return Promise.reject(error);
            }

            if (isUnauthorizedError(error)) {
                const requestSessionVersion = axios.isAxiosError(error)
                    ? requestAuthSessionVersions.get(error.config ?? {})
                    : undefined;

                if (
                    requestSessionVersion !== undefined &&
                    !isAuthSessionCurrent(requestSessionVersion)
                ) {
                    return Promise.reject(error);
                }

                onUnauthorizedSession?.();
                return Promise.reject(error);
            }

            return Promise.reject(error);
        },
    );
};
