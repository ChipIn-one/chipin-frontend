export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unsupported';

export interface ShareOptions {
    url: string;
    title: string;
    text: string;
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

const copyShareUrl = (url: string): Promise<ShareResult> => {
    if (!navigator.clipboard?.writeText) {
        return Promise.resolve('unsupported');
    }

    return navigator.clipboard.writeText(url).then(
        () => 'copied',
        () => 'unsupported',
    );
};

/**
 * Attempts to share via the Web Share API, falling back to clipboard copy.
 * Never rejects — all outcomes are encoded as a ShareResult.
 */
export const shareInvite = (options: ShareOptions): Promise<ShareResult> => {
    if (!detectNativeShare()) {
        return copyShareUrl(options.url);
    }

    return navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
    }).then(
        () => 'shared',
        (error: unknown) => {
            if (error instanceof Error && error.name === 'AbortError') {
                return 'cancelled';
            }

            return copyShareUrl(options.url);
        },
    );
};
