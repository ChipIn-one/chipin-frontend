import { LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';

import { useGroupsStore } from 'store/groupsStore';
import { selectDashboardFetched, selectDashboardLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import DashBoardSummary from 'components/DashboardSummary';
import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';
import MobileNavBar from 'components/Navs/MobileNavBar';
import { ActivityHeader } from 'features/activity';

const DashboardPage = () => {
    const { t } = useTranslation('dashboard');
    const isDashboardLoading = useLoadingStore(selectDashboardLoading);
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);

    const { groups } = useGroupsStore();
    const hasGroups = groups.length > 0;

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <Grid columns="3" gap="6">
                <Box
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 1',
                    }}
                >
                    <DashBoardSummary isLoading={isDashboardLoading} />

                    <Box>
                        <GroupsSectionHeader
                            mt="4"
                            mb="4"
                            label={t('groups.title')}
                            isLoading={isDashboardLoading}
                        />

                        <Flex gap="4" direction="column">
                            {!isDashboardFetched || hasGroups ? (
                                <GroupsCards groups={groups} />
                            ) : (
                                <Card size="2">
                                    <Flex
                                        direction="column"
                                        align="center"
                                        gap="2"
                                        px={{ initial: '2', sm: '4' }}
                                        py={{ initial: '3', sm: '4' }}
                                    >
                                        <LucideUsers size={20} />

                                        <Text size="4" weight="medium" align="center">
                                            {t('groups.emptyTitle')}
                                        </Text>

                                        <Text size="2" color="gray" align="center">
                                            {t('groups.emptyDescription')}
                                        </Text>
                                    </Flex>
                                </Card>
                            )}
                        </Flex>
                    </Box>
                </Box>

                <Box
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 2',
                    }}
                >
                    <ActivityHeader isLoading={isDashboardLoading} context="dashboard" />
                </Box>
            </Grid>

            <MobileNavBar />
        </Container>
    );
};

export default DashboardPage;
