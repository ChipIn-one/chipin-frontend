import { useTranslation } from 'react-i18next';

import { Box, Tabs } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';

import { ActivityFeedSkeleton } from 'components/skeletons';

import GroupBalancesTab from './GroupBalancesTab';
import GroupSettingsTab from './GroupSettingsTab';

interface Props {
    group: ApiGroup;
}

const GroupTabsContent = ({ group }: Props) => {
    const { t } = useTranslation('group');

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
                        <ActivityFeedSkeleton isExpensesOnly />
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
