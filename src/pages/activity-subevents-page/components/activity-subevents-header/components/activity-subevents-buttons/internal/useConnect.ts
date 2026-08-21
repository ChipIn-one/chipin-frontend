import { useShallow } from 'zustand/react/shallow';

import { useActivityStore } from 'store/activity-store';
import {
    selectActivitySubeventsLoading,
    selectLedgerEntryRemoving,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const activity = useActivityStore(
        useShallow(state => ({
            reverseLedgerEntry: state.reverseLedgerEntry,
            subevents: state.subevents,
            subeventsParent: state.subeventsParent,
        })),
    );
    const loading = useLoadingStore(
        useShallow(state => ({
            isLoading: selectActivitySubeventsLoading(state),
            isRemoving: selectLedgerEntryRemoving(state),
        })),
    );

    return { ...activity, ...loading };
};

export { useConnect };
