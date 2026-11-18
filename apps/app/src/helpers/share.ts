import { copyTextToClipboard } from 'helpers/clipboard';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unsupported';

export interface InviteShareContent {
    title: string;
    text: string;
}

export interface ShareOptions extends InviteShareContent {
    url: string;
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
 * Never rejects — all outcomes are encoded as a ShareResult.
 */
export const shareInvite = (options: ShareOptions): Promise<ShareResult> => {
    if (!detectNativeShare()) {
        return copyTextToClipboard(options.url);
    }

    return navigator
        .share({
            title: options.title,
            text: options.text,
            url: options.url,
        })
        .then(
            () => 'shared',
            (error: unknown) => {
                if (error instanceof Error && error.name === 'AbortError') {
                    return 'cancelled';
                }

                return copyTextToClipboard(options.url);
            },
        );
};
