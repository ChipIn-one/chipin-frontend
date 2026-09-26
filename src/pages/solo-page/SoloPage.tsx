import { LucideList, LucideWalletCards } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Container, Flex } from '@radix-ui/themes';

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
                        <Box display={{ initial: 'block', lg: 'none' }}>
                            <DashboardHeader />
                        </Box>

                        <EmptyState
                            icon={<LucideWalletCards size={20} />}
                            iconColor="violet"
                            title={t('solo.summaryTitle')}
                            description={t('solo.inDevelopment')}
                        />
                    </Flex>
                }
            >
                <EmptyState
                    icon={<LucideList size={20} />}
                    iconColor="violet"
                    title={t('solo.activityTitle')}
                    description={t('solo.inDevelopment')}
                />
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default SoloPage;
