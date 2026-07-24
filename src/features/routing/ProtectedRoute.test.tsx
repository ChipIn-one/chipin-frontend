import { beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import { clearAuthTokens } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';

import { ProtectedRoute } from './ProtectedRoute';

vi.mock('basics/PageLoader', () => ({
    default: () => <div data-testid="page-loader" />,
}));

vi.mock('pages/SignInPage', () => ({
    default: () => <div data-testid="sign-in-page" />,
}));

beforeEach(() => {
    clearAuthTokens();
    useAuthStore.setState({
        isNewUser: null,
        status: 'authenticated',
        unauthReason: undefined,
    });
});

test('replaces protected content with sign in on the current route after expiration', () => {
    render(
        <ProtectedRoute>
            <div data-testid="dashboard-content" />
        </ProtectedRoute>,
    );

    expect(screen.getByTestId('dashboard-content')).toBeTruthy();

    act(() => {
        useAuthStore.getState().expireSession();
    });

    expect(screen.getByTestId('sign-in-page')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-content')).toBeNull();
});
