import type { AppEvent } from 'api/activity.types';
import type {
    CreateLedgerEntryParams as CreateExpenseInput,
    CreateSettlementParams,
} from 'api/chipin.types';
import type { ActivityCategory } from 'constants/activity';

interface FetchActivitySubeventsParams {
    parentActivityId: string;
    category?: ActivityCategory;
}

interface ActivityStoreState {
    items: AppEvent[];
    nextCursor: number | null;
    hasMore: boolean;
    selectedEvent: AppEvent | null;
    subevents: AppEvent[];
    subeventsNextCursor: number | null;
    hasMoreSubevents: boolean;
    subeventsParentId: string | null;
    subeventsCategory: ActivityCategory | null;
}

interface ActivityStoreActions {
    fetchSetActivity: () => Promise<void>;
    fetchMoreActivity: () => Promise<void>;
    fetchSetSelectedEvent: (activityId: string) => Promise<void>;
    fetchSetActivitySubevents: (
        params: FetchActivitySubeventsParams,
    ) => Promise<void>;
    fetchMoreActivitySubevents: () => Promise<void>;
    setSelectedEvent: (event: AppEvent) => void;
    createExpense: (input: CreateExpenseInput) => Promise<void>;
    createSettlement: (input: CreateSettlementParams) => Promise<void>;
    removeLedgerEntry: (entryId: string) => Promise<void>;
    resetActivitySubevents: () => void;
    resetActivity: () => void;
}

type ActivityStore = ActivityStoreState & ActivityStoreActions;

export type {
    ActivityStore,
    ActivityStoreActions,
    ActivityStoreState,
    FetchActivitySubeventsParams,
};
