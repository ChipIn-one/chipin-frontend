import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button } from '@radix-ui/themes';
import { CirclePlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useAddExpenseAvailability } from 'hooks/useAddExpenseAvailability';
import { useExpenseModalStore } from 'store/expenseModalStore';

// The `Add Expense` action of an empty feed (EXP-065): the shell action's editor, availability and
// group preselection (the modal reads the group from the route). Where the shell action is absent
// it is `undefined`, so the empty state has no action slot at all (EXP-061).
const useEmptyStateAddExpenseAction = (): ReactNode | undefined => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const { isSoloMode, isVisible } = useAddExpenseAvailability(location.pathname);
    const openExpenseModal = useExpenseModalStore(state => state.open);

    if (!isVisible) {
        return undefined;
    }

    return (
        <Button
            type="button"
            variant="soft"
            color={isSoloMode ? PROP_COLOR.solo : PROP_COLOR.accent}
            onClick={() => {
                openExpenseModal();
            }}
        >
            <CirclePlusIcon size={14} />
            {t('buttons.addExpense')}
        </Button>
    );
};

export { useEmptyStateAddExpenseAction };
