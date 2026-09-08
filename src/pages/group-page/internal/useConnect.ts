import { useShallow } from 'zustand/react/shallow';

import { useGroupsStore } from 'store/groupsStore';
import { selectGroupNextPageError } from 'store/errorsSelectors';
import { useErrorsStore } from 'store/errorsStore';
import {
    selectGroupDataLoading,
    selectGroupNextPageLoading,
    selectGroupListFetched,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const groupsState = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            selectedGroup: state.selectedGroup,
            fetchSetGroupById: state.fetchSetGroupById,
            fetchMoreGroupActivity: state.fetchMoreGroupActivity,
            setSelectedGroup: state.setSelectedGroup,
        })),
    );
    const loadingState = useLoadingStore(
        useShallow(state => ({
            isGroupDataLoading: selectGroupDataLoading(state),
            isGroupActivityNextPageLoading: selectGroupNextPageLoading(state),
            isGroupListFetched: selectGroupListFetched(state),
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
