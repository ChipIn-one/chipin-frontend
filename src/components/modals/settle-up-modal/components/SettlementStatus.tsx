import { Amount } from 'basics';
import { LucideCircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, Flex, Text } from '@radix-ui/themes';

interface SettlementStatusProps {
    isDebtSettled: boolean;
    remainingAmount: number;
    currency: string;
    color: 'green' | 'red';
}

const SettlementStatus = ({
    isDebtSettled,
    remainingAmount,
    currency,
    color,
}: SettlementStatusProps) => {
    const { t } = useTranslation('friends');

    return (
        <Card size="2">
            <Flex align="center" justify="center" gap="2" wrap="wrap">
                {isDebtSettled ? (
                    <>
                        <Text color="green" asChild>
                            <LucideCircleCheck size={18} />
                        </Text>
                        <Text size="3" weight="medium" color="green">
                            {t('friends:settleUp.debtWillBeSettled')}
                        </Text>
                    </>
                ) : (
                    <>
                        <Text size="3" color="gray">
                            {t('friends:settleUp.remainingDebt')}
                        </Text>
                        <Text size="3" weight="bold" color={color}>
                            <Amount value={remainingAmount} tokenCode={currency} precision={2} />
                        </Text>
                    </>
                )}
            </Flex>
        </Card>
    );
};

export default SettlementStatus;
