import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
    InvalidLogoutOtherDevicesResponseError,
    logoutOtherDevices,
} from './authApi';
import { apiInstance } from './chipin.instance';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        post: vi.fn(),
    },
}));

describe('authApi.logoutOtherDevices', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('uses the cookie session with CSRF protection and returns the new access token', () => {
        vi.mocked(apiInstance.post).mockResolvedValue({
            data: { token: 'next-access-token' },
        });

        return logoutOtherDevices().then(result => {
            expect(apiInstance.post).toHaveBeenCalledWith(
                '/auth/logout-other-devices',
                undefined,
                {
                    headers: {
                        'X-Chipin-Csrf': '1',
                    },
                },
            );
            expect(result).toEqual({ token: 'next-access-token' });
        });
    });

    test.each([
        {},
        { token: '' },
        { token: 42 },
        { refresh_token: 'must-not-be-used' },
    ])('rejects an unusable access-token response %#', responseData => {
        vi.mocked(apiInstance.post).mockResolvedValue({ data: responseData });

        return expect(logoutOtherDevices()).rejects.toBeInstanceOf(
            InvalidLogoutOtherDevicesResponseError,
        );
    });
});
