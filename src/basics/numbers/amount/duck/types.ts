import { ReactNode } from 'react';

export type AmountTypes = 'default' | 'integer' | 'interactive' | 'summary' | 'full';

export interface ClickFuncParams {
    amountString: string;
    bigAmount: number;
}

export interface GetAmountDataParams {
    value?: number;
    type: AmountTypes;
    isAbsolute?: boolean;
    precision?: Precisions;
    tokenCode?: string | ReactNode; // ReactNode use only <span> with styles
    symbol?: string;
    customPrefixTooSmall?: string;
}

export interface GetAmountDataReturn {
    prefix: string;
    prefixLess: string;
    prefixSymbol: string | undefined;
    postfix: string | ReactNode;
    amountString: string;
    amountFormatted: string;
    amountPart: string;
    zerosPart: string;
    bigAmount: number;
}
