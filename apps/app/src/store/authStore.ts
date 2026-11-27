import * as Sentry from '@sentry/react';
import { create } from 'zustand';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import { SS_KEY_EXPENSE_DRAFT } from 'constants/localstorage';
import { clearUndeliveredConflictNotices } from 'entities/ledger';
import {
    AuthSessionExpiredError,
    AuthSessionPersistenceError,
    clearExpiredAuthSession,
    establishAuthSession,
    getAccessTokenSubject,
    getAuthSessionVersion,
    invalidateAuthSession,
    isAuthSessionCurrent,
    isAuthSessionSwitchedSince,
    logoutOtherDevicesSession,
    markAuthSessionAccountSwitched,
    startAuthLogout,
    validateAuthSession,
} from 'helpers/authSession';
import { getSiteOrigin } from 'helpers/env';
import { isUnauthorizedApiError } from 'helpers/errors';
import {
    addKeptOutboxUser,
    clearLocalUserIdentity,
    clearLocalUserRole,
    getKeptOutboxUsers,
    getLocalUser,
    removeKeptOutboxUsers,
    saveLocalUser,
    SessionStorage,
} from 'helpers/localStorage';
import { getLastAccountLandingPath } from 'helpers/publicRoutes';
import { clearUserData, deleteUserKeys, detachUserData } from 'shared/offline/clearUserData';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import { readOutboxCount, readOutboxCountsOrUnknown } from 'shared/offline/outboxCount';

import {
    dismissAccountSwitchConfirm,
    requestAccountSwitchConfirm,
} from './accountSwitchConfirmStore';
import {
    AUTH_STATUS,
    type AuthStatus,
    SESSION_MODE,
    type SessionMode,
    UNAUTH_REASON,
    type UnauthReason,
} from './authConstants';
import { useConflictDraftStore } from './conflictDraftStore';
import { useExpenseModalStore } from './expenseModalStore';
import { loadGroupsListForSession } from './groupsList';
import { useOutboxSheetStore } from './outboxSheetStore';
import {
    cachedUserId,
    loadKnownUsersForSession,
    loadSelfUserForSession,
    resetSessionSelfLoad,
} from './sessionUser';
import { useUiPrefsStore } from './ui-prefs';

