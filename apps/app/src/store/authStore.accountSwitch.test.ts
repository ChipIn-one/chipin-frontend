// Spec 03 §1.5, the row "sign-in of Y" (03-16a part C): with offline writes on, the tab that signs Y
// in over X's unsent operations asks first; "Delete and sign in" goes on as before, Cancel signs Y
// out and keeps X's data. A refresh that brings Y into another tab keeps a non-empty outbox of X.
import { get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode, refreshApiAuthTokens } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { ledgerKeys } from 'entities/ledger';
import {
    establishAuthSession,
    markAuthSessionSignedOut,
    setAccessTokenRefreshListener,
    startAuthLogout,
} from 'helpers/authSession';
import {
    addKeptOutboxUser,
    getKeptOutboxUsers,
    getLocalUser,
    getTabUserId,
    LocalStorage,
    removeKeptOutboxUsers,
    saveLocalUser,
} from 'helpers/localStorage';
import { outboxFailedKey, outboxStateKey, queryCacheKey } from 'shared/offline/constants';
import { persistCodec } from 'shared/offline/persistCodec';
import { cachesByUser, isCacheWriteAllowed } from 'shared/offline/userCaches';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { mountAsUserClient } from 'test/userClient';

import { useAccountSwitchConfirmStore } from './accountSwitchConfirmStore';
import { onAccessTokenRefreshed, useAuthStore } from './authStore';
import { loadKnownUsersForSession, loadSelfUserForSession } from './sessionUser';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock('api/chipin', () => ({
    exchangeApiGoogleOAuthCode: vi.fn(),
    refreshApiAuthTokens: vi.fn(),
}));
vi.mock('./sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('./sessionUser')>()),
    loadKnownUsersForSession: vi.fn(),
    loadSelfUserForSession: vi.fn(),
}));
// The real `getAccessTokenSubject`; no network for the session itself.
vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    establishAuthSession: vi.fn(),
    invalidateAuthSession: vi.fn(),
    startAuthLogout: vi.fn(() => Promise.resolve()),
}));

const USER_X = 'user-x';
const USER_Y = 'user-y';
const USER_K = 'user-k';
// One of X's queries (any key of the app's factories).
const X_QUERY_KEY = ledgerKeys.entry('x-entry');

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'ru',
    theme: 'dark',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies SelfUser['settings'];

const selfUser = (id: string): SelfUser => ({
    id,
    email: `${id}@example.com`,
    displayName: id,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: `invite-${id}`,
    settings,
    createdAt: 1,
    updatedAt: 1,
});

const op = (seq: number, owner = USER_X) => ({
    opId: `op-${seq}`,
    seq,
    owner,
    entryKind: 'expense',
    createdAt: Date.now(),
    schema: 1,
    kind: 'createExpense',
    entryId: `entry-${seq}`,
    groupId: null,
    parentActivityId: null,
    draft: {},
});

const keysOf = (userId: string): string[] => [
    queryCacheKey(userId),
    outboxStateKey(userId),
    outboxFailedKey(userId),
];
const xKeys = keysOf(USER_X);

const storedKeys = (userId: string): Promise<string[]> =>
    Promise.all(
        keysOf(userId).map(key => get(key).then(value => (value === undefined ? [] : [key]))),
    ).then(keys => keys.flat());

const storedXKeys = (): Promise<string[]> => storedKeys(USER_X);

// `userId`'s cache and an outbox with `pending` ops and, when any, one failed op.
const storeUserData = (userId: string, pending: number): Promise<void> =>
    Promise.all([
        set(queryCacheKey(userId), `${userId}-cache`),
        set(
            outboxStateKey(userId),
            persistCodec.stringify({
                nextSeq: 20,
                ops: Array.from({ length: pending }, (_, index) => op(index + 1, userId)),
                versions: {},
                cancelled: [],
                retryRequested: [],
                sending: null,
                conflictDrafts: {},
            }),
        ),
        set(
            outboxFailedKey(userId),
            persistCodec.stringify(
                pending === 0 ? [] : [{ op: op(10, userId), reason: 'validation', failedAt: 1 }],
            ),
        ),
    ]).then(() => undefined);

const settleIdb = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 30));

