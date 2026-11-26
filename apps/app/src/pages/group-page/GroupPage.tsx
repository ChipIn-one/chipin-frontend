import { type ReactNode, useEffect } from 'react';
import { Box, Button, Container, Flex, Grid } from '@radix-ui/themes';
import { RefreshCwIcon, WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useGroupActivity, useGroupDetail } from 'hooks/useGroupDetail';
import { useGroups } from 'hooks/useGroupsList';
import { useUiPrefsStore } from 'store/ui-prefs';

import { EmptyState } from 'basics/empty-states';
import { GroupsCards } from 'components/GroupsCards';
import { GroupsCardsSkeleton } from 'components/skeletons';

import { GroupCoverSection, GroupNotFound, GroupSummary, GroupTabsContent } from './components';

import styles from './GroupPage.module.css';

interface GroupPageLayoutProps {
    /** Column 3 on sm+ (hidden below sm). */
    side?: ReactNode;
    cover: ReactNode;
    isCoverLoading?: boolean;
    /** The main column under the cover. */
    children?: ReactNode;
}

// The page grid: the cover and the main column, and on sm+ a side column.
const GroupPageLayout = ({
    side,
    cover,
    isCoverLoading = false,
    children,
}: GroupPageLayoutProps) => (
    <Container size="4" pb={{ initial: '9', sm: '4' }}>
        <Grid columns="3" gap="6">
            {side ? (
                <Flex
                    direction="column"
                    gap="4"
                    gridColumn={{ initial: 'span 3', sm: '3' }}
                    gridRow={{ sm: '1' }}
                    mb="6"
                    display={{ initial: 'none', sm: 'flex' }}
                >
                    {side}
                </Flex>
            ) : null}

            <Box gridColumn={{ initial: 'span 3', sm: '1 / span 2' }} gridRow={{ sm: '1' }}>
                <Box
                    className={styles.cover}
                    mb={{ initial: '4', sm: '6' }}
                    aria-busy={isCoverLoading}
                >
                    {cover}
                </Box>

                {children}
            </Box>
        </Grid>
    </Container>
);

const GroupPage = () => {
    const { t } = useTranslation(['group', 'common', 'dashboard', 'errors', 'activity']);
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

    // TODO(04): the route's errorElement (spec 04 §2.5) once the data router lands; until then
    // a missing id or a denied (403/404) detail shows this state, and the list drops a denied group.
    if (!groupId || detail.isDenied) {
        return <GroupNotFound />;
    }

    if (!routeGroup) {
        // The first read of an unlisted group: the cover skeleton in the loaded layout's place.
        if (isGroupDataLoading) {
            return (
                <GroupPageLayout
                    side={<GroupsCardsSkeleton label={t('dashboard:groups.otherTitle')} />}
                    cover={<GroupCoverSection group={null} isLoading />}
                    isCoverLoading
                />
            );
        }

        // Nothing to show and the first read did not end: never "not found" (states.md).
        return (
            <GroupPageLayout cover={<GroupCoverSection group={null} isLoading />}>
                {detail.isPaused ? (
                    // The read resumes by itself on reconnect, so no Retry.
                    <EmptyState
                        icon={<WifiOffIcon size={20} />}
                        title={t('errors:network.offline')}
                    />
                ) : (
                    <EmptyState
                        icon={<RefreshCwIcon size={20} />}
                        title={t('group:page.loadErrorTitle')}
                        description={t('group:page.loadErrorDescription')}
                        action={
                            <Button type="button" variant="soft" onClick={detail.retry}>
                                <RefreshCwIcon size={14} />
                                {t('activity:retryAction')}
                            </Button>
                        }
                    />
                )}
            </GroupPageLayout>
        );
    }

    return (
        <GroupPageLayout
            side={
                <>
                    <GroupSummary group={routeGroup} isLoading={isGroupDataLoading} />
                    <GroupsCards
                        groups={groups}
                        label={t('dashboard:groups.otherTitle')}
                        selectedGroupId={routeGroup.id}
                    />
                </>
            }
            cover={<GroupCoverSection group={routeGroup} isLoading={isGroupDataLoading} />}
            isCoverLoading={isGroupDataLoading}
        >
            <Box display={{ initial: 'block', sm: 'none' }} mb="4">
                <GroupSummary group={routeGroup} isLoading={isGroupDataLoading} />
            </Box>

            <GroupTabsContent
                group={routeGroup}
                isGroupDataLoading={isGroupDataLoading}
                activity={activity}
            />
        </GroupPageLayout>
    );
};

export { GroupPage };
