// The join pages under the auth guard (spec 04 §2.3): moved from `pages/GroupJoinPage.test.tsx` and
// `pages/FriendJoinPage.test.tsx`, which rendered them under the removed `ProtectedRoute`. The
// layout is `AuthLayout` without its loader: what it renders for the live session.
import { Theme } from '@radix-ui/themes';
import { act, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ROUTES } from 'constants/routes';
import { i18n } from 'i18n';
import FriendJoinPage from 'pages/FriendJoinPage';
import GroupJoinPage from 'pages/GroupJoinPage';
import { useAuthStore } from 'store/authStore';
import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import { AuthLayout } from './AuthLayout';

vi.mock('components/modals/auth-modal', () => ({
    AuthModal: () => <div data-testid="auth-modal" />,
}));

const CurrentRoute = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
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
    // Known hotfix behaviour, changed deliberately by PR 04-2f (`/login?returnTo`).
    test('a signed-out user is sent to the landing page and the invite is not joined', async () => {
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'signed_out' });

        renderPage(page);

        expect(currentRoute()).toBe('/');
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
