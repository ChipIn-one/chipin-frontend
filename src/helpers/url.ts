import { ApiGroup } from 'types/api';

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

    return `${apiUrl}auth/login/${provider}?redirect_to=${window.location.origin}`;
};

export const buildGroupInviteLink = ({
    groupId,
    inviteToken,
}: {
    groupId: ApiGroup['id'];
    inviteToken: ApiGroup['inviteToken'];
}): string => {
    const baseUrl = getChipInAppUrl();

    const url = new URL(`${ROUTES.GROUP}/${groupId}`, baseUrl);
    url.searchParams.set('inviteToken', inviteToken);

    return url.toString();
};
