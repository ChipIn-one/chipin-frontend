import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { useExpenseModalStore } from 'store/expenseModalStore';

import { ExpenseDirectNoFriendState } from './ExpenseDirectNoFriendState';

import 'i18n/index';

interface SelfMock {
    user: { inviteToken: string } | null;
    isLoading: boolean;
    refetch: () => Promise<void>;
}

const self = vi.hoisted((): SelfMock => ({
    user: null,
    isLoading: false,
    refetch: vi.fn(() => Promise.resolve()),
}));

const invite = vi.hoisted(() => ({
    onShare: vi.fn(() => Promise.resolve()),
    onCopyLink: vi.fn(() => Promise.resolve()),
}));

vi.mock('hooks/useSelfUser', () => ({
    useSelfUserState: () => ({
        user: self.user,
        isLoading: self.isLoading,
        refetch: self.refetch,
    }),
}));

vi.mock('hooks/pwaHooks', () => ({
    useFriendInvite: () => ({
        inviteLink: '',
        isNativeShareSupported: false,
        isShareDone: false,
        isCopied: false,
        qr: { title: '', accessibleDescription: '', description: '', subtitle: '' },
        onShare: invite.onShare,
        onCopyLink: invite.onCopyLink,
    }),
}));

const currentUser = { id: 'self', displayName: 'You', picture: null };

beforeEach(() => {
    vi.clearAllMocks();
    self.user = null;
    self.isLoading = false;
    useExpenseModalStore.getState().reset();
    useExpenseModalStore.getState().initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [],
    });
    useExpenseModalStore.getState().setTargetMode('friends');
});

const renderState = () =>
    render(
        <Theme>
            <ExpenseDirectNoFriendState />
        </Theme>,
    );

test('EXP-067 without an invite token the explanation stays and Retry reloads the self user', async () => {
    renderState();

    expect(screen.getByText('No friends for a direct expense yet')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Invite a friend' })).toBeNull();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    expect(vi.mocked(self.refetch)).toHaveBeenCalledTimes(1);
    expect(invite.onCopyLink).not.toHaveBeenCalled();
    expect(invite.onShare).not.toHaveBeenCalled();
});

test('EXP-067 with an invite token the invite is the action, not Retry', () => {
    self.user = { inviteToken: 'invite-token-user' };
    renderState();

    expect(screen.getByRole('button', { name: 'Invite a friend' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
});
