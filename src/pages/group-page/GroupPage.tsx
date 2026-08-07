import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { Box, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';

import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupDataFetched, selectGroupDataLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectUserCurrency, useUsersStore } from 'store/users-store';

import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';

import { GroupCoverSection, GroupSummary, GroupTabsContent } from './components';
import { GroupCoverBox } from './styled';

const GroupPage = () => {
    const { t } = useTranslation(['group', 'common', 'dashboard']);
    const { groups, selectedGroup } = useGroupsStore(
        useShallow(s => ({
            groups: s.groups,
            selectedGroup: s.selectedGroup,
        })),
    );

    const fetchSetGroupById = useGroupsStore(state => state.fetchSetGroupById);
    const setSelectedGroupSummaryCurrency = useGroupsStore(
        state => state.setSelectedGroupSummaryCurrency,
    );
    const defaultCurrency = useUsersStore(selectUserCurrency);
    const currencies = useDashboardStore(state => state.currencies);
    const isGroupDataLoading = useLoadingStore(selectGroupDataLoading);
    const isGroupDataFetched = useLoadingStore(selectGroupDataFetched);
    const { groupId } = useParams<{ groupId: string }>();

    useEffect(() => {
        fetchSetGroupById(groupId).catch(() => undefined);
    }, [groupId, fetchSetGroupById]);

    useEffect(() => {
        setSelectedGroupSummaryCurrency(defaultCurrency);
    }, [
        defaultCurrency,
        currencies.base,
        currencies.fetchedAt,
        selectedGroup?.id,
        setSelectedGroupSummaryCurrency,
    ]);

    if (!groupId) {
        return (
            <Container size="4" py="6">
                <Card>
                    <Text color="red">{t('group:page.notFound')}</Text>
                </Card>
            </Container>
        );
    }

    if (!selectedGroup) {
        if (!isGroupDataFetched) {
            return null;
        }

        return (
            <Container size="4" py="6">
                <Card>
                    <Text color="red">{t('group:page.notFound')}</Text>
                </Card>
            </Container>
        );
    }

    return (
        <Container size="4" pb={{ initial: '9', sm: '4' }}>
            <Grid columns="3" gap="6">
                {/* ── Right sidebar (desktop) ── */}
                <Flex
                    direction="column"
                    gap="4"
                    gridColumn={{ initial: 'span 3', sm: '3' }}
                    gridRow={{ sm: '1' }}
                    mb="6"
                    display={{ initial: 'none', sm: 'flex' }}
                >
                    <GroupSummary isLoading={isGroupDataLoading} />
                    <GroupsSectionHeader
                        label={t('dashboard:groups.otherTitle')}
                        isLoading={isGroupDataLoading}
                    />
                    <GroupsCards groups={groups} selectedGroupId={selectedGroup.id} />
                </Flex>

                {/* ── Main content column ── */}
                <Box
                    gridColumn={{ initial: 'span 3', sm: '1 / span 2' }}
                    gridRow={{ sm: '1' }}
                >
                    <GroupCoverBox mb={{ initial: '4', sm: '6' }}>
                        <GroupCoverSection
                            group={selectedGroup}
                            isLoading={isGroupDataLoading}
                        />
                    </GroupCoverBox>

                    <Box
                        display={{ initial: 'block', sm: 'none' }}
                        mb="4"
                    >
                        <GroupSummary isLoading={isGroupDataLoading} />
                    </Box>

                    {/* Tabs: Expenses / Balances / Members */}
                    <GroupTabsContent group={selectedGroup} />
                </Box>
            </Grid>
        </Container>
    );
};

export default GroupPage;
