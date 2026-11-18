import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { shareInvite } from './share';

const share = vi.fn(() => Promise.resolve());
const writeText = vi.fn(() => Promise.resolve());
const execCommand = vi.fn((_command: string): boolean => true);

beforeEach(() => {
    vi.clearAllMocks();
    execCommand.mockReturnValue(true);

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
    Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: execCommand,
    });
});

afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand');
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

test('DSH-015 does not copy when the user cancels the native share sheet', () => {
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
        expect(execCommand).not.toHaveBeenCalled();
    });
});

test('DSH-015 copies the link with the copy command when sharing fails and the clipboard write is denied', () => {
    share.mockRejectedValueOnce(new Error('share failed'));
    writeText.mockRejectedValueOnce(new Error('NotAllowedError'));

    return shareInvite({
        title: 'Join Trip on ChipIn',
        text: 'Join Trip on ChipIn to share expenses together.',
        url: 'https://chipin.one/group/join/group-token',
    }).then(result => {
        expect(writeText).toHaveBeenCalledWith('https://chipin.one/group/join/group-token');
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(result).toBe('copied');
    });
});

test('DSH-015 returns unsupported when sharing fails and both copy methods fail', () => {
    share.mockRejectedValueOnce(new Error('share failed'));
    writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
    execCommand.mockReturnValue(false);

    return shareInvite({
        title: 'Join Trip on ChipIn',
        text: 'Join Trip on ChipIn to share expenses together.',
        url: 'https://chipin.one/group/join/group-token',
    }).then(result => {
        expect(result).toBe('unsupported');
    });
});
