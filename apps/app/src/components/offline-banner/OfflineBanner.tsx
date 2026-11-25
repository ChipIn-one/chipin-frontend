import { useEffect, useRef, useState } from 'react';
import { Button, Callout, Flex } from '@radix-ui/themes';
import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTabUserId } from 'hooks/useTabUserId';
import { useConnectivityStore } from 'store/connectivityStore';

const noticeKey = (hasRetryFailed: boolean, hasSavedUser: boolean) => {
    if (hasRetryFailed) {
        return hasSavedUser ? 'network.retryFailed' : 'network.retryFailedNoData';
    }
    return hasSavedUser ? 'network.offlineBanner' : 'network.offlineBannerNoData';
};

// Mounted only while offline, so every offline episode starts with fresh retry state.
const OfflineNotice = () => {
    const { t } = useTranslation('errors');
    const retryBackendHealth = useConnectivityStore(state => state.retryBackendHealth);
    const [isChecking, setIsChecking] = useState(false);
    const [hasRetryFailed, setHasRetryFailed] = useState(false);
    const isMountedRef = useRef(true);
    // NET-001: with no user saved on this device there is no saved data to speak of.
    const hasSavedUser = useTabUserId() !== undefined;

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const onRetry = (): void => {
        if (isChecking) {
            return;
        }
        setIsChecking(true);
        setHasRetryFailed(false);

        retryBackendHealth()
            .then(
                () => undefined,
                () => {
                    if (isMountedRef.current) {
                        setHasRetryFailed(true);
                    }
                },
            )
            .finally(() => {
                if (isMountedRef.current) {
                    setIsChecking(false);
                }
            });
    };

    return (
        <Callout.Root color="amber" size="1" mb="3" role="status" aria-live="polite">
            <Callout.Icon>
                <WifiOffIcon size={16} aria-hidden="true" />
            </Callout.Icon>
            <Flex align="center" justify="between" gap="3" wrap="wrap">
                <Callout.Text>{t(noticeKey(hasRetryFailed, hasSavedUser))}</Callout.Text>
                <Button
                    type="button"
                    size="1"
                    variant="soft"
                    color="amber"
                    loading={isChecking}
                    disabled={isChecking}
                    onClick={onRetry}
                >
                    {t('network.retry')}
                </Button>
            </Flex>
        </Callout.Root>
    );
};

/**
 * Non-blocking notice while the network is not usable (spec 03 §1.8); the app stays usable. Retry
 * probes `/health`: the way out when the browser never fires `online` (DNS/TLS failure, captive
 * portal) and nothing else sends a request.
 */
const OfflineBanner = () => {
    const isOffline = useConnectivityStore(state => state.mode === 'offline');

    return isOffline ? <OfflineNotice /> : null;
};

export { OfflineBanner };
