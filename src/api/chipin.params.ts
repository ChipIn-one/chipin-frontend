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

export interface FetchActivityParams {
    limit?: number;
    cursor?: string;
}
