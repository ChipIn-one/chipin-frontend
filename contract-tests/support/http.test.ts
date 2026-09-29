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
                expect(capturedHeaders?.has('Cookie')).toBe(false);
                expect(capturedHeaders?.has('X-Chipin-Csrf')).toBe(false);
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
                expect(capturedHeaders?.has('Cookie')).toBe(false);
                expect(capturedHeaders?.has('X-Chipin-Csrf')).toBe(false);
            });
    });

    it('stores the refresh cookie and sends it with the CSRF header', () => {
        const capturedHeaders: Headers[] = [];
        let call = 0;
        const client = createContractHttpClient(stagingConfig, (_input, init) => {
            capturedHeaders.push(new Headers(init?.headers));
            call += 1;

            if (call === 1) {
                return Promise.resolve(
                    new Response(JSON.stringify({ accessToken: 'access-token' }), {
                        headers: {
                            'Content-Type': 'application/json',
                            'Set-Cookie':
                                '__Host-chipin_refresh=refresh-cookie-1; Path=/; Secure; HttpOnly; SameSite=Strict',
                        },
                        status: 200,
                    }),
                );
            }

            return Promise.resolve(
                new Response(JSON.stringify({ token: 'next-access-token' }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Set-Cookie':
                            '__Host-chipin_refresh=refresh-cookie-2; Path=/; Secure; HttpOnly; SameSite=Strict',
                    },
                    status: 200,
                }),
            );
        });

        return client
            .requestJson({
                auth: { kind: 'basic' },
                body: { runId: 'contract-run' },
                method: 'POST',
                path: '/auth/test-register',
            })
            .then(() =>
                client.requestJson({
                    auth: { kind: 'session' },
                    method: 'POST',
                    path: '/auth/refresh',
                }),
            )
            .then(() => {
                expect(capturedHeaders[1]?.get('Cookie')).toBe(
                    '__Host-chipin_refresh=refresh-cookie-1',
                );
                expect(capturedHeaders[1]?.get('X-Chipin-Csrf')).toBe('1');
                expect(capturedHeaders[1]?.has('Authorization')).toBe(false);
                expect(capturedHeaders[1]?.has('X-Refresh-Token')).toBe(false);
            });
    });

    it.each([
        [
            'Secure',
            '__Host-chipin_refresh=refresh-cookie; Path=/; HttpOnly; SameSite=Strict',
        ],
        [
            'HttpOnly',
            '__Host-chipin_refresh=refresh-cookie; Path=/; Secure; SameSite=Strict',
        ],
        [
            'host-only scope',
            '__Host-chipin_refresh=refresh-cookie; Path=/; Secure; HttpOnly; SameSite=Strict; Domain=api-dev.chipin.one',
        ],
        [
            'Path=/',
            '__Host-chipin_refresh=refresh-cookie; Path=/auth; Secure; HttpOnly; SameSite=Strict',
        ],
        [
            'SameSite=Strict',
            '__Host-chipin_refresh=refresh-cookie; Path=/; Secure; HttpOnly; SameSite=Lax',
        ],
    ])('rejects a refresh cookie without %s', (_requirement, setCookie) => {
        const fetchImpl: typeof fetch = () =>
            Promise.resolve(
                new Response(JSON.stringify({ accessToken: 'access-token' }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Set-Cookie': setCookie,
                    },
                    status: 200,
                }),
            );

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJson({
                auth: { kind: 'basic' },
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
                            'Contract refresh cookie violates required security attributes',
                        ),
                    );
                    expect(String(error)).not.toContain('refresh-cookie');
                },
            );
    });

    it('uses the rotated refresh cookie on the next session request', () => {
        const sessionCookies: string[] = [];
        let call = 0;
        const client = createContractHttpClient(stagingConfig, (_input, init) => {
            const headers = new Headers(init?.headers);
            call += 1;

            if (headers.has('Cookie')) {
                sessionCookies.push(headers.get('Cookie') ?? '');
            }

            return Promise.resolve(
                new Response(JSON.stringify({ token: `access-${call}` }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Set-Cookie':
                            `__Host-chipin_refresh=refresh-cookie-${call}; Path=/; Secure; HttpOnly; SameSite=Strict`,
                    },
                    status: 200,
                }),
            );
        });

        return client
            .requestJson({
                auth: { kind: 'basic' },
                method: 'POST',
                path: '/auth/test-register',
            })
            .then(() =>
                client.requestJson({
                    auth: { kind: 'session' },
                    method: 'POST',
                    path: '/auth/refresh',
                }),
            )
            .then(() =>
                client.requestJson({
                    auth: { kind: 'session' },
                    method: 'POST',
                    path: '/auth/refresh',
                }),
            )
            .then(() => {
                expect(sessionCookies).toEqual([
                    '__Host-chipin_refresh=refresh-cookie-1',
                    '__Host-chipin_refresh=refresh-cookie-2',
                ]);
            });
    });

    it('rejects a session request before a refresh cookie is available', () => {
        let calls = 0;
        const fetchImpl: typeof fetch = () => {
            calls += 1;
            return Promise.resolve(new Response('{}', { status: 200 }));
        };

        return createContractHttpClient(stagingConfig, fetchImpl)
            .requestJson({
                auth: { kind: 'session' },
                method: 'POST',
                path: '/auth/refresh',
            })
            .then(
                () => {
                    throw new Error('Expected the request to fail');
                },
                (error: unknown) => {
                    expect(error).toEqual(
                        new Error('Contract refresh cookie is required'),
                    );
                    expect(calls).toBe(0);
                },
            );
    });

    it('disables redirects before sending session cookies', () => {
        let capturedRedirect: RequestRedirect | undefined;
        let call = 0;
        const client = createContractHttpClient(stagingConfig, (_input, init) => {
            capturedRedirect = init?.redirect;
            call += 1;
            return Promise.resolve(
                new Response(JSON.stringify({ token: 'next' }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Set-Cookie':
                            '__Host-chipin_refresh=refresh-cookie; Path=/; Secure; HttpOnly; SameSite=Strict',
                    },
                    status: 200,
                }),
            );
        });

        return client
            .requestJson({
                auth: { kind: 'basic' },
                method: 'POST',
                path: '/auth/test-register',
            })
            .then(() =>
                client.requestJson({
                    auth: { kind: 'session' },
                    method: 'POST',
                    path: '/auth/refresh',
                }),
            )
            .then(() => {
                expect(call).toBe(2);
                expect(capturedRedirect).toBe('error');
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
