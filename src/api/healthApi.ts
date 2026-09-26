import { publicApiInstance } from './chipin.instance';

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export class BackendHealthCheckError extends Error {
    constructor() {
        super('Backend health check failed');
    }
}

const isSuccessfulHealthStatus = (status: number): boolean => {
    return status >= 200 && status < 300;
};

let healthCheckPromise: Promise<void> | null = null;

export const checkBackendHealth = (): Promise<void> => {
    if (!healthCheckPromise) {
        healthCheckPromise = publicApiInstance
            .get<unknown>('/health', {
                timeout: HEALTH_CHECK_TIMEOUT_MS,
                validateStatus: () => true,
            })
            .then(response => {
                if (!isSuccessfulHealthStatus(response.status)) {
                    return Promise.reject(new BackendHealthCheckError());
                }
            })
            .finally(() => {
                healthCheckPromise = null;
            });
    }

    return healthCheckPromise;
};
