import { LucideList, LucideWalletCards } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Flex } from '@radix-ui/themes';

import { EmptyState } from 'basics/empty-states';

import { LandingPreviewCard } from '../landing-preview-card';

const SoloPagePreview = () => {
    const { t } = useTranslation('landing');
    const { t: tDashboard } = useTranslation('dashboard');

    return (
        <LandingPreviewCard label={t('sections.expenses.preview.label')}>
            <Flex direction="column" gap="4" p="4">
                <EmptyState
                    icon={<LucideWalletCards size={20} />}
                    iconColor="violet"
                    title={tDashboard('solo.summaryTitle')}
                    description={tDashboard('solo.inDevelopment')}
                />
                <EmptyState
                    icon={<LucideList size={20} />}
                    iconColor="violet"
                    title={tDashboard('solo.activityTitle')}
                    description={tDashboard('solo.inDevelopment')}
                />
            </Flex>
        </LandingPreviewCard>
    );
};

export default SoloPagePreview;
