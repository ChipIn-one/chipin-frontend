import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { FriendInviteEmptyState } from './FriendInviteEmptyState';

interface SelfUserMock {
    inviteToken: string;
}

const selfMock = vi.hoisted((): { user: SelfUserMock | null } => ({
    user: { inviteToken: 'friend-token' },
}));

const mocks = vi.hoisted(() => ({
    isSelfLoading: false,
    refetchSelf: vi.fn(() => Promise.resolve()),
    isNativeShareSupported: false,
    onCopyLink: vi.fn(() => Promise.resolve()),
    onShare: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('hooks/useSelfUser', () => ({
    useSelfUserState: () => ({
        user: selfMock.user,
        isLoading: mocks.isSelfLoading,
        refetch: mocks.refetchSelf,
    }),
}));

vi.mock('hooks/pwaHooks', () => ({
    useFriendInvite: () => ({
        inviteLink: 'https://chipin.one/friends/join/friend-token',
        isNativeShareSupported: mocks.isNativeShareSupported,
        isShareDone: false,
        isCopied: false,
        qr: {
            title: 'friends:invite.qrTitle',
            accessibleDescription: 'friends:invite.qrDescription',
            description: 'friends:invite.qrJoinDescription',
            subtitle: 'friends:invite.showQRSubtitle',
        },
        onShare: mocks.onShare,
        onCopyLink: mocks.onCopyLink,
    }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativeShareSupported = false;
    selfMock.user = { inviteToken: 'friend-token' };
    mocks.isSelfLoading = false;
});

test('reuses the group invite onboarding copy and personal invite behavior', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <FriendInviteEmptyState />
        </Theme>,
    );

    expect(screen.getByText('page.expenses.inviteTitle')).toBeTruthy();
    expect(screen.getByText('page.expenses.inviteDescription')).toBeTruthy();
    expect(
        screen.getByRole('button', {
            name: /group:page\.settings\.showQRTitle/,
        }),
    ).toBeTruthy();

    return user
        .click(screen.getByRole('button', { name: 'page.expenses.inviteAction' }))
        .then(() => {
            expect(mocks.onCopyLink).toHaveBeenCalledOnce();
        });
});

test('USR-013 without an invite token it shows the load error, and Retry reloads the self user', async () => {
    const user = userEvent.setup();
    selfMock.user = null;

    render(
        <Theme>
            <FriendInviteEmptyState />
        </Theme>,
    );

    expect(screen.getByText('inviteLoadErrorTitle')).toBeTruthy();
    expect(screen.getByText('inviteLoadErrorDescription')).toBeTruthy();
    expect(screen.queryByText('page.expenses.inviteTitle')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'retryAction' }));

    expect(mocks.refetchSelf).toHaveBeenCalledOnce();
});

test('USR-013 while the self user loads it shows the skeleton, no error and no onboarding', () => {
    selfMock.user = null;
    mocks.isSelfLoading = true;

    render(
        <Theme>
            <FriendInviteEmptyState />
        </Theme>,
    );

    // FriendsPageSkeleton's placeholder text (the mocked `t` returns the key).
    expect(screen.getAllByText('friendsPage.currency').length).toBeGreaterThan(0);
    expect(screen.queryByText('inviteLoadErrorTitle')).toBeNull();
    expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();
    expect(screen.queryByText('page.expenses.inviteTitle')).toBeNull();
});
