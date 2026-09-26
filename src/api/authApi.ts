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

    return (
        typeof response.token === 'string' &&
        response.token.length > 0 &&
        typeof response.refresh_token === 'string' &&
        response.refresh_token.length > 0
    );
};

export const logoutOtherDevices = (
    refreshToken: string,
): Promise<ApiLogoutOtherDevicesResponse> => {
    return apiInstance
        .post<unknown>('/auth/logout-other-devices', undefined, {
            headers: {
                'X-Refresh-Token': refreshToken,
            },
        })
        .then(response => {
            if (!isLogoutOtherDevicesResponse(response.data)) {
                return Promise.reject(new InvalidLogoutOtherDevicesResponseError());
            }

            return response.data;
        });
};
