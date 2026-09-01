import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { selectCanAccessSolo, useUsersStore } from 'store/users-store';

const useSyncAppMode = () => {
    const location = useLocation();
    const canAccessSolo = useUsersStore(selectCanAccessSolo);
    const { appMode, setAppMode } = useDashboardStore(
        useShallow(state => ({
            appMode: state.appMode,
            setAppMode: state.setAppMode,
        })),
    );

    useEffect(() => {
        if (location.pathname === ROUTES.SOLO) {
            const nextAppMode = canAccessSolo ? APP_MODES.SOLO : APP_MODES.GROUP;

            if (appMode !== nextAppMode) {
                setAppMode(nextAppMode);
            }

            return;
        }

        if (location.pathname === ROUTES.DASHBOARD && appMode !== APP_MODES.GROUP) {
            setAppMode(APP_MODES.GROUP);
        }
    }, [appMode, canAccessSolo, location.pathname, setAppMode]);
};

export { useSyncAppMode };
