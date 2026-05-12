import { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@radix-ui/themes';

import { tryToBig } from 'helpers/numbers';

import { Amount } from './numbers';

interface Props {
    value: NumericValue;
    currencyCode: string;
    size: ComponentProps<typeof Text>['size'];
    align?: ComponentProps<typeof Text>['align'];
}

const OwedStatusText = ({ value, currencyCode, size, align = 'right' }: Props) => {
    const { t } = useTranslation('activity');
    const big = tryToBig(value);

    if (!big) {
        return null;
    }

    const isPositive = big.gte(0);

    return (
        <Text size={size} color={isPositive ? 'green' : 'red'} as="span" align={align}>
            {isPositive ? t('common:balances.youOwed') : t('common:balances.youOwe')}{' '}
            <Amount value={big.abs()} tokenCode={currencyCode} precision={0} />
        </Text>
    );
};

export default OwedStatusText;
