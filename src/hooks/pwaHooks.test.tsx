import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import type { Group } from 'api/chipin.types';
import { SECOND } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';

import { useCheckOnlineStatus, useGroupInvite } from './pwaHooks';

const networkState = vi.hoisted(() => ({
    online: true as boolean | undefined,
}));

const hookMocks = vi.hoisted(() => ({
    copyToClipboard: vi.fn(() => Promise.resolve()),
    detectNativeShare: vi.fn(() => false),
    shareGroupInvite: vi.fn(() => Promise.resolve('shared' as const)),
}));

vi.mock('@uidotdev/usehooks', () => ({
    useCopyToClipboard: () => [undefined, hookMocks.copyToClipboard],
    useNetworkState: () => networkState,
}));

vi.mock('helpers/share', () => ({
    detectNativeShare: hookMocks.detectNativeShare,
    shareGroupInvite: hookMocks.shareGroupInvite,
}));

vi.mock('i18next', () => ({
    default: {
        t: (key: string) => key,
    },
}));

vi.mock('sonner', () => ({
    toast: {
        dismiss: vi.fn(),
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
    networkState.online = true;
});

afterEach(() => {
    vi.useRealTimers();
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
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useGroupInvite(group));

    return act(() => result.current.handleShare('Trip'))
        .then(() => {
            expect(result.current.isShareDone).toBe(true);
            expect(vi.getTimerCount()).toBe(1);

            return act(() => result.current.handleShare('Trip'));
        })
        .then(() => {
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(vi.getTimerCount()).toBe(1);

            unmount();

            expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(vi.getTimerCount()).toBe(0);
        });
});

test('clears the pending copy feedback timer on unmount', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useGroupInvite(group));

    return act(() => result.current.handleCopyLink()).then(() => {
        expect(result.current.isCopied).toBe(true);
        expect(vi.getTimerCount()).toBe(1);

        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });
});
