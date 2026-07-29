import type { AuthService } from 'constants/auth.types';
import { ROUTES } from 'constants/routes';

import { getChipInApiUrl, getChipInAppUrl } from './env';

export const getSocialAuthUrl = (provider: AuthService) => {
    const apiUrl = getChipInApiUrl();

    const { origin, pathname, search, hash } = window.location;

    const isAuthEntryRoute = pathname === ROUTES.HOME || pathname === ROUTES.SIGN_IN;
    const returnTo =
        isAuthEntryRoute ? ROUTES.DASHBOARD : `${pathname}${search}${hash}`;
    const callbackUrl = new URL(ROUTES.OAUTH_CALLBACK, origin);
    callbackUrl.searchParams.set('returnTo', returnTo);

    const redirectTo = encodeURIComponent(callbackUrl.toString());

    return `${apiUrl}auth/login/${provider}?redirect_to=${redirectTo}`;
};

export const buildGroupInviteLink = ({ inviteToken }: { inviteToken: string }) =>
    `${getChipInAppUrl()}${ROUTES.GROUP_JOIN}/${inviteToken}`;

export const buildActivitySubeventsRoute = (parentActivityId: string) =>
    `${ROUTES.ACTIVITY}/${parentActivityId}`;
