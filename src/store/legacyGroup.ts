// TODO(03-11): goes with the group mutations moving to entities/groups (`api()` + `toGroup`).
// The legacy group writes (create, update, cover, join) still return the legacy `src/api` group
// (number amounts); this carries it into the domain group the group queries cache, through the
// `entities/balance` legacy bridge (an unreadable balance is left out, reported once).
import type { Group as LegacyGroup } from 'api/chipin.types';
import type { Balance } from 'entities/balance';
import { legacyActivityPreview, legacyBalanceFromEntry } from 'entities/balance';
import type { Group, GroupMember } from 'entities/groups';

const toMember = (member: LegacyGroup['members'][number]): GroupMember => ({
    user: member.user,
    balancesByCurrency: Object.fromEntries(
        // Keyed by the normalized currency of each balance, as `toGroup` keys them.
        Object.values(member.balancesByCurrency).flatMap((entry): [string, Balance][] => {
            const balance = legacyBalanceFromEntry(entry);

            return balance ? [[balance.net.currency, balance]] : [];
        }),
    ),
});

/** A group a legacy write returned, as the domain group of the group queries. */
export const domainGroupFromLegacy = (group: LegacyGroup): Group => ({
    id: group.id,
    name: group.name,
    inviteToken: group.inviteToken,
    description: group.description,
    creator: group.creator,
    members: group.members.map(toMember),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    coverUrl: group.coverUrl,
    simplifyDebts: group.simplifyDebts,
    role: group.role,
    status: group.status,
    lastUsedCurrency: group.lastUsedCurrency,
    recentActivities: {
        items: group.recentActivities.items.map(legacyActivityPreview),
        nextCursor: group.recentActivities.nextCursor,
    },
});
