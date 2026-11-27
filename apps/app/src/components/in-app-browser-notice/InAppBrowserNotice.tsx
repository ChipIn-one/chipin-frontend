import { useId, useState } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Box, Button, Callout, Code, Flex, Text } from '@radix-ui/themes';
import { CopyIcon, GlobeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { copyTextToClipboard } from 'helpers/clipboard';
import {
    buildAndroidChromeIntentUrl,
    canOpenInChrome,
    type InAppBrowser,
} from 'helpers/inAppBrowser';

import styles from './InAppBrowserNotice.module.css';

type CopyState = 'idle' | 'copied' | 'failed';

interface Props {
    inAppBrowser: InAppBrowser;
}

/**
 * AUTH-078: Google sign-in fails inside in-app browsers (`403 disallowed_useragent`), so this
 * notice, shown before the Google button, sends the person to a normal browser: "Open in Chrome"
 * through an `intent://` URL in Android apps known to hand it to the system (Instagram, Facebook,
 * Telegram), the app-menu steps (Android or iOS wording) and "Copy link" everywhere. The page URL
 * already carries the invite token; it only goes to the clipboard, the intent or the manual-copy
 * text on screen, never to logs.
 */
const InAppBrowserNotice = ({ inAppBrowser }: Props) => {
    const { t } = useTranslation('auth');
    const [href] = useState(() => window.location.href);
    const [intentUrl] = useState(() =>
        canOpenInChrome(inAppBrowser) ? buildAndroidChromeIntentUrl(href) : null,
    );
    const [copyState, setCopyState] = useState<CopyState>('idle');
    const addressLabelId = useId();
    const instructionsKey =
        inAppBrowser.platform === 'android'
            ? 'inAppBrowser.instructionsAndroid'
            : 'inAppBrowser.instructions';

    const handleCopy = (): void => {
        // Clear the previous result first so a repeated identical one is announced again.
        setCopyState('idle');
        void copyTextToClipboard(href).then(
            result => setCopyState(result === 'copied' ? 'copied' : 'failed'),
            () => setCopyState('failed'),
        );
    };

    return (
        <Callout.Root color={PROP_COLOR.warning} size="1">
            <Callout.Icon>
                <GlobeIcon size={16} aria-hidden="true" />
            </Callout.Icon>
            <Flex direction="column" gap="3">
                <Callout.Text>{t('inAppBrowser.notice')}</Callout.Text>
                <Callout.Text>{t(instructionsKey)}</Callout.Text>
                <Flex gap="2" wrap="wrap">
                    {intentUrl ? (
                        <Button asChild size="2" color={PROP_COLOR.warning}>
                            <a href={intentUrl}>{t('inAppBrowser.openInChrome')}</a>
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        size="2"
                        variant={intentUrl ? 'outline' : 'solid'}
                        color={PROP_COLOR.warning}
                        onClick={handleCopy}
                    >
                        <CopyIcon size={16} aria-hidden="true" />
                        {t('inAppBrowser.copyLink')}
                    </Button>
                </Flex>
                <Box role="status" aria-live="polite">
                    {copyState === 'copied' ? (
                        <Text as="p" size="2" weight="medium">
                            {t('inAppBrowser.copied')}
                        </Text>
                    ) : null}
                    {copyState === 'failed' ? (
                        <Flex direction="column" gap="2">
                            <Text as="p" size="2" weight="medium">
                                {t('inAppBrowser.copyFailed')}
                            </Text>
                            <Box role="group" aria-labelledby={addressLabelId}>
                                <Text as="p" size="1" id={addressLabelId}>
                                    {t('inAppBrowser.linkLabel')}
                                </Text>
                                <Code size="2" variant="ghost" className={styles.address}>
                                    {href}
                                </Code>
                            </Box>
                        </Flex>
                    ) : null}
                </Box>
            </Flex>
        </Callout.Root>
    );
};

export { InAppBrowserNotice };
