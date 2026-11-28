import { PROP_COLOR } from '@chipin/tokens/theme';
import { ListIcon, WalletCardsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    /** The Solo page placeholder: the summary (side panel) or the activity column. */
    section: 'summary' | 'activity';
    action?: ReactNode;
}

// A Solo page placeholder while Solo features are in development (DSH-016).
const SoloInDevelopmentEmptyState = ({ section, action }: Props) => {
    const { t } = useTranslation('dashboard');

    return (
        <EmptyState
            icon={section === 'summary' ? <WalletCardsIcon size={20} /> : <ListIcon size={20} />}
            iconColor={PROP_COLOR.solo}
            title={section === 'summary' ? t('solo.summaryTitle') : t('solo.activityTitle')}
            description={t('solo.inDevelopment')}
            action={action}
        />
    );
};

export { SoloInDevelopmentEmptyState };
