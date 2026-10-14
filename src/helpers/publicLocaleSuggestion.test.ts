import { beforeEach, expect, test } from 'vitest';

import { isPublicLocaleSuggestionSuppressed, suppressPublicLocaleSuggestion } from './publicLocaleSuggestion';

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
