// Spec 03 §1.5 with the data router: the first `LocalUser.id` after boot remounts the app on that
// user's client (`UserQueryProvider` is keyed by the user). `AppRouterProvider` then creates a new
// router from the current URL and disposes the old one, and the callback page does not exchange the
// OAuth code twice. The guards, the session check and the callback page run for real.
import { useEffect } from 'react';
import { Theme } from '@radix-ui/themes';
import { render, screen, waitFor } from '@testing-library/react';
import type { createBrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { exchangeApiGoogleOAuthCode } from 'api/chipin';
import type { SelfUser } from 'api/chipin.types';
import { usePersistedUserId } from 'app/providers/persistedUserId';
import { UserQueryProvider } from 'app/providers/UserQueryProvider';
import { LS_KEY_AUTH_SESSION_HINT, LS_KEY_USER } from 'constants/localstorage';
import { fetchSelfUser } from 'entities/users';
import { establishAuthSession } from 'helpers/authSession';
import { LocalStorage, saveLocalUser } from 'helpers/localStorage';
import i18n from 'i18n';
import { UNAUTH_REASON } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';
import { resetSessionSelfLoad } from 'store/sessionUser';
import { getOrThrow } from 'test/getOrThrow';

import { AppRouterProvider } from './AppRouterProvider';

import 'fake-indexeddb/auto';

type Router = ReturnType<typeof createBrowserRouter>;

const probe = vi.hoisted(() => ({ mounts: 0, routers: [] as unknown[] }));
const routers = () => probe.routers as Router[];

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock('api/chipin', () => ({ exchangeApiGoogleOAuthCode: vi.fn() }));
vi.mock('helpers/authSession', async importOriginal => ({
    ...(await importOriginal<typeof import('helpers/authSession')>()),
    establishAuthSession: vi.fn(),
}));
vi.mock('entities/users', async importOriginal => ({
    ...(await importOriginal<typeof import('entities/users')>()),
    fetchSelfUser: vi.fn(),
}));
vi.mock('basics/PageLoader', () => ({ default: () => null }));
vi.mock('components/nav-bars', () => ({
    DESKTOP_SHELL_MAX_WIDTH: '1200px',
    DesktopSidebar: () => null,
    MobileNavBar: () => null,
}));

// Every router `AppRouterProvider` creates, with `dispose` spied on.
vi.mock('./createAppRouter', async importOriginal => {
    const actual = await importOriginal<typeof import('./createAppRouter')>();

    return {
        ...actual,
        createAppRouter: (...args: Parameters<typeof actual.createAppRouter>) => {
            const router = actual.createAppRouter(...args);

            vi.spyOn(router, 'dispose');
            probe.routers.push(router);
            return router;
        },
    };
});

// The shell of what RootLayout does for the session: the restore gate and the sign-in check.
vi.mock('./RootLayout', async () => {
    const { Outlet } = await import('react-router-dom');
    const { RestoreGate } = await import('app/providers/RestoreGate');
    const { useCheckSignIn } = await import('hooks/useCheckSignIn');

    const Probes = () => {
        useCheckSignIn();
        useEffect(() => {
            probe.mounts += 1;
        }, []);
        return null;
    };

    return {
        RootLayout: () => (
            <RestoreGate>
                <Probes />
                <Outlet />
            </RestoreGate>
        ),
    };
});

// The callback page is the real one; every other page is a `<main>` with its route id.
vi.mock('./routeModules', async () => {
    const { APP_ROUTES } = await import('./routeManifest');
    const callback = await import('pages/oauth-callback-page/route');

    return {
        ROUTE_MODULES: Object.fromEntries(
            APP_ROUTES.map(route => [
                route.id,
                () =>
                    Promise.resolve(
                        route.id === 'oauthCallback'
                            ? callback
                            : { Component: () => <main>{route.id}</main> },
                    ),
            ]),
        ),
    };
});

const user = {
    id: 'signed-in-user',
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
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

// What main.tsx does: the router provider inside the query provider that follows this tab's user.
const App = () => {
    const userId = usePersistedUserId();

    return (
        <Theme>
            <UserQueryProvider userId={userId}>
                <AppRouterProvider />
            </UserQueryProvider>
        </Theme>
    );
};

// The real i18n instance: the OAuth callback returns to `/`, whose `PublicLocaleRoute` switches the
// language before `HomeRouteGuard` sends the signed-in user on.
beforeEach(() => i18n.changeLanguage('en').then(() => undefined));

beforeEach(() => {
    probe.mounts = 0;
    probe.routers.length = 0;
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
    // A user cached before 03-7a: settings, no id.
    LocalStorage.remove(LS_KEY_USER);
    saveLocalUser({ role: 'USER', settings: user.settings });
    vi.mocked(fetchSelfUser).mockReset();
    resetSessionSelfLoad();
    useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
});

afterEach(() => {
    window.history.replaceState(null, '', '/');
});

test('the remount on the first user id: a new router at the same URL, the old one disposed', async () => {
    window.history.replaceState(null, '', '/settings?tab=profile');
    vi.spyOn(useAuthStore.getState(), 'refreshAuthTokens').mockImplementation(() => {
        useAuthStore.setState({ status: 'authenticated' });
        return Promise.resolve('access-token');
    });
    vi.mocked(fetchSelfUser).mockResolvedValue({ ...user, id: 'stored-user' });

    render(<App />);

    await waitFor(() => {
        expect(probe.mounts).toBe(2);
    });
    expect(routers()).toHaveLength(2);
    const first = getOrThrow(routers(), 0);
    const second = getOrThrow(routers(), 1);
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).not.toHaveBeenCalled();
    expect(second.state.location.pathname).toBe('/settings');
    expect(second.state.location.search).toBe('?tab=profile');
    expect(await screen.findByText('settings')).toBeTruthy();
});

test('a fresh OAuth sign-in across the remount: the code is exchanged once', async () => {
    window.history.replaceState(null, '', '/oauth/callback?code=single-use-code');
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, false);
    vi.mocked(establishAuthSession).mockImplementation(() => {
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
    });
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: UNAUTH_REASON.MISSING });
    LocalStorage.remove(LS_KEY_USER);
    vi.mocked(exchangeApiGoogleOAuthCode).mockResolvedValue({
        token: 'access-token',
        is_new_user: false,
    });
    vi.mocked(fetchSelfUser).mockResolvedValue({ ...user, id: 'oauth-user' });

    render(<App />);

    await waitFor(() => {
        expect(probe.mounts).toBe(2);
    });
    // The end of the chain (callback → `/` → `HomeRouteGuard` → `/dashboard`), so no navigation or
    // effect outlives the test.
    expect(await screen.findByText('dashboard')).toBeTruthy();
    expect(window.location.pathname).toBe('/dashboard');
    expect(routers()).toHaveLength(2);
    const first = getOrThrow(routers(), 0);
    const second = getOrThrow(routers(), 1);
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.state.location.pathname).toBe(window.location.pathname);
    expect(exchangeApiGoogleOAuthCode).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().status).toBe('authenticated');
});
