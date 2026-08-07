import { useEffect, useRef, useState } from 'react';
import i18n from 'i18n';
import {
    LucideDownload,
    LucideHouse,
    LucideRefreshCw,
    LucideTriangleAlert,
} from 'lucide-react';
import type { MouseEvent } from 'react';

import * as Sentry from '@sentry/react';

import { ROUTES } from 'constants/routes';
import { APP_VERSION } from 'constants/version';
import {
    activateServiceWorker,
    checkForServiceWorkerUpdate,
    reloadCurrentPage,
} from 'helpers/serviceWorkerRecovery';

import BackgroundBox from 'basics/BackgroundBox';

import './styles.css';

interface GlobalErrorFallbackProps {
    error: Error;
    timestamp: string;
}

const RECOVERY_ACTION = {
    dashboardNavigation: 'dashboard-navigation',
    manualReload: 'manual-reload',
    updateActivationFailed: 'update-activation-failed',
    updateApplied: 'update-applied',
} as const;

type RecoveryAction = (typeof RECOVERY_ACTION)[keyof typeof RECOVERY_ACTION];

const reportRecoveryAction = (
    action: RecoveryAction,
    error: Error,
    timestamp: string,
): void => {
    try {
        Sentry.captureMessage('Application recovery action', {
            extra: {
                action,
                appVersion: APP_VERSION,
                errorMessage: error.message,
                errorTimestamp: timestamp,
                route: window.location.pathname,
            },
            level: action === RECOVERY_ACTION.updateActivationFailed ? 'warning' : 'info',
            tags: {
                errorBoundary: 'global',
                recoveryAction: action,
            },
        });
    } catch {
        // Recovery must continue when diagnostics are unavailable or offline.
    }
};

const GlobalErrorFallback = ({ error, timestamp }: GlobalErrorFallbackProps) => {
    const [isActionPending, setIsActionPending] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const isActionPendingRef = useRef(false);

    useEffect(() => {
        let isMounted = true;

        void checkForServiceWorkerUpdate()
            .then(worker => {
                if (isMounted) {
                    setWaitingWorker(worker);
                }
            })
            .catch(() => undefined);

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
        reportRecoveryAction(RECOVERY_ACTION.manualReload, error, timestamp);
        reloadCurrentPage();
    };

    const onDashboard = (event: MouseEvent<HTMLAnchorElement>): void => {
        if (isActionPendingRef.current) {
            event.preventDefault();
            return;
        }

        reportRecoveryAction(RECOVERY_ACTION.dashboardNavigation, error, timestamp);
    };

    const onUpdate = (): void => {
        if (isActionPendingRef.current || !waitingWorker) {
            return;
        }

        isActionPendingRef.current = true;
        setIsActionPending(true);
        setIsUpdating(true);

        void activateServiceWorker(waitingWorker)
            .then(() => {
                reportRecoveryAction(RECOVERY_ACTION.updateApplied, error, timestamp);
            })
            .catch(() => {
                reportRecoveryAction(RECOVERY_ACTION.updateActivationFailed, error, timestamp);
            })
            .then(reloadCurrentPage);
    };

    return (
        <BackgroundBox>
            <main className="global-error" role="alert" aria-labelledby="global-error-title">
                <section className="global-error__panel">
                    <div className="global-error__icon" aria-hidden="true">
                        <LucideTriangleAlert size={34} strokeWidth={2} />
                    </div>

                    <p className="global-error__eyebrow">
                        {i18n.t('errorBoundary.runtimeError')}
                    </p>
                    <h1 id="global-error-title">{i18n.t('errorBoundary.title')}</h1>

                    <div className="global-error__actions">
                        <button
                            className="global-error__action global-error__action--primary"
                            type="button"
                            disabled={isActionPending}
                            onClick={onTryAgain}
                        >
                            <LucideRefreshCw size={19} aria-hidden="true" />
                            {i18n.t('errorBoundary.tryAgain')}
                        </button>

                        <a
                            className="global-error__action global-error__action--secondary"
                            href={ROUTES.DASHBOARD}
                            aria-disabled={isActionPending}
                            onClick={onDashboard}
                        >
                            <LucideHouse size={19} aria-hidden="true" />
                            {i18n.t('errorBoundary.goToDashboard')}
                        </a>
                    </div>

                    {waitingWorker && (
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
                                <LucideDownload size={19} aria-hidden="true" />
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
