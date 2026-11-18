// Spec 03 §1.5, the row "sign-in of Y" (03-16a part C): with offline writes on, the tab that signs Y
// in over X's unsent operations asks first; "Delete and sign in" goes on as before, Cancel signs Y
// out and keeps X's data. A refresh that brings Y into another tab keeps a non-empty outbox of X.
import { get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode, refreshApiAuthTokens } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { setAccessTokenRefreshListener, startAuthLogout } from 'helpers/authSession';
import { getLocalUser, getTabUserId, LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { outboxFailedKey, outboxStateKey, queryCacheKey } from 'shared/offline/constants';
import { persistCodec } from 'shared/offline/persistCodec';
import { fakeAccessToken } from 'test/fakeAccessToken';

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

const op = (seq: number) => ({
    opId: `op-${seq}`,
    seq,
    owner: USER_X,
    entryKind: 'expense',
    createdAt: Date.now(),
    schema: 1,
    kind: 'createExpense',
    entryId: `entry-${seq}`,
    groupId: null,
    parentActivityId: null,
    draft: {},
});

const xKeys = [queryCacheKey(USER_X), outboxStateKey(USER_X), outboxFailedKey(USER_X)];

const storedXKeys = (): Promise<string[]> =>
    Promise.all(xKeys.map(key => get(key).then(value => (value === undefined ? [] : [key])))).then(
        keys => keys.flat(),
    );

const settleIdb = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 30));

/** X used this device: its cache and an outbox with `pending` ops and one failed op (N = pending + 1). */
const signInX = async (pending: number): Promise<void> => {
    await Promise.all([
        set(queryCacheKey(USER_X), 'x-cache'),
        set(
            outboxStateKey(USER_X),
            persistCodec.stringify({
                nextSeq: 20,
                ops: Array.from({ length: pending }, (_, index) => op(index + 1)),
                versions: {},
                cancelled: [],
                retryRequested: [],
                sending: null,
                conflictDrafts: {},
            }),
        ),
        set(
            outboxFailedKey(USER_X),
            persistCodec.stringify(
                pending === 0 ? [] : [{ op: op(10), reason: 'validation', failedAt: 1 }],
            ),
        ),
    ]);
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
        // Nothing is deleted or moved while the user decides.
        expect(await storedXKeys()).toEqual(xKeys);
        expect(getLocalUser()?.id).toBe(USER_X);

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

    test('flag on, X has unsent ops: the tab moves to Y, X keeps its data', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await signInX(1);

        await refreshToY();
        await vi.waitFor(() => {
            expect(getLocalUser()?.id).toBe(USER_Y);
        });
        await settleIdb();

        expect(await storedXKeys()).toEqual(xKeys);
        expect(question()).toBeNull();
    });

    test('flag on, X has nothing queued: X is cleared as before', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await signInX(0);

        await refreshToY();
        await vi.waitFor(() => {
            expect(getLocalUser()?.id).toBe(USER_Y);
        });
        await settleIdb();

        expect(await storedXKeys()).toEqual([]);
    });

    test('flag on: a newer transition while X is counted is not overwritten', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await signInX(1);

        const refresh = refreshToY();
        // This tab signs out before the count answers.
        await useAuthStore.getState().signOut();
        await refresh;
        await settleIdb();

        expect(getLocalUser()).toEqual({ settings });
    });

    test('flag off = master: X is cleared even with unsent ops', async () => {
        await signInX(1);

        await refreshToY();
        await settleIdb();

        expect(getLocalUser()?.id).toBe(USER_Y);
        expect(await storedXKeys()).toEqual([]);
    });
});
