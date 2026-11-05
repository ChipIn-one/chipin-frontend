import { beforeEach, describe, expect, test, vi } from 'vitest';

import { publicApiInstance } from './chipin.instance';
import { probeBackendHealth } from './healthApi';

vi.mock('./chipin.instance', () => ({
    publicApiInstance: {
        get: vi.fn(),
    },
}));

describe('probeBackendHealth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test.each([
        [200, 'ok'],
        [204, 'ok'],
        [500, 'error'],
        [503, 'error'],
    ])('maps a %s health response to %s', (status, expected) => {
        vi.mocked(publicApiInstance.get).mockResolvedValue({ status });

        return expect(probeBackendHealth()).resolves.toBe(expected);
    });

    test('checks the public health endpoint with the 5 s timeout', () => {
        vi.mocked(publicApiInstance.get).mockResolvedValue({ status: 200 });

        return probeBackendHealth().then(() => {
            expect(publicApiInstance.get).toHaveBeenCalledWith('/health', {
                timeout: 5000,
                validateStatus: expect.any(Function),
            });
        });
    });

    test('coalesces simultaneous probes into one request', () => {
        let resolveRequest: ((value: { status: number }) => void) | undefined;
        vi.mocked(publicApiInstance.get).mockReturnValue(
            new Promise(resolve => {
                resolveRequest = resolve;
            }),
        );

        const first = probeBackendHealth();
        const second = probeBackendHealth();

        expect(publicApiInstance.get).toHaveBeenCalledOnce();
        resolveRequest?.({ status: 204 });

        return Promise.all([first, second]);
    });

    test('reports a health request without a response as unreachable, never rejects', () => {
        vi.mocked(publicApiInstance.get).mockRejectedValue(new Error('Network Error'));

        return expect(probeBackendHealth()).resolves.toBe('unreachable');
    });
});
