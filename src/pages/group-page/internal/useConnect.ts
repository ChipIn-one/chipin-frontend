import { useShallow } from 'zustand/react/shallow';

import { useGroupsStore } from 'store/groupsStore';
import {
    selectGroupDataLoading,
    selectGroupListFetched,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const groupsState = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            selectedGroup: state.selectedGroup,
            fetchSetGroupById: state.fetchSetGroupById,
            setSelectedGroup: state.setSelectedGroup,
        })),
    );
    const loadingState = useLoadingStore(
        useShallow(state => ({
            isGroupDataLoading: selectGroupDataLoading(state),
            isGroupListFetched: selectGroupListFetched(state),
        })),
    );

    return { ...groupsState, ...loadingState };
};

export { useConnect };
