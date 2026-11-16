import { AUTH_API_PATH, AUTH_CSRF_HEADERS } from './auth.constants';
import { apiInstance } from './chipin.instance';
import type { ApiOAuthTokenPairResponse, ApiRefreshTokenPairResponse } from './chipin.types';

// =============== AUTH ===============

export const refreshApiAuthTokens = (): Promise<ApiRefreshTokenPairResponse> => {
    return apiInstance
        .post<ApiRefreshTokenPairResponse>(AUTH_API_PATH.REFRESH, undefined, {
            headers: AUTH_CSRF_HEADERS,
        })
        .then(response => response.data);
};

export const logoutApiAuthTokens = (): Promise<void> => {
    return apiInstance
        .post(AUTH_API_PATH.LOGOUT, undefined, {
            headers: AUTH_CSRF_HEADERS,
        })
        .then(() => undefined);
};

export const exchangeApiGoogleOAuthCode = (code: string): Promise<ApiOAuthTokenPairResponse> => {
    return apiInstance
        .post<ApiOAuthTokenPairResponse>(AUTH_API_PATH.GOOGLE_OAUTH_EXCHANGE, { code })
        .then(response => response.data);
};
