import { beforeEach, describe, expect, test, vi } from 'vitest';

import { LS_KEY_AUTH_TOKENS } from 'constants/localstorage';

import { clearLegacyAuthTokens } from './localStorage';

describe('legacy auth token storage', () => {
    let values: Map<string, string>;
    let removeItem: ReturnType<typeof vi.fn>;
    let setItem: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        values = new Map();
        removeItem = vi.fn((key: string) => values.delete(key));
        setItem = vi.fn((key: string, value: string) => values.set(key, value));
        vi.stubGlobal('localStorage', {
            clear: vi.fn(() => values.clear()),
            getItem: vi.fn((key: string) => values.get(key) ?? null),
            removeItem,
            setItem,
        });
    });

    test('clears the old access-plus-refresh token shape without writing a replacement', () => {
        values.set(
            LS_KEY_AUTH_TOKENS,
            JSON.stringify({
                accessToken: 'legacy-access-token',
                refreshToken: 'legacy-refresh-token',
            }),
        );

        clearLegacyAuthTokens();

        expect(removeItem).toHaveBeenCalledWith(LS_KEY_AUTH_TOKENS);
        expect(values.has(LS_KEY_AUTH_TOKENS)).toBe(false);
        expect(setItem).not.toHaveBeenCalled();
    });

    test('does not fail when legacy auth storage is unavailable', () => {
        removeItem.mockImplementation(() => {
            throw new Error('storage unavailable');
        });

        expect(() => clearLegacyAuthTokens()).not.toThrow();
        expect(setItem).not.toHaveBeenCalled();
    });
});
