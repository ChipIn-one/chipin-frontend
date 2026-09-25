import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { clearAuthTokens } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';

import { ProtectedRoute } from './ProtectedRoute';

vi.mock('basics/PageLoader', () => ({
    default: () => <div data-testid="page-loader" />,
}));

const CLOSE_AUTH_LABEL = 'Close auth';

vi.mock('components/modals/auth-modal', () => ({
    AuthModal: ({
        isOpened,
        setIsOpened,
    }: {
        isOpened?: boolean;
        setIsOpened?: (isOpen: boolean) => void;
    }) => (
        <div data-testid="auth-modal" data-opened={String(isOpened)}>
            <button type="button" onClick={() => setIsOpened?.(false)}>
                {CLOSE_AUTH_LABEL}
            </button>
        </div>
    ),
}));

const CurrentRoute = () => {
    const location = useLocation();
    const currentRoute = `${location.pathname}${location.search}${location.hash}`;

    return <output aria-label="Current route">{currentRoute}</output>;
};

beforeEach(() => {
    clearAuthTokens();
    useAuthStore.setState({
        isNewUser: null,
        status: 'authenticated',
        unauthReason: undefined,
    });
});

test('shows the auth modal on an unauthenticated protected deep link without changing the URL', () => {
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });

    render(
        <MemoryRouter initialEntries={['/group/123?tab=members#balances']}>
            <ProtectedRoute>
                <div data-testid="group-content" />
            </ProtectedRoute>
            <CurrentRoute />
        </MemoryRouter>,
    );

    expect(screen.getByTestId('auth-modal').dataset.opened).toBe('true');
    expect(screen.queryByTestId('group-content')).toBeNull();
    expect(screen.getByLabelText('Current route').textContent).toBe(
        '/group/123?tab=members#balances',
    );
});

test('closes the auth gate back to the landing page', () => {
    const interaction = userEvent.setup();
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });

    render(
        <MemoryRouter initialEntries={['/group/123']}>
            <ProtectedRoute>
                <div data-testid="group-content" />
            </ProtectedRoute>
            <CurrentRoute />
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('button', { name: CLOSE_AUTH_LABEL })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe('/');
    });
});

test('replaces protected content with the auth modal on the current route after expiration', () => {
    render(
        <MemoryRouter initialEntries={['/activity?filter=mine#latest']}>
            <ProtectedRoute>
                <div data-testid="dashboard-content" />
            </ProtectedRoute>
            <CurrentRoute />
        </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-content')).toBeTruthy();

    act(() => {
        useAuthStore.getState().expireSession();
    });

    expect(screen.getByTestId('auth-modal')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-content')).toBeNull();
    expect(screen.getByLabelText('Current route').textContent).toBe(
        '/activity?filter=mine#latest',
    );
});

test('redirects an explicit sign out to the landing page instead of showing auth UI', () => {
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ProtectedRoute>
                <div data-testid="settings-content" />
            </ProtectedRoute>
            <CurrentRoute />
        </MemoryRouter>,
    );

    return screen.findByLabelText('Current route').then(currentRoute => {
        expect(currentRoute.textContent).toBe('/');
        expect(screen.queryByTestId('auth-modal')).toBeNull();
        expect(screen.queryByTestId('settings-content')).toBeNull();
    });
});
