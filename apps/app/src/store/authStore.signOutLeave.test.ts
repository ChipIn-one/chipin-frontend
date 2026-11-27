// Spec 04 §2.3 and invariant 12: the sign-out of this tab leaves for the landing only after the
// server logout (refresh cookie) and the IndexedDB deletes settle, at most
// SIGN_OUT_LEAVE_TIMEOUT_MS; the leaving state is bounded and an expiry in flight does not undo it.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getSiteOrigin } from 'helpers/env';
import { saveLocalUser } from 'helpers/localStorage';

import { SIGN_OUT_LEAVE_TIMEOUT_MS, SIGN_OUT_LEAVING_MAX_MS, useAuthStore } from './authStore';

const mocks = vi.hoisted(() => ({
    startAuthLogout: vi.fn<() => Promise<void>>(),
    clearUserData: vi.fn<(userId: string, reset: () => void) => Promise<void>>(),
}));

vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    startAuthLogout: mocks.startAuthLogout,
    invalidateAuthSession: vi.fn(),
}));

vi.mock('shared/offline/clearUserData', async importOriginal => ({
    ...(await importOriginal<typeof import('shared/offline/clearUserData')>()),
    clearUserData: mocks.clearUserData,
}));

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'ru',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} as const;

// Every deferred is settled after its test: a hanging logout would stay the deduplicated
// `signOutPromise` of the next test.
const pending: (() => void)[] = [];
const deferred = () => {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>(done => {
        resolve = done;
    });
    pending.push(resolve);

    return { promise, resolve };
};
const hanging = () => deferred().promise;

// What `sessionAccess` (app/auth, tested there) reads: `signed_out` + the flag → `leaving`.
const leaving = () => {
    const { unauthReason, isLeavingAfterSignOut } = useAuthStore.getState();

    return unauthReason === 'signed_out' && isLeavingAfterSignOut;
};

let assign = vi.fn();

beforeEach(() => {
    vi.useFakeTimers();
    assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    saveLocalUser({ id: 'user-1', role: 'USER', settings });
    useAuthStore.setState({
        status: 'authenticated',
        unauthReason: undefined,
        isLeavingAfterSignOut: false,
    });
});

afterEach(async () => {
    // Let a pending sign-out finish so the next test starts a new one.
    pending.splice(0).forEach(resolve => resolve());
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useAuthStore.setState({ isLeavingAfterSignOut: false });
});

describe('the sign-out of this tab', () => {
    test('AUTH-071 leaves for the landing only after the logout and the IndexedDB deletes settle', async () => {
        const logout = deferred();
        const deletes = deferred();
        mocks.startAuthLogout.mockReturnValue(logout.promise);
        mocks.clearUserData.mockReturnValue(deletes.promise);

        const signedOut = useAuthStore.getState().signOut();

        // Protected UI is left at once (no redirect to /login), the page is not.
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'signed_out',
            isLeavingAfterSignOut: true,
        });
        expect(leaving()).toBe(true);
        await vi.advanceTimersByTimeAsync(100);
        expect(assign).not.toHaveBeenCalled();

        logout.resolve();
        await vi.advanceTimersByTimeAsync(0);
        expect(assign).not.toHaveBeenCalled();

        deletes.resolve();
        await vi.advanceTimersByTimeAsync(0);
        expect(assign).toHaveBeenCalledExactlyOnceWith(`${getSiteOrigin()}/ru/`);
        await signedOut;
    });

    test('AUTH-071 leaves after the timeout when the logout or the deletes hang', async () => {
        mocks.startAuthLogout.mockReturnValue(hanging());
        mocks.clearUserData.mockReturnValue(hanging());

        void useAuthStore.getState().signOut();

        await vi.advanceTimersByTimeAsync(SIGN_OUT_LEAVE_TIMEOUT_MS - 1);
        expect(assign).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(assign).toHaveBeenCalledExactlyOnceWith(`${getSiteOrigin()}/ru/`);
    });

    test('AUTH-071 a page still alive after leaving ends the leaving state: /login applies again', async () => {
        mocks.startAuthLogout.mockResolvedValue(undefined);
        mocks.clearUserData.mockResolvedValue(undefined);

        await useAuthStore.getState().signOut();
        await vi.advanceTimersByTimeAsync(0);
        expect(assign).toHaveBeenCalledOnce();
        expect(leaving()).toBe(true);

        await vi.advanceTimersByTimeAsync(SIGN_OUT_LEAVING_MAX_MS - 1);
        expect(leaving()).toBe(true);
        await vi.advanceTimersByTimeAsync(1);
        // Still `signed_out`, no longer leaving: `sessionAccess` gives `login` again.
        expect(useAuthStore.getState()).toMatchObject({
            unauthReason: 'signed_out',
            isLeavingAfterSignOut: false,
        });
    });

    test('AUTH-071 an expiry or error in flight while leaving keeps the sign-out (no auth modal)', () => {
        mocks.startAuthLogout.mockReturnValue(hanging());
        mocks.clearUserData.mockResolvedValue(undefined);

        void useAuthStore.getState().signOut();
        useAuthStore.getState().expireSession();
        useAuthStore.getState().setUnauthenticated('expired');
        useAuthStore.getState().setUnauthenticated('error');

        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: 'signed_out',
            isLeavingAfterSignOut: true,
        });
        expect(leaving()).toBe(true);
    });

    test('AUTH-071 without a sign-out of this tab an expiry still applies (sign-in over the page)', () => {
        useAuthStore.getState().setUnauthenticated('expired');

        expect(useAuthStore.getState()).toMatchObject({
            unauthReason: 'expired',
            isLeavingAfterSignOut: false,
        });
    });
});
