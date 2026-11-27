import { describe, expect, test } from 'vitest';

import { buildAndroidChromeIntentUrl, canOpenInChrome, detectInAppBrowser } from './inAppBrowser';

// User agents as the apps and browsers send them. App user agents drift with every release:
// replace a sample with a fresh one when an app changes its format.
const IN_APP_SAMPLES = [
    {
        name: 'Instagram on iOS',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.1.24.108 (iPhone14,5; iOS 17_1_2; en_US; en; scale=3.00; 1170x2532; 532277137)',
        expected: { kind: 'instagram', platform: 'ios' },
    },
    {
        name: 'Instagram on Android',
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Instagram 309.0.0.40.113 Android (33/13; 480dpi; 1080x2115; samsung; SM-S918B; dm3q; qcom; en_US; 541635890)',
        expected: { kind: 'instagram', platform: 'android' },
    },
    {
        name: 'Facebook on iOS (FBAN/FBAV)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone13,2;FBMD/iPhone;FBSN/iOS;FBSV/16.6;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBAV/430.0.0.30.110;FBRV/0]',
        expected: { kind: 'facebook', platform: 'ios' },
    },
    {
        name: 'Facebook on Android (FB_IAB/FBAV)',
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.5845.163 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/432.0.0.29.102;]',
        expected: { kind: 'facebook', platform: 'android' },
    },
    {
        name: 'Messenger on iOS (FBAN)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
        expected: { kind: 'facebook', platform: 'ios' },
    },
    {
        name: 'Messenger on Android (FB_IAB/MESSENGER)',
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; SM-G998B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/439.0.0.29.119;]',
        expected: { kind: 'facebook', platform: 'android' },
    },
    {
        name: 'Telegram on Android (Telegram-Android token)',
        userAgent:
            'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240305.019.A1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Telegram-Android/10.12.0 (Google Pixel 8; Android 14; SDK 34; HIGH)',
        expected: { kind: 'telegram', platform: 'android' },
    },
    {
        name: 'Threads on iOS (Barcelona)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 323.0.3.15.110 (iPhone15,3; iOS 17_4; en_US; en; scale=3.00; 1290x2796; 576432040)',
        expected: { kind: 'other-app', platform: 'ios' },
    },
    {
        name: 'Threads on Android (Barcelona)',
        userAgent:
            'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.53 Mobile Safari/537.36 Barcelona 330.0.0.36.106 Android (34/14; 420dpi; 1080x2205; Google/google; Pixel 8; shiba; shiba; en_US; 598214372)',
        expected: { kind: 'other-app', platform: 'android' },
    },
    {
        name: 'LINE on iOS (Line/)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.21.0',
        expected: { kind: 'other-app', platform: 'ios' },
    },
    {
        name: 'LINE on Android (Line/)',
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; SM-G991B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 Line/13.22.1/IAB',
        expected: { kind: 'other-app', platform: 'android' },
    },
    {
        name: 'TikTok on iOS (musical_ly, BytedanceWebview)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_32.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US ByteFullLocale/en WKWebView/1 BytedanceWebview/d8a21c6',
        expected: { kind: 'other-app', platform: 'ios' },
    },
    {
        name: 'TikTok on Android (musical_ly, BytedanceWebview)',
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/117.0.5938.153 Mobile Safari/537.36 trill_2023109040 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/31.9.4 ByteLocale/en ByteFullLocale/en Region/US BytedanceWebview/d8a21c6',
        expected: { kind: 'other-app', platform: 'android' },
    },
    {
        name: 'LinkedIn on iOS (LinkedInApp)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.6542',
        expected: { kind: 'other-app', platform: 'ios' },
    },
    {
        name: 'LinkedIn on Android (LinkedInApp)',
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [LinkedInApp]/4.1.881',
        expected: { kind: 'other-app', platform: 'android' },
    },
    {
        name: 'generic Android System WebView (; wv))',
        userAgent:
            'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 5 Build/LMY48B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/43.0.2357.65 Mobile Safari/537.36',
        expected: { kind: 'android-webview', platform: 'android' },
    },
] as const;

