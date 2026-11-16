import { describe, expect, test, vi } from 'vitest';

import { logoutApiAuthTokens, refreshApiAuthTokens } from './chipin';
import { apiInstance } from './chipin.instance';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        post: vi.fn(),
    },
}));

describe('cookie-backed auth transport', () => {
    test('refreshes through the HttpOnly cookie with the CSRF header', () => {
        vi.mocked(apiInstance.post).mockResolvedValue({
            data: { token: 'next-access-token' },
        });

        return refreshApiAuthTokens().then(result => {
            expect(apiInstance.post).toHaveBeenLastCalledWith('/auth/refresh', undefined, {
                headers: {
                    'X-Chipin-Csrf': '1',
                },
            });
            expect(result).toEqual({ token: 'next-access-token' });
        });
    });

    test('logs out through the cookie without sending a JavaScript refresh token', () => {
        vi.mocked(apiInstance.post).mockResolvedValue({ data: undefined });

        return logoutApiAuthTokens().then(result => {
            expect(apiInstance.post).toHaveBeenLastCalledWith('/auth/logout', undefined, {
                headers: {
                    'X-Chipin-Csrf': '1',
                },
            });
            expect(result).toBeUndefined();
        });
    });
});
