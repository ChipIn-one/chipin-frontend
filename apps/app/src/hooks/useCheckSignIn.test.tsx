import { onlineManager } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { get, set } from 'idb-keyval';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { ledgerKeys } from 'entities/ledger';
import {
    invalidateAuthSession,
    isAuthSessionSignedOut,
    validateAuthSession,
} from 'helpers/authSession';
import * as localStorageHelpers from 'helpers/localStorage';
import { probeBackendHealth } from 'shared/api/health';
import { outboxStateKey, queryCacheKey } from 'shared/offline/constants';
import { persistCodec } from 'shared/offline/persistCodec';
import { cachesByUser, isCacheWriteAllowed } from 'shared/offline/userCaches';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { loadGroupsListForSession } from 'store/groupsList';
import { loadKnownUsersForSession, loadSelfUserForSession } from 'store/sessionUser';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { mountAsUserClient } from 'test/userClient';

import { sessionCheckRetryDelayMs, startSessionCheck, useCheckSignIn } from './useCheckSignIn';

import 'fake-indexeddb/auto';

// The store's own refresh, over a mocked cookie refresh (`null` = 401).
vi.mock('helpers/authSession', async importOriginal => {
    const actual = await importOriginal<typeof import('helpers/authSession')>();

    return { ...actual, validateAuthSession: vi.fn(actual.validateAuthSession) };
});

// The `/health` probe sent alongside a refresh without a saved user (NET-007); no real request.
vi.mock('shared/api/health', async importOriginal => ({
    ...(await importOriginal<typeof import('shared/api/health')>()),
    probeBackendHealth: vi.fn(() => Promise.resolve('ok')),
}));

vi.mock('store/groupsList', async importOriginal => ({
    ...(await importOriginal<typeof import('store/groupsList')>()),
    loadGroupsListForSession: vi.fn(),
}));

vi.mock('store/sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('store/sessionUser')>()),
    loadKnownUsersForSession: vi.fn(),
    loadSelfUserForSession: vi.fn(),
}));

const storeRefreshAuthTokens = useAuthStore.getState().refreshAuthTokens;

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: true,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const CheckSignInHarness = () => {
    useCheckSignIn();
    return null;
};

const renderHook = () => {
    return render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <CheckSignInHarness />
        </MemoryRouter>,
    );
};

const mockAuthenticatedDataFetches = (): void => {
    vi.mocked(loadGroupsListForSession).mockResolvedValue();
    vi.mocked(loadSelfUserForSession).mockResolvedValue(user);
    vi.mocked(loadKnownUsersForSession).mockResolvedValue();
};

const markRestorableAuthSession = (): void => {
    localStorageHelpers.LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
};

beforeEach(() => {
    vi.restoreAllMocks();
    invalidateAuthSession();
    localStorageHelpers.LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
    localStorageHelpers.LocalStorage.remove(LS_KEY_USER);
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online' });
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
    localStorageHelpers.resetTabUserId();
    vi.mocked(loadSelfUserForSession).mockReset();
    vi.mocked(loadKnownUsersForSession).mockReset();
    useAuthStore.setState({
        isNewUser: null,
        status: 'unknown',
        unauthReason: undefined,
        sessionMode: 'online',
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    onlineManager.setOnline(true);
});

test('keeps a signed-out cold start unauthenticated and skips refresh', () => {
    const refreshAuthTokens = vi.fn(() => Promise.resolve('unexpected-access-token'));
    useAuthStore.setState({ refreshAuthTokens });

    renderHook();

    return waitFor(() => {
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'missing',
        });
    }).then(() => {
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });
});

test('attempts cookie-backed session restore on cold start without persisted auth tokens', () => {
    markRestorableAuthSession();
    const refreshAuthTokens = vi.fn(() => Promise.resolve('next-access-token'));
    useAuthStore.setState({ refreshAuthTokens });
    mockAuthenticatedDataFetches();

    renderHook();

    return waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    });
});

const disconnect = {
    'backend-down': () => useConnectivityStore.setState({ mode: 'backend-down' }),
    offline: () => onlineManager.setOnline(false),
};
const reconnect = {
    'backend-down': () => useConnectivityStore.setState({ mode: 'online' }),
    offline: () => onlineManager.setOnline(true),
};

