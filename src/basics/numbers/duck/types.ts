import Big from 'bignumber.js';

export interface BaseProps {
    value: Big;
    symbol: string;
    precision?: Precisions;
    className?: string;
}
