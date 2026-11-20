import { Component, type ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { RouteObject } from 'react-router-dom';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_AUTH_SESSION_HINT } from 'constants/localstorage';
import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRoutes';
import { LocalStorage } from 'helpers/localStorage';
import { getLastAccountLandingPath } from 'helpers/publicRoutes';
import { i18n } from 'i18n';
import { startCacheRestore } from 'shared/offline/restore';
import { UNAUTH_REASON } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';
import { getOrThrow } from 'test/getOrThrow';
import { createTestQueryClient } from 'test/renderWithQueryClient';
import { signInWithSelf } from 'test/selfUser';

import { buildAppRoutes } from './createAppRouter';
import { APP_ROUTES } from './routeManifest';

const { CHUNK_ERROR, RENDER_ERROR } = vi.hoisted(() => ({
    CHUNK_ERROR: 'Failed to fetch dynamically imported module',
    RENDER_ERROR: 'The page failed to render',
}));

const gate = vi.hoisted(() => ({
    pages: Promise.resolve(),
    failChunks: false,
    throwIn: null as string | null,
}));

// Each page is a `<main>` with its route id; the pages wait for `gate.pages`. With `failChunks` a
// chunk load rejects; the page `throwIn` throws while it renders.
vi.mock('./routeModules', async () => {
    const { APP_ROUTES } = await import('./routeManifest');

    return {
        ROUTE_MODULES: Object.fromEntries(
            APP_ROUTES.map(route => [
                route.id,
                () =>
                    gate.failChunks
                        ? Promise.reject(new Error(CHUNK_ERROR))
                        : gate.pages.then(() => ({
                              Component: () => {
                                  if (gate.throwIn === route.id) {
                                      throw new Error(RENDER_ERROR);
                                  }
                                  return <main>{route.id}</main>;
                              },
                          })),
            ]),
        ),
    };
});

vi.mock('./RootLayout', async () => {
    const { Outlet } = await import('react-router-dom');

    return {
        RootLayout: () => (
            <div data-testid="shell">
                <Outlet />
            </div>
        ),
    };
});

// The data of a session start (after a cold-load refresh) is not under test here.
vi.mock('store/groupsList', async importOriginal => ({
    ...(await importOriginal<typeof import('store/groupsList')>()),
    loadGroupsListForSession: vi.fn(() => Promise.resolve()),
}));
vi.mock('store/sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('store/sessionUser')>()),
    loadKnownUsersForSession: vi.fn(() => Promise.resolve()),
    loadSelfUserForSession: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('basics/PageLoader', () => ({
    default: () => <div data-testid="page-loader" />,
}));

vi.mock('components/nav-bars', () => ({
    DESKTOP_SHELL_MAX_WIDTH: '1200px',
    DesktopSidebar: () => <aside aria-label="Desktop navigation" />,
    MobileNavBar: () => <nav aria-label="Mobile navigation" />,
}));

vi.mock('components/modals/auth-modal', () => ({
    AuthModal: () => <div data-testid="auth-modal" />,
}));

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
} satisfies UserSettings;

const signIn = () =>
    signInWithSelf({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Alex',
        picture: null,
        role: 'USER',
        subscriptionUntil: null,
        inviteToken: 'invite-token-user',
        settings,
        createdAt: 1,
        updatedAt: 1,
    });

/** The full path of every leaf route: a layout route adds its path, an index route adds none. */
const leafPaths = (routes: RouteObject[], parent = ''): string[] =>
    routes.flatMap(route => {
        let path = parent;
        if (route.path !== undefined) {
            path = route.path.startsWith('/')
                ? route.path
                : `${parent.replace(/\/$/, '')}/${route.path}`;
        }

        return route.children ? leafPaths(route.children, path) : [path];
    });

let routers: ReturnType<typeof createMemoryRouter>[] = [];

/** What `GlobalErrorBoundary` (outside `RouterProvider` in root.tsx) stands for here. */
class OuterBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
    state: { error: unknown } = { error: undefined };

    static getDerivedStateFromError(error: unknown) {
        return { error };
    }

    render() {
        const { error } = this.state;

        if (error === undefined) {
            return this.props.children;
        }
        return <p role="alert">{error instanceof Error ? error.message : 'error'}</p>;
    }
}

const renderAt = (path: string) => {
    const router = createMemoryRouter(buildAppRoutes(createTestQueryClient()), {
        initialEntries: [path],
    });

    routers.push(router);
    render(
        <OuterBoundary>
            <RouterProvider router={router} />
        </OuterBoundary>,
    );
    return router;
};

// What root.tsx does before the router renders; no user cache here (`restoreReady` resolves).
beforeAll(() => {
    startCacheRestore(undefined);
});

beforeEach(() => {
    gate.pages = Promise.resolve();
    gate.failChunks = false;
    gate.throwIn = null;
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    return i18n.changeLanguage('en');
});

