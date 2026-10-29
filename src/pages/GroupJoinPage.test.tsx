import i18n from 'i18n';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';

import { ProtectedRoute } from 'features/routing/ProtectedRoute';

import GroupJoinPage from './GroupJoinPage';

const mocks = vi.hoisted(() => ({
    authSessionVersion: 1,
    joinGroup: vi.fn(),
}));

vi.mock('store/groupsStore', () => ({
    useGroupsStore: () => ({ joinGroup: mocks.joinGroup }),
}));

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
        <button type="button" onClick={() => navigate(`${ROUTES.GROUP_JOIN}/${OTHER_INVITE_TOKEN}`)}>
            {OPEN_OTHER_INVITE_LABEL}
        </button>
    );
};

const renderPage = (inviteToken = TEST_INVITE_TOKEN, isProtected = false) => render(
    <MemoryRouter initialEntries={[`${ROUTES.GROUP_JOIN}/${inviteToken}`]}>
        <Theme>
            <Routes>
                <Route
                    path={`${ROUTES.GROUP_JOIN}/:inviteToken`}
                    element={isProtected
                        ? <ProtectedRoute><GroupJoinPage /></ProtectedRoute>
                        : <GroupJoinPage />}
                />
                <Route path="*" element={null} />
            </Routes>
            <CurrentRoute />
            <OpenOtherInvite />
        </Theme>
    </MemoryRouter>,
);

const joinButton = () => screen.getByRole('button', { name: i18n.t('group:join.confirm') });
const currentRoute = () => screen.getByLabelText('Current route').textContent;

const apiError = (status: number) => ({ isAxiosError: true, response: { status, data: {} } });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.authSessionVersion = 1;
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    return i18n.changeLanguage('en');
});

test('does not call the API on mount and does not focus the join button', () => {
    const user = userEvent.setup();

    renderPage();

    expect(screen.getByRole('heading', { name: i18n.t('group:join.title') })).toBeTruthy();
    expect(screen.getByText(i18n.t('group:join.description'))).toBeTruthy();
    expect(document.activeElement).not.toBe(joinButton());

    return user.keyboard('{Enter}').then(() => {
        expect(mocks.joinGroup).not.toHaveBeenCalled();
    });
});

test('joins exactly once and opens the group', () => {
    const user = userEvent.setup();
    let resolveJoin: ((group: { id: string }) => void) | undefined;
    mocks.joinGroup.mockImplementation(() => new Promise(resolve => {
        resolveJoin = resolve;
    }));

    renderPage();

    return user.click(joinButton())
        .then(() => user.click(joinButton()))
        .then(() => {
            expect(mocks.joinGroup).toHaveBeenCalledTimes(1);
            expect(mocks.joinGroup).toHaveBeenCalledWith({ inviteToken: TEST_INVITE_TOKEN });

            return act(() => {
                resolveJoin?.({ id: 'group-1' });
                return Promise.resolve();
            });
        })
        .then(() => {
            expect(currentRoute()).toBe(`${ROUTES.GROUP}/group-1`);
        });
});

test('cancel goes to the dashboard without calling the API', () => {
    const user = userEvent.setup();

    renderPage();

    return user.click(screen.getByRole('button', { name: i18n.t('group:join.cancel') })).then(() => {
        expect(mocks.joinGroup).not.toHaveBeenCalled();
        expect(currentRoute()).toBe(ROUTES.DASHBOARD);
    });
});

test('shows the invalid screen for a malformed token without calling the API', () => {
    const user = userEvent.setup();

    renderPage('short');

    expect(screen.getByRole('heading', { name: i18n.t('group:join.invalidTitle') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: i18n.t('group:join.confirm') })).toBeNull();

    return user.click(screen.getByRole('button', { name: i18n.t('group:join.goHome') })).then(() => {
        expect(mocks.joinGroup).not.toHaveBeenCalled();
        expect(currentRoute()).toBe(ROUTES.DASHBOARD);
    });
});

