import { useTranslation } from 'react-i18next';

import { Flex, Text } from '@radix-ui/themes';

import Select, { type SelectItem } from 'components/Select';

import {
    AmountField,
    CurrencyField,
    LargeAmountInput,
    StaticCurrencyField,
} from '../styled';

interface Props {
    inputId: string;
    amount: string;
    currency: string;
    currencyItems: SelectItem[];
    onAmountChange: (amount: string) => void;
    onCurrencyChange: (currency: string) => void;
}

const SettlementAmountField = ({
    inputId,
    amount,
    currency,
    currencyItems,
    onAmountChange,
    onCurrencyChange,
}: Props) => {
    const { t } = useTranslation('common');

    return (
        <Flex direction="column" gap="2">
            <Text as="label" htmlFor={inputId} size="3" weight="bold" color="gray">
                {t('common:fields.amount')}
            </Text>

            <Flex align="stretch" gap="2">
                <AmountField>
                    <LargeAmountInput
                        id={inputId}
                        value={amount}
                        onChange={onAmountChange}
                        maxFractionDigits={null}
                        color="jade"
                        size="3"
                        autoFocus
                    />
                </AmountField>

                {currencyItems.length > 1 ? (
                    <CurrencyField>
                        <Select
                            items={currencyItems}
                            value={currency}
                            onChange={onCurrencyChange}
                            size="3"
                            triggerVariant="surface"
                        />
                    </CurrencyField>
                ) : (
                    <StaticCurrencyField size="1">
                        <Text size="5" weight="bold">
                            {currency}
                        </Text>
                    </StaticCurrencyField>
                )}
            </Flex>
        </Flex>
    );
};

export default SettlementAmountField;