test.each(['backend-down', 'offline'] as const)(
    'waits while %s and retries cookie-backed restoration after recovery',
    mode => {
        markRestorableAuthSession();
        let rejectFirstRestore: ((reason: Error) => void) | undefined;
        const firstRestore = new Promise<string>((_resolve, reject) => {
            rejectFirstRestore = reject;
        });
        const refreshAuthTokens = vi
            .fn<() => Promise<string>>()
            .mockReturnValueOnce(firstRestore)
            .mockResolvedValueOnce('next-access-token');
        useAuthStore.setState({ refreshAuthTokens });
        mockAuthenticatedDataFetches();

        renderHook();

        return waitFor(() => {
            expect(refreshAuthTokens).toHaveBeenCalledOnce();
        })
            .then(() => {
                act(() => {
                    disconnect[mode]();
                    rejectFirstRestore?.(new Error('backend unavailable'));
                });

                return waitFor(() => {
                    expect(useConnectivityStore.getState().mode).toBe(mode);
                    expect(useAuthStore.getState().status).toBe('unknown');
                    expect(refreshAuthTokens).toHaveBeenCalledOnce();
                });
            })
            .then(() => {
                act(() => {
                    reconnect[mode]();
                });

                return waitFor(() => {
                    expect(refreshAuthTokens).toHaveBeenCalledTimes(2);
                    expect(useAuthStore.getState().status).toBe('authenticated');
                });
            });
    },
);

test('initializes the app mode from the fetched preference without a cached user', () => {
    markRestorableAuthSession();
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
    const setDefaultAppMode = vi.spyOn(useUiPrefsStore.getState(), 'setDefaultAppMode');
    vi.spyOn(useAuthStore.getState(), 'refreshAuthTokens').mockResolvedValue('next-access-token');
    mockAuthenticatedDataFetches();

    renderHook();

    return waitFor(() => {
        expect(setDefaultAppMode).toHaveBeenCalledWith(true);
    });
});

test('preserves the active app mode when a cached user initialized it', () => {
    markRestorableAuthSession();
    const groupDefaultUser = {
        ...user,
        settings: { ...user.settings, soloModeByDefault: false },
    };
    localStorageHelpers.LocalStorage.set(LS_KEY_USER, {
        role: groupDefaultUser.role,
        settings: groupDefaultUser.settings,
    });
    localStorageHelpers.resetTabUserId();
    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });
    const setDefaultAppMode = vi.spyOn(useUiPrefsStore.getState(), 'setDefaultAppMode');
    vi.spyOn(useAuthStore.getState(), 'refreshAuthTokens').mockResolvedValue('next-access-token');
    vi.mocked(loadGroupsListForSession).mockResolvedValue();
    const loadSelf = vi.mocked(loadSelfUserForSession).mockResolvedValue(groupDefaultUser);
    const invalidateKnownUsers = vi.mocked(loadKnownUsersForSession).mockResolvedValue();

    renderHook();

    return waitFor(() => {
        expect(loadSelf).toHaveBeenCalledOnce();
    }).then(() => {
        // The session start marks `users.known` stale once.
        expect(invalidateKnownUsers).toHaveBeenCalledOnce();
        expect(setDefaultAppMode).not.toHaveBeenCalled();
        expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.SOLO);
    });
});

test('does not revalidate an authenticated session when the app becomes visible', () => {
    const refreshAuthTokens = vi.fn(() => Promise.resolve('next-access-token'));
    useAuthStore.setState({
        refreshAuthTokens,
        status: 'authenticated',
    });
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
    });
    renderHook();

    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
    });
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(refreshAuthTokens).not.toHaveBeenCalled();
});

test('does not overwrite a newer authenticated session after stale validation fails', () => {
    markRestorableAuthSession();
    let rejectValidation: ((reason: Error) => void) | undefined;
    const validation = new Promise<string>((_resolve, reject) => {
        rejectValidation = reject;
    });
    const refreshAuthTokens = vi.fn(() => validation);
    useAuthStore.setState({ refreshAuthTokens });

    renderHook();

    return waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    })
        .then(() => {
            act(() => {
                useAuthStore.getState().setAuthenticated();
            });
            rejectValidation?.(new Error('Auth session changed during token rotation'));

            return expect(validation).rejects.toThrow('Auth session changed during token rotation');
        })
        .then(() => {
            expect(useAuthStore.getState().status).toBe('authenticated');
        });
});

