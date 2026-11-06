import { useShallow } from 'zustand/react/shallow';

import { useSelfUser } from 'hooks/useSelfUser';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupLeaving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const useConnect = () => {
    const { leaveGroup, selectedGroup } = useGroupsStore(
        useShallow(state => ({
            leaveGroup: state.leaveGroup,
            selectedGroup: state.selectedGroup,
        })),
    );
    const user = useSelfUser();
    const isLeavingGroup = useLoadingStore(selectGroupLeaving);

    return { leaveGroup, selectedGroup, user, isLeavingGroup };
};

export { useConnect };
