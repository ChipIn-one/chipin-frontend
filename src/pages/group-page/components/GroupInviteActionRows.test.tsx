import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group } from 'api/chipin.types';

import GroupInviteActionRows from './GroupInviteActionRows';

const mocks = vi.hoisted(() => ({
    onShare: vi.fn(() => Promise.resolve()),
    onCopyLink: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('hooks/pwaHooks', () => ({
    useGroupInvite: () => ({
        inviteLink: 'https://chipin.one/invite/group-1',
        isNativeShareSupported: true,
        isShareDone: false,
        isCopied: false,
        qr: {
            title: 'group:qr.title',
            accessibleDescription: 'group:qr.description',
            description: 'group:qr.joinDescription',
            subtitle: 'group:page.settings.showQRSubtitle',
        },
        onShare: mocks.onShare,
        onCopyLink: mocks.onCopyLink,
    }),
}));


const creator = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group = {
    id: 'group-1',
    name: 'Vietnam',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

beforeEach(() => {
    vi.clearAllMocks();
});

test('renders the same three invite actions used in group settings', () => {
    render(
        <Theme>
            <GroupInviteActionRows group={group} />
        </Theme>,
    );

    expect(screen.getByRole('button', {
        name: /common:buttons\.invitePeople/,
    })).not.toBeNull();
    const copyInviteButton = screen.getByRole('button', {
        name: /group:page\.settings\.copyLinkTitle/,
    });

    expect(copyInviteButton).not.toBeNull();
    expect(copyInviteButton.textContent).toContain('group:page.shareWarning');
    expect(screen.getByRole('button', {
        name: /group:page\.settings\.showQRTitle/,
    })).not.toBeNull();
});

test('keeps share and copy behavior in the shared rows', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <GroupInviteActionRows group={group} />
        </Theme>,
    );

    return user
        .click(screen.getByRole('button', {
            name: /common:buttons\.invitePeople/,
        }))
        .then(() => {
            expect(mocks.onShare).toHaveBeenCalledOnce();

            return user.click(screen.getByRole('button', {
                name: /group:page\.settings\.copyLinkTitle/,
            }));
        })
        .then(() => {
            expect(mocks.onCopyLink).toHaveBeenCalledOnce();
        });
});
