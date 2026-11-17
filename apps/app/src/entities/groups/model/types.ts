import type { ActivityItem } from 'entities/activity';
import type { Balance } from 'entities/balance';

/** A group member's or creator's public profile. */
export interface GroupUser {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly firstName?: string | null;
    readonly lastName?: string | null;
    readonly picture?: string | null;
    /** Unix seconds. */
    readonly createdAt: number;
    /** Unix seconds. */
    readonly updatedAt: number;
}

/** An active member with the signed-in user's balances with them. */
export interface GroupMember {
    readonly user: GroupUser;
    /**
     * The readable balances with this member, keyed by currency: `net > 0` the member owes you,
     * `net < 0` you owe the member. Empty for you and when nothing is outstanding; a balance with
     * an unreadable amount or currency is left out (reported once).
     */
    readonly balancesByCurrency: Readonly<Record<string, Balance>>;
}

/**
 * One page of a group's activity previews (`GET /groups/{groupId}/activity-previews`, or the
 * first page a group carries), newest first, as domain items (amounts as `Money`,
 * `toActivityItems`); a preview with an unreadable amount is an invalid item.
 */
export interface GroupActivityPage {
    readonly items: readonly ActivityItem[];
    readonly nextCursor: number | null;
}

/** A group (`GET /groups/{id}`, an item of `GET /groups`) with its members' balances. */
export interface Group {
    readonly id: string;
    readonly name: string;
    readonly inviteToken: string;
    readonly description: string | null;
    readonly creator: GroupUser;
    readonly members: readonly GroupMember[];
    /** Unix seconds. */
    readonly createdAt: number;
    /** Unix seconds. */
    readonly updatedAt: number;
    readonly coverUrl: string | null;
    readonly simplifyDebts: boolean;
    /** The signed-in user's role. */
    readonly role: 'OWNER' | 'MEMBER';
    readonly status: 'ACTIVE';
    /** Currency of the latest manual entry in the group; null when there is none. */
    readonly lastUsedCurrency: string | null;
    /** The first page of the group's activity (it seeds `groups.activity`). */
    readonly recentActivities: GroupActivityPage;
}

/** One page of the user's groups (`GET /groups`), newest first. */
export interface GroupsListPage {
    readonly items: readonly Group[];
    /** Opaque: passed back as `cursor`, never parsed. */
    readonly nextCursor: string | null;
}
