import { useMemo, useState } from 'react';
import { Container } from '@radix-ui/themes';

import { getFriendsView } from 'entities/users';
import { useKnownUsers } from 'hooks/useKnownUsers';

import { InternalPageColumnsFromSm } from 'components/internal-page-layout';

import { FriendsList, FriendsSidebar } from './components';

const FriendsPage = () => {
    const { friends, isError, isLoading } = useKnownUsers();
    const [search, setSearch] = useState('');
    const [filterKey, setFilterKey] = useState('all');

    // As before the migration, a failed first load (or one waiting for the network) with nothing
    // cached shows the invite empty state; with data, the offline banner alone says so.
    const isEmptyFriends = isError || friends?.length === 0;

    const { currencies, currencyGroups, settledFriends } = useMemo(
        () => getFriendsView(friends ?? [], search, filterKey),
        [filterKey, friends, search],
    );

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumnsFromSm
                sidePanel={
                    <FriendsSidebar
                        search={search}
                        onSearchChange={setSearch}
                        currencies={currencies}
                        filterKey={filterKey}
                        onFilterChange={setFilterKey}
                        isLoading={isLoading}
                    />
                }
            >
                <FriendsList
                    currencyGroups={currencyGroups}
                    isEmpty={isEmptyFriends}
                    isLoading={isLoading}
                    settledFriends={settledFriends}
                />
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export default FriendsPage;
