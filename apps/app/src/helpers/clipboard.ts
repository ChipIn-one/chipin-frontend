export type ClipboardCopyResult = 'copied' | 'unsupported';

const toCopyResult = (isCopied: boolean): ClipboardCopyResult =>
    isCopied ? 'copied' : 'unsupported';

const isTextControl = (element: Element | null): boolean =>
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

const readSelectionRanges = (selection: Selection): Range[] =>
    Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index));

/**
 * WebKit safety net when the copy event carried no `clipboardData` (or did not fire because
 * nothing was selected): temporarily appends a selectable span next to the focused element's
 * dialog (so a focus trap keeps it reachable), selects its text and runs `execCommand('copy')`
 * again. Never moves focus. Always removes the span; restores the previous selection only when
 * it had ranges and no text control is focused.
 */
const copyTextWithTemporarySelection = (value: string): boolean => {
    const selection = document.getSelection();

    if (!selection) {
        return false;
    }

    const activeElement = document.activeElement;
    const previousRanges = readSelectionRanges(selection);
    const container = activeElement?.closest('[role="dialog"]') ?? document.body;
    const span = document.createElement('span');
    span.textContent = value;
    span.setAttribute('aria-hidden', 'true');
    Object.assign(span.style, {
        position: 'fixed',
        top: '0',
        left: '-9999px',
        whiteSpace: 'pre',
        userSelect: 'text',
        webkitUserSelect: 'text',
    });

    try {
        container.appendChild(span);
        const range = document.createRange();
        range.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(range);

        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        span.remove();

        if (previousRanges.length > 0 && !isTextControl(activeElement)) {
            try {
                selection.removeAllRanges();
                previousRanges.forEach(previousRange => selection.addRange(previousRange));
            } catch {
                // Restoring the selection is best effort.
            }
        }
    }
};

/**
 * Synchronous legacy copy for contexts where the async Clipboard API is missing or denied
 * (an embedder that denies `clipboard-write`, an unfocused document). Adds a one-time `copy`
 * listener on `document` that writes the value into `clipboardData`, runs
 * `document.execCommand('copy')` and always removes the listener. Falls back to copying a
 * temporary selection only when the copy event wrote no `clipboardData`. Returns whether the
 * browser reported a successful copy.
 *
 * `execCommand('copy')` also needs a live user activation, so it cannot help once the
 * activation is used up (for example after a failed share sheet). Callers cover that case by
 * asking for a fresh click: the invite copy-error toast offers a "Copy link" action.
 */
const copyTextWithCopyCommand = (value: string): boolean => {
    if (
        typeof document === 'undefined' ||
        !document.body ||
        typeof document.execCommand !== 'function'
    ) {
        return false;
    }

    let hasWrittenClipboardData = false;
    const onCopy = (event: ClipboardEvent): void => {
        if (!event.clipboardData) {
            return;
        }

        event.clipboardData.setData('text/plain', value);
        event.preventDefault();
        hasWrittenClipboardData = true;
    };

    document.addEventListener('copy', onCopy);

    try {
        const isCommandCopied = document.execCommand('copy');

        if (hasWrittenClipboardData) {
            return isCommandCopied;
        }

        return copyTextWithTemporarySelection(value);
    } catch {
        return false;
    } finally {
        document.removeEventListener('copy', onCopy);
    }
};

/**
 * Copies text to the system clipboard. Tries the async Clipboard API first and falls back to a
 * synchronous `execCommand('copy')` (see `copyTextWithCopyCommand`). When the async API is
 * missing, the fallback runs synchronously inside this call so it stays within the user gesture.
 * Never rejects.
 */
export const copyTextToClipboard = (value: string): Promise<ClipboardCopyResult> => {
    try {
        if (
            typeof navigator === 'undefined' ||
            typeof navigator.clipboard?.writeText !== 'function'
        ) {
            return Promise.resolve(toCopyResult(copyTextWithCopyCommand(value)));
        }

        return navigator.clipboard.writeText(value).then(
            () => 'copied' as const,
            () => toCopyResult(copyTextWithCopyCommand(value)),
        );
    } catch {
        return Promise.resolve(toCopyResult(copyTextWithCopyCommand(value)));
    }
};
