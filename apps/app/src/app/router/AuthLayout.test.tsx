// Spec 04 §2.3 (04-2a2b): `AuthLayout` replaces `ProtectedRoute`; the assertions of
// `features/routing/ProtectedRoute.test.tsx` moved here, plus the page kept mounted and hidden
// under `AuthModal` after an expiry, and the cold load through the loader.

import { useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { AUTH_READY_TIMEOUT_MS } from 'app/auth/session';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { getLocalUser, LocalStorage } from 'helpers/localStorage';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { startCacheRestore } from 'shared/offline/restore';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { createTestQueryClient } from 'test/renderWithQueryClient';

import { AuthLayout } from './AuthLayout';
import { buildAppRoutes } from './createAppRouter';

vi.mock('basics/PageLoader', () => ({
    PageLoader: () => <div data-testid="page-loader" />,
}));

// No real `/health` request from jsdom (the session check probes it alongside a refresh, NET-008).
vi.mock('shared/api/health', async importOriginal => ({
    ...(await importOriginal<typeof import('shared/api/health')>()),
    probeBackendHealth: vi.fn(() => Promise.resolve('ok')),
}));

vi.mock('store/groupsList', async importOriginal => ({
    ...(await importOriginal<typeof import('store/groupsList')>()),
    loadGroupsListForSession: vi.fn(() => Promise.resolve()),
}));

vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    startAuthLogout: vi.fn(() => Promise.resolve()),
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

const CheckSignIn = () => {
    useCheckSignIn();
    return null;
};

/** The last account's cached settings (no session) with `language`. */
const cacheUserWithLanguage = (language: string) => {
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
};

/** A user saved on this device (`LocalUser` with an id): there is a cache to show offline. */
const saveUser = () => {
    cacheUserWithLanguage('en');
    const cached = getLocalUser();

    if (cached) {
        LocalStorage.set(LS_KEY_USER, { ...cached, id: 'user-1' });
    }
};

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

    test('AUTH-071 never signed in goes to /login with the path and query, no modal', async () => {
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

    test('AUTH-071 closing the auth modal goes to /login that returns to the page', async () => {
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
        // `visibility: hidden` comes from the CSS Module on this state (jsdom does not apply it).
        expect(container?.getAttribute('data-hidden')).toBe('true');
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
        expect(pageContainer()?.getAttribute('data-hidden')).toBe('false');
    });

    test('a session expired before the page was shown: the modal alone, as before', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });

        renderLayout('/dashboard');

        expect(await screen.findByTestId('auth-modal')).toBeTruthy();
        expect(screen.queryByLabelText('Draft')).toBeNull();
    });

    test('AUTH-071 an explicit sign-out goes to /login instead of showing auth UI', async () => {
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

    test('AUTH-071 a remote logout of another tab mid-use leads to /login', async () => {
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
        saveUser();
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

    test.each(['error', 'persistence_error'] as const)(
        'NET-008 a session %s with a hint offline and no saved user: the offline load error, never the page',
        async reason => {
            LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
            onlineManager.setOnline(false);
            useAuthStore.setState({ status: 'unauthenticated', unauthReason: reason });

            renderLayout('/dashboard');

            expect((await screen.findByRole('alert')).textContent).toContain(
                'The data cannot be loaded without a network.',
            );
            expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
            // One Retry: not the inline offline banner too.
            expect(screen.queryByRole('status')).toBeNull();
            expect(screen.queryByLabelText('Draft')).toBeNull();
            expect(screen.queryByTestId('auth-modal')).toBeNull();

            // The network is back: the sign-in, as for any session error online.
            act(() => {
                onlineManager.setOnline(true);
            });
            expect(screen.queryByRole('alert')).toBeNull();
            expect(screen.getByTestId('auth-modal')).toBeTruthy();
        },
    );

    test('NET-008 Retry checks /health: a failed check keeps the error and says there is still no network', async () => {
        const interaction = userEvent.setup();
        const retryBackendHealth = vi.fn(() => Promise.reject(new Error('unreachable')));
        const original = useConnectivityStore.getState().retryBackendHealth;
        useConnectivityStore.setState({ retryBackendHealth });
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        onlineManager.setOnline(false);
        useAuthStore.setState({ status: 'unknown' });

        try {
            renderLayout('/dashboard');
            await interaction.click(await screen.findByRole('button', { name: 'Retry' }));

            expect(retryBackendHealth).toHaveBeenCalledOnce();
            expect((await screen.findByRole('alert')).textContent).toContain('Still no network');
            expect(screen.queryByLabelText('Draft')).toBeNull();
        } finally {
            useConnectivityStore.setState({ retryBackendHealth: original });
        }
    });

    // Signed out earlier (or in another tab): whatever the cached locale, a protected page leads to
    // /login; the last account's local appearance/locale stays, never the auth session.
    test.each(['ru', 'es', 'pt-BR', 'pt-PT', 'en', 'unreleased-locale'])(
        'AUTH-071 signed out earlier with cached locale %s goes to /login, settings kept',
        async language => {
            cacheUserWithLanguage(language);
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

// Spec 04 §2.3: the explicit sign-out of this tab is a full navigation to the landing of the last
// account's language; the protected path never reaches /login?returnTo= (shared device).
describe('the explicit sign-out of this tab', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        useAuthStore.setState({ isLeavingAfterSignOut: false });
    });

    test.each([
        ['ru', '/ru/'],
        ['es', '/'],
        ['pt-BR', '/'],
        ['pt-PT', '/'],
        ['en', '/'],
        ['unreleased-locale', '/'],
    ])(
        'AUTH-071 explicit sign-out with cached locale %s leaves for the landing %s, not /login',
        async (language, landing) => {
            const assign = vi.fn();
            vi.stubGlobal('location', { ...window.location, assign });
            cacheUserWithLanguage(language);
            renderLayout('/group/123?tab=members');
            await screen.findByLabelText('Draft');

            act(() => {
                void useAuthStore.getState().signOut();
            });

            // Protected UI is gone at once; the page is left once the logout and deletes settle.
            expect(screen.queryByLabelText('Draft')).toBeNull();
            await waitFor(() => {
                expect(assign).toHaveBeenCalledExactlyOnceWith(landing);
            });
            expect(screen.getByLabelText('Current route').textContent).toBe(
                '/group/123?tab=members',
            );
            expect(screen.queryByLabelText('Draft')).toBeNull();
            expect(screen.queryByTestId('auth-modal')).toBeNull();
            expect(getLocalUser()?.settings.language).toBe(language);
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

    test('NET-008 offline cold start, hint, no saved user, no answer: the load error within 5 s; the network back continues the start', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        onlineManager.setOnline(false);
        const refreshAuthTokens = vi.fn(() => Promise.resolve('access-token'));
        useAuthStore.setState({ status: 'unknown', refreshAuthTokens });

        try {
            renderApp('/dashboard');
            // The session hook of the shell (mocked out of the tree above).
            render(
                <MemoryRouter initialEntries={['/dashboard']}>
                    <CheckSignIn />
                </MemoryRouter>,
            );

            await act(() => vi.advanceTimersByTimeAsync(AUTH_READY_TIMEOUT_MS));

            expect(screen.getByRole('alert').textContent).toContain(
                'The data cannot be loaded without a network.',
            );
            expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
            expect(screen.queryByTestId('page-loader')).toBeNull();
            expect(screen.queryByText('dashboard')).toBeNull();
            expect(useAuthStore.getState().status).toBe('unknown');
            expect(refreshAuthTokens).not.toHaveBeenCalled();

            // The network is back: the session check runs, then the page, without a reload.
            act(() => {
                onlineManager.setOnline(true);
            });
            expect(screen.queryByRole('alert')).toBeNull();
            await act(() => vi.advanceTimersByTimeAsync(0));
            expect(refreshAuthTokens).toHaveBeenCalledOnce();
            expect(await screen.findByText('dashboard')).toBeTruthy();
        } finally {
            vi.useRealTimers();
        }
    });

    test('NET-008 offline cold start with a saved user: the cached page, as before', async () => {
        saveUser();
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        onlineManager.setOnline(false);
        const refreshAuthTokens = vi.fn(() => Promise.resolve('access-token'));
        useAuthStore.setState({ status: 'unknown', refreshAuthTokens });

        renderApp('/dashboard');

        expect(await screen.findByText('dashboard')).toBeTruthy();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(useAuthStore.getState()).toMatchObject({
            status: 'authenticated',
            sessionMode: 'offline-cached',
        });
        expect(refreshAuthTokens).not.toHaveBeenCalled();
    });

    test('AUTH-071 an explicit sign-out is sent to /login by the loader before the page loads', async () => {
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
