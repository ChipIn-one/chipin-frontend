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

test('unavailable sessionStorage does not break manual language switching', () => {
    const inaccessibleStorage = {
        getItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
        setItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
    };
    const storage = vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(
        inaccessibleStorage as Storage,
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
