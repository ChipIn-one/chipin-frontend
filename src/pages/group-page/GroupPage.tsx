import { useEffect } from 'react';
import { LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Card, Container, Flex, Grid, Inset, Skeleton, Text } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { useDashboardStore } from 'store/dashboardStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupDataFetched, selectGroupDataLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectUserCurrency } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';
import { SettleUpModal } from 'components/modals/';
import { MobileNavBar } from 'components/nav-bars';
import UsersRow from 'components/UsersRow';

import { GroupCoverSection, GroupSummary, GroupTabsContent } from './components';

/**
 * On mobile the cover is rendered full-bleed at the top of the page
 * (outside the Card Inset) so it bleeds to screen edges.
 */
const MobileCoverBox = styled(Box)`
    margin-left: calc(-1 * var(--space-4));
    margin-right: calc(-1 * var(--space-4));
    margin-top: calc(-1 * var(--space-4));
`;

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
                {/* ── Left sidebar (desktop) ── */}
                <Flex
                    direction="column"
                    gap="4"
                    gridColumn={{ initial: 'span 3', sm: 'span 1' }}
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
                <Box gridColumn={{ initial: 'span 3', sm: 'span 2' }}>
                    {/* Desktop: cover inside a Card with Inset */}
                    <Box display={{ initial: 'none', sm: 'block' }}>
                        <Card size="4" mb="6">
                            <Inset clip="border-box" side="top" pb="current">
                                <GroupCoverSection
                                    group={selectedGroup}
                                    isLoading={isGroupDataLoading}
                                    ratio={16 / 4}
                                />
                            </Inset>
                            <GroupCardBody group={selectedGroup} isLoading={isGroupDataLoading} />
                        </Card>
                    </Box>

                    {/* Mobile: cover full-bleed inset at top, then card body below */}
                    <Flex
                        direction="column"
                        gap="4"
                        display={{ initial: 'flex', sm: 'none' }}
                    >
                        <MobileCoverBox>
                            <GroupCoverSection
                                group={selectedGroup}
                                isLoading={isGroupDataLoading}
                                ratio={16 / 7}
                            />
                        </MobileCoverBox>
                        <GroupCardBody group={selectedGroup} isLoading={isGroupDataLoading} />
                        <GroupSummary isLoading={isGroupDataLoading} />
                    </Flex>

                    {/* Tabs: Expenses / Balances / Members */}
                    <GroupTabsContent group={selectedGroup} />
                </Box>
            </Grid>

            <MobileNavBar />
        </Container>
    );
};

interface GroupCardBodyProps {
    group: Group;
    isLoading: boolean;
}

const GroupCardBody = ({ group, isLoading }: GroupCardBodyProps) => {
    const { t } = useTranslation(['group', 'common']);
    const openAddExpenseModal = useExpenseModalStore(state => state.open);

    return (
        <Flex direction="column" gap="4">
            <Flex align="center" justify="between" gap="2" wrap="wrap">
                <UsersRow members={group.members.map(member => member.user)} max={10} size="2" />
                <Flex gap="2" align="center">
                    <Button
                        variant="outline"
                        size="2"
                        disabled={group.members.length === 0}
                        onClick={() => openAddExpenseModal()}
                    >
                        <LucidePlus size={15} />
                        {t('common:buttons.addExpense')}
                    </Button>
                    <SettleUpModal source="group" group={group} />
                </Flex>
            </Flex>

            {group.description && (
                <Text size="2" color="gray">
                    <Skeleton loading={isLoading}>
                        {group.description}
                    </Skeleton>
                </Text>
            )}
        </Flex>
    );
};

export default GroupPage;
