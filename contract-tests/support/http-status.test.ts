import { describe, expect, it } from 'vitest';

import type { ContractConfig } from './config';
import { createContractHttpClient } from './http';

const stagingConfig: ContractConfig = {
    baseUrl: 'https://api-dev.chipin.one',
    basicAuth: {
        username: 'contract-user',
        password: 'contract-password',
    },
    target: 'staging',
};

describe('requestJsonForStatus', () => {
    it('returns a structured JSON body for the expected non-2xx status', () => {
        const fetchImpl: typeof fetch = () =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        code: 'VALIDATION.INVALID',
                        details: { limit: 'must be between 1 and 100' },
                    }),
                    { status: 400 },
                ),
            );

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJsonForStatus(
                {
                    auth: { kind: 'bearer', token: 'access-token-secret' },
                    method: 'GET',
                    path: '/groups?limit=0',
                },
                400,
            )
            .then(value => {
                expect(value).toEqual({
                    code: 'VALIDATION.INVALID',
                    details: { limit: 'must be between 1 and 100' },
                });
            });
    });

    it('keeps an unexpected response body out of the failure message', () => {
        const fetchImpl: typeof fetch = () =>
            Promise.resolve(new Response('access-token-secret backend body', { status: 500 }));

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJsonForStatus(
                {
                    auth: { kind: 'bearer', token: 'access-token-secret' },
                    method: 'GET',
                    path: '/groups?limit=0',
                },
                400,
            )
            .then(
                () => {
                    throw new Error('Expected the request to fail');
                },
                (error: unknown) => {
                    expect(error).toEqual(
                        new Error(
                            'Contract request GET /groups?limit=0 expected HTTP 400 but received HTTP 500',
                        ),
                    );
                    expect(String(error)).not.toContain('access-token-secret');
                },
            );
    });

});