/** X used this device: its cache and an outbox with `pending` ops and one failed op (N = pending + 1). */
const signInX = async (pending: number): Promise<void> => {
    await storeUserData(USER_X, pending);
    saveLocalUser({ id: USER_X, role: 'USER', settings });
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
};

const mockSignedInFetches = (id: string): void => {
    vi.mocked(loadKnownUsersForSession).mockResolvedValue();
    vi.mocked(loadSelfUserForSession).mockImplementation(() => {
        saveLocalUser({ id, role: 'USER', settings });
        return Promise.resolve(selfUser(id));
    });
};

let codeSeq = 0;

// X's session expired on this device (the app runs on the anonymous client), Y signs in.
const signInY = (): Promise<void> => {
    useAuthStore.getState().expireSession();
    codeSeq += 1;
    vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
        token: fakeAccessToken(USER_Y),
        is_new_user: false,
    });
    mockSignedInFetches(USER_Y);
    return useAuthStore.getState().exchangeGoogleOAuthCode(`code-${codeSeq}`);
};

const question = () => useAccountSwitchConfirmStore.getState().request;

const waitForQuestion = async (): Promise<void> => {
    await vi.waitFor(() => {
        expect(question()).not.toBeNull();
    });
};

beforeEach(() => {
    vi.clearAllMocks();
    LocalStorage.remove(LS_KEY_USER);
    removeKeptOutboxUsers([USER_X, USER_Y, USER_K]);
    useAccountSwitchConfirmStore.setState({ request: null });
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('flag on: the initiating tab asks', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    });

    test('the dialog shows N; "Delete and sign in" clears X and signs Y in', async () => {
        await signInX(2);
        const signIn = signInY();

        await waitForQuestion();
        expect(question()).toEqual({ count: 3 });
        // Nothing is deleted or moved while the user decides, and Y's session is not set (L2).
        expect(await storedXKeys()).toEqual(xKeys);
        expect(getLocalUser()?.id).toBe(USER_X);
        expect(establishAuthSession).not.toHaveBeenCalled();

        useAccountSwitchConfirmStore.getState().answer(true);
        await signIn;
        await settleIdb();

        expect(question()).toBeNull();
        expect(await storedXKeys()).toEqual([]);
        expect(getLocalUser()).toEqual({ id: USER_Y, role: 'USER', settings });
        expect(useAuthStore.getState().status).toBe('authenticated');
    });

    test('Cancel: Y is signed out without a broadcast, X keeps its outbox and LocalUser', async () => {
        await signInX(1);
        const signIn = signInY();

        await waitForQuestion();
        useAccountSwitchConfirmStore.getState().answer(false);
        // The exchange settles (no error): the callback page navigates as after a sign-out.
        await expect(signIn).resolves.toBeUndefined();
        await settleIdb();

        expect(await storedXKeys()).toEqual(xKeys);
        // As after X's expiry: the id and the settings, the role went with the session.
        expect(getLocalUser()).toEqual({ id: USER_X, settings });
        expect(getTabUserId()).toBe(USER_X);
        expect(startAuthLogout).toHaveBeenCalledExactlyOnceWith({ broadcast: false });
        // L2: Y's session was never established in this tab.
        expect(establishAuthSession).not.toHaveBeenCalled();
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'signed_out',
        });
        expect(loadSelfUserForSession).not.toHaveBeenCalled();
    });

    test('N = 0: no dialog, X is cleared as before', async () => {
        await signInX(0);

        await signInY();
        await settleIdb();

        expect(question()).toBeNull();
        expect(await storedXKeys()).toEqual([]);
        expect(getLocalUser()?.id).toBe(USER_Y);
    });

    test('an unreadable outbox of X: the dialog without a number', async () => {
        await signInX(1);
        await set(outboxStateKey(USER_X), 'not json');
        const signIn = signInY();

        await waitForQuestion();
        expect(question()).toEqual({ count: null });
        useAccountSwitchConfirmStore.getState().answer(false);
        await signIn;

        expect(await storedXKeys()).toEqual(xKeys);
    });

    test('a sign-in of the same user asks nothing', async () => {
        await signInX(2);
        useAuthStore.getState().expireSession();
        vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
            token: fakeAccessToken(USER_X),
            is_new_user: false,
        });
        mockSignedInFetches(USER_X);

        await useAuthStore.getState().exchangeGoogleOAuthCode('same-user-code');

        expect(question()).toBeNull();
        expect(await storedXKeys()).toEqual(xKeys);
    });
});

