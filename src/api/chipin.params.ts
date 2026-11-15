import type { ActivityCategory } from 'constants/activity';

export type SharingModeType = 'AUTO' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

/**
 * The split of a legacy activity snapshot (read side, `api/activity.types`). An expense write is
 * built from `ExpenseDraftSharingMode` of `entities/ledger` (`Money` and decimal text).
 */
export interface SharingMode {
    type: SharingModeType;
    customShares?: Record<string, number>;
    percentageShares?: Record<string, number>;
    shares?: Record<string, number>;
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
