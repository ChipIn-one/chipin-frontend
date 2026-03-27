import { LucidePlus, LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Container, Flex, Grid, Text } from '@radix-ui/themes';

import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import ActivityTemplate from 'components/ActivityTemplate';
import DashBoardSummary from 'components/DashboardSummary';
import GroupsCards from 'components/GroupsCards';
import CreateUpdateGroupModal from 'components/Modal/CreateUpdateGroupModal';
import MobileNavBar from 'components/Navs/MobileNavBar';

const DashboardPage = () => {
    const { t } = useTranslation();
    const isLoadingDashboard = useLoadingStore(state => state.dashboard.data);

    const { groups } = useGroupsStore();

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
                            <Flex gap="2" mb="6" mt="6">
                                <Flex width="100%" pl="2" pr="2">
                                    <Flex align="center" gap="2">
                                        <LucideUsers />
                                        <Text weight="medium">{t('dashboard.groups.title')}</Text>
                                    </Flex>
                                </Flex>
                            </Flex>

                            <Flex gap="5" direction="column">
                                <GroupsCards groups={groups} />

                                <Box display={{ initial: 'none', sm: 'block' }}>
                                    <CreateUpdateGroupModal type="create">
                                        <Button size="3" variant="soft">
                                            {t('dashboard.groups.addNew')}
                                            <LucidePlus />
                                        </Button>
                                    </CreateUpdateGroupModal>
                                </Box>
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
