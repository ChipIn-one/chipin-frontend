import { PROP_COLOR } from '@chipin/tokens/theme';
import { Badge } from '@radix-ui/themes';
import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useConnectivityStore } from 'store/connectivityStore';

import { useIsDialogOpen } from './useIsDialogOpen';

import styles from './OfflineStatus.module.css';

// Mounted only while offline, so the `<body>` observer of `useIsDialogOpen` runs only then.
const OfflineStatusPill = () => {
    const { t } = useTranslation('errors');
    const isDialogOpen = useIsDialogOpen();

    if (!isDialogOpen) {
        return null;
    }

    return (
        <div className={styles.root} role="status">
            <Badge color={PROP_COLOR.warning} size="2" variant="solid" radius="full">
                <WifiOffIcon size={14} aria-hidden="true" />
                {t('network.offlineStatus')}
            </Badge>
        </div>
    );
};

/**
 * Compact offline status above every dialog and sheet (NET-004). Shown only while one is open: on a
 * page the inline `OfflineBanner` is the one offline indicator (#936). Informational only: no
 * focusable element and no pointer input; the inline `OfflineBanner` keeps the Retry control.
 */
const OfflineStatus = () => {
    const isOffline = useConnectivityStore(state => state.mode === 'offline');

    return isOffline ? <OfflineStatusPill /> : null;
};

export { OfflineStatus };
