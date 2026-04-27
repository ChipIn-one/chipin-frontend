import { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@radix-ui/themes';

import { Amount } from './numbers';

interface Props {
    amount: number;
    currencyCode: string;
    size: ComponentProps<typeof Text>['size'];
}

const OwedStatusText = ({ amount, currencyCode, size }: Props) => {
    const { t } = useTranslation('activity');
    const isAmountPositive = amount >= 0;
    const absoluteAmount = Math.abs(amount);

    return (
        <Text size={size} color={isAmountPositive ? 'green' : 'red'} as="span" align="right">
            {isAmountPositive ? t('common:balances.youOwed') : t('common:balances.youOwe')}{' '}
            <Amount value={absoluteAmount} tokenCode={currencyCode} />
        </Text>
    );
};

export default OwedStatusText;
