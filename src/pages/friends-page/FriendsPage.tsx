import { useMemo, useState } from 'react';
import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Container, Flex } from '@radix-ui/themes';

import type { Friend } from 'api/chipin.types';
import { getFilterFunction } from 'helpers/text';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import { NoFriendsEmptyState } from 'basics/empty-states';
import { MobileNavBar } from 'components/nav-bars';
import { FriendsPageSkeleton } from 'components/skeletons';

import type { CurrencyGroupItem } from './components';
import {
    CurrencyGroupCard,
    FriendsPageHeader,
    FriendsSearchBar,
    SettledUpCard,
} from './components';

interface CurrencyGroup {
    currency: string;
    netTotal: number;
    items: CurrencyGroupItem[];
}

const buildCurrencyGroups = (friends: Friend[]): CurrencyGroup[] => {
    const map = new Map<string, CurrencyGroupItem[]>();

    for (const friend of friends) {
        for (const [currency, balance] of Object.entries(friend.balances)) {
            const netAmount = balance.netBalance;

            if (!map.has(currency)) {
                map.set(currency, []);
            }
            map.get(currency)!.push({ user: friend.user, netAmount });
        }
    }

    return Array.from(map.entries()).map(([currency, items]) => ({
        currency,
        netTotal: items.reduce((sum, item) => sum + item.netAmount, 0),
        items,
    }));
};

const FriendsPage = () => {
    const { t } = useTranslation(['common', 'friends']);
    const friends = useUsersStore(s => s.friends);
    const isLoadingFriends = useLoadingStore(state => state.users.friends);
    const [search, setSearch] = useState('');
    const [filterKey, setFilterKey] = useState('all');

    const isSkeletonShown = isLoadingFriends === 'loading' && !friends.length;
    const isEmptyFriends = isLoadingFriends === 'fetched' && friends.length === 0;

    const filterFn = useMemo(() => getFilterFunction(search), [search]);

    const filteredFriends = useMemo(
        () => (filterFn ? friends.filter(f => filterFn([f.user.displayName])) : friends),
        [friends, filterFn],
    );

    const currencies = useMemo(
        () => Array.from(new Set(filteredFriends.flatMap(f => Object.keys(f.balances)))),
        [filteredFriends],
    );

    const currencyGroups = useMemo(
        () =>
            buildCurrencyGroups(filteredFriends).filter(
                g => filterKey === 'all' || g.currency === filterKey,
            ),
        [filteredFriends, filterKey],
    );

    const settledUpFriends = useMemo(
        () =>
            filterKey !== 'all'
                ? []
                : filteredFriends.filter(f => Object.keys(f.balances).length === 0),
        [filteredFriends, filterKey],
    );

    return (
        <Container size="2" pb={{ initial: '9', sm: '6' }}>
            <Flex direction="column" gap="4">
                <FriendsPageHeader isLoading={isSkeletonShown} />

                <FriendsSearchBar
                    search={search}
                    onSearchChange={setSearch}
                    currencies={currencies}
                    filterKey={filterKey}
                    onFilterChange={setFilterKey}
                    isLoading={isSkeletonShown}
                />
                {isSkeletonShown ? (
                    <FriendsPageSkeleton />
                ) : isEmptyFriends ? (
                    <NoFriendsEmptyState
                        action={
                            <Button size="2" variant="soft">
                                <LucideUserPlus size={14} />
                                {t('common:buttons.addFriend')}
                            </Button>
                        }
                    />
                ) : (
                    <>
                        {currencyGroups.map(group => (
                            <CurrencyGroupCard
                                key={group.currency}
                                currency={group.currency}
                                netTotal={group.netTotal}
                                items={group.items}
                            />
                        ))}

                        {settledUpFriends.length > 0 && (
                            <SettledUpCard friends={settledUpFriends} />
                        )}
                    </>
                )}
            </Flex>

            <MobileNavBar />
        </Container>
    );
};

export default FriendsPage;
