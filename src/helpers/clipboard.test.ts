import { afterEach, expect, test, vi } from 'vitest';

import { copyTextToClipboard } from './clipboard';

afterEach(() => {
    vi.unstubAllGlobals();
});

test('returns copied after the clipboard write completes', () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    return copyTextToClipboard('invite-link').then(result => {
        expect(writeText).toHaveBeenCalledWith('invite-link');
        expect(result).toBe('copied');
    });
});

test('returns unsupported when the clipboard write rejects', () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('unsupported');
    });
});

test('returns unsupported when the clipboard API is unavailable', () => {
    vi.stubGlobal('navigator', {});

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('unsupported');
    });
});

test('returns unsupported when the clipboard API throws synchronously', () => {
    const writeText = vi.fn(() => {
        throw new Error('clipboard unavailable');
    });
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('unsupported');
    });
});
