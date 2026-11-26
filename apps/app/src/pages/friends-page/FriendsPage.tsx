import { useMemo, useState } from 'react';
import { Container } from '@radix-ui/themes';

import { getFriendsView } from 'entities/users';
import { useKnownUsers } from 'hooks/useKnownUsers';

import { InternalPageColumnsFromSm } from 'components/internal-page-layout';

import { FriendsList, FriendsSidebar } from './components';

const FriendsPage = () => {
    const { friends, isError, isLoading, isOffline, refetch } = useKnownUsers();
    const [search, setSearch] = useState('');
    const [filterKey, setFilterKey] = useState('all');

    // USR-013: only a loaded, empty list is "no friends". A failed first load (or one waiting for
    // the network) with nothing cached is an error or offline state; with data the list stays and
    // the offline banner alone says so.
    const isEmptyFriends = friends?.length === 0;

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
                    isError={isError}
                    isLoading={isLoading}
                    isOffline={isOffline}
                    onRetry={() => void refetch()}
                    settledFriends={settledFriends}
                />
            </InternalPageColumnsFromSm>
        </Container>
    );
};

export { FriendsPage };
