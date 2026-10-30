import { ListIcon, WalletCardsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Container, Flex } from '@radix-ui/themes';

import { EmptyState } from 'basics/empty-states';
import { DashboardHeader } from 'components/dashboard-summary';
import { InternalPageColumnsFromSm } from 'components/internal-page-layout';

const SoloPage = () => {
    const { t } = useTranslation('dashboard');

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumnsFromSm
                sidePanel={
                    <Flex direction="column" gap="4">
                        <DashboardHeader />

                        <EmptyState
                            icon={<WalletCardsIcon size={20} />}
                            iconColor="violet"
                            title={t('solo.summaryTitle')}
                            description={t('solo.inDevelopment')}
                        />
                    </Flex>
                }
            >
                <EmptyState
                    icon={<ListIcon size={20} />}
                    iconColor="violet"
                    title={t('solo.activityTitle')}
                    description={t('solo.inDevelopment')}
                />
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default SoloPage;
