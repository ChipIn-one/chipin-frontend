import { useMemo } from 'react';
import { LucideChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex, Text } from '@radix-ui/themes';

import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KEYS } from 'constants/category';
import { EXPENSE_CATEGORY_UI } from 'constants/category-ui';

import type { SearchSelectProps } from './SearchSelect';
import { SearchSelect } from './SearchSelect';
import type { SearchSelectItem } from './types';


type CategorySearchSelectProps = Pick<
    SearchSelectProps,
    | 'contentMaxWidth'
    | 'contentMinWidth'
    | 'contentWidth'
    | 'onChange'
    | 'triggerWidth'
    | 'value'
> & {
    isLoading?: boolean;
    isDisabled?: boolean;
    renderTrigger?: (item: CategoryItem | undefined) => React.ReactElement;
};

type CategoryItem = SearchSelectItem & {
    icon: React.ReactNode;
    isIndented: boolean;
    searchFields: string[];
};

const CategorySearchSelect = ({
    value,
    isLoading = false,
    isDisabled = false,
    renderTrigger,
    triggerWidth,
    contentWidth,
    contentMinWidth,
    contentMaxWidth,
    onChange,
}: CategorySearchSelectProps) => {
    const { t } = useTranslation('group');

    const items = useMemo(() => {
        const result: CategoryItem[] = [];

        for (const key of EXPENSE_CATEGORY_KEYS) {
            const category = EXPENSE_CATEGORIES[key];
            const categoryLabel = t(`expenses.modal.categories.${key}`);
            const categoryUi = EXPENSE_CATEGORY_UI[key];
            const CategoryIcon = categoryUi.icon;

            result.push({
                value: key,
                label: categoryLabel,
                icon: (
                    <CategoryIcon
                        size={20}
                        color={`var(--${categoryUi.color}-9)`}
                    />
                ),
                isIndented: false,
                searchFields: [key, categoryLabel],
            });

            for (const subcategory of category.subcategories) {
                const subLabel = t(`expenses.modal.subcategories.${subcategory}`);
                const subcategoryUi = categoryUi.subcategories[subcategory];
                const SubcategoryIcon = subcategoryUi.icon;

                result.push({
                    value: subcategory,
                    label: subLabel,
                    icon: (
                        <SubcategoryIcon
                            size={16}
                            color={`var(--${subcategoryUi.color}-9)`}
                        />
                    ),
                    isIndented: true,
                    searchFields: [subcategory, subLabel, categoryLabel],
                });
            }
        }

        return result;
    }, [t]);

    const selectedItem = items.find(item => item.value === value);

    const triggerElement = renderTrigger ? (
        renderTrigger(selectedItem)
    ) : (
        <Button
            type="button"
            variant="surface"
            color="gray"
            size="3"
            radius="large"
            loading={isLoading}
            disabled={isDisabled}
        >
            <Flex align="center" justify="between" gap="2" width="100%" minWidth="0">
                <Flex align="center" gap="2" minWidth="0" flexGrow="1">
                    {selectedItem?.icon}
                    <Text as="span" size="2" weight="medium" truncate>
                        {selectedItem?.label ?? t('common:fields.category')}
                    </Text>
                </Flex>
                <LucideChevronDown size={16} />
            </Flex>
        </Button>
    );

    return (
        <SearchSelect
            items={items}
            value={value}
            searchPlaceholder={t('expenses.modal.categorySearchPlaceholder')}
            emptyText={t('expenses.modal.categorySearchEmpty')}
            triggerElement={triggerElement}
            triggerWidth={triggerWidth}
            contentWidth={contentWidth}
            contentMinWidth={contentMinWidth}
            contentMaxWidth={contentMaxWidth}
            onChange={onChange}
        />
    );
};

export default CategorySearchSelect;
