import { describe, expect, test } from 'vitest';

import { ApiError, ApiResponseFormatError } from 'shared/lib/apiError';

import { InvalidPathSegmentError } from './client';
import { createQueryClient, queryRetry } from './queryClient';

const apiError = (status: number, code?: string): ApiError =>
    new ApiError({ status, payload: code ? { code } : undefined, cause: undefined });

// Axios error shapes (this layer does not import axios; client.test.ts covers isNetworkError with
// real Axios errors): `isAxiosError` marks an Axios error, `__CANCEL__` a cancellation.
const axiosLike = (fields: Record<string, unknown>): Error =>
    Object.assign(new Error('Axios error'), { isAxiosError: true, ...fields });
const networkError = (): Error => axiosLike({ code: 'ERR_NETWORK' });

// The interceptors' `AuthRequestCancelledError` is module-private: the same shape, a plain Error.
class AuthRequestCancelledError extends Error {
    override readonly name = 'AuthRequestCancelledError';
}

describe('queryRetry (failureCount starts at 0: `< n` = n retries)', () => {
    test.each([500, 502, 503, 504])('gives %i 2 retries (3 attempts)', status => {
        expect(queryRetry(0, apiError(status))).toBe(true);
        expect(queryRetry(1, apiError(status))).toBe(true);
        expect(queryRetry(2, apiError(status))).toBe(false);
    });

    test('gives a 409 SYSTEM.CONFLICT 2 retries, like a 5xx', () => {
        expect(queryRetry(1, apiError(409, 'SYSTEM.CONFLICT'))).toBe(true);
        expect(queryRetry(2, apiError(409, 'SYSTEM.CONFLICT'))).toBe(false);
    });

    test.each([
        [400, undefined],
        [401, 'AUTH.UNAUTHORIZED'],
        [403, undefined],
        [404, undefined],
        [409, 'LEDGER.VERSION_CONFLICT'],
        [409, undefined],
        [426, 'CLIENT.OUTDATED'],
    ])('never retries another 4xx: %i %s', (status, code) => {
        expect(queryRetry(0, apiError(status, code))).toBe(false);
    });

    test('gives a network error (no HTTP response) 3 retries (4 attempts)', () => {
        expect(queryRetry(0, networkError())).toBe(true);
        expect(queryRetry(2, networkError())).toBe(true);
        expect(queryRetry(3, networkError())).toBe(false);
    });

    test.each([
        ['ApiResponseFormatError', new ApiResponseFormatError(200)],
        ['InvalidPathSegmentError', new InvalidPathSegmentError()],
        ['a mapper TypeError', new TypeError("Cannot read properties of undefined (reading 'x')")],
        ['AuthRequestCancelledError', new AuthRequestCancelledError()],
        ['an Axios cancellation', axiosLike({ code: 'ERR_CANCELED', __CANCEL__: true })],
        ['an Axios error with a response', axiosLike({ response: { status: 500 } })],
        ['a non-error value', 'boom'],
    ])('never retries %s', (_name, error) => {
        expect(queryRetry(0, error)).toBe(false);
    });
});

describe('createQueryClient', () => {
    test('returns a new client with the spec defaults', () => {
        const client = createQueryClient();
        const { queries, mutations } = client.getDefaultOptions();

        expect(createQueryClient()).not.toBe(client);
        expect(queries).toMatchObject({
            networkMode: 'offlineFirst',
            staleTime: 30_000,
            retry: queryRetry,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
        });
        expect(mutations).toMatchObject({ networkMode: 'offlineFirst', retry: false });
    });
});
