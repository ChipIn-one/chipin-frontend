import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group } from 'api/chipin.types';

import GroupInviteEmptyState from './GroupInviteEmptyState';

const mocks = vi.hoisted(() => ({
    isNativeShareSupported: true,
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
        isNativeShareSupported: mocks.isNativeShareSupported,
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
    mocks.isNativeShareSupported = true;
});

test('shares from the primary invite button when native share is supported', () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <GroupInviteEmptyState group={group} />
        </Theme>,
    );

    expect(screen.getByText('page.expenses.inviteTitle')).toBeTruthy();
    expect(screen.getByText('page.expenses.shareVia')).toBeTruthy();
    expect(screen.getByRole('button', {
        name: /group:page\.settings\.showQRTitle/,
    })).toBeTruthy();

    return user
        .click(screen.getByRole('button', { name: 'page.expenses.inviteAction' }))
        .then(() => {
            expect(mocks.onShare).toHaveBeenCalledOnce();
            expect(mocks.onCopyLink).not.toHaveBeenCalled();
        });
});

test('copies the invite link from the primary button when native share is unavailable', () => {
    const user = userEvent.setup();
    mocks.isNativeShareSupported = false;

    render(
        <Theme>
            <GroupInviteEmptyState group={group} />
        </Theme>,
    );

    return user
        .click(screen.getByRole('button', { name: 'page.expenses.inviteAction' }))
        .then(() => {
            expect(mocks.onCopyLink).toHaveBeenCalledOnce();
            expect(mocks.onShare).not.toHaveBeenCalled();
        });
});

test('uses the same illustrated invite layout as Friends with the group-specific link', () => {
    render(
        <Theme>
            <GroupInviteEmptyState group={group} />
        </Theme>,
    );

    const illustration = document.querySelector('img[aria-hidden="true"]');
    expect(illustration).toBeTruthy();
    expect(screen.getByRole('button', { name: 'page.expenses.inviteAction' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /group:page\.settings\.showQRTitle/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'group:page.settings.copyLinkTitle' })).toBeTruthy();
});
