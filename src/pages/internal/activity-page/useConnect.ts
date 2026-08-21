import { useActivityStore } from 'store/activity-store';
import { selectActivityFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const fetchSetActivity = useActivityStore(state => state.fetchSetActivity);
    const isActivityFetched = useLoadingStore(selectActivityFetched);

    return { fetchSetActivity, isActivityFetched };
};

export { useConnect };
