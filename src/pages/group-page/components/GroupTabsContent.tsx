import { useCallback, useState } from 'react';
import {
    LucideChevronsDown,
    LucidePlus,
    LucideRefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Flex, IconButton, Spinner, Tabs, Text } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { useInfiniteScroll } from 'hooks/useInfiniteScroll';

import { NoGroupExpensesEmptyState } from 'basics/empty-states';
import { SettleUpModal } from 'components/modals';
import { ActivityFeedSkeleton } from 'components/skeletons';
import UsersRow from 'components/UsersRow';
import { ActivityEventsList } from 'features/activity';

import GroupBalancesTab from './GroupBalancesTab';
import GroupSettingsTab from './GroupSettingsTab';

interface Props {
    group: Group;
    isGroupDataLoading: boolean;
    fetchMoreGroupActivity: () => Promise<void>;
    isGroupActivityNextPageLoading: boolean;
    isGroupActivityNextPageError: boolean;
}

const GroupTabsContent = ({
    group,
    isGroupDataLoading,
    fetchMoreGroupActivity,
    isGroupActivityNextPageLoading,
    isGroupActivityNextPageError,
}: Props) => {
    const { t } = useTranslation(['group', 'common', 'activity']);
    const [activeTab, setActiveTab] = useState('expenses');
    const activityItems = group.recentActivities.items.map(item => item.lastEvent);
    const members = group.members.map(member => member.user);
    const hasMoreActivity = group.recentActivities.nextCursor !== null;
    const isEndOfFeed =
        !isGroupActivityNextPageLoading &&
        !hasMoreActivity &&
        activityItems.length > 0;
    const onLoadMore = useCallback(() => fetchMoreGroupActivity(), [fetchMoreGroupActivity]);
    const onRetryNextPage = () => {
        onLoadMore();
    };
    const sentinelRef = useInfiniteScroll({
        hasMore: activeTab === 'expenses' && hasMoreActivity && !isGroupActivityNextPageError,
        isLoading: isGroupActivityNextPageLoading,
        onLoadMore,
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
                        >
                            <LucidePlus size={18} />
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
                            <ActivityEventsList
                                events={activityItems}
                                emptyState={<NoGroupExpensesEmptyState />}
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
                                                <LucideRefreshCw size={14} />
                                                {t('activity:retryAction')}
                                            </Button>
                                        </Flex>
                                    )}

                                    {isEndOfFeed && (
                                        <Flex justify="center" align="center" gap="2" py="4">
                                            <Text as="span" color="gray">
                                                <LucideChevronsDown size={14} />
                                            </Text>
                                            <Text size="1" color="gray">
                                                {t('activity:endOfFeed')}
                                            </Text>
                                        </Flex>
                                    )}

                                    <div ref={sentinelRef} />
                                </>
                            </ActivityEventsList>
                        )}
                    </Tabs.Content>

                    <Tabs.Content value="balances">
                        <GroupBalancesTab group={group} />
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
