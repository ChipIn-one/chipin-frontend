import { useEffect, useState } from 'react';

import { MEDIA_QUERIES } from 'constants/breakpoints';

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(
        () => window.matchMedia(MEDIA_QUERIES.belowSm).matches,
    );

    useEffect(() => {
        const mq = window.matchMedia(MEDIA_QUERIES.belowSm);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return isMobile;
};
