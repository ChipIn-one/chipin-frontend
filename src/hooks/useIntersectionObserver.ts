import { useCallback, useEffect, useState } from 'react';

export type IntersectionObserverRef = (node: Element | null) => void;

/**
 * Observes the element passed to the returned callback ref and exposes its
 * latest IntersectionObserverEntry (null until the first observation).
 */
export const useIntersectionObserver = ({
    root = null,
    rootMargin = '0px',
    threshold = 0,
}: IntersectionObserverInit = {}): [IntersectionObserverRef, IntersectionObserverEntry | null] => {
    const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
    const [node, setNode] = useState<Element | null>(null);
    const thresholdKey = Array.isArray(threshold) ? threshold.join(',') : String(threshold);

    const ref = useCallback<IntersectionObserverRef>(nextNode => {
        setNode(nextNode);
    }, []);

    useEffect(() => {
        if (node === null || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const observer = new IntersectionObserver(
            ([nextEntry]) => {
                setEntry(nextEntry ?? null);
            },
            { root, rootMargin, threshold: thresholdKey.split(',').map(Number) },
        );

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [node, root, rootMargin, thresholdKey]);

    return [ref, entry];
};