const NORMAL_BROWSER_SAMPLES = [
    {
        name: 'Safari on iOS',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    },
    {
        name: 'Chrome on iOS (CriOS)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
    },
    {
        name: 'Firefox on iOS (FxiOS)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15',
    },
    {
        name: 'Edge on iOS (EdgiOS)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/120.0.2210.84 Mobile/15E148 Safari/605.1.15',
    },
    {
        name: 'the Google app on iOS (GSA/)',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/292.0.588026477 Mobile/15E148 Safari/604.1',
    },
    {
        name: 'Chrome on Android (also Chrome Custom Tabs)',
        userAgent:
            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    },
    {
        name: 'Samsung Internet',
        userAgent:
            'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    },
    {
        name: 'desktop Chrome',
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    {
        name: 'desktop Firefox',
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    },
    {
        name: 'desktop Safari',
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    },
] as const;

describe('AUTH-078 in-app browser detection', () => {
    test.each(IN_APP_SAMPLES)('detects $name', ({ userAgent, expected }) => {
        expect(detectInAppBrowser(userAgent)).toEqual(expected);
    });

    test.each(NORMAL_BROWSER_SAMPLES)('treats $name as a normal browser', ({ userAgent }) => {
        expect(detectInAppBrowser(userAgent)).toBeNull();
    });

    test('detects the Telegram webview on iOS from the TelegramWebviewProxy hint', () => {
        // Telegram for iOS adds no token of its own to the WKWebView user agent.
        const userAgent =
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

        expect(detectInAppBrowser(userAgent)).toBeNull();
        expect(detectInAppBrowser(userAgent, { hasTelegramWebviewProxy: true })).toEqual({
            kind: 'telegram',
            platform: 'ios',
        });
    });
});

describe('AUTH-078 Open in Chrome availability', () => {
    test.each(['instagram', 'facebook', 'telegram'] as const)(
        'offers it for %s on Android',
        kind => {
            expect(canOpenInChrome({ kind, platform: 'android' })).toBe(true);
        },
    );

    test.each(['other-app', 'android-webview'] as const)(
        'does not offer it for %s on Android: the host app may not hand intent:// on',
        kind => {
            expect(canOpenInChrome({ kind, platform: 'android' })).toBe(false);
        },
    );

    test.each(['ios', 'other'] as const)('does not offer it on %s', platform => {
        expect(canOpenInChrome({ kind: 'instagram', platform })).toBe(false);
    });
});

describe('AUTH-078 Android Chrome intent URL', () => {
    test('keeps the host, path and query and encodes the fallback URL', () => {
        const href = 'https://app.chipin.one/groups/42?tab=expenses';

        expect(buildAndroidChromeIntentUrl(href)).toBe(
            'intent://app.chipin.one/groups/42?tab=expenses#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fapp.chipin.one%2Fgroups%2F42%3Ftab%3Dexpenses;end',
        );
    });

    test('keeps the invite token, returnTo and UTM parameters', () => {
        const href =
            'https://app.chipin.one/join/abc123?token=inv-tok_9&returnTo=%2Fgroups%2F7&utm_source=instagram&utm_medium=bio';
        const intentUrl = buildAndroidChromeIntentUrl(href);

        expect(intentUrl).toContain(
            'intent://app.chipin.one/join/abc123?token=inv-tok_9&returnTo=%2Fgroups%2F7&utm_source=instagram&utm_medium=bio#Intent;',
        );
        expect(intentUrl).toContain(`S.browser_fallback_url=${encodeURIComponent(href)};end`);
    });

    test('drops the fragment from the intent part and keeps the scheme and port of the href', () => {
        const href = 'http://localhost:5173/login?returnTo=%2F#section';

        expect(buildAndroidChromeIntentUrl(href)).toBe(
            `intent://localhost:5173/login?returnTo=%2F#Intent;scheme=http;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`,
        );
    });

    test('returns null for a URL that is not http(s)', () => {
        expect(buildAndroidChromeIntentUrl('not a url')).toBeNull();
        expect(buildAndroidChromeIntentUrl('file:///tmp/index.html')).toBeNull();
    });
});
