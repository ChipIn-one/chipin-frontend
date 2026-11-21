import { publicApiInstance } from './instance';

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

const sendHealthProbe = (): Promise<BackendHealth> =>
    publicApiInstance
        // Every HTTP answer resolves, so it also passes the success interceptor, which marks the
        // network usable (`onResponseSuccess`) when the probe was sent after the app last went
        // offline (#746): intended, an answer proves the network.
        .get<unknown>('/health', {
            timeout: HEALTH_CHECK_TIMEOUT_MS,
            validateStatus: () => true,
        })
        .then(
            (response): BackendHealth =>
                isSuccessfulHealthStatus(response.status) ? 'ok' : 'error',
            (): BackendHealth => 'unreachable',
        );

let healthProbePromise: Promise<BackendHealth> | null = null;
// `performance.now()` when the shared probe was sent.
let healthProbeSentAt = Number.NEGATIVE_INFINITY;

/**
 * Probes `/health`; simultaneous probes share one request. Never rejects. With `sentAfter` (the
 * moment the app went offline) the answer comes from a probe sent after it: an older shared probe
 * describes the network before the outage, so a fresh one is sent and shared instead (#746).
 */
export const probeBackendHealth = (
    sentAfter = Number.NEGATIVE_INFINITY,
): Promise<BackendHealth> => {
    if (healthProbePromise && healthProbeSentAt > sentAfter) {
        return healthProbePromise;
    }
    healthProbeSentAt = performance.now();
    const probe: Promise<BackendHealth> = sendHealthProbe().finally(() => {
        // A stale probe settling after a fresh one replaced it leaves the fresh one shared.
        if (healthProbePromise === probe) {
            healthProbePromise = null;
        }
    });
    healthProbePromise = probe;

    return probe;
};
