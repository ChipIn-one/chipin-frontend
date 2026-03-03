import Big from 'bignumber.js';

interface GetNumberDataArgs {
    value: Big;
    precision?: Precisions;
    isKMB?: boolean;
    isExternal?: boolean;
    isInteger?: boolean;
    isPrice?: boolean;
    isInteractive?: boolean;
    isZeros?: boolean;
}

interface GetNumberPrecisionData {
    value: Big;
    precision?: Precisions;
    isExternal?: boolean;
    isInteger?: boolean;
    isPrice?: boolean;
    isInteractive?: boolean;
}

export const tryToBig = (value?: Big | number | string | null) => {
    // Cause of undefined creates unusable new Big constructor
    if (!value && value !== 0) {
        return null;
    }

    try {
        return Big(value);
    } catch {
        return null;
    }
};

export const getIsTooSmallForPrecision = (value: Big, precision: number) => {
    const minPrecisionAmount = Big(1).div(10).pow(precision);
    const isValueTooSmall = value.lt(minPrecisionAmount) && value.gt(0);
    return { minPrecisionAmount, isValueTooSmall };
};

const getSplittedNumber = (formattedString: string) => {
    if (!formattedString.includes('.')) {
        return { numberPart: formattedString, zerosPart: '' };
    }

    let zerosPart = '';
    for (let i = formattedString.length - 1; formattedString[i] === '0'; i--) {
        zerosPart += formattedString[i];
    }

    return {
        numberPart: formattedString.slice(0, formattedString.length - zerosPart.length),
        zerosPart,
    };
};

const getNumberPrecisionData = ({
    value,
    precision,
    isExternal = false,
    isInteger = false,
    isPrice = false,
    isInteractive = false,
}: GetNumberPrecisionData) => {
    const MAX_THOUSANDS_PRECISION_NUMBER = 1000;
    const MAX_HUNDREDS_PRECISION_NUMBER = 100;
    const MAX_FLOATS_PRECISION_NUMBER = 0.01;

    let precisionToUse = precision;

    if (!precisionToUse && precisionToUse !== 0) {
        // values also can be negative
        const positiveValue = value.abs();
        const isZero = positiveValue.eq(0);

        switch (true) {
            case isInteger:
            case isZero && !isExternal:
            case positiveValue.gte(MAX_THOUSANDS_PRECISION_NUMBER): {
                precisionToUse = 0;
                break;
            }

            case isInteractive: {
                precisionToUse = 7;
                break;
            }

            case isExternal && !isPrice:
            case isExternal && isZero:
            case positiveValue.gte(MAX_HUNDREDS_PRECISION_NUMBER): {
                precisionToUse = 2;
                break;
            }

            case positiveValue.lt(MAX_HUNDREDS_PRECISION_NUMBER) &&
                positiveValue.gte(MAX_FLOATS_PRECISION_NUMBER): {
                precisionToUse = 4;
                break;
            }

            default: {
                precisionToUse = 7;
            }
        }
    }

    const { minPrecisionAmount, isValueTooSmall } = getIsTooSmallForPrecision(
        value,
        precisionToUse,
    );

    return { precisionToUse, minPrecisionAmount, isValueTooSmall };
};

const getKMB = (value: Big) => {
    let values;

    switch (true) {
        case value.gte(1e15):
            values = { kmbValue: value.div(1e15), postfix: 'Q' };
            break;
        case value.gte(1e12):
            values = { kmbValue: value.div(1e12), postfix: 'T' };
            break;
        case value.gte(1e9):
            values = { kmbValue: value.div(1e9), postfix: 'B' };
            break;
        case value.gte(1e6):
            values = { kmbValue: value.div(1e6), postfix: 'M' };
            break;
        case value.gte(1e3):
            values = { kmbValue: value.div(1e3), postfix: 'K' };
            break;
        default:
            values = {
                kmbValue: value,
                postfix: '',
            };
    }

    return {
        kmbValue: values.kmbValue.decimalPlaces(2, Big.ROUND_HALF_UP).toFixed(2),
        postfix: values.postfix,
    };
};

export const getNumberData = (
    {
        value,
        precision,
        isKMB = false,
        isExternal = false,
        isInteger = false,
        isPrice = false,
        isInteractive = false,
        isZeros = false,
    } = {} as GetNumberDataArgs,
) => {
    const { precisionToUse, minPrecisionAmount, isValueTooSmall } = getNumberPrecisionData({
        value,
        precision,
        isExternal,
        isInteger,
        isPrice,
        isInteractive,
    });
    const valueToFormat = isValueTooSmall ? minPrecisionAmount : value;

    const roundedValue = valueToFormat.decimalPlaces(precisionToUse, Big.ROUND_HALF_UP);

    const { kmbValue, postfix } =
        !isKMB || roundedValue.lt(1000)
            ? {
                  postfix: '',
                  kmbValue: isZeros
                      ? roundedValue.toFixed(precisionToUse)
                      : roundedValue.toString(),
              }
            : getKMB(roundedValue);

    const [left = '', right = ''] = kmbValue.split('.');

    // Split big numbers with, or leave it as is
    const leftPart = postfix ? left : left.replace(/(.)(?=(\d{3})+$)/g, '$1,');
    const rightPart = postfix ? right : right.slice(0, precisionToUse);

    const numberFormatted = leftPart && rightPart ? `${leftPart}.${rightPart}${postfix}` : leftPart;

    const { numberPart, zerosPart } = getSplittedNumber(numberFormatted);

    return {
        numberBig: isValueTooSmall ? minPrecisionAmount : roundedValue,
        numberString: roundedValue.toFixed(precisionToUse),
        numberFormatted,
        numberPart,
        zerosPart,
        minPrecisionAmount,
        isValueTooSmall,
    };
};
