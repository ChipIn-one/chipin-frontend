import { useUpdateGroup } from 'hooks/useGroupMutations';
import { useSelfUser } from 'hooks/useSelfUser';

const useConnect = () => {
    const user = useSelfUser();
    const { updateGroup, isPending: isGroupUpdatePending } = useUpdateGroup();

    return { user, updateGroup, isGroupUpdatePending };
};

export { useConnect };
