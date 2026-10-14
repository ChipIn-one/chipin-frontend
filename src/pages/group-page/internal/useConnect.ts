import { useShallow } from 'zustand/react/shallow';

import { useGroupsStore } from 'store/groupsStore';
import { selectGroupNextPageError } from 'store/errorsSelectors';
import { useErrorsStore } from 'store/errorsStore';
import {
    selectGroupDataFetched,
    selectGroupDataLoading,
    selectGroupNextPageLoading,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const groupsState = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            selectedGroup: state.selectedGroup,
            fetchSetGroupById: state.fetchSetGroupById,
            fetchMoreGroupActivity: state.fetchMoreGroupActivity,
        })),
    );
    const loadingState = useLoadingStore(
        useShallow(state => ({
            isGroupDataLoading: selectGroupDataLoading(state),
            isGroupActivityNextPageLoading: selectGroupNextPageLoading(state),
            isGroupDataFetched: selectGroupDataFetched(state),
        })),
    );
    const errorsState = useErrorsStore(
        useShallow(state => ({
            isGroupActivityNextPageError: selectGroupNextPageError(state) !== null,
        })),
    );

    return { ...groupsState, ...loadingState, ...errorsState };
};

export { useConnect };
