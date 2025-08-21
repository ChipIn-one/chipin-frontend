import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';

import { HOUR } from 'constants/time';

const PWABadge = () => {
    const [visible, setVisible] = useState(true);
    const [offlineReady, setOfflineReady] = useState(false);
    const [needRefresh, setNeedRefresh] = useState(false);

    // registerSW возвращает функцию обновления — кладём в ref
    const updateSWRef = useRef<(reloadPage?: boolean) => void>(() => {});

    useEffect(() => {
        const updateSW = registerSW({
            onOfflineReady() {
                setOfflineReady(true);
                setVisible(true);
            },
            onNeedRefresh() {
                setNeedRefresh(true);
                setVisible(true);
            },
            // оставим периодическую проверку как было
            onRegisteredSW(swUrl, r) {
                if (HOUR > 0 && r) {
                    registerPeriodicSync(HOUR, swUrl, r);
                }
            },
        });

        updateSWRef.current = updateSW;
    }, []);

    if (!visible || (!offlineReady && !needRefresh)) {
        return null;
    }

    const closeAlert = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
        setVisible(false);
    };

    return (
        <Box position="fixed" bottom="4" right="4" role="alert" aria-labelledby="toast-message">
            <Card variant="classic" size="2">
                <Flex direction="column" gap="3">
                    <Text size="2" id="toast-message">
                        {offlineReady
                            ? 'App ready to work offline'
                            : 'New content available, click reload to update.'}
                    </Text>

                    <Flex justify="end" gap="2">
                        {needRefresh && (
                            <Button
                                size="1"
                                variant="solid"
                                onClick={() => updateSWRef.current?.(true)} // перезагрузка страницы после обновления SW
                            >
                                Reload
                            </Button>
                        )}
                        <Button size="1" variant="soft" onClick={closeAlert}>
                            Close
                        </Button>
                    </Flex>
                </Flex>
            </Card>
        </Box>
    );
};

export default PWABadge;

/**
 * Периодическая проверка обновлений SW.
 */
function registerPeriodicSync(period: number, swUrl: string, r: ServiceWorkerRegistration) {
    if (period <= 0) {
        return;
    }

    setInterval(async () => {
        if ('onLine' in navigator && !navigator.onLine) {
            return;
        }

        const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: { 'cache-control': 'no-cache' },
        });

        if (resp?.status === 200) {
            await r.update();
        }
    }, period);
}
