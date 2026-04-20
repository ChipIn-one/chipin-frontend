import { Box, Button, Flex, Popover, ScrollArea, Text, TextField } from '@radix-ui/themes';
import { LucideCheck, LucideChevronDown, LucideSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import { selectAvailableCurrencies, selectDefaultCurrency } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';

interface Props {
    currency?: string;
    onChange?: (value: string) => void;
}

const FullWidthButton = styled(Button)`
    width: 100%;
    min-height: 36px;
    justify-content: flex-start;
    overflow: hidden;
    box-sizing: border-box;
`;

const OptionsScrollArea = styled(ScrollArea)`
    width: 100%;
    max-height: 240px;
    overflow-x: hidden;
`;

const CurrencySelect: React.FC<Props> = ({ onChange, currency }) => {
    const availableCurrencies = useDashboardStore(useShallow(selectAvailableCurrencies));
    const defaultCurrency = useDashboardStore(useShallow(selectDefaultCurrency));

    const { t } = useTranslation('settings');
    const [isOpen, setIsOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [internalCurrency, setInternalCurrency] = useState(currency ?? defaultCurrency ?? '');

    const selectedCurrency = currency ?? internalCurrency ?? defaultCurrency ?? '';

    useEffect(() => {
        if (currency !== undefined) {
            setInternalCurrency(currency);
            return;
        }

        if (!selectedCurrency) {
            setInternalCurrency(defaultCurrency ?? availableCurrencies[0] ?? '');
            return;
        }

        if (!availableCurrencies.includes(selectedCurrency)) {
            setInternalCurrency(defaultCurrency ?? availableCurrencies[0] ?? '');
        }
    }, [availableCurrencies, currency, defaultCurrency, selectedCurrency]);

    const filteredCurrencies = useMemo(() => {
        const normalizedSearch = searchValue.trim().toLowerCase();

        if (!normalizedSearch) {
            return availableCurrencies;
        }

        return availableCurrencies.filter(option => {
            const optionLabel = t(`regional.currencies.${option}`).toLowerCase();

            return (
                option.toLowerCase().includes(normalizedSearch) ||
                optionLabel.includes(normalizedSearch)
            );
        });
    }, [availableCurrencies, searchValue, t]);

    const onValueChange = (nextValue: string) => {
        setInternalCurrency(nextValue);
        onChange?.(nextValue);
        setIsOpen(false);
        setSearchValue('');
    };

    const onOpenChange = (nextOpen: boolean) => {
        setIsOpen(nextOpen);

        if (!nextOpen) {
            setSearchValue('');
        }
    };

    const selectedCurrencyLabel = selectedCurrency
        ? t(`regional.currencies.${selectedCurrency}`)
        : t('regional.currencyLabel');

    return (
        <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
            <Popover.Trigger>
                <FullWidthButton
                    type="button"
                    variant="surface"
                    color="gray"
                    size="2"
                    radius="large"
                >
                    <Flex align="center" justify="between" gap="2" width="100%" minWidth="0">
                        <Text as="span" size="2" weight="medium" truncate>
                            {selectedCurrencyLabel}
                        </Text>
                        <LucideChevronDown size={16} />
                    </Flex>
                </FullWidthButton>
            </Popover.Trigger>

            <Popover.Content
                align="start"
                sideOffset={4}
                width="var(--radix-popover-trigger-width)"
            >
                <Flex direction="column" gap="2">
                    <TextField.Root
                        autoFocus
                        size="2"
                        placeholder={t('regional.currencySearchPlaceholder')}
                        value={searchValue}
                        onChange={event => setSearchValue(event.target.value)}
                        aria-label={t('regional.currencySearchPlaceholder')}
                    >
                        <TextField.Slot side="left">
                            <LucideSearch size={16} />
                        </TextField.Slot>
                    </TextField.Root>

                    <OptionsScrollArea type="auto" scrollbars="vertical">
                        <Flex direction="column" gap="2" pr="4">
                            {filteredCurrencies.length > 0 ? (
                                filteredCurrencies.map(option => {
                                    const isSelected = option === selectedCurrency;

                                    return (
                                        <FullWidthButton
                                            key={option}
                                            type="button"
                                            size="2"
                                            variant={isSelected ? 'soft' : 'ghost'}
                                            color={isSelected ? 'indigo' : 'gray'}
                                            onClick={() => onValueChange(option)}
                                        >
                                            <Flex
                                                align="center"
                                                justify="between"
                                                gap="2"
                                                width="100%"
                                                minWidth="0"
                                            >
                                                <Text as="span" size="2" truncate>
                                                    {t(`regional.currencies.${option}`)}
                                                </Text>
                                                <Box width="16px" height="16px" flexShrink="0">
                                                    {isSelected ? <LucideCheck size={16} /> : null}
                                                </Box>
                                            </Flex>
                                        </FullWidthButton>
                                    );
                                })
                            ) : (
                                <Box px="2" py="3">
                                    <Text size="2" color="gray">
                                        {t('regional.currencySearchEmpty')}
                                    </Text>
                                </Box>
                            )}
                        </Flex>
                    </OptionsScrollArea>
                </Flex>
            </Popover.Content>
        </Popover.Root>
    );
};

export default CurrencySelect;
