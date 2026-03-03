import { FC } from 'react';
import Big from 'bignumber.js';

import { tryToBig } from 'helpers/numbers';

import { BaseProps } from './duck/types';

interface Props {
    value?: Big | number | string | null;
    isWithoutDash?: boolean;
    currencyName?: string;
}

export function constructNumberComponent<P extends BaseProps>(
    Comp: FC<P>,
): FC<Props & Omit<P, 'symbol' | 'value'>> {
    return ({ value, isWithoutDash = false, className, ...rest }) => {
        const bigValue = tryToBig(value);
        if (isWithoutDash && !bigValue) {
            return null;
        }

        if (!bigValue) {
            return <span className={className}>—</span>;
        }

        return (
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            <Comp value={bigValue} className={className} {...rest} />
        );
    };
}
