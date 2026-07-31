import type { ActivityCategory } from 'constants/activity';

import type { ApiUserSettings } from './chipin.raw.types';

export interface CreateGroupParams {
    groupName: string;
    groupDescription?: string;
    groupEmoji?: string;
}

export interface UpdateUserParams {
    displayName?: string;
    settings?: ApiUserSettings;
}

export interface UploadUserAvatarParams {
    file: File;
    onProgress?: (progress: number) => void;
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

export interface RemoveKnownUserParams {
    userId: string;
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

export type SharingModeType = 'AUTO' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export interface SharingMode {
    type: SharingModeType;
    customShares?: Record<string, number>;
    percentageShares?: Record<string, number>;
    shares?: Record<string, number>;
}

export interface CreateLedgerEntryParams {
    groupId?: string;
    description: string;
    amount: number;
    date: number;
    payerId: string;
    participantIds: string[];
    currency: string;
    category?: string | null;
    sharingMode?: SharingMode;
}

export interface RemoveLedgerEntryParams {
    entryId: string;
}

export interface CreateSettlementParams {
    groupId?: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
}

export interface FetchActivitiesParams {
    limit?: number;
    cursor?: number;
}

export interface FetchActivityChildrenParams extends FetchActivitiesParams {
    parentActivityId: string;
    category?: ActivityCategory;
}
