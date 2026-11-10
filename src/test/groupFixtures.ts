// Test support for groups: one legacy (wire-shaped) group fixture and its domain form. The legacy
// shape is also the JSON body `GET /groups` and `GET /groups/{id}` answer (amounts as numbers), so
// one fixture serves an msw handler (`wireGroup`) and the expected domain group (`testGroup`).
import type { BalanceEntry, BalancesMap } from 'api/chipin.raw.types';
import type { Group as LegacyGroup, GroupUser as LegacyGroupUser } from 'api/chipin.types';
import type { Balance } from 'entities/balance';
import { legacyBalanceFromEntry } from 'entities/balance';
import type { Group, GroupMember } from 'entities/groups';
import { domainGroupFromLegacy } from 'store/legacyGroup';

export const groupUser = (id: string, displayName = `User ${id}`): LegacyGroupUser => ({
    id,
    email: `${id}@example.com`,
    displayName,
    firstName: null,
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
});

/** A group as the legacy layer and the wire give it (amounts as numbers). */
export const wireGroup = (id: string, overrides: Partial<LegacyGroup> = {}): LegacyGroup => {
    const creator = overrides.creator ?? groupUser(`${id}-owner`);

    return {
        id,
        name: `Group ${id}`,
        inviteToken: `invite-${id}`,
        description: null,
        creator,
        members: [{ user: creator, balancesByCurrency: {} }],
        createdAt: 1,
        updatedAt: 1,
        coverUrl: null,
        simplifyDebts: false,
        role: 'OWNER',
        status: 'ACTIVE',
        lastUsedCurrency: null,
        recentActivities: { items: [], nextCursor: null },
        ...overrides,
    };
};

/** The domain group of a legacy (wire-shaped) group: what `toGroup` reads from the same JSON. */
export const toTestGroup = (group: LegacyGroup): Group => domainGroupFromLegacy(group);

/** A domain group (`wireGroup` with the same arguments, mapped). */
export const testGroup = (id: string, overrides: Partial<LegacyGroup> = {}): Group =>
    toTestGroup(wireGroup(id, overrides));

/** Member balances keyed by currency, from legacy numbers: `{ USD: 5, EUR: -2.5 }`. */
export const groupBalances = (
    nets: Readonly<Record<string, number>>,
): Readonly<Record<string, Balance>> =>
    Object.fromEntries(
        Object.entries(nets).flatMap(([currency, netBalance]): [string, Balance][] => {
            const entry: BalanceEntry = { currency, netBalance };
            const balance = legacyBalanceFromEntry(entry);

            return balance ? [[currency, balance]] : [];
        }),
    );

/** A domain member with balances from legacy numbers. */
export const groupMember = (
    user: LegacyGroupUser,
    nets: Readonly<Record<string, number>> = {},
): GroupMember => ({ user, balancesByCurrency: groupBalances(nets) });

/** Member balances from a legacy balances map (`{ USD: { currency: 'USD', netBalance: 5 } }`). */
export const groupBalancesFromMap = (map: BalancesMap): Readonly<Record<string, Balance>> =>
    groupBalances(
        Object.fromEntries(Object.values(map).map(entry => [entry.currency, entry.netBalance])),
    );
