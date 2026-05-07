import { ComponentProps, useMemo, useState } from 'react';
import { LucideChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Button, Flex, Text } from '@radix-ui/themes';

import { selectAvailableCurrencies, selectDefaultCurrency } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';

import { SearchSelect } from 'components/search-select';

type SearchSelectProps = ComponentProps<typeof SearchSelect>;

interface Props {
    currency?: string;
    isLoading?: boolean;
    triggerElement?: SearchSelectProps['triggerElement'];
    contentWidthMode?: SearchSelectProps['contentWidthMode'];
    widthContainerRef?: SearchSelectProps['widthContainerRef'];
    onChange?: (value: string) => void;
}

const CurrencySelect: React.FC<Props> = ({
    onChange,
    isLoading = false,
    currency,
    triggerElement,
    contentWidthMode,
    widthContainerRef,
}) => {
    const availableCurrencies = useDashboardStore(useShallow(selectAvailableCurrencies));
    const defaultCurrency = useDashboardStore(useShallow(selectDefaultCurrency));

    const { t } = useTranslation('settings');
    const [internalCurrency, setInternalCurrency] = useState(currency ?? defaultCurrency ?? '');

    const selectedCurrency =
        currency || internalCurrency || defaultCurrency || availableCurrencies[0] || '';

    const items = useMemo(
        () =>
            availableCurrencies.map(code => ({
                value: code,
                label: `${t(`regional.currencies.${code}`)}`,
                searchFields: [code, t(`regional.currencies.${code}`)],
            })),
        [availableCurrencies, t],
    );

    const selectedCurrencyLabel = selectedCurrency
        ? `${t(`regional.currencies.${selectedCurrency}`)}`
        : t('regional.currencyLabel');

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

    const handleChange = (nextValue: string) => {
        if (currency === undefined) {
            setInternalCurrency(nextValue);
        }

        onChange?.(nextValue);
    };

    return (
        <SearchSelect
            items={items}
            value={selectedCurrency}
            searchPlaceholder={t('regional.currencySearchPlaceholder')}
            emptyText={t('regional.currencySearchEmpty')}
            triggerElement={triggerElement ?? defaultTriggerElement}
            contentWidthMode={contentWidthMode}
            widthContainerRef={widthContainerRef}
            onChange={handleChange}
        />
    );
};

export default CurrencySelect;
