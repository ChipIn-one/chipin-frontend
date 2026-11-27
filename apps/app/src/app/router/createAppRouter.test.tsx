import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LoaderFunction, RouteObject } from 'react-router-dom';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { LS_KEY_AUTH_SESSION_HINT, SS_KEY_ROUTE_CHUNK_RELOAD } from 'constants/localstorage';
import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRoutes';
import { checkForServiceWorkerUpdate, reloadApp, updateServiceWorker } from 'helpers/appUpdate';
import { LocalStorage } from 'helpers/localStorage';
import { i18n } from 'i18n';
import { syncHtmlLang } from 'i18n/htmlLang';
import { startCacheRestore } from 'shared/offline/restore';
import { UNAUTH_REASON } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';
import { getOrThrow } from 'test/getOrThrow';
import { createTestQueryClient } from 'test/renderWithQueryClient';
import { signInWithSelf } from 'test/selfUser';

import { buildAppRoutes } from './createAppRouter';
import { APP_ROUTES } from './routeManifest';

const SIDEBAR = { name: 'Desktop navigation' } as const;
const DEFAULT_ERROR_PAGE = /Unexpected Application Error/;
const UUID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';
const { CHUNK_ERROR, RENDER_ERROR } = vi.hoisted(() => ({
    CHUNK_ERROR: 'Failed to fetch dynamically imported module',
    RENDER_ERROR: 'The page failed to render',
}));

const gate = vi.hoisted(() => ({
    pages: Promise.resolve(),
    failChunks: false,
    throwIn: null as string | null,
}));

vi.mock('@sentry/react', async importOriginal => ({
    ...(await importOriginal<typeof import('@sentry/react')>()),
    captureException: vi.fn(),
}));
vi.mock('helpers/appUpdate', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/appUpdate')>()),
    reloadApp: vi.fn(),
    updateServiceWorker: vi.fn(() => Promise.resolve()),
    checkForServiceWorkerUpdate: vi.fn(() => Promise.resolve(false)),
}));

