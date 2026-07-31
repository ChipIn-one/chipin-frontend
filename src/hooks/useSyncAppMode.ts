import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';

const useSyncAppMode = () => {
    const location = useLocation();
    const { appMode, setAppMode } = useDashboardStore(
        useShallow(state => ({
            appMode: state.appMode,
            setAppMode: state.setAppMode,
        })),
    );

    useEffect(() => {
        if (location.pathname === ROUTES.SOLO && appMode !== APP_MODES.SOLO) {
            setAppMode(APP_MODES.SOLO);
            return;
        }

        if (location.pathname === ROUTES.DASHBOARD && appMode !== APP_MODES.GROUP) {
            setAppMode(APP_MODES.GROUP);
        }
    }, [appMode, location.pathname, setAppMode]);
};

export { useSyncAppMode };
