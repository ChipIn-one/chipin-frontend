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

    test('joins a shared probe sent after the given moment', () => {
        let resolveRequest: ((value: { status: number }) => void) | undefined;
        vi.mocked(publicApiInstance.get).mockReturnValue(
            new Promise(resolve => {
                resolveRequest = resolve;
            }),
        );
        const beforeFirst = performance.now() - 1;

        const first = probeBackendHealth();
        const second = probeBackendHealth(beforeFirst);

        expect(publicApiInstance.get).toHaveBeenCalledOnce();
        resolveRequest?.({ status: 204 });

        return expect(Promise.all([first, second])).resolves.toEqual(['ok', 'ok']);
    });

    test('never answers with a shared probe sent at or before the given moment: sends a fresh one', () => {
        let resolveStale: ((value: { status: number }) => void) | undefined;
        vi.mocked(publicApiInstance.get)
            .mockReturnValueOnce(
                new Promise(resolve => {
                    resolveStale = resolve;
                }),
            )
            .mockRejectedValueOnce(new Error('Network Error'));

        const stale = probeBackendHealth();
        const wentOfflineAt = performance.now();
        const fresh = probeBackendHealth(wentOfflineAt);

        expect(publicApiInstance.get).toHaveBeenCalledTimes(2);
        resolveStale?.({ status: 200 });

        return expect(Promise.all([stale, fresh])).resolves.toEqual(['ok', 'unreachable']);
    });

    test('later callers with the same cut-off share the fresh probe that replaced a stale one', () => {
        let resolveStale: ((value: { status: number }) => void) | undefined;
        let resolveFresh: ((value: { status: number }) => void) | undefined;
        vi.mocked(publicApiInstance.get)
            .mockReturnValueOnce(
                new Promise(resolve => {
                    resolveStale = resolve;
                }),
            )
            .mockReturnValueOnce(
                new Promise(resolve => {
                    resolveFresh = resolve;
                }),
            );

        const stale = probeBackendHealth();
        const wentOfflineAt = performance.now();
        const fresh = [probeBackendHealth(wentOfflineAt), probeBackendHealth(wentOfflineAt)];

        expect(publicApiInstance.get).toHaveBeenCalledTimes(2);
        resolveFresh?.({ status: 204 });

        return expect(Promise.all(fresh))
            .resolves.toEqual(['ok', 'ok'])
            .then(() => {
                resolveStale?.({ status: 200 });
                return stale;
            });
    });

    test('a stale probe settling later does not clear the shared slot of the fresh one', async () => {
        let resolveStale: ((value: { status: number }) => void) | undefined;
        let resolveFresh: ((value: { status: number }) => void) | undefined;
        vi.mocked(publicApiInstance.get)
            .mockReturnValueOnce(
                new Promise(resolve => {
                    resolveStale = resolve;
                }),
            )
            .mockReturnValueOnce(
                new Promise(resolve => {
                    resolveFresh = resolve;
                }),
            );

        const stale = probeBackendHealth();
        const wentOfflineAt = performance.now();
        const fresh = probeBackendHealth(wentOfflineAt);
        resolveStale?.({ status: 200 });
        await stale;

        const joined = probeBackendHealth(wentOfflineAt);
        expect(publicApiInstance.get).toHaveBeenCalledTimes(2);
        resolveFresh?.({ status: 503 });

        await expect(Promise.all([fresh, joined])).resolves.toEqual(['error', 'error']);
    });

    test('reports a health request without a response as unreachable, never rejects', () => {
        vi.mocked(publicApiInstance.get).mockRejectedValue(new Error('Network Error'));

        return expect(probeBackendHealth()).resolves.toBe('unreachable');
    });
});
