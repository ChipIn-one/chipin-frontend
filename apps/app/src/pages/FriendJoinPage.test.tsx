import { Theme } from '@radix-ui/themes';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ROUTES } from 'constants/routes';
import { clearLocalUserIdentity } from 'helpers/localStorage';
import { i18n } from 'i18n';
import { useAuthStore } from 'store/authStore';
import { loadSelfUserForSession, resetSessionSelfLoad } from 'store/sessionUser';
import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import { FriendJoinPage } from './FriendJoinPage';

const mocks = vi.hoisted(() => ({
    authSessionVersion: 1,
    acceptFriendInvite: vi.fn<(params: { inviteToken: unknown }) => Promise<typeof FRIEND>>(),
}));

const FRIEND = {
    id: 'friend-1',
    email: 'alex@example.com',
    displayName: 'Alex',
    createdAt: 1,
    updatedAt: 1,
};

vi.mock('helpers/authSession', () => ({
    getAuthSessionVersion: () => mocks.authSessionVersion,
    isAuthSessionCurrent: (version: number) => version === mocks.authSessionVersion,
}));

vi.mock('components/modals/auth-modal', () => ({
    AuthModal: () => <div data-testid="auth-modal" />,
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const CurrentRoute = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

const OPEN_OTHER_INVITE_LABEL = 'Open other invite';
const OTHER_INVITE_TOKEN = 'ZyXwVuTsRqPoNmLkJiHgFeDcBa987654';

const OpenOtherInvite = () => {
    const navigate = useNavigate();

    return (
        <button
            type="button"
            onClick={() => void navigate(`${ROUTES.FRIENDS_JOIN}/${OTHER_INVITE_TOKEN}`)}
        >
            {OPEN_OTHER_INVITE_LABEL}
        </button>
    );
};

const renderPage = (inviteToken = TEST_INVITE_TOKEN) =>
    render(
        <MemoryRouter initialEntries={[`${ROUTES.FRIENDS_JOIN}/${inviteToken}`]}>
            <Theme>
                <Routes>
                    <Route
                        path={`${ROUTES.FRIENDS_JOIN}/:inviteToken`}
                        element={<FriendJoinPage />}
                    />
                    <Route path="*" element={null} />
                </Routes>
                <CurrentRoute />
                <OpenOtherInvite />
            </Theme>
        </MemoryRouter>,
    );

const joinButton = () => screen.getByRole('button', { name: i18n.t('friends:join.confirm') });
const currentRoute = () => screen.getByLabelText('Current route').textContent;

const apiError = (status: number) => ({ isAxiosError: true, response: { status, data: {} } });

const server = setupMswServer();

const failureStatus = (error: unknown): number | undefined => {
    const response: unknown = Reflect.get(Object(error), 'response');
    const status: unknown = Reflect.get(Object(response), 'status');

    return typeof status === 'number' ? status : undefined;
};

// The real accept (`POST /users/invite/{token}`) on the signed-in user's client: the handler
// answers with what `mocks.acceptFriendInvite` resolves; a rejection with a `response.status` is
// that status, any other one a network error.
beforeEach(() => {
    vi.clearAllMocks();
    mocks.authSessionVersion = 1;
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    mountAsUserClient();
    server.use(
        http.post('*/users/invite/:inviteToken', ({ params }) =>
            Promise.resolve()
                .then(() => mocks.acceptFriendInvite({ inviteToken: params.inviteToken }))
                .then(
                    friend => HttpResponse.json(friend),
                    (error: unknown) => {
                        const status = failureStatus(error);

                        return status === undefined
                            ? HttpResponse.error()
                            : HttpResponse.json({}, { status });
                    },
                ),
        ),
    );
    return i18n.changeLanguage('en');
});

test('does not call the API on mount and does not focus the join button', () => {
    const user = userEvent.setup();

    renderPage();

    expect(screen.getByRole('heading', { name: i18n.t('friends:join.title') })).toBeTruthy();
    expect(screen.getByText(i18n.t('friends:join.description'))).toBeTruthy();
    expect(document.activeElement).not.toBe(joinButton());

    return user.keyboard('{Enter}').then(() => {
        expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();
    });
});

test('accepts exactly once, shows the friend name and opens Friends', () => {
    const user = userEvent.setup();
    let resolveInvite: ((friend: typeof FRIEND) => void) | undefined;
    mocks.acceptFriendInvite.mockImplementation(
        () =>
            new Promise(resolve => {
                resolveInvite = resolve;
            }),
    );

    renderPage();

    return user
        .click(joinButton())
        .then(() => user.click(joinButton()))
        .then(() => {
            expect(mocks.acceptFriendInvite).toHaveBeenCalledTimes(1);
            expect(mocks.acceptFriendInvite).toHaveBeenCalledWith({
                inviteToken: TEST_INVITE_TOKEN,
            });

            return act(() => {
                resolveInvite?.(FRIEND);
                return Promise.resolve();
            });
        })
        .then(() => {
            expect(toast.success).toHaveBeenCalledWith(
                i18n.t('toasts:friend.inviteAcceptedWithName', { name: 'Alex' }),
            );
            expect(currentRoute()).toBe(ROUTES.FRIENDS);
        });
});

test('cancel goes to the dashboard without calling the API', () => {
    const user = userEvent.setup();

    renderPage();

    return user
        .click(screen.getByRole('button', { name: i18n.t('friends:join.cancel') }))
        .then(() => {
            expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();
            expect(currentRoute()).toBe(ROUTES.DASHBOARD);
        });
});

test('shows the invalid screen for a malformed token without calling the API', () => {
    const user = userEvent.setup();

    renderPage('short');

    expect(screen.getByRole('heading', { name: i18n.t('friends:join.invalidTitle') })).toBeTruthy();
    expect(screen.getByText(i18n.t('friends:join.invalidDescription'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: i18n.t('friends:join.confirm') })).toBeNull();

    return user
        .click(screen.getByRole('button', { name: i18n.t('friends:join.goHome') }))
        .then(() => {
            expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();
            expect(currentRoute()).toBe(ROUTES.DASHBOARD);
        });
});

test('shows the invalid screen when the backend does not know the token', () => {
    const user = userEvent.setup();
    mocks.acceptFriendInvite.mockRejectedValue(apiError(404));

    renderPage();

    return user.click(joinButton()).then(() => {
        expect(
            screen.getByRole('heading', { name: i18n.t('friends:join.invalidTitle') }),
        ).toBeTruthy();
        expect(toast.error).not.toHaveBeenCalled();
    });
});

test.each([
    ['409', apiError(409)],
    ['network', { isAxiosError: true }],
])('shows the error screen on a %s failure and retries exactly once', (_name, error) => {
    const user = userEvent.setup();
    mocks.acceptFriendInvite.mockRejectedValueOnce(error).mockResolvedValueOnce(FRIEND);

    renderPage();

    return user
        .click(joinButton())
        .then(() => {
            expect(screen.getByRole('alert').textContent).toBe(
                i18n.t('toasts:friend.inviteJoinError'),
            );
            expect(toast.error).not.toHaveBeenCalled();

            return user.click(screen.getByRole('button', { name: i18n.t('friends:join.retry') }));
        })
        .then(() => {
            expect(mocks.acceptFriendInvite).toHaveBeenCalledTimes(2);
            expect(currentRoute()).toBe(ROUTES.FRIENDS);
        });
});

test('releases the loading state but does not navigate after the auth session changes', () => {
    const user = userEvent.setup();
    let resolveInvite: ((friend: typeof FRIEND) => void) | undefined;
    mocks.acceptFriendInvite.mockImplementation(
        () =>
            new Promise(resolve => {
                resolveInvite = resolve;
            }),
    );

    renderPage();

    return user
        .click(joinButton())
        .then(() => {
            mocks.authSessionVersion += 1;

            return act(() => {
                resolveInvite?.(FRIEND);
                return Promise.resolve();
            });
        })
        .then(() => {
            expect(currentRoute()).toBe(`${ROUTES.FRIENDS_JOIN}/${TEST_INVITE_TOKEN}`);
            expect(joinButton().hasAttribute('disabled')).toBe(false);
        });
});

test('opening another invite on the same page starts from the ready screen', () => {
    const user = userEvent.setup();
    mocks.acceptFriendInvite.mockRejectedValue(apiError(404));

    renderPage();

    return user
        .click(joinButton())
        .then(() => {
            expect(
                screen.getByRole('heading', { name: i18n.t('friends:join.invalidTitle') }),
            ).toBeTruthy();

            return user.click(screen.getByRole('button', { name: OPEN_OTHER_INVITE_LABEL }));
        })
        .then(() => {
            expect(currentRoute()).toBe(`${ROUTES.FRIENDS_JOIN}/${OTHER_INVITE_TOKEN}`);
            expect(
                screen.getByRole('heading', { name: i18n.t('friends:join.title') }),
            ).toBeTruthy();
            expect(joinButton().hasAttribute('disabled')).toBe(false);
        });
});

test('ignores a join response after the page unmounts', () => {
    const user = userEvent.setup();
    let resolveInvite: ((friend: typeof FRIEND) => void) | undefined;
    mocks.acceptFriendInvite.mockImplementation(
        () =>
            new Promise(resolve => {
                resolveInvite = resolve;
            }),
    );

    const { unmount } = renderPage();

    return user
        .click(joinButton())
        .then(() => {
            unmount();

            return act(() => {
                resolveInvite?.(FRIEND);
                return Promise.resolve();
            });
        })
        .then(() => {
            expect(mocks.acceptFriendInvite).toHaveBeenCalledTimes(1);
            expect(screen.queryByLabelText('Current route')).toBeNull();
        });
});

// The signed-out and expired-session cases under the auth guard: `app/router/joinPagesAuth.test.tsx`.

// Issue #730: before `/users/self` answers the page still runs on the anonymous client, where a
// join is refused. The page is rendered on `pageClient`; a new `key` remounts it, as the app does
// when the session load reveals the user.
const renderOnClient = (pageClient: QueryClient, key: string) => (
    <MemoryRouter initialEntries={[`${ROUTES.FRIENDS_JOIN}/${TEST_INVITE_TOKEN}`]}>
        <Theme>
            <QueryClientProvider key={key} client={pageClient}>
                <Routes>
                    <Route
                        path={`${ROUTES.FRIENDS_JOIN}/:inviteToken`}
                        element={<FriendJoinPage />}
                    />
                    <Route path="*" element={null} />
                </Routes>
            </QueryClientProvider>
            <CurrentRoute />
        </Theme>
    </MemoryRouter>
);

afterEach(() => {
    resetSessionSelfLoad();
    clearLocalUserIdentity();
});

test('USR-003 the join button waits for the session, then joins', async () => {
    const user = userEvent.setup();
    mocks.acceptFriendInvite.mockResolvedValue(FRIEND);
    const userClient = mountAsUserClient();

    const { rerender } = render(renderOnClient(createTestQueryClient(), 'anonymous'));

    // The regression guard is `disabled`: on master the button was enabled, and the click was
    // refused before any request, so the no-request check below passes there too.
    expect(joinButton().hasAttribute('disabled')).toBe(true);
    await user.click(joinButton());
    expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();

    rerender(renderOnClient(userClient, 'user-1'));

    expect(joinButton().hasAttribute('disabled')).toBe(false);
    await user.click(joinButton());
    await waitFor(() => {
        expect(currentRoute()).toBe(ROUTES.FRIENDS);
    });
    expect(mocks.acceptFriendInvite).toHaveBeenCalledTimes(1);
});

test('USR-003 a failed first-sign-in account load shows an error whose Retry loads it again', async () => {
    const user = userEvent.setup();
    let selfRequests = 0;
    // A first sign-in: no stored user id, so a failed load leaves the page on the anonymous client.
    clearLocalUserIdentity();
    server.use(
        http.get('*/users/self', () => {
            selfRequests += 1;
            return HttpResponse.json({}, { status: 500 });
        }),
    );
    mocks.acceptFriendInvite.mockResolvedValue(FRIEND);
    const userClient = mountAsUserClient();

    const { rerender } = render(renderOnClient(createTestQueryClient(), 'anonymous'));
    await act(() => loadSelfUserForSession());

    expect(screen.getByRole('alert').textContent).toBe(i18n.t('friends:join.sessionLoadError'));

    await user.click(screen.getByRole('button', { name: i18n.t('friends:join.retry') }));
    await waitFor(() => {
        expect(selfRequests).toBe(2);
    });
    await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toBe(i18n.t('friends:join.sessionLoadError'));
    });
    expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();

    // A load that succeeds remounts the page onto the user's client: Join works there.
    rerender(renderOnClient(userClient, 'user-1'));

    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(joinButton());
    await waitFor(() => {
        expect(currentRoute()).toBe(ROUTES.FRIENDS);
    });
    expect(mocks.acceptFriendInvite).toHaveBeenCalledTimes(1);
});
