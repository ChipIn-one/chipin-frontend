import { FC } from 'react';

import { tryToNumber } from 'helpers/numbers';

import { BaseProps } from './duck/types';

interface Props {
    value?: NumericValue;
    isWithoutDash?: boolean;
    currencyName?: string;
}

export function constructNumberComponent<P extends BaseProps>(
    Comp: FC<P>,
): FC<Props & Omit<P, 'symbol' | 'value'>> {
    return ({ value, isWithoutDash = false, className, ...rest }) => {
        const numberValue = tryToNumber(value);
        if (isWithoutDash && numberValue === null) {
            return null;
        }

        if (numberValue === null) {
            // eslint-disable-next-line
            return <span className={className}>—</span>;
        }

        const componentProps = { value: numberValue, className, ...rest } as P;

        return <Comp {...componentProps} />;
    };
}