test('remote tab logout clears protected data without a second server logout', () => {
    const receiver: {
        name: string;
        onMessage: ((event: MessageEvent<unknown>) => void) | null;
    } = { name: '', onMessage: null };
    class MockBroadcastChannel {
        set onmessage(callback: ((event: MessageEvent<unknown>) => void) | null) {
            receiver.onMessage = callback;
        }
        constructor(name: string) {
            receiver.name = name;
        }
        close(): void {}
        postMessage(): void {}
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    useAuthStore.setState({ status: 'authenticated' });
    const signOut = vi.spyOn(useAuthStore.getState(), 'signOut');
    useExpenseModalStore.setState({
        isOpened: true,
        groupId: 'private-group',
        description: 'private expense',
    });
    renderHook();

    expect(receiver.name).toBe('chipin-auth-logout');
    act(() => {
        receiver.onMessage?.(
            new MessageEvent('message', {
                data: { type: 'logout', source: 'other-tab' },
            }),
        );
    });

    expect(useAuthStore.getState()).toMatchObject({
        status: 'unauthenticated',
        unauthReason: 'signed_out',
    });
    expect(useExpenseModalStore.getState()).toMatchObject({
        isOpened: false,
        groupId: '',
        description: '',
    });
    expect(isAuthSessionSignedOut()).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
});

// Spec 03 §1.6: the offline cold start of a cached user with a session hint.
const cacheSignedInUser = (): void => {
    markRestorableAuthSession();
    localStorageHelpers.LocalStorage.set(LS_KEY_USER, {
        id: user.id,
        role: user.role,
        settings: user.settings,
    });
    localStorageHelpers.resetTabUserId();
};

const networkError = Object.assign(new Error('Network Error'), {
    isAxiosError: true,
    response: undefined,
});

test('offline cold start: a cached user with a hint is authenticated on the cache, no refresh', () => {
    cacheSignedInUser();
    onlineManager.setOnline(false);
    const refreshAuthTokens = vi.fn(() => Promise.resolve('unexpected-access-token'));
    useAuthStore.setState({ refreshAuthTokens });

    renderHook();

    return waitFor(() => {
        expect(useAuthStore.getState()).toMatchObject({
            status: 'authenticated',
            sessionMode: 'offline-cached',
        });
    }).then(() => {
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });
});

test('a network error during the startup refresh: offline-cached, nothing loaded', () => {
    cacheSignedInUser();
    // As the interceptor: the failure is classified offline before the caller's `catch`.
    const refreshAuthTokens = vi.fn(() => {
        onlineManager.setOnline(false);
        return Promise.reject(networkError);
    });
    useAuthStore.setState({ refreshAuthTokens });
    const loadGroupsList = vi.mocked(loadGroupsListForSession).mockResolvedValue();

    renderHook();

    return waitFor(() => {
        expect(useAuthStore.getState()).toMatchObject({
            status: 'authenticated',
            sessionMode: 'offline-cached',
        });
    }).then(() => {
        expect(loadGroupsList).not.toHaveBeenCalled();
    });
});

test('without a cached user id an offline cold start keeps waiting', () => {
    markRestorableAuthSession();
    onlineManager.setOnline(false);

    renderHook();

    expect(useAuthStore.getState().status).toBe('unknown');
});

test('NET-007 a hanging startup refresh without a saved user: no /health answer marks the network unusable within 5 s', async () => {
    markRestorableAuthSession();
    // A network the browser calls online that answers nothing: the refresh never settles (in the
    // browser it fails 20-50 s later), the probe times out (5 s) as unreachable.
    const refreshAuthTokens = vi.fn(() => new Promise<string>(() => undefined));
    useAuthStore.setState({ refreshAuthTokens });
    vi.mocked(probeBackendHealth).mockResolvedValueOnce('unreachable');

    renderHook();

    await waitFor(() => {
        expect(useConnectivityStore.getState().mode).toBe('offline');
    });
    expect(onlineManager.isOnline()).toBe(false);
    expect(refreshAuthTokens).toHaveBeenCalledOnce();
    expect(probeBackendHealth).toHaveBeenCalledOnce();
    // Still unknown: `AuthLayout` shows the offline load error, the refresh still decides.
    expect(useAuthStore.getState().status).toBe('unknown');
});

test('NET-007 a reachable /health leaves the network as it is', async () => {
    markRestorableAuthSession();
    useAuthStore.setState({ refreshAuthTokens: vi.fn(() => new Promise<string>(() => undefined)) });
    vi.mocked(probeBackendHealth).mockResolvedValueOnce('ok');

    renderHook();

    await waitFor(() => {
        expect(probeBackendHealth).toHaveBeenCalledOnce();
    });
    await act(() => Promise.resolve());
    expect(useConnectivityStore.getState().mode).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
});

/** A `/health` probe answered by the test, after the refresh has settled. */
const deferProbe = () => {
    let answer: (health: 'unreachable') => void = () => undefined;
    vi.mocked(probeBackendHealth).mockReturnValueOnce(
        new Promise(resolve => {
            answer = resolve;
        }),
    );
    return (health: 'unreachable') => answer(health);
};

test('NET-007 the probe is sent for this attempt only: never joins a probe sent before it', async () => {
    markRestorableAuthSession();
    const startedBefore = performance.now();
    useAuthStore.setState({ refreshAuthTokens: vi.fn(() => new Promise<string>(() => undefined)) });

    renderHook();

    await waitFor(() => {
        expect(probeBackendHealth).toHaveBeenCalledOnce();
    });
    const [sentAfter] = vi.mocked(probeBackendHealth).mock.calls[0] ?? [];
    expect(sentAfter).toBeGreaterThanOrEqual(startedBefore);
});

test('NET-007 a stale shared /health probe from before the attempt answering unreachable leaves the network online', async () => {
    const health = await vi.importActual<typeof import('shared/api/health')>('shared/api/health');
    const { publicApiInstance } = await import('shared/api/instance');
    let failOldProbe: (error: Error) => void = () => undefined;
    const get = vi
        .spyOn(publicApiInstance, 'get')
        // The 15 s re-check's probe, sent before the attempt: no answer yet, then unreachable.
        .mockReturnValueOnce(
            new Promise((_resolve, reject) => {
                failOldProbe = reject;
            }),
        )
        // The attempt's own probe: `/health` answers.
        .mockResolvedValueOnce({ status: 200, data: {} });
    vi.mocked(probeBackendHealth).mockImplementation(health.probeBackendHealth);
    const oldProbe = health.probeBackendHealth();
    markRestorableAuthSession();
    useAuthStore.setState({ refreshAuthTokens: vi.fn(() => new Promise<string>(() => undefined)) });

    renderHook();

    await waitFor(() => {
        expect(get).toHaveBeenCalledTimes(2);
    });
    failOldProbe(new Error('Network Error'));
    await expect(oldProbe).resolves.toBe('unreachable');
    await act(() => Promise.resolve());

    expect(useConnectivityStore.getState().mode).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
});

test('NET-007 a refresh that succeeded before an unreachable probe answers: no offline marking', async () => {
    markRestorableAuthSession();
    const answerProbe = deferProbe();
    useAuthStore.setState({ refreshAuthTokens: vi.fn(() => Promise.resolve('access-token')) });
    mockAuthenticatedDataFetches();

    renderHook();

    await waitFor(() => {
        expect(useAuthStore.getState().status).toBe('authenticated');
    });
    await act(async () => {
        answerProbe('unreachable');
        await Promise.resolve();
    });

    expect(useConnectivityStore.getState().mode).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
});

test('NET-007 a refresh rejected with 401 before an unreachable probe answers: no offline marking', async () => {
    markRestorableAuthSession();
    const answerProbe = deferProbe();
    // The store's own refresh over a 401 cookie refresh (`null`): the session expires.
    useAuthStore.setState({ refreshAuthTokens: storeRefreshAuthTokens });
    vi.mocked(validateAuthSession).mockResolvedValueOnce(null);

    renderHook();

    await waitFor(() => {
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'expired',
        });
    });
    await act(async () => {
        answerProbe('unreachable');
        await Promise.resolve();
    });

    expect(useConnectivityStore.getState().mode).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
});

