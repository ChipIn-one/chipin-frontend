import { useTranslation } from 'react-i18next';

import { Box, Tabs } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { selectGroupDataLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { ActivityFeedSkeleton } from 'components/skeletons';
import { ActivityEventsList } from 'features/activity/components';

import GroupBalancesTab from './GroupBalancesTab';
import GroupSettingsTab from './GroupSettingsTab';

interface Props {
    group: Group;
}

const GroupTabsContent = ({ group }: Props) => {
    const { t } = useTranslation('group');
    const isGroupDataLoading = useLoadingStore(selectGroupDataLoading);
    const activityItems = group.recentActivities;

    return (
        <Box mt="4">
            <Tabs.Root defaultValue="expenses">
                <Tabs.List size="2" mb="4">
                    <Tabs.Trigger value="expenses">{t('page.tabs.expenses')}</Tabs.Trigger>
                    <Tabs.Trigger value="balances">{t('page.tabs.balances')}</Tabs.Trigger>
                    <Tabs.Trigger value="settings">{t('page.tabs.settings')}</Tabs.Trigger>
                </Tabs.List>

                <Box>
                    <Tabs.Content value="expenses">
                        {isGroupDataLoading ? (
                            <ActivityFeedSkeleton />
                        ) : (
                            <ActivityEventsList events={activityItems} />
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
