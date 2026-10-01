import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FriendsPageHeader from './FriendsPageHeader';

const mocks = vi.hoisted(() => ({
    isNativeShareSupported: true,
    onCopyLink: vi.fn(() => Promise.resolve()),
    onShare: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('store/users-store', () => ({
    useUsersStore: (selector: (state: {
        user: { inviteToken: string };
    }) => unknown) => selector({
        user: { inviteToken: 'friend-token' },
    }),
}));

vi.mock('hooks/pwaHooks', () => ({
    useFriendInvite: () => ({
        inviteLink: 'https://chipin.one/friends/join/friend-token',
        isNativeShareSupported: mocks.isNativeShareSupported,
        isShareDone: false,
        isCopied: false,
        onShare: mocks.onShare,
        onCopyLink: mocks.onCopyLink,
    }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativeShareSupported = true;
});

test('shares the personal invite from Add friend on supported mobile devices', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <FriendsPageHeader isLoading={false} />
        </Theme>,
    );

    return user.click(screen.getByRole('button', { name: /common:buttons.addFriend/ }))
        .then(() => {
            expect(mocks.onShare).toHaveBeenCalledWith({
                title: 'friends:invite.shareTitle',
                text: 'friends:invite.shareText',
            });
            expect(mocks.onCopyLink).not.toHaveBeenCalled();
        });
});

test('copies the personal invite from Add friend when native share is unavailable', () => {
    const user = userEvent.setup();
    mocks.isNativeShareSupported = false;

    render(
        <Theme>
            <FriendsPageHeader isLoading={false} />
        </Theme>,
    );

    return user.click(screen.getByRole('button', { name: /common:buttons.addFriend/ }))
        .then(() => {
            expect(mocks.onCopyLink).toHaveBeenCalledOnce();
            expect(mocks.onShare).not.toHaveBeenCalled();
        });
});
