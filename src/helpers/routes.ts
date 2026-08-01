import { matchPath } from 'react-router-dom';

import { ROUTES } from 'constants/routes';

const getPreferredModeRoute = (isSoloModeByDefault: boolean): string =>
    isSoloModeByDefault ? ROUTES.SOLO : ROUTES.DASHBOARD;

const getHasDesktopSidebar = (pathname: string): boolean => {
    if (
        matchPath({ path: ROUTES.DASHBOARD, end: true }, pathname) ||
        matchPath({ path: ROUTES.SOLO, end: true }, pathname) ||
        matchPath({ path: ROUTES.ACTIVITY, end: true }, pathname) ||
        matchPath({ path: ROUTES.FRIENDS, end: true }, pathname) ||
        matchPath({ path: ROUTES.SETTINGS, end: true }, pathname)
    ) {
        return true;
    }

    if (matchPath({ path: `${ROUTES.ACTIVITY}/:parentActivityId`, end: true }, pathname)) {
        return true;
    }

    return Boolean(
        matchPath({ path: `${ROUTES.GROUP}/:groupId`, end: true }, pathname) &&
            !matchPath({ path: `${ROUTES.GROUP_JOIN}/:inviteToken`, end: true }, pathname),
    );
};

export { getHasDesktopSidebar, getPreferredModeRoute };
