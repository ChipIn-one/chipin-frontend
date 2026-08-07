import { LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Flex, IconButton, Tabs } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { selectGroupDataLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { SettleUpModal } from 'components/modals';
import { ActivityFeedSkeleton } from 'components/skeletons';
import UsersRow from 'components/UsersRow';
import { ActivityEventsList } from 'features/activity';

import GroupBalancesTab from './GroupBalancesTab';
import GroupSettingsTab from './GroupSettingsTab';

interface Props {
    group: Group;
}

const GroupTabsContent = ({ group }: Props) => {
    const { t } = useTranslation(['group', 'common']);
    const isGroupDataLoading = useLoadingStore(selectGroupDataLoading);
    const activityItems = group.recentActivities.items.map(item => item.lastEvent);
    const members = group.members.map(member => member.user);

    return (
        <Box mt="4">
            <Tabs.Root defaultValue="expenses">
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
                                isShowSummary
                                isNavigable
                            />
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
