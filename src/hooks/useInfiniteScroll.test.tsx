import { renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import { useInfiniteScroll } from './useInfiniteScroll';

const sentinelRef = vi.fn();
let isIntersecting = false;

vi.mock('hooks/useIntersectionObserver', () => ({
    useIntersectionObserver: () => [sentinelRef, { isIntersecting }],
}));

beforeEach(() => {
    vi.clearAllMocks();
    isIntersecting = false;
});

test('loads the next page when the sentinel enters the viewport', () => {
    const onLoadMore = vi.fn<() => void>();
    const { rerender, result } = renderHook(() =>
        useInfiniteScroll({
            hasMore: true,
            isLoading: false,
            onLoadMore,
        }),
    );

    expect(result.current).toBe(sentinelRef);
    expect(onLoadMore).not.toHaveBeenCalled();

    isIntersecting = true;
    rerender();

    expect(onLoadMore).toHaveBeenCalledOnce();
});

test('re-arms pagination after a completed load while the sentinel stays visible', () => {
    const onLoadMore = vi.fn<() => void>();
    let isLoading = false;
    const { rerender } = renderHook(() =>
        useInfiniteScroll({
            hasMore: true,
            isLoading,
            onLoadMore,
        }),
    );

    isIntersecting = true;
    rerender();

    expect(onLoadMore).toHaveBeenCalledOnce();

    isLoading = true;
    rerender();
    isLoading = false;
    rerender();

    expect(onLoadMore).toHaveBeenCalledTimes(2);
});

test('does not re-arm pagination when the completed request removes eligibility', () => {
    const onLoadMore = vi.fn<() => void>();
    let hasMore = true;
    let isLoading = false;
    const { rerender } = renderHook(() =>
        useInfiniteScroll({
            hasMore,
            isLoading,
            onLoadMore,
        }),
    );

    isIntersecting = true;
    rerender();
    isLoading = true;
    rerender();

    hasMore = false;
    isLoading = false;
    rerender();

    expect(onLoadMore).toHaveBeenCalledOnce();
});

test.each([
    {
        hasMore: false,
        isLoading: false,
    },
    {
        hasMore: true,
        isLoading: true,
    },
])(
    'does not load when hasMore is $hasMore and isLoading is $isLoading',
    ({ hasMore, isLoading }) => {
        const onLoadMore = vi.fn<() => void>();
        isIntersecting = true;

        renderHook(() =>
            useInfiniteScroll({
                hasMore,
                isLoading,
                onLoadMore,
            }),
        );

        expect(onLoadMore).not.toHaveBeenCalled();
    },
);

test('does not retry a failed load on rerender while the sentinel stays visible', () => {
    const onLoadMore = vi.fn<() => void>();
    isIntersecting = true;

    // A fresh callback on every render re-runs the effect, so only the trigger guard prevents a retry.
    const { rerender } = renderHook(() =>
        useInfiniteScroll({
            hasMore: true,
            isLoading: false,
            onLoadMore: () => onLoadMore(),
        }),
    );

    // The load failed before any loading state was published: nothing re-arms the trigger.
    rerender();
    rerender();

    expect(onLoadMore).toHaveBeenCalledOnce();
});

test('re-arms when a page was loaded although the answer arrived before any loading render', () => {
    const onLoadMore = vi.fn<() => void>();
    let loadedKey = 1;
    const { rerender } = renderHook(() =>
        useInfiniteScroll({ hasMore: true, isLoading: false, onLoadMore, loadedKey }),
    );

    isIntersecting = true;
    rerender();
    expect(onLoadMore).toHaveBeenCalledOnce();

    // The next render already has the new page: `isLoading` was never seen true.
    loadedKey = 2;
    rerender();
    expect(onLoadMore).toHaveBeenCalledTimes(2);

    // Nothing was loaded since: a plain rerender does not trigger again.
    rerender();
    expect(onLoadMore).toHaveBeenCalledTimes(2);
});

test('a loaded page that ends the feed, or a load still running, does not trigger', () => {
    const onLoadMore = vi.fn<() => void>();
    let loadedKey = 1;
    let hasMore = true;
    let isLoading = false;
    const { rerender } = renderHook(() =>
        useInfiniteScroll({ hasMore, isLoading, onLoadMore, loadedKey }),
    );

    isIntersecting = true;
    rerender();
    expect(onLoadMore).toHaveBeenCalledOnce();

    // A page arrives while another fetch (a refetch) still runs: the trigger waits for it.
    loadedKey = 2;
    isLoading = true;
    rerender();
    expect(onLoadMore).toHaveBeenCalledOnce();

    // The last page: nothing more to load.
    loadedKey = 3;
    isLoading = false;
    hasMore = false;
    rerender();
    expect(onLoadMore).toHaveBeenCalledOnce();
});
