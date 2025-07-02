import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button, Card, Flex, Text } from '@radix-ui/themes';

const PWABadge = () => {
    const [visible, setVisible] = useState(true);

    // check for updates every hour
    const period = 60 * 60 * 1000;

    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            if (period <= 0) {
                return;
            }
            if (r?.active?.state === 'activated') {
                registerPeriodicSync(period, swUrl, r);
            } else if (r?.installing) {
                r.installing.addEventListener('statechange', e => {
                    const sw = e.target as ServiceWorker;
                    if (sw.state === 'activated') registerPeriodicSync(period, swUrl, r);
                });
            }
        },
    });

    if (!visible) {
        return null;
    }

    const closeAlert = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
        setVisible(false);
    };

    return (
        (offlineReady || needRefresh) && (
            <div
                role="alert"
                aria-labelledby="toast-message"
                style={{
                    position: 'fixed',
                    bottom: '1rem',
                    right: '1rem',
                    zIndex: 9999,
                }}
            >
                <Card
                    variant="classic"
                    style={{
                        maxWidth: '320px',
                        padding: '1rem',
                    }}
                >
                    <Flex direction="column" gap="3">
                        <Text size="2" id="toast-message">
                            {offlineReady
                                ? 'App ready to work offline'
                                : 'New content available, click reload to update.'}
                        </Text>

                        <Flex justify="end" gap="2">
                            {!needRefresh && (
                                <Button
                                    size="1"
                                    variant="solid"
                                    onClick={() => {
                                        updateServiceWorker(true);
                                    }}
                                >
                                    Reload
                                </Button>
                            )}
                            <Button
                                size="1"
                                variant="soft"
                                onClick={() => {
                                    closeAlert?.();
                                }}
                            >
                                Close
                            </Button>
                        </Flex>
                    </Flex>
                </Card>
            </div>
        )
    );
};

export default PWABadge;

/**
 * This function will register a periodic sync check every hour, you can modify the interval as needed.
 */
const registerPeriodicSync = (period: number, swUrl: string, r: ServiceWorkerRegistration) => {
    if (period <= 0) return;

    setInterval(async () => {
        if ('onLine' in navigator && !navigator.onLine) return;

        const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: {
                cache: 'no-store',
                'cache-control': 'no-cache',
            },
        });

        if (resp?.status === 200) {
            await r.update();
        }
    }, period);
};
