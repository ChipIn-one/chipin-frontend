import { useEffect } from 'react';
import { LucideArrowLeftRight, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

import {
    Box,
    Button,
    Card,
    Container,
    Flex,
    Grid,
    Inset,
    Separator,
    Skeleton,
    Text,
} from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupDataFetched, selectGroupDataLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import DashBoardSummary from 'components/DashboardSummary';
import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';
import { AddExpenseModal } from 'components/modals';
import MobileNavBar from 'components/nav-bars/MobileNavBar';
import UsersRow from 'components/UsersRow';

import GroupCoverSection from './components/GroupCoverSection';
import GroupTabsContent from './components/GroupTabsContent';

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
    const { groups, selectedGroup, fetchSetGroupById } = useGroupsStore();
    const isGroupDataLoading = useLoadingStore(selectGroupDataLoading);
    const isGroupDataFetched = useLoadingStore(selectGroupDataFetched);
    const { groupId } = useParams<{ groupId: string }>();

    useEffect(() => {
        fetchSetGroupById(groupId);
    }, [groupId, fetchSetGroupById]);

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
                <Box
                    gridColumn={{ initial: 'span 3', sm: 'span 1' }}
                    mb="6"
                    display={{ initial: 'none', sm: 'block' }}
                >
                    <DashBoardSummary />
                    <GroupsSectionHeader
                        mt="4"
                        mb="4"
                        label={t('dashboard:groups.otherTitle')}
                        isLoading={isGroupDataLoading}
                    />
                    <GroupsCards groups={groups.filter(group => group.id !== selectedGroup.id)} />
                </Box>

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
                    <Box display={{ initial: 'block', sm: 'none' }}>
                        <MobileCoverBox>
                            <GroupCoverSection
                                group={selectedGroup}
                                isLoading={isGroupDataLoading}
                                ratio={16 / 7}
                            />
                        </MobileCoverBox>
                        <Box mt="4">
                            <GroupCardBody group={selectedGroup} isLoading={isGroupDataLoading} />
                        </Box>
                    </Box>

                    {/* Tabs: Expenses / Balances / Members */}
                    <GroupTabsContent group={selectedGroup} />
                </Box>
            </Grid>

            <MobileNavBar />
        </Container>
    );
};

interface GroupCardBodyProps {
    group: ApiGroup;
    isLoading: boolean;
}

const GroupCardBody = ({ group, isLoading }: GroupCardBodyProps) => {
    const { t } = useTranslation(['group', 'common']);

    return (
        <Flex direction="column" gap="4">
            <Flex align="center" justify="between" gap="2" wrap="wrap">
                <UsersRow members={group.members} max={10} size="2" />
                <Flex gap="2" align="center">
                    <AddExpenseModal>
                        <Button variant="outline" size="2">
                            <LucidePlus size={15} />
                            {t('common:buttons.addExpense')}
                        </Button>
                    </AddExpenseModal>
                    <Button size="2" color="green">
                        <LucideArrowLeftRight size={15} />
                        {t('common:buttons.settleUp')}
                    </Button>
                </Flex>
            </Flex>

            {group.description && (
                <>
                    <Separator size="4" />
                    <Skeleton loading={isLoading}>
                        <Text size="2" color="gray">
                            {group.description}
                        </Text>
                    </Skeleton>
                </>
            )}
        </Flex>
    );
};

export default GroupPage;
