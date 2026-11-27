// AUTH-077 (#836): a remote session revoke (another device signs the others out) keeps the page
// that was shown mounted and hidden under `AuthModal`, in the real root composition of main.tsx:
// `Main` (`usePersistedUserId` → `UserQueryProvider` → `AppRouterProvider`) → `AuthLayout` → the real
// `GroupPage` with its real settle-up dialog. The revoke runs through the real interceptors: a page
// refetch is answered 401, the cookie refresh 401, and the interceptor expires the session.
// Before the fix the expiry dropped the persisted user (the hint is cleared), `UserQueryProvider`
// swapped the client and the whole tree, router included, remounted without the page; and the page
// hooks selected no data once signed out, so `GroupPage` unmounted the dialog.
import type { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { createBrowserRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { initChipInApiInterceptors } from 'api/chipin.interceptors';
import type { Group as WireGroup, SelfUser } from 'api/chipin.types';
import { LS_KEY_USER } from 'constants/localstorage';
import { groupsKeys } from 'entities/groups';
import { establishAuthSession, invalidateAuthSession } from 'helpers/authSession';
import {
    hasAuthSessionHint,
    LocalStorage,
    resetTabUserId,
    saveLocalUser,
} from 'helpers/localStorage';
import { i18n } from 'i18n';
import { Main } from 'main';
import { startCacheRestore } from 'shared/offline/restore';
import { UNAUTH_REASON } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';
import { resetSessionSelfLoad } from 'store/sessionUser';
import { setupMswServer } from 'test/mswServer';

import 'fake-indexeddb/auto';

type Router = ReturnType<typeof createBrowserRouter>;

const server = setupMswServer();
const probe = vi.hoisted(() => ({ routers: [] as unknown[], clients: [] as unknown[] }));
const routers = () => probe.routers as Router[];
const clients = () => probe.clients as QueryClient[];

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
// No real `/health` request from jsdom (the session check probes it alongside a refresh).
vi.mock('shared/api/health', async importOriginal => ({
    ...(await importOriginal<typeof import('shared/api/health')>()),
    probeBackendHealth: vi.fn(() => Promise.resolve('ok')),
}));
vi.mock('basics/PageLoader', () => ({ PageLoader: () => null }));
vi.mock('components/nav-bars', () => ({
    DESKTOP_SHELL_MAX_WIDTH: '1200px',
    DesktopSidebar: () => null,
    MobileNavBar: () => null,
}));
// The real modal next to the page portals is covered by `AuthLayout.portals.test.tsx`.
vi.mock('components/modals/auth-modal', () => ({
    AuthModal: () => <div data-testid="auth-modal" />,
}));

vi.mock('./createAppRouter', async importOriginal => {
    const actual = await importOriginal<typeof import('./createAppRouter')>();

    return {
        ...actual,
        createAppRouter: (...args: Parameters<typeof actual.createAppRouter>) => {
            const router = actual.createAppRouter(...args);

            probe.routers.push(router);
            return router;
        },
    };
});

// The shell of what RootLayout does for the session: the restore gate and the sign-in check, plus
// a probe of the QueryClient the routes run on.
vi.mock('./RootLayout', async () => {
    const { Outlet } = await import('react-router-dom');
    const { useQueryClient } = await import('@tanstack/react-query');
    const { RestoreGate } = await import('app/providers/RestoreGate');
    const { useCheckSignIn } = await import('hooks/useCheckSignIn');

    const SignInCheck = () => {
        useCheckSignIn();
        probe.clients.push(useQueryClient());
        return null;
    };

    return {
        RootLayout: () => (
            <RestoreGate>
                <SignInCheck />
                <Outlet />
            </RestoreGate>
        ),
    };
});

const USER_ID = 'revoked-user';
const OTHER_ID = 'other-user';
const GROUP_ID = '0b6f8f4e-6a3c-4c1e-9b7a-2f9d8c1e5a10';
const GROUP_PATH = `/group/${GROUP_ID}`;
const GROUP_NAME = 'Revoked trip';

/** A JWT the interceptors accept without a refresh (`exp` an hour ahead), `sub` = the user. */
const accessToken = (subject: string): string =>
    `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3_600, sub: subject }))}.signature`;

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
} as const;

const user = {
    id: USER_ID,
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings,
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const member = (id: string, displayName: string) => ({
    id,
    email: `${id}@example.com`,
    displayName,
    firstName: displayName,
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
});

// The user owes the other member 25 USD: the settle-up trigger is enabled.
const group = {
    id: GROUP_ID,
    name: GROUP_NAME,
    inviteToken: 'invite-token',
    description: null,
    creator: member(USER_ID, 'User'),
    members: [
        {
            user: member(USER_ID, 'User'),
            balancesByCurrency: { USD: { currency: 'USD', netBalance: -25 } },
        },
        {
            user: member(OTHER_ID, 'Other'),
            balancesByCurrency: { USD: { currency: 'USD', netBalance: 25 } },
        },
    ],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
} satisfies WireGroup;

/** The backend of a live session: the user, the group, its list and activity, the refresh. */
const serveSignedIn = () => {
    server.use(
        http.get('*/users/self', () => HttpResponse.json(user)),
        http.get('*/users/known-users', () => HttpResponse.json({ friends: [] })),
        http.get('*/groups', () => HttpResponse.json({ items: [group], nextCursor: null })),
        http.get(`*/groups/${GROUP_ID}`, () => HttpResponse.json(group)),
        http.get(`*/groups/${GROUP_ID}/activity-previews`, () =>
            HttpResponse.json({ items: [], nextCursor: null }),
        ),
        http.post('*/auth/refresh', () => HttpResponse.json({ token: accessToken(USER_ID) })),
    );
};

/** Another device signed this one out: every request and the cookie refresh answer 401. */
const serveRevoked = () => {
    const unauthorized = () => HttpResponse.json({ code: 'AUTH.UNAUTHORIZED' }, { status: 401 });

    server.use(http.get('*', unauthorized), http.post('*/auth/refresh', unauthorized));
};

const currentClient = (): QueryClient => {
    const client = clients()[clients().length - 1];

    if (client === undefined) {
        throw new Error('No QueryClient rendered yet');
    }
    return client;
};

/** The revoke as this tab sees it: the next page refetch is answered 401, and so is the refresh. */
const revoke = async (client: QueryClient) => {
    serveRevoked();
    await act(() => client.refetchQueries({ queryKey: groupsKeys.all }).catch(() => undefined));
};

beforeAll(() => {
    // What `initializeApi` wires: an unauthorized session ends in `expireSession`.
    initChipInApiInterceptors(() => {
        useAuthStore.getState().expireSession();
    });
    startCacheRestore(undefined);
});

beforeEach(async () => {
    await i18n.changeLanguage('en');
    probe.routers.length = 0;
    probe.clients.length = 0;
    serveSignedIn();
    // A signed-in user of this tab, saved on the device: the persisted client from the start.
    LocalStorage.remove(LS_KEY_USER);
    saveLocalUser({ id: USER_ID, role: 'USER', settings });
    establishAuthSession(accessToken(USER_ID));
    resetSessionSelfLoad();
    useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
    window.history.replaceState(null, '', GROUP_PATH);
});

afterEach(() => {
    window.history.replaceState(null, '', '/');
    invalidateAuthSession();
});

/** Renders the app at the group page and opens the settle-up dialog ("Choose a debt"). */
const openSettleUp = async () => {
    const view = render(<Main />);
    const heading = await screen.findByRole('heading', { name: GROUP_NAME }, { timeout: 3000 });
    const [trigger] = await screen.findAllByRole('button', { name: /settle up/i });
    if (!trigger) {
        throw new Error('No settle-up trigger');
    }
    await waitFor(() => {
        expect(trigger).toHaveProperty('disabled', false);
    });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Choose a debt' });

    return { view, heading, dialog };
};

describe('AUTH-077 a remote session revoke keeps the shown page under the sign-in modal', () => {
    test('AUTH-077: a revoke (refetch 401, refresh 401) keeps the group page and its open settle-up dialog mounted, hidden and inert, on the same client and router, at the same URL', async () => {
        const { heading, dialog } = await openSettleUp();
        const client = currentClient();
        expect(routers()).toHaveLength(1);

        await revoke(client);

        expect(await screen.findByTestId('auth-modal')).toBeTruthy();
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unauthenticated',
            unauthReason: UNAUTH_REASON.EXPIRED,
        });
        expect(hasAuthSessionHint()).toBe(false);
        // The same heading node and the same dialog node are still in the document: nothing
        // remounted (a remount detaches them). By role they are not found any more: hidden, their
        // accessible name is empty.
        expect(heading.isConnected).toBe(true);
        expect(heading.textContent).toBe(GROUP_NAME);
        expect(dialog.isConnected).toBe(true);
        expect(screen.queryByRole('heading', { name: GROUP_NAME })).toBeNull();
        // Hidden from sight and from assistive tech, not reachable.
        const container = heading.closest('[inert]');
        expect(container).not.toBeNull();
        expect(container?.getAttribute('aria-hidden')).toBe('true');
        // `visibility: hidden` comes from the CSS Module on this state (jsdom does not apply it).
        expect(container?.getAttribute('data-hidden')).toBe('true');
        expect(dialog.closest('[inert]')).not.toBeNull();
        // The same QueryClient and the same router, the URL kept.
        expect(currentClient()).toBe(client);
        expect(routers()).toHaveLength(1);
        expect(window.location.pathname).toBe(GROUP_PATH);
    });

    test('AUTH-077: after the revoke a full-page Google sign-in as the same user returns to the group page, with no dialog open', async () => {
        const { view } = await openSettleUp();
        await revoke(currentClient());
        expect(await screen.findByTestId('auth-modal')).toBeTruthy();

        // The Google redirect is a full-page load: the tree (and the open dialog) is gone. The app
        // comes back on the callback with the kept page as its return address.
        view.unmount();
        resetTabUserId();
        resetSessionSelfLoad();
        // A fresh document: the auth store starts unknown, as on any page load.
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });
        server.resetHandlers();
        serveSignedIn();
        server.use(
            http.post('*/auth/oauth/google/exchange', () =>
                HttpResponse.json({ token: accessToken(USER_ID), is_new_user: false }),
            ),
        );
        window.history.replaceState(
            null,
            '',
            `/oauth/callback?code=auth-077-code&returnTo=${encodeURIComponent(GROUP_PATH)}`,
        );
        // Only the expected warning of the disposed pre-sign-in router (AUTH-074) is silenced.
        const originalWarn = console.warn.bind(console);
        const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
            if (args[0] !== 'navigate on a disposed router is ignored') {
                originalWarn(...args);
            }
        });

        try {
            render(<Main />);

            const heading = await screen.findByRole(
                'heading',
                { name: GROUP_NAME },
                { timeout: 3000 },
            );
            expect(window.location.pathname).toBe(GROUP_PATH);
            expect(useAuthStore.getState().status).toBe('authenticated');
            expect(screen.queryByRole('dialog')).toBeNull();
            expect(screen.queryByTestId('auth-modal')).toBeNull();
            expect(heading.closest('[inert]')).toBeNull();
        } finally {
            warn.mockRestore();
        }
    });
});
