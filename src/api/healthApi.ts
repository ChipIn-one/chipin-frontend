import { publicApiInstance } from './chipin.instance';

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export class BackendHealthCheckError extends Error {
    constructor() {
        super('Backend health check failed');
    }
}

/**
 * The outcome of one `GET /health`: `ok` (2xx), `error` (the backend or its proxy answered with
 * another status) or `unreachable` (no HTTP response: network error or the 5 s timeout).
 */
export type BackendHealth = 'ok' | 'error' | 'unreachable';

const isSuccessfulHealthStatus = (status: number): boolean => {
    return status >= 200 && status < 300;
};

let healthProbePromise: Promise<BackendHealth> | null = null;

/** Probes `/health`; simultaneous probes share one request. Never rejects. */
export const probeBackendHealth = (): Promise<BackendHealth> => {
    if (!healthProbePromise) {
        healthProbePromise = publicApiInstance
            // Every HTTP answer resolves, so it also passes the success interceptor and marks the
            // network usable (`onResponseSuccess`): intended, an answer proves the network.
            .get<unknown>('/health', {
                timeout: HEALTH_CHECK_TIMEOUT_MS,
                validateStatus: () => true,
            })
            .then(
                (response): BackendHealth =>
                    isSuccessfulHealthStatus(response.status) ? 'ok' : 'error',
                (): BackendHealth => 'unreachable',
            )
            .finally(() => {
                healthProbePromise = null;
            });
    }

    return healthProbePromise;
};

/** Resolves when `/health` answers 2xx, otherwise rejects with `BackendHealthCheckError`. */
export const checkBackendHealth = (): Promise<void> => {
    return probeBackendHealth().then(health => {
        if (health !== 'ok') {
            return Promise.reject(new BackendHealthCheckError());
        }
    });
};
