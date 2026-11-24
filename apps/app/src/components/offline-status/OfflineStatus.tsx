import { Badge } from '@radix-ui/themes';
import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConnectivityStore } from 'store/connectivityStore';

import styles from './OfflineStatus.module.css';

/**
 * Compact offline status above every dialog and sheet (NET-004). Informational only: no focusable
 * element and no pointer input; the inline `OfflineBanner` keeps the Retry control.
 */
const OfflineStatus = () => {
    const { t } = useTranslation('errors');
    const isOffline = useConnectivityStore(state => state.mode === 'offline');

    if (!isOffline) {
        return null;
    }

    return (
        <div className={styles.root} role="status">
            <Badge color="amber" size="2" variant="solid" radius="full">
                <WifiOffIcon size={14} aria-hidden="true" />
                {t('network.offlineStatus')}
            </Badge>
        </div>
    );
};

export { OfflineStatus };
