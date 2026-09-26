import { getNumberData } from 'helpers/numbers';

import { AmountTypes, GetAmountDataParams, GetAmountDataReturn } from './types';

export const getAmountTypesBool = (type: AmountTypes) => ({
    isDefault: type === 'default',
    isInteger: type === 'integer',
    isInteractive: type === 'interactive',
    isSummary: type === 'summary',
    isFull: type === 'full',
});

// For equivalent or summary use, symbol params is required
export const getAmountData = ({
    value = 0,
    type = 'default',
    isAbsolute = true,
    tokenCode,
    symbol,
    precision,
    customPrefixTooSmall,
}: GetAmountDataParams): GetAmountDataReturn => {
    const { isDefault, isInteger, isSummary, isInteractive, isFull } = getAmountTypesBool(type);
    const displayValue = isAbsolute ? Math.abs(value) : value;

    const {
        numberFormatted,
        numberString,
        numberPart,
        zerosPart,
        minPrecisionAmount,
        isValueTooSmall,
    } = getNumberData({
        value: displayValue,
        precision,
        isKMB: isSummary || isFull,
        isExternal: isSummary,
        isInteger,
        isInteractive,
    });

    const isSymbolHidden = tokenCode || isDefault || isInteger || isInteractive || isFull;
    const prefixLess = isValueTooSmall ? '< ' : customPrefixTooSmall || '';
    const prefixSymbol = isSymbolHidden ? '' : symbol;
    const prefix = isSymbolHidden ? `${prefixLess}` : `${prefixLess}${symbol}`;
    const amountFormatted =
        isValueTooSmall && !isInteger
            ? `${prefixLess}${prefixSymbol}${minPrecisionAmount}`
            : `${prefixSymbol}${numberFormatted}`;

    return {
        amountFormatted,
        amountPart: numberPart,
        amountString: numberString,
        bigAmount: value,
        postfix: tokenCode,
        prefix,
        prefixLess,
        prefixSymbol,
        zerosPart,
    };
};
