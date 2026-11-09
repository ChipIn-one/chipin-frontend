import { useSelfUser } from 'hooks/useSelfUser';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupUpdating } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const user = useSelfUser();
    const updateGroup = useGroupsStore(state => state.updateGroup);
    const isGroupUpdatePending = useLoadingStore(selectGroupUpdating);

    return { user, updateGroup, isGroupUpdatePending };
};

export { useConnect };
