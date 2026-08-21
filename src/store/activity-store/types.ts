import type { AppEvent } from 'api/activity.types';
import type {
    CreateLedgerEntryParams,
    CreateSettlementParams,
} from 'api/chipin.types';
import type { ActivityCategory } from 'constants/activity';

interface FetchActivitySubeventsParams {
    parentActivityId: string;
    category?: ActivityCategory;
    force?: boolean;
}

type CreateExpenseParams = CreateLedgerEntryParams & {
    parentActivityId?: string;
};

type CreateSettlementActionParams = CreateSettlementParams & {
    parentActivityId?: string;
};

interface ReverseLedgerEntryParams {
    entryId: string;
    groupId?: string;
    parentActivityId?: string;
}

interface ActivityStoreState {
    items: AppEvent[];
    nextCursor: number | null;
    hasMore: boolean;
    subevents: AppEvent[];
    subeventsParent: AppEvent | null;
    subeventsNextCursor: number | null;
    hasMoreSubevents: boolean;
    subeventsCategory: ActivityCategory | null;
}

interface ActivityStoreActions {
    createExpense: (params: CreateExpenseParams) => Promise<void>;
    createSettlement: (params: CreateSettlementActionParams) => Promise<void>;
    reverseLedgerEntry: (params: ReverseLedgerEntryParams) => Promise<void>;
    fetchSetActivity: (force?: boolean) => Promise<void>;
    fetchMoreActivity: () => Promise<void>;
    fetchSetActivitySubevents: (
        params: FetchActivitySubeventsParams,
    ) => Promise<void>;
    fetchMoreActivitySubevents: () => Promise<void>;
    resetActivitySubevents: () => void;
    resetActivity: () => void;
}

type ActivityStore = ActivityStoreState & ActivityStoreActions;

export type {
    ActivityStore,
    ActivityStoreActions,
    ActivityStoreState,
    CreateExpenseParams,
    CreateSettlementActionParams,
    FetchActivitySubeventsParams,
    ReverseLedgerEntryParams,
};
