import { useState } from 'react';

import { Box, Container, Grid } from '@radix-ui/themes';

import { useLoadingStore } from 'store/loadingStore';
import {
    getFriendsView,
    selectFriends,
    useUsersStore,
} from 'store/users-store';

import { MobileNavBar } from 'components/nav-bars';

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
            <Grid columns="3" gap="6">
                <Box gridColumn={{ initial: 'span 3', lg: 'span 1' }}>
                    <FriendsSidebar
                        search={search}
                        onSearchChange={setSearch}
                        currencies={currencies}
                        filterKey={filterKey}
                        onFilterChange={setFilterKey}
                        isLoading={isSkeletonShown}
                    />
                </Box>

                <Box gridColumn={{ initial: 'span 3', lg: 'span 2' }}>
                    <FriendsList
                        currencyGroups={currencyGroups}
                        isEmpty={isEmptyFriends}
                        isLoading={isSkeletonShown}
                        settledFriends={settledFriends}
                    />
                </Box>
            </Grid>

            <MobileNavBar />
        </Container>
    );
};

export default FriendsPage;
