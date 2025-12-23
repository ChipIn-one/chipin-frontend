import type { AuthService } from 'constants/auth.types';
import { ROUTES } from 'constants/routes';
import type { UrlParams } from 'constants/url.types';

import { getChipInApiUrl, getChipInAppUrl } from './env';

export const getUrlParam = (name: UrlParams) => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(name);
};

export const getSocialAuthUrl = (provider: AuthService) => {
    const apiUrl = getChipInApiUrl();

    const { origin, pathname, search } = window.location;

    // If user is on home page, redirect to dashboard after auth, otherwise stay on the same page
    const redirectPath = pathname === ROUTES.HOME ? ROUTES.DASHBOARD : `${pathname}${search}`;

    const redirectTo = encodeURIComponent(`${origin}${redirectPath}`);

    return `${apiUrl}auth/login/${provider}?redirect_to=${redirectTo}`;
};

export const buildGroupInviteLink = ({ inviteToken }: { inviteToken: string }) =>
    `${getChipInAppUrl()}${ROUTES.GROUP_JOIN}/${inviteToken}`;
