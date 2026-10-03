import { LucideBanknoteArrowDown, LucideBanknoteArrowUp, LucideTrash2 } from 'lucide-react';

import { Avatar } from '@radix-ui/themes';

import {
    ACTIVITY_ACTIONS,
    type ExpenseCreatedAction,
    type ExpenseReversedAction,
    type ExpenseUpdatedAction,
} from 'constants/activity';
import { EXPENSE_CATEGORY_KEYS } from 'constants/category';
import { EXPENSE_CATEGORY_UI } from 'constants/category-ui';

interface Props {
    action: ExpenseCreatedAction | ExpenseUpdatedAction | ExpenseReversedAction;
    category?: string | null;
    subcategory?: string | null;
    hasCurrentUser: boolean;
    isCurrentUserPayer: boolean;
}

const getOwnEntry = <Value,>(
    record: Readonly<Record<string, Value>>,
    key: string,
): Value | undefined => {
    if (!Object.hasOwn(record, key)) {
        return undefined;
    }

    return record[key];
};

const getConfiguredExpenseIcon = (
    subcategory?: string | null,
    category?: string | null,
) => {
    if (subcategory) {
        for (const categoryKey of EXPENSE_CATEGORY_KEYS) {
            const subcategoryUi = getOwnEntry(
                EXPENSE_CATEGORY_UI[categoryKey].subcategories,
                subcategory,
            );

            if (subcategoryUi) {
                return subcategoryUi;
            }
        }
    }

    if (category) {
        return getOwnEntry(EXPENSE_CATEGORY_UI, category);
    }

    return undefined;
};

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
    const isReversed = action === ACTIVITY_ACTIONS.EXPENSE_REVERSED;
    const configuredIcon = isReversed
        ? undefined
        : getConfiguredExpenseIcon(subcategory, category);
    const ConfiguredIcon = configuredIcon?.icon;

    return (
        <Avatar
            size="4"
            variant="soft"
            color={
                configuredIcon?.color ??
                getIconColor(isReversed, hasCurrentUser, isCurrentUserPayer)
            }
            fallback={
                ConfiguredIcon ? (
                    <ConfiguredIcon size={28} />
                ) : (
                    getExpenseIcon(isReversed, isCurrentUserPayer)
                )
            }
        />
    );
};

export { ExpenseIcon };
