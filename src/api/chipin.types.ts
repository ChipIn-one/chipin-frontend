import { BalancesMap } from 'helpers/currencies';

import { AppEvent } from './activity.types';

export interface ApiGroup {
    id: string;
    name: string;
    description: string | null;
    emoji: string | null;
    coverUrl: string | null;
    createdAt: number;
    updatedAt: number;
    // TODO TO BASE API USER
    inviteToken: string;
    creator: ApiUser;
    members: ApiUser[];
}

export interface ApiUser {
    id: string;
    email: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    picture: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface CreateGroupParams {
    groupName: string;
    groupDescription?: string;
    groupEmoji?: string;
}

export interface UpdateGroupParams {
    groupId: string;
    groupName: string;
    groupDescription?: string;
    groupEmoji?: string;
}

export interface RemoveGroupResponse {
    id: string;
}

export interface RemoveGroupParams {
    groupId: string;
}

export interface LeaveGroupParams {
    groupId: string;
    newOwnerId?: string;
}

export interface KickGroupMemberParams {
    groupId: string;
    userId: string;
}

export interface InviteToGroupParams {
    inviteToken: string;
}

export interface ApiBalanceEntry {
    currency: string;
    totalOwed: string;
    totalOwing: string;
    netBalance: string;
}

export interface DashboardApiResponse {
    groups: ApiGroup[];
    balances?: Record<string, ApiBalanceEntry>;
}

export type ParsedDashboardResponse = Omit<DashboardApiResponse, 'balances'> & {
    balances: BalancesMap;
};

export type SharingModeType = 'AUTO' | 'EXACT' | 'PERCENTAGE';

export interface SharingMode {
    type: SharingModeType;
    customShares?: Record<string, string>;
    percentageShares?: Record<string, string>;
}

export interface CreateLedgerEntryParams {
    groupId: string;
    description: string;
    amount: string | number;
    unixTimestamp: number;
    payerId: string;
    participantIds: string[];
    currency: string;
    category?: string | null;
    sharingMode?: SharingMode;
}

export interface ApiActivityResponse {
    items: AppEvent[];
    nextCursor: string | null;
}

export interface FetchActivityParams {
    limit?: number;
    cursor?: string;
}
