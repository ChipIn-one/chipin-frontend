import { beforeEach, describe, expect, test, vi } from 'vitest';

import { LS_KEY_AUTH_TOKENS } from 'constants/localstorage';

import { getAuthTokens, saveAuthTokens } from './localStorage';

describe('auth token storage', () => {
    let values: Map<string, string>;
    let setItem: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        values = new Map();
        setItem = vi.fn((key: string, value: string) => {
            values.set(key, value);
        });
        vi.stubGlobal('localStorage', {
            clear: vi.fn(() => values.clear()),
            getItem: vi.fn((key: string) => values.get(key) ?? null),
            removeItem: vi.fn((key: string) => values.delete(key)),
            setItem,
        });
    });

    test('writes both tokens together and reports success', () => {
        const tokens = {
            accessToken: 'next-access-token',
            refreshToken: 'next-refresh-token',
        };

        const isSaved = saveAuthTokens(tokens);

        expect(setItem).toHaveBeenCalledOnce();
        expect(setItem).toHaveBeenCalledWith(LS_KEY_AUTH_TOKENS, JSON.stringify(tokens));
        expect(isSaved).toBe(true);
        expect(getAuthTokens()).toEqual(tokens);
    });

    test('reports failure without treating the old pair as rotated', () => {
        const currentTokens = {
            accessToken: 'current-access-token',
            refreshToken: 'current-refresh-token',
        };
        values.set(LS_KEY_AUTH_TOKENS, JSON.stringify(currentTokens));
        setItem.mockImplementation(() => {
            throw new Error('Storage is unavailable');
        });

        const isSaved = saveAuthTokens({
            accessToken: 'next-access-token',
            refreshToken: 'next-refresh-token',
        });

        expect(isSaved).toBe(false);
        expect(getAuthTokens()).toEqual(currentTokens);
    });
});
