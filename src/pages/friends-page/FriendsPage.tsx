import { useState } from 'react';
import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Container, Flex } from '@radix-ui/themes';

import { useLoadingStore } from 'store/loadingStore';
import {
    selectFilteredCurrencyGroups,
    selectFilteredSettledFriends,
    selectFriends,
    selectFriendsCurrencies,
} from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

import { NoFriendsEmptyState } from 'basics/empty-states';
import { MobileNavBar } from 'components/nav-bars';
import { FriendsPageSkeleton } from 'components/skeletons';

import {
    CurrencyGroupCard,
    FriendsPageHeader,
    FriendsSearchBar,
    SettledUpCard,
} from './components';

const FriendsPage = () => {
    const { t } = useTranslation(['common', 'friends']);
    const friends = useUsersStore(selectFriends);
    const isLoadingFriends = useLoadingStore(state => state.users.friends);
    const [search, setSearch] = useState('');
    const [filterKey, setFilterKey] = useState('all');

    const isSkeletonShown = isLoadingFriends === 'loading' && !friends.length;
    const isEmptyFriends = isLoadingFriends === 'fetched' && friends.length === 0;

    const currencies = selectFriendsCurrencies(friends, search);
    const currencyGroups = selectFilteredCurrencyGroups(friends, search, filterKey);
    const filteredSettledFriends = selectFilteredSettledFriends(friends, search, filterKey);

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
                                netBalance={group.netBalance}
                                friends={group.friends}
                            />
                        ))}

                        {filteredSettledFriends.length > 0 && (
                            <SettledUpCard friends={filteredSettledFriends} />
                        )}
                    </>
                )}
            </Flex>

            <MobileNavBar />
        </Container>
    );
};

export default FriendsPage;
