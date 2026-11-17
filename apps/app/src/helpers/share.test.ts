import { beforeEach, expect, test, vi } from 'vitest';

import { shareInvite } from './share';

const share = vi.fn(() => Promise.resolve());
const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    });
    Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: share,
    });
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
});

test('passes reviewed title, text and URL to the native share sheet', () => {
    return shareInvite({
        title: 'Join me on ChipIn',
        text: 'Add me as a friend on ChipIn.',
        url: 'https://chipin.one/friends/join/friend-token',
    }).then(result => {
        expect(result).toBe('shared');
        expect(share).toHaveBeenCalledWith({
            title: 'Join me on ChipIn',
            text: 'Add me as a friend on ChipIn.',
            url: 'https://chipin.one/friends/join/friend-token',
        });
    });
});

test('does not copy when the user cancels the native share sheet', () => {
    const abortError = new Error('cancelled');
    abortError.name = 'AbortError';
    share.mockRejectedValueOnce(abortError);

    return shareInvite({
        title: 'Join Trip on ChipIn',
        text: 'Join Trip on ChipIn to share expenses together.',
        url: 'https://chipin.one/group/join/group-token',
    }).then(result => {
        expect(result).toBe('cancelled');
        expect(writeText).not.toHaveBeenCalled();
    });
});
