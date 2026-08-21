import { useShallow } from 'zustand/react/shallow';

import { useGroupsStore } from 'store/groupsStore';
import { selectGroupLeaving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const { leaveGroup, selectedGroup } = useGroupsStore(
        useShallow(state => ({
            leaveGroup: state.leaveGroup,
            selectedGroup: state.selectedGroup,
        })),
    );
    const user = useUsersStore(state => state.user);
    const isLeavingGroup = useLoadingStore(selectGroupLeaving);

    return { leaveGroup, selectedGroup, user, isLeavingGroup };
};

export { useConnect };
