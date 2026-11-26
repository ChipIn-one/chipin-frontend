import { useEffect, useRef, useState } from 'react';
import { Button, Dialog } from '@radix-ui/themes';
import { RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConnectivityStore } from 'store/connectivityStore';

import styles from './BackendUnavailablePage.module.css';

const BackendUnavailablePage = () => {
    const { t } = useTranslation('errors');
    const retryBackendHealth = useConnectivityStore(state => state.retryBackendHealth);
    const [isChecking, setIsChecking] = useState(false);
    const [hasRetryFailed, setHasRetryFailed] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const onTryAgain = (): void => {
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
        <Dialog.Root open>
            <Dialog.Content
                className={styles.root}
                onEscapeKeyDown={event => event.preventDefault()}
                onInteractOutside={event => event.preventDefault()}
            >
                <div className={styles.icon} aria-hidden="true">
                    <TriangleAlertIcon size={34} strokeWidth={2} />
                </div>

                <p className={styles.eyebrow}>{t('backendUnavailable.eyebrow')}</p>
                <Dialog.Title className={styles.title}>
                    {t('backendUnavailable.title')}
                </Dialog.Title>
                <Dialog.Description className={styles.description}>
                    {t('backendUnavailable.description')}
                </Dialog.Description>

                <div className={styles.actions}>
                    <Button
                        className={styles.retryButton}
                        type="button"
                        size="4"
                        color="gray"
                        highContrast
                        disabled={isChecking}
                        loading={isChecking}
                        aria-busy={isChecking}
                        onClick={onTryAgain}
                    >
                        <RefreshCwIcon size={19} aria-hidden="true" />
                        {t('backendUnavailable.tryAgain')}
                    </Button>
                </div>

                <p
                    className={styles.retryMessage}
                    role="status"
                    aria-live="polite"
                    aria-hidden={!hasRetryFailed}
                    data-visible={hasRetryFailed}
                >
                    {t('backendUnavailable.retryFailed')}
                </p>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export { BackendUnavailablePage };
