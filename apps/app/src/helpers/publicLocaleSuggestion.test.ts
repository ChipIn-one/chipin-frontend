import { beforeEach, expect, test, vi } from 'vitest';

import { SS_KEY_PUBLIC_LOCALE_SUGGESTION_SHOWN } from 'constants/localstorage';

import {
    getPublicLocaleSuggestionTarget,
    isPublicLocaleSuggestionSuppressed,
    suppressPublicLocaleSuggestion,
} from './publicLocaleSuggestion';

beforeEach(() => {
    window.sessionStorage.clear();
});

test('manual locale change suppresses a suggestion for this session only', () => {
    expect(isPublicLocaleSuggestionSuppressed()).toBe(false);
    suppressPublicLocaleSuggestion();
    expect(isPublicLocaleSuggestionSuppressed()).toBe(true);
    window.sessionStorage.clear();
    expect(isPublicLocaleSuggestionSuppressed()).toBe(false);
});

test('persistent toast action follows the current English public path', () => {
    expect(getPublicLocaleSuggestionTarget('/privacy', 'ru')).toBe('/ru/privacy');
    expect(getPublicLocaleSuggestionTarget('/', 'ru')).toBe('/ru/');
    expect(getPublicLocaleSuggestionTarget('/terms', 'ru')).toBe('/ru/terms');
    expect(getPublicLocaleSuggestionTarget('/ru/privacy', 'ru')).toBeNull();
    expect(getPublicLocaleSuggestionTarget('/dashboard', 'ru')).toBeNull();
});

test('a storage quota write failure still suppresses repeated suggestions', () => {
    const quotaStorage: Storage = {
        length: 0,
        clear: () => undefined,
        getItem: () => null,
        key: () => null,
        removeItem: () => undefined,
        setItem: () => {
            throw new DOMException('Full', 'QuotaExceededError');
        },
    };
    const storage = vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(quotaStorage);
    try {
        expect(isPublicLocaleSuggestionSuppressed()).toBe(false);
        suppressPublicLocaleSuggestion();
        expect(isPublicLocaleSuggestionSuppressed()).toBe(true);
    } finally {
        storage.mockRestore();
    }
    // The failed write went to the mocked storage: the real one never got the flag.
    expect(window.sessionStorage.getItem(SS_KEY_PUBLIC_LOCALE_SUGGESTION_SHOWN)).toBeNull();
});

test('unavailable sessionStorage does not break manual language switching', () => {
    const inaccessibleStorage: Storage = {
        length: 0,
        clear: () => undefined,
        getItem: () => {
            throw new DOMException('Blocked', 'SecurityError');
        },
        key: () => null,
        removeItem: () => undefined,
        setItem: () => {
            throw new DOMException('Blocked', 'SecurityError');
        },
    };
    const storage = vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(inaccessibleStorage);
    try {
        expect(() => isPublicLocaleSuggestionSuppressed()).not.toThrow();
        expect(() => suppressPublicLocaleSuggestion()).not.toThrow();
        expect(isPublicLocaleSuggestionSuppressed()).toBe(true);
        expect(getPublicLocaleSuggestionTarget('/privacy', 'ru')).toBe('/ru/privacy');
    } finally {
        storage.mockRestore();
    }
    expect(window.sessionStorage.getItem(SS_KEY_PUBLIC_LOCALE_SUGGESTION_SHOWN)).toBeNull();
});

// Runs on a fresh module: the tests above leave the document-local fallback on, which would skip
// the storage read.
test('a throwing storage read does not throw and does not suppress the suggestion', async () => {
    vi.resetModules();
    const fresh = await import('./publicLocaleSuggestion');
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
    });
    try {
        expect(() => fresh.isPublicLocaleSuggestionSuppressed()).not.toThrow();
        expect(fresh.isPublicLocaleSuggestionSuppressed()).toBe(false);
        expect(getItem).toHaveBeenCalled();
    } finally {
        getItem.mockRestore();
    }
});
