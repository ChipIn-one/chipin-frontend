import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import { renderHook } from '@testing-library/react';

import { SECOND } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';

import { useCheckOnlineStatus } from './pwaHooks';

const networkState = vi.hoisted(() => ({
    online: false,
}));

vi.mock('@uidotdev/usehooks', () => ({
    useCopyToClipboard: vi.fn(),
    useNetworkState: () => networkState,
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

beforeEach(() => {
    vi.clearAllMocks();
    networkState.online = false;
});

test('replaces the persistent warning with a temporary success toast', () => {
    const { rerender } = renderHook(() => useCheckOnlineStatus());

    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
        'toasts:common.disconnect',
        expect.objectContaining({ id: TOASTS_IDS.connectionStatus }),
    );

    networkState.online = true;
    rerender();

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
