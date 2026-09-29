import type { InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { establishAuthSession, invalidateAuthSession } from 'helpers/authSession';

import { apiInstance } from './chipin.instance';
import { initChipInApiInterceptors } from './chipin.interceptors';

const onUnauthorizedSession = vi.fn();
const defaultAdapter = apiInstance.defaults.adapter;

const createAccessToken = (subject: string): string => {
    return `header.${btoa(
        JSON.stringify({
            exp: Date.now() / 1000 + 3_600,
            sub: subject,
        }),
    )}.signature`;
};

const getAuthorizationHeader = (
    config: InternalAxiosRequestConfig,
): string | undefined => {
    const authorizationHeader = config.headers.Authorization;

    return typeof authorizationHeader === 'string' ? authorizationHeader : undefined;
};

const unauthorizedResponse = (config: InternalAxiosRequestConfig) => ({
    config,
    isAxiosError: true,
    response: {
        config,
        data: { code: 'AUTH.UNAUTHORIZED' },
        headers: {},
        status: 401,
        statusText: 'Unauthorized',
    },
});

const successResponse = (
    config: InternalAxiosRequestConfig,
    data: unknown = { ok: true },
) => ({
    config,
    data,
    headers: {},
    status: 200,
    statusText: 'OK',
});

const nextTask = (): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
};

beforeAll(() => {
    initChipInApiInterceptors(onUnauthorizedSession);
});

beforeEach(() => {
    onUnauthorizedSession.mockClear();
    invalidateAuthSession();
});

afterEach(() => {
    apiInstance.defaults.adapter = defaultAdapter;
    invalidateAuthSession();
});

test('deduplicates pending and delayed 401 refreshes without blocking the next rotation', () => {
    const accessTokenT0 = createAccessToken('t0');
    const accessTokenT1 = createAccessToken('t1');
    const accessTokenT2 = createAccessToken('t2');
    const authorizationHeaders: Record<'current' | 'first' | 'second' | 'third', string[]> = {
        current: [],
        first: [],
        second: [],
        third: [],
    };
    const rejectUnauthorizedRequests: Partial<Record<'first' | 'second' | 'third', () => void>> = {};
    let originalRequestsStarted = 0;
    let refreshCalls = 0;
    let markOriginalRequestsStarted: (() => void) | undefined;
    let markFirstRefreshStarted: (() => void) | undefined;
    let resolveFirstRefresh: (() => void) | undefined;
    const originalRequestsReady = new Promise<void>(resolve => {
        markOriginalRequestsStarted = resolve;
    });
    const firstRefreshStarted = new Promise<void>(resolve => {
        markFirstRefreshStarted = resolve;
    });

    establishAuthSession(accessTokenT0);

    apiInstance.defaults.adapter = config => {
        if (config.url === '/auth/refresh') {
            refreshCalls += 1;

            if (refreshCalls === 1) {
                markFirstRefreshStarted?.();
                return new Promise(resolve => {
                    resolveFirstRefresh = () => {
                        resolve(successResponse(config, { token: accessTokenT1 }));
                    };
                });
            }

            return Promise.resolve(successResponse(config, { token: accessTokenT2 }));
        }

        let requestName: 'current' | 'first' | 'second' | 'third' = 'current';

        if (config.url?.includes('request=first')) {
            requestName = 'first';
        } else if (config.url?.includes('request=second')) {
            requestName = 'second';
        } else if (config.url?.includes('request=third')) {
            requestName = 'third';
        }

        const authorizationHeader = getAuthorizationHeader(config);

        if (authorizationHeader) {
            authorizationHeaders[requestName].push(authorizationHeader);
        }

        if (
            requestName !== 'current' &&
            authorizationHeader === `Bearer ${accessTokenT0}`
        ) {
            originalRequestsStarted += 1;

            if (originalRequestsStarted === 3) {
                markOriginalRequestsStarted?.();
            }

            return new Promise((_resolve, reject) => {
                rejectUnauthorizedRequests[requestName] = () => {
                    reject(unauthorizedResponse(config));
                };
            });
        }

        if (
            requestName === 'current' &&
            authorizationHeader === `Bearer ${accessTokenT1}`
        ) {
            return Promise.reject(unauthorizedResponse(config));
        }

        return Promise.resolve(successResponse(config));
    };

    const firstRequest = apiInstance.get('/dashboard?request=first');
    const secondRequest = apiInstance.get('/dashboard?request=second');
    const thirdRequest = apiInstance.get('/dashboard?request=third');

    return originalRequestsReady
        .then(() => {
            rejectUnauthorizedRequests.first?.();
            return firstRefreshStarted;
        })
        .then(() => {
            rejectUnauthorizedRequests.second?.();
            return nextTask();
        })
        .then(() => {
            expect(refreshCalls).toBe(1);
            resolveFirstRefresh?.();
            return Promise.all([firstRequest, secondRequest]);
        })
        .then(() => {
            rejectUnauthorizedRequests.third?.();
            return thirdRequest;
        })
        .then(() => {
            expect(refreshCalls).toBe(1);
            expect(authorizationHeaders.first).toEqual([
                `Bearer ${accessTokenT0}`,
                `Bearer ${accessTokenT1}`,
            ]);
            expect(authorizationHeaders.second).toEqual([
                `Bearer ${accessTokenT0}`,
                `Bearer ${accessTokenT1}`,
            ]);
            expect(authorizationHeaders.third).toEqual([
                `Bearer ${accessTokenT0}`,
                `Bearer ${accessTokenT1}`,
            ]);

            return apiInstance.get('/dashboard?request=current');
        })
        .then(() => {
            expect(refreshCalls).toBe(2);
            expect(authorizationHeaders.current).toEqual([
                `Bearer ${accessTokenT1}`,
                `Bearer ${accessTokenT2}`,
            ]);
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

test('does not refresh or retry an old 401 after a new auth session is established', () => {
    const oldAccessToken = createAccessToken('old-session');
    const newAccessToken = createAccessToken('new-session');
    const newSessionAuthorizationHeaders: string[] = [];
    let refreshCalls = 0;
    let markOldRequestStarted: (() => void) | undefined;
    let rejectOldUnauthorized: (() => void) | undefined;
    const oldRequestStarted = new Promise<void>(resolve => {
        markOldRequestStarted = resolve;
    });

    establishAuthSession(oldAccessToken);

    apiInstance.defaults.adapter = config => {
        if (config.url === '/auth/refresh') {
            refreshCalls += 1;
            return Promise.reject(new Error('Unexpected refresh'));
        }

        if (config.url?.includes('request=old')) {
            return new Promise((_resolve, reject) => {
                rejectOldUnauthorized = () => reject(unauthorizedResponse(config));
                markOldRequestStarted?.();
            });
        }

        const authorizationHeader = getAuthorizationHeader(config);

        if (authorizationHeader) {
            newSessionAuthorizationHeaders.push(authorizationHeader);
        }

        return Promise.resolve(successResponse(config));
    };

    const oldRequest = apiInstance.get('/dashboard?request=old');

    return oldRequestStarted
        .then(() => {
            establishAuthSession(newAccessToken);
            rejectOldUnauthorized?.();

            return expect(oldRequest).rejects.toMatchObject({
                response: { status: 401 },
            });
        })
        .then(() => apiInstance.get('/dashboard?request=new'))
        .then(() => {
            expect(refreshCalls).toBe(0);
            expect(newSessionAuthorizationHeaders).toEqual([
                `Bearer ${newAccessToken}`,
            ]);
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});
