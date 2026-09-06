import { publicApiInstance } from './chipin.instance';

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