test('NET-007 an attempt replaced by an auth change before the probe answers: no offline marking', async () => {
    markRestorableAuthSession();
    const answerProbe = deferProbe();
    useAuthStore.setState({ refreshAuthTokens: vi.fn(() => new Promise<string>(() => undefined)) });

    renderHook();

    await waitFor(() => {
        expect(probeBackendHealth).toHaveBeenCalledOnce();
    });
    // Any auth change ends the attempt's dedupe (the attempt is no longer the one in flight).
    act(() => {
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
    });
    await act(async () => {
        answerProbe('unreachable');
        await Promise.resolve();
    });

    expect(useConnectivityStore.getState().mode).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
});

test('NET-007 with a saved user the startup refresh sends no extra /health probe', async () => {
    cacheSignedInUser();
    const refreshAuthTokens = vi.fn(() => new Promise<string>(() => undefined));
    useAuthStore.setState({ refreshAuthTokens });

    renderHook();

    await waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    });
    expect(probeBackendHealth).not.toHaveBeenCalled();
});

test('an offline cold start after expiry (hint false) shows the sign-in, not the cache', () => {
    cacheSignedInUser();
    localStorageHelpers.LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);
    onlineManager.setOnline(false);

    renderHook();

    return waitFor(() => {
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'missing',
        });
    });
});

