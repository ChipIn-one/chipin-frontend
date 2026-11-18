import { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import { DownloadIcon, HouseIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

import { ROUTES } from 'constants/routes';
import { APP_VERSION } from 'constants/version';
import { checkForServiceWorkerUpdate, reloadApp, updateServiceWorker } from 'helpers/appUpdate';
import { i18n } from 'i18n';

import BackgroundBox from 'basics/BackgroundBox';

import './styles.css';

interface GlobalErrorFallbackProps {
    timestamp: string;
}

const RECOVERY_ACTION = {
    dashboardNavigation: 'dashboard-navigation',
    manualReload: 'manual-reload',
    updateApplied: 'update-applied',
} as const;

type RecoveryAction = (typeof RECOVERY_ACTION)[keyof typeof RECOVERY_ACTION];

const reportRecoveryAction = (action: RecoveryAction, timestamp: string): void => {
    try {
        Sentry.captureMessage('Application recovery action', {
            extra: {
                action,
                appVersion: APP_VERSION,
                errorTimestamp: timestamp,
            },
            level: 'info',
            tags: {
                errorBoundary: 'global',
                recoveryAction: action,
            },
        });
    } catch {
        // Recovery must continue when diagnostics are unavailable or offline.
    }
};

const GlobalErrorFallback = ({ timestamp }: GlobalErrorFallbackProps) => {
    const [isActionPending, setIsActionPending] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const isActionPendingRef = useRef(false);

    useEffect(() => {
        let isMounted = true;

        checkForServiceWorkerUpdate().then(
            hasWaitingWorker => {
                if (isMounted) {
                    setIsUpdateAvailable(hasWaitingWorker);
                }
            },
            () => {
                // Recovery UI can continue without an update check result.
            },
        );

        return () => {
            isMounted = false;
        };
    }, []);

    const onTryAgain = (): void => {
        if (isActionPendingRef.current) {
            return;
        }

        isActionPendingRef.current = true;
        setIsActionPending(true);
        reportRecoveryAction(RECOVERY_ACTION.manualReload, timestamp);
        reloadApp();
    };

    const onDashboard = (event: MouseEvent<HTMLAnchorElement>): void => {
        if (isActionPendingRef.current) {
            event.preventDefault();
            return;
        }

        reportRecoveryAction(RECOVERY_ACTION.dashboardNavigation, timestamp);
    };

    const onUpdate = (): void => {
        if (isActionPendingRef.current || !isUpdateAvailable) {
            return;
        }

        isActionPendingRef.current = true;
        setIsActionPending(true);
        setIsUpdating(true);

        // Spec 04 §2.11 (A-26): the single update path of `ServiceWorkerManager`. It reloads once
        // the new worker takes control, or after its timeout when the activation fails.
        reportRecoveryAction(RECOVERY_ACTION.updateApplied, timestamp);
        void updateServiceWorker(true);
    };

    return (
        <BackgroundBox>
            <main className="global-error" role="alert" aria-labelledby="global-error-title">
                <section className="global-error__panel">
                    <div className="global-error__icon" aria-hidden="true">
                        <TriangleAlertIcon size={34} strokeWidth={2} />
                    </div>

                    <p className="global-error__eyebrow">{i18n.t('errorBoundary.runtimeError')}</p>
                    <h1 id="global-error-title">{i18n.t('errorBoundary.title')}</h1>

                    <div className="global-error__actions">
                        <button
                            className="global-error__action global-error__action--primary"
                            type="button"
                            disabled={isActionPending}
                            onClick={onTryAgain}
                        >
                            <RefreshCwIcon size={19} aria-hidden="true" />
                            {i18n.t('errorBoundary.tryAgain')}
                        </button>

                        <a
                            className="global-error__action global-error__action--secondary"
                            href={ROUTES.DASHBOARD}
                            aria-disabled={isActionPending}
                            onClick={onDashboard}
                        >
                            <HouseIcon size={19} aria-hidden="true" />
                            {i18n.t('errorBoundary.goToDashboard')}
                        </a>
                    </div>

                    {isUpdateAvailable && (
                        <div className="global-error__update-section">
                            <div className="global-error__divider">
                                <span>{i18n.t('errorBoundary.or')}</span>
                            </div>
                            <button
                                className="global-error__action global-error__action--update"
                                type="button"
                                disabled={isActionPending}
                                onClick={onUpdate}
                            >
                                <DownloadIcon size={19} aria-hidden="true" />
                                {isUpdating
                                    ? i18n.t('errorBoundary.updatingApp')
                                    : i18n.t('errorBoundary.updateApp')}
                            </button>
                        </div>
                    )}
                </section>
            </main>
        </BackgroundBox>
    );
};

export { GlobalErrorFallback };
