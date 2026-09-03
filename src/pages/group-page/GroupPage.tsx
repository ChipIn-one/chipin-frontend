import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Box, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';

import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';

import { GroupCoverSection, GroupSummary, GroupTabsContent } from './components';
import { useConnect } from './internal';
import { GroupCoverBox } from './styled';

const GroupPage = () => {
    const { t } = useTranslation(['group', 'common', 'dashboard']);
    const {
        groups,
        selectedGroup,
        fetchSetGroupById,
        fetchMoreGroupActivity,
        setSelectedGroup,
        isGroupDataLoading,
        isGroupActivityNextPageLoading,
        isGroupActivityNextPageError,
        isGroupListFetched,
    } = useConnect();
    const { groupId } = useParams<{ groupId: string }>();
    const routeGroup = selectedGroup?.id === groupId ? selectedGroup : null;

    useEffect(() => {
        if (!groupId) {
            return;
        }

        const cachedGroup = groups.find(group => group.id === groupId);

        if (cachedGroup) {
            setSelectedGroup(cachedGroup);
            return;
        }

        fetchSetGroupById(groupId);
    }, [fetchSetGroupById, groupId, groups, setSelectedGroup]);

    if (!groupId) {
        return (
            <Container size="4" py="6">
                <Card>
                    <Text color="red">{t('group:page.notFound')}</Text>
                </Card>
            </Container>
        );
    }

    if (!routeGroup) {
        if (!isGroupListFetched || isGroupDataLoading) {
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
                    <GroupsCards groups={groups} selectedGroupId={routeGroup.id} />
                </Flex>

                {/* ── Main content column ── */}
                <Box
                    gridColumn={{ initial: 'span 3', sm: '1 / span 2' }}
                    gridRow={{ sm: '1' }}
                >
                    <GroupCoverBox mb={{ initial: '4', sm: '6' }}>
                        <GroupCoverSection
                            group={routeGroup}
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
                    <GroupTabsContent
                        group={routeGroup}
                        isGroupDataLoading={isGroupDataLoading}
                        fetchMoreGroupActivity={fetchMoreGroupActivity}
                        isGroupActivityNextPageLoading={isGroupActivityNextPageLoading}
                        isGroupActivityNextPageError={isGroupActivityNextPageError}
                    />
                </Box>
            </Grid>
        </Container>
    );
};

export default GroupPage;