describe('flag on: the session changes while the question is open (M1), X as asked (L1)', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    });

    test('a remote logout answers it Cancel; a later confirm signs nothing in, no data loaded', async () => {
        await signInX(1);
        const signIn = signInY();

        await waitForQuestion();
        // As the remote-logout listener of `useCheckSignIn`.
        markAuthSessionSignedOut();
        useAuthStore.getState().setUnauthenticated('signed_out');
        expect(question()).toBeNull();
        useAccountSwitchConfirmStore.getState().answer(true);
        await signIn;

        expect(useAuthStore.getState().status).toBe('unauthenticated');
        expect(establishAuthSession).not.toHaveBeenCalled();
        expect(loadSelfUserForSession).not.toHaveBeenCalled();
        expect(loadKnownUsersForSession).not.toHaveBeenCalled();
    });

    test('an expiry answers it Cancel', async () => {
        await signInX(1);
        const signIn = signInY();

        await waitForQuestion();
        useAuthStore.getState().expireSession();
        await signIn;

        expect(question()).toBeNull();
        expect(useAuthStore.getState().status).toBe('unauthenticated');
        expect(await storedXKeys()).toEqual(xKeys);
        expect(establishAuthSession).not.toHaveBeenCalled();
    });

    test('Cancel restores LS_KEY_USER = X when it changed meanwhile', async () => {
        await signInX(1);
        const signIn = signInY();

        await waitForQuestion();
        saveLocalUser({ id: 'someone-else', settings });
        useAccountSwitchConfirmStore.getState().answer(false);
        await signIn;

        expect(getLocalUser()).toEqual({ id: USER_X, settings });
        expect(await storedXKeys()).toEqual(xKeys);
    });

    test('Delete deletes the X that was asked about, not a later cached user', async () => {
        await signInX(1);
        await storeUserData(USER_K, 0);
        const signIn = signInY();

        await waitForQuestion();
        saveLocalUser({ id: USER_K, settings });
        useAccountSwitchConfirmStore.getState().answer(true);
        await signIn;
        await settleIdb();

        expect(await storedXKeys()).toEqual([]);
        expect(await storedKeys(USER_K)).toEqual(keysOf(USER_K));
    });
});

describe('M3: users whose outbox a refresh switch kept', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    });

    test('the account-switch N counts them; Delete deletes them and empties the list', async () => {
        await signInX(1);
        await storeUserData(USER_K, 3);
        addKeptOutboxUser(USER_K);
        const signIn = signInY();

        await waitForQuestion();
        // X: 1 pending + 1 failed; K: 3 pending + 1 failed.
        expect(question()).toEqual({ count: 6 });
        useAccountSwitchConfirmStore.getState().answer(true);
        await signIn;
        await settleIdb();

        expect(await storedXKeys()).toEqual([]);
        expect(await storedKeys(USER_K)).toEqual([]);
        expect(getKeptOutboxUsers()).toEqual([]);
    });

    test('kept users alone (the same user signs in again) are asked about too', async () => {
        await signInX(0);
        await storeUserData(USER_K, 1);
        addKeptOutboxUser(USER_K);
        useAuthStore.getState().expireSession();
        vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
            token: fakeAccessToken(USER_X),
            is_new_user: false,
        });
        mockSignedInFetches(USER_X);
        const signIn = useAuthStore.getState().exchangeGoogleOAuthCode('kept-only-code');

        await waitForQuestion();
        expect(question()).toEqual({ count: 2 });
        useAccountSwitchConfirmStore.getState().answer(false);
        await signIn;

        expect(await storedKeys(USER_K)).toEqual(keysOf(USER_K));
        expect(getKeptOutboxUsers()).toEqual([USER_K]);
    });

    test('a sign-in of a kept user takes them off the list; their queue stays', async () => {
        await storeUserData(USER_Y, 2);
        addKeptOutboxUser(USER_Y);

        await signInY();
        await settleIdb();

        expect(question()).toBeNull();
        expect(getKeptOutboxUsers()).toEqual([]);
        expect(await storedKeys(USER_Y)).toEqual(keysOf(USER_Y));
    });

    test('signOut() deletes the kept users with the signed-in one', async () => {
        await signInX(0);
        await storeUserData(USER_K, 2);
        addKeptOutboxUser(USER_K);

        await useAuthStore.getState().signOut();
        await settleIdb();

        expect(await storedKeys(USER_K)).toEqual([]);
        expect(getKeptOutboxUsers()).toEqual([]);
    });

    test('a remote logout deletes them too', async () => {
        await signInX(0);
        await storeUserData(USER_K, 2);
        addKeptOutboxUser(USER_K);

        useAuthStore.getState().setUnauthenticated('signed_out');
        await settleIdb();

        expect(await storedKeys(USER_K)).toEqual([]);
        expect(getKeptOutboxUsers()).toEqual([]);
    });
});

