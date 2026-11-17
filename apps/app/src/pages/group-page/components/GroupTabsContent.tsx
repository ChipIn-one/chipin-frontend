import { useState } from 'react';
import { Box, Button, Flex, IconButton, Spinner, Tabs, Text } from '@radix-ui/themes';
import { ChevronsDownIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Group } from 'entities/groups';
import { ActivityEventsList } from 'features/activity';
import { getActivityPreviewEvents } from 'helpers/activityEvent';
import { useGroupInvite } from 'hooks/pwaHooks';
import type { GroupActivityResult } from 'hooks/useGroupDetail';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';

import { NoGroupExpensesEmptyState } from 'basics/empty-states';
import { SettleUpModal } from 'components/modals/settle-up-modal';
import { ActivityFeedSkeleton } from 'components/skeletons';
import UsersRow from 'components/UsersRow';

import GroupBalancesTab from './GroupBalancesTab';
import GroupInviteEmptyState from './GroupInviteEmptyState';
import GroupSettingsTab from './GroupSettingsTab';

interface Props {
    group: Group;
    isGroupDataLoading: boolean;
    activity: GroupActivityResult;
}

const GroupTabsContent = ({ group, isGroupDataLoading, activity }: Props) => {
    const { t } = useTranslation(['group', 'common', 'activity']);
    const invite = useGroupInvite(group);
    const [activeTab, setActiveTab] = useState('expenses');
    const activityItems = getActivityPreviewEvents(activity.items);
    const members = group.members.map(member => member.user);
    const isSingleMemberGroup = group.members.length === 1;
    const shouldShowInviteOnboarding = isSingleMemberGroup;
    const {
        hasMore: hasMoreActivity,
        isNextPageLoading: isGroupActivityNextPageLoading,
        isNextPageError: isGroupActivityNextPageError,
        loadMore: onLoadMore,
    } = activity;
    const isEndOfFeed =
        !isGroupActivityNextPageLoading && !hasMoreActivity && activityItems.length > 0;
    const onRetryNextPage = () => {
        onLoadMore();
    };
    const onInvitePeople = (): Promise<void> => {
        if (invite.isNativeShareSupported) {
            return invite.onShare();
        }

        return invite.onCopyLink();
    };
    const sentinelRef = useInfiniteScroll({
        hasMore: activeTab === 'expenses' && hasMoreActivity && !isGroupActivityNextPageError,
        // Any load holds the trigger (`loadMore` ignores it meanwhile), not only a next page.
        isLoading: activity.isFetching,
        onLoadMore,
        loadedKey: activity.loadedKey,
    });

    return (
        <Box mt="4">
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                <Flex align="center" justify="between" gap="3" wrap="wrap" mb="4">
                    <Flex align="center" gap="2">
                        <UsersRow members={members} max={5} size="2" />
                        <IconButton
                            size="2"
                            color="gray"
                            variant="outline"
                            radius="full"
                            aria-label={t('common:buttons.invitePeople')}
                            onClick={() => void onInvitePeople()}
                        >
                            <PlusIcon size={18} />
                        </IconButton>
                    </Flex>
                    <Box ml="auto">
                        <SettleUpModal source="group" group={group} />
                    </Box>
                </Flex>

                <Tabs.List size="2" mb="4">
                    <Tabs.Trigger value="expenses">{t('page.tabs.expenses')}</Tabs.Trigger>
                    <Tabs.Trigger value="balances">{t('page.tabs.balances')}</Tabs.Trigger>
                    <Tabs.Trigger value="settings">{t('page.tabs.settings')}</Tabs.Trigger>
                </Tabs.List>

                <Box>
                    <Tabs.Content value="expenses">
                        {isGroupDataLoading ? (
                            <ActivityFeedSkeleton isShowSummary />
                        ) : (
                            <>
                                {shouldShowInviteOnboarding && (
                                    <Box mb={activityItems.length > 0 ? '4' : undefined}>
                                        <GroupInviteEmptyState group={group} />
                                    </Box>
                                )}
                                <ActivityEventsList
                                    previews={activityItems}
                                    emptyState={
                                        shouldShowInviteOnboarding ? null : (
                                            <NoGroupExpensesEmptyState />
                                        )
                                    }
                                    isShowSummary
                                    isNavigable
                                >
                                    <>
                                        {isGroupActivityNextPageLoading && (
                                            <Flex justify="center" py="4">
                                                <Spinner size="3" />
                                            </Flex>
                                        )}

                                        {isGroupActivityNextPageError && (
                                            <Flex justify="center" py="4">
                                                <Button
                                                    type="button"
                                                    size="1"
                                                    variant="soft"
                                                    onClick={onRetryNextPage}
                                                >
                                                    <RefreshCwIcon size={14} />
                                                    {t('activity:retryAction')}
                                                </Button>
                                            </Flex>
                                        )}

                                        {isEndOfFeed && (
                                            <Flex justify="center" align="center" gap="2" py="4">
                                                <Text as="span" color="gray">
                                                    <ChevronsDownIcon size={14} />
                                                </Text>
                                                <Text size="1" color="gray">
                                                    {t('activity:endOfFeed')}
                                                </Text>
                                            </Flex>
                                        )}

                                        <div ref={sentinelRef} />
                                    </>
                                </ActivityEventsList>
                            </>
                        )}
                    </Tabs.Content>

                    <Tabs.Content value="balances">
                        <GroupBalancesTab
                            group={group}
                            showInviteOnboarding={shouldShowInviteOnboarding}
                        />
                    </Tabs.Content>

                    <Tabs.Content value="settings">
                        <GroupSettingsTab group={group} />
                    </Tabs.Content>
                </Box>
            </Tabs.Root>
        </Box>
    );
};

export default GroupTabsContent;
