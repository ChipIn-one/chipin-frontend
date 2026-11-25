import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { markAuthSessionSignedOut, subscribeToRemoteAuthLogout } from 'helpers/authSession';
import { getLocalUser, getTabUserId, hasAuthSessionHint } from 'helpers/localStorage';
import { isNetworkError } from 'shared/api/client';
import { probeBackendHealth } from 'shared/api/health';
import { AUTH_STATUS, SESSION_MODE, UNAUTH_REASON } from 'store/authConstants';
import { selectAuthStatus, selectSessionMode } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { onConnectivityChange, useConnectivityStore } from 'store/connectivityStore';
import { loadGroupsListForSession } from 'store/groupsList';
import { loadKnownUsersForSession, loadSelfUserForSession } from 'store/sessionUser';
import { useUiPrefsStore } from 'store/ui-prefs';

import { useTabUserId } from './useTabUserId';

interface SessionStart {
    since: number;
    hadCachedUser: boolean;
    switchedUser: boolean;
}

// `since`: when this session start began (before its refresh); `hadCachedUser`: a cached user
// existed then. `switchedUser`: the refresh found another user (§1.5, the refresh listener
// dropped the cached one), so that user's default app mode applies as for a fresh sign-in.
const loadSessionData = ({ since, hadCachedUser, switchedUser }: SessionStart): Promise<void> =>
    Promise.all([
        loadGroupsListForSession(since),
        loadSelfUserForSession(since).then(user => {
            if (user && (switchedUser || !hadCachedUser)) {
                useUiPrefsStore.getState().setDefaultAppMode(user.settings.soloModeByDefault);
            }
        }),
        loadKnownUsersForSession(since),
    ]).then(() => undefined);

// The attempt in flight (spec 04 §2.3: the route loader and this hook both start the check, it runs
// once). Any change of the auth store ends the dedupe: a later start may then try again, as the
// effect did on its dependency changes before.
let attemptInFlight: symbol | null = null;
// A transient refresh failure (5xx, a one-off request error) retries with a capped exponential
// backoff while online and never signs the user out (#788); an auth change cancels the retry.
const SESSION_CHECK_RETRY_BASE_MS = 1000;
const SESSION_CHECK_RETRY_MAX_MS = 30_000;
export const sessionCheckRetryDelayMs = (retry: number): number =>
    Math.min(SESSION_CHECK_RETRY_BASE_MS * 2 ** retry, SESSION_CHECK_RETRY_MAX_MS);
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
useAuthStore.subscribe(() => {
    attemptInFlight = null;
    if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    retryCount = 0;
});

/**
 * NET-007: with no user saved on this device a refresh that hangs (a network the browser calls
 * online but that answers nothing, e.g. Wi-Fi without internet) would keep the loader up until the
 * browser gives up on it, 20-50 s later. `/health` is probed alongside it (at most 5 s): no answer
 * while the attempt still runs marks the network unusable, as the refresh's own network error
 * would, so `AuthLayout` shows the offline load error. The refresh itself is left running (a
 * cancelled refresh may have rotated the cookie on the server); its answer still decides.
 * `startedAt` is when the attempt began: only a probe sent after it counts, never an older shared
 * one (e.g. of the 15 s re-check) whose `unreachable` describes the network before this attempt.
 *
 * Known limit: if the network comes back while the hung refresh is still pending, the start waits
 * for that refresh (the dedupe blocks a new attempt), and a recovery found by the re-check may drop
 * back to the error screen for one cycle. It heals itself when the refresh settles: its failure
 * online schedules the retry with backoff, its success signs in.
 */
const probeWhileRefreshHangs = (attempt: symbol, startedAt: number): void => {
    void probeBackendHealth(startedAt).then(health => {
        if (
            health === 'unreachable' &&
            attemptInFlight === attempt &&
            useAuthStore.getState().status === AUTH_STATUS.UNKNOWN
        ) {
            onConnectivityChange('offline', startedAt);
        }
    });
};

/**
 * One attempt of the initial session check (cold start), outside React: the guard loader of
 * `app/auth/session.ts` starts it before any component mounts, `useCheckSignIn` starts it again on a
 * connectivity change. Does nothing once the session is resolved, on the OAuth callback (the
 * callback page signs in itself), or while an attempt started since the last auth change runs.
 * Offline or backend down the check waits for connectivity instead of signing out.
 */