test('reconnect: a successful refresh makes the session online and loads the data', () => {
    cacheSignedInUser();
    onlineManager.setOnline(false);
    useAuthStore.setState({ refreshAuthTokens: storeRefreshAuthTokens });
    vi.mocked(validateAuthSession).mockResolvedValue('next-access-token');
    mockAuthenticatedDataFetches();
    const loadGroupsList = vi.mocked(loadGroupsListForSession);
    const invalidateKnownUsers = vi.mocked(loadKnownUsersForSession);

    renderHook();

    return waitFor(() => {
        expect(useAuthStore.getState().sessionMode).toBe('offline-cached');
    })
        .then(() => {
            act(() => {
                onlineManager.setOnline(true);
            });
            return waitFor(() => {
                expect(useAuthStore.getState()).toMatchObject({
                    status: 'authenticated',
                    sessionMode: 'online',
                });
            });
        })
        .then(() => {
            expect(loadGroupsList).toHaveBeenCalledOnce();
            // The session start of the reconnect reloads the friends once.
            expect(invalidateKnownUsers).toHaveBeenCalledOnce();
        });
});

test('reconnect: a 401 refresh expires the session', () => {
    cacheSignedInUser();
    onlineManager.setOnline(false);
    useAuthStore.setState({ refreshAuthTokens: storeRefreshAuthTokens });
    vi.mocked(validateAuthSession).mockResolvedValue(null);

    renderHook();

    return waitFor(() => {
        expect(useAuthStore.getState().sessionMode).toBe('offline-cached');
    }).then(() => {
        act(() => {
            onlineManager.setOnline(true);
        });
        return waitFor(() => {
            expect(useAuthStore.getState()).toMatchObject({
                status: 'unauthenticated',
                unauthReason: 'expired',
            });
        });
    });
});

test('a network error classified backend-down keeps waiting, then refreshes when back online', () => {
    cacheSignedInUser();
    const refreshAuthTokens = vi
        .fn<() => Promise<string>>()
        .mockImplementationOnce(() => {
            useConnectivityStore.setState({ mode: 'backend-down' });
            return Promise.reject(networkError);
        })
        .mockResolvedValueOnce('next-access-token');
    useAuthStore.setState({ refreshAuthTokens });
    mockAuthenticatedDataFetches();

    renderHook();

    return waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
        expect(useConnectivityStore.getState().mode).toBe('backend-down');
    }).then(() => {
        expect(useAuthStore.getState().status).toBe('unknown');
        act(() => {
            useConnectivityStore.setState({ mode: 'online' });
        });
        return waitFor(() => {
            expect(refreshAuthTokens).toHaveBeenCalledTimes(2);
            expect(useAuthStore.getState()).toMatchObject({
                status: 'authenticated',
                sessionMode: 'online',
            });
        });
    });
});

