import { useShallow } from 'zustand/react/shallow';

import {
    selectActivitySubeventsFlow,
    useActivityStore,
} from 'store/activity-store';
import {
    selectActivitySubeventsLoading,
    selectActivitySubeventsNextPageLoading,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const activity = useActivityStore(useShallow(selectActivitySubeventsFlow));
    const loading = useLoadingStore(
        useShallow(state => ({
            isLoading: selectActivitySubeventsLoading(state),
            isNextPageLoading: selectActivitySubeventsNextPageLoading(state),
        })),
    );

    return { ...activity, ...loading };
};

export { useConnect };
