import { useEffect, useRef, useState } from 'react';
import { LucideRefreshCw, LucideTriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Dialog } from '@radix-ui/themes';

import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import {
    BackendUnavailableActions,
    BackendUnavailableButton,
    BackendUnavailableDescription,
    BackendUnavailableEyebrow,
    BackendUnavailableIcon,
    BackendUnavailablePanel,
    BackendUnavailableRetryMessage,
    BackendUnavailableTitle,
} from './styled';

const BackendUnavailablePage = () => {
    const { t } = useTranslation('errors');
    const retryBackendHealth = useBackendAvailabilityStore(state => state.retryBackendHealth);
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
            <BackendUnavailablePanel
                onEscapeKeyDown={event => event.preventDefault()}
                onInteractOutside={event => event.preventDefault()}
            >
                <BackendUnavailableIcon aria-hidden="true">
                    <LucideTriangleAlert size={34} strokeWidth={2} />
                </BackendUnavailableIcon>

                <BackendUnavailableEyebrow>
                    {t('backendUnavailable.eyebrow')}
                </BackendUnavailableEyebrow>
                <BackendUnavailableTitle>{t('backendUnavailable.title')}</BackendUnavailableTitle>
                <BackendUnavailableDescription>
                    {t('backendUnavailable.description')}
                </BackendUnavailableDescription>

                <BackendUnavailableActions>
                    <BackendUnavailableButton
                        type="button"
                        size="4"
                        color="gray"
                        highContrast
                        disabled={isChecking}
                        loading={isChecking}
                        aria-busy={isChecking}
                        onClick={onTryAgain}
                    >
                        <LucideRefreshCw size={19} aria-hidden="true" />
                        {t('backendUnavailable.tryAgain')}
                    </BackendUnavailableButton>
                </BackendUnavailableActions>

                <BackendUnavailableRetryMessage
                    role="status"
                    aria-live="polite"
                    aria-hidden={!hasRetryFailed}
                    $visible={hasRetryFailed}
                >
                    {t('backendUnavailable.retryFailed')}
                </BackendUnavailableRetryMessage>
            </BackendUnavailablePanel>
        </Dialog.Root>
    );
};

export { BackendUnavailablePage };
