import { useEffect, useState } from 'react';

import { MEDIA_QUERIES } from 'constants/breakpoints';

// A test environment without `matchMedia` (jsdom) reads the desktop layout, as `ChipInLoader` and
// the appearance store read "no preference" there.
const belowSmQuery = (): MediaQueryList | null =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(MEDIA_QUERIES.belowSm)
        : null;

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => belowSmQuery()?.matches ?? false);

    useEffect(() => {
        const mq = belowSmQuery();
        if (!mq) {
            return;
        }
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return isMobile;
};
