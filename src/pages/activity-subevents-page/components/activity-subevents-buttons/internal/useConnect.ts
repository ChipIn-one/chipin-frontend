import { useShallow } from 'zustand/react/shallow';

import { useActivityStore } from 'store/activity-store';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { selectActivitySubeventsLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const activity = useActivityStore(
        useShallow(state => ({
            prepareExpenseEdit: state.prepareExpenseEdit,
            subevents: state.subevents,
        })),
    );
    const isLoading = useLoadingStore(selectActivitySubeventsLoading);

    const initializeEdit = useExpenseModalStore(state => state.initializeEdit);

    return { ...activity, isLoading, initializeEdit };
};

export { useConnect };
