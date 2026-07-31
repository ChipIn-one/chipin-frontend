import { useMemo } from 'react';
import type { LucideProps } from 'lucide-react';
import { LucideChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex, Text } from '@radix-ui/themes';

import type { ExpenseCategory } from 'constants/chipin';
import { EXPENSE_CATEGORIES } from 'constants/chipin';

import type { SearchSelectProps } from './SearchSelect';
import { SearchSelect } from './SearchSelect';
import type { SearchSelectItem } from './types';

type LucideIconComponent = React.FC<LucideProps>;

const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

const resolveIcon = (iconName: string, size: number, color?: string) => {
    const IconComponent = (LucideIcons as unknown as Record<string, LucideIconComponent>)[
        `Lucide${iconName}`
    ];

    const stroke = color ? `var(--${color}-9)` : undefined;

    return IconComponent ? <IconComponent size={size} color={stroke} /> : null;
};

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

            result.push({
                value: key,
                label: categoryLabel,
                icon: resolveIcon(category.icon, 20, category.color),
                isIndented: false,
                searchFields: [key, categoryLabel],
            });

            for (const sub of category.subcategories) {
                const subLabel = t(`expenses.modal.subcategories.${sub.key}`);

                result.push({
                    value: sub.key,
                    label: subLabel,
                    icon: resolveIcon(sub.icon, 16, sub.color),
                    isIndented: true,
                    searchFields: [sub.key, subLabel, categoryLabel],
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
