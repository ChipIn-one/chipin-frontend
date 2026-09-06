import { beforeEach, describe, expect, test, vi } from 'vitest';

import { publicApiInstance } from './chipin.instance';
import { BackendHealthCheckError, checkBackendHealth } from './healthApi';

vi.mock('./chipin.instance', () => ({
    publicApiInstance: {
        get: vi.fn(),
    },
}));

describe('checkBackendHealth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('checks the public health endpoint and accepts a successful response', () => {
        vi.mocked(publicApiInstance.get).mockResolvedValue({ status: 200 });

        return checkBackendHealth().then(() => {
            expect(publicApiInstance.get).toHaveBeenCalledWith('/health', {
                validateStatus: expect.any(Function),
            });
        });
    });

    test('rejects a non-2xx health response', () => {
        vi.mocked(publicApiInstance.get).mockResolvedValue({ status: 503 });

        return expect(checkBackendHealth()).rejects.toBeInstanceOf(BackendHealthCheckError);
    });

    test('coalesces simultaneous health checks into one request', () => {
        let resolveRequest: ((value: { status: number }) => void) | undefined;
        vi.mocked(publicApiInstance.get).mockReturnValue(
            new Promise(resolve => {
                resolveRequest = resolve;
            }),
        );

        const firstCheck = checkBackendHealth();
        const secondCheck = checkBackendHealth();

        expect(publicApiInstance.get).toHaveBeenCalledOnce();
        resolveRequest?.({ status: 204 });

        return Promise.all([firstCheck, secondCheck]);
    });
});
