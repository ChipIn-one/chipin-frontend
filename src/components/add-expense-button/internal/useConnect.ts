import { useAddExpenseAvailability } from 'hooks/useAddExpenseAvailability';
import { useExpenseModalStore } from 'store/expenseModalStore';

const useConnect = (pathname: string) => {
    const { isSoloMode, isVisible } =
        useAddExpenseAvailability(pathname);
    const openExpenseModal = useExpenseModalStore(state => state.open);

    return {
        isSoloMode,
        isVisible,
        openExpenseModal,
    };
};

export { useConnect };
