import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { API_ERROR_CODE } from 'constants/errors';
import { APP_VERSION } from 'constants/version';
import {
    getAccessTokenSubject,
    getAuthSessionVersion,
    hasAuthAccessTokenRotated,
    isAuthSessionCurrent,
    isAuthSessionSignedOut,
    prepareAuthRequest,
    refreshAuthSession,
} from 'helpers/authSession';
import { getChipInApiUrl } from 'helpers/env';
import { getApiErrorPayload } from 'helpers/errors';

import { AUTH_API_PATH } from './auth.constants';
import { apiInstance, publicApiInstance } from './chipin.instance';
import {
    CLIENT_VERSION_HEADER,
    isVersionBelowMinimum,
    MIN_CLIENT_VERSION_HEADER,
} from './clientVersion';

const AUTHORIZATION_BEARER_PREFIX = 'Bearer ';
const AUTH_REQUEST_CANCELLED_MESSAGE = 'Auth request cancelled';
const AUTH_RETRY_CONFIG_KEY = 'chipinAuthRetry';
/**
 * A request config field: the user id (`sub`) the attached access token must have. An outbox op is
 * sent only with its owner's token (spec 03 §2.3, C3-07); a mismatch rejects before sending.
 */
export const EXPECTED_TOKEN_SUBJECT_CONFIG_KEY = 'chipinExpectedTokenSubject';
const HEALTH_PATH = '/health';

let areChipInApiInterceptorsConfigured = false;
let onUnauthorizedSession: (() => void) | undefined;
let onRequestFailure: ((error: unknown, requestStartedAt?: number) => Promise<void>) | undefined;
let onResponseSuccess: ((requestStartedAt?: number) => void) | undefined;
let onAccessTokenChanged: ((token: string) => void) | undefined;
let onClientOutdated: (() => void) | undefined;
// The last access token a request carried: a new one is announced once.
let lastAttachedAccessToken: string | null = null;
const requestAuthSessionVersions = new WeakMap<object, number>();
// `performance.now()` when a request was sent: lets the store drop a classification older than its
// last successful retry, and a success older than the last time the app went offline (#746).
const requestStartTimes = new WeakMap<object, number>();

export class AuthRequestCancelledError extends Error {
    readonly isStaleSession: boolean;

