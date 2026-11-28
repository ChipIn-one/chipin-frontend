import { useId, useRef } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Card, Flex, Text, TextField } from '@radix-ui/themes';
import { PencilIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AmountInput } from 'basics';
import { Select, type SelectItem } from 'basics/Select';

import styles from './SettlementAmountField.module.css';

interface Props {
    inputId: string;
    amount: string;
    currency: string;
    currencyItems: SelectItem[];
    /** The currency minor units: the field refuses more fraction digits as they are typed. */
    maxFractionDigits: number;
    /** The amount text is not an amount of the currency (it cannot be sent). */
    isAmountInvalid: boolean;
    /** A caption under the field: what the payment settles in full. */
    hint: string | null;
    /** Why the amount cannot be sent, shown under the field. */
    error: string | null;
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
    maxFractionDigits,
    isAmountInvalid,
    hint,
    error,
    onAmountChange,
    onCurrencyChange,
    onUseFullDebt,
    onUseHalfDebt,
}: Props) => {
    const { t } = useTranslation('friends');
    const hintId = useId();
    const errorId = useId();
    const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ');
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
                <div className={styles.amountField}>
                    <AmountInput
                        className={styles.amountInput}
                        id={inputId}
                        value={amount}
                        onChange={onAmountChange}
                        onFocus={onAmountFocus}
                        onClick={onAmountClick}
                        onKeyDown={onAmountKeyDown}
                        onBlur={onAmountBlur}
                        maxFractionDigits={maxFractionDigits}
                        aria-invalid={isAmountInvalid || Boolean(error)}
                        aria-describedby={describedBy || undefined}
                        color={PROP_COLOR.accent}
                        size="3"
                        variant="surface"
                        autoFocus
                    >
                        <TextField.Slot side="right" color={PROP_COLOR.neutral}>
                            <PencilIcon size={18} aria-hidden />
                        </TextField.Slot>
                    </AmountInput>
                </div>

                {currencyItems.length > 1 ? (
                    <div className={styles.currencyField}>
                        <Select
                            items={currencyItems}
                            value={currency}
                            onChange={onCurrencyChange}
                            size="3"
                            triggerVariant="surface"
                        />
                    </div>
                ) : (
                    <Card className={styles.staticCurrency} size="1">
                        <Text size="5" weight="bold">
                            {currency}
                        </Text>
                    </Card>
                )}
            </Flex>

            {hint && (
                <Text id={hintId} size="2" color={PROP_COLOR.neutral}>
                    {hint}
                </Text>
            )}

            {error && (
                <Text id={errorId} size="2" color={PROP_COLOR.danger}>
                    {error}
                </Text>
            )}

            <Flex gap="2">
                <Button
                    type="button"
                    size="2"
                    variant="soft"
                    color={PROP_COLOR.neutral}
                    onClick={onUseFullDebt}
                >
                    {t('friends:settleUp.fullDebt')}
                </Button>
                <Button
                    type="button"
                    size="2"
                    variant="soft"
                    color={PROP_COLOR.neutral}
                    onClick={onUseHalfDebt}
                >
                    {t('friends:settleUp.half')}
                </Button>
            </Flex>
        </Flex>
    );
};

export { SettlementAmountField };