test('AUTH-009: a one-off request error while online keeps the session unknown and retries, no sign-out', async () => {
    vi.useFakeTimers();
    try {
        cacheSignedInUser();
        const refreshAuthTokens = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(networkError)
            .mockResolvedValueOnce('next-access-token');
        useAuthStore.setState({ refreshAuthTokens });
        mockAuthenticatedDataFetches();

        renderHook();
        await vi.advanceTimersByTimeAsync(0);

        expect(refreshAuthTokens).toHaveBeenCalledOnce();
        expect(useAuthStore.getState().status).toBe('unknown');

        await vi.advanceTimersByTimeAsync(sessionCheckRetryDelayMs(0));

        expect(refreshAuthTokens).toHaveBeenCalledTimes(2);
        expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated' });
    } finally {
        vi.useRealTimers();
    }
});

test('AUTH-009: a 5xx on the startup refresh never signs the user out and keeps retrying with a capped backoff', async () => {
    vi.useFakeTimers();
    try {
        cacheSignedInUser();
        const serverError = Object.assign(new Error('Server Error'), {
            isAxiosError: true,
            response: { status: 503 },
        });
        const refreshAuthTokens = vi.fn(() => Promise.reject(serverError));
        useAuthStore.setState({ refreshAuthTokens });

        renderHook();
        await vi.advanceTimersByTimeAsync(10 * 60_000);

        // 1s, 2s, 4s, 8s, 16s, then 30s steps: still retrying after ten minutes, never signed out.
        expect(refreshAuthTokens.mock.calls.length).toBeGreaterThan(15);
        expect(useAuthStore.getState().status).toBe('unknown');
    } finally {
        vi.useRealTimers();
    }
});

test('AUTH-009: a remote logout during the retry backoff cancels the pending retry', async () => {
    vi.useFakeTimers();
    try {
        cacheSignedInUser();
        const refreshAuthTokens = vi.fn(() => Promise.reject(networkError));
        useAuthStore.setState({ refreshAuthTokens });

        renderHook();
        await vi.advanceTimersByTimeAsync(0);
        expect(refreshAuthTokens).toHaveBeenCalledOnce();

        act(() => {
            useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });
        });
        await vi.advanceTimersByTimeAsync(60_000);

        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    } finally {
        vi.useRealTimers();
    }
});

test('the hint turns false during the boot refresh: no offline-cached session', () => {
    cacheSignedInUser();
    const refreshAuthTokens = vi.fn(() => {
        localStorageHelpers.LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);
        onlineManager.setOnline(false);
        return Promise.reject(networkError);
    });
    useAuthStore.setState({ refreshAuthTokens });

    renderHook();

    return waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    }).then(() => {
        expect(useAuthStore.getState().sessionMode).toBe('online');
        expect(useAuthStore.getState().status).not.toBe('authenticated');
    });
});

test('a connectivity flap during the reconnect refresh: one refresh, data loaded once', () => {
    cacheSignedInUser();
    onlineManager.setOnline(false);
    let finish: (token: string) => void = () => undefined;
    const refreshAuthTokens = vi.fn(
        () =>
            new Promise<string>(resolve => {
                finish = token => {
                    useAuthStore.setState({ sessionMode: 'online' });
                    resolve(token);
                };
            }),
    );
    useAuthStore.setState({ refreshAuthTokens });
    mockAuthenticatedDataFetches();
    const loadGroupsList = vi.mocked(loadGroupsListForSession);

    renderHook();

    return waitFor(() => {
        expect(useAuthStore.getState().sessionMode).toBe('offline-cached');
    })
        .then(() => {
            act(() => {
                onlineManager.setOnline(true);
            });
            return waitFor(() => {
                expect(refreshAuthTokens).toHaveBeenCalledOnce();
            });
        })
        .then(() => {
            act(() => {
                onlineManager.setOnline(false);
            });
            act(() => {
                onlineManager.setOnline(true);
            });
            expect(refreshAuthTokens).toHaveBeenCalledOnce();
            act(() => {
                finish('next-access-token');
            });
            return waitFor(() => {
                expect(loadGroupsList).toHaveBeenCalledOnce();
            });
        });
});

