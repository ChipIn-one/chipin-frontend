import type { ActivityCategory } from 'constants/activity';

import type { ApiUserSettings } from './chipin.raw.types';

export interface CreateGroupParams {
    groupName: string;
    groupDescription?: string;
}

export interface UpdateUserParams {
    displayName?: string;
    settings?: Partial<ApiUserSettings>;
}

export interface UploadUserAvatarParams {
    file: File;
    onProgress?: (progress: number) => void;
}

export interface UploadGroupCoverParams {
    groupId: string;
    file: File;
    onProgress?: (progress: number) => void;
}

export interface UpdateGroupParams {
    groupId: string;
    groupName: string;
    groupDescription?: string;
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
    description: string | null;
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

export interface FetchLedgerEntryParams {
    entryId: string;
}

export interface CreateSettlementParams {
    groupId?: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
}

export interface UpdateLedgerExpenseParams {
    type: 'EXPENSE';
    expense: {
        description?: string | null;
        amount?: number;
        date?: number;
        payerId?: string;
        participantIds?: string[];
        category?: string | null;
        subcategory?: string | null;
        currency?: string;
        sharingMode?: SharingMode;
    };
}

export interface UpdateLedgerSettlementParams {
    type: 'SETTLEMENT';
    settlement: {
        toUserId: string;
        amount: number;
        currency: string;
    };
}

export type UpdateLedgerEntryParams = {
    entryId: string;
    entry: UpdateLedgerExpenseParams | UpdateLedgerSettlementParams;
};

export interface FetchActivitiesParams {
    limit?: number;
    cursor?: number;
}

export interface FetchGroupActivityPreviewsParams extends FetchActivitiesParams {
    groupId: string;
}

export interface FetchActivityChildrenParams extends FetchActivitiesParams {
    parentActivityId: string;
    category?: ActivityCategory;
}
