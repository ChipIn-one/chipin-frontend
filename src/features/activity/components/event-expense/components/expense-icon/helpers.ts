import { EXPENSE_CATEGORY_KEYS } from 'constants/category';
import { EXPENSE_CATEGORY_UI } from 'constants/category-ui';

const getConfiguredExpenseIcon = (
    subcategory?: string | null,
    category?: string | null,
) => {
    if (subcategory) {
        for (const categoryKey of EXPENSE_CATEGORY_KEYS) {
            const categoryUi = EXPENSE_CATEGORY_UI[categoryKey];

            for (const [subcategoryKey, subcategoryUi] of Object.entries(
                categoryUi.subcategories,
            )) {
                if (subcategoryKey === subcategory) {
                    return {
                        icon: subcategoryUi.icon,
                        color: subcategoryUi.color,
                        labelKey: `expenses.modal.subcategories.${subcategoryKey}`,
                    };
                }
            }
        }
    }

    if (category) {
        for (const categoryKey of EXPENSE_CATEGORY_KEYS) {
            if (categoryKey === category) {
                const categoryUi = EXPENSE_CATEGORY_UI[categoryKey];

                return {
                    icon: categoryUi.icon,
                    color: categoryUi.color,
                    labelKey: `expenses.modal.categories.${categoryKey}`,
                };
            }
        }
    }

    return undefined;
};

export { getConfiguredExpenseIcon };
