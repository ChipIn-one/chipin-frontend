import { useState } from 'react';
import { LucideEye, LucideEyeOff, LucideFilterX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { selectGroupBalances } from 'store/groupsSelectors';
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

const filterGroups = (groups: Group[], filter: GroupFilter): Group[] => {
    return groups.filter(group => {
        const balances = Object.values(selectGroupBalances(group));

        if (filter === 'all') {
            return balances.some(entry => entry.netBalance !== 0);
        }

        if (filter === 'settled') {
            return balances.every(entry => entry.netBalance === 0);
        }

        if (filter === 'owed') {
            return balances.some(entry => entry.netBalance > 0 && entry.netBalance !== 0);
        }

        return balances.some(entry => entry.netBalance < 0 && entry.netBalance !== 0);
    });
};

const GroupsCards: React.FC<Props> = ({ groups, selectedGroupId }) => {
    const isGroupListFetched = useLoadingStore(selectGroupListFetched);
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);
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

            {filteredGroups.map(group => (
                <GroupCard key={group.id} group={group} isSelected={group.id === selectedGroupId} />
            ))}
        </Flex>
    );
};

export default GroupsCards;