const startSessionCheck = (pathname: string): void => {
    if (
        pathname === ROUTES.OAUTH_CALLBACK ||
        useAuthStore.getState().status !== AUTH_STATUS.UNKNOWN ||
        attemptInFlight !== null
    ) {
        return;
    }
    const { setUnauthenticated, setOfflineCachedSession, setAuthenticated, refreshAuthTokens } =
        useAuthStore.getState();

    if (!hasAuthSessionHint()) {
        setUnauthenticated(UNAUTH_REASON.MISSING);
        return;
    }

    const mode = useConnectivityStore.getState().mode;
    const hasCachedUserId = getTabUserId() !== undefined;

    if (mode !== 'online') {
        // Offline cold start (spec 03 §1.6): a refresh cannot reach the server, so a cached user
        // with a session hint goes straight to the cache. Backend down keeps waiting.
        if (mode === 'offline' && hasCachedUserId) {
            setOfflineCachedSession();
        }
        return;
    }

    const attempt = Symbol('session-check');
    attemptInFlight = attempt;
    const startedAt = performance.now();
    const since = Date.now();
    const hadCachedUser = getLocalUser() !== null;
    const cachedIdBefore = getTabUserId();
    const refresh = refreshAuthTokens();

    if (!hasCachedUserId) {
        probeWhileRefreshHangs(attempt, startedAt);
    }
    refresh
        .then(() => {
            setAuthenticated();
            return loadSessionData({
                since,
                hadCachedUser,
                switchedUser: cachedIdBefore !== undefined && getTabUserId() !== cachedIdBefore,
            });
        })
        .catch((error: unknown) => {
            if (useAuthStore.getState().status !== AUTH_STATUS.UNKNOWN) {
                return;
            }
            // A network error during the refresh, classified offline before this `catch` runs:
            // the same offline cold start. Backend down keeps waiting; a one-off request error
            // is an `error`. The hint is read again, the refresh may have ended the session.
            if (
                isNetworkError(error) &&
                useConnectivityStore.getState().mode === 'offline' &&
                hasCachedUserId &&
                hasAuthSessionHint()
            ) {
                setOfflineCachedSession();
                return;
            }
            if (useConnectivityStore.getState().mode !== 'online') {
                // Connectivity recovery restarts the check (the effect), with a fresh backoff.
                retryCount = 0;
                return;
            }

            // A transient failure (5xx, a one-off network error with a healthy backend): the
            // session is not proven invalid, so it stays `unknown` and the check retries. Only a
            // 401/403 of the refresh ends the session, inside `refreshAuthTokens` (AUTH-009).
            if (retryTimer === null) {
                const delay = sessionCheckRetryDelayMs(retryCount);
                retryCount += 1;
                retryTimer = setTimeout(() => {
                    retryTimer = null;
                    startSessionCheck(pathname);
                }, delay);
            }
        })
        .finally(() => {
            if (attemptInFlight === attempt) {
                attemptInFlight = null;
            }
        });
};

// The conditions of the reconnect effect, read at the time of the call (spec 03 §1.6).
const isReconnectDue = (): boolean => {
    const { status, sessionMode } = useAuthStore.getState();

    return (
        status === AUTH_STATUS.AUTHENTICATED &&
        sessionMode === SESSION_MODE.OFFLINE_CACHED &&
        useConnectivityStore.getState().mode === 'online'
    );
};

/**
 * The reactive parts of the session check: the remote logout of another tab, a retry of the initial
 * check when connectivity returns, and the reconnect of an offline-cached session.
 */
export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    const sessionMode = useAuthStore(selectSessionMode);
    // Offline or backend down: the session check waits for connectivity instead of signing out.
    const isDisconnected = useConnectivityStore(state => state.mode !== 'online');
    const isOffline = useConnectivityStore(state => state.mode === 'offline');
    const hasCachedUserId = useTabUserId() !== undefined;
    const refreshAuthTokens = useAuthStore(s => s.refreshAuthTokens);

    useEffect(() => {
        return subscribeToRemoteAuthLogout(() => {
            const current = useAuthStore.getState();
            if (
                current.status === AUTH_STATUS.UNAUTHENTICATED &&
                current.unauthReason === UNAUTH_REASON.SIGNED_OUT
            ) {
                return;
            }

            markAuthSessionSignedOut();
            current.setUnauthenticated(UNAUTH_REASON.SIGNED_OUT);
        });
    }, []);

    // The initial check, started again whenever its inputs change while the session is unknown.
    useEffect(() => {
        startSessionCheck(location.pathname);
    }, [hasCachedUserId, isDisconnected, isOffline, location.pathname, refreshAuthTokens, status]);

    // Reconnect of an offline-cached session: a 401 refresh expires the session (inside
    // `refreshAuthTokens`), a success makes it `online` and loads the data the cold start skipped.
    // A connectivity flap during the refresh must not start a second one (and load twice). The
    // flap's re-run is skipped then, so a failed refresh (a request error, still online) retries
    // once while the reconnect is still due and the hook mounted; a second failure waits for the
    // next change.
    const isReconnecting = useRef(false);
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);
    useEffect(() => {
        if (
            status !== AUTH_STATUS.AUTHENTICATED ||
            sessionMode !== SESSION_MODE.OFFLINE_CACHED ||
            isDisconnected ||
            isReconnecting.current
        ) {
            return;
        }

        const reconnect = (canRetry: boolean): Promise<void> => {
            const since = Date.now();
            const cachedIdBefore = getTabUserId();

            return refreshAuthTokens()
                .then(() =>
                    loadSessionData({
                        since,
                        hadCachedUser: true,
                        switchedUser: getTabUserId() !== cachedIdBefore,
                    }),
                )
                .catch(() => {
                    // A 401 has already expired the session; a network error keeps the cached
                    // session, and the next reconnect (a connectivity change) tries again.
                    if (canRetry && isMounted.current && isReconnectDue()) {
                        return reconnect(false);
                    }
                    return undefined;
                });
        };

        isReconnecting.current = true;
        void reconnect(true).finally(() => {
            isReconnecting.current = false;
        });
    }, [isDisconnected, refreshAuthTokens, sessionMode, status]);
};

export { startSessionCheck };