afterEach(() => {
    routers.forEach(router => router.dispose());
    routers = [];
});

describe('the route tree', () => {
    test('has exactly the paths of the former AppRouter', () => {
        const paths = leafPaths(buildAppRoutes(createTestQueryClient()));

        expect([...paths].sort()).toEqual(
            [
                ...PUBLIC_ROUTE_ENTRIES.map(route => route.path),
                '/oauth/callback',
                '/dashboard',
                '/solo',
                '/group/:groupId',
                '/group/join/:inviteToken',
                '/activity',
                '/activity/:parentActivityId',
                '/friends/join/:inviteToken',
                '/friends',
                '/settings',
                '/not-found',
                '/*',
            ].sort(),
        );
    });

    test('has no basename; the only loaders are the guards of 04-2a2b (D31)', () => {
        const withLoader = (routes: RouteObject[]): RouteObject[] =>
            routes.flatMap(route => [
                ...(route.loader ? [route] : []),
                ...withLoader(route.children ?? []),
            ]);
        const router = renderAt('/not-found');
        const guarded = withLoader(buildAppRoutes(createTestQueryClient()));

        expect(router.basename).toBe('/');
        expect(guarded.map(route => route.loader)).toHaveLength(2);
        // `requireSession` on `AuthLayout` (every protected route), the Solo guard under it.
        expect(getOrThrow(guarded, 0).id).toBe('auth');
        expect(leafPaths(getOrThrow(guarded, 0).children ?? []).sort()).toEqual(
            APP_ROUTES.filter(route => route.access === 'protected' && !route.transitional)
                .map(route => `/${route.path}`)
                .sort(),
        );
        expect(leafPaths(getOrThrow(guarded, 1).children ?? [])).toEqual(['/solo']);
    });
});

describe('navigation', () => {
    test('an unknown path ends at /not-found', async () => {
        const router = renderAt('/no-such-page');

        expect(await screen.findByText('notFound')).toBeTruthy();
        expect(router.state.location.pathname).toBe('/not-found');
    });

    test('the first load of a lazy page keeps the shell and shows the loader in its outlet', async () => {
        let openPages = () => undefined as void;
        gate.pages = new Promise<void>(resolve => {
            openPages = resolve;
        });
        renderAt('/dashboard');

        expect(screen.getByTestId('shell').contains(screen.getByTestId('page-loader'))).toBe(true);

        act(() => openPages());
        expect(await screen.findByText('dashboard')).toBeTruthy();
    });

    // Risk of 04-2a2b: the shell here runs no `useCheckSignIn`, so the page shows only if the
    // loader starts the session check itself; waiting for a component would take the 5 s timeout.
    test('a cold load with a session hint: the loader checks the session, the page follows', async () => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        const refreshAuthTokens = vi.fn(() => Promise.resolve('access-token'));
        useAuthStore.setState({ status: 'unknown', refreshAuthTokens });

        try {
            renderAt('/settings');

            expect(screen.getByTestId('page-loader')).toBeTruthy();
            // `findByText` gives up after 1 s, far below `AUTH_READY_TIMEOUT_MS`.
            expect(await screen.findByText('settings')).toBeTruthy();
            expect(refreshAuthTokens).toHaveBeenCalledOnce();
        } finally {
            LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
        }
    });

    test('a signed-out deep link to an internal page shows the auth modal on the same URL', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
        const router = renderAt('/group/123');

        expect(await screen.findByTestId('auth-modal')).toBeTruthy();
        expect(screen.queryByText('group')).toBeNull();
        expect(router.state.location.pathname).toBe('/group/123');
    });

    test('an explicit sign-out on an internal page leads to the landing', async () => {
        useAuthStore.setState({
            status: 'unauthenticated',
            unauthReason: UNAUTH_REASON.SIGNED_OUT,
        });
        const router = renderAt('/settings');

        await waitFor(() => {
            expect(router.state.location.pathname).toBe(getLastAccountLandingPath());
        });
        expect(screen.queryByText('settings')).toBeNull();
    });

    test('a join page is protected and has no internal navigation', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
        renderAt('/friends/join/invite-token');

        expect(await screen.findByTestId('auth-modal')).toBeTruthy();
        expect(screen.queryByText('friendJoin')).toBeNull();
        expect(screen.queryByRole('complementary', { name: 'Desktop navigation' })).toBeNull();
    });

    test('Solo goes through SoloGuardLayout: without Solo access it redirects to the dashboard', async () => {
        signIn();
        const router = renderAt('/solo');

        expect(await screen.findByText('dashboard')).toBeTruthy();
        expect(router.state.location.pathname).toBe('/dashboard');
    });

    test('a signed-in user at / goes to the preferred mode through HomeRouteGuard', async () => {
        signIn();
        const router = renderAt('/');

        expect(await screen.findByText('dashboard')).toBeTruthy();
        expect(router.state.location.pathname).toBe('/dashboard');
    });

    test('a localized public path renders through PublicLocaleRoute', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
        renderAt('/ru/privacy');

        expect(await screen.findByText('publicPrivacy')).toBeTruthy();
        expect(i18n.resolvedLanguage).toBe('ru');
    });

    test('the internal layout stays mounted between internal pages', async () => {
        signIn();
        const router = renderAt('/dashboard');
        await screen.findByText('dashboard');
        const sidebar = screen.getByRole('complementary', { name: 'Desktop navigation' });

        await act(() => router.navigate('/activity'));

        expect(await screen.findByText('activity')).toBeTruthy();
        expect(screen.getByRole('complementary', { name: 'Desktop navigation' })).toBe(sidebar);
    });
});

