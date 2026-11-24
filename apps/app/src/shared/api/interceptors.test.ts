import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { APP_VERSION } from 'constants/version';

import { AUTH_API_PATH } from './authPaths';
import { parseVersionCore } from './clientVersion';
import { apiInstance, publicApiInstance } from './instance';
import { type ApiAuthSession, initChipInApiInterceptors } from './interceptors';

const onUnauthorizedSession = vi.fn();
const onRequestFailure = vi.fn<(error: unknown, requestStartedAt?: number) => Promise<void>>();
const onResponseSuccess = vi.fn<(requestStartedAt?: number) => void>();
const onAccessTokenChanged = vi.fn<(token: string) => void>();
const onClientOutdated = vi.fn<() => void>();

const authSessionMocks = vi.hoisted(() => ({
    accessToken: 'current-access-token',
    currentVersion: 1,
    signedOut: false,
    prepareAuthRequest: vi.fn<() => Promise<string | null | undefined>>(),
    hasAuthAccessTokenRotated: vi.fn<(previousAccessToken: string) => boolean>(),
    refreshAuthSession: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

// No expected-subject request reaches the interceptors in these cases.
const authSession: ApiAuthSession = {
    getAccessTokenSubject: () => null,
    getAuthSessionVersion: () => authSessionMocks.currentVersion,
    hasAuthAccessTokenRotated: authSessionMocks.hasAuthAccessTokenRotated,
    isAuthSessionCurrent: (version: number) => version === authSessionMocks.currentVersion,
    isAuthSessionSignedOut: () => authSessionMocks.signedOut,
    isAuthSessionSwitchedSince: () => false,
    prepareAuthRequest: authSessionMocks.prepareAuthRequest,
    refreshAuthSession: authSessionMocks.refreshAuthSession,
};

vi.mock('shared/lib/env', () => ({
    getChipInApiUrl: () => 'https://api.example.test',
}));

beforeAll(() => {
    initChipInApiInterceptors(
        authSession,
        onUnauthorizedSession,
        onRequestFailure,
        onResponseSuccess,
        onAccessTokenChanged,
        onClientOutdated,
    );
});

beforeEach(() => {
    vi.clearAllMocks();
    authSessionMocks.accessToken = 'current-access-token';
    authSessionMocks.currentVersion = 1;
    authSessionMocks.signedOut = false;
    authSessionMocks.prepareAuthRequest.mockImplementation(() =>
        Promise.resolve(authSessionMocks.accessToken),
    );
    authSessionMocks.hasAuthAccessTokenRotated.mockImplementation(
        previousAccessToken => previousAccessToken !== authSessionMocks.accessToken,
    );
    authSessionMocks.refreshAuthSession.mockImplementation(() => {
        authSessionMocks.accessToken = 'next-access-token';
        return Promise.resolve('next-access-token');
    });
    onRequestFailure.mockResolvedValue(undefined);
});

const unauthorizedResponse = (config: object) => ({
    config,
    isAxiosError: true,
    response: {
        data: { code: 'AUTH.UNAUTHORIZED' },
        status: 401,
    },
});

const rejectRequest = (url: string, status: number) => {
    return apiInstance.request({
        method: 'post',
        url,
        adapter: config =>
            Promise.reject({
                config,
                isAxiosError: true,
                response: {
                    data: {
                        code: status === 401 ? 'AUTH.UNAUTHORIZED' : 'VALIDATION.INVALID',
                    },
                    status,
                },
            }),
    });
};

const rejectPublicRequest = (url: string, status: number) => {
    return publicApiInstance.request({
        method: 'get',
        url,
        adapter: config =>
            Promise.reject({
                config,
                isAxiosError: true,
                response: { status },
            }),
    });
};

test('refreshes once and retries a protected request after 401', () => {
    let attempts = 0;
    const authorizationHeaders: Array<string | undefined> = [];

    return apiInstance
        .request({
            method: 'get',
            url: '/dashboard',
            adapter: config => {
                attempts += 1;
                authorizationHeaders.push(config.headers.Authorization?.toString());

                if (attempts === 1) {
                    return Promise.reject(unauthorizedResponse(config));
                }

                return Promise.resolve({
                    config,
                    data: { ok: true },
                    headers: {},
                    status: 200,
                    statusText: 'OK',
                });
            },
        })
        .then(() => {
            expect(authSessionMocks.refreshAuthSession).toHaveBeenCalledOnce();
            expect(attempts).toBe(2);
            expect(authorizationHeaders).toEqual([
                'Bearer current-access-token',
                'Bearer next-access-token',
            ]);
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

test('does not loop when the retried protected request is still unauthorized', () => {
    let attempts = 0;

    return expect(
        apiInstance.request({
            method: 'get',
            url: '/dashboard',
            adapter: config => {
                attempts += 1;
                return Promise.reject(unauthorizedResponse(config));
            },
        }),
    )
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(attempts).toBe(2);
            expect(authSessionMocks.refreshAuthSession).toHaveBeenCalledOnce();
            expect(onUnauthorizedSession).toHaveBeenCalledOnce();
        });
});

test('expires the session when refresh cannot restore a protected request', () => {
    authSessionMocks.refreshAuthSession.mockResolvedValue(null);

    return expect(rejectRequest('/dashboard', 401))
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(authSessionMocks.refreshAuthSession).toHaveBeenCalledOnce();
            expect(onUnauthorizedSession).toHaveBeenCalledOnce();
        });
});

test('expires the session when a protected request cannot restore the cookie session before sending', () => {
    let adapterCalls = 0;
    authSessionMocks.prepareAuthRequest.mockResolvedValue(null);

    return expect(
        apiInstance.request({
            method: 'get',
            url: '/dashboard',
            adapter: config => {
                adapterCalls += 1;
                return Promise.resolve({
                    config,
                    data: { ok: true },
                    headers: {},
                    status: 200,
                    statusText: 'OK',
                });
            },
        }),
    )
        .rejects.toThrow('Auth request cancelled')
        .then(() => {
            expect(adapterCalls).toBe(0);
            expect(onUnauthorizedSession).toHaveBeenCalledOnce();
        });
});

test('preserves an explicit signed-out state when a late protected request is cancelled', () => {
    let adapterCalls = 0;
    authSessionMocks.signedOut = true;
    authSessionMocks.prepareAuthRequest.mockResolvedValue(null);

    return expect(
        apiInstance.request({
            method: 'get',
            url: '/dashboard',
            adapter: config => {
                adapterCalls += 1;
                return Promise.resolve({
                    config,
                    data: { ok: true },
                    headers: {},
                    status: 200,
                    statusText: 'OK',
                });
            },
        }),
    )
        .rejects.toThrow('Auth request cancelled')
        .then(() => {
            expect(adapterCalls).toBe(0);
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

test('ignores a protected request 401 from an older auth session', () => {
    let rejectResponse: ((reason?: unknown) => void) | undefined;
    let markAdapterStarted: (() => void) | undefined;
    const adapterStarted = new Promise<void>(resolve => {
        markAdapterStarted = resolve;
    });
    const request = apiInstance.request({
        method: 'get',
        url: '/dashboard',
        adapter: config =>
            new Promise((_resolve, reject) => {
                rejectResponse = () => reject(unauthorizedResponse(config));
                markAdapterStarted?.();
            }),
    });

    return adapterStarted
        .then(() => {
            authSessionMocks.currentVersion = 2;
            rejectResponse?.();
            return expect(request).rejects.toMatchObject({
                response: { status: 401 },
            });
        })
        .then(() => {
            expect(authSessionMocks.refreshAuthSession).not.toHaveBeenCalled();
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

test.each([
    '/auth/logout',
    '/auth/oauth/google/exchange',
    '/auth/refresh',
    '/auth/logout-other-devices',
])('leaves %s 401 to its owning auth flow', url => {
    return expect(rejectRequest(url, 401))
        .rejects.toMatchObject({
            response: { status: 401 },
        })
        .then(() => {
            expect(authSessionMocks.refreshAuthSession).not.toHaveBeenCalled();
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
        });
});

test('leaves retryable validation feedback to the owning UI flow', () => {
    return expect(rejectRequest('/auth/logout-other-devices', 400))
        .rejects.toMatchObject({
            response: { status: 400 },
        })
        .then(() => {
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
        });
});

test('hands a failed response to the connectivity callback before rejecting it', () => {
    let finishClassification: (() => void) | undefined;
    let settled = false;
    onRequestFailure.mockReturnValueOnce(
        new Promise<void>(resolve => {
            finishClassification = resolve;
        }),
    );

    const request = rejectRequest('/dashboard', 503).finally(() => {
        settled = true;
    });

    return vi
        .waitFor(() => {
            expect(onRequestFailure).toHaveBeenCalledOnce();
        })
        .then(() => {
            expect(onRequestFailure).toHaveBeenCalledWith(
                expect.objectContaining({ response: expect.objectContaining({ status: 503 }) }),
                expect.any(Number),
            );
            expect(settled).toBe(false);
            finishClassification?.();

            return expect(request).rejects.toMatchObject({ response: { status: 503 } });
        });
});

test('keeps the original error when the connectivity callback fails', () => {
    onRequestFailure.mockRejectedValueOnce(new Error('classification failed'));

    return expect(rejectRequest('/dashboard', 503)).rejects.toMatchObject({
        response: { status: 503 },
    });
});

test('hands an application 4xx to the callback too (it classifies it as a client error)', () => {
    return expect(rejectRequest('/dashboard', 404))
        .rejects.toMatchObject({ response: { status: 404 } })
        .then(() => {
            expect(onRequestFailure).toHaveBeenCalledOnce();
        });
});

test('does not hand an owned auth-flow 401 to the connectivity callback', () => {
    return expect(rejectRequest('/auth/logout', 401))
        .rejects.toMatchObject({ response: { status: 401 } })
        .then(() => {
            expect(onRequestFailure).not.toHaveBeenCalled();
        });
});

test('hands a public API failure to the callback, but never the /health probe itself', () => {
    return expect(rejectPublicRequest('/stats', 503))
        .rejects.toMatchObject({ response: { status: 503 } })
        .then(() => {
            expect(onRequestFailure).toHaveBeenCalledOnce();

            return expect(rejectPublicRequest('/health', 503)).rejects.toMatchObject({
                response: { status: 503 },
            });
        })
        .then(() => {
            expect(onRequestFailure).toHaveBeenCalledOnce();
        });
});

test('reports every successful response of both instances, never a failed one', async () => {
    const ok = (instance: typeof apiInstance, url: string) =>
        instance.get(url, {
            adapter: config =>
                Promise.resolve({ config, data: {}, headers: {}, status: 200, statusText: 'OK' }),
        });

    await ok(apiInstance, '/dashboard');
    await ok(publicApiInstance, '/stats');
    expect(onResponseSuccess).toHaveBeenCalledTimes(2);

    await expect(rejectPublicRequest('/stats', 503)).rejects.toMatchObject({
        response: { status: 503 },
    });
    expect(onResponseSuccess).toHaveBeenCalledTimes(2);
});

test('spec 03 §2.3: every new access token is announced once, before a request carries it', async () => {
    const ok = () =>
        apiInstance.get('/dashboard', {
            adapter: config =>
                Promise.resolve({ config, data: {}, headers: {}, status: 200, statusText: 'OK' }),
        });

    authSessionMocks.accessToken = 'token-of-a-sign-in';
    await ok();
    await ok();
    expect(onAccessTokenChanged.mock.calls).toEqual([['token-of-a-sign-in']]);

    authSessionMocks.accessToken = 'token-of-a-refresh';
    await ok();
    expect(onAccessTokenChanged.mock.calls).toEqual([
        ['token-of-a-sign-in'],
        ['token-of-a-refresh'],
    ]);
});

test('passes when the failed request was sent, for the store to drop stale classifications', async () => {
    const before = performance.now();

    await expect(rejectPublicRequest('/stats', 503)).rejects.toMatchObject({
        response: { status: 503 },
    });

    const startedAt = onRequestFailure.mock.calls[0]?.[1];
    expect(startedAt).toBeGreaterThanOrEqual(before);
    expect(startedAt).toBeLessThanOrEqual(performance.now());
});

test('passes when a successful request was sent, for the store to drop stale successes', async () => {
    const ok = (instance: typeof apiInstance, url: string) =>
        instance.get(url, {
            adapter: config =>
                Promise.resolve({ config, data: {}, headers: {}, status: 200, statusText: 'OK' }),
        });
    const before = performance.now();

    await ok(apiInstance, '/dashboard');
    await ok(publicApiInstance, '/stats');

    const after = performance.now();
    const startTimes = onResponseSuccess.mock.calls.map(([startedAt]) => startedAt);
    expect(startTimes).toHaveLength(2);
    for (const startedAt of startTimes) {
        expect(startedAt).toBeGreaterThanOrEqual(before);
        expect(startedAt).toBeLessThanOrEqual(after);
    }
});

test('a non-2xx /health probe answer is a successful response: it marks the network usable', async () => {
    // Intended: the probe resolves every HTTP answer (`validateStatus: () => true`), and any answer
    // proves the network, not the backend.
    await publicApiInstance.get('/health', {
        validateStatus: () => true,
        adapter: config =>
            Promise.resolve({ config, data: {}, headers: {}, status: 503, statusText: '' }),
    });

    expect(onResponseSuccess).toHaveBeenCalledOnce();
    expect(onRequestFailure).not.toHaveBeenCalled();
});

test('rejects a stale successful protected response after logout', () => {
    let finish: (() => void) | undefined;
    let onStarted: (() => void) | undefined;
    const started = new Promise<void>(resolve => {
        onStarted = resolve;
    });
    const request = apiInstance.get('/dashboard', {
        adapter: config =>
            new Promise(resolve => {
                finish = () =>
                    resolve({
                        config,
                        data: { protected: true },
                        headers: {},
                        status: 200,
                        statusText: 'OK',
                    });
                onStarted?.();
            }),
    });

    return started.then(() => {
        authSessionMocks.currentVersion = 2;
        finish?.();
        return expect(request).rejects.toThrow('Auth request cancelled');
    });
});

test('does not send or expire the new session when an old request resumes', () => {
    let resolveToken: ((token: string) => void) | undefined;
    let onPrepare: (() => void) | undefined;
    const prepareStarted = new Promise<void>(resolve => {
        onPrepare = resolve;
    });
    const pendingToken = new Promise<string>(resolve => {
        resolveToken = resolve;
    });
    authSessionMocks.prepareAuthRequest.mockImplementation(() => {
        onPrepare?.();
        return pendingToken;
    });
    const adapter = vi.fn();
    const request = apiInstance.get('/dashboard', { adapter });

    return prepareStarted
        .then(() => {
            authSessionMocks.currentVersion = 2;
            resolveToken?.('old-token');
            return expect(request).rejects.toThrow('Auth request cancelled');
        })
        .then(() => {
            expect(adapter).not.toHaveBeenCalled();
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

describe('03-20 client version gate', () => {
    type RequestConfig = Parameters<
        NonNullable<Parameters<typeof apiInstance.interceptors.request.use>[0]>
    >[0];

    const appCore = parseVersionCore(APP_VERSION) ?? [0, 0, 0];
    const equalMinimum = appCore.join('.');
    const higherMinimum = `${appCore[0]}.${appCore[1]}.${appCore[2] + 1}`;
    const lowerMinimum = '0.0.0';

    const clientVersionOf = (config: RequestConfig): unknown =>
        config.headers.get('X-Client-Version');

    const respond =
        (headers: Record<string, string> = {}, status = 200) =>
        (config: RequestConfig) =>
            Promise.resolve({ config, data: { ok: true }, headers, status, statusText: 'OK' });

    const failWith =
        (status: number, code?: string, headers: Record<string, string> = {}) =>
        (config: RequestConfig) =>
            Promise.reject({
                config,
                isAxiosError: true,
                response: { config, data: code ? { code } : {}, headers, status },
            });

    test('03-20 / API-001: sends X-Client-Version on every request of both instances, the refresh included', async () => {
        const seen: unknown[] = [];
        const record = (config: RequestConfig) => {
            seen.push(clientVersionOf(config));
            return respond()(config);
        };

        await apiInstance.get('/dashboard', { adapter: record });
        await apiInstance.post(AUTH_API_PATH.REFRESH, undefined, { adapter: record });
        await publicApiInstance.get('/health', { adapter: record });

        expect(APP_VERSION).not.toBe('');
        expect(seen).toEqual([APP_VERSION, APP_VERSION, APP_VERSION]);
    });

    test('03-20 / API-001: the request retried after a refresh carries X-Client-Version too', async () => {
        const seen: unknown[] = [];
        let attempts = 0;

        await apiInstance.get('/dashboard', {
            adapter: config => {
                attempts += 1;
                seen.push(clientVersionOf(config));
                return attempts === 1
                    ? Promise.reject(unauthorizedResponse(config))
                    : respond()(config);
            },
        });

        expect(seen).toEqual([APP_VERSION, APP_VERSION]);
    });

    test('03-20 / API-002: a 426 CLIENT.OUTDATED calls the outdated handler and still rejects to its caller', async () => {
        await expect(
            apiInstance.get('/dashboard', { adapter: failWith(426, 'CLIENT.OUTDATED') }),
        ).rejects.toMatchObject({ response: { status: 426 } });
        await expect(
            publicApiInstance.get('/public', { adapter: failWith(426, 'CLIENT.OUTDATED') }),
        ).rejects.toMatchObject({ response: { status: 426 } });

        expect(onClientOutdated).toHaveBeenCalledTimes(2);
        expect(onRequestFailure).toHaveBeenCalledTimes(2);
        expect(onUnauthorizedSession).not.toHaveBeenCalled();
    });

    test('03-20 / API-002: a 426 without CLIENT.OUTDATED does not call the handler', async () => {
        await expect(
            apiInstance.get('/dashboard', { adapter: failWith(426, 'SYSTEM.INTERNAL') }),
        ).rejects.toMatchObject({ response: { status: 426 } });

        expect(onClientOutdated).not.toHaveBeenCalled();
    });

    test('03-20 / API-004: an X-Min-Client-Version above APP_VERSION calls the handler on success and on error', async () => {
        const response = await apiInstance.get('/dashboard', {
            adapter: respond({ 'x-min-client-version': higherMinimum }),
        });
        await publicApiInstance.get('/public', {
            adapter: respond({ 'X-Min-Client-Version': `${higherMinimum}-dev-abc1234` }),
        });
        await expect(
            apiInstance.get('/dashboard', {
                adapter: failWith(404, 'GROUP.NOT_FOUND', {
                    'x-min-client-version': higherMinimum,
                }),
            }),
        ).rejects.toMatchObject({ response: { status: 404 } });

        expect(response.data).toEqual({ ok: true });
        expect(onClientOutdated).toHaveBeenCalledTimes(3);
    });

    test.each([
        ['equal', () => equalMinimum],
        ['equal with a suffix', () => `${equalMinimum}-dev-abc1234`],
        ['lower', () => lowerMinimum],
        ['malformed', () => 'not-a-version'],
    ])(
        '03-20 / API-004: an X-Min-Client-Version that is %s does not call the handler',
        async (_name, minimum) => {
            await apiInstance.get('/dashboard', {
                adapter: respond({ 'x-min-client-version': minimum() }),
            });
            await publicApiInstance.get('/public', {
                adapter: respond({ 'x-min-client-version': minimum() }),
            });

            expect(onClientOutdated).not.toHaveBeenCalled();
        },
    );

    test('03-20 / API-005: without a minimum (no header, no 426) nothing changes', async () => {
        const response = await apiInstance.get('/dashboard', { adapter: respond() });
        const publicResponse = await publicApiInstance.get('/public', { adapter: respond() });
        await expect(
            apiInstance.get('/dashboard', { adapter: failWith(500, 'SYSTEM.INTERNAL') }),
        ).rejects.toMatchObject({ response: { status: 500 } });
        await expect(rejectPublicRequest('/public', 503)).rejects.toMatchObject({
            response: { status: 503 },
        });

        expect(response.data).toEqual({ ok: true });
        expect(publicResponse.data).toEqual({ ok: true });
        expect(onClientOutdated).not.toHaveBeenCalled();
        expect(onResponseSuccess).toHaveBeenCalledTimes(2);
        expect(onRequestFailure).toHaveBeenCalledTimes(2);
        expect(onUnauthorizedSession).not.toHaveBeenCalled();
    });
});
