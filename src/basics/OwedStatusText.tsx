import { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@radix-ui/themes';

import { Amount } from './numbers';

interface Props {
    value: number;
    currencyCode: string;
    size: ComponentProps<typeof Text>['size'];
    align?: ComponentProps<typeof Text>['align'];
}

const OwedStatusText = ({ value, currencyCode, size, align = 'right' }: Props) => {
    const { t } = useTranslation('activity');

    if (!value) {
        return null;
    }

    const isPositive = value >= 0;

    return (
        <Text size={size} color={isPositive ? 'green' : 'red'} as="span" align={align}>
            {isPositive ? t('common:balances.youOwed') : t('common:balances.youOwe')}{' '}
            <Amount value={Math.abs(value)} tokenCode={currencyCode} precision={0} />
        </Text>
    );
};

export default OwedStatusText;
