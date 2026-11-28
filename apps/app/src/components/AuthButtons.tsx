import { useState } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { detectInAppBrowser, type InAppBrowser } from 'helpers/inAppBrowser';
import { checkIsPwaInstalled } from 'helpers/pwa';
import { getSocialAuthUrl, type SocialAuthOptions } from 'helpers/url';

import GoogleIconSvg from 'assets/google-icon.svg?react';

import { InAppBrowserNotice } from './in-app-browser-notice/InAppBrowserNotice';

// AUTH-078: an in-app browser (Instagram, Facebook, Telegram, Threads, LINE, TikTok, LinkedIn,
// Android WebView) where Google refuses to sign in. An installed PWA is never one, whatever its
// user agent says. Both globals are checked: Node defines `navigator` but not `window`.
const readInAppBrowser = (): InAppBrowser | null => {
    if (
        typeof window === 'undefined' ||
        typeof navigator === 'undefined' ||
        checkIsPwaInstalled()
    ) {
        return null;
    }

    return detectInAppBrowser(navigator.userAgent, {
        hasTelegramWebviewProxy: 'TelegramWebviewProxy' in window,
    });
};

// Without options the sign-in returns to this page; `/login` passes its `returnTo` and `locale`.
const AuthButtons = (options: SocialAuthOptions) => {
    const { t } = useTranslation('auth');
    // Set while the browser leaves for the provider; the page unloads, nothing resets it.
    const [isGoogleLoginLoading, setIsGoogleLoginLoading] = useState(false);
    const [inAppBrowser] = useState(readInAppBrowser);

    const handleGoogleSignIn = () => {
        const authUrl = getSocialAuthUrl('google', options);

        setIsGoogleLoginLoading(true);
        window.location.assign(authUrl);
    };

    return (
        <Flex direction="column" gap="4">
            {inAppBrowser ? <InAppBrowserNotice inAppBrowser={inAppBrowser} /> : null}
            <Button
                size="4"
                variant="soft"
                color={PROP_COLOR.info}
                radius="full"
                loading={isGoogleLoginLoading}
                disabled={isGoogleLoginLoading}
                onClick={handleGoogleSignIn}
            >
                <GoogleIconSvg width={18} height={18} />
                {t('button.google')}
            </Button>
        </Flex>
    );
};

export { AuthButtons };
