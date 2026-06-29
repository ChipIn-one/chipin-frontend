import axios from 'axios';
import { toast } from 'sonner';

import { API_ERROR_CODE } from 'constants/errors';
import { SECOND } from 'constants/time';
import { prepareAuthRequest } from 'helpers/authSession';
import { getChipInApiUrl } from 'helpers/env';
import { type ApiErrorPayload, resolveApiErrorMessage } from 'helpers/errors';

import { apiInstance } from './chipin.instance';

const AUTH_LOGOUT_PATH = '/auth/logout';
const AUTH_REQUEST_CANCELLED_MESSAGE = 'Auth request cancelled';

let areChipInApiInterceptorsConfigured = false;

class AuthRequestCancelledError extends Error {
    constructor() {
        super(AUTH_REQUEST_CANCELLED_MESSAGE);
    }
}

const getRequestPathname = (url?: string) => {
    if (!url) {
        return '';
    }

    try {
        return new URL(url, getChipInApiUrl()).pathname;
    } catch {
        return url;
    }
};

const isExpectedLogoutUnauthorizedError = (error: unknown) => {
    if (!axios.isAxiosError(error)) {
        return false;
    }

    const pathname = getRequestPathname(error.config?.url);

    if (pathname !== AUTH_LOGOUT_PATH) {
        return false;
    }

    const data = error.response?.data as ApiErrorPayload | undefined;

    return error.response?.status === 401 || data?.code === API_ERROR_CODE.AUTH_UNAUTHORIZED;
};

export const initChipInApiInterceptors = () => {
    if (areChipInApiInterceptorsConfigured) {
        return;
    }

    areChipInApiInterceptorsConfigured = true;

    apiInstance.interceptors.request.use(config => {
        return prepareAuthRequest(config.url).then(accessToken => {
            if (accessToken === null) {
                return Promise.reject(new AuthRequestCancelledError());
            }

            if (accessToken) {
                config.headers.Authorization = `Bearer ${accessToken}`;
            }

            return config;
        });
    });

    apiInstance.interceptors.response.use(
        response => response,
        (error: unknown) => {
            if (error instanceof AuthRequestCancelledError) {
                return Promise.reject(error);
            }

            if (isExpectedLogoutUnauthorizedError(error)) {
                return Promise.reject(error);
            }

            let message: string;

            if (axios.isAxiosError(error)) {
                if (!error.response) {
                    message = resolveApiErrorMessage(undefined, 'network.offline');
                } else {
                    message = resolveApiErrorMessage(error.response.data);
                }
            } else {
                message = resolveApiErrorMessage(undefined);
            }

            toast.error(message, {
                duration: SECOND * 15,
            });

            return Promise.reject(error);
        },
    );
};
