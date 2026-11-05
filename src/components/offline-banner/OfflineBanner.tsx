import { Callout } from '@radix-ui/themes';
import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConnectivityStore } from 'store/connectivityStore';

/** Non-blocking notice while the network is not usable (spec 03 §1.8); the app stays usable. */
const OfflineBanner = () => {
    const { t } = useTranslation('errors');
    const isOffline = useConnectivityStore(state => state.mode === 'offline');

    if (!isOffline) {
        return null;
    }

    return (
        <Callout.Root color="amber" size="1" mb="3" role="status" aria-live="polite">
            <Callout.Icon>
                <WifiOffIcon size={16} aria-hidden="true" />
            </Callout.Icon>
            <Callout.Text>{t('network.offlineBanner')}</Callout.Text>
        </Callout.Root>
    );
};

export { OfflineBanner };
