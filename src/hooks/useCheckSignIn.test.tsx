import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, render, waitFor } from '@testing-library/react';

import { clearAuthTokens, saveAuthTokens } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/usersStore';

import { useCheckSignIn } from './useCheckSignIn';

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

beforeEach(() => {
    vi.restoreAllMocks();
    clearAuthTokens();
    useAuthStore.setState({
        isNewUser: null,
        status: 'unknown',
        unauthReason: undefined,
    });
});

test('validates stored tokens with the server on cold start', () => {
    saveAuthTokens({
        accessToken: 'cached-access-token',
        refreshToken: 'cached-refresh-token',
    });
    const refreshAuthTokens = vi.fn(() => Promise.resolve('next-access-token'));
    useAuthStore.setState({ refreshAuthTokens });
    vi.spyOn(useDashboardStore.getState(), 'fetchSetDashboardData')
        .mockImplementation(() => undefined);
    vi.spyOn(useGroupsStore.getState(), 'fetchSetGroups')
        .mockImplementation(() => Promise.resolve([]));
    vi.spyOn(useUsersStore.getState(), 'fetchSetUser')
        .mockImplementation(() => undefined);
    vi.spyOn(useUsersStore.getState(), 'fetchSetFriends')
        .mockImplementation(() => undefined);

    renderHook();

    return waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    });
});

test('revalidates an authenticated session when the app becomes visible', () => {
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
    document.dispatchEvent(new Event('visibilitychange'));

    return waitFor(() => {
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
    });
});

test('does not overwrite a newer authenticated session after stale validation fails', () => {
    let rejectValidation: ((reason: Error) => void) | undefined;
    const validation = new Promise<string>((_, reject) => {
        rejectValidation = reject;
    });
    const refreshAuthTokens = vi.fn(() => validation);
    saveAuthTokens({
        accessToken: 'cached-access-token',
        refreshToken: 'cached-refresh-token',
    });
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

            return expect(validation)
                .rejects.toThrow('Auth session changed during token rotation')
                .then(() => {
                    expect(useAuthStore.getState().status).toBe('authenticated');
                });
        });
});
