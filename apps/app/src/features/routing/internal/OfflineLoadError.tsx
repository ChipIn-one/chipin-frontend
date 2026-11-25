import { useEffect, useRef, useState } from 'react';
import { Button, Container, Flex } from '@radix-ui/themes';
import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConnectivityStore } from 'store/connectivityStore';

import { EmptyState } from 'basics/empty-states';

/**
 * The load error of a protected page on a cold start without a usable network and with no user
 * saved on this device (NET-008): there is no cache to show, so instead of an empty page (or an
 * endless loader) it says the data cannot be loaded without a network. Retry checks `/health` as
 * the offline banner does (NET-001); when the network is usable again `AuthLayout` goes back to the
 * session check. The inline offline banner is not shown here: one Retry on the screen.
 */
const OfflineLoadError = () => {
    const { t } = useTranslation('errors');
    const retryBackendHealth = useConnectivityStore(state => state.retryBackendHealth);
    const [isChecking, setIsChecking] = useState(false);
    const [hasRetryFailed, setHasRetryFailed] = useState(false);
    const isMountedRef = useRef(true);

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
        <Container size="4">
            <Flex direction="column" minHeight="100vh" justify="center" p="4">
                <div role="alert">
                    <EmptyState
                        icon={<WifiOffIcon size={20} aria-hidden="true" />}
                        iconColor="amber"
                        title={t('network.offlineLoadErrorTitle')}
                        description={t(
                            hasRetryFailed
                                ? 'network.retryFailedNoData'
                                : 'network.offlineLoadErrorDescription',
                        )}
                        actionPosition="below"
                        action={
                            <Button
                                type="button"
                                variant="soft"
                                loading={isChecking}
                                disabled={isChecking}
                                onClick={onRetry}
                            >
                                {t('network.retry')}
                            </Button>
                        }
                    />
                </div>
            </Flex>
        </Container>
    );
};

export { OfflineLoadError };
