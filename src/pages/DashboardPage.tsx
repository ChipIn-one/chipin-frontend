import { LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';

import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import ActivityTemplate from 'components/ActivityTemplate';
import DashBoardSummary from 'components/DashboardSummary';
import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';
import MobileNavBar from 'components/Navs/MobileNavBar';

const DashboardPage = () => {
    const { t } = useTranslation();
    const isLoadingDashboard = useLoadingStore(state => state.dashboard.data);

    const { groups } = useGroupsStore();
    const hasGroups = groups.length > 0;

    return (
        <>
            <Container size="4">
                <Grid columns="3" gap="6">
                    <Box
                        gridColumn={{
                            initial: 'span 3',
                            sm: 'span 1',
                        }}
                        mb="6"
                    >
                        <DashBoardSummary isLoading={isLoadingDashboard} />

                        <Box>
                            <GroupsSectionHeader
                                mt="5"
                                mb="5"
                                label={t('dashboard.groups.title')}
                                buttonVariant={hasGroups ? 'soft' : 'solid'}
                            />

                            <Flex gap="4" direction="column">
                                {hasGroups ? (
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
                                                {t('dashboard.groups.emptyTitle')}
                                            </Text>

                                            <Text size="2" color="gray" align="center">
                                                {t('dashboard.groups.emptyDescription')}
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
                        <ActivityTemplate isLoading={isLoadingDashboard} />
                    </Box>
                </Grid>

                <MobileNavBar />
            </Container>
        </>
    );
};

export default DashboardPage;
