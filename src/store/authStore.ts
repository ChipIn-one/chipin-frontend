import { create } from 'zustand';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import {
    AuthSessionExpiredError,
    AuthSessionPersistenceError,
    clearExpiredAuthSession,
    establishAuthSession,
    getAccessTokenSubject,
    invalidateAuthSession,
    logoutOtherDevicesSession,
    startAuthLogout,
    validateAuthSession,
} from 'helpers/authSession';
import { isUnauthorizedApiError, normalizeApiError } from 'helpers/errors';
import {
    clearLocalUserIdentity,
    clearLocalUserRole,
    getLocalUser,
    saveLocalUser,
} from 'helpers/localStorage';
import { clearUserData } from 'shared/offline/clearUserData';

import { useActivityStore } from './activity-store';
import {
    AUTH_STATUS,
    type AuthStatus,
    SESSION_MODE,
    type SessionMode,
    UNAUTH_REASON,
    type UnauthReason,
} from './authConstants';
import { useDashboardStore } from './dashboardStore';
import { useErrorsStore } from './errorsStore';
import { useExpenseModalStore } from './expenseModalStore';
import { useGroupsStore } from './groupsStore';
import { useLoadingStore } from './loadingStore';
import { useUsersStore } from './users-store';

export interface AuthStore {
    status: AuthStatus;
    unauthReason?: UnauthReason;
    isNewUser: boolean | null;
    /** Meaningful while authenticated (spec 03 §1.6); `online` otherwise. */
    sessionMode: SessionMode;

    setAuthenticated: () => void;
    /** An offline cold start with a cached user and a session hint: authenticated on the cache. */
    setOfflineCachedSession: () => void;
    setUnauthenticated: (reason: UnauthReason) => void;
    expireSession: () => void;
    exchangeGoogleOAuthCode: (code: string) => Promise<void>;
    refreshAuthTokens: () => Promise<string>;
    logoutOtherDevices: () => Promise<void>;
    signOut: () => Promise<void>;
}

let signOutPromise: Promise<void> | null = null;
let lastOAuthExchange: { code: string; promise: Promise<void> } | null = null;

// The legacy stores hold data in memory: reset on any transition to unauthenticated and reloaded
// after sign-in. Each store-migration PR removes its own line (spec 03 §1.5). It re-reads the
// cached user from localStorage, so a caller changes `LS_KEY_USER` before it.
const resetAuthScopedStores = () => {
    useActivityStore.getState().resetActivity();
    useDashboardStore.getState().setInitialDashboardStore();
    useGroupsStore.getState().setInitialGroupsStore();
    useUsersStore.getState().setInitialUsersStore();
    useLoadingStore.getState().setInitialLoadingStore();
};

// Step (2a) of `clearUserData`: the legacy stores and the expense draft.
const resetUserStores = () => {
    resetAuthScopedStores();
    useExpenseModalStore.getState().reset();
};

/** The signed-in (or last) user of this tab: in memory first, a remote logout already cleared it. */
const cachedUserId = (): string | undefined =>
    useUsersStore.getState().localUser?.id ?? getLocalUser()?.id;

// The rows of the "reason → what is deleted" table that delete the user's data (spec 03 §1.5).
// Synchronous: `LS_KEY_USER` is set first (the store reset re-reads it), then `clearUserData`, whose
// IDB deletes are not awaited (writes are blocked already, a failure is reported). Without a cached
// id there is no user cache to delete; the stores and the draft are reset all the same.
const dropUserData = (userId: string | undefined, nextUserId: string | null = null): void => {
    const settings = getLocalUser()?.settings;

    if (nextUserId !== null && settings) {
        saveLocalUser({ id: nextUserId, settings });
    } else {
        clearLocalUserIdentity();
    }
    if (userId === undefined) {
        resetUserStores();
        return;
    }
    void clearUserData(userId, resetUserStores);
};

// A sign-out in this tab or a remote one (`signed_out`).
const dropSignedOutUser = (): void => {
    // A later sign-in with the same code must reach the server, not this session's result.
    lastOAuthExchange = null;
    dropUserData(cachedUserId());
};

