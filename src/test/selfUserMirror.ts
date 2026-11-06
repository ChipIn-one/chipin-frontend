// The test side of the legacy → query bridge (`store/internal/usersQueryBridge`): in the app the
// users store seeds `users.self` with every user it loads or saves; with this module imported, a
// test that sets the store's `user` gets the same `users.self` entry in its test QueryClients.
// LEGACY until 03-9b removes the store (tests then seed the query directly).
import type { QueryClient } from '@tanstack/react-query';

import { usersKeys } from 'entities/users';
import { useUsersStore } from 'store/users-store';

import { liveTestQueryClients, onTestQueryClientCreated } from './renderWithQueryClient';

const mirrorSelfUser = (client: QueryClient): void => {
    const { user } = useUsersStore.getState();

    if (user) {
        client.setQueryData(usersKeys.self(), user);
    } else {
        client.removeQueries({ queryKey: usersKeys.self() });
    }
};

onTestQueryClientCreated(mirrorSelfUser);

useUsersStore.subscribe((state, previous) => {
    if (state.user !== previous.user) {
        liveTestQueryClients().forEach(mirrorSelfUser);
    }
});
