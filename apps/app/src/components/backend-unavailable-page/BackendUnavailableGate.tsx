import type { ReactNode } from 'react';

import { useConnectivityStore } from 'store/connectivityStore';

import { BackendUnavailablePage } from './BackendUnavailablePage';
import { AppContent } from './styled';

interface BackendUnavailableGateProps {
    children: ReactNode;
}

const BackendUnavailableGate = ({ children }: BackendUnavailableGateProps) => {
    // Only a confirmed backend outage blocks the app; offline is the non-blocking OfflineBanner.
    const isUnavailable = useConnectivityStore(state => state.mode === 'backend-down');

    return (
        <>
            <AppContent
                $isUnavailable={isUnavailable}
                aria-hidden={isUnavailable}
                inert={isUnavailable}
            >
                {children}
            </AppContent>
            {isUnavailable && <BackendUnavailablePage />}
        </>
    );
};

export { BackendUnavailableGate };