    constructor(isStaleSession = false) {
        super(AUTH_REQUEST_CANCELLED_MESSAGE);
        this.isStaleSession = isStaleSession;
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

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

// 03-20 (API-001): every request of both instances names the build, the refresh included.
const setClientVersion = (config: InternalAxiosRequestConfig): void => {
    config.headers.set(CLIENT_VERSION_HEADER, APP_VERSION);
};

const readMinClientVersion = (headers: unknown): string | undefined => {
    let value: unknown;

    if (headers instanceof AxiosHeaders) {
        value = headers.get(MIN_CLIENT_VERSION_HEADER);
    } else if (isRecord(headers)) {
        const name = MIN_CLIENT_VERSION_HEADER.toLowerCase();
        const key = Object.keys(headers).find(headerName => headerName.toLowerCase() === name);
        value = key === undefined ? undefined : headers[key];
    }

    return typeof value === 'string' ? value : undefined;
};

// 03-20 (API-004): a minimum above this build's semver core blocks the app; an unparseable value
// is ignored. Without the header (no minimum configured, API-005) nothing happens.
const checkMinClientVersion = (headers: unknown): void => {
    const minVersion = readMinClientVersion(headers);

    if (minVersion !== undefined && isVersionBelowMinimum(APP_VERSION, minVersion)) {
        onClientOutdated?.();
    }
};

// 03-20 (API-002): a 426 `CLIENT.OUTDATED` blocks the app; the error still reaches its caller (the
// outbox maps it to its `outdated` gate itself).
const checkClientOutdatedError = (error: unknown): void => {
    if (!axios.isAxiosError(error) || !error.response) {
        return;
    }
    if (
        error.response.status === 426 &&
        getApiErrorPayload(error)?.code === API_ERROR_CODE.CLIENT_OUTDATED
    ) {
        onClientOutdated?.();
        return;
    }
    checkMinClientVersion(error.response.headers);
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

// The failure is classified (offline / backend down, spec 03 §1.8) before the caller sees it, so
// the connectivity state is already set when its `catch` runs; the error itself is unchanged.
const processConnectivityError = (error: unknown): Promise<never> => {
    if (!onRequestFailure) {
        return Promise.reject(error);
    }

    const config: unknown = isRecord(error) ? error.config : undefined;
    const requestStartedAt = isRecord(config) ? requestStartTimes.get(config) : undefined;

    return onRequestFailure(error, requestStartedAt).then(
        () => Promise.reject(error),
        () => Promise.reject(error),
    );
};

const processApiResponseError = (error: unknown) => {
    checkClientOutdatedError(error);

    if (error instanceof AuthRequestCancelledError) {
        if (!error.isStaleSession && !isAuthSessionSignedOut()) {
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

        if (requestSessionVersion !== undefined && !isAuthSessionCurrent(requestSessionVersion)) {
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
        const hasRetriedRequest = Reflect.get(requestConfig, AUTH_RETRY_CONFIG_KEY) === true;

        if (hasRetriedRequest) {
            if (requestAccessToken && hasAuthAccessTokenRotated(requestAccessToken)) {
                return Promise.reject(error);
            }

            onUnauthorizedSession?.();
            return Promise.reject(error);
        }

        if (requestAccessToken && hasAuthAccessTokenRotated(requestAccessToken)) {
            Reflect.set(requestConfig, AUTH_RETRY_CONFIG_KEY, true);
            return apiInstance.request(requestConfig);
        }

        const refreshSessionVersion = getAuthSessionVersion();

        return refreshAuthSession().then(nextAccessToken => {
            if (!nextAccessToken || !isAuthSessionCurrent(refreshSessionVersion)) {
                onUnauthorizedSession?.();
                return Promise.reject(error);
            }

            Reflect.set(requestConfig, AUTH_RETRY_CONFIG_KEY, true);
            return apiInstance.request(requestConfig);
        });
    }

    return processConnectivityError(error);
};

const processPublicApiResponseError = (error: unknown): Promise<never> => {
    checkClientOutdatedError(error);

    if (axios.isAxiosError(error) && getRequestPathname(error.config?.url) === HEALTH_PATH) {
        return Promise.reject(error);
    }

    return processConnectivityError(error);
};

// The listener (wired by the bootstrap) does not throw: it only schedules the outbox re-check.
const announceAccessToken = (token: string): void => {
    if (token !== lastAttachedAccessToken) {
        lastAttachedAccessToken = token;
        onAccessTokenChanged?.(token);
    }
};

/**
 * Installs the interceptors once. `onRequestFailureCallback` gets every failed response that is not
 * an auth-flow outcome (and not the `/health` probe itself); the bootstrap wires it to the
 * failed-request classification and the connectivity store. `onResponseSuccessCallback` gets every
 * successful response of either instance, with when its request was sent: proof that the network
 * was usable then (the store ignores a request sent before the app last went offline, #746).
 * `onAccessTokenChangedCallback` gets every new access token before a request carries it (a sign-in,
 * a refresh, another tab's account switch): the outbox re-checks its owner (spec 03 §2.3).
 * `onClientOutdatedCallback` is called when the backend says this build is below its minimum
 * client version (a 426 `CLIENT.OUTDATED` or a higher `X-Min-Client-Version`, 03-20); the bootstrap
 * wires it to the blocking "Update required" state.
 */
export const initChipInApiInterceptors = (
    onUnauthorizedSessionCallback?: () => void,
    onRequestFailureCallback?: (error: unknown, requestStartedAt?: number) => Promise<void>,
    onResponseSuccessCallback?: (requestStartedAt?: number) => void,
    onAccessTokenChangedCallback?: (token: string) => void,
    onClientOutdatedCallback?: () => void,
): void => {
    onUnauthorizedSession = onUnauthorizedSessionCallback;
    onRequestFailure = onRequestFailureCallback;
    onResponseSuccess = onResponseSuccessCallback;
    onAccessTokenChanged = onAccessTokenChangedCallback;
    onClientOutdated = onClientOutdatedCallback;

    if (areChipInApiInterceptorsConfigured) {
        return;
    }

    areChipInApiInterceptorsConfigured = true;

    apiInstance.interceptors.request.use(config => {
        setClientVersion(config);
        const authSessionVersion = getAuthSessionVersion();

        return prepareAuthRequest(config.url).then(currentAccessToken => {
            if (!isAuthSessionCurrent(authSessionVersion)) {
                return Promise.reject(new AuthRequestCancelledError(true));
            }
            requestAuthSessionVersions.set(config, authSessionVersion);

            if (currentAccessToken === null) {
                return Promise.reject(new AuthRequestCancelledError());
            }
            if (currentAccessToken) {
                announceAccessToken(currentAccessToken);
            }
            const expectedSubject: unknown = Reflect.get(config, EXPECTED_TOKEN_SUBJECT_CONFIG_KEY);

            // Not this session's request (another user's token): cancelled without expiring the session.
            if (
                typeof expectedSubject === 'string' &&
                (!currentAccessToken ||
                    getAccessTokenSubject(currentAccessToken) !== expectedSubject)
            ) {
                return Promise.reject(new AuthRequestCancelledError(true));
            }

            if (currentAccessToken) {
                config.headers.Authorization = `Bearer ${currentAccessToken}`;
            }
            requestStartTimes.set(config, performance.now());

            return config;
        });
    });

    apiInstance.interceptors.response.use(response => {
        checkMinClientVersion(response.headers);
        onResponseSuccess?.(requestStartTimes.get(response.config));
        const requestVersion = requestAuthSessionVersions.get(response.config);
        if (requestVersion !== undefined && !isAuthSessionCurrent(requestVersion)) {
            return Promise.reject(new AuthRequestCancelledError(true));
        }
        return response;
    }, processApiResponseError);
    publicApiInstance.interceptors.request.use(config => {
        setClientVersion(config);
        requestStartTimes.set(config, performance.now());
        return config;
    });
    publicApiInstance.interceptors.response.use(response => {
        checkMinClientVersion(response.headers);
        onResponseSuccess?.(requestStartTimes.get(response.config));
        return response;
    }, processPublicApiResponseError);
};