export interface AuthStore {
    status: AuthStatus;
    unauthReason?: UnauthReason;
    isNewUser: boolean | null;
    /** Meaningful while authenticated (spec 03 §1.6); `online` otherwise. */
    sessionMode: SessionMode;
    /**
     * Set together with `signed_out` by an explicit sign-out in this tab, which leaves for the
     * landing with a full navigation (spec 04 §2.3): until the page unloads, `AuthLayout` and
     * `requireSession` do not redirect to `/login?returnTo=` (no protected path in the URL or the
     * history of a shared device). Any other session change clears it.
     */
    isLeavingAfterSignOut: boolean;

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

// Runs on any transition to unauthenticated: resets the UI preferences (re-read from the cached
// user in localStorage, so a caller changes `LS_KEY_USER` before it) and the self-user load of this
// session.
const resetAuthScopedStores = () => {
    useUiPrefsStore.getState().resetUiPrefs();
    resetSessionSelfLoad();
};

// `LS_KEY_USER` of the next user (`{ id, settings }`), or `{ settings }` without one.
const moveLocalUser = (nextUserId: string | null): void => {
    const settings = getLocalUser()?.settings;

    if (nextUserId !== null && settings) {
        saveLocalUser({ id: nextUserId, settings });
    } else {
        clearLocalUserIdentity();
    }
};

// Step (2a) of `clearUserData`: the legacy stores, the expense draft (also the one saved for an app
// reload, spec 04 §2.11 item 4), the open `OutboxSheet` and a conflict draft's reopening (03-16b).
const resetUserStores = () => {
    resetAuthScopedStores();
    useExpenseModalStore.getState().reset();
    SessionStorage.remove(SS_KEY_EXPENSE_DRAFT);
    useOutboxSheetStore.getState().setIsOpen(false);
    useConflictDraftStore.getState().reset();
    clearUndeliveredConflictNotices();
};

// The rows of the "reason → what is deleted" table that delete the user's data (spec 03 §1.5).
// Synchronous: `LS_KEY_USER` is set first (it moves this tab's user, and the app-mode reset reads
// its settings), then `clearUserData`. Returns its IDB deletes (never rejects, a failure is
// reported): a sign-in does not wait for them (writes are blocked already), a sign-out in this tab
// does before it leaves the page. Without a cached id there is no user cache to delete; the stores
// and the draft are reset all the same.
const dropUserData = (
    userId: string | undefined,
    nextUserId: string | null = null,
): Promise<void> => {
    moveLocalUser(nextUserId);
    if (userId === undefined) {
        resetUserStores();
        return Promise.resolve();
    }
    return clearUserData(userId, resetUserStores);
};

// §1.5 kept users (03-16a part C, offline writes on): the data of the users a refresh switch kept
// on this device goes with the next sign-out or account switch, which counted their operations
// (the confirm of this tab or of the initiating one). `exceptUserId` (the user signing in) stays.
const dropKeptUsers = (exceptUserId: string | null = null): Promise<void> => {
    if (!isOfflineWritesFlagOn()) {
        return Promise.resolve();
    }
    const kept = getKeptOutboxUsers().filter(userId => userId !== exceptUserId);
    const deletes = kept.map(userId => clearUserData(userId, () => undefined));

    removeKeptOutboxUsers(kept);
    return Promise.all(deletes).then(() => undefined);
};

// A sign-out in this tab or a remote one (`signed_out`). Returns the IDB deletes (never rejects).
const dropSignedOutUser = (): Promise<void> => {
    // A later sign-in with the same code must reach the server, not this session's result.
    lastOAuthExchange = null;
    dismissAccountSwitchConfirm();
    const deletes = [dropUserData(cachedUserId()), dropKeptUsers()];

    return Promise.all(deletes).then(() => undefined);
};

/** The sign-out of this tab leaves the page at the latest this long after it starts. */
export const SIGN_OUT_LEAVE_TIMEOUT_MS = 3000;
/** Still on the page this long after leaving (navigation cancelled): `/login` applies again. */
export const SIGN_OUT_LEAVING_MAX_MS = 5000;

/** Resolves when `work` settles or after `ms`, whichever is first; never rejects. */
const settledWithin = (work: Promise<unknown>, ms: number): Promise<void> =>
    new Promise<void>(resolve => {
        const timer = setTimeout(resolve, ms);

        void Promise.allSettled([work]).then(() => {
            clearTimeout(timer);
            resolve();
        });
    });

// The session now belongs to `nextUserId` (null: the token has no readable `sub`, treated as
// another user). After a sign-in it runs right after the new session is established, so the
// requests of the previous user are stale (`authSessionVersion`). A refreshed token of another
// user (`onAccessTokenRefreshed`) changes `authSessionVersion` too, before this runs
// (`markAuthSessionAccountSwitched`): a late response of the previous user is rejected as stale
// and fills no store, and its 401 retry does not expire the new session. No store reset aborts a
// request: a write still in flight also tells that it is stale by its client, which
// `clearUserData` drops (`isUserCacheClient`). The previous user's data goes (§1.5 account
// switch) and `LS_KEY_USER` = `{ id: Y, settings }`; a draft of another user is reset. Returns
// whether it switched. With offline writes on, the sign-in asks first (`askAccountSwitch`) and a
// refresh may keep X's data (`onAccessTokenRefreshed`).
const dropOtherUserData = (
    nextUserId: string | null,
    previousUserId: string | undefined = cachedUserId(),
): boolean => {
    const switched = previousUserId !== undefined && previousUserId !== nextUserId;

    if (switched) {
        void dropUserData(previousUserId, nextUserId);
    }
    const draft = useExpenseModalStore.getState();

    if (draft.ownerId !== null && draft.ownerId !== nextUserId) {
        draft.reset();
    }
    return switched;
};

interface AccountSwitchAnswer {
    isConfirmed: boolean;
    /** X as it was when asked (L1): the answer applies to it, not to a later cached user. */
    previousUserId: string | undefined;
}

// §1.5 "sign-in of Y" with offline writes on (03-16a part C), asked before the session of Y is
// established: X's outbox and the kept users' ones (≠ Y) are counted from IndexedDB (this tab runs
// on the anonymous client, X's outbox is not restored in memory). N > 0, or a failed count, asks
// "This device has N unsent operations of another account. Delete them and sign in?". Null when
// there is nothing to ask (offline writes off, no switch and no kept user): the sign-in goes on
// synchronously as before.
const askAccountSwitch = (nextUserId: string | null): Promise<AccountSwitchAnswer> | null => {
    if (!isOfflineWritesFlagOn()) {
        return null;
    }
    const previousUserId = cachedUserId();
    const switched = previousUserId !== undefined && previousUserId !== nextUserId;
    const others = [
        ...(switched ? [previousUserId] : []),
        ...getKeptOutboxUsers().filter(
            userId => userId !== nextUserId && userId !== previousUserId,
        ),
    ];

    if (others.length === 0) {
        return null;
    }
    return readOutboxCountsOrUnknown(others)
        .then(count => (count === 0 ? true : requestAccountSwitchConfirm(count)))
        .then(isConfirmed => ({ isConfirmed, previousUserId }));
};

const loadSignedInData = (): Promise<void> => {
    const since = Date.now();
    const { setDefaultAppMode } = useUiPrefsStore.getState();

    return Promise.all([
        loadGroupsListForSession(since),
        loadSelfUserForSession(since).then(user => {
            if (user) {
                setDefaultAppMode(user.settings.soloModeByDefault);
            }
        }),
        loadKnownUsersForSession(since),
    ]).then(() => undefined);
};

export const useAuthStore = create<AuthStore>((set, get) => ({
    status: AUTH_STATUS.UNKNOWN,
    unauthReason: undefined,
    isNewUser: null,
    sessionMode: SESSION_MODE.ONLINE,
    isLeavingAfterSignOut: false,

    setAuthenticated: () => {
        set({
            status: AUTH_STATUS.AUTHENTICATED,
            unauthReason: undefined,
            sessionMode: SESSION_MODE.ONLINE,
            isLeavingAfterSignOut: false,
        });
    },

    setOfflineCachedSession: () => {
        set({
            status: AUTH_STATUS.AUTHENTICATED,
            unauthReason: undefined,
            sessionMode: SESSION_MODE.OFFLINE_CACHED,
            isLeavingAfterSignOut: false,
        });
    },

    setUnauthenticated: reason => {
        // This tab signed out and is leaving for the landing: an expiry or an error of a request
        // still in flight must not turn the sign-out into `AuthModal` (the data is gone already).
        if (reason !== UNAUTH_REASON.SIGNED_OUT && isLeavingAfterOwnSignOut()) {
            return;
        }
        if (reason === UNAUTH_REASON.SIGNED_OUT) {
            // A remote logout: the initiating tab confirmed it, this tab deletes the same data.
            void dropSignedOutUser();
        } else {
            // Any session change answers an open account-switch question with Cancel (M1).
            dismissAccountSwitchConfirm();
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
            isLeavingAfterSignOut: false,
        });
    },

    // Expiry ≠ logout (§1.5): the cache, the outbox and the draft stay, only the role goes.
    expireSession: () => {
        if (isLeavingAfterOwnSignOut()) {
            return;
        }
        // Any session change answers an open account-switch question with Cancel (M1).
        dismissAccountSwitchConfirm();
        // AUTH-077: the hidden page's queries still refetch (window focus, intervals) and their
        // 401s land here again; a session already expired or invalid is not ended a second time
        // (no version bump, no hint rewrite, no reset of the UI preferences and the self load).
        const { status, unauthReason } = get();
        if (
            status === AUTH_STATUS.UNAUTHENTICATED &&
            (unauthReason === UNAUTH_REASON.EXPIRED || unauthReason === UNAUTH_REASON.INVALID)
        ) {
            return;
        }
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
        // (`loadSelfUserForSession`) remounts the app on the user's QueryClient (spec 03 §1.5), and the
        // remounted callback page asks again: it gets this exchange, not a second request.
        if (lastOAuthExchange?.code === code) {
            return lastOAuthExchange.promise;
        }
        const promise = exchangeApiGoogleOAuthCode(code)
            .then(({ token, is_new_user: isNewUser }) => {
                const nextUserId = getAccessTokenSubject(token);
                const signIn = (previousUserId: string | undefined = cachedUserId()) => {
                    // A persistence error throws here: the previous user's data is kept (§1.5).
                    establishAuthSession(token);
                    dropOtherUserData(nextUserId, previousUserId);
                    // 03-16a part C: the kept users were counted with X; a kept Y goes on.
                    void dropKeptUsers(nextUserId);
                    if (nextUserId !== null && isOfflineWritesFlagOn()) {
                        removeKeptOutboxUsers([nextUserId]);
                    }
                    set({
                        status: AUTH_STATUS.AUTHENTICATED,
                        unauthReason: undefined,
                        isNewUser,
                        sessionMode: SESSION_MODE.ONLINE,
                        isLeavingAfterSignOut: false,
                    });

                    return loadSignedInData();
                };
                // "Cancel" of the account-switch dialog: Y's session was never established here;
                // its refresh cookie is logged out on the server, not broadcast (other tabs still
                // on X would take it as X's sign-out and delete X's data). X's data stays and
                // `LS_KEY_USER` is X again (L1).
                const keepPreviousUser = (previousUserId: string | undefined): Promise<void> => {
                    const logoutRequest = startAuthLogout({ broadcast: false });

                    if (previousUserId !== undefined && getLocalUser()?.id !== previousUserId) {
                        moveLocalUser(previousUserId);
                    }
                    resetAuthScopedStores();
                    set({
                        status: AUTH_STATUS.UNAUTHENTICATED,
                        unauthReason: UNAUTH_REASON.SIGNED_OUT,
                        isNewUser: null,
                        sessionMode: SESSION_MODE.ONLINE,
                    });
                    return logoutRequest;
                };
                const question = askAccountSwitch(nextUserId);

                if (question === null) {
                    return signIn();
                }
                // M1: an answer after the session started or ended (a remote logout, an expiry;
                // they also dismiss the question) signs nothing in; the state those transitions
                // set stays. A refresh-found account switch meanwhile (#641) ends no session: the
                // answer still applies to the sign-in of Y the user started.
                const sessionVersion = getAuthSessionVersion();

                return question.then(({ isConfirmed, previousUserId }) => {
                    if (
                        !isAuthSessionCurrent(sessionVersion) &&
                        !isAuthSessionSwitchedSince(sessionVersion)
                    ) {
                        return startAuthLogout({ broadcast: false });
                    }
                    return isConfirmed ? signIn(previousUserId) : keepPreviousUser(previousUserId);
                });
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
                        isLeavingAfterSignOut: false,
                    });
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
                isLeavingAfterSignOut: false,
            });
            return nextAccessToken;
        });
    },

    logoutOtherDevices: () => {
        return logoutOtherDevicesSession().catch((error: unknown) => {
            if (!isUnauthorizedApiError(error) && !(error instanceof AuthSessionExpiredError)) {
                return Promise.reject(error);
            }

            return clearExpiredAuthSession().then(() => {
                useAuthStore.getState().setUnauthenticated(UNAUTH_REASON.EXPIRED);
                return Promise.reject(error);
            });
        });
    },

    signOut: () => {
        if (signOutPromise) {
            return signOutPromise;
        }

        // Leave protected UI immediately; leave the page (a full navigation to the site landing in
        // the last account's language, spec 04 §2.3, read before the user data goes) only once the
        // server logout (refresh cookie) and the IDB deletes settle, at most
        // SIGN_OUT_LEAVE_TIMEOUT_MS: an unload aborts both (invariant 12). `isLeavingAfterSignOut`
        // is set in the same update as `signed_out`, so no render sees the sign-out without it and
        // nothing redirects to `/login?returnTo=`; it is bounded (`leaveForLanding`).
        const landingUrl = getSiteOrigin() + getLastAccountLandingPath();
        const logoutRequest = startAuthLogout();
        const deletes = dropSignedOutUser();
        set({
            status: AUTH_STATUS.UNAUTHENTICATED,
            unauthReason: UNAUTH_REASON.SIGNED_OUT,
            isNewUser: null,
            sessionMode: SESSION_MODE.ONLINE,
            isLeavingAfterSignOut: true,
        });
        void settledWithin(Promise.all([logoutRequest, deletes]), SIGN_OUT_LEAVE_TIMEOUT_MS).then(
            () => {
                leaveForLanding(landingUrl);
            },
        );

        signOutPromise = logoutRequest.finally(() => {
            signOutPromise = null;
        });
        return signOutPromise;
    },
}));

