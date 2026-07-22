import { useState } from 'react';
import { LucideEye, LucideEyeOff, LucideFilterX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { useDashboardStore } from 'store/dashboardStore';
import {
    type GroupBalances,
    selectGroupBalances,
    sortGroupBalances,
} from 'store/groupsSelectors';
import { selectDashboardFetched, selectGroupListFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { EmptyState } from 'basics/empty-states';
import { GroupsCardsSkeleton } from 'components/skeletons';

import GroupCard from './GroupCard';

type GroupFilter = 'all' | 'owed' | 'owes' | 'settled';

interface Props {
    groups: Group[];
    selectedGroupId?: Group['id'];
}

interface GroupCardModel {
    group: Group;
    balances: GroupBalances;
}

const filterGroups = (groups: Group[], filter: GroupFilter): GroupCardModel[] => {
    return groups.reduce<GroupCardModel[]>((filteredGroups, group) => {
        const { owedEntries, oweEntries } = selectGroupBalances(group);
        const hasOwedBalance = owedEntries.length > 0;
        const hasOweBalance = oweEntries.length > 0;
        let shouldIncludeGroup = false;

        if (filter === 'all') {
            shouldIncludeGroup = hasOwedBalance || hasOweBalance;
        } else if (filter === 'settled') {
            shouldIncludeGroup = !hasOwedBalance && !hasOweBalance;
        } else if (filter === 'owed') {
            shouldIncludeGroup = hasOwedBalance;
        } else {
            shouldIncludeGroup = hasOweBalance;
        }

        if (shouldIncludeGroup) {
            filteredGroups.push({ group, balances: { owedEntries, oweEntries } });
        }

        return filteredGroups;
    }, []);
};

const GroupsCards: React.FC<Props> = ({ groups, selectedGroupId }) => {
    const isGroupListFetched = useLoadingStore(selectGroupListFetched);
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);
    const currencies = useDashboardStore(state => state.currencies);
    const [activeFilter, setActiveFilter] = useState<GroupFilter>('all');
    const { t } = useTranslation('dashboard');

    if (!isGroupListFetched || !isDashboardFetched) {
        return <GroupsCardsSkeleton />;
    }

    const filteredGroups = filterGroups(groups, activeFilter);
    const isSettledFilter = activeFilter === 'settled';

    const filterItems: { value: GroupFilter; label: string }[] = [
        { value: 'all', label: t('groups.filterAll') },
        { value: 'owed', label: t('summary.owedToYou') },
        { value: 'owes', label: t('summary.youOwe') },
    ];

    return (
        <Flex direction="column" gap="4">
            <Flex gap="2" wrap="wrap">
                {filterItems.map(item => (
                    <Button
                        key={item.value}
                        size="2"
                        variant="soft"
                        color={activeFilter === item.value ? 'grass' : 'gray'}
                        onClick={() => setActiveFilter(item.value)}
                    >
                        {item.label}
                    </Button>
                ))}
                <Button
                    size="2"
                    variant="soft"
                    color={isSettledFilter ? 'grass' : 'gray'}
                    onClick={() => setActiveFilter('settled')}
                >
                    {isSettledFilter ? <LucideEye size={14} /> : <LucideEyeOff size={14} />}
                    {t('groups.filterSettled')}
                </Button>
            </Flex>
            {filteredGroups.length === 0 && (
                <EmptyState
                    icon={<LucideFilterX size={16} />}
                    title={t('groups.filterEmptyTitle')}
                    description={t('groups.filterEmptyDescription')}
                />
            )}

            {filteredGroups.map(({ group, balances }) => (
                <GroupCard
                    key={group.id}
                    group={group}
                    balances={sortGroupBalances(balances, currencies.rates, currencies.base)}
                    isSelected={group.id === selectedGroupId}
                />
            ))}
        </Flex>
    );
};

export default GroupsCards;
