import { afterEach, expect, test } from 'vitest';

import { cssToken } from './cssToken';

afterEach(() => {
    document.documentElement.style.removeProperty('--cp-space-3');
});

test('reads a token from the root element without surrounding whitespace', () => {
    document.documentElement.style.setProperty('--cp-space-3', ' 12px ');

    expect(cssToken('--cp-space-3')).toBe('12px');
});

test('returns an empty string for a token that is not declared', () => {
    expect(cssToken('--cp-missing')).toBe('');
});
