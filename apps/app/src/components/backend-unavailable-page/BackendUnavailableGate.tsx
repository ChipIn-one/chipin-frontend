import type { ReactNode } from 'react';

import { useConnectivityStore } from 'store/connectivityStore';

import { BackendUnavailablePage } from './BackendUnavailablePage';

import styles from './BackendUnavailableGate.module.css';

interface BackendUnavailableGateProps {
    children: ReactNode;
}

const BackendUnavailableGate = ({ children }: BackendUnavailableGateProps) => {
    // Only a confirmed backend outage blocks the app; offline is the non-blocking OfflineBanner.
    const isUnavailable = useConnectivityStore(state => state.mode === 'backend-down');

    return (
        <>
            <div
                className={styles.root}
                data-unavailable={isUnavailable}
                aria-hidden={isUnavailable}
                inert={isUnavailable}
            >
                {children}
            </div>
            {isUnavailable && <BackendUnavailablePage />}
        </>
    );
};

export { BackendUnavailableGate };
