import type { AuthService } from 'constants/auth.types';
import type { UrlParams } from 'constants/url.types';

import { getChipInApiUrl } from './env';

export const getUrlParam = (name: UrlParams) => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(name);
};

export const getSocialAuthUrl = (provider: AuthService) => {
    const apiUrl = getChipInApiUrl();

    return `${apiUrl}auth/login/${provider}?redirect_to=${window.location.origin}`;
};
