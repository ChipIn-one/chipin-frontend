interface GetNumberDataArgs {
    value?: number;
    precision?: Precisions;
    isKMB?: boolean;
    isExternal?: boolean;
    isInteger?: boolean;
    isPrice?: boolean;
    isInteractive?: boolean;
    isZeros?: boolean;
}

interface GetNumberPrecisionData {
    value: number;
    precision?: Precisions;
    isExternal?: boolean;
    isInteger?: boolean;
    isPrice?: boolean;
    isInteractive?: boolean;
}

interface NumberData {
    numberValue: number;
    numberString: string;
    numberFormatted: string;
    numberPart: string;
    zerosPart: string;
    minPrecisionAmount: number;
    isValueTooSmall: boolean;
}

export const tryToNumber = (value?: NumericValue): number | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    const numberValue = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
};

export const getIsTooSmallForPrecision = (
    value: number,
    precision: number,
): Pick<NumberData, 'minPrecisionAmount' | 'isValueTooSmall'> => {
    const minPrecisionAmount = 1 / 10 ** precision;
    const isValueTooSmall = value < minPrecisionAmount && value > 0;
    return { minPrecisionAmount, isValueTooSmall };
};

const getExpandedDecimalParts = (value: number) => {
    const [coefficient, exponentPart] = value.toString().split('e');
    const [integerPart = '0', fractionalPart = ''] = coefficient.split('.');
    const digits = integerPart + fractionalPart;
    const decimalPosition = integerPart.length + Number(exponentPart ?? 0);

    if (decimalPosition <= 0) {
        return { integerPart: '0', fractionalPart: '0'.repeat(-decimalPosition) + digits };
    }

    if (decimalPosition >= digits.length) {
        return {
            integerPart: digits + '0'.repeat(decimalPosition - digits.length),
            fractionalPart: '',
        };
    }

    return {
        integerPart: digits.slice(0, decimalPosition),
        fractionalPart: digits.slice(decimalPosition),
    };
};

const incrementDigits = (digits: string) => {
    const incrementedDigits = digits.split('');

    for (let index = incrementedDigits.length - 1; index >= 0; index--) {
        if (incrementedDigits[index] === '9') {
            incrementedDigits[index] = '0';
            continue;
        }

        incrementedDigits[index] = String(Number(incrementedDigits[index]) + 1);
        return incrementedDigits.join('');
    }

    return `1${incrementedDigits.join('')}`;
};

const roundHalfUp = (value: number, precision: number): number => {
    const sign = value < 0 ? -1 : 1;
    const { integerPart, fractionalPart } = getExpandedDecimalParts(Math.abs(value));
    const roundedFractionalPart = fractionalPart.slice(0, precision).padEnd(precision, '0');
    const firstDiscardedDigit = fractionalPart[precision];
    const shouldRoundUp = firstDiscardedDigit !== undefined && firstDiscardedDigit >= '5';
    const roundedDigits = shouldRoundUp
        ? incrementDigits(integerPart + roundedFractionalPart)
        : integerPart + roundedFractionalPart;

    if (precision === 0) {
        return sign * Number(roundedDigits);
    }

    const integerDigitsLength = roundedDigits.length - precision;
    const roundedValue = Number(
        `${roundedDigits.slice(0, integerDigitsLength)}.${roundedDigits.slice(integerDigitsLength)}`,
    );

    return sign * roundedValue;
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

    if (precisionToUse === undefined) {
        // values also can be negative
        const positiveValue = Math.abs(value);
        const isZero = positiveValue === 0;

        switch (true) {
            case isInteger:
            case isZero && !isExternal:
            case positiveValue >= MAX_THOUSANDS_PRECISION_NUMBER: {
                precisionToUse = 0;
                break;
            }

            case isInteractive: {
                precisionToUse = 7;
                break;
            }

            case isExternal && !isPrice:
            case isExternal && isZero:
            case positiveValue >= MAX_HUNDREDS_PRECISION_NUMBER: {
                precisionToUse = 2;
                break;
            }

            case positiveValue < MAX_HUNDREDS_PRECISION_NUMBER &&
                positiveValue >= MAX_FLOATS_PRECISION_NUMBER: {
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

const getKMB = (value: number) => {
    let kmbValue: number;
    let postfix: string;

    switch (true) {
        case value >= 1e15:
            kmbValue = value / 1e15;
            postfix = 'Q';
            break;
        case value >= 1e12:
            kmbValue = value / 1e12;
            postfix = 'T';
            break;
        case value >= 1e9:
            kmbValue = value / 1e9;
            postfix = 'B';
            break;
        case value >= 1e6:
            kmbValue = value / 1e6;
            postfix = 'M';
            break;
        case value >= 1e3:
            kmbValue = value / 1e3;
            postfix = 'K';
            break;
        default:
            kmbValue = value;
            postfix = '';
    }

    return {
        kmbValue: roundHalfUp(kmbValue, 2).toFixed(2),
        postfix,
    };
};

export const getNumberData = (
    {
        value = 0,
        precision,
        isKMB = false,
        isExternal = false,
        isInteger = false,
        isPrice = false,
        isInteractive = false,
        isZeros = false,
    }: GetNumberDataArgs = {},
): NumberData => {
    const { precisionToUse, minPrecisionAmount, isValueTooSmall } = getNumberPrecisionData({
        value,
        precision,
        isExternal,
        isInteger,
        isPrice,
        isInteractive,
    });
    const valueToFormat = isValueTooSmall ? minPrecisionAmount : value;

    const roundedValue = roundHalfUp(valueToFormat, precisionToUse);

    const { kmbValue, postfix } =
        !isKMB || roundedValue < 1000
            ? {
                  postfix: '',
                  kmbValue: isZeros
                      ? roundedValue.toFixed(precisionToUse)
                      : roundedValue.toString(),
              }
            : getKMB(roundedValue);

    const [left = '', right = ''] = kmbValue.split('.');

    // Split big numbers with, or leave it as is
    const leftPart = postfix ? left : left.replace(/(\d)(?=(\d{3})+$)/g, '$1,');
    const rightPart = postfix ? right : right.slice(0, precisionToUse);

    const numberFormatted = leftPart && rightPart ? `${leftPart}.${rightPart}${postfix}` : leftPart;

    const { numberPart, zerosPart } = getSplittedNumber(numberFormatted);

    return {
        numberValue: isValueTooSmall ? minPrecisionAmount : roundedValue,
        numberString: roundedValue.toFixed(precisionToUse),
        numberFormatted,
        numberPart,
        zerosPart,
        minPrecisionAmount,
        isValueTooSmall,
    };
};

/**
 * Normalises a raw amount input string:
 * - Replaces ',' with '.' as the decimal separator.
 * - Rejects strings that exceed the configured precision or are otherwise invalid.
 * Returns the normalised string on success, or null when the input should be rejected.
 */
export const parseAmountInput = (
    raw: string,
    maxFractionDigits: number | null = 2,
): string | null => {
    const normalised = raw.replace(',', '.');
    const [integerPart = '', fractionalPart] = normalised.split('.');
    const hasValidShape = /^\d*$/.test(integerPart) &&
        (fractionalPart === undefined || /^\d*$/.test(fractionalPart)) &&
        normalised.split('.').length <= 2;
    const hasValidPrecision =
        maxFractionDigits === null ||
        fractionalPart === undefined ||
        fractionalPart.length <= maxFractionDigits;

    if (!hasValidShape || !hasValidPrecision) {
        return null;
    }

    return normalised;
};
