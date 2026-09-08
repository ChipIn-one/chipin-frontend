import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Skeleton, Text, VisuallyHidden } from '@radix-ui/themes';

import { Amount } from 'basics/numbers';

interface Props {
    amount: number;
    isLoading?: boolean;
    currency: string;
    size?: ComponentProps<typeof Text>['size'];
    weight?: ComponentProps<typeof Text>['weight'];
    withPlus?: boolean;
    amountProps?: Omit<
        ComponentProps<typeof Amount>,
        'customPrefix' | 'precision' | 'tokenCode' | 'value'
    >;
}

const DebtAmount = ({
    amount,
    currency,
    isLoading = false,
    size = '2',
    weight = 'regular',
    withPlus = false,
    amountProps,
}: Props) => {
    const { t } = useTranslation('skeletons');
    const { t: tCommon } = useTranslation('common');
    const isOwed = amount > 0;
    const isZero = amount === 0;
    const color = isZero ? 'gray' : isOwed ? 'green' : 'red';
    const directionLabel = isZero
        ? tCommon('balances.settledUp')
        : tCommon(isOwed ? 'balances.youAreOwed' : 'balances.youOwe');

    return (
        <Text as="span" size={size} color={color} weight={weight}>
            <Skeleton loading={isLoading}>
                {isLoading ? (
                    t('debtAmount.amount')
                ) : (
                    <Amount
                        {...amountProps}
                        value={amount}
                        customPrefix={withPlus && isOwed ? '+' : undefined}
                        tokenCode={currency}
                        precision={0}
                    />
                )}
            </Skeleton>
            {!isLoading && <VisuallyHidden>{directionLabel}</VisuallyHidden>}
        </Text>
    );
};

export default DebtAmount;
