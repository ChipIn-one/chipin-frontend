import { matchPath } from 'react-router-dom';

import { ROUTES } from 'constants/routes';

// The pages with a breadcrumb back to their parent page.
const BREADCRUMB_PARENTS = [
    { path: `${ROUTES.ACTIVITY}/:parentActivityId`, parentPath: ROUTES.ACTIVITY },
] as const;

const getPreferredModeRoute = (isSoloModeByDefault: boolean): string =>
    isSoloModeByDefault ? ROUTES.SOLO : ROUTES.DASHBOARD;

const isNavigationRouteActive = (pathname: string, href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

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

const getBreadcrumbParentPath = (pathname: string): string | null => {
    const match = BREADCRUMB_PARENTS.find(({ path }) => matchPath({ path, end: true }, pathname));

    return match?.parentPath ?? null;
};

export {
    getBreadcrumbParentPath,
    getHasDesktopSidebar,
    getPreferredModeRoute,
    isNavigationRouteActive,
};
