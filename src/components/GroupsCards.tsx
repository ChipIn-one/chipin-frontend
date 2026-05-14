import { useState } from 'react';
import { LucideFilterX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex } from '@radix-ui/themes';

import { Group } from 'api/chipin.types';
import { selectDashboardFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { EmptyState } from 'basics/empty-states';
import { GroupsCardsSkeleton } from 'components/skeletons';

import GroupCard from './GroupCard';

type GroupFilter = 'all' | 'owed' | 'owes' | 'settled';

interface Props {
    groups: Group[];
}

const filterGroups = (groups: Group[], filter: GroupFilter): Group[] => {
    if (filter === 'all') {
        return groups;
    }

    return groups.filter(group => {
        const balances = Object.values(group.balances);

        if (filter === 'owed') {
            return balances.some(entry => entry.netBalance !== null && entry.netBalance.gt(0));
        }

        if (filter === 'owes') {
            return balances.some(entry => entry.netBalance !== null && entry.netBalance.lt(0));
        }

        return balances.every(entry => entry.netBalance === null || entry.netBalance.eq(0));
    });
};

const GroupsCards: React.FC<Props> = ({ groups }) => {
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);
    const [activeFilter, setActiveFilter] = useState<GroupFilter>('all');
    const { t } = useTranslation('dashboard');

    if (!isDashboardFetched) {
        return <GroupsCardsSkeleton />;
    }

    const filteredGroups = filterGroups(groups, activeFilter);

    const filterItems: { value: GroupFilter; label: string }[] = [
        { value: 'all', label: t('groups.filterAll') },
        { value: 'owed', label: t('summary.owedToYou') },
        { value: 'owes', label: t('summary.youOwe') },
        { value: 'settled', label: t('groups.filterSettled') },
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
            </Flex>
            {filteredGroups.length === 0 ? (
                <EmptyState
                    icon={<LucideFilterX size={16} />}
                    title={t('groups.filterEmptyTitle')}
                    description={t('groups.filterEmptyDescription')}
                />
            ) : (
                filteredGroups.map(group => <GroupCard key={group.id} group={group} />)
            )}
        </Flex>
    );
};

export default GroupsCards;
