import { useSelfUser } from 'hooks/useSelfUser';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupLeaving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const leaveGroup = useGroupsStore(state => state.leaveGroup);
    const user = useSelfUser();
    const isLeavingGroup = useLoadingStore(selectGroupLeaving);

    return { leaveGroup, user, isLeavingGroup };
};

export { useConnect };
