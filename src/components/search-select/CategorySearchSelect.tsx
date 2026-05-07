import { useMemo } from 'react';
import type { LucideProps } from 'lucide-react';
import { LucideChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex, Text } from '@radix-ui/themes';

import { EXPENSE_CATEGORIES, ExpenseCategory } from 'constants/chipin';

import { SearchSelect } from 'components/search-select';

type LucideIconComponent = React.FC<LucideProps>;

const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

const resolveIcon = (iconName: string, size: number, color?: string) => {
    const IconComponent = (LucideIcons as unknown as Record<string, LucideIconComponent>)[
        `Lucide${iconName}`
    ];

    const stroke = color ? `var(--${color}-9)` : undefined;

    return IconComponent ? <IconComponent size={size} color={stroke} /> : null;
};

interface Props {
    value?: string;
    isLoading?: boolean;
    onChange?: (value: string) => void;
}

type CategoryItem = {
    value: string;
    label: string;
    icon: React.ReactNode;
    isIndented: boolean;
    searchFields: string[];
};

const CategorySearchSelect: React.FC<Props> = ({ value, isLoading = false, onChange }) => {
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

    const triggerElement = (
        <Button
            type="button"
            variant="surface"
            color="gray"
            size="3"
            radius="large"
            loading={isLoading}
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
            onChange={onChange}
        />
    );
};

export default CategorySearchSelect;
