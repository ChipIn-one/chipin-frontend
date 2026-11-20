import { useState } from 'react';
import { Box, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    isPageControlledByServiceWorker,
    reloadApp,
    resolveServiceWorkerRegistration,
    updateServiceWorker,
    waitForWaitingWorker,
} from 'helpers/appUpdate';

import { UPDATE_REQUIRED_WAIT_MS, useIsUpdateRequired } from './updateRequired';

type UpdateStatus = 'idle' | 'checking' | 'notPublished';

/**
 * The button of the screen (spec 04 §2.11 item 4): `registration.update()`, wait for `waiting` up to
 * 10 s, then `updateServiceWorker(true)`. Resolves `false` when no new worker came: the page is not
 * reloaded, otherwise the same version would load again (C3-26). The registration is the manager's,
 * else the browser's. Only a page that no worker controls (no SW support, a hard reload) is
 * reloaded without one: nothing is served from a precache there, so the reload fetches the newest
 * build. A controlled page without a waiting worker is never reloaded.
 */
export const applyRequiredUpdate = (): Promise<boolean> =>
    resolveServiceWorkerRegistration().then(registration => {
        if (!registration) {
            if (isPageControlledByServiceWorker()) {
                return false;
            }
            reloadApp();
            return true;
        }

        return waitForWaitingWorker(registration, UPDATE_REQUIRED_WAIT_MS).then(hasWaiting => {
            if (hasWaiting) {
                void updateServiceWorker(true);
            }
            return hasWaiting;
        });
    });

const UpdateRequiredView = () => {
    const { t } = useTranslation('pwa');
    const [status, setStatus] = useState<UpdateStatus>('idle');

    const onUpdate = (): void => {
        setStatus('checking');
        void applyRequiredUpdate().then(isApplied => {
            if (!isApplied) {
                setStatus('notPublished');
            }
        });
    };

    return (
        <Box
            position="fixed"
            inset="0"
            p="4"
            style={{ zIndex: 2147483000, background: 'var(--color-background)' }}
        >
            <Flex height="100%" align="center" justify="center">
                <Card size="3" style={{ maxWidth: 420 }}>
                    <Flex
                        direction="column"
                        gap="3"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="update-required-title"
                        aria-describedby="update-required-description"
                    >
                        <Heading as="h1" size="5" id="update-required-title">
                            {t('updateRequired.title')}
                        </Heading>
                        <Text as="p" color="gray" id="update-required-description">
                            {t('updateRequired.description')}
                        </Text>
                        {status === 'notPublished' && (
                            <Text as="p" color="amber" role="status">
                                {t('updateRequired.notPublished')}
                            </Text>
                        )}
                        <Button
                            size="3"
                            color="jade"
                            disabled={status === 'checking'}
                            onClick={onUpdate}
                        >
                            <RefreshCwIcon size={16} aria-hidden="true" />
                            {status === 'checking'
                                ? t('updateRequired.checking')
                                : t('updateRequired.action')}
                        </Button>
                    </Flex>
                </Card>
            </Flex>
        </Box>
    );
};

/** Blocks the app while an update is required (`showUpdateRequired()`, driven by the backend minimum version). */
export const UpdateRequiredScreen = () => {
    const isRequired = useIsUpdateRequired();

    return isRequired ? <UpdateRequiredView /> : null;
};
