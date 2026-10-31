import { useShallow } from 'zustand/react/shallow';

import { selectPayerUsers } from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

export const useConnect = () => {
    const members = useExpenseModalStore(useShallow(selectPayerUsers));
    const fields = useExpenseModalStore(useShallow(state => ({
        paidById: state.paidById,
        targetMode: state.targetMode,
        currentUserId: state.source.currentUser?.id,
        onPaidByChange: state.setPaidById,
    })));

    return { members, ...fields };
};
