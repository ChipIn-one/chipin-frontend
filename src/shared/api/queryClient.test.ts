import { describe, expect, test } from 'vitest';

import { ApiError, ApiResponseFormatError } from 'shared/lib/apiError';

import { createQueryClient, queryRetry } from './queryClient';

const apiError = (status: number, code?: string): ApiError =>
    new ApiError({ status, payload: code ? { code } : undefined, cause: undefined });

describe('queryRetry', () => {
    test.each([500, 502, 503, 504])('retries %i once (failureCount < 2)', status => {
        expect(queryRetry(0, apiError(status))).toBe(true);
        expect(queryRetry(1, apiError(status))).toBe(true);
        expect(queryRetry(2, apiError(status))).toBe(false);
    });

    test('retries a 409 SYSTEM.CONFLICT like a 5xx', () => {
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

    test('retries an error without an HTTP response up to 3 attempts', () => {
        const network = new Error('Network Error');

        expect(queryRetry(0, network)).toBe(true);
        expect(queryRetry(2, network)).toBe(true);
        expect(queryRetry(3, network)).toBe(false);
        expect(queryRetry(3, new ApiResponseFormatError(200))).toBe(false);
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
