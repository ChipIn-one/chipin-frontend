// AUTH-078: Google OAuth refuses embedded webviews (`403 disallowed_useragent`). These helpers
// recognise the in-app browsers that ChipIn links are opened in, so the sign-in UI can send the
// person to a normal browser first. Pure functions of their inputs; the caller reads
// `navigator.userAgent` and `window.location.href`. Keep the samples in the test file current:
// app user agents drift as the apps update.

/**
 * `other-app` is another known in-app browser that Google blocks (Threads, LINE, TikTok,
 * LinkedIn); `android-webview` is any other Android System WebView.
 */
export type InAppBrowserKind =
    'instagram' | 'facebook' | 'telegram' | 'other-app' | 'android-webview';

export type InAppBrowserPlatform = 'android' | 'ios' | 'other';

export interface InAppBrowser {
    kind: InAppBrowserKind;
    platform: InAppBrowserPlatform;
}

export interface InAppBrowserHints {
    /**
     * Whether `window.TelegramWebviewProxy` exists: Telegram injects it into its own webview,
     * including on iOS, where the user agent carries no Telegram token.
     */
    hasTelegramWebviewProxy?: boolean;
}

const INSTAGRAM_PATTERN = /\bInstagram\b/;
// Facebook and Messenger: `FBAN/FBIOS`, `FBAN/MessengerForiOS` on iOS; `FB_IAB/FB4A`,
// `FB_IAB/MESSENGER`, `FBAV/...` on Android.
const FACEBOOK_PATTERN = /\bFBAN\/|\bFBAV\/|\bFB_IAB\//;
// Telegram for Android appends `Telegram-Android/<version>` to its WebView user agent.
const TELEGRAM_PATTERN = /\bTelegram\b/i;
// Other known in-app browsers, on iOS and Android: Threads (`Barcelona <version>`), LINE
// (`Line/<version>`), TikTok (`musical_ly_<version>`, `BytedanceWebview/...`), LinkedIn
// (`LinkedInApp`). Only explicit app tokens: a missing `Safari/` token alone also matches normal
// browsers and home-screen web apps.
const OTHER_APP_PATTERN =
    /\bBarcelona \d|\bLine\/|\bmusical_ly|\bBytedanceWebview\b|\bLinkedInApp\b/;
// Android System WebView marks itself with `wv` in the platform part: `(Linux; Android 13; Pixel 7 Build/...; wv)`.
// Chrome, Chrome Custom Tabs and Samsung Internet never carry it.
const ANDROID_WEBVIEW_PATTERN = /;\s*wv\)/;
const ANDROID_PATTERN = /\bAndroid\b/i;
const IOS_PATTERN = /\b(iPhone|iPad|iPod)\b/;

const detectPlatform = (userAgent: string): InAppBrowserPlatform => {
    if (ANDROID_PATTERN.test(userAgent)) {
        return 'android';
    }

    return IOS_PATTERN.test(userAgent) ? 'ios' : 'other';
};

const detectKind = (userAgent: string, hints: InAppBrowserHints): InAppBrowserKind | null => {
    if (INSTAGRAM_PATTERN.test(userAgent)) {
        return 'instagram';
    }
    if (FACEBOOK_PATTERN.test(userAgent)) {
        return 'facebook';
    }
    if (TELEGRAM_PATTERN.test(userAgent) || hints.hasTelegramWebviewProxy === true) {
        return 'telegram';
    }
    if (OTHER_APP_PATTERN.test(userAgent)) {
        return 'other-app';
    }
    if (ANDROID_WEBVIEW_PATTERN.test(userAgent)) {
        return 'android-webview';
    }

    return null;
};

/** The in-app browser the user agent belongs to, or `null` for a normal browser. */
export const detectInAppBrowser = (
    userAgent: string,
    hints: InAppBrowserHints = {},
): InAppBrowser | null => {
    const kind = detectKind(userAgent, hints);

    return kind ? { kind, platform: detectPlatform(userAgent) } : null;
};

// Apps whose Android webview hands an `intent://` link to the system, so Chrome opens. A generic
// Android WebView may not: the embedding app decides, and many just fail on the scheme.
const INTENT_CAPABLE_KINDS: ReadonlySet<InAppBrowserKind> = new Set([
    'instagram',
    'facebook',
    'telegram',
]);

/** Whether "Open in Chrome" through {@link buildAndroidChromeIntentUrl} is offered. */
export const canOpenInChrome = ({ kind, platform }: InAppBrowser): boolean =>
    platform === 'android' && INTENT_CAPABLE_KINDS.has(kind);

/**
 * An Android `intent://` URL that opens `href` in Chrome. The host app, not Chrome, resolves the
 * intent, so `S.browser_fallback_url` does not reach the default browser: when Chrome is missing,
 * the fallback is the same page opened again in the current in-app browser. Keeps the host, path and query (invite token,
 * `returnTo`, UTM parameters). The `#fragment` is dropped: the app routes by path, and a `#`
 * inside the intent URL would end its host-and-path part. Returns `null` for a URL that is not
 * http(s).
 */
export const buildAndroidChromeIntentUrl = (href: string): string | null => {
    let url: URL;

    try {
        url = new URL(href);
    } catch {
        return null;
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return null;
    }

    const scheme = url.protocol.slice(0, -1);
    const fallbackUrl = encodeURIComponent(href);

    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallbackUrl};end`;
};
