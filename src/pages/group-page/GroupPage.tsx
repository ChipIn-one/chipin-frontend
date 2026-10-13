import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Box, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';

import GroupsCards from 'components/GroupsCards';

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
        isGroupDataLoading,
        isGroupActivityNextPageLoading,
        isGroupActivityNextPageError,
        isGroupDataFetched,
    } = useConnect();
    const { groupId } = useParams<{ groupId: string }>();
    const routeGroup = selectedGroup?.id === groupId ? selectedGroup : null;
    const requestedRouteId = useRef<string | null>(null);

    useEffect(() => {
        if (!groupId || requestedRouteId.current === groupId) {
            return;
        }

        requestedRouteId.current = groupId;
        if (selectedGroup?.id !== groupId) {
            fetchSetGroupById(groupId, true);
        }
    }, [fetchSetGroupById, groupId, selectedGroup?.id]);

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
        if (!isGroupDataFetched || isGroupDataLoading) {
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
                <Flex
                    direction="column"
                    gap="4"
                    gridColumn={{ initial: 'span 3', sm: '3' }}
                    gridRow={{ sm: '1' }}
                    mb="6"
                    display={{ initial: 'none', sm: 'flex' }}
                >
                    <GroupSummary isLoading={isGroupDataLoading} />
                    <GroupsCards
                        groups={groups}
                        label={t('dashboard:groups.otherTitle')}
                        selectedGroupId={routeGroup.id}
                    />
                </Flex>

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

                    <Box display={{ initial: 'block', sm: 'none' }} mb="4">
                        <GroupSummary isLoading={isGroupDataLoading} />
                    </Box>

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
