// Test support for `users.known`: domain friends built from short specs, and a seed that writes them
// into every test QueryClient of the running test (also those created later in it). Reset after
// each test of a file that imports this module.
import type { QueryClient } from '@tanstack/react-query';
import { afterEach } from 'vitest';

import { type KnownUser, usersKeys } from 'entities/users';
import { currencyCode, fromUnits } from 'shared/money';

import { liveTestQueryClients, onTestQueryClientCreated } from './renderWithQueryClient';

/** `[currency, ledger units]`: `['USD', 255_000n]` is 25.50 USD the friend owes you. */
type BalanceSpec = readonly [string, bigint];

export const createKnownUser = (
    id: string,
    balances: readonly BalanceSpec[] = [],
    overrides: Partial<Omit<KnownUser, 'user' | 'balances'>> = {},
): KnownUser => ({
    user: {
        id,
        email: `${id}@example.com`,
        displayName: `Friend ${id}`,
        firstName: null,
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    },
    balances: balances.map(([currency, units]) => ({
        net: fromUnits(units, currencyCode(currency)),
    })),
    hasUnreadableBalance: false,
    lastUsedCurrency: null,
    ...overrides,
});

let seeded: KnownUser[] | undefined;

const applySeed = (client: QueryClient): void => {
    if (seeded) {
        client.setQueryData(usersKeys.known(), seeded);
    }
};

onTestQueryClientCreated(applySeed);

/** The friends every test QueryClient of this test holds in `users.known`. */
export const seedKnownUsers = (friends: KnownUser[]): void => {
    seeded = friends;
    liveTestQueryClients().forEach(applySeed);
};

afterEach(() => {
    seeded = undefined;
});