// Spec 03 §1.6 (#641): the flap's re-run is skipped while the refresh is in flight; when that
// refresh then fails with a request error (still online), nothing else would retry it.
test('§1.6 reconnect: a refresh failing with a request error after a flap retries once and loads the data', () => {
    cacheSignedInUser();
    onlineManager.setOnline(false);
    let fail: () => void = () => undefined;
    const refreshAuthTokens = vi
        .fn<() => Promise<string>>()
        .mockImplementationOnce(
            () =>
                new Promise<string>((_resolve, reject) => {
                    fail = () => reject(new Error('request error'));
                }),
        )
        .mockImplementationOnce(() => {
            useAuthStore.setState({ sessionMode: 'online' });
            return Promise.resolve('next-access-token');
        });
    useAuthStore.setState({ refreshAuthTokens });
    mockAuthenticatedDataFetches();
    const loadGroupsList = vi.mocked(loadGroupsListForSession);

    renderHook();

    return waitFor(() => {
        expect(useAuthStore.getState().sessionMode).toBe('offline-cached');
    })
        .then(() => {
            act(() => {
                onlineManager.setOnline(true);
            });
            return waitFor(() => {
                expect(refreshAuthTokens).toHaveBeenCalledOnce();
            });
        })
        .then(() => {
            act(() => {
                onlineManager.setOnline(false);
            });
            act(() => {
                onlineManager.setOnline(true);
            });
            act(() => {
                fail();
            });
            return waitFor(() => {
                expect(loadGroupsList).toHaveBeenCalledOnce();
            });
        })
        .then(() => {
            expect(refreshAuthTokens).toHaveBeenCalledTimes(2);
            expect(useAuthStore.getState()).toMatchObject({
                status: 'authenticated',
                sessionMode: 'online',
            });
        });
});

test('§1.6 reconnect: a refresh that keeps failing with a request error is retried only once', async () => {
    cacheSignedInUser();
    onlineManager.setOnline(false);
    const refreshAuthTokens = vi.fn(() => Promise.reject(new Error('request error')));
    useAuthStore.setState({ refreshAuthTokens });
    mockAuthenticatedDataFetches();

    renderHook();

    await waitFor(() => {
        expect(useAuthStore.getState().sessionMode).toBe('offline-cached');
    });
    act(() => {
        onlineManager.setOnline(true);
    });
    await waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledTimes(2);
    });
    await act(() => new Promise(resolve => setTimeout(resolve, 50)));

    expect(refreshAuthTokens).toHaveBeenCalledTimes(2);
    expect(loadGroupsListForSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
        status: 'authenticated',
        sessionMode: 'offline-cached',
    });
});

test('§1.6 reconnect: a refresh failing after the hook unmounted is not retried', async () => {
    cacheSignedInUser();
    onlineManager.setOnline(false);
    let fail: () => void = () => undefined;
    const refreshAuthTokens = vi.fn(
        () =>
            new Promise<string>((_resolve, reject) => {
                fail = () => reject(new Error('request error'));
            }),
    );
    useAuthStore.setState({ refreshAuthTokens });
    mockAuthenticatedDataFetches();

    const { unmount } = renderHook();

    await waitFor(() => {
        expect(useAuthStore.getState().sessionMode).toBe('offline-cached');
    });
    act(() => {
        onlineManager.setOnline(true);
    });
    await waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    });
    unmount();
    fail();
    await act(() => new Promise(resolve => setTimeout(resolve, 50)));

    expect(refreshAuthTokens).toHaveBeenCalledOnce();
});

// 04-2a2b: the guard loader starts the initial check before the hook mounts (`startSessionCheck`,
// via `authReady`); the hook's effect re-runs on connectivity changes while that attempt runs.
test('a connectivity flap during the loader-started boot refresh: one refresh, data loaded once', () => {
    markRestorableAuthSession();
    let finish: (token: string) => void = () => undefined;
    const refreshAuthTokens = vi.fn(
        () =>
            new Promise<string>(resolve => {
                finish = resolve;
            }),
    );
    useAuthStore.setState({ refreshAuthTokens });
    mockAuthenticatedDataFetches();
    const loadGroupsList = vi.mocked(loadGroupsListForSession);
    const loadSelf = vi.mocked(loadSelfUserForSession);

    // What the loader does on a cold load, before any component mounts.
    startSessionCheck('/dashboard');
    expect(refreshAuthTokens).toHaveBeenCalledOnce();

    renderHook();
    act(() => {
        useConnectivityStore.setState({ mode: 'backend-down' });
    });
    act(() => {
        useConnectivityStore.setState({ mode: 'online' });
    });
    act(() => {
        onlineManager.setOnline(false);
    });
    act(() => {
        onlineManager.setOnline(true);
    });
    expect(refreshAuthTokens).toHaveBeenCalledOnce();

    act(() => {
        finish('next-access-token');
    });

    return waitFor(() => {
        expect(useAuthStore.getState().status).toBe('authenticated');
        expect(loadGroupsList).toHaveBeenCalledOnce();
    }).then(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
        expect(loadSelf).toHaveBeenCalledOnce();
    });
});

