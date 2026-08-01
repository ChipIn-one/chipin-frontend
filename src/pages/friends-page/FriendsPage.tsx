import { useState } from 'react';

import { Container } from '@radix-ui/themes';

import { useLoadingStore } from 'store/loadingStore';
import {
    getFriendsView,
    selectFriends,
    useUsersStore,
} from 'store/users-store';

import { InternalPageColumns } from 'components/internal-page-layout';

import {
    FriendsList,
    FriendsSidebar,
} from './components';

const FriendsPage = () => {
    const friends = useUsersStore(selectFriends);
    const isLoadingFriends = useLoadingStore(state => state.users.friends);
    const [search, setSearch] = useState('');
    const [filterKey, setFilterKey] = useState('all');

    const isSkeletonShown = isLoadingFriends === 'loading' && !friends.length;
    const isEmptyFriends = isLoadingFriends === 'fetched' && friends.length === 0;

    const { currencies, currencyGroups, settledFriends } = getFriendsView(
        friends,
        search,
        filterKey,
    );

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <InternalPageColumns
                sidePanel={
                    <FriendsSidebar
                        search={search}
                        onSearchChange={setSearch}
                        currencies={currencies}
                        filterKey={filterKey}
                        onFilterChange={setFilterKey}
                        isLoading={isSkeletonShown}
                    />
                }
            >
                <FriendsList
                    currencyGroups={currencyGroups}
                    isEmpty={isEmptyFriends}
                    isLoading={isSkeletonShown}
                    settledFriends={settledFriends}
                />
            </InternalPageColumns>
        </Container>
    );
};

export default FriendsPage;
