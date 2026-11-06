// Test support for `users.self`: a seed that writes the user into every test QueryClient of the
// running test (also those created later in it) and registers each as a signed-in user's client,
// where the self user is read. Reset after each test of a file that imports this module.
import type { QueryClient } from '@tanstack/react-query';
import { afterEach } from 'vitest';

import { type SelfUser, usersKeys } from 'entities/users';

import { liveTestQueryClients, onTestQueryClientCreated } from './renderWithQueryClient';
import { mountAsUserClient } from './userClient';

let seeded: SelfUser | null = null;
let seededClients = 0;

const applySeed = (client: QueryClient): void => {
    if (seeded) {
        seededClients += 1;
        mountAsUserClient(`self-seeded-${String(seededClients)}`, client);
        client.setQueryData(usersKeys.self(), seeded);
    }
};

onTestQueryClientCreated(applySeed);

/** The self user every test QueryClient of this test holds in `users.self`. */
export const seedSelfUser = (user: SelfUser): void => {
    seeded = user;
    liveTestQueryClients().forEach(applySeed);
};

/** No self user (yet): `users.self` is removed from every test QueryClient of this test. */
export const clearSeededSelfUser = (): void => {
    seeded = null;
    liveTestQueryClients().forEach(client => {
        client.removeQueries({ queryKey: usersKeys.self() });
    });
};

afterEach(() => {
    seeded = null;
    seededClients = 0;
});
