import { beforeEach, expect, test, vi } from 'vitest';

import { renderHook } from '@testing-library/react';

import { useInfiniteScroll } from './useInfiniteScroll';

const sentinelRef = vi.fn();
let isIntersecting = false;

vi.mock('@uidotdev/usehooks', () => ({
    useIntersectionObserver: () => [
        sentinelRef,
        { isIntersecting },
    ],
}));

beforeEach(() => {
    vi.clearAllMocks();
    isIntersecting = false;
});

test('loads the next page when the sentinel enters the viewport', () => {
    const onLoadMore = vi.fn(() => Promise.resolve());
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
        const onLoadMore = vi.fn(() => Promise.resolve());
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

test('handles a rejected page request', () => {
    const onLoadMore = vi.fn(() =>
        Promise.reject(new Error('Page unavailable')),
    );
    isIntersecting = true;

    renderHook(() =>
        useInfiniteScroll({
            hasMore: true,
            isLoading: false,
            onLoadMore,
        }),
    );

    expect(onLoadMore).toHaveBeenCalledOnce();
});
