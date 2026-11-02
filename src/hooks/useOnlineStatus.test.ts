import { afterEach, expect, test, vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import { useOnlineStatus } from './useOnlineStatus';

const setNavigatorOnline = (online: boolean): void => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
};

afterEach(() => {
    vi.restoreAllMocks();
});

test('reads the initial browser network state', () => {
    setNavigatorOnline(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
});

test('updates on offline and online events', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);

    act(() => {
        setNavigatorOnline(false);
        window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);

    act(() => {
        setNavigatorOnline(true);
        window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
});

test('removes its listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
});
