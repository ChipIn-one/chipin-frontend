import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

import {
    establishAuthSession,
    getAccessTokenSubject,
    getFreshAccessToken,
    invalidateAuthSession,
    logoutOtherDevicesSession,
    markAuthSessionAccountSwitched,
    refreshAuthSession,
    setAccessTokenRefreshListener,
    startAuthLogout,
} from 'helpers/authSession';
import { hasAuthSessionHint } from 'helpers/localStorage';

import { apiInstance } from './chipin.instance';
import {
    AuthRequestCancelledError,
    EXPECTED_TOKEN_SUBJECT_CONFIG_KEY,
    initChipInApiInterceptors,
} from './chipin.interceptors';

const onUnauthorizedSession = vi.fn(() => {
    invalidateAuthSession();
});
const defaultAdapter = apiInstance.defaults.adapter;

type ApiRequestConfig = Parameters<
    NonNullable<Parameters<typeof apiInstance.interceptors.request.use>[0]>
>[0];

const createAccessToken = (subject: string): string => {
    return `header.${btoa(
        JSON.stringify({
            exp: Date.now() / 1000 + 3_600,
            sub: subject,
        }),
    )}.signature`;
};

const getAuthorizationHeader = (config: ApiRequestConfig): string | undefined => {
    const authorizationHeader = config.headers.Authorization;

    return typeof authorizationHeader === 'string' ? authorizationHeader : undefined;
};

