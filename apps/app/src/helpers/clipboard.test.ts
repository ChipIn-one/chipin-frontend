import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { copyTextToClipboard } from './clipboard';

interface CopyCommandBehaviour {
    isCopied: boolean;
    hasClipboardData: boolean;
}

const copyCommand: CopyCommandBehaviour = { isCopied: true, hasClipboardData: true };
const copiedTexts: string[] = [];
const selectedTextsAtCopy: string[] = [];

// jsdom has no `execCommand` or `ClipboardEvent`: emulate the browser dispatching a `copy` event
// with (or without) `clipboardData` at the focused element, recording what was written or selected
// at copy time.
// jsdom's Selection#toString ignores ranges while a non-text element is focused; read the range.
const readSelectedText = (): string => {
    const selection = document.getSelection();

    return selection && selection.rangeCount > 0 ? selection.getRangeAt(0).toString() : '';
};

const emulateCopyCommand = (_command: string): boolean => {
    const setData = (_format: string, data: string): void => {
        copiedTexts.push(data);
    };
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(copyEvent, 'clipboardData', {
        value: copyCommand.hasClipboardData ? { setData } : null,
    });
    selectedTextsAtCopy.push(readSelectedText());
    (document.activeElement ?? document).dispatchEvent(copyEvent);

    return copyCommand.isCopied;
};

const execCommand = vi.fn(emulateCopyCommand);

beforeEach(() => {
    vi.clearAllMocks();
    execCommand.mockImplementation(emulateCopyCommand);
    copyCommand.isCopied = true;
    copyCommand.hasClipboardData = true;
    copiedTexts.length = 0;
    selectedTextsAtCopy.length = 0;
    Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: execCommand,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'execCommand');
    document.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
});

test('returns copied after the clipboard write completes', () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    return copyTextToClipboard('invite-link').then(result => {
        expect(writeText).toHaveBeenCalledWith('invite-link');
        expect(execCommand).not.toHaveBeenCalled();
        expect(result).toBe('copied');
    });
});

test('DSH-015 writes the value through the copy event when the clipboard write is denied', () => {
    const writeText = vi.fn(() => Promise.reject(new Error('Write permission denied')));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    return copyTextToClipboard('invite-link').then(result => {
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(copiedTexts).toEqual(['invite-link']);
        expect(result).toBe('copied');
    });
});

test('DSH-015 copies synchronously within the call when the clipboard API is unavailable', () => {
    vi.stubGlobal('navigator', {});

    const pendingResult = copyTextToClipboard('invite-link');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(copiedTexts).toEqual(['invite-link']);

    return pendingResult.then(result => {
        expect(result).toBe('copied');
    });
});

test('falls back to the copy command when the clipboard API throws synchronously', () => {
    const writeText = vi.fn(() => {
        throw new Error('clipboard unavailable');
    });
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    return copyTextToClipboard('invite-link').then(result => {
        expect(copiedTexts).toEqual(['invite-link']);
        expect(result).toBe('copied');
    });
});

test('DSH-015 returns unsupported when the clipboard write is denied and the copy command fails', () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    copyCommand.isCopied = false;

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('unsupported');
    });
});

test('returns unsupported when the copy command throws', () => {
    vi.stubGlobal('navigator', {});
    execCommand.mockImplementationOnce(() => {
        throw new Error('copy blocked');
    });

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('unsupported');
    });
});

test('returns unsupported when neither the clipboard API nor the copy command exists', () => {
    vi.stubGlobal('navigator', {});
    Reflect.deleteProperty(document, 'execCommand');

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('unsupported');
    });
});

test('removes the copy listener after copying', () => {
    vi.stubGlobal('navigator', {});

    return copyTextToClipboard('invite-link').then(() => {
        const laterCopyEvent = new Event('copy', { cancelable: true });
        Object.defineProperty(laterCopyEvent, 'clipboardData', {
            value: { setData: vi.fn() },
        });
        document.dispatchEvent(laterCopyEvent);

        expect(laterCopyEvent.defaultPrevented).toBe(false);
        expect(copiedTexts).toEqual(['invite-link']);
    });
});

test('copies a temporary selection without moving focus when the copy event has no clipboard data', () => {
    vi.stubGlobal('navigator', {});
    copyCommand.hasClipboardData = false;
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selected text';
    const button = document.createElement('button');
    document.body.append(paragraph, button);
    button.focus();
    const previousRange = document.createRange();
    previousRange.selectNodeContents(paragraph);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(previousRange);

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('copied');
        expect(selectedTextsAtCopy).toEqual(['Selected text', 'invite-link']);
        expect(document.body.textContent).toBe('Selected text');
        expect(document.activeElement).toBe(button);
        expect(readSelectedText()).toBe('Selected text');
    });
});

test.each(['dialog', 'alertdialog'])(
    'places the temporary selection inside the focused %s',
    role => {
        vi.stubGlobal('navigator', {});
        const dialog = document.createElement('div');
        dialog.setAttribute('role', role);
        const button = document.createElement('button');
        dialog.append(button);
        document.body.append(dialog);
        button.focus();
        let isSelectionInsideDialog = false;
        execCommand.mockImplementation(() => {
            const anchorNode = document.getSelection()?.anchorNode ?? null;
            isSelectionInsideDialog = anchorNode !== null && dialog.contains(anchorNode);
            return true;
        });

        return copyTextToClipboard('invite-link').then(result => {
            expect(result).toBe('copied');
            expect(isSelectionInsideDialog).toBe(true);
            expect(dialog.textContent).toBe('');
            expect(document.activeElement).toBe(button);
        });
    },
);

test('writes the clipboard data even when a page listener stops the copy event from bubbling', () => {
    vi.stubGlobal('navigator', {});
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    button.addEventListener('copy', event => {
        event.stopPropagation();
    });

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('copied');
        expect(copiedTexts).toEqual(['invite-link']);
    });
});

test('restores the focused text field selection after copying a temporary selection', () => {
    vi.stubGlobal('navigator', {});
    copyCommand.hasClipboardData = false;
    const input = document.createElement('input');
    input.value = 'typed amount';
    document.body.append(input);
    input.focus();
    input.setSelectionRange(2, 5);

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('copied');
        expect(selectedTextsAtCopy).toEqual(['', 'invite-link']);
        expect(document.activeElement).toBe(input);
        expect(input.selectionStart).toBe(2);
        expect(input.selectionEnd).toBe(5);
    });
});

test('clears the temporary selection when nothing was selected before', () => {
    vi.stubGlobal('navigator', {});
    copyCommand.hasClipboardData = false;
    document.getSelection()?.removeAllRanges();

    return copyTextToClipboard('invite-link').then(result => {
        expect(result).toBe('copied');
        expect(selectedTextsAtCopy).toEqual(['', 'invite-link']);
        expect(document.getSelection()?.rangeCount).toBe(0);
    });
});
