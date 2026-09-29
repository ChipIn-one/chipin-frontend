import axios from 'axios';

import { API_ERROR_CODE } from 'constants/errors';
import {
    getAuthSessionVersion,
    isAuthSessionCurrent,
    prepareAuthRequest,
} from 'helpers/authSession';
import { getChipInApiUrl } from 'helpers/env';
import { getApiErrorPayload, isLikelyBackendOutageError } from 'helpers/errors';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import { apiInstance, publicApiInstance } from './chipin.instance';
import { checkBackendHealth } from './healthApi';

const AUTH_LOGOUT_PATH = '/auth/logout';
const AUTH_OAUTH_EXCHANGE_PATH = '/auth/oauth/google/exchange';
const AUTH_REQUEST_CANCELLED_MESSAGE = 'Auth request cancelled';
const HEALTH_PATH = '/health';

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

const confirmBackendAvailability = (error: unknown): Promise<never> => {
    return checkBackendHealth().then(
        () => Promise.reject(error),
        () => {
            useBackendAvailabilityStore.getState().setUnavailable();
            return Promise.reject(error);
        },
    );
};

const processBackendAvailabilityError = (error: unknown): Promise<never> => {
    if (isLikelyBackendOutageError(error)) {
        return confirmBackendAvailability(error);
    }

    return Promise.reject(error);
};

const processApiResponseError = (error: unknown): Promise<never> => {
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

    return processBackendAvailabilityError(error);
};

const processPublicApiResponseError = (error: unknown): Promise<never> => {
    if (axios.isAxiosError(error) && getRequestPathname(error.config?.url) === HEALTH_PATH) {
        return Promise.reject(error);
    }

    return processBackendAvailabilityError(error);
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

    apiInstance.interceptors.response.use(response => response, processApiResponseError);
    publicApiInstance.interceptors.response.use(
        response => response,
        processPublicApiResponseError,
    );
};
