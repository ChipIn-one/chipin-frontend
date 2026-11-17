import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError } from 'shared/lib/apiError';

import { classifyRequestError } from './errors';

const health = vi.hoisted(() => ({
    probeBackendHealth: vi.fn<() => Promise<'ok' | 'error' | 'unreachable'>>(),
}));

vi.mock('api/healthApi', () => ({ probeBackendHealth: health.probeBackendHealth }));

// Axios error shapes (this layer does not import axios): `isAxiosError` marks an Axios error,
// `__CANCEL__` a cancellation, `response` an HTTP answer.
const axiosLike = (fields: Record<string, unknown>): Error =>
    Object.assign(new Error('Axios error'), { isAxiosError: true, ...fields });
const withStatus = (status: number): Error => axiosLike({ response: { status } });
const networkError = (): Error => axiosLike({ code: 'ERR_NETWORK' });
const apiError = (status: number) => new ApiError({ status, payload: undefined, cause: null });

beforeEach(() => {
    vi.clearAllMocks();
    health.probeBackendHealth.mockResolvedValue('ok');
    onlineManager.setOnline(true);
});

afterEach(() => {
    onlineManager.setOnline(true);
});

describe('classifyRequestError (spec 03 §1.8)', () => {
    test('a network error while the network is not usable is offline without a probe', async () => {
        onlineManager.setOnline(false);

        await expect(classifyRequestError(networkError())).resolves.toBe('offline');
        expect(health.probeBackendHealth).not.toHaveBeenCalled();
    });

    test.each([
        ['unreachable', 'offline'],
        ['error', 'backend-down'],
        ['ok', 'request-error'],
    ] as const)('a network error with /health %s is %s', async (result, expected) => {
        health.probeBackendHealth.mockResolvedValue(result);

        await expect(classifyRequestError(networkError())).resolves.toBe(expected);
        expect(health.probeBackendHealth).toHaveBeenCalledOnce();
    });

    test.each([
        [503, 'error', 'backend-down'],
        [502, 'error', 'backend-down'],
        [504, 'unreachable', 'backend-down'],
        [500, 'ok', 'request-error'],
        [503, 'ok', 'request-error'],
    ] as const)('%i with /health %s is %s', async (status, result, expected) => {
        health.probeBackendHealth.mockResolvedValue(result);

        await expect(classifyRequestError(withStatus(status))).resolves.toBe(expected);
        await expect(classifyRequestError(apiError(status))).resolves.toBe(expected);
    });

    test.each([400, 401, 403, 404, 409, 429])('%i is a client error without a probe', async s => {
        await expect(classifyRequestError(withStatus(s))).resolves.toBe('client-error');
        await expect(classifyRequestError(apiError(s))).resolves.toBe('client-error');
        expect(health.probeBackendHealth).not.toHaveBeenCalled();
    });

    test.each([
        ['a cancellation', axiosLike({ __CANCEL__: true, code: 'ERR_CANCELED' })],
        ['a non-HTTP error', new TypeError('x')],
    ])('%s is a request error without a probe', async (_name, error) => {
        await expect(classifyRequestError(error)).resolves.toBe('request-error');
        expect(health.probeBackendHealth).not.toHaveBeenCalled();
    });
});