// The sign-out of this tab set `signed_out` with `isLeavingAfterSignOut` and has not left yet.
function isLeavingAfterOwnSignOut(): boolean {
    const { unauthReason, isLeavingAfterSignOut } = useAuthStore.getState();

    return isLeavingAfterSignOut && unauthReason === UNAUTH_REASON.SIGNED_OUT;
}

// The full navigation of a sign-out. If the page is still here SIGN_OUT_LEAVING_MAX_MS later (the
// navigation failed or was cancelled), the leaving state ends: protected routes go to `/login`.
function leaveForLanding(landingUrl: string): void {
    window.location.assign(landingUrl);
    setTimeout(() => {
        if (isLeavingAfterOwnSignOut()) {
            useAuthStore.setState({ isLeavingAfterSignOut: false });
        }
    }, SIGN_OUT_LEAVING_MAX_MS);
}

const reloadOnlineSession = (): void => {
    const { status, sessionMode } = useAuthStore.getState();

    if (status === AUTH_STATUS.AUTHENTICATED && sessionMode === SESSION_MODE.ONLINE) {
        void loadSignedInData();
    }
};

// N1: a failed count of a detached user is reported by the error name only (no user id).
const reportCountFailed = (error: unknown): void => {
    Sentry.captureMessage('outbox.count_failed', {
        level: 'warning',
        tags: { 'offline.error': error instanceof Error ? error.name : typeof error },
    });
};

