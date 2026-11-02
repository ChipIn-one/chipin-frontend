import { useShallow } from 'zustand/react/shallow';

import { selectExpenseSubmitFeedback } from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

export const useConnect = () => {
    const { mode, currency } = useExpenseModalStore(useShallow(state => ({
        mode: state.mode,
        currency: state.currency,
    })));
    const feedback = useExpenseModalStore(useShallow(selectExpenseSubmitFeedback));

    return { mode, currency, feedback };
};
