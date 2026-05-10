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

// Matches an empty string, integers, and decimals with up to 2 fractional digits.
// Accepts both '.' and ',' as the decimal separator.
const AMOUNT_INPUT_REGEX = /^\d*[.,]?\d{0,2}$/;

/**
 * Normalises a raw amount input string:
 * - Replaces ',' with '.' as the decimal separator.
 * - Rejects strings that exceed 2 decimal places or are otherwise invalid.
 * Returns the normalised string on success, or null when the input should be rejected.
 */
export const parseAmountInput = (raw: string): string | null => {
    const normalised = raw.replace(',', '.');

    if (!AMOUNT_INPUT_REGEX.test(normalised)) {
        return null;
    }

    return normalised;
};

const isTrulyObject = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const convertLeaf = (value: unknown): Big | null => tryToBig(value as Big | number | string | null);

const applyAtPath = (node: unknown, path: readonly string[]): unknown => {
    const [segment, ...remainingPath] = path;

    if (!segment) {
        return node;
    }

    // Arrays: descend into each element keeping the full path (segment not consumed)
    if (Array.isArray(node)) {
        return node.map(item => applyAtPath(item, path));
    }

    if (!isTrulyObject(node)) {
        return node;
    }

    const isLeaf = remainingPath.length === 0;

    if (segment === '*') {
        const updated = Object.fromEntries(
            Object.entries(node).map(([key, value]) => [
                key,
                isLeaf ? convertLeaf(value) : applyAtPath(value, remainingPath),
            ]),
        );
        return { ...node, ...updated };
    }

    if (!(segment in node)) {
        return node;
    }

    const next = isLeaf ? convertLeaf(node[segment]) : applyAtPath(node[segment], remainingPath);

    return { ...node, [segment]: next };
};

/**
 * Converts the specified field paths in an API response object to Big | null.
 * Paths use dot notation; '*' matches every key of an object or every element of an array.
 *
 * @example
 * parseBigFields<ApiDashboard, ParsedDashboard>(raw, [
 *   'balances.*.netBalance',
 *   'balances.*.totalOwed',
 *   'items.*.amount',
 * ])
 */
export const parseBigFields = <TRaw, TParsed = TRaw>(
    data: TRaw,
    paths: readonly string[],
): TParsed => {
    let result: unknown = data;

    for (const path of paths) {
        result = applyAtPath(result, path.split('.'));
    }

    return result as TParsed;
};
