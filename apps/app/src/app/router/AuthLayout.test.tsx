// Spec 04 §2.3 (04-2a2b): `AuthLayout` replaces `ProtectedRoute`; the assertions of
// `features/routing/ProtectedRoute.test.tsx` moved here, plus the page kept mounted and hidden
// under `AuthModal` after an expiry, and the cold load through the loader.
import { useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { AUTH_READY_TIMEOUT_MS } from 'app/auth/session';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { getLocalUser, LocalStorage } from 'helpers/localStorage';
import { startCacheRestore } from 'shared/offline/restore';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { createTestQueryClient } from 'test/renderWithQueryClient';

import { AuthLayout } from './AuthLayout';
import { buildAppRoutes } from './createAppRouter';

vi.mock('basics/PageLoader', () => ({
    default: () => <div data-testid="page-loader" />,
}));

vi.mock('store/groupsList', async importOriginal => ({
    ...(await importOriginal<typeof import('store/groupsList')>()),
    loadGroupsListForSession: vi.fn(() => Promise.resolve()),
}));

vi.mock('store/sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('store/sessionUser')>()),
    loadKnownUsersForSession: vi.fn(() => Promise.resolve()),
    loadSelfUserForSession: vi.fn(() => Promise.resolve(null)),
}));

const CLOSE_AUTH_LABEL = 'Close auth';

vi.mock('components/modals/auth-modal', () => ({
    AuthModal: ({
        isOpened,
        onOpenChange,
    }: {
        isOpened?: boolean;
        onOpenChange?: (isOpen: boolean) => void;
    }) => (
        <div data-testid="auth-modal" data-opened={String(isOpened)}>
            <button type="button" onClick={() => onOpenChange?.(false)}>
                {CLOSE_AUTH_LABEL}
            </button>
        </div>
    ),
}));

// For the full tree: the shell without the session hook (`authReady` must not need it), and each
// page a `<main>` with its route id.
vi.mock('./RootLayout', async () => {
    const { Outlet } = await import('react-router-dom');

    return { RootLayout: () => <Outlet /> };
});

vi.mock('./routeModules', async () => {
    const { APP_ROUTES } = await import('./routeManifest');

    return {
        ROUTE_MODULES: Object.fromEntries(
            APP_ROUTES.map(route => [
                route.id,
                () => Promise.resolve({ Component: () => <main>{route.id}</main> }),
            ]),
        ),
    };
});

vi.mock('components/nav-bars', () => ({
    DESKTOP_SHELL_MAX_WIDTH: '1200px',
    DesktopSidebar: () => null,
    MobileNavBar: () => null,
}));

const CurrentRoute = () => {
    const location = useLocation();
    const route = `${location.pathname}${location.search}${location.hash}`;

    return (
        <div role="note" aria-label="Current route">
            {route}
        </div>
    );
};

const DRAFT_LABEL = 'Draft';

/** A page with state of its own: a draft typed into it must survive an expiry. */
const DraftPage = () => {
    const [draft, setDraft] = useState('');

    return (
        <input
            aria-label={DRAFT_LABEL}
            value={draft}
            onChange={event => setDraft(event.target.value)}
        />
    );
};

let routers: ReturnType<typeof createMemoryRouter>[] = [];

/** `AuthLayout` alone (no loader): what it renders for the live session. */
const renderLayout = (path: string) => {
    const router = createMemoryRouter(
        [
            {
                element: (
                    <>
                        <AuthLayout />
                        <CurrentRoute />
                    </>
                ),
                children: [{ path: '*', element: <DraftPage /> }],
            },
            { path: '/login', element: <CurrentRoute /> },
        ],
        { initialEntries: [path] },
    );

    routers.push(router);
    render(<RouterProvider router={router} />);
    return router;
};

/** The whole app tree, loaders included. */
const renderApp = (path: string) => {
    const router = createMemoryRouter(buildAppRoutes(createTestQueryClient()), {
        initialEntries: [path],
    });

    routers.push(router);
    render(<RouterProvider router={router} />);
    return router;
};

// The container `AuthLayout` puts around its `<Outlet/>`.
const pageContainer = () => screen.getByLabelText('Draft').closest('div');

beforeAll(() => {
    startCacheRestore(undefined);
});

