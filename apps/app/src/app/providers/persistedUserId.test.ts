import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';

import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { clearLocalUserIdentity, LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';

import { nextPersistedUserId, persistedUserId, usePersistedUserId } from './persistedUserId';

beforeEach(() => {
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
});

test('a cached id with a session hint: that user', () => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);

    expect(persistedUserId('user-1')).toBe('user-1');
});

test.each([
    ['no hint', undefined],
    ['hint false (expired / signed out)', false],
])(
    'a cached id without a session hint (%s): no persisted user (spec 03 §1.5 "missing", C3-09)',
    (_name, hint) => {
        if (hint !== undefined) {
            LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, hint);
        }

        expect(persistedUserId('user-1')).toBeUndefined();
    },
);

test('no cached id: no persisted user', () => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);

    expect(persistedUserId(undefined)).toBeUndefined();
});

describe('AUTH-077 the persisted user of the live root', () => {
    test('AUTH-077: an expiry (hint cleared, same tab user) keeps the mounted user', () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);

        expect(nextPersistedUserId('user-1', 'user-1')).toBe('user-1');
    });

    test('AUTH-077: a sign-out (no tab user) drops it', () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);

        expect(nextPersistedUserId('user-1', undefined)).toBeUndefined();
    });

    test('AUTH-077: another tab user switches it, with a hint', () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);

        expect(nextPersistedUserId('user-1', 'user-2')).toBe('user-2');
    });

    test('AUTH-077: another tab user without a hint never gets the mounted client', () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);

        expect(nextPersistedUserId('user-1', 'user-2')).toBeUndefined();
    });

    test('AUTH-077: nothing mounted without a hint (a cold start) stays without a persisted user', () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);

        expect(nextPersistedUserId(undefined, 'user-1')).toBeUndefined();
    });

    describe('usePersistedUserId', () => {
        const settings = {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'en',
            theme: 'system',
            simplifyDebts: true,
            skipCategory: false,
            soloModeByDefault: false,
            saveGroupExpensesToSolo: false,
            sex: 'male',
        } as const;

        beforeEach(() => {
            LocalStorage.remove(LS_KEY_USER);
            useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
        });

        test('AUTH-077: a cold start without a session hint has no persisted user (C3-09)', () => {
            saveLocalUser({ id: 'cold-user', role: 'USER', settings });

            const { result } = renderHook(() => usePersistedUserId());

            expect(result.current).toBeUndefined();
        });

        test('AUTH-077: expiry keeps the user, sign-out drops it, another user switches it', () => {
            LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
            saveLocalUser({ id: 'user-a', role: 'USER', settings });
            const { result } = renderHook(() => usePersistedUserId());
            expect(result.current).toBe('user-a');

            act(() => {
                useAuthStore.getState().expireSession();
            });
            expect(LocalStorage.getRaw(LS_KEY_AUTH_SESSION_HINT)).not.toBe('true');
            expect(result.current).toBe('user-a');

            act(() => {
                clearLocalUserIdentity();
            });
            expect(result.current).toBeUndefined();

            act(() => {
                LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
                saveLocalUser({ id: 'user-b', role: 'USER', settings });
                useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
            });
            expect(result.current).toBe('user-b');
        });

        test('AUTH-077: a sign-in as another user after an expiry switches it', () => {
            LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
            saveLocalUser({ id: 'user-a', role: 'USER', settings });
            const { result } = renderHook(() => usePersistedUserId());

            act(() => {
                useAuthStore.getState().expireSession();
            });
            expect(result.current).toBe('user-a');

            act(() => {
                LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
                saveLocalUser({ id: 'user-b', role: 'USER', settings });
                useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
            });
            expect(result.current).toBe('user-b');
        });
    });
});
