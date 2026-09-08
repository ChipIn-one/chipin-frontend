export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unsupported';

interface ShareOptions {
    url: string;
    title: string;
}

/**
 * Returns true when the Web Share API is available AND the device likely
 * uses a coarse pointer (touch / mobile).
 *
 * The coarse-pointer guard avoids triggering the native share sheet on
 * desktop browsers (e.g. Chrome on macOS) that also expose navigator.share.
 */
export const detectNativeShare = (): boolean => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
        return false;
    }

    return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
};

/**
 * Attempts to share via the Web Share API, falling back to clipboard copy.
 * Never throws — all errors are encoded as a ShareResult.
 */
export const shareGroupInvite = async (options: ShareOptions): Promise<ShareResult> => {
    if (detectNativeShare()) {
        try {
            await navigator.share({ title: options.title, url: options.url });

            return 'shared';
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return 'cancelled';
            }

            // Share failed for a non-abort reason — fall through to clipboard
        }
    }

    try {
        await navigator.clipboard.writeText(options.url);

        return 'copied';
    } catch {
        return 'unsupported';
    }
};
