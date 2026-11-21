import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Callout, Flex, Heading, Text } from '@radix-ui/themes';
import * as Sentry from '@sentry/react';
import { onlineManager } from '@tanstack/react-query';
import { DownloadIcon, HouseIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    isRouteErrorResponse,
    Link,
    useLocation,
    useMatches,
    useNavigate,
    useRouteError,
} from 'react-router-dom';

import { SS_KEY_ROUTE_CHUNK_RELOAD } from 'constants/localstorage';
import { ROUTES } from 'constants/routes';
import { checkForServiceWorkerUpdate, reloadApp, updateServiceWorker } from 'helpers/appUpdate';
import { SessionStorage } from 'helpers/localStorage';
import { Page404 } from 'pages/404-page';
import { isNetworkUsable } from 'shared/offline/network';

import BackgroundBox from 'basics/BackgroundBox';

import { markRouteErrorShown } from './routeErrorTitle';

const CHUNK_ERROR_PATTERN =
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/;

const isChunkLoadError = (error: unknown): boolean =>
    error instanceof Error && CHUNK_ERROR_PATTERN.test(error.message);

const isNotFoundError = (error: unknown): boolean =>
    isRouteErrorResponse(error) && error.status === 404;

const subscribeNetwork = (listener: () => void): (() => void) => onlineManager.subscribe(listener);

/**
 * One automatic reload per session (spec 04 §2.5), so a chunk that still fails after it cannot
 * loop. The flag must read back after it is written: with storage that throws, nothing reloads by
 * itself and only the button is left.
 */
const claimAutoReload = (): boolean => {
    if (SessionStorage.getRaw(SS_KEY_ROUTE_CHUNK_RELOAD) !== null) {
        return false;
    }
    SessionStorage.setRaw(SS_KEY_ROUTE_CHUNK_RELOAD, '1');

    return SessionStorage.getRaw(SS_KEY_ROUTE_CHUNK_RELOAD) === '1';
};

// A reload that finds a waiting worker applies it; otherwise it just reloads. A manual click cannot
// loop, and the expense draft is kept: a failed chunk is not what the draft crashed.
const applyUpdateOrReload = (): Promise<void> =>
    checkForServiceWorkerUpdate().then(
        hasWaitingWorker => {
            if (hasWaitingWorker) {
                return updateServiceWorker(true);
            }
            reloadApp();
            return undefined;
        },
        () => reloadApp(),
    );

const ChunkErrorCard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isOnline = useSyncExternalStore(subscribeNetwork, isNetworkUsable);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        // Offline the chunk was never fetched, not outdated: a reload would only reach the
        // browser's offline page and drop the app state.
        if (isNetworkUsable() && claimAutoReload()) {
            reloadApp();
        }
    }, []);

    if (!isOnline) {
        return (
            <Flex direction="column" align="center" gap="3" py="9" role="alert">
                <Text color="gray" align="center">
                    {t('errorBoundary.offlineChunk')}
                </Text>
                <Button
                    onClick={() => {
                        // The same URL again: the router retries the failed chunk.
                        void navigate(`${location.pathname}${location.search}`, { replace: true });
                    }}
                >
                    <RefreshCwIcon size={18} aria-hidden="true" />
                    {t('errorBoundary.tryAgain')}
                </Button>
            </Flex>
        );
    }

    return (
        <Flex direction="column" align="center" gap="3" py="9" role="alert">
            <Heading size="5">{t('errorBoundary.newVersionTitle')}</Heading>
            <Text color="gray" align="center">
                {t('errorBoundary.newVersionDescription')}
            </Text>
            <Button
                disabled={isUpdating}
                onClick={() => {
                    setIsUpdating(true);
                    void applyUpdateOrReload().finally(() => setIsUpdating(false));
                }}
            >
                <DownloadIcon size={18} aria-hidden="true" />
                {isUpdating ? t('errorBoundary.updatingApp') : t('errorBoundary.updateApp')}
            </Button>
        </Flex>
    );
};

const RecoveryCard = ({ error, routeId }: { error: unknown; routeId: string }) => {
    const { t } = useTranslation();
    const reported = useRef<unknown>(undefined);

    useEffect(() => {
        if (reported.current === error) {
            return;
        }
        reported.current = error;
        // Only the route id: the raw URL may carry an invite token (D1).
        Sentry.captureException(error, { tags: { routeId } });
    }, [error, routeId]);

    return (
        <Flex direction="column" align="center" gap="4" py="9">
            <Callout.Root color="red" role="alert">
                <Callout.Icon>
                    <TriangleAlertIcon size={18} />
                </Callout.Icon>
                <Callout.Text>{t('errorBoundary.title')}</Callout.Text>
            </Callout.Root>
            <Flex gap="3" wrap="wrap" justify="center">
                <Button onClick={() => reloadApp({ keepDraft: false })}>
                    <RefreshCwIcon size={18} aria-hidden="true" />
                    {t('errorBoundary.tryAgain')}
                </Button>
                <Button variant="soft" asChild>
                    <Link to={ROUTES.DASHBOARD} reloadDocument>
                        <HouseIcon size={18} aria-hidden="true" />
                        {t('errorBoundary.goToDashboard')}
                    </Link>
                </Button>
            </Flex>
        </Flex>
    );
};

/**
 * The one view of every route `errorElement` (spec 04 §2.5): a 404 response is NotFound (not sent
 * to Sentry), a failed chunk is the "new version" screen, anything else is reported with its route
 * id and shown as a recovery card.
 */
const RouteErrorView = () => {
    const error = useRouteError();
    const matches = useMatches();
    const { t } = useTranslation('meta');
    const isNotFound = isNotFoundError(error);
    const routeId = matches[matches.length - 1]?.id ?? 'unknown';

    useEffect(() => {
        const unmark = markRouteErrorShown();

        if (isNotFound) {
            document.title = t('notFound.title');
        }
        return unmark;
    }, [isNotFound, t]);

    if (isNotFound) {
        return <Page404 />;
    }
    if (isChunkLoadError(error)) {
        return <ChunkErrorCard />;
    }
    return <RecoveryCard error={error} routeId={routeId} />;
};

/** The root `errorElement`: it replaces `RootLayout`, so it brings its own background. */
const RootErrorBoundary = () => (
    <BackgroundBox>
        <RouteErrorView />
    </BackgroundBox>
);

export { isChunkLoadError, RootErrorBoundary, RouteErrorView };
