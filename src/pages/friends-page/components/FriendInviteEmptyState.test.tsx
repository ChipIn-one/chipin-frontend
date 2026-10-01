import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FriendInviteEmptyState from './FriendInviteEmptyState';

const mocks = vi.hoisted(() => ({
    isNativeShareSupported: false,
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

vi.mock('./FriendInviteActionRows', () => ({
    default: () => <div data-testid="friend-invite-actions" />,
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativeShareSupported = false;
});

test('reuses the group invite onboarding copy and personal invite behavior', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <FriendInviteEmptyState />
        </Theme>,
    );

    expect(screen.getByText('group:page.expenses.inviteTitle')).toBeTruthy();
    expect(screen.getByText('group:page.expenses.inviteDescription')).toBeTruthy();
    expect(screen.getByTestId('friend-invite-actions')).toBeTruthy();

    return user
        .click(screen.getByRole('button', { name: 'group:page.expenses.inviteAction' }))
        .then(() => {
            expect(mocks.onCopyLink).toHaveBeenCalledOnce();
        });
});
