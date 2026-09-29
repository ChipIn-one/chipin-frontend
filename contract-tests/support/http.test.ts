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

describe('createContractHttpClient', () => {
    it('sends only Basic authorization for a Basic-auth request', () => {
        let capturedHeaders: Headers | null = null;

        const fetchImpl: typeof fetch = (_input, init) => {
            capturedHeaders = new Headers(init?.headers);

            return Promise.resolve(new Response('openapi: 3.0.0', { status: 200 }));
        };

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestText({
                auth: { kind: 'basic' },
                method: 'GET',
                path: '/swagger/documentation.yaml',
            })
            .then(() => {
                expect(capturedHeaders?.get('Authorization')).toMatch(/^Basic /);
                expect(capturedHeaders?.has('X-Refresh-Token')).toBe(false);
            });
    });

    it('sends only Bearer authorization for an authenticated API request', () => {
        let capturedHeaders: Headers | null = null;

        const fetchImpl: typeof fetch = (_input, init) => {
            capturedHeaders = new Headers(init?.headers);

            return Promise.resolve(
                new Response(JSON.stringify({ id: 'user-id' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                }),
            );
        };

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJson({
                auth: { kind: 'bearer', token: 'access-token-secret' },
                method: 'GET',
                path: '/users/self',
            })
            .then(() => {
                expect(capturedHeaders?.get('Authorization')).toBe(
                    'Bearer access-token-secret',
                );
                expect(capturedHeaders?.has('X-Refresh-Token')).toBe(false);
            });
    });

    it('sends only X-Refresh-Token for refresh', () => {
        let capturedHeaders: Headers | null = null;

        const fetchImpl: typeof fetch = (_input, init) => {
            capturedHeaders = new Headers(init?.headers);

            return Promise.resolve(
                new Response(JSON.stringify({ token: 'next', refresh_token: 'next-refresh' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                }),
            );
        };

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJson({
                auth: { kind: 'refresh', token: 'refresh-token-secret' },
                method: 'POST',
                path: '/auth/refresh',
            })
            .then(() => {
                expect(capturedHeaders?.has('Authorization')).toBe(false);
                expect(capturedHeaders?.get('X-Refresh-Token')).toBe(
                    'refresh-token-secret',
                );
            });
    });


    it('disables redirects before sending refresh tokens', () => {
        let capturedRedirect: RequestRedirect | undefined;

        const fetchImpl: typeof fetch = (_input, init) => {
            capturedRedirect = init?.redirect;

            return Promise.resolve(
                new Response(JSON.stringify({ token: 'next', refresh_token: 'next-refresh' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                }),
            );
        };

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJson({
                auth: { kind: 'refresh', token: 'refresh-token-secret' },
                method: 'POST',
                path: '/auth/refresh',
            })
            .then(() => {
                expect(capturedRedirect).toBe('error');
            });
    });

    it('does not send Basic authorization to localhost', () => {
        let capturedHeaders: Headers | null = null;
        const localConfig: ContractConfig = {
            baseUrl: 'http://localhost:8080',
            basicAuth: null,
            target: 'local',
        };

        const fetchImpl: typeof fetch = (_input, init) => {
            capturedHeaders = new Headers(init?.headers);

            return Promise.resolve(new Response('ok', { status: 200 }));
        };

        return createContractHttpClient(localConfig, fetchImpl)
            .requestText({
                auth: { kind: 'basic' },
                method: 'GET',
                path: '/swagger/documentation.yaml',
            })
            .then(() => {
                expect(capturedHeaders?.has('Authorization')).toBe(false);
            });
    });


    it('rejects network-path references before sending credentials', () => {
        let calls = 0;
        const fetchImpl: typeof fetch = () => {
            calls += 1;

            return Promise.resolve(new Response('unexpected', { status: 200 }));
        };

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestText({
                auth: { kind: 'basic' },
                method: 'GET',
                path: '//api.chipin.one/auth/test-register',
            })
            .then(
                () => {
                    throw new Error('Expected the request to fail');
                },
                (error: unknown) => {
                    expect(error).toEqual(
                        new Error('Contract request path must stay on the configured origin'),
                    );
                    expect(calls).toBe(0);
                },
            );
    });

    it('keeps HTTP response bodies out of failure messages', () => {
        const fetchImpl: typeof fetch = () =>
            Promise.resolve(
                new Response('access-token-secret raw backend body', {
                    status: 401,
                }),
            );

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJson({
                auth: { kind: 'basic' },
                body: { runId: 'contract-run' },
                method: 'POST',
                path: '/auth/test-register',
            })
            .then(
                () => {
                    throw new Error('Expected the request to fail');
                },
                (error: unknown) => {
                    expect(error).toEqual(
                        new Error(
                            'Contract request POST /auth/test-register failed with HTTP 401',
                        ),
                    );
                    expect(String(error)).not.toContain('access-token-secret');
                },
            );
    });

    it('keeps invalid JSON bodies out of parse errors', () => {
        const fetchImpl: typeof fetch = () =>
            Promise.resolve(new Response('refresh-token-secret not-json', { status: 200 }));

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJson({
                auth: { kind: 'bearer', token: 'access-token-secret' },
                method: 'GET',
                path: '/users/self',
            })
            .then(
                () => {
                    throw new Error('Expected the response parse to fail');
                },
                (error: unknown) => {
                    expect(error).toEqual(
                        new Error(
                            'Contract request GET /users/self returned invalid JSON',
                        ),
                    );
                    expect(String(error)).not.toContain('refresh-token-secret');
                    expect(String(error)).not.toContain('access-token-secret');
                },
            );
    });

    it('does not retry a failed request', () => {
        let calls = 0;
        const fetchImpl: typeof fetch = () => {
            calls += 1;

            return Promise.reject(new Error('network failure'));
        };

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestText({
                auth: { kind: 'none' },
                method: 'GET',
                path: '/health',
            })
            .then(
                () => {
                    throw new Error('Expected the request to fail');
                },
                (error: unknown) => {
                    expect(error).toEqual(new Error('Contract request GET /health failed'));
                    expect(calls).toBe(1);
                },
            );
    });
});
