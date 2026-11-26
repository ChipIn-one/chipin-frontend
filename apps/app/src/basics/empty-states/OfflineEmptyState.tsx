import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

/**
 * Nothing cached and no network: no Retry, the page's offline banner has it and the load resumes
 * by itself on reconnect (states.md "Offline").
 */
const OfflineEmptyState = () => {
    const { t } = useTranslation('errors');

    return <EmptyState icon={<WifiOffIcon size={20} />} title={t('network.offline')} />;
};

export { OfflineEmptyState };
