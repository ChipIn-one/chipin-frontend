import { LucideBanknoteArrowDown, LucideBanknoteArrowUp, LucideTrash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@radix-ui/themes';

import {
    ACTIVITY_ACTIONS,
    type ExpenseCreatedAction,
    type ExpenseReversedAction,
    type ExpenseUpdatedAction,
} from 'constants/activity';

import { getConfiguredExpenseIcon } from './helpers';

interface Props {
    action: ExpenseCreatedAction | ExpenseUpdatedAction | ExpenseReversedAction;
    category?: string | null;
    subcategory?: string | null;
    hasCurrentUser: boolean;
    isCurrentUserPayer: boolean;
}

const getIconColor = (
    isReversed: boolean,
    hasCurrentUser: boolean,
    isCurrentUserPayer: boolean,
) => {
    if (isReversed) {
        return 'red';
    }

    if (!hasCurrentUser) {
        return 'gray';
    }

    return isCurrentUserPayer ? 'green' : 'red';
};

const getExpenseIcon = (isReversed: boolean, isCurrentUserPayer: boolean) => {
    if (isReversed) {
        return <LucideTrash2 size={28} />;
    }

    if (isCurrentUserPayer) {
        return <LucideBanknoteArrowUp size={28} />;
    }

    return <LucideBanknoteArrowDown size={28} />;
};

const ExpenseIcon = ({
    action,
    category,
    subcategory,
    hasCurrentUser,
    isCurrentUserPayer,
}: Props) => {
    const { t } = useTranslation('group');
    const isReversed = action === ACTIVITY_ACTIONS.EXPENSE_REVERSED;
    const configuredIcon = isReversed
        ? undefined
        : getConfiguredExpenseIcon(subcategory, category);
    const ConfiguredIcon = configuredIcon?.icon;
    const accessibleLabel = configuredIcon ? t(configuredIcon.labelKey) : undefined;

    return (
        <Avatar
            size="4"
            variant="soft"
            color={
                configuredIcon?.color ??
                getIconColor(isReversed, hasCurrentUser, isCurrentUserPayer)
            }
            role={accessibleLabel ? 'img' : undefined}
            aria-label={accessibleLabel}
            fallback={
                ConfiguredIcon ? (
                    <ConfiguredIcon size={24} />
                ) : (
                    getExpenseIcon(isReversed, isCurrentUserPayer)
                )
            }
        />
    );
};

export { ExpenseIcon };
