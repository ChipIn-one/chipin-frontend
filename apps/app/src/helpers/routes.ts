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

/** The invite join pages (group and friend): a bare layout without the bottom bar (#971). */
const getIsInviteJoinRoute = (pathname: string): boolean =>
    Boolean(
        matchPath({ path: `${ROUTES.GROUP_JOIN}/:inviteToken`, end: true }, pathname) ||
        matchPath({ path: `${ROUTES.FRIENDS_JOIN}/:inviteToken`, end: true }, pathname),
    );

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
        !getIsInviteJoinRoute(pathname),
    );
};

const getBreadcrumbParentPath = (pathname: string): string | null => {
    const match = BREADCRUMB_PARENTS.find(({ path }) => matchPath({ path, end: true }, pathname));

    return match?.parentPath ?? null;
};

export {
    getBreadcrumbParentPath,
    getHasDesktopSidebar,
    getIsInviteJoinRoute,
    getPreferredModeRoute,
    isNavigationRouteActive,
};
