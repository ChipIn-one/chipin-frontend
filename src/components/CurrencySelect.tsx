import { useMemo, useState } from 'react';
import { LucideChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Button, Flex, Text } from '@radix-ui/themes';

import { selectAvailableCurrencies, selectDefaultCurrency } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';

import type { SearchSelectProps } from 'components/search-select';
import { SearchSelect } from 'components/search-select';

type Props = Pick<
    SearchSelectProps,
    | 'contentMaxWidth'
    | 'contentMinWidth'
    | 'contentWidth'
    | 'onChange'
    | 'triggerWidth'
> & {
    currency?: string;
    isLoading?: boolean;
    triggerElement?: SearchSelectProps['triggerElement'];
};

const CurrencySelect = ({
    onChange,
    isLoading = false,
    currency,
    triggerElement,
    triggerWidth,
    contentWidth,
    contentMinWidth,
    contentMaxWidth,
}: Props) => {
    const availableCurrencies = useDashboardStore(useShallow(selectAvailableCurrencies));
    const defaultCurrency = useDashboardStore(useShallow(selectDefaultCurrency));

    const { t } = useTranslation('currencies');
    const [internalCurrency, setInternalCurrency] = useState(currency ?? defaultCurrency ?? '');

    const selectedCurrency =
        currency || internalCurrency || defaultCurrency || availableCurrencies[0] || '';

    const items = useMemo(
        () =>
            availableCurrencies.map(code => ({
                value: code,
                label: `${t(code)}`,
                searchFields: [code, t(code)],
            })),
        [availableCurrencies, t],
    );

    const selectedCurrencyLabel = selectedCurrency ? `${t(selectedCurrency)}` : selectedCurrency;

    const defaultTriggerElement = (
        <Button
            type="button"
            variant="surface"
            color="gray"
            size="3"
            radius="large"
            loading={isLoading}
        >
            <Flex align="center" justify="between" gap="2" width="100%" minWidth="0">
                <Text as="span" size="2" weight="medium" truncate>
                    {selectedCurrencyLabel}
                </Text>
                <LucideChevronDown size={16} />
            </Flex>
        </Button>
    );

    const onCurrencyChange = (nextValue: string) => {
        if (currency === undefined) {
            setInternalCurrency(nextValue);
        }

        onChange?.(nextValue);
    };

    return (
        <SearchSelect
            items={items}
            value={selectedCurrency}
            searchPlaceholder={t('searchPlaceholder')}
            emptyText={t('searchEmpty')}
            triggerElement={triggerElement ?? defaultTriggerElement}
            triggerWidth={triggerWidth}
            contentWidth={contentWidth}
            contentMinWidth={contentMinWidth}
            contentMaxWidth={contentMaxWidth}
            onChange={onCurrencyChange}
        />
    );
};

export default CurrencySelect;
