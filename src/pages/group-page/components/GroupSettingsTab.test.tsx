import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group, SelfUser } from 'api/chipin.types';
import type { GroupsStore } from 'store/groupsStore';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import GroupSettingsTab from './GroupSettingsTab';

const translations: Record<string, string> = {
    'common:buttons.invitePeople': 'Invite people',
    'common:buttons.kickMember': 'Kick member',
    'common:buttons.leaveGroup': 'Leave group',
    'common:buttons.removeGroup': 'Remove group',
    'common:copy.copied': 'Copied',
    'common:copy.shared': 'Shared',
    'group:page.membersTab.you': 'You',
    'group:page.settings.addPeopleSubtitle': 'Invite by name or email',
    'group:page.settings.addPeopleTitle': 'Add people',
    'group:page.settings.copyLinkTitle': 'Copy invite link',
    'group:page.settings.inviteSection': 'INVITE',
    'group:page.settings.membersSection': 'MEMBERS',
    'group:page.settings.settingsSection': 'SETTINGS',
    'group:page.settings.showQRSubtitle': 'Scan to join the group',
    'group:page.settings.showQRTitle': 'Show QR code',
    'group:page.settings.simplifyDebtsOwnerOnly': 'Only the group owner can change this setting.',
    'group:page.settings.simplifyDebtsSubtitle': 'Minimize the number of transactions',
    'group:page.settings.simplifyDebtsTitle': 'Simplify group debts',
    'group:page.settings.simplifyDebtsUnsupported':
        'Debt simplification is unavailable for this group.',
    'group:page.settings.simplifyDebtsUpdating': 'Updating debt simplification...',
    'group:page.shareWarning': 'Share the invite link only with trusted people.',
    'toasts:common.requestFailed': 'Request failed',
    'toasts:group.updateError': 'Could not update the group.',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => translations[key] ?? key,
    }),
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

vi.mock('hooks/pwaHooks', () => ({
    useGroupInvite: () => ({
        inviteLink: 'https://chipin.example/invite-token',
        isNativeShareSupported: false,
        isShareDone: false,
        isCopied: false,
        handleShare: () => Promise.resolve(),
        handleCopyLink: () => Promise.resolve(),
    }),
}));

vi.mock('components/modals', () => {
    const PassThrough = ({ children }: { children?: ReactNode }) => children;

    return {
        GroupQRModal: PassThrough,
        KickGroupMemberAlertDialog: PassThrough,
        LeaveGroupAlertDialog: PassThrough,
        RemoveGroupAlertDialog: PassThrough,
    };
});

const owner: SelfUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'user-invite-token',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
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
};

const ownerSummary = {
    id: owner.id,
    email: owner.email,
    displayName: owner.displayName,
    picture: owner.picture,
    createdAt: owner.createdAt,
    updatedAt: owner.updatedAt,
};

const group: Group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'group-invite-token',
    description: 'Trip expenses',
    creator: ownerSummary,
    members: [{ user: ownerSummary, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
};

beforeEach(() => {
    vi.clearAllMocks();
    useGroupsStore.getState().setInitialGroupsStore();
    useLoadingStore.getState().setInitialLoadingStore();
    useUsersStore.setState({ user: owner });
});

test('lets the owner toggle simplify debts through the store action', () => {
    const user = userEvent.setup();
    const updateGroup = vi.fn<GroupsStore['updateGroup']>().mockResolvedValue({
        ...group,
        simplifyDebts: false,
    });
    useGroupsStore.setState({ updateGroup });

    render(<GroupSettingsTab group={group} />);

    return user.click(screen.getByRole('switch', { name: 'Simplify group debts' })).then(() => {
        expect(updateGroup).toHaveBeenCalledWith({ simplifyDebts: false });
    });
});

test('shows the setting as disabled for a group member', () => {
    const memberGroup = { ...group, role: 'MEMBER' as const };

    render(<GroupSettingsTab group={memberGroup} />);

    expect(screen.getByRole('switch', { name: 'Simplify group debts' })).toHaveProperty(
        'disabled',
        true,
    );
    expect(screen.getByText('Only the group owner can change this setting.')).toBeTruthy();
});

test('disables the setting and exposes loading feedback while the update is pending', () => {
    useLoadingStore.getState().setLoading('group', 'update', 'loading');

    render(<GroupSettingsTab group={group} />);

    expect(screen.getByRole('switch', { name: 'Simplify group debts' })).toHaveProperty(
        'disabled',
        true,
    );
    expect(screen.getByText('Updating debt simplification...')).toBeTruthy();
});

test('disables the setting and explains an unsupported runtime response', () => {
    const unsupportedGroup = {
        ...group,
        simplifyDebts: undefined,
    } as unknown as Group;

    render(<GroupSettingsTab group={unsupportedGroup} />);

    expect(screen.getByRole('switch', { name: 'Simplify group debts' })).toHaveProperty(
        'disabled',
        true,
    );
    expect(
        screen.getByText('Debt simplification is unavailable for this group.'),
    ).toBeTruthy();
});

test('shows one localized toast and keeps the confirmed value after update failure', () => {
    const user = userEvent.setup();
    const updateGroup = vi.fn<GroupsStore['updateGroup']>().mockRejectedValue(
        new Error('Update failed'),
    );
    useGroupsStore.setState({ updateGroup });

    render(<GroupSettingsTab group={group} />);

    return user
        .click(screen.getByRole('switch', { name: 'Simplify group debts' }))
        .then(() => waitFor(() => {
            expect(updateGroup).toHaveBeenCalledOnce();
            expect(toast.error).toHaveBeenCalledOnce();
            expect(toast.error).toHaveBeenCalledWith('Could not update the group.');
            expect(
                screen
                    .getByRole('switch', { name: 'Simplify group debts' })
                    .getAttribute('aria-checked'),
            ).toBe('true');
        }));
});
