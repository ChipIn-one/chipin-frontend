import type { AuthService } from 'constants/auth.types';
import { ROUTES } from 'constants/routes';

import { getChipInApiUrl, getChipInAppUrl } from './env';

export const resolveOAuthReturnTo = (returnTo: string | null): string => {
    if (!returnTo) {
        return ROUTES.HOME;
    }

    try {
        const url = new URL(returnTo, window.location.origin);
        const isOAuthCallback =
            url.pathname === ROUTES.OAUTH_CALLBACK ||
            url.pathname === `${ROUTES.OAUTH_CALLBACK}/`;

        if (url.origin !== window.location.origin || isOAuthCallback) {
            return ROUTES.HOME;
        }

        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return ROUTES.HOME;
    }
};

export const getSocialAuthUrl = (provider: AuthService) => {
    const apiUrl = getChipInApiUrl();

    const { origin, pathname, search, hash } = window.location;

    const returnTo =
        pathname === ROUTES.HOME ? ROUTES.DASHBOARD : `${pathname}${search}${hash}`;
    const callbackUrl = new URL(ROUTES.OAUTH_CALLBACK, origin);
    callbackUrl.searchParams.set('returnTo', returnTo);

    const redirectTo = encodeURIComponent(callbackUrl.toString());

    return `${apiUrl}auth/login/${provider}?redirect_to=${redirectTo}`;
};

export const buildGroupInviteLink = ({ inviteToken }: { inviteToken: string }) =>
    `${getChipInAppUrl()}${ROUTES.GROUP_JOIN}/${inviteToken}`;

export const buildActivitySubeventsRoute = (parentActivityId: string) =>
    `${ROUTES.ACTIVITY}/${parentActivityId}`;
