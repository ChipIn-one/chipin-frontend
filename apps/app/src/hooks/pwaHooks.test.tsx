import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { SECOND } from 'constants/time';
import type { Group } from 'entities/groups';
import { usePwaStore } from 'store/pwaStore';

import { useCheckPwa, useFriendInvite, useGroupInvite } from './pwaHooks';

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
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('toasts:group.inviteLinkCopyError', {
            action: { label: 'toasts:common.copyLinkAction', onClick: expect.any(Function) },
        });
        expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
    });
});

interface ToastActionOptions {
    action: { label: string; onClick: () => void };
}

const readCopyRetryAction = (): ToastActionOptions['action'] => {
    const options = vi.mocked(toast.error).mock.calls[0]?.[1] as ToastActionOptions | undefined;

    if (!options) {
        throw new Error('The copy error toast has no action');
    }

    return options.action;
};

test('DSH-015 offers a Copy link action when the share sheet fails and the copy fallback fails', () => {
    hookMocks.shareInvite.mockResolvedValueOnce('unsupported');
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onShare())).then(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('toasts:group.inviteLinkCopyError', {
            action: { label: 'toasts:common.copyLinkAction', onClick: expect.any(Function) },
        });
        expect(result.current.isCopied).toBe(false);
    });
});

test('DSH-015 copies the invite link again from the toast action and shows copied feedback', () => {
    hookMocks.copyTextToClipboard.mockResolvedValueOnce('unsupported');
    const { result } = renderHook(() => useFriendInvite('friend-invite-token'));

    return Promise.resolve(act(() => result.current.onCopyLink()))
        .then(() => {
            const action = readCopyRetryAction();
            expect(action.label).toBe('toasts:common.copyLinkAction');

            return act(() => {
                action.onClick();

                return Promise.resolve();
            });
        })
        .then(() => {
            expect(hookMocks.copyTextToClipboard).toHaveBeenCalledTimes(2);
            expect(hookMocks.copyTextToClipboard).toHaveBeenLastCalledWith(
                expect.stringContaining('/friends/join/friend-invite-token'),
            );
            expect(vi.mocked(toast.success)).toHaveBeenCalledWith('toasts:friend.inviteLinkCopied');
            expect(result.current.isCopied).toBe(true);
        });
});

test('DSH-015 shows the copy error without an action when the toast action copy fails again', () => {
    hookMocks.shareInvite.mockResolvedValueOnce('unsupported');
    hookMocks.copyTextToClipboard.mockResolvedValueOnce('unsupported');
    const { result } = renderHook(() => useGroupInvite(group));

    return Promise.resolve(act(() => result.current.onShare()))
        .then(() =>
            act(() => {
                readCopyRetryAction().onClick();

                return Promise.resolve();
            }),
        )
        .then(() => {
            expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(2);
            expect(vi.mocked(toast.error)).toHaveBeenLastCalledWith(
                'toasts:group.inviteLinkCopyError',
            );
            expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
            expect(result.current.isCopied).toBe(false);
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

// #758: the legacy hosts are not installable as the app, so their landing never stores the install
// prompt (the hero and CTA install buttons stay hidden); every other host keeps the install flow.
const pwaStoreActions = {
    setIsPwaInstalled: vi.fn(),
    setPwaInstallPrompt: vi.fn(),
};
const pwaStoreState: Parameters<Parameters<typeof usePwaStore>[0]>[0] = {
    isPwaInstalled: false,
    pwaInstallPrompt: null,
    isSwUpdateAvailable: false,
    setIsSwUpdateAvailable: vi.fn(),
    callPWAInstall: vi.fn(() => Promise.resolve()),
    ...pwaStoreActions,
};

const renderCheckPwaOn = (hostname: string) => {
    vi.stubGlobal('location', { ...window.location, hostname });
    vi.mocked(usePwaStore).mockImplementation(selector => selector(pwaStoreState));
    return renderHook(() => useCheckPwa());
};

const fireBeforeInstallPrompt = () => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    window.dispatchEvent(event);
    return event;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

test.each(['chipin.one', 'dev.chipin.one'])(
    'on the legacy host %s ignores beforeinstallprompt',
    hostname => {
        const { unmount } = renderCheckPwaOn(hostname);

        const event = fireBeforeInstallPrompt();

        expect(pwaStoreActions.setPwaInstallPrompt).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
        unmount();
    },
);

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'on %s stores the install prompt, as before',
    hostname => {
        const { unmount } = renderCheckPwaOn(hostname);

        const event = fireBeforeInstallPrompt();

        expect(pwaStoreActions.setPwaInstallPrompt).toHaveBeenCalledExactlyOnceWith(event);
        expect(event.defaultPrevented).toBe(true);
        unmount();
        fireBeforeInstallPrompt();
        expect(pwaStoreActions.setPwaInstallPrompt).toHaveBeenCalledOnce();
    },
);

test.each(['chipin.one', 'app.chipin.one'])('on %s still records appinstalled', hostname => {
    const { unmount } = renderCheckPwaOn(hostname);

    window.dispatchEvent(new Event('appinstalled'));

    expect(pwaStoreActions.setIsPwaInstalled).toHaveBeenCalledExactlyOnceWith(true);
    expect(pwaStoreActions.setPwaInstallPrompt).toHaveBeenCalledExactlyOnceWith(null);
    unmount();
});
