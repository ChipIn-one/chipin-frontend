// Failed-request classification (spec 03 §1.8): tells "no network" from "backend down" from an
// error of one request. The interceptors hand every failed response here through the callback
// wired in `bootstrap/initializeApi`; only `offline` and `backend-down` change app state.
import { type BackendHealth, probeBackendHealth } from 'api/healthApi';
import { ApiError } from 'shared/lib/apiError';
import { isNetworkUsable } from 'shared/offline/network';

import { isNetworkError } from './client';

/**
 * - `offline`: no usable network, or a network error and `/health` also gets no response;
 * - `backend-down`: a 5xx or a network error, and `/health` answers non-2xx (or, after a 5xx,
 *   does not answer at all: the server side is reachable but not serving);
 * - `request-error`: one request failed while `/health` is 2xx, a cancellation, a non-HTTP error;
 * - `client-error`: a 4xx, handled at the call site.
 */
export type RequestErrorClass = 'offline' | 'backend-down' | 'request-error' | 'client-error';

const getHttpStatus = (error: unknown): number | undefined => {
    if (error instanceof ApiError) {
        return error.status;
    }
    if (
        typeof error !== 'object' ||
        error === null ||
        !('isAxiosError' in error) ||
        error.isAxiosError !== true ||
        !('response' in error)
    ) {
        return undefined;
    }
    const { response } = error;

    return typeof response === 'object' &&
        response !== null &&
        'status' in response &&
        typeof response.status === 'number'
        ? response.status
        : undefined;
};

const fromHealth = (health: BackendHealth, isNetworkFailure: boolean): RequestErrorClass => {
    if (health === 'ok') {
        return 'request-error';
    }
    if (health === 'unreachable' && isNetworkFailure) {
        return 'offline';
    }
    return 'backend-down';
};

/** Classifies a failed request; probes `/health` only for a network error or a 5xx. */
export const classifyRequestError = (error: unknown): Promise<RequestErrorClass> => {
    const status = getHttpStatus(error);

    if (status !== undefined) {
        if (status >= 400 && status < 500) {
            return Promise.resolve('client-error');
        }
        if (status >= 500 && status < 600) {
            return probeBackendHealth().then(health => fromHealth(health, false));
        }
        return Promise.resolve('request-error');
    }
    if (!isNetworkError(error)) {
        return Promise.resolve('request-error');
    }
    if (!isNetworkUsable()) {
        return Promise.resolve('offline');
    }
    return probeBackendHealth().then(health => fromHealth(health, true));
};
