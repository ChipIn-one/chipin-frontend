import axios from 'axios';

import { API_ERROR_CODE } from 'constants/errors';
import {
    getAuthSessionVersion,
    hasAuthAccessTokenRotated,
    isAuthSessionCurrent,
    isAuthSessionSignedOut,
    prepareAuthRequest,
    refreshAuthSession,
} from 'helpers/authSession';
import { getChipInApiUrl } from 'helpers/env';
import { getApiErrorPayload, isLikelyBackendOutageError } from 'helpers/errors';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import { AUTH_API_PATH } from './auth.constants';
import { apiInstance, publicApiInstance } from './chipin.instance';
import { checkBackendHealth } from './healthApi';

const AUTHORIZATION_BEARER_PREFIX = 'Bearer ';
const AUTH_REQUEST_CANCELLED_MESSAGE = 'Auth request cancelled';
const AUTH_RETRY_CONFIG_KEY = 'chipinAuthRetry';
const HEALTH_PATH = '/health';

let areChipInApiInterceptorsConfigured = false;
let onUnauthorizedSession: (() => void) | undefined;
const requestAuthSessionVersions = new WeakMap<object, number>();

class AuthRequestCancelledError extends Error {
    constructor() {
        super(AUTH_REQUEST_CANCELLED_MESSAGE);
    }
}

const getRequestPathname = (url?: string): string => {
    if (!url) {
        return '';
    }

    try {
        return new URL(url, getChipInApiUrl()).pathname;
    } catch {
        return url;
    }
};

const isUnauthorizedError = (error: unknown): boolean => {
    if (!axios.isAxiosError(error)) {
        return false;
    }

    const data = getApiErrorPayload(error);

    return error.response?.status === 401 || data?.code === API_ERROR_CODE.AUTH_UNAUTHORIZED;
};

const isOwnedAuthFlowUnauthorizedError = (error: unknown): boolean => {
    if (!isUnauthorizedError(error) || !axios.isAxiosError(error)) {
        return false;
    }

    const pathname = getRequestPathname(error.config?.url);

    return (
        pathname === AUTH_API_PATH.LOGOUT ||
        pathname === AUTH_API_PATH.GOOGLE_OAUTH_EXCHANGE ||
        pathname === AUTH_API_PATH.REFRESH ||
        pathname === AUTH_API_PATH.LOGOUT_OTHER_DEVICES
    );
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

const processApiResponseError = (error: unknown) => {
    if (error instanceof AuthRequestCancelledError) {
        if (!isAuthSessionSignedOut()) {
            onUnauthorizedSession?.();
        }

        return Promise.reject(error);
    }

    if (isOwnedAuthFlowUnauthorizedError(error)) {
        return Promise.reject(error);
    }

    if (isUnauthorizedError(error) && axios.isAxiosError(error)) {
        const requestConfig = error.config;
        const requestSessionVersion = requestConfig
            ? requestAuthSessionVersions.get(requestConfig)
            : undefined;

        if (
            requestSessionVersion !== undefined &&
            !isAuthSessionCurrent(requestSessionVersion)
        ) {
            return Promise.reject(error);
        }

        if (!requestConfig) {
            onUnauthorizedSession?.();
            return Promise.reject(error);
        }

        const authorizationHeader = requestConfig.headers.Authorization;
        const requestAccessToken =
            typeof authorizationHeader === 'string' &&
            authorizationHeader.startsWith(AUTHORIZATION_BEARER_PREFIX)
                ? authorizationHeader.slice(AUTHORIZATION_BEARER_PREFIX.length)
                : null;
        const hasRetriedRequest =
            Reflect.get(requestConfig, AUTH_RETRY_CONFIG_KEY) === true;

        if (hasRetriedRequest) {
            if (
                requestAccessToken &&
                hasAuthAccessTokenRotated(requestAccessToken)
            ) {
                return Promise.reject(error);
            }

            onUnauthorizedSession?.();
            return Promise.reject(error);
        }

        if (
            requestAccessToken &&
            hasAuthAccessTokenRotated(requestAccessToken)
        ) {
            Reflect.set(requestConfig, AUTH_RETRY_CONFIG_KEY, true);
            return apiInstance.request(requestConfig);
        }

        const refreshSessionVersion = getAuthSessionVersion();

        return refreshAuthSession().then(nextAccessToken => {
            if (
                !nextAccessToken ||
                !isAuthSessionCurrent(refreshSessionVersion)
            ) {
                onUnauthorizedSession?.();
                return Promise.reject(error);
            }

            Reflect.set(requestConfig, AUTH_RETRY_CONFIG_KEY, true);
            return apiInstance.request(requestConfig);
        });
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
): void => {
    onUnauthorizedSession = onUnauthorizedSessionCallback;

    if (areChipInApiInterceptorsConfigured) {
        return;
    }

    areChipInApiInterceptorsConfigured = true;

    apiInstance.interceptors.request.use(config => {
        const authSessionVersion = getAuthSessionVersion();

        return prepareAuthRequest(config.url).then(currentAccessToken => {
            requestAuthSessionVersions.set(config, authSessionVersion);

            if (currentAccessToken === null) {
                return Promise.reject(new AuthRequestCancelledError());
            }

            if (currentAccessToken) {
                config.headers.Authorization = `Bearer ${currentAccessToken}`;
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
