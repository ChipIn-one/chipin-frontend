import type { ReactNode } from 'react';

import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import { BackendUnavailablePage } from './BackendUnavailablePage';
import { AppContent } from './styled';

interface BackendUnavailableGateProps {
    children: ReactNode;
}

const BackendUnavailableGate = ({ children }: BackendUnavailableGateProps) => {
    const isUnavailable = useBackendAvailabilityStore(state => state.isUnavailable);

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
