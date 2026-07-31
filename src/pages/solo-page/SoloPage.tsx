import { LucideList, LucideWalletCards } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Container, Flex, Grid } from '@radix-ui/themes';

import { EmptyState } from 'basics/empty-states';
import { DashboardHeader } from 'components/dashboard-summary';
import { MobileNavBar } from 'components/nav-bars';

const SoloPage = () => {
    const { t } = useTranslation('dashboard');

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <Grid columns="3" gap="6">
                <Flex
                    direction="column"
                    gap="4"
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 1',
                    }}
                >
                    <DashboardHeader />

                    <EmptyState
                        icon={<LucideWalletCards size={20} />}
                        iconColor="violet"
                        title={t('solo.summaryTitle')}
                        description={t('solo.inDevelopment')}
                    />
                </Flex>

                <Box
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 2',
                    }}
                >
                    <EmptyState
                        icon={<LucideList size={20} />}
                        iconColor="violet"
                        title={t('solo.activityTitle')}
                        description={t('solo.inDevelopment')}
                    />
                </Box>
            </Grid>

            <MobileNavBar />
        </Container>
    );
};

export default SoloPage;
