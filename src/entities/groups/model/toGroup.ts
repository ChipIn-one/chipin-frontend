// Groups (wire) → domain (spec 03 §1.3, §4.1): member balances become `Money` through
// `moneyFromWire`, the activity page the group carries becomes domain items (`toActivityItems`).
import { toActivityItems } from 'entities/activity';
import type { Balance } from 'entities/balance';
import type { components } from 'shared/api/generated/schema';
import type { CurrencyCode, InvalidItem } from 'shared/money';
import { currencyCode, mapItems, moneyFromWire, MoneyWireError } from 'shared/money';

import type { Group, GroupMember, GroupsListPage, GroupUser } from './types';

type GroupResponse = components['schemas']['GroupResponse'];
type GroupFeedResponse = components['schemas']['GroupFeedResponse'];
type GroupMemberInfo = components['schemas']['GroupMemberInfo'];
type CurrencyBalance = components['schemas']['CurrencyBalance'];
type UserResponse = components['schemas']['User'];

const toCurrency = (code: string): CurrencyCode => {
    try {
        return currencyCode(code);
    } catch {
        // Rejected like a malformed amount: the balance is left out and reported.
        throw new MoneyWireError('shape');
    }
};

const toBalance = (balance: CurrencyBalance): Balance => ({
    net: moneyFromWire(balance.netBalance, toCurrency(balance.currency)),
});

const isBalance = (item: Balance | InvalidItem): item is Balance => !('kind' in item);

const toGroupUser = (user: UserResponse): GroupUser => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    picture: user.picture ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

const toGroupMember = (member: GroupMemberInfo): GroupMember => ({
    user: toGroupUser(member.user),
    // Keyed by the normalized currency of each balance. Reported once per currency: never a user
    // id or an amount.
    balancesByCurrency: Object.fromEntries(
        mapItems(
            Object.values(member.balancesByCurrency),
            toBalance,
            balance => `group-member:${balance.currency}`,
        )
            .filter(isBalance)
            .map(balance => [balance.net.currency, balance]),
    ),
});

/**
 * `GroupResponse` (wire) → `Group` (domain). A member balance with an unreadable amount or currency
 * is left out (reported once by `mapItems`); an activity preview with one is an invalid item.
 */
export const toGroup = (response: GroupResponse): Group => ({
    id: response.id,
    name: response.name,
    inviteToken: response.inviteToken,
    description: response.description ?? null,
    creator: toGroupUser(response.creator),
    members: response.members.map(toGroupMember),
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    coverUrl: response.coverUrl ?? null,
    simplifyDebts: response.simplifyDebts,
    role: response.role,
    status: response.status,
    lastUsedCurrency: response.lastUsedCurrency,
    recentActivities: {
        items: toActivityItems(response.recentActivities.items),
        nextCursor: response.recentActivities.nextCursor ?? null,
    },
});

/** `GroupFeedResponse` (wire) → one page of the groups list (domain). */
export const toGroupsListPage = (response: GroupFeedResponse): GroupsListPage => ({
    items: response.items.map(toGroup),
    nextCursor: response.nextCursor,
});
