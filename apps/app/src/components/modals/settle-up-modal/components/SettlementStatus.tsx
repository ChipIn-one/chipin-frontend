import { PROP_COLOR } from '@chipin/tokens/theme';
import { Card, Flex, Text } from '@radix-ui/themes';
import { CircleCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { legacyAmountFromMoney } from 'entities/balance';
import type { Money } from 'shared/money';

import { Amount } from 'basics';

interface SettlementStatusProps {
    isDebtSettled: boolean;
    /** The debt left after the settlement: zero or at least one minor unit. */
    remainingAmount: Money;
    color: typeof PROP_COLOR.debtOwed | typeof PROP_COLOR.debtOwing;
}

const SettlementStatus = ({ isDebtSettled, remainingAmount, color }: SettlementStatusProps) => {
    const { t } = useTranslation('friends');

    return (
        <Card size="2">
            <Flex align="center" justify="center" gap="2" wrap="wrap">
                {isDebtSettled ? (
                    <>
                        <Text color={PROP_COLOR.success} asChild>
                            <CircleCheckIcon size={18} />
                        </Text>
                        <Text size="3" weight="medium" color={PROP_COLOR.success}>
                            {t('friends:settleUp.debtWillBeSettled')}
                        </Text>
                    </>
                ) : (
                    <>
                        <Text size="3" color={PROP_COLOR.neutral}>
                            {t('friends:settleUp.remainingDebt')}
                        </Text>
                        <Text size="3" weight="bold" color={color}>
                            <Amount
                                value={legacyAmountFromMoney(remainingAmount)}
                                tokenCode={remainingAmount.currency}
                                precision={2}
                            />
                        </Text>
                    </>
                )}
            </Flex>
        </Card>
    );
};

export default SettlementStatus;
