import { beforeEach, expect, test, vi } from 'vitest';

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
    expect(getPublicLocaleSuggestionTarget('/terms', 'pt-PT')).toBe('/pt-pt/terms');
    expect(getPublicLocaleSuggestionTarget('/es/privacy', 'ru')).toBeNull();
    expect(getPublicLocaleSuggestionTarget('/dashboard', 'ru')).toBeNull();
});

test('a storage quota write failure still suppresses repeated suggestions', () => {
    const quotaStorage: Storage = {
        length: 0,
        clear: () => undefined,
        getItem: () => null,
        key: () => null,
        removeItem: () => undefined,
        setItem: () => { throw new DOMException('Full', 'QuotaExceededError'); },
    };
    const storage = vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(quotaStorage);
    try {
        expect(isPublicLocaleSuggestionSuppressed()).toBe(false);
        suppressPublicLocaleSuggestion();
        expect(isPublicLocaleSuggestionSuppressed()).toBe(true);
    } finally {
        storage.mockRestore();
    }
});

test('unavailable sessionStorage does not break manual language switching', () => {
    const inaccessibleStorage: Storage = {
        length: 0,
        clear: () => undefined,
        getItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
        key: () => null,
        removeItem: () => undefined,
        setItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
    };
    const storage = vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(
        inaccessibleStorage,
    );
    try {
        expect(() => isPublicLocaleSuggestionSuppressed()).not.toThrow();
        expect(() => suppressPublicLocaleSuggestion()).not.toThrow();
        expect(isPublicLocaleSuggestionSuppressed()).toBe(true);
        expect(getPublicLocaleSuggestionTarget('/privacy', 'ru')).toBe('/ru/privacy');
    } finally {
        storage.mockRestore();
    }
});
