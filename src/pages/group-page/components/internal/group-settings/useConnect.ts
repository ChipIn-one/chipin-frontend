import { useGroupsStore } from 'store/groupsStore';
import { selectGroupUpdating } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

const useConnect = () => {
    const user = useUsersStore(state => state.user);
    const updateGroup = useGroupsStore(state => state.updateGroup);
    const isGroupUpdatePending = useLoadingStore(selectGroupUpdating);

    return { user, updateGroup, isGroupUpdatePending };
};

export { useConnect };