// Each page is a `<main>` with its route id; the pages wait for `gate.pages`. With `failChunks` a
// chunk load rejects; the page `throwIn` throws while it renders.
vi.mock('./routeModules', async () => {
    const { APP_ROUTES } = await import('./routeManifest');
    const { validateUuidParam } = await import('helpers/validateUuidParam');
    // The loaders the real `route.ts` files export (their own tests pin that).
    const loaders: Record<string, LoaderFunction | undefined> = {
        group: validateUuidParam('groupId'),
        activityDetails: validateUuidParam('parentActivityId'),
    };

    return {
        ROUTE_MODULES: Object.fromEntries(
            APP_ROUTES.map(route => [
                route.id,
                () =>
                    gate.failChunks
                        ? Promise.reject(new Error(CHUNK_ERROR))
                        : gate.pages.then(() => ({
                              loader: loaders[route.id],
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
    PageLoader: () => <div data-testid="page-loader" />,
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
                '/login',
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

    test('AUTH-071 unauthenticated on /dashboard goes to /login?returnTo=%2Fdashboard', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
        const router = renderAt('/dashboard');

        expect(await screen.findByText('login')).toBeTruthy();
        expect(router.state.location.pathname + router.state.location.search).toBe(
            '/login?returnTo=%2Fdashboard',
        );
        expect(screen.queryByText('dashboard')).toBeNull();
        expect(screen.queryByTestId('auth-modal')).toBeNull();
    });

    test('AUTH-071 a never-signed-in deep link goes to /login with its path and query', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
        const router = renderAt('/group/123?tab=members');

        expect(await screen.findByText('login')).toBeTruthy();
        expect(screen.queryByText('group')).toBeNull();
        expect(router.state.location.search).toBe(
            `?returnTo=${encodeURIComponent('/group/123?tab=members')}`,
        );
    });

    test('AUTH-071 an explicit sign-out on an internal page goes to /login', async () => {
        useAuthStore.setState({
            status: 'unauthenticated',
            unauthReason: UNAUTH_REASON.SIGNED_OUT,
        });
        const router = renderAt('/settings');

        await waitFor(() => {
            expect(router.state.location.pathname).toBe('/login');
        });
        expect(router.state.location.search).toBe('?returnTo=%2Fsettings');
        expect(screen.queryByText('settings')).toBeNull();
    });

    test('AUTH-075 a join page is protected and keeps its token in returnTo', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
        const router = renderAt('/friends/join/invite-token');

        expect(await screen.findByText('login')).toBeTruthy();
        expect(screen.queryByText('friendJoin')).toBeNull();
        expect(router.state.location.search).toBe('?returnTo=%2Ffriends%2Fjoin%2Finvite-token');
        expect(screen.queryByRole('complementary', { name: 'Desktop navigation' })).toBeNull();
    });

    test('Solo goes through SoloGuardLayout: without Solo access it redirects to the dashboard', async () => {
        signIn();
        const router = renderAt('/solo');

        expect(await screen.findByText('dashboard')).toBeTruthy();
        expect(router.state.location.pathname).toBe('/dashboard');
    });

    test('a signed-in user at / goes to the preferred mode through PublicHomeGuard', async () => {
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

// The public pages and the UI language, through the route tree (moved from the former
// `features/routing/AppRouter.test.tsx`). `<html lang>` is written only by the i18next listener
// (`syncHtmlLang`, wired at boot), so after a public page it is the UI language (#708).
describe('public pages and the UI language', () => {
    let stopHtmlLang: () => void = () => undefined;

    beforeEach(() => {
        stopHtmlLang = syncHtmlLang(i18n);
        document.documentElement.lang = 'en';
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
    });

    afterEach(() => {
        stopHtmlLang();
    });

    test('an English public URL corrects a stale Russian SPA language before rendering', async () => {
        await i18n.changeLanguage('ru');
        renderAt('/privacy');

        expect(await screen.findByText('publicPrivacy')).toBeTruthy();
        expect(i18n.resolvedLanguage).toBe('en');
    });

    test('a public URL updates html lang, and after leaving it is the UI language', async () => {
        const router = renderAt('/ru/privacy');

        await waitFor(() => {
            expect(i18n.resolvedLanguage).toBe('ru');
            expect(document.documentElement.lang).toBe('ru');
        });

        await act(() => router.navigate('/not-found'));

        expect(await screen.findByText('notFound')).toBeTruthy();
        expect(document.documentElement.lang).toBe(i18n.resolvedLanguage);
    });

    // Signed out with the Russian UI, the logo leads to an English public page and back.
    test('a round trip through an English public page leaves html lang equal to the UI language', async () => {
        await i18n.changeLanguage('ru');
        expect(document.documentElement.lang).toBe('ru');
        const router = renderAt('/privacy');

        expect(await screen.findByText('publicPrivacy')).toBeTruthy();
        expect(document.documentElement.lang).toBe('en');

        await act(() => router.navigate('/not-found'));

        expect(await screen.findByText('notFound')).toBeTruthy();
        expect(i18n.resolvedLanguage).toBe('en');
        expect(document.documentElement.lang).toBe('en');
    });
});

describe('route errors (04-2a3, spec 04 §2.5)', () => {
    beforeEach(() => {
        // React and React Router log the caught errors.
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.mocked(Sentry.captureException).mockClear();
        vi.mocked(reloadApp).mockClear();
        sessionStorage.clear();
        vi.mocked(updateServiceWorker).mockClear();
    });

    test('04-2a3: a page that throws while it renders shows the recovery card inside InternalLayout and is reported with its route id', async () => {
        signIn();
        gate.throwIn = 'dashboard';
        renderAt('/dashboard');

        expect(await screen.findByText('The app ran into a problem')).toBeTruthy();
        expect(screen.getByRole('complementary', SIDEBAR)).toBeTruthy();
        await waitFor(() =>
            expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
                tags: { routeId: 'dashboard' },
            }),
        );
        expect(screen.queryByText(DEFAULT_ERROR_PAGE)).toBeNull();
    });

    test('04-2a3: a bare join route error replaces AuthLayout with the card, no navigation', async () => {
        signIn();
        gate.throwIn = 'groupJoin';
        renderAt('/group/join/x');

        expect(await screen.findByText('The app ran into a problem')).toBeTruthy();
        expect(screen.queryByRole('complementary', SIDEBAR)).toBeNull();
    });

    test('04-2a3: an error outside the layouts reaches the root boundary, not the default page', async () => {
        gate.throwIn = 'notFound';
        renderAt('/not-found');

        expect(await screen.findByText('The app ran into a problem')).toBeTruthy();
        expect(screen.queryByText(DEFAULT_ERROR_PAGE)).toBeNull();
    });

    test('04-2a3: a page chunk that fails shows the new-version screen and reloads once per session', async () => {
        gate.failChunks = true;
        renderAt('/not-found');

        expect(await screen.findByText('A new version is available')).toBeTruthy();
        await waitFor(() => expect(reloadApp).toHaveBeenCalledTimes(1));
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test('04-2a3: the second chunk failure in a session does not reload again; the button reloads when no update waits', async () => {
        sessionStorage.setItem(SS_KEY_ROUTE_CHUNK_RELOAD, '1');
        gate.failChunks = true;
        renderAt('/not-found');

        fireEvent.click(await screen.findByRole('button', { name: 'Update app' }));

        await waitFor(() => expect(reloadApp).toHaveBeenCalledTimes(1));
        expect(updateServiceWorker).not.toHaveBeenCalled();
    });

    test('04-2a3: the button applies a waiting worker, keeping the draft', async () => {
        sessionStorage.setItem(SS_KEY_ROUTE_CHUNK_RELOAD, '1');
        vi.mocked(checkForServiceWorkerUpdate).mockResolvedValueOnce(true);
        gate.failChunks = true;
        renderAt('/not-found');

        fireEvent.click(await screen.findByRole('button', { name: 'Update app' }));

        await waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true));
        expect(reloadApp).not.toHaveBeenCalled();
    });

    test('04-2a3: with storage that does not keep the flag nothing reloads by itself', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        gate.failChunks = true;
        renderAt('/not-found');

        expect(await screen.findByText('A new version is available')).toBeTruthy();
        expect(reloadApp).not.toHaveBeenCalled();
    });

    test('04-2a3: offline a failed chunk is not a new version: no auto reload, a retry instead', async () => {
        onlineManager.setOnline(false);

        try {
            gate.failChunks = true;
            renderAt('/not-found');

            expect(await screen.findByText(/You are offline/)).toBeTruthy();
            expect(reloadApp).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
        } finally {
            onlineManager.setOnline(true);
        }
    });

    test('04-2a3: a chunk that fails on a later navigation keeps the layout', async () => {
        signIn();
        sessionStorage.setItem(SS_KEY_ROUTE_CHUNK_RELOAD, '1');
        const router = renderAt('/dashboard');
        await screen.findByText('dashboard');

        gate.failChunks = true;
        await act(() => router.navigate('/activity'));

        expect(await screen.findByText('A new version is available')).toBeTruthy();
        expect(screen.getByRole('complementary', SIDEBAR)).toBeTruthy();
    });
});

describe('route parameter validation (04-2a3, spec 04 §2.4)', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.mocked(Sentry.captureException).mockClear();
        signIn();
    });

    test.each(['/group/123', '/activity/123'])(
        '04-2a3: %s with an invalid UUID renders NotFound inside InternalLayout, unreported',
        async path => {
            renderAt(path);

            expect(await screen.findByText('Page Not Found', { exact: false })).toBeTruthy();
            expect(screen.getByRole('complementary', SIDEBAR)).toBeTruthy();
            expect(screen.queryByText('group')).toBeNull();
            expect(screen.queryByText('activityDetails')).toBeNull();
            expect(Sentry.captureException).not.toHaveBeenCalled();
        },
    );

    test.each([
        ['/group/' + UUID, 'group'],
        ['/activity/' + UUID, 'activityDetails'],
    ])('04-2a3: %s with a UUID renders the page', async (path, id) => {
        renderAt(path);

        expect(await screen.findByText(id)).toBeTruthy();
    });

    test('04-2a3: an invalid inviteToken is not a 404: the join page renders', async () => {
        renderAt('/group/join/not-a-valid-token');

        expect(await screen.findByText('groupJoin')).toBeTruthy();
    });
});

/** A concrete URL of a manifest path: a UUID for the validated ids, else `x`. */
const urlOf = (path: string) =>
    `/${path.replace(/:(\w+)/g, (_, name: string) => (name === 'groupId' || name === 'parentActivityId' ? UUID : 'x'))}`;
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
            // 04-2f: the guard sends a never-signed-in user to /login.
            expect(await screen.findByText('login')).toBeTruthy();
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
        'signed in, %s stays: PublicHomeGuard is only on the home pages',
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
