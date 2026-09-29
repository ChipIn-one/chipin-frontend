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

    test('posts the current refresh token and returns the rotated token pair', () => {
        const tokenPair = {
            token: 'next-access-token',
            refresh_token: 'next-refresh-token',
        };

        vi.mocked(apiInstance.post).mockResolvedValue({ data: tokenPair });

        return logoutOtherDevices('current-refresh-token').then(result => {
            expect(apiInstance.post).toHaveBeenCalledWith(
                '/auth/logout-other-devices',
                undefined,
                {
                    headers: {
                        'X-Refresh-Token': 'current-refresh-token',
                    },
                },
            );
            expect(result).toEqual(tokenPair);
        });
    });

    test.each([
        { refresh_token: 'next-refresh-token' },
        { token: 'next-access-token' },
        { token: '', refresh_token: 'next-refresh-token' },
        { token: 'next-access-token', refresh_token: '' },
    ])('rejects an unusable rotated token pair %#', responseData => {
        vi.mocked(apiInstance.post).mockResolvedValue({ data: responseData });

        return expect(
            logoutOtherDevices('current-refresh-token'),
        ).rejects.toBeInstanceOf(InvalidLogoutOtherDevicesResponseError);
    });
});