// The deferred half of the refresh switch: delete or keep the detached user's keys.
const settleDetachedUser = (userId: string): void => {
    const keep = (): void => {
        // Back on the user meanwhile: their queue continues here, nothing to record.
        if (cachedUserId() !== userId) {
            addKeptOutboxUser(userId);
        }
    };

    readOutboxCount(userId)
        .then(
            count => {
                if (count > 0) {
                    keep();
                } else if (cachedUserId() !== userId) {
                    void deleteUserKeys(userId);
                }
            },
            (error: unknown) => {
                // Unreadable keys are kept.
                reportCountFailed(error);
                keep();
            },
        )
        .catch(reportCountFailed);
};

// Another tab may switch the account (the refresh cookie is shared): a refreshed token of another
// user drops this tab's previous user like a sign-in does (§1.5). An unreadable `sub` decides
// nothing here, the sign-in already did. An online session reloads its data; the session check
// and the reconnect refresh load it themselves. Wired by `bootstrap/initializeApi`.
// With offline writes on (03-16a part C, §1.5 row "token of Y by refresh"), the switch is as
// synchronous as without: this tab moves to Y and X is detached from it at once (no X data in
// memory, no write of X's cache, X's outbox stopped here), only the delete of X's keys waits for
// X's stored outbox count, since the tab that signed Y in may have kept X's unsent operations:
// none → X's keys are deleted (unless this tab is back on X); some, or unreadable → they stay and
// X is recorded as a kept user, counted and deleted by the next sign-out or account switch.
export const onAccessTokenRefreshed = (token: string): void => {
    const nextUserId = getAccessTokenSubject(token);

    if (nextUserId === null) {
        return;
    }
    const previousUserId = cachedUserId();
    const switched = previousUserId !== undefined && previousUserId !== nextUserId;

    // Before the stores are reset and reloaded: the previous user's requests become stale, the
    // reload runs in the new version.
    if (switched) {
        markAuthSessionAccountSwitched();
    }
    if (isOfflineWritesFlagOn() && switched) {
        moveLocalUser(nextUserId);
        removeKeptOutboxUsers([nextUserId]);
        detachUserData(previousUserId, resetUserStores);
        settleDetachedUser(previousUserId);
        reloadOnlineSession();
        return;
    }
    if (dropOtherUserData(nextUserId, previousUserId)) {
        reloadOnlineSession();
    }
};
