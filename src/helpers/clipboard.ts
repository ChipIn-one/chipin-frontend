export type ClipboardCopyResult = 'copied' | 'unsupported';

export const copyTextToClipboard = (value: string): Promise<ClipboardCopyResult> => {
    if (typeof navigator === 'undefined') {
        return Promise.resolve('unsupported');
    }

    try {
        if (typeof navigator.clipboard?.writeText !== 'function') {
            return Promise.resolve('unsupported');
        }

        return navigator.clipboard
            .writeText(value)
            .then(() => 'copied' as const)
            .catch(() => 'unsupported' as const);
    } catch {
        return Promise.resolve('unsupported');
    }
};