test('a boot refresh that found another user applies that user default app mode', () => {
    cacheSignedInUser();
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
    const setDefaultAppMode = vi.spyOn(useUiPrefsStore.getState(), 'setDefaultAppMode');
    // As the refresh listener after another tab switched to Y: LocalUser = { id: Y, settings }.
    const refreshAuthTokens = vi.fn(() => {
        localStorageHelpers.saveLocalUser({ id: 'user-y', settings: user.settings });
        localStorageHelpers.resetTabUserId();
        return Promise.resolve('y-access-token');
    });
    useAuthStore.setState({ refreshAuthTokens });
    mockAuthenticatedDataFetches();

    renderHook();

    return waitFor(() => {
        expect(setDefaultAppMode).toHaveBeenCalledWith(true);
    });
});

test('a boot refresh of the same cached user keeps the active app mode', () => {
    cacheSignedInUser();
    const setDefaultAppMode = vi.spyOn(useUiPrefsStore.getState(), 'setDefaultAppMode');
    useAuthStore.setState({ refreshAuthTokens: vi.fn(() => Promise.resolve('x-access-token')) });
    mockAuthenticatedDataFetches();
    const loadSelf = vi.mocked(loadSelfUserForSession);

    renderHook();

    return waitFor(() => {
        expect(loadSelf).toHaveBeenCalledOnce();
    }).then(() => {
        expect(setDefaultAppMode).not.toHaveBeenCalled();
    });
});

// 03-16a part C (R1 B1), offline writes on: the boot refresh of another tab's account switch moves
// this tab to Y at once and detaches X (no X data in memory, no write of X's cache); X's unsent
// outbox stays in IndexedDB and X is recorded as a kept user.
test('flag on: a cold-start refresh that finds Y over X with unsent ops detaches X at once', async () => {
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    useAuthStore.setState({ refreshAuthTokens: storeRefreshAuthTokens });
    cacheSignedInUser();
    await set(
        outboxStateKey(user.id),
        persistCodec.stringify({
            nextSeq: 2,
            ops: [
                {
                    opId: 'op-1',
                    seq: 1,
                    owner: user.id,
                    entryKind: 'expense',
                    createdAt: Date.now(),
                    schema: 1,
                    kind: 'createExpense',
                    entryId: 'entry-1',
                    groupId: null,
                    parentActivityId: null,
                    draft: {},
                },
            ],
            versions: {},
            cancelled: [],
            retryRequested: [],
            sending: null,
            conflictDrafts: {},
        }),
    );
    const xClient = mountAsUserClient(user.id);
    // A query of X in flight; the detach cancels it.
    void xClient
        .fetchQuery({
            queryKey: ledgerKeys.entry('x-entry'),
            queryFn: () => new Promise<string>(() => undefined),
        })
        .catch(() => undefined);
    const yToken = fakeAccessToken('user-y');

    // As the cookie refresh with the listener `bootstrap/initializeApi` wires.
    vi.mocked(validateAuthSession).mockImplementation(() => {
        onAccessTokenRefreshed(yToken);
        return Promise.resolve(yToken);
    });
    mockAuthenticatedDataFetches();
    vi.mocked(loadSelfUserForSession).mockResolvedValue({ ...user, id: 'user-y' });

    renderHook();

    await waitFor(() => {
        expect(useAuthStore.getState().status).toBe('authenticated');
    });
    expect(localStorageHelpers.getLocalUser()?.id).toBe('user-y');
    expect(cachesByUser.has(user.id)).toBe(false);
    expect(xClient.getQueryCache().getAll()).toEqual([]);
    expect(isCacheWriteAllowed(queryCacheKey(user.id))).toBe(false);
    await waitFor(() => {
        expect(localStorageHelpers.getKeptOutboxUsers()).toEqual([user.id]);
    });
    expect(await get(outboxStateKey(user.id))).toBeDefined();
    localStorageHelpers.removeKeptOutboxUsers([user.id]);
    vi.unstubAllEnvs();
});
