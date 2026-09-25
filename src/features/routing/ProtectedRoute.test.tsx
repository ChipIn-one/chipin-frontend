import { beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import { clearAuthTokens } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';

import { ProtectedRoute } from './ProtectedRoute';

vi.mock('basics/PageLoader', () => ({
    default: () => <div data-testid="page-loader" />,
}));

vi.mock('components/modals/auth-modal', () => ({
    AuthModal: ({
        isOpened,
        isCloseDisabled,
    }: {
        isOpened?: boolean;
        isCloseDisabled?: boolean;
    }) => (
        <div
            data-testid="auth-modal"
            data-opened={String(isOpened)}
            data-close-disabled={String(isCloseDisabled)}
        />
    ),
}));

beforeEach(() => {
    clearAuthTokens();
    window.history.replaceState({}, '', '/');
    useAuthStore.setState({
        isNewUser: null,
        status: 'authenticated',
        unauthReason: undefined,
    });
});

test('shows the auth modal on an unauthenticated protected deep link without changing the URL', () => {
    window.history.replaceState({}, '', '/group/123?tab=members#balances');
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });

    render(
        <ProtectedRoute>
            <div data-testid="group-content" />
        </ProtectedRoute>,
    );

    expect(screen.getByTestId('auth-modal').dataset.opened).toBe('true');
    expect(screen.getByTestId('auth-modal').dataset.closeDisabled).toBe('true');
    expect(screen.queryByTestId('group-content')).toBeNull();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
        '/group/123?tab=members#balances',
    );
});

test('replaces protected content with the auth modal on the current route after expiration', () => {
    window.history.replaceState({}, '', '/activity?filter=mine#latest');

    render(
        <ProtectedRoute>
            <div data-testid="dashboard-content" />
        </ProtectedRoute>,
    );

    expect(screen.getByTestId('dashboard-content')).toBeTruthy();

    act(() => {
        useAuthStore.getState().expireSession();
    });

    expect(screen.getByTestId('auth-modal')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-content')).toBeNull();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
        '/activity?filter=mine#latest',
    );
});
