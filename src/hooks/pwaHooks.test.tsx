import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import type { Group } from 'api/chipin.types';
import { SECOND } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';

import { useCheckOnlineStatus, useFriendInvite, useGroupInvite } from './pwaHooks';

const networkState = vi.hoisted(() => ({
    online: true as boolean | undefined,
}));

const hookMocks = vi.hoisted(() => ({
    copyTextToClipboard: vi.fn(
        (): Promise<'copied' | 'unsupported'> => Promise.resolve('copied'),
    ),
    detectNativeShare: vi.fn(() => false),
    shareInvite: vi.fn(
        (): Promise<'shared' | 'copied' | 'cancelled' | 'unsupported'> =>
            Promise.resolve('shared'),
    ),
}));

vi.mock('@uidotdev/usehooks', () => ({
    useNetworkState: () => networkState,
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
    networkState.online = true;
});

test('does not show a connection toast on initial online render', () => {
    renderHook(() => useCheckOnlineStatus());

    expect(vi.mocked(toast.warning)).not.toHaveBeenCalled();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
});

test('does not show a connection toast on initial offline render', () => {
    networkState.online = false;

    renderHook(() => useCheckOnlineStatus());

    expect(vi.mocked(toast.warning)).not.toHaveBeenCalled();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
});

test('shows the persistent offline warning only after an online to offline transition', () => {
    const { rerender } = renderHook(() => useCheckOnlineStatus());

    networkState.online = false;
    rerender();

    expect(vi.mocked(toast.warning)).toHaveBeenCalledOnce();
    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
        'toasts:common.disconnect',
        {
            description: 'toasts:common.disconnectDescription',
            duration: Infinity,
            id: TOASTS_IDS.connectionStatus,
        },
    );
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
});

test('replaces the offline warning after an offline to online transition', () => {
    networkState.online = false;
    const { rerender } = renderHook(() => useCheckOnlineStatus());

    networkState.online = true;
    rerender();

    expect(vi.mocked(toast.success)).toHaveBeenCalledOnce();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'toasts:common.reconnected',
        {
            description: null,
            duration: SECOND * 4,
            icon: null,
            id: TOASTS_IDS.connectionStatus,
        },
    );
    expect(vi.mocked(toast.dismiss)).not.toHaveBeenCalled();
});

test('does not repeat connection feedback while the state is unchanged', () => {
    const { rerender } = renderHook(() => useCheckOnlineStatus());

    networkState.online = false;
    rerender();
    rerender();

    expect(vi.mocked(toast.warning)).toHaveBeenCalledOnce();

    networkState.online = true;
    rerender();
    rerender();

    expect(vi.mocked(toast.success)).toHaveBeenCalledOnce();
});

test('replaces share feedback timer and clears the pending timer on unmount', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onShare({ title: 'Trip', text: 'Share expenses' })))
        .then(() => {
            expect(result.current.isShareDone).toBe(true);
            expect(setTimeoutSpy).toHaveBeenCalledWith(
                expect.any(Function),
                SECOND * 1.5,
            );

            return Promise.resolve(act(() => result.current.onShare({ title: 'Trip', text: 'Share expenses' })));
        })
        .then(() => {
            const clearedBeforeUnmount = clearTimeoutSpy.mock.calls.length;
            expect(clearedBeforeUnmount).toBeGreaterThanOrEqual(1);

            unmount();

            expect(clearTimeoutSpy).toHaveBeenCalledTimes(clearedBeforeUnmount + 1);
        });
});

test('shows copied feedback when native sharing falls back to clipboard', () => {
    hookMocks.shareInvite.mockResolvedValueOnce('copied');
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(
        act(() => result.current.onShare({
            title: 'Trip',
            text: 'Share expenses',
        })),
    ).then(() => {
        expect(result.current.isCopied).toBe(true);
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
            'toasts:group.inviteLinkCopied',
        );
    });
});

test('shows copied feedback after a successful invite link copy', () => {
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onCopyLink())).then(() => {
        expect(hookMocks.copyTextToClipboard).toHaveBeenCalledWith(
            expect.stringContaining(group.inviteToken),
        );
        expect(result.current.isCopied).toBe(true);
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
            'toasts:group.inviteLinkCopied',
        );
        expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    });
});

test('shows an error and keeps copied feedback off when invite link copy fails', () => {
    hookMocks.copyTextToClipboard.mockResolvedValueOnce('unsupported');
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onCopyLink())).then(() => {
        expect(result.current.isCopied).toBe(false);
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
            'toasts:group.inviteLinkCopyError',
        );
        expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
    });
});


test('builds and copies the personal friend invite link', () => {
    const { result } = renderHook(() => useFriendInvite('friend-invite-token'));

    return Promise.resolve(act(() => result.current.onCopyLink())).then(() => {
        expect(hookMocks.copyTextToClipboard).toHaveBeenCalledWith(
            expect.stringContaining('/friends/join/friend-invite-token'),
        );
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
            'toasts:friend.inviteLinkCopied',
        );
    });
});

test('clears the pending copy feedback timer on unmount', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onCopyLink())).then(() => {
        expect(result.current.isCopied).toBe(true);
        expect(setTimeoutSpy).toHaveBeenCalledWith(
            expect.any(Function),
            SECOND * 1.5,
        );

        const clearedBeforeUnmount = clearTimeoutSpy.mock.calls.length;
        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalledTimes(clearedBeforeUnmount + 1);
    });
});