beforeEach(() => {
    LocalStorage.remove(LS_KEY_USER);
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
    useAuthStore.setState({
        isNewUser: null,
        status: 'authenticated',
        unauthReason: undefined,
        sessionMode: 'online',
    });
});

afterEach(() => {
    routers.forEach(router => router.dispose());
    routers = [];
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online' });
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
});

describe('the live session', () => {
    test('an unresolved session offline shows the offline banner with the loader', async () => {
        useAuthStore.setState({ status: 'unknown' });
        onlineManager.setOnline(false);

        renderLayout('/dashboard');

        // Offline: one screen with the banner and its Retry above the loader, not the PageLoader.
        expect(await screen.findByRole('status')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
        expect(screen.queryByTestId('page-loader')).toBeNull();
        expect(screen.queryByLabelText('Draft')).toBeNull();
    });

    test('an unresolved session online shows only the loader', async () => {
        useAuthStore.setState({ status: 'unknown' });

        renderLayout('/dashboard');

        expect(await screen.findByTestId('page-loader')).toBeTruthy();
        expect(screen.queryByRole('status')).toBeNull();
    });

    test('04-2f AuthLayout: never signed in goes to /login with the path and query, no modal', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });

        renderLayout('/group/123?tab=members#balances');

        await waitFor(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe(
                `/login?returnTo=${encodeURIComponent('/group/123?tab=members')}`,
            );
        });
        expect(screen.queryByTestId('auth-modal')).toBeNull();
        expect(screen.queryByLabelText('Draft')).toBeNull();
    });

    test('04-2f AuthLayout: closing the auth modal goes to /login that returns to the page', async () => {
        const interaction = userEvent.setup();
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });
        renderLayout('/group/join/tok-1');

        await interaction.click(await screen.findByRole('button', { name: CLOSE_AUTH_LABEL }));

        expect(screen.getByLabelText('Current route').textContent).toBe(
            '/login?returnTo=%2Fgroup%2Fjoin%2Ftok-1',
        );
    });

    test('an expiry keeps the page mounted, hidden and inert under the auth modal', async () => {
        const interaction = userEvent.setup();
        renderLayout('/activity?filter=mine#latest');
        await interaction.type(await screen.findByLabelText('Draft'), 'Dinner');
        const input = screen.getByLabelText('Draft');

        act(() => {
            useAuthStore.getState().expireSession();
        });

        expect(screen.getByTestId('auth-modal')).toBeTruthy();
        // The same element with its state: not remounted.
        expect(screen.getByLabelText('Draft')).toBe(input);
        expect((input as HTMLInputElement).value).toBe('Dinner');
        const container = pageContainer();
        expect(container?.getAttribute('aria-hidden')).toBe('true');
        expect(container?.hasAttribute('inert')).toBe(true);
        expect(container && getComputedStyle(container).visibility).toBe('hidden');
        expect(screen.getByLabelText('Current route').textContent).toBe(
            '/activity?filter=mine#latest',
        );

        // Signed in again: the same page, visible and reachable.
        act(() => {
            useAuthStore.getState().setAuthenticated();
        });
        expect(screen.queryByTestId('auth-modal')).toBeNull();
        expect(screen.getByLabelText('Draft')).toBe(input);
        expect(pageContainer()?.hasAttribute('aria-hidden')).toBe(false);
        expect(pageContainer()?.hasAttribute('inert')).toBe(false);
    });

    test('a session expired before the page was shown: the modal alone, as before', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });

        renderLayout('/dashboard');

        expect(await screen.findByTestId('auth-modal')).toBeTruthy();
        expect(screen.queryByLabelText('Draft')).toBeNull();
    });

    test('04-2f AuthLayout: an explicit sign-out goes to /login instead of showing auth UI', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

        renderLayout('/settings');

        await waitFor(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe(
                '/login?returnTo=%2Fsettings',
            );
        });
        expect(screen.queryByTestId('auth-modal')).toBeNull();
        expect(screen.queryByLabelText('Draft')).toBeNull();
    });

    test('04-2f AuthLayout: a remote logout of another tab mid-use leads to /login', async () => {
        renderLayout('/settings');
        await screen.findByLabelText('Draft');

        act(() => {
            useAuthStore.getState().setUnauthenticated('signed_out');
        });

        await waitFor(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe(
                '/login?returnTo=%2Fsettings',
            );
        });
        expect(screen.queryByLabelText('Draft')).toBeNull();
        expect(screen.queryByTestId('auth-modal')).toBeNull();
    });

    test('a session error with a hint offline shows the cached page; online the sign-in', async () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        onlineManager.setOnline(false);
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'error' });

        renderLayout('/dashboard');

        expect(await screen.findByLabelText('Draft')).toBeTruthy();
        expect(screen.queryByTestId('auth-modal')).toBeNull();

        act(() => {
            onlineManager.setOnline(true);
        });
        expect(screen.getByTestId('auth-modal')).toBeTruthy();
    });

    // A signed-out user keeps only the last account's local appearance/locale, never the auth
    // session; whatever the cached locale, the sign-out leads to /login (04-2f, no landing).
    test.each(['ru', 'es', 'pt-BR', 'pt-PT', 'en', 'unreleased-locale'])(
        '04-2f AuthLayout: explicit sign-out with cached locale %s leads to /login, settings kept',
        async language => {
            LocalStorage.set(LS_KEY_USER, {
                role: 'USER',
                settings: {
                    defaultCurrency: 'USD',
                    defaultCategory: 'food',
                    timeFormat: '24h',
                    language,
                    theme: 'light',
                    simplifyDebts: true,
                    skipCategory: false,
                    soloModeByDefault: false,
                    saveGroupExpensesToSolo: false,
                    sex: 'male',
                },
            });
            useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

            renderLayout('/settings');

            await waitFor(() => {
                expect(screen.getByLabelText('Current route').textContent).toBe(
                    '/login?returnTo=%2Fsettings',
                );
            });
            expect(screen.queryByTestId('auth-modal')).toBeNull();
            expect(getLocalUser()?.settings.language).toBe(language);
            expect(getLocalUser()?.settings.theme).toBe('light');
        },
    );
});

