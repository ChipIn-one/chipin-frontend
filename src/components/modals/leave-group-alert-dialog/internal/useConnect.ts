import { useLeaveGroup } from 'hooks/useGroupMutations';
import { useSelfUser } from 'hooks/useSelfUser';

const useConnect = () => {
    const { leaveGroup, isPending: isLeavingGroup } = useLeaveGroup();
    const user = useSelfUser();

    return { leaveGroup, user, isLeavingGroup };
};

export { useConnect };