test('shows the invalid screen when the backend does not know the token', () => {
    const user = userEvent.setup();
    mocks.joinGroup.mockRejectedValue(apiError(404));

    renderPage();

    return user.click(joinButton()).then(() => {
        expect(screen.getByRole('heading', { name: i18n.t('group:join.invalidTitle') })).toBeTruthy();
        expect(toast.error).not.toHaveBeenCalled();
    });
});

test.each([
    ['409', apiError(409)],
    ['network', { isAxiosError: true }],
])('shows the error screen on a %s failure and retries exactly once', (_name, error) => {
    const user = userEvent.setup();
    mocks.joinGroup.mockRejectedValueOnce(error).mockResolvedValueOnce({ id: 'group-1' });

    renderPage();

    return user.click(joinButton())
        .then(() => {
            expect(screen.getByRole('alert').textContent).toBe(i18n.t('toasts:group.inviteJoinError'));
            expect(toast.error).not.toHaveBeenCalled();

            return user.click(screen.getByRole('button', { name: i18n.t('group:join.retry') }));
        })
        .then(() => {
            expect(mocks.joinGroup).toHaveBeenCalledTimes(2);
            expect(currentRoute()).toBe(`${ROUTES.GROUP}/group-1`);
        });
});

test('releases the loading state but does not navigate after the auth session changes', () => {
    const user = userEvent.setup();
    let resolveJoin: ((group: { id: string }) => void) | undefined;
    mocks.joinGroup.mockImplementation(() => new Promise(resolve => {
        resolveJoin = resolve;
    }));

    renderPage();

    return user.click(joinButton())
        .then(() => {
            mocks.authSessionVersion += 1;

            return act(() => {
                resolveJoin?.({ id: 'group-1' });
                return Promise.resolve();
            });
        })
        .then(() => {
            expect(currentRoute()).toBe(`${ROUTES.GROUP_JOIN}/${TEST_INVITE_TOKEN}`);
            expect(joinButton().hasAttribute('disabled')).toBe(false);
        });
});

test('opening another invite on the same page starts from the ready screen', () => {
    const user = userEvent.setup();
    mocks.joinGroup.mockRejectedValue(apiError(404));

    renderPage();

    return user.click(joinButton())
        .then(() => {
            expect(screen.getByRole('heading', { name: i18n.t('group:join.invalidTitle') })).toBeTruthy();

            return user.click(screen.getByRole('button', { name: OPEN_OTHER_INVITE_LABEL }));
        })
        .then(() => {
            expect(currentRoute()).toBe(`${ROUTES.GROUP_JOIN}/${OTHER_INVITE_TOKEN}`);
            expect(screen.getByRole('heading', { name: i18n.t('group:join.title') })).toBeTruthy();
            expect(joinButton().hasAttribute('disabled')).toBe(false);
        });
});

test('ignores a join response after the page unmounts', () => {
    const user = userEvent.setup();
    let resolveJoin: ((group: { id: string }) => void) | undefined;
    mocks.joinGroup.mockImplementation(() => new Promise(resolve => {
        resolveJoin = resolve;
    }));

    const { unmount } = renderPage();

    return user.click(joinButton())
        .then(() => {
            unmount();

            return act(() => {
                resolveJoin?.({ id: 'group-1' });
                return Promise.resolve();
            });
        })
        .then(() => {
            expect(mocks.joinGroup).toHaveBeenCalledTimes(1);
            expect(screen.queryByLabelText('Current route')).toBeNull();
        });
});

// Known hotfix behaviour, changed deliberately by PR 04-2f (`/login?returnTo`).
test('a signed-out user is sent to the landing page and the invite is not joined', () => {
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

    renderPage(TEST_INVITE_TOKEN, true);

    expect(currentRoute()).toBe('/');
    expect(mocks.joinGroup).not.toHaveBeenCalled();
});

test('an expired session shows the auth modal, then the confirmation screen without joining', () => {
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'expired' });

    renderPage(TEST_INVITE_TOKEN, true);

    expect(screen.getByTestId('auth-modal')).toBeTruthy();

    act(() => {
        useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    });

    expect(joinButton()).toBeTruthy();
    expect(mocks.joinGroup).not.toHaveBeenCalled();
});
