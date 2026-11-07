// Test support for `groups.list`: a seed that writes the groups into every test QueryClient of the
// running test (also those created later in it) and registers each as a signed-in user's client:
// the groups are read only there. Reset after each test of a file that imports this module.
import type { QueryClient } from '@tanstack/react-query';
import { afterEach } from 'vitest';

import type { Group } from 'api/chipin.types';
import { flattenGroupsList, groupsKeys, type GroupsListData } from 'entities/groups';

import { liveTestQueryClients, onTestQueryClientCreated } from './renderWithQueryClient';
import { mountAsUserClient } from './userClient';

/** The cached list as the query stores it: one page, no next cursor. */
export const groupsListData = (groups: readonly Group[]): GroupsListData => ({
    pages: [{ items: groups, nextCursor: null }],
    pageParams: [null],
});

/** The groups `client` holds in `groups.list` (undefined: never loaded). */
export const cachedGroupsList = (client: QueryClient): Group[] | undefined => {
    const data = client.getQueryData<GroupsListData>(groupsKeys.list());

    return data ? flattenGroupsList(data) : undefined;
};

let seeded: readonly Group[] | undefined;
let seededClients = 0;

const applySeed = (client: QueryClient): void => {
    if (seeded) {
        seededClients += 1;
        mountAsUserClient(`groups-seeded-${String(seededClients)}`, client);
        client.setQueryData(groupsKeys.list(), groupsListData(seeded));
    }
};

onTestQueryClientCreated(applySeed);

/** The groups every test QueryClient of this test holds in `groups.list`. */
export const seedGroupsList = (groups: readonly Group[]): void => {
    seeded = groups;
    liveTestQueryClients().forEach(applySeed);
};

afterEach(() => {
    seeded = undefined;
    seededClients = 0;
});
