import { ComponentProps } from 'react';

import { Skeleton, Text } from '@radix-ui/themes';

import { Amount } from 'basics/numbers';

interface Props {
    amount: number;
    isLoading?: boolean;
    currency: string;
    size?: ComponentProps<typeof Text>['size'];
    weight?: ComponentProps<typeof Text>['weight'];
    withPlus?: boolean;
}

const DebtAmount = ({
    amount,
    currency,
    isLoading = false,
    size = '2',
    weight = 'regular',
    withPlus = false,
}: Props) => {
    const isOwed = amount > 0;
    const isZero = amount === 0;
    const color = isZero ? 'gray' : isOwed ? 'green' : 'red';

    return (
        <Skeleton loading={isLoading} width="40px">
            <Text as="span" size={size} color={color} weight={weight}>
                <Amount
                    value={amount}
                    customPrefix={withPlus && isOwed ? '+' : undefined}
                    tokenCode={currency}
                    precision={0}
                />
            </Text>
        </Skeleton>
    );
};

export default DebtAmount;
