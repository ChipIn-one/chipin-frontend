// The lossless wire transport (spec 03 §4.1, D21): JSON bodies are parsed from text and written
// without a double. Only `api()` (client.ts) uses it, per request; the legacy `src/api/*` layer
// keeps `JSON.parse`. The transport does not interpret amounts and never converts to `Money`:
// a money field becomes an opaque `WireAmount` that only the entities/*/model mappers read.
import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';

import {
    DECIMAL_MAP_FIELDS,
    MONEY_FIELDS,
    MONEY_MAP_FIELDS,
} from 'shared/api/generated/wireFields';
import { createWireAmount, isWireAmount, MoneyWireError, wireAmountText } from 'shared/money';

const MONEY = new Set<string>(MONEY_FIELDS);
const MONEY_MAP = new Set<string>(MONEY_MAP_FIELDS);
const DECIMAL_MAP = new Set<string>(DECIMAL_MAP_FIELDS);

// The backend accepts only a plain JSON decimal literal (no exponent, no leading zeros).
const PLAIN_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const JSON_CONTENT_TYPE = /^application\/(?:[\w.-]+\+)?json\s*(?:;|$)/i;

// Only a real `WireAmount` (frozen by `createWireAmount`) counts as one: a forged wire object
// `{"__wireDecimal":"1","n":2.5}` is an ordinary object whose numbers are revived as usual.
const isRealWireAmount = (value: unknown): boolean => isWireAmount(value) && Object.isFrozen(value);

type Container = Record<string, unknown> | unknown[];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isLosslessNumber(value) &&
    !isRealWireAmount(value);

/**
 * The value of one number literal, decided by its own key and its parent's key (the registry is
 * name-only, so the parent's shape decides as well):
 * - a value of a MONEY_MAP object (`customShares`) → `WireAmount`;
 * - a value of a DECIMAL_MAP object (`shares` in `SharingMode`, `percentageShares`, `rates`) →
 *   its decimal literal (`WireDecimal`); an ARRAY under such a key (`shares` of
 *   `ExpenseActivityMetadata`) is not a map, its elements are ordinary values;
 * - a MONEY property (`amount`, ... in any object, error bodies included) → `WireAmount`;
 * - anything else → `number` (as `JSON.parse` would give).
 */
const reviveNumber = (
    parentKey: string,
    parent: Container,
    key: string,
    value: LosslessNumber,
): unknown => {
    if (!Array.isArray(parent)) {
        if (MONEY_MAP.has(parentKey)) {
            return createWireAmount(value.value);
        }
        if (DECIMAL_MAP.has(parentKey)) {
            return value.value;
        }
        if (MONEY.has(key)) {
            return createWireAmount(value.value);
        }
    }
    return Number(value.value);
};

// lossless-json calls the reviver bottom-up. A number is left as a `LosslessNumber` until its
// parent object/array is revived, because only the parent's key says whether it is a map value.
// A registry field holding a non-number (a string, an object, null) is passed through unchanged:
// the transport never throws on a shape; a mapper's `moneyFromWire` then rejects anything that is
// not a `WireAmount` with `MoneyWireError('shape')` (localized to the item by `mapItems`).
const reviver = (key: string, value: unknown): unknown => {
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            if (isLosslessNumber(item)) {
                value[index] = reviveNumber(key, value, String(index), item);
            }
        });
    } else if (isPlainObject(value)) {
        for (const [childKey, child] of Object.entries(value)) {
            if (isLosslessNumber(child)) {
                value[childKey] = reviveNumber(key, value, childKey, child);
            }
        }
    } else if (key === '' && isLosslessNumber(value)) {
        // A bare number as the whole body.
        return Number(value.value);
    }
    return value;
};

// Axios passes `AxiosHeaders` (with `get`); a plain object is accepted too.
const hasGet = (headers: object): headers is { get: (name: string) => unknown } =>
    'get' in headers && typeof headers.get === 'function';

const contentTypeOf = (headers: unknown): string => {
    if (typeof headers !== 'object' || headers === null) {
        return '';
    }
    if (hasGet(headers)) {
        const value = headers.get('content-type');

        return typeof value === 'string' ? value : '';
    }
    const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type');

    return typeof entry?.[1] === 'string' ? entry[1] : '';
};

/**
 * Axios `transformResponse` (success and error bodies). Without `headers` the text is taken as
 * JSON (tests, the sweep). With headers, only an `application/json` text body is parsed; a 204,
 * an empty body, a non-JSON response (an HTML 502) and malformed JSON are returned as they are,
 * like the Axios default, so the status of an error is never lost to a parse error.
 */
export function parseWireJson(data: unknown, headers?: unknown): unknown {
    if (typeof data !== 'string' || data.trim() === '') {
        return data;
    }
    if (headers !== undefined && !JSON_CONTENT_TYPE.test(contentTypeOf(headers))) {
        return data;
    }
    try {
        // A duplicate key keeps the last value, like `JSON.parse`.
        return parse(data, reviver, { onDuplicateKey: ({ newValue }) => newValue });
    } catch {
        return data;
    }
}

const wireNumberStringifier = {
    test: isRealWireAmount,
    stringify: (value: unknown): string => {
        const text = isWireAmount(value) ? wireAmountText(value) : '';

        // A hand-built `WireAmount` with a malformed literal (`'007.5'`, `'1e3'`) is never sent.
        if (!PLAIN_DECIMAL.test(text)) {
            throw new MoneyWireError('format');
        }
        return text;
    },
};

// Outgoing decimal maps (`percentageShares`, `shares`, `rates`) hold `WireDecimal` strings; the
// backend expects JSON numbers there, so each string is written as a number literal, and a
// string that is not a plain decimal is rejected (`MoneyWireError('format')`), never sent.
const decimalLiteral = (text: string): LosslessNumber => {
    if (!PLAIN_DECIMAL.test(text)) {
        throw new MoneyWireError('format');
    }
    return new LosslessNumber(text);
};

const replacer = (key: string, value: unknown): unknown => {
    if (!DECIMAL_MAP.has(key) || !isPlainObject(value)) {
        return value;
    }
    return Object.fromEntries(
        Object.entries(value).map(([mapKey, item]) => [
            mapKey,
            typeof item === 'string' ? decimalLiteral(item) : item,
        ]),
    );
};

const hasSetContentType = (
    headers: unknown,
): headers is { setContentType: (value: string, rewrite: boolean) => void } =>
    typeof headers === 'object' &&
    headers !== null &&
    'setContentType' in headers &&
    typeof headers.setContentType === 'function';

/**
 * Writes a JSON body: a `WireAmount` is written as its decimal literal (no exponent, no double).
 * Also the Axios `transformRequest`: `undefined` and an already written string (`api()` writes the
 * body before Axios; an interceptor retry resends it) pass through; never used for multipart.
 */
export function stringifyWireJson(data: unknown, headers?: unknown): unknown {
    if (data === undefined) {
        return data;
    }
    if (hasSetContentType(headers)) {
        headers.setContentType('application/json', false);
    }
    if (typeof data === 'string') {
        return data;
    }
    return stringify(data, replacer, undefined, [wireNumberStringifier]);
}
