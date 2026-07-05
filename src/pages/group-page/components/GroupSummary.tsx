import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@radix-ui/themes';

import { Group } from 'api/chipin.types';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectUserCurrency } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';
import { SummaryDebtCards } from 'components/summary-debt-cards';

interface Props {
    groups: Group[];
    selectedGroup: Group;
    isLoading: boolean;
}

const GroupSummary = ({ groups, selectedGroup, isLoading }: Props) => {
    const { t } = useTranslation('group');

    const {
        owedTotalInBase,
        owingTotalInBase,
        owedEntries,
        oweEntries,
        setSelectedGroupSummaryCurrency,
    } = useGroupsStore();
    const defaultCurrency = useUsersStore(selectUserCurrency);
    const currencies = useDashboardStore(state => state.currencies);

    useEffect(() => {
        setSelectedGroupSummaryCurrency(defaultCurrency);
    }, [
        defaultCurrency,
        currencies.base,
        currencies.fetchedAt,
        setSelectedGroupSummaryCurrency,
    ]);

    return (
        <Box
            gridColumn={{ initial: 'span 3', sm: 'span 1' }}
            mb="6"
            display={{ initial: 'none', sm: 'block' }}
        >
            <SummaryDebtCards
                isLoading={isLoading}
                owedToYouTotal={owedTotalInBase}
                youOweTotal={owingTotalInBase}
                owedEntries={owedEntries}
                oweEntries={oweEntries}
                defaultCurrency={defaultCurrency}
            />
            <GroupsSectionHeader
                mb="4"
                label={t('dashboard:groups.otherTitle')}
                isLoading={isLoading}
            />
            <GroupsCards groups={groups} selectedGroupId={selectedGroup.id} />
        </Box>
    );
};

export default GroupSummary;