describe('with the loader (the whole tree)', () => {
    test('a cold load starts the session check itself: the page well before the 5 s timeout', async () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        const refreshAuthTokens = vi.fn(() => Promise.resolve('access-token'));
        useAuthStore.setState({ status: 'unknown', refreshAuthTokens });
        const startedAt = performance.now();

        renderApp('/dashboard');

        // No component runs `useCheckSignIn` here (the shell is mocked without it).
        expect(screen.getByTestId('page-loader')).toBeTruthy();
        expect(await screen.findByText('dashboard')).toBeTruthy();
        expect(performance.now() - startedAt).toBeLessThan(AUTH_READY_TIMEOUT_MS);
        expect(refreshAuthTokens).toHaveBeenCalledOnce();
        expect(useAuthStore.getState().status).toBe('authenticated');
    });

    test('offline without a cached user, while the loader waits: the banner with Retry', async () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        onlineManager.setOnline(false);
        const refreshAuthTokens = vi.fn(() => Promise.resolve('access-token'));
        useAuthStore.setState({ status: 'unknown', refreshAuthTokens });

        renderApp('/dashboard');

        // The loader waits up to 5 s here (no cache to start on, no network to refresh).
        expect(await screen.findByRole('status')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
        expect(screen.queryByTestId('page-loader')).toBeNull();
        expect(screen.queryByText('dashboard')).toBeNull();
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });

    test('04-2f AuthLayout: an explicit sign-out is sent to /login by the loader before the page loads', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

        const router = renderApp('/group/x');

        await waitFor(() => {
            expect(router.state.location.pathname).toBe('/login');
        });
        expect(router.state.location.search).toBe('?returnTo=%2Fgroup%2Fx');
        expect(screen.queryByText('group')).toBeNull();
    });

    test('an expired session on a group page: the auth modal over the hidden, mounted page', async () => {
        renderApp('/group/x');
        const page = await screen.findByText('group');

        act(() => {
            useAuthStore.getState().expireSession();
        });

        expect(screen.getByTestId('auth-modal')).toBeTruthy();
        expect(screen.getByText('group')).toBe(page);
        expect(page.closest('[inert]')?.getAttribute('aria-hidden')).toBe('true');
    });
});
