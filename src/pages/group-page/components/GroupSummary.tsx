import { useTranslation } from 'react-i18next';

import { Box } from '@radix-ui/themes';

import { Group } from 'api/chipin.types';
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

    const { owedTotalInBase, owingTotalInBase, owedEntries, oweEntries } = useGroupsStore();
    const defaultCurrency = useUsersStore(selectUserCurrency);

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
            <GroupsCards groups={groups.filter(group => group.id !== selectedGroup.id)} />
        </Box>
    );
};

export default GroupSummary;
