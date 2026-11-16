import { useEffect } from 'react';
import { Box, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useGroupActivity, useGroupDetail } from 'hooks/useGroupDetail';
import { useGroups } from 'hooks/useGroupsList';
import { useUiPrefsStore } from 'store/ui-prefs';

import GroupsCards from 'components/GroupsCards';

import { GroupCoverSection, GroupSummary, GroupTabsContent } from './components';
import { GroupCoverBox } from './styled';

const GroupPage = () => {
    const { t } = useTranslation(['group', 'common', 'dashboard']);
    const groups = useGroups();
    const { groupId } = useParams<{ groupId: string }>();
    const detail = useGroupDetail(groupId);
    const routeGroup = detail.group;
    const activity = useGroupActivity(
        groupId ?? '',
        detail.hasDetail,
        routeGroup?.recentActivities,
    );
    const setLastGroupId = useUiPrefsStore(state => state.setLastGroupId);
    const isGroupDataLoading = detail.isLoading;

    // The opened group is the expense editor's default; a group the user may not read is not.
    useEffect(() => {
        if (groupId && routeGroup) {
            setLastGroupId(groupId);
        } else if (
            groupId &&
            detail.isDenied &&
            useUiPrefsStore.getState().lastGroupId === groupId
        ) {
            setLastGroupId(null);
        }
    }, [detail.isDenied, groupId, routeGroup, setLastGroupId]);

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
        if (isGroupDataLoading) {
            return null;
        }

        // TODO(04): the route's errorElement (spec 04 §2.5) once the data router lands; until then
        // a denied (403/404) detail, or a failed one of an unlisted group, shows this card, and the
        // list drops a denied group.
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
                    <GroupSummary group={routeGroup} isLoading={isGroupDataLoading} />
                    <GroupsCards
                        groups={groups}
                        label={t('dashboard:groups.otherTitle')}
                        selectedGroupId={routeGroup.id}
                    />
                </Flex>

                <Box gridColumn={{ initial: 'span 3', sm: '1 / span 2' }} gridRow={{ sm: '1' }}>
                    <GroupCoverBox mb={{ initial: '4', sm: '6' }}>
                        <GroupCoverSection group={routeGroup} isLoading={isGroupDataLoading} />
                    </GroupCoverBox>

                    <Box display={{ initial: 'block', sm: 'none' }} mb="4">
                        <GroupSummary group={routeGroup} isLoading={isGroupDataLoading} />
                    </Box>

                    <GroupTabsContent
                        group={routeGroup}
                        isGroupDataLoading={isGroupDataLoading}
                        activity={activity}
                    />
                </Box>
            </Grid>
        </Container>
    );
};

export default GroupPage;
