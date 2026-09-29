import { beforeEach, describe, expect, test, vi } from 'vitest';

import { LS_KEY_AUTH_SESSION_HINT } from 'constants/localstorage';

import { hasAuthSessionHint, setAuthSessionHint } from './localStorage';

describe('auth session hint storage', () => {
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

    test('stores only a non-secret boolean session hint', () => {
        expect(setAuthSessionHint(true)).toBe(true);

        expect(hasAuthSessionHint()).toBe(true);
        expect(values.get(LS_KEY_AUTH_SESSION_HINT)).toBe('true');

        expect(setAuthSessionHint(false)).toBe(true);

        expect(hasAuthSessionHint()).toBe(false);
        expect(values.has(LS_KEY_AUTH_SESSION_HINT)).toBe(false);
    });

    test('reports when the session hint cannot be persisted', () => {
        setItem.mockImplementation(() => {
            throw new Error('storage unavailable');
        });

        expect(setAuthSessionHint(true)).toBe(false);
        expect(hasAuthSessionHint()).toBe(false);
    });

    test('falls back to a false marker when removing the session hint fails', () => {
        values.set(LS_KEY_AUTH_SESSION_HINT, 'true');
        removeItem.mockImplementation(() => {
            throw new Error('remove unavailable');
        });

        expect(setAuthSessionHint(false)).toBe(true);
        expect(hasAuthSessionHint()).toBe(false);
        expect(values.get(LS_KEY_AUTH_SESSION_HINT)).toBe('false');
    });

    test('reports when the session hint cannot be cleared or overwritten', () => {
        values.set(LS_KEY_AUTH_SESSION_HINT, 'true');
        removeItem.mockImplementation(() => {
            throw new Error('remove unavailable');
        });
        setItem.mockImplementation(() => {
            throw new Error('write unavailable');
        });

        expect(setAuthSessionHint(false)).toBe(false);
        expect(values.get(LS_KEY_AUTH_SESSION_HINT)).toBe('true');
    });

});
