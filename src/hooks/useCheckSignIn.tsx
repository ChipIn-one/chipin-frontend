import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { LS_KEY_AUTH_SESSION_HINT } from 'constants/localstorage';
import { ROUTES } from 'constants/routes';
import { invalidateAuthSession } from 'helpers/authSession';
import { hasAuthSessionHint } from 'helpers/localStorage';
import { selectAuthStatus } from 'store/authSelectors';
import { AUTH_STATUS, UNAUTH_REASON } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';
import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/users-store';

export const useCheckSignIn = () => {
    const location = useLocation();
    const status = useAuthStore(selectAuthStatus);
    const isBackendUnavailable = useBackendAvailabilityStore(
        state => state.isUnavailable,
    );
    const { fetchSetDashboardData, setDefaultAppMode } = useDashboardStore(
        useShallow(state => ({
            fetchSetDashboardData: state.fetchSetDashboardData,
            setDefaultAppMode: state.setDefaultAppMode,
        })),
    );
    const fetchSetGroups = useGroupsStore(s => s.fetchSetGroups);
    const { fetchSetUser, fetchSetFriends, hasCachedUser } = useUsersStore(
        useShallow(state => ({
            fetchSetUser: state.fetchSetUser,
            fetchSetFriends: state.fetchSetFriends,
            hasCachedUser: state.localUser !== null,
        })),
    );
    const setAuthenticated = useAuthStore(s => s.setAuthenticated);
    const setUnauthenticated = useAuthStore(s => s.setUnauthenticated);
    const refreshAuthTokens = useAuthStore(s => s.refreshAuthTokens);

    useEffect(() => {
        const onStorage = (event: StorageEvent): void => {
            const didRemoveSessionHint =
                event.key === LS_KEY_AUTH_SESSION_HINT && event.newValue !== 'true';
            const didClearStorage = event.key === null && !hasAuthSessionHint();

            if (!didRemoveSessionHint && !didClearStorage) {
                return;
            }

            invalidateAuthSession();
            useAuthStore.getState().setUnauthenticated(UNAUTH_REASON.SIGNED_OUT);
        };

        window.addEventListener('storage', onStorage);

        return () => {
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    useEffect(() => {
        if (
            location.pathname === ROUTES.OAUTH_CALLBACK ||
            status !== AUTH_STATUS.UNKNOWN ||
            isBackendUnavailable
        ) {
            return;
        }

        if (!hasAuthSessionHint()) {
            setUnauthenticated(UNAUTH_REASON.MISSING);
            return;
        }

        refreshAuthTokens()
            .then(() => {
                setAuthenticated();
                return Promise.all([
                    fetchSetDashboardData(),
                    fetchSetGroups(),
                    fetchSetUser().then(user => {
                        if (user && !hasCachedUser) {
                            setDefaultAppMode(user.settings.soloModeByDefault);
                        }
                    }),
                    fetchSetFriends(),
                ]).then(() => undefined);
            })
            .catch(() => {
                if (useBackendAvailabilityStore.getState().isUnavailable) {
                    return;
                }

                if (useAuthStore.getState().status === AUTH_STATUS.UNKNOWN) {
                    setUnauthenticated(UNAUTH_REASON.ERROR);
                }
            });
    }, [
        fetchSetDashboardData,
        fetchSetFriends,
        fetchSetGroups,
        fetchSetUser,
        hasCachedUser,
        isBackendUnavailable,
        location.pathname,
        refreshAuthTokens,
        setAuthenticated,
        setDefaultAppMode,
        setUnauthenticated,
        status,
    ]);
};
