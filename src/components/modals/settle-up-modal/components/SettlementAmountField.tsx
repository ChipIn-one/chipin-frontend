import { useRef } from 'react';
import { PencilIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex, Text, TextField } from '@radix-ui/themes';

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
    onUseFullDebt: () => void;
    onUseHalfDebt: () => void;
}

const SettlementAmountField = ({
    inputId,
    amount,
    currency,
    currencyItems,
    onAmountChange,
    onCurrencyChange,
    onUseFullDebt,
    onUseHalfDebt,
}: Props) => {
    const { t } = useTranslation('friends');
    // The first click after focus would otherwise move the caret and drop the focus selection.
    const isSelectOnClickPending = useRef(false);

    const onAmountFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        isSelectOnClickPending.current = true;
        event.currentTarget.select();
    };

    // Once the user edits or leaves the field, a later click must place the caret, not select all.
    const onAmountKeyDown = () => {
        isSelectOnClickPending.current = false;
    };

    const onAmountBlur = () => {
        isSelectOnClickPending.current = false;
    };

    const onAmountClick = (event: React.MouseEvent<HTMLInputElement>) => {
        if (!isSelectOnClickPending.current) {
            return;
        }

        isSelectOnClickPending.current = false;
        event.currentTarget.select();
    };

    return (
        <Flex direction="column" gap="2">
            <Text as="label" htmlFor={inputId} size="3" weight="bold">
                {t('friends:settleUp.paymentAmount')}
            </Text>

            <Flex align="stretch" gap="2">
                <AmountField>
                    <LargeAmountInput
                        id={inputId}
                        value={amount}
                        onChange={onAmountChange}
                        onFocus={onAmountFocus}
                        onClick={onAmountClick}
                        onKeyDown={onAmountKeyDown}
                        onBlur={onAmountBlur}
                        maxFractionDigits={null}
                        color="jade"
                        size="3"
                        variant="surface"
                        autoFocus
                    >
                        <TextField.Slot side="right" color="gray">
                            <PencilIcon size={18} aria-hidden />
                        </TextField.Slot>
                    </LargeAmountInput>
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

            <Flex gap="2">
                <Button type="button" size="2" variant="soft" color="gray" onClick={onUseFullDebt}>
                    {t('friends:settleUp.fullDebt')}
                </Button>
                <Button type="button" size="2" variant="soft" color="gray" onClick={onUseHalfDebt}>
                    {t('friends:settleUp.half')}
                </Button>
            </Flex>
        </Flex>
    );
};

export default SettlementAmountField;
