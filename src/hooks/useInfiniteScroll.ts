import { useEffect, useRef } from 'react';

import { useIntersectionObserver } from '@uidotdev/usehooks';

interface UseInfiniteScrollParams {
    hasMore: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
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
    const hasTriggeredRef = useRef(false);

    useEffect(() => {
        if (!sentinelEntry?.isIntersecting) {
            hasTriggeredRef.current = false;
            return;
        }

        if (!hasMore || isLoading || hasTriggeredRef.current) {
            return;
        }

        hasTriggeredRef.current = true;
        onLoadMore();
    }, [sentinelEntry?.isIntersecting, hasMore, isLoading, onLoadMore]);

    return sentinelRef;
};

export { type InfiniteScrollRef, useInfiniteScroll };