const unauthorizedResponse = (config: ApiRequestConfig) => ({
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

const successResponse = (config: ApiRequestConfig, data: unknown = { ok: true }) => ({
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
    setAccessTokenRefreshListener(null);
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
    const rejectUnauthorizedRequests: Partial<Record<'first' | 'second' | 'third', () => void>> =
        {};
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

        if (requestName !== 'current' && authorizationHeader === `Bearer ${accessTokenT0}`) {
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

        if (requestName === 'current' && authorizationHeader === `Bearer ${accessTokenT1}`) {
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

test('preserves a rotated session after a delayed retried request is rejected', () => {
    const accessTokenT0 = createAccessToken('stale-t0');
    const accessTokenT1 = createAccessToken('retry-t1');
    const accessTokenT2 = createAccessToken('rotated-t2');
    const authorizationHeaders: string[] = [];
    let refreshCalls = 0;
    let staleRequestAttempts = 0;
    let nextRequestAttempts = 0;
    let logoutOtherDevicesCalls = 0;
    let markRetryStarted: (() => void) | undefined;
    let rejectRetryUnauthorized: (() => void) | undefined;
    const retryStarted = new Promise<void>(resolve => {
        markRetryStarted = resolve;
    });

    establishAuthSession(accessTokenT0);

    apiInstance.defaults.adapter = config => {
        const authorizationHeader = getAuthorizationHeader(config);

        if (config.url === '/auth/refresh') {
            refreshCalls += 1;
            return Promise.resolve(successResponse(config, { token: accessTokenT1 }));
        }

        if (config.url === '/auth/logout-other-devices') {
            logoutOtherDevicesCalls += 1;
            return Promise.resolve(successResponse(config, { token: accessTokenT2 }));
        }

        if (config.url?.includes('request=stale-retry')) {
            staleRequestAttempts += 1;

            if (authorizationHeader) {
                authorizationHeaders.push(authorizationHeader);
            }

            if (authorizationHeader === `Bearer ${accessTokenT0}`) {
                return Promise.reject(unauthorizedResponse(config));
            }

            if (authorizationHeader === `Bearer ${accessTokenT1}`) {
                return new Promise((_resolve, reject) => {
                    rejectRetryUnauthorized = () => reject(unauthorizedResponse(config));
                    markRetryStarted?.();
                });
            }
        }

        if (config.url?.includes('request=after-rotation')) {
            nextRequestAttempts += 1;

            if (authorizationHeader) {
                authorizationHeaders.push(authorizationHeader);
            }

            return Promise.resolve(successResponse(config));
        }

        return Promise.reject(new Error(`Unexpected request: ${config.url}`));
    };

    const staleRequest = apiInstance.get('/dashboard?request=stale-retry');

    return retryStarted
        .then(() => logoutOtherDevicesSession())
        .then(() => {
            expect(logoutOtherDevicesCalls).toBe(1);
            rejectRetryUnauthorized?.();

            return expect(staleRequest).rejects.toMatchObject({
                response: { status: 401 },
            });
        })
        .then(() => getFreshAccessToken())
        .then(currentAccessToken => {
            expect(currentAccessToken).toBe(accessTokenT2);
            expect(hasAuthSessionHint()).toBe(true);
            expect(onUnauthorizedSession).not.toHaveBeenCalled();

            return apiInstance.get('/dashboard?request=after-rotation');
        })
        .then(() => {
            expect(refreshCalls).toBe(1);
            expect(staleRequestAttempts).toBe(2);
            expect(nextRequestAttempts).toBe(1);
            expect(authorizationHeaders).toEqual([
                `Bearer ${accessTokenT0}`,
                `Bearer ${accessTokenT1}`,
                `Bearer ${accessTokenT2}`,
            ]);
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
            expect(newSessionAuthorizationHeaders).toEqual([`Bearer ${newAccessToken}`]);
            expect(onUnauthorizedSession).not.toHaveBeenCalled();
        });
});

// Spec 03 §2.3 C3-07 (H2): an outbox request carries the owner it must be sent for; the check runs
// against the token the interceptor attaches, after any refresh.
test('a request expecting another token subject is not sent and does not expire the session; others are unchanged', async () => {
    const sentAuthorizations: (string | undefined)[] = [];
    const ledgerRequest = (expectedSubject?: string): Promise<unknown> => {
        const config = { url: '/ledger/entries', method: 'post' };

        if (expectedSubject !== undefined) {
            Reflect.set(config, EXPECTED_TOKEN_SUBJECT_CONFIG_KEY, expectedSubject);
        }
        return apiInstance.request(config);
    };

    const tokenOfY = createAccessToken('user-y');

    establishAuthSession(tokenOfY);
    apiInstance.defaults.adapter = config => {
        sentAuthorizations.push(getAuthorizationHeader(config));
        return Promise.resolve(successResponse(config));
    };

    await expect(ledgerRequest('user-x')).rejects.toBeInstanceOf(AuthRequestCancelledError);
    expect(sentAuthorizations).toEqual([]);
    expect(onUnauthorizedSession).not.toHaveBeenCalled();

    await expect(ledgerRequest('user-y')).resolves.toMatchObject({ status: 200 });
    await expect(ledgerRequest()).resolves.toMatchObject({ status: 200 });
    expect(sentAuthorizations).toEqual([`Bearer ${tokenOfY}`, `Bearer ${tokenOfY}`]);
});

// Spec 03 §1.5 (#641): another tab switched the account, a refresh here returns Y's token. The
// refresh listener (`onAccessTokenRefreshed` in the app) marks the switch before anything else;
// `afterSwitch` runs right after it (a session end in the same turn).
const USER_X = 'user-x';
const USER_Y = 'user-y';

const switchOnTokenOf = (userId: string, afterSwitch: () => void = () => undefined): void => {
    setAccessTokenRefreshListener(token => {
        if (getAccessTokenSubject(token) === userId) {
            markAuthSessionAccountSwitched();
            afterSwitch();
        }
    });
};

const cancelledError = (request: Promise<unknown>): Promise<unknown> =>
    request.then(
        () => Promise.reject(new Error('Expected the request to be cancelled')),
        (error: unknown) => error,
    );

test('§1.5 refresh switch: an X request whose 401 retry finds Y is cancelled as stale; Y stays signed in', async () => {
    const tokenOfX = createAccessToken(USER_X);
    const tokenOfY = createAccessToken(USER_Y);
    const sentAuthorizations: (string | undefined)[] = [];

    establishAuthSession(tokenOfX);
    switchOnTokenOf(USER_Y);
    apiInstance.defaults.adapter = config => {
        if (config.url === '/auth/refresh') {
            return Promise.resolve(successResponse(config, { token: tokenOfY }));
        }
        sentAuthorizations.push(getAuthorizationHeader(config));
        return getAuthorizationHeader(config) === `Bearer ${tokenOfX}`
            ? Promise.reject(unauthorizedResponse(config))
            : Promise.resolve(successResponse(config));
    };

    const error = await cancelledError(apiInstance.get('/dashboard?request=x'));

    expect(error).toBeInstanceOf(AuthRequestCancelledError);
    expect(error).toMatchObject({ isStaleSession: true });
    expect(onUnauthorizedSession).not.toHaveBeenCalled();
    expect(await getFreshAccessToken()).toBe(tokenOfY);
    await expect(apiInstance.get('/dashboard?request=y')).resolves.toMatchObject({ status: 200 });
    // X's request is not resent with Y's token.
    expect(sentAuthorizations).toEqual([`Bearer ${tokenOfX}`, `Bearer ${tokenOfY}`]);
    expect(hasAuthSessionHint()).toBe(true);
});

test('§1.5 refresh switch: a late X response after the switch is rejected as stale, not delivered', async () => {
    const tokenOfX = createAccessToken(USER_X);
    let answerX: () => void = () => undefined;
    let markXSent: () => void = () => undefined;
    const xSent = new Promise<void>(resolve => {
        markXSent = resolve;
    });

    establishAuthSession(tokenOfX);
    switchOnTokenOf(USER_Y);
    apiInstance.defaults.adapter = config => {
        if (config.url === '/auth/refresh') {
            return Promise.resolve(successResponse(config, { token: createAccessToken(USER_Y) }));
        }
        return new Promise(resolve => {
            answerX = () => resolve(successResponse(config, { id: USER_X }));
            markXSent();
        });
    };

    const xRequest = cancelledError(apiInstance.get('/users/me'));

    await xSent;
    await refreshAuthSession();
    answerX();
    const error = await xRequest;

    expect(error).toBeInstanceOf(AuthRequestCancelledError);
    expect(error).toMatchObject({ isStaleSession: true });
    expect(onUnauthorizedSession).not.toHaveBeenCalled();
});

test('§1.5: a session end after the switch during the 401 retry still expires the session', async () => {
    const tokenOfX = createAccessToken(USER_X);

    establishAuthSession(tokenOfX);
    switchOnTokenOf(USER_Y, invalidateAuthSession);
    apiInstance.defaults.adapter = config => {
        if (config.url === '/auth/refresh') {
            return Promise.resolve(successResponse(config, { token: createAccessToken(USER_Y) }));
        }
        return Promise.reject(unauthorizedResponse(config));
    };

    await expect(apiInstance.get('/dashboard')).rejects.toMatchObject({
        response: { status: 401 },
    });
    expect(onUnauthorizedSession).toHaveBeenCalledOnce();
});

test('§1.5: a sign-out during the 401 retry refresh rejects the request without a retry, as before', async () => {
    const tokenOfX = createAccessToken(USER_X);
    let answerRefresh: () => void = () => undefined;
    let markRefreshStarted: () => void = () => undefined;
    const refreshStarted = new Promise<void>(resolve => {
        markRefreshStarted = resolve;
    });
    let dashboardRequests = 0;

    establishAuthSession(tokenOfX);
    switchOnTokenOf(USER_Y);
    apiInstance.defaults.adapter = config => {
        if (config.url === '/auth/refresh') {
            return new Promise(resolve => {
                answerRefresh = () =>
                    resolve(successResponse(config, { token: createAccessToken(USER_Y) }));
                markRefreshStarted();
            });
        }
        if (config.url === '/auth/logout') {
            return Promise.resolve(successResponse(config));
        }
        dashboardRequests += 1;
        return Promise.reject(unauthorizedResponse(config));
    };

    const request = apiInstance.get('/dashboard').then(
        () => null,
        (error: unknown) => error,
    );

    await refreshStarted;
    await startAuthLogout({ broadcast: false });
    answerRefresh();
    const error = await request;

    // The refresh of the ended session is dropped: no Y token, no retry, the sign-out stays.
    expect(error).toBeInstanceOf(Error);
    expect(dashboardRequests).toBe(1);
    expect(onUnauthorizedSession).not.toHaveBeenCalled();
    expect(await getFreshAccessToken()).toBeNull();
});

test('§1.5 refresh switch: an X request parked on the refresh that finds Y is cancelled, never sent', async () => {
    // X's token is expiring: the request waits in the request interceptor for the refresh.
    const tokenOfX = `header.${btoa(JSON.stringify({ exp: 1, sub: USER_X }))}.signature`;
    const sentAuthorizations: (string | undefined)[] = [];

    establishAuthSession(tokenOfX);
    switchOnTokenOf(USER_Y);
    apiInstance.defaults.adapter = config => {
        if (config.url === '/auth/refresh') {
            return Promise.resolve(successResponse(config, { token: createAccessToken(USER_Y) }));
        }
        sentAuthorizations.push(getAuthorizationHeader(config));
        return Promise.resolve(successResponse(config));
    };

    const error = await cancelledError(apiInstance.get('/dashboard'));

    expect(error).toBeInstanceOf(AuthRequestCancelledError);
    expect(error).toMatchObject({ isStaleSession: true });
    expect(sentAuthorizations).toEqual([]);
    expect(onUnauthorizedSession).not.toHaveBeenCalled();
});

test('§1.5 refresh switch: a 401 of an X request arriving after the switch is cancelled as stale', async () => {
    const tokenOfX = createAccessToken(USER_X);
    let rejectX: () => void = () => undefined;
    let markXSent: () => void = () => undefined;
    const xSent = new Promise<void>(resolve => {
        markXSent = resolve;
    });
    let refreshCalls = 0;

    establishAuthSession(tokenOfX);
    switchOnTokenOf(USER_Y);
    apiInstance.defaults.adapter = config => {
        if (config.url === '/auth/refresh') {
            refreshCalls += 1;
            return Promise.resolve(successResponse(config, { token: createAccessToken(USER_Y) }));
        }
        return new Promise((_resolve, reject) => {
            rejectX = () => reject(unauthorizedResponse(config));
            markXSent();
        });
    };

    const xRequest = cancelledError(apiInstance.get('/dashboard'));

    await xSent;
    await refreshAuthSession();
    rejectX();
    const error = await xRequest;

    expect(error).toBeInstanceOf(AuthRequestCancelledError);
    expect(error).toMatchObject({ isStaleSession: true });
    expect(refreshCalls).toBe(1);
    expect(onUnauthorizedSession).not.toHaveBeenCalled();
});
