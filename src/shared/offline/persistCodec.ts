// The string codec of the persisted query cache (spec 03 §1.4, C1-05). JSON, plus a tag for
// `bigint` (`Money.minor`), which `JSON.stringify` cannot write. Domain fields are camelCase
// without `$`, so the `$bigint` tag never collides with data.
import { createWireAmount } from 'shared/money';

interface BigintTag {
    $bigint: string;
}

const BIGINT_TEXT = /^-?\d+$/;

const isBigintTag = (value: unknown): value is BigintTag =>
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length === 1 &&
    '$bigint' in value &&
    typeof value.$bigint === 'string' &&
    BIGINT_TEXT.test(value.$bigint);

// The runtime shape of a `WireAmount` (`shared/money/wire.ts`): exactly `{ __wireDecimal }`.
const isWireAmountShape = (value: unknown): value is { __wireDecimal: string } =>
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length === 1 &&
    '__wireDecimal' in value &&
    typeof value.__wireDecimal === 'string';

const replacer = (_key: string, value: unknown): unknown =>
    typeof value === 'bigint' ? { $bigint: value.toString() } : value;

const reviver = (_key: string, value: unknown): unknown => {
    if (isBigintTag(value)) {
        return BigInt(value.$bigint);
    }
    // Only domain models are cached today (mappers return `Money`), but a `WireAmount` that
    // reaches the cache comes back as the frozen value of the money module, not a bare record.
    if (isWireAmountShape(value)) {
        return createWireAmount(value.__wireDecimal);
    }
    return value;
};

export const persistCodec = {
    stringify: (value: unknown): string => JSON.stringify(value, replacer),
    /** Throws on malformed text: the persister then drops the key (`persistQueryClientRestore`). */
    parse: (text: string): unknown => JSON.parse(text, reviver),
};