// The session now belongs to `nextUserId` (null: the token has no readable `sub`, treated as
// another user). Runs right after the new session is established, so the requests of the previous
// user are stale (`authSessionVersion`) and the store reset aborts them: the previous user's data
// goes (§1.5 account switch) and `LS_KEY_USER` = `{ id: Y, settings }`; a draft of another user is
// reset. Returns whether it switched. No dialog until 03-16a: it only asks about unsent outbox
// operations.
const dropOtherUserData = (nextUserId: string | null): boolean => {
    const previousUserId = cachedUserId();
    const switched = previousUserId !== undefined && previousUserId !== nextUserId;

    if (switched) {
        dropUserData(previousUserId, nextUserId);
    }
    const draft = useExpenseModalStore.getState();

    if (draft.ownerId !== null && draft.ownerId !== nextUserId) {
        draft.reset();
    }
    return switched;
};

const loadSignedInData = (isNewUser: boolean | null): Promise<void> => {
    const { fetchSetDashboardData, setDefaultAppMode } = useDashboardStore.getState();
    const { fetchSetGroups } = useGroupsStore.getState();
    const { fetchSetPremiumPromoRemaining, fetchSetUser, fetchSetFriends } =
        useUsersStore.getState();

    return Promise.all([
        fetchSetDashboardData(),
        fetchSetGroups(),
        fetchSetUser().then(user => {
            if (user) {
                setDefaultAppMode(user.settings.soloModeByDefault);
            }
        }),
        fetchSetFriends(),
        isNewUser ? fetchSetPremiumPromoRemaining() : Promise.resolve(),
    ]).then(() => undefined);
};

