import { ApiGroup } from 'types/api';

import type { AuthService } from 'constants/auth.types';
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
    inviteToken,
}: {
    inviteToken: ApiGroup['inviteToken'];
}): string => {
    const baseUrl = getChipInAppUrl();

    const inviteUrl = new URL(baseUrl);
    inviteUrl.searchParams.set('inviteToken', inviteToken);

    return inviteUrl.toString();
};
