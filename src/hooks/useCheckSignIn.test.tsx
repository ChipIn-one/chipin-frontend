import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, render, waitFor } from '@testing-library/react';

import type { SelfUser } from 'api/chipin.types';
import {
    LS_KEY_AUTH_SESSION_HINT,
    LS_KEY_AUTH_TOKENS,
    LS_KEY_USER,
} from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/users-store';

import { useCheckSignIn } from './useCheckSignIn';

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
    vi.spyOn(useDashboardStore.getState(), 'fetchSetDashboardData').mockResolvedValue();
    vi.spyOn(useGroupsStore.getState(), 'fetchSetGroups').mockResolvedValue([]);
    vi.spyOn(useUsersStore.getState(), 'fetchSetUser').mockResolvedValue(user);
    vi.spyOn(useUsersStore.getState(), 'fetchSetFriends').mockResolvedValue();
};

const markRestorableAuthSession = (): void => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
};

beforeEach(() => {
    vi.restoreAllMocks();
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
    LocalStorage.remove(LS_KEY_USER);
    localStorage.removeItem(LS_KEY_AUTH_TOKENS);
    useDashboardStore.getState().setInitialDashboardStore();
    useUsersStore.getState().setInitialUsersStore();
    useAuthStore.setState({
        isNewUser: null,
        status: 'unknown',
        unauthReason: undefined,
    });
});

test('keeps a signed-out cold start unauthenticated, purges legacy tokens, and skips refresh', () => {
    localStorage.setItem(
        LS_KEY_AUTH_TOKENS,
        JSON.stringify({
            accessToken: 'legacy-access-token',
            refreshToken: 'legacy-refresh-token',
        }),
    );
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
        expect(localStorage.getItem(LS_KEY_AUTH_TOKENS)).toBeNull();
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

test('initializes the app mode from the fetched preference without a cached user', () => {
    markRestorableAuthSession();
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    const setDefaultAppMode = vi.spyOn(
        useDashboardStore.getState(),
        'setDefaultAppMode',
    );
    vi.spyOn(useAuthStore.getState(), 'refreshAuthTokens').mockResolvedValue(
        'next-access-token',
    );
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
    LocalStorage.set(LS_KEY_USER, {
        role: groupDefaultUser.role,
        settings: groupDefaultUser.settings,
    });
    useUsersStore.getState().setInitialUsersStore();
    useDashboardStore.setState({ appMode: APP_MODES.SOLO });
    const setDefaultAppMode = vi.spyOn(
        useDashboardStore.getState(),
        'setDefaultAppMode',
    );
    vi.spyOn(useAuthStore.getState(), 'refreshAuthTokens').mockResolvedValue(
        'next-access-token',
    );
    vi.spyOn(useDashboardStore.getState(), 'fetchSetDashboardData').mockResolvedValue();
    vi.spyOn(useGroupsStore.getState(), 'fetchSetGroups').mockResolvedValue([]);
    const fetchSetUser = vi
        .spyOn(useUsersStore.getState(), 'fetchSetUser')
        .mockResolvedValue(groupDefaultUser);
    vi.spyOn(useUsersStore.getState(), 'fetchSetFriends').mockResolvedValue();

    renderHook();

    return waitFor(() => {
        expect(fetchSetUser).toHaveBeenCalledOnce();
    }).then(() => {
        expect(setDefaultAppMode).not.toHaveBeenCalled();
        expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
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
            rejectValidation?.(
                new Error('Auth session changed during token rotation'),
            );

            return expect(validation).rejects.toThrow(
                'Auth session changed during token rotation',
            );
        })
        .then(() => {
            expect(useAuthStore.getState().status).toBe('authenticated');
        });
});