export const useAuthStore = create<AuthStore>(set => ({
    status: AUTH_STATUS.UNKNOWN,
    unauthReason: undefined,
    isNewUser: null,
    sessionMode: SESSION_MODE.ONLINE,

    setAuthenticated: () => {
        set({
            status: AUTH_STATUS.AUTHENTICATED,
            unauthReason: undefined,
            sessionMode: SESSION_MODE.ONLINE,
        });
    },

    setOfflineCachedSession: () => {
        set({
            status: AUTH_STATUS.AUTHENTICATED,
            unauthReason: undefined,
            sessionMode: SESSION_MODE.OFFLINE_CACHED,
        });
    },

    setUnauthenticated: reason => {
        if (reason === UNAUTH_REASON.SIGNED_OUT) {
            // A remote logout: the initiating tab confirmed it, this tab deletes the same data.
            dropSignedOutUser();
        } else {
            // Expiry and `invalid` drop only the role; `missing` and errors change nothing.
            if (reason === UNAUTH_REASON.EXPIRED || reason === UNAUTH_REASON.INVALID) {
                clearLocalUserRole();
            }
            resetAuthScopedStores();
        }
        set({
            status: AUTH_STATUS.UNAUTHENTICATED,
            unauthReason: reason,
            isNewUser: null,
            sessionMode: SESSION_MODE.ONLINE,
        });
    },

    // Expiry ≠ logout (§1.5): the cache, the outbox and the draft stay, only the role goes.
    expireSession: () => {
        invalidateAuthSession();
        clearLocalUserRole();
        resetAuthScopedStores();
        set({
            status: AUTH_STATUS.UNAUTHENTICATED,
            unauthReason: UNAUTH_REASON.EXPIRED,
            isNewUser: null,
            sessionMode: SESSION_MODE.ONLINE,
        });
    },

    exchangeGoogleOAuthCode: code => {
        // An OAuth code is single-use. The first `LocalUser.id` written during the exchange
        // (`fetchSetUser`) remounts the app on the user's QueryClient (spec 03 §1.5), and the
        // remounted callback page asks again: it gets this exchange, not a second request.
        if (lastOAuthExchange?.code === code) {
            return lastOAuthExchange.promise;
        }
        useErrorsStore.getState().clearError('auth', 'login');
        const promise = exchangeApiGoogleOAuthCode(code)
            .then(({ token, is_new_user: isNewUser }) => {
                // A persistence error throws here: the previous user's data is kept (§1.5 table).
                establishAuthSession(token);
                dropOtherUserData(getAccessTokenSubject(token));
                set({
                    status: AUTH_STATUS.AUTHENTICATED,
                    unauthReason: undefined,
                    isNewUser,
                    sessionMode: SESSION_MODE.ONLINE,
                });

                return loadSignedInData(isNewUser);
            })
            .catch((error: unknown) => {
                const cleanup =
                    error instanceof AuthSessionPersistenceError
                        ? startAuthLogout({ broadcast: false })
                        : Promise.resolve();

                return cleanup.then(() => {
                    resetAuthScopedStores();
                    set({
                        status: AUTH_STATUS.UNAUTHENTICATED,
                        unauthReason:
                            error instanceof AuthSessionPersistenceError
                                ? UNAUTH_REASON.PERSISTENCE_ERROR
                                : UNAUTH_REASON.ERROR,
                        isNewUser: null,
                        sessionMode: SESSION_MODE.ONLINE,
                    });
                    useErrorsStore.getState().setError('auth', 'login', normalizeApiError(error));
                    return Promise.reject(error);
                });
            });

        lastOAuthExchange = { code, promise };
        // A failed exchange is not cached: a retry sends a new request.
        promise.catch(() => {
            if (lastOAuthExchange?.promise === promise) {
                lastOAuthExchange = null;
            }
        });
        return promise;
    },

    refreshAuthTokens: () => {
        return validateAuthSession().then(nextAccessToken => {
            if (!nextAccessToken) {
                useAuthStore.getState().expireSession();
                return Promise.reject(new Error('Auth session is missing or expired'));
            }

            // Also ends an offline-cached session (§1.6).
            set({
                status: AUTH_STATUS.AUTHENTICATED,
                unauthReason: undefined,
                sessionMode: SESSION_MODE.ONLINE,
            });
            return nextAccessToken;
        });
    },

    logoutOtherDevices: () => {
        const { setLoading } = useLoadingStore.getState();
        const { clearError, setError } = useErrorsStore.getState();

        clearError('auth', 'logoutOtherDevices');
        setLoading('auth', 'logoutOtherDevices', 'loading');

        return logoutOtherDevicesSession()
            .catch((error: unknown) => {
                setError('auth', 'logoutOtherDevices', normalizeApiError(error));
                if (!isUnauthorizedApiError(error) && !(error instanceof AuthSessionExpiredError)) {
                    return Promise.reject(error);
                }

                return clearExpiredAuthSession().then(() => {
                    useAuthStore.getState().setUnauthenticated(UNAUTH_REASON.EXPIRED);
                    return Promise.reject(error);
                });
            })
            .finally(() => {
                setLoading('auth', 'logoutOtherDevices', 'fetched');
            });
    },

    signOut: () => {
        if (signOutPromise) {
            return signOutPromise;
        }

        // Start the best-effort server logout, but leave protected UI immediately.
        const logoutRequest = startAuthLogout();
        dropSignedOutUser();
        set({
            status: AUTH_STATUS.UNAUTHENTICATED,
            unauthReason: UNAUTH_REASON.SIGNED_OUT,
            isNewUser: null,
            sessionMode: SESSION_MODE.ONLINE,
        });

        signOutPromise = logoutRequest.finally(() => {
            signOutPromise = null;
        });
        return signOutPromise;
    },
}));

// Another tab may switch the account (the refresh cookie is shared): a refreshed token of another
// user drops this tab's previous user like a sign-in does (§1.5). An unreadable `sub` decides
// nothing here, the sign-in already did. An online session reloads its data; the session check
// and the reconnect refresh load it themselves. Wired by `bootstrap/initializeApi`.
export const onAccessTokenRefreshed = (token: string): void => {
    const nextUserId = getAccessTokenSubject(token);

    if (nextUserId === null || !dropOtherUserData(nextUserId)) {
        return;
    }
    const { status, sessionMode } = useAuthStore.getState();

    if (status === AUTH_STATUS.AUTHENTICATED && sessionMode === SESSION_MODE.ONLINE) {
        void loadSignedInData(false);
    }
};
