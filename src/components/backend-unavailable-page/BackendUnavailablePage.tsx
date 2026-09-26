import { useEffect, useRef, useState } from 'react';
import { LucideRefreshCw, LucideTriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useBackendAvailabilityStore } from 'store/backendAvailabilityStore';

import {
    BackendUnavailableActions,
    BackendUnavailableButton,
    BackendUnavailableDescription,
    BackendUnavailableEyebrow,
    BackendUnavailableIcon,
    BackendUnavailablePanel,
    BackendUnavailableRetryMessage,
    BackendUnavailableSurface,
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
        <BackendUnavailableSurface role="alert" aria-labelledby="backend-unavailable-title">
            <BackendUnavailablePanel>
                <BackendUnavailableIcon aria-hidden="true">
                    <LucideTriangleAlert size={34} strokeWidth={2} />
                </BackendUnavailableIcon>

                <BackendUnavailableEyebrow>
                    {t('backendUnavailable.eyebrow')}
                </BackendUnavailableEyebrow>
                <BackendUnavailableTitle id="backend-unavailable-title">
                    {t('backendUnavailable.title')}
                </BackendUnavailableTitle>
                <BackendUnavailableDescription>
                    {t('backendUnavailable.description')}
                </BackendUnavailableDescription>

                <BackendUnavailableActions>
                    <BackendUnavailableButton
                        type="button"
                        disabled={isChecking}
                        onClick={onTryAgain}
                    >
                        <LucideRefreshCw size={19} aria-hidden="true" />
                        {isChecking
                            ? t('backendUnavailable.checking')
                            : t('backendUnavailable.tryAgain')}
                    </BackendUnavailableButton>
                </BackendUnavailableActions>

                {hasRetryFailed && (
                    <BackendUnavailableRetryMessage role="status" aria-live="polite">
                        {t('backendUnavailable.retryFailed')}
                    </BackendUnavailableRetryMessage>
                )}
            </BackendUnavailablePanel>
        </BackendUnavailableSurface>
    );
};

export { BackendUnavailablePage };
