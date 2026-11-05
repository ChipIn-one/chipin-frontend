// Wire types of money (spec 03 §4.1, §4.3). On the wire an amount is a JSON number of scale 4
// (D21); the lossless transport (`shared/api/wireJson.ts`, PR 03-4b) keeps its original literal
// and hands it over as an opaque `WireAmount`, so an amount never passes through a double.

declare const wireAmountBrand: unique symbol;

/**
 * An amount as it came from (or goes to) the wire. Opaque: arithmetic, comparison and `Number()`
 * do not compile; it is read only through `moneyFromWire`. At runtime it is a frozen plain object
 * `{ __wireDecimal: '85.5000' }`, which survives structured clone, JSON and the persist codec.
 */
export interface WireAmount {
    readonly [wireAmountBrand]: 'WireAmount';
}

/** A non-money decimal of the wire (percentages, share weights, rates): its decimal literal. */
export type WireDecimal = string & { readonly __brand: 'WireDecimal' };

/** The runtime shape of a `WireAmount`. */
interface WireAmountRecord {
    readonly __wireDecimal: string;
}

/** An amount that cannot be read from or written to the wire. Mapped per item by `mapItems`. */
export class MoneyWireError extends Error {
    override readonly name = 'MoneyWireError';

    /** Why the amount was rejected; a fixed code, never the amount itself. */
    readonly reason: 'format' | 'range' | 'shape';

    constructor(reason: 'format' | 'range' | 'shape') {
        super(`Money wire value rejected: ${reason}`);
        this.reason = reason;
    }
}

const isRecord = (value: unknown): value is WireAmountRecord =>
    typeof value === 'object' &&
    value !== null &&
    '__wireDecimal' in value &&
    typeof value.__wireDecimal === 'string';

/** Whether a value is a `WireAmount` (the transport's stringify hook and the persist codec use it). */
export const isWireAmount = (value: unknown): value is WireAmount => isRecord(value);

/**
 * Wraps a decimal literal into a `WireAmount`. For the wire transport (03-4b) and tests only;
 * the literal is validated when it is read by `moneyFromWire`.
 */
export const createWireAmount = (decimal: string): WireAmount => {
    const record: WireAmountRecord = Object.freeze({ __wireDecimal: decimal });

    if (!isWireAmount(record)) {
        throw new MoneyWireError('shape');
    }
    return record;
};

/** The decimal literal of a `WireAmount` (what the transport writes into an outgoing body). */
export const wireAmountText = (amount: WireAmount): string => {
    if (!isRecord(amount)) {
        throw new MoneyWireError('shape');
    }
    return amount.__wireDecimal;
};