test('flag off = master: no dialog, X is cleared synchronously with the sign-in', async () => {
    await signInX(2);

    await signInY();

    expect(question()).toBeNull();
    expect(getLocalUser()).toEqual({ id: USER_Y, role: 'USER', settings });
    await settleIdb();
    expect(await storedXKeys()).toEqual([]);
});

describe('another tab: a refreshed token of Y', () => {
    beforeEach(() => {
        setAccessTokenRefreshListener(onAccessTokenRefreshed);
    });
    afterEach(() => {
        setAccessTokenRefreshListener(null);
    });

    const refreshToY = (): Promise<string> => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        vi.mocked(refreshApiAuthTokens).mockResolvedValue({ token: fakeAccessToken(USER_Y) });
        mockSignedInFetches(USER_Y);
        return useAuthStore.getState().refreshAuthTokens();
    };

    test('flag on, X has unsent ops: X is detached at once, its keys stay, X is recorded', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await signInX(1);
        // X's client in this tab with a query in flight.
        const xClient = mountAsUserClient(USER_X);
        let answerX = (): void => undefined;
        const xQuery = xClient.fetchQuery({
            queryKey: X_QUERY_KEY,
            queryFn: () =>
                new Promise<string>(resolve => {
                    answerX = () => resolve('x-answer');
                }),
        });

        const refresh = refreshToY();

        // Synchronous at the token (B1): this tab is on Y and holds nothing of X.
        await refresh;
        expect(getLocalUser()?.id).toBe(USER_Y);
        expect(cachesByUser.has(USER_X)).toBe(false);
        expect(xClient.getQueryCache().getAll()).toEqual([]);
        expect(isCacheWriteAllowed(queryCacheKey(USER_X))).toBe(false);
        answerX();
        await xQuery.catch(() => undefined);
        expect(xClient.getQueryData(X_QUERY_KEY)).toBeUndefined();

        await settleIdb();
        expect(await storedXKeys()).toEqual(xKeys);
        expect(getKeptOutboxUsers()).toEqual([USER_X]);
        expect(question()).toBeNull();
    });

    test('flag on, X has nothing queued: X is cleared as before, not recorded', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await signInX(0);

        await refreshToY();
        expect(getLocalUser()?.id).toBe(USER_Y);
        await settleIdb();

        expect(await storedXKeys()).toEqual([]);
        expect(getKeptOutboxUsers()).toEqual([]);
    });

    test('flag on, an unreadable outbox of X: kept and recorded', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await signInX(1);
        await set(outboxStateKey(USER_X), 'not json');

        await refreshToY();
        await settleIdb();

        expect(await storedXKeys()).toEqual(xKeys);
        expect(getKeptOutboxUsers()).toEqual([USER_X]);
    });

    test('flag on: kept X, then a sign-out of Y counts and deletes X too', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await signInX(1);

        await refreshToY();
        await settleIdb();
        await useAuthStore.getState().signOut();
        await settleIdb();

        expect(await storedXKeys()).toEqual([]);
        expect(getKeptOutboxUsers()).toEqual([]);
    });

    test('flag off = master: X is cleared even with unsent ops', async () => {
        await signInX(1);

        await refreshToY();
        await settleIdb();

        expect(getLocalUser()?.id).toBe(USER_Y);
        expect(await storedXKeys()).toEqual([]);
    });
});
