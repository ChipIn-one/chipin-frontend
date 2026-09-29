import { AUTH_API_PATH, AUTH_CSRF_HEADERS } from './auth.constants';
import { apiInstance } from './chipin.instance';
import type { ApiLogoutOtherDevicesResponse } from './chipin.raw.types';

export class InvalidLogoutOtherDevicesResponseError extends Error {
    constructor() {
        super('Invalid logout-other-devices response');
    }
}

const isLogoutOtherDevicesResponse = (
    value: unknown,
): value is ApiLogoutOtherDevicesResponse => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const response = value as Record<string, unknown>;

    return typeof response.token === 'string' && response.token.length > 0;
};

export const logoutOtherDevices = (): Promise<ApiLogoutOtherDevicesResponse> => {
    return apiInstance
        .post<unknown>(AUTH_API_PATH.LOGOUT_OTHER_DEVICES, undefined, {
            headers: AUTH_CSRF_HEADERS,
        })
        .then(response => {
            if (!isLogoutOtherDevicesResponse(response.data)) {
                return Promise.reject(new InvalidLogoutOtherDevicesResponseError());
            }

            return response.data;
        });
};
