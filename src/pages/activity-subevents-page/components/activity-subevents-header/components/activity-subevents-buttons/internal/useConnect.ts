import { useShallow } from 'zustand/react/shallow';

import { useActivityStore } from 'store/activity-store';
import { useExpenseModalStore } from 'store/expenseModalStore';
import {
    selectActivitySubeventsLoading,
    selectLedgerEntryRemoving,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const activity = useActivityStore(
        useShallow(state => ({
            prepareExpenseEdit: state.prepareExpenseEdit,
            reverseLedgerEntry: state.reverseLedgerEntry,
            subevents: state.subevents,
        })),
    );
    const loading = useLoadingStore(
        useShallow(state => ({
            isLoading: selectActivitySubeventsLoading(state),
            isRemoving: selectLedgerEntryRemoving(state),
        })),
    );

    const initializeEdit = useExpenseModalStore(state => state.initializeEdit);

    return { ...activity, ...loading, initializeEdit };
};

export { useConnect };
