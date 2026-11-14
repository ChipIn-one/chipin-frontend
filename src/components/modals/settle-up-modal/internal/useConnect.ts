import { useIsLedgerEntryCreating } from 'hooks/useLedgerMutations';
import { useSelfUser } from 'hooks/useSelfUser';

const useConnect = () => {
    const user = useSelfUser();
    const isSubmitting = useIsLedgerEntryCreating();

    return { user, isSubmitting };
};

export { useConnect };
