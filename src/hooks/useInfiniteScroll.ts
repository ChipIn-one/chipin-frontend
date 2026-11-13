import { useEffect, useRef } from 'react';

import {
    type IntersectionObserverRef,
    useIntersectionObserver,
} from 'hooks/useIntersectionObserver';

interface UseInfiniteScrollParams {
    hasMore: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    /**
     * Changes whenever a page was loaded (the loaded page count). A loaded page re-arms the
     * trigger by itself: the answer may arrive before any render saw `isLoading` (TanStack
     * notifies through a timer), and then no loading render is there to re-arm it.
     */
    loadedKey: string | number;
}

type InfiniteScrollRef = IntersectionObserverRef;

const useInfiniteScroll = ({
    hasMore,
    isLoading,
    onLoadMore,
    loadedKey,
}: UseInfiniteScrollParams): InfiniteScrollRef => {
    const [sentinelRef, sentinelEntry] = useIntersectionObserver({
        threshold: 0,
    });
    const hasTriggeredRef = useRef(false);
    const wasLoadingRef = useRef(false);
    const loadedKeyRef = useRef(loadedKey);

    useEffect(() => {
        const hasLoadedPage = loadedKeyRef.current !== loadedKey;

        loadedKeyRef.current = loadedKey;

        if (!sentinelEntry?.isIntersecting) {
            hasTriggeredRef.current = false;
            wasLoadingRef.current = false;
            return;
        }

        if (isLoading) {
            wasLoadingRef.current = true;
            return;
        }

        // A failed load re-arms too once its loading render was seen. The callers keep the trigger
        // stopped until their Retry by passing `hasMore: hasMore && !isNextPageError`.
        if (wasLoadingRef.current || hasLoadedPage) {
            wasLoadingRef.current = false;
            hasTriggeredRef.current = false;
        }

        if (!hasMore || hasTriggeredRef.current) {
            return;
        }

        hasTriggeredRef.current = true;
        onLoadMore();
    }, [sentinelEntry?.isIntersecting, hasMore, isLoading, onLoadMore, loadedKey]);

    return sentinelRef;
};

export { type InfiniteScrollRef, useInfiniteScroll };
