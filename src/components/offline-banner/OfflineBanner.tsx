import { useEffect, useRef, useState } from 'react';
import { Button, Callout, Flex } from '@radix-ui/themes';
import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useConnectivityStore } from 'store/connectivityStore';

/**
 * Non-blocking notice while the network is not usable (spec 03 §1.8); the app stays usable. Retry
 * probes `/health`: the way out when the browser never fires `online` (DNS/TLS failure, captive
 * portal) and nothing else sends a request.
 */
const OfflineBanner = () => {
    const { t } = useTranslation('errors');
    const { isOffline, retryBackendHealth } = useConnectivityStore(
        useShallow(state => ({
            isOffline: state.mode === 'offline',
            retryBackendHealth: state.retryBackendHealth,
        })),
    );
    const [isChecking, setIsChecking] = useState(false);
    const [hasRetryFailed, setHasRetryFailed] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    if (!isOffline) {
        return null;
    }

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
                <Callout.Text>
                    {t(hasRetryFailed ? 'network.retryFailed' : 'network.offlineBanner')}
                </Callout.Text>
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

export { OfflineBanner };
