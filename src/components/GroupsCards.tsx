import { useState } from 'react';
import { LucideChevronDown, LucideChevronUp, LucideFilterX } from 'lucide-react';
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

type DebtFilter = 'all' | 'owed' | 'owes';

interface Props {
    groups: Group[];
    selectedGroupId?: Group['id'];
}

interface GroupCardModel {
    group: Group;
    balances: GroupBalances;
}

interface FilterGroupsOptions {
    filter: DebtFilter;
    isSettledVisible: boolean;
    selectedGroupId?: Group['id'];
}

interface FilterGroupsResult {
    displayedGroups: GroupCardModel[];
    hiddenSettledCount: number;
}

const filterGroups = (
    groups: Group[],
    { filter, isSettledVisible, selectedGroupId }: FilterGroupsOptions,
): FilterGroupsResult => {
    const activeGroups: GroupCardModel[] = [];
    const settledGroups: GroupCardModel[] = [];
    let selectedGroup: GroupCardModel | undefined;
    let isSelectedGroupVisible = false;
    let hiddenSettledCount = 0;

    for (const group of groups) {
        const { owedEntries, oweEntries } = selectGroupBalances(group);
        const hasOwedBalance = owedEntries.length > 0;
        const hasOweBalance = oweEntries.length > 0;
        const isSettled = !hasOwedBalance && !hasOweBalance;
        const isSelected = group.id === selectedGroupId;
        const groupModel = { group, balances: { owedEntries, oweEntries } };
        let matchesActiveFilter = false;

        if (filter === 'all') {
            matchesActiveFilter = !isSettled;
        } else if (filter === 'owed') {
            matchesActiveFilter = hasOwedBalance;
        } else {
            matchesActiveFilter = hasOweBalance;
        }

        if (isSettled) {
            settledGroups.push(groupModel);

            if (!isSelected) {
                hiddenSettledCount += 1;
            }
        } else if (matchesActiveFilter) {
            activeGroups.push(groupModel);
        }

        if (isSelected) {
            selectedGroup = groupModel;
            isSelectedGroupVisible = isSettled ? isSettledVisible : matchesActiveFilter;
        }
    }

    const filteredGroups = isSettledVisible
        ? [...activeGroups, ...settledGroups]
        : activeGroups;
    const displayedGroups =
        selectedGroup && !isSelectedGroupVisible
            ? [selectedGroup, ...filteredGroups]
            : filteredGroups;

    return { displayedGroups, hiddenSettledCount };
};

const GroupsCards = ({ groups, selectedGroupId }: Props) => {
    const isGroupListFetched = useLoadingStore(selectGroupListFetched);
    const isDashboardFetched = useLoadingStore(selectDashboardFetched);
    const currencies = useDashboardStore(state => state.currencies);
    const [activeFilter, setActiveFilter] = useState<DebtFilter>('all');
    const [isSettledVisible, setIsSettledVisible] = useState(false);
    const { t } = useTranslation('dashboard');

    if (!isGroupListFetched || !isDashboardFetched) {
        return <GroupsCardsSkeleton />;
    }

    const { displayedGroups, hiddenSettledCount } = filterGroups(groups, {
        filter: activeFilter,
        isSettledVisible,
        selectedGroupId,
    });

    const filterItems: { value: DebtFilter; label: string }[] = [
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
            </Flex>
            {displayedGroups.length === 0 && (
                <EmptyState
                    icon={<LucideFilterX size={16} />}
                    title={t('groups.filterEmptyTitle')}
                    description={t('groups.filterEmptyDescription')}
                />
            )}

            {displayedGroups.map(({ group, balances }) => (
                <GroupCard
                    key={group.id}
                    group={group}
                    balances={sortGroupBalances(balances, currencies.rates, currencies.base)}
                    isSelected={group.id === selectedGroupId}
                />
            ))}

            {hiddenSettledCount > 0 && (
                <Button
                    size="2"
                    variant="soft"
                    color="gray"
                    onClick={() => setIsSettledVisible(isVisible => !isVisible)}
                >
                    {isSettledVisible ? (
                        <LucideChevronUp size={14} />
                    ) : (
                        <LucideChevronDown size={14} />
                    )}
                    {isSettledVisible
                        ? t('groups.hideSettled')
                        : t('groups.showSettled', { count: hiddenSettledCount })}
                </Button>
            )}
        </Flex>
    );
};

export default GroupsCards;
