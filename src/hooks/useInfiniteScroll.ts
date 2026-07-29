import { useEffect } from 'react';

import { useIntersectionObserver } from '@uidotdev/usehooks';

interface UseInfiniteScrollParams {
    hasMore: boolean;
    isLoading: boolean;
    onLoadMore: () => Promise<void>;
}

type InfiniteScrollRef = ReturnType<typeof useIntersectionObserver>[0];

const useInfiniteScroll = ({
    hasMore,
    isLoading,
    onLoadMore,
}: UseInfiniteScrollParams): InfiniteScrollRef => {
    const [sentinelRef, sentinelEntry] = useIntersectionObserver({
        threshold: 0,
    });

    useEffect(() => {
        if (!sentinelEntry?.isIntersecting || !hasMore || isLoading) {
            return;
        }

        void onLoadMore().catch(() => undefined);
    }, [sentinelEntry?.isIntersecting, hasMore, isLoading, onLoadMore]);

    return sentinelRef;
};

export { type InfiniteScrollRef,useInfiniteScroll };
