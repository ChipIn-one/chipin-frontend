// The join pages under the auth guard (spec 04 §2.3): moved from `pages/GroupJoinPage.test.tsx` and
// `pages/FriendJoinPage.test.tsx`, which rendered them under the removed `ProtectedRoute`. The
// layout is `AuthLayout` without its loader: what it renders for the live session. 04-2f (C3-16):
// a join link opened after sign-out goes through `/login` and the OAuth callback back to the
// confirmation screen with its invite token.
import { Theme } from '@radix-ui/themes';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import {
    createMemoryRouter,
    MemoryRouter,
    Route,
    RouterProvider,
    Routes,
    useLocation,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ROUTES } from 'constants/routes';
import { i18n } from 'i18n';
import FriendJoinPage from 'pages/FriendJoinPage';
import GroupJoinPage from 'pages/GroupJoinPage';
import { LoginPage } from 'pages/login-page';
import { OAuthCallbackPage } from 'pages/oauth-callback-page';
import { useAuthStore } from 'store/authStore';
import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import { AuthLayout } from './AuthLayout';

vi.mock('components/modals/auth-modal', () => ({
    AuthModal: () => <div data-testid="auth-modal" />,
}));

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

const CurrentRoute = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname + location.search}</output>;
};

const server = setupMswServer();
const joins = { count: 0 };

const PAGES = [
    {
        name: 'GroupJoinPage',
        Page: GroupJoinPage,
        path: ROUTES.GROUP_JOIN,
        confirm: 'group:join.confirm',
    },
    {
        name: 'FriendJoinPage',
        Page: FriendJoinPage,
        path: ROUTES.FRIENDS_JOIN,
        confirm: 'friends:join.confirm',
    },
] as const;

const renderPage = ({ Page, path }: (typeof PAGES)[number]) =>
    render(
        <MemoryRouter initialEntries={[`${path}/${TEST_INVITE_TOKEN}`]}>
            <Theme>
                <Routes>
                    <Route element={<AuthLayout />}>
                        <Route path={`${path}/:inviteToken`} element={<Page />} />
                    </Route>
                    <Route path="*" element={null} />
                </Routes>
                <CurrentRoute />
            </Theme>
        </MemoryRouter>,
    );

/** Lets a request that the page might have sent reach the msw handler. */
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 20)));

const currentRoute = () => screen.getByLabelText('Current route').textContent;

const realExchange = useAuthStore.getState().exchangeGoogleOAuthCode;

afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ exchangeGoogleOAuthCode: realExchange });
});

beforeEach(() => {
    joins.count = 0;
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    mountAsUserClient();
    server.use(
        http.post('*/groups/invite/:inviteToken', () => {
            joins.count += 1;
            return HttpResponse.json({});
        }),
        http.post('*/users/invite/:inviteToken', () => {
            joins.count += 1;
            return HttpResponse.json({});
        }),
    );
    return i18n.changeLanguage('en');
});

describe.each(PAGES)('$name under AuthLayout', page => {
    // C3-16: the hotfix sent a signed-out user to the landing and lost the token; 04-2f keeps it.
    test('AUTH-075 a signed-out user goes to /login with the invite token in returnTo, no join', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

        renderPage(page);

        expect(currentRoute()).toBe(
            `/login?returnTo=${encodeURIComponent(`${page.path}/${TEST_INVITE_TOKEN}`)}`,
        );
        await settle();
        expect(joins.count).toBe(0);
    });

    test('AUTH-075 after sign-out a join link returns through /login and OAuth to the confirmation screen with its token (C3-16)', async () => {
        const interaction = userEvent.setup();
        const joinPath = `${page.path}/${TEST_INVITE_TOKEN}`;
        const assign = vi.fn();
        vi.stubGlobal('location', { ...window.location, assign });
        useAuthStore.setState({
            status: 'unauthenticated',
            unauthReason: 'signed_out',
            exchangeGoogleOAuthCode: () => {
                useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
                return Promise.resolve();
            },
        });
        const router = createMemoryRouter(
            [
                {
                    element: <AuthLayout />,
                    children: [{ path: `${page.path}/:inviteToken`, element: <page.Page /> }],
                },
                { path: ROUTES.LOGIN, element: <LoginPage /> },
                { path: ROUTES.OAUTH_CALLBACK, element: <OAuthCallbackPage /> },
            ],
            { initialEntries: [joinPath] },
        );
        render(
            <Theme>
                <RouterProvider router={router} />
            </Theme>,
        );

        // The guard: `/login` with the whole join path, token included.
        await waitFor(() => {
            expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
        });
        expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(joinPath);

        // The Google button leaves for the provider with the callback returning to the join path.
        await interaction.click(screen.getByRole('button', { name: 'Sign in with Google' }));
        const authUrl = new URL(String(assign.mock.calls[0]?.[0]));
        const callbackUrl = new URL(authUrl.searchParams.get('redirect_to') ?? '');
        expect(callbackUrl.pathname).toBe(ROUTES.OAUTH_CALLBACK);
        expect(callbackUrl.searchParams.get('returnTo')).toBe(joinPath);

        // The provider sends the browser back to the callback, which signs in and returns.
        await act(() => router.navigate(`${callbackUrl.pathname}${callbackUrl.search}&code=c`));

        expect(await screen.findByRole('button', { name: i18n.t(page.confirm) })).toBeTruthy();
        expect(router.state.location.pathname).toBe(joinPath);
        await settle();
        expect(joins.count).toBe(0);
    });

    test('an expired session shows the auth modal, then the confirmation screen without joining', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });

        renderPage(page);

        expect(screen.getByTestId('auth-modal')).toBeTruthy();

        act(() => {
            useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
        });

        expect(screen.getByRole('button', { name: i18n.t(page.confirm) })).toBeTruthy();
        await settle();
        expect(joins.count).toBe(0);
    });
});