// Until 04-2a3 (`RootErrorBoundary`), route errors go on to `GlobalErrorBoundary` as before the
// data router, never to React Router's default error page.
describe('errors reach the boundary outside the router', () => {
    const DEFAULT_ERROR_PAGE = /Unexpected Application Error/;

    beforeEach(() => {
        // React and React Router log the caught errors.
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    test('a page chunk that fails on the first load', async () => {
        gate.failChunks = true;
        renderAt('/dashboard');

        expect((await screen.findByRole('alert')).textContent).toBe(CHUNK_ERROR);
        expect(screen.queryByText(DEFAULT_ERROR_PAGE)).toBeNull();
    });

    test('a page chunk that fails on a later navigation', async () => {
        signIn();
        const router = renderAt('/dashboard');
        await screen.findByText('dashboard');

        gate.failChunks = true;
        await act(() => router.navigate('/activity'));

        expect((await screen.findByRole('alert')).textContent).toBe(CHUNK_ERROR);
        expect(screen.queryByText(DEFAULT_ERROR_PAGE)).toBeNull();
    });

    test('a page that throws while it renders', async () => {
        gate.throwIn = 'notFound';
        renderAt('/not-found');

        expect((await screen.findByRole('alert')).textContent).toBe(RENDER_ERROR);
        expect(screen.queryByText(DEFAULT_ERROR_PAGE)).toBeNull();
    });
});

/** A concrete URL of a manifest path: every `:param` is `x`. */
const urlOf = (path: string) => `/${path.replace(/:\w+/g, 'x')}`;
const SIDEBAR = { name: 'Desktop navigation' } as const;
// Solo is unreleased: its guard redirects every user (covered above).
const regularRoutes = APP_ROUTES.filter(route => !route.transitional && route.guard !== 'solo');

describe('the guard and layout chain of every manifest route', () => {
    test.each(regularRoutes)('signed in, $id renders inside its layout ($layout)', async route => {
        signIn();
        const router = renderAt(urlOf(route.path));

        const page = await screen.findByText(route.id);
        const sidebar = screen.queryByRole('complementary', SIDEBAR);

        expect(router.state.location.pathname).toBe(urlOf(route.path));
        if (route.layout === 'internal') {
            expect(sidebar).not.toBeNull();
            expect(sidebar?.compareDocumentPosition(page)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        } else {
            expect(sidebar).toBeNull();
        }
    });

    test.each(regularRoutes)('signed out, $id is $access', async route => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
        renderAt(urlOf(route.path));

        if (route.access === 'protected') {
            expect(await screen.findByTestId('auth-modal')).toBeTruthy();
            expect(screen.queryByText(route.id)).toBeNull();
        } else {
            expect(await screen.findByText(route.id)).toBeTruthy();
            expect(screen.queryByTestId('auth-modal')).toBeNull();
        }
        expect(screen.queryByRole('complementary', SIDEBAR)).toBeNull();
    });

    test.each(PUBLIC_ROUTE_ENTRIES)('signed out, the public $path renders $page', async entry => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
        const router = renderAt(entry.path);

        const id = APP_ROUTES.find(
            route => route.transitional && route.path === (entry.page === 'home' ? '' : entry.page),
        )?.id;
        expect(await screen.findByText(id ?? 'no route')).toBeTruthy();
        expect(router.state.location.pathname).toBe(entry.path);
    });

    test.each(['/privacy', '/terms', '/ru/privacy', '/ru/terms'])(
        'signed in, %s stays: HomeRouteGuard is only on the home pages',
        async path => {
            signIn();
            const router = renderAt(path);

            await screen.findByRole('main');
            expect(router.state.location.pathname).toBe(path);
        },
    );

    test.each(['/', '/ru/'])('signed in, %s goes to the preferred mode', async path => {
        signIn();
        const router = renderAt(path);

        expect(await screen.findByText('dashboard')).toBeTruthy();
        expect(router.state.location.pathname).toBe('/dashboard');
    });
});
