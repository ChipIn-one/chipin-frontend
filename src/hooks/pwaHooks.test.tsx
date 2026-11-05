import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import type { Group } from 'api/chipin.types';
import { SECOND } from 'constants/time';

import { useFriendInvite, useGroupInvite } from './pwaHooks';

const hookMocks = vi.hoisted(() => ({
    copyTextToClipboard: vi.fn((): Promise<'copied' | 'unsupported'> => Promise.resolve('copied')),
    detectNativeShare: vi.fn(() => false),
    shareInvite: vi.fn((): Promise<'shared' | 'copied' | 'cancelled' | 'unsupported'> =>
        Promise.resolve('shared'),
    ),
}));

vi.mock('helpers/clipboard', () => ({
    copyTextToClipboard: hookMocks.copyTextToClipboard,
}));

vi.mock('helpers/share', () => ({
    detectNativeShare: hookMocks.detectNativeShare,
    shareInvite: hookMocks.shareInvite,
}));

vi.mock('i18next', () => ({
    default: {
        t: (key: string) => key,
    },
}));

vi.mock('sonner', () => ({
    toast: {
        dismiss: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock('store/pwaStore', () => ({
    usePwaStore: vi.fn(),
}));

const group: Group = {
    id: 'group-id',
    name: 'Trip',
    inviteToken: 'invite-token',
    description: null,
    creator: {
        id: 'owner-id',
        email: 'owner@example.com',
        displayName: 'Owner',
        createdAt: 1,
        updatedAt: 1,
    },
    members: [],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
};

beforeEach(() => {
    vi.clearAllMocks();
    hookMocks.copyTextToClipboard.mockResolvedValue('copied');
});

test('replaces share feedback timer and clears the pending timer on unmount', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onShare()))
        .then(() => {
            expect(result.current.isShareDone).toBe(true);
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), SECOND * 1.5);

            return Promise.resolve(act(() => result.current.onShare()));
        })
        .then(() => {
            const clearedBeforeUnmount = clearTimeoutSpy.mock.calls.length;
            expect(clearedBeforeUnmount).toBeGreaterThanOrEqual(1);

            unmount();

            expect(clearTimeoutSpy).toHaveBeenCalledTimes(clearedBeforeUnmount + 1);
        });
});

test('uses the configured group share copy', () => {
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onShare())).then(() => {
        expect(hookMocks.shareInvite).toHaveBeenCalledWith({
            url: expect.stringContaining(group.inviteToken),
            title: 'group:qr.shareTitle',
            text: 'group:qr.shareText',
        });
        expect(result.current.qr).toEqual({
            title: 'group:qr.title',
            accessibleDescription: 'group:qr.description',
            description: 'group:qr.joinDescription',
            subtitle: 'group:page.settings.showQRSubtitle',
        });
    });
});

test('shows copied feedback when native sharing falls back to clipboard', () => {
    hookMocks.shareInvite.mockResolvedValueOnce('copied');
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onShare())).then(() => {
        expect(result.current.isCopied).toBe(true);
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith('toasts:group.inviteLinkCopied');
    });
});

test('shows copied feedback after a successful invite link copy', () => {
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onCopyLink())).then(() => {
        expect(hookMocks.copyTextToClipboard).toHaveBeenCalledWith(
            expect.stringContaining(group.inviteToken),
        );
        expect(result.current.isCopied).toBe(true);
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith('toasts:group.inviteLinkCopied');
        expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    });
});

test('shows an error and keeps copied feedback off when invite link copy fails', () => {
    hookMocks.copyTextToClipboard.mockResolvedValueOnce('unsupported');
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onCopyLink())).then(() => {
        expect(result.current.isCopied).toBe(false);
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('toasts:group.inviteLinkCopyError');
        expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
    });
});

test('uses friend-specific share and QR copy', () => {
    const { result } = renderHook(() => useFriendInvite('friend-invite-token'));

    return Promise.resolve(act(() => result.current.onShare())).then(() => {
        expect(hookMocks.shareInvite).toHaveBeenCalledWith({
            url: expect.stringContaining('/friends/join/friend-invite-token'),
            title: 'friends:invite.shareTitle',
            text: 'friends:invite.shareText',
        });
        expect(result.current.qr).toEqual({
            title: 'friends:invite.qrTitle',
            accessibleDescription: 'friends:invite.qrDescription',
            description: 'friends:invite.qrJoinDescription',
            subtitle: 'friends:invite.showQRSubtitle',
        });
    });
});

test('builds and copies the personal friend invite link', () => {
    const { result } = renderHook(() => useFriendInvite('friend-invite-token'));

    return Promise.resolve(act(() => result.current.onCopyLink())).then(() => {
        expect(hookMocks.copyTextToClipboard).toHaveBeenCalledWith(
            expect.stringContaining('/friends/join/friend-invite-token'),
        );
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith('toasts:friend.inviteLinkCopied');
    });
});

test('clears the pending copy feedback timer on unmount', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onCopyLink())).then(() => {
        expect(result.current.isCopied).toBe(true);
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), SECOND * 1.5);

        const clearedBeforeUnmount = clearTimeoutSpy.mock.calls.length;
        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalledTimes(clearedBeforeUnmount + 1);
    });
});
