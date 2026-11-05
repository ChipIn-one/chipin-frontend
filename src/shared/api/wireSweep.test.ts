// The lossless wire sweep (spec 03 §8, C1-03), ported from the audit evidence
// `evidence/money/lossless-wire-sweep.mjs` (reference: 400,000 cases / 0 wrong / 0 rejections).
// Deterministic: seeded mulberry32, magnitudes 10^0..10^19 ledger units, both signs.
import { describe, expect, test, vi } from 'vitest';

import { currencyCode, isWireAmount, moneyFromWire } from 'shared/money';

import { parseWireJson, stringifyWireJson } from './wireJson';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

const SEED = 20261028;
const CASES = 400_000;
const USD = currencyCode('USD');

const mulberry32 = (seed: number) => {
    let a = seed;

    return (): number => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const toDecimal = (units: bigint): string => {
    const negative = units < 0n;
    const digits = (negative ? -units : units).toString().padStart(5, '0');

    return `${negative ? '-' : ''}${digits.slice(0, -4)}.${digits.slice(-4)}`;
};

interface Parsed {
    amount: unknown;
    sharingMode: { customShares: { u1: unknown }; percentageShares: { u1: unknown } };
    rate: unknown;
}

const read = (value: unknown): bigint | undefined =>
    isWireAmount(value) ? moneyFromWire(value, USD).minor : undefined;

describe('lossless wire sweep (spec 03 §8)', () => {
    test(`${CASES} seeded amounts: 0 wrong, 0 rejections`, () => {
        const rnd = mulberry32(SEED);
        const randBigInt = (max: bigint): bigint => {
            let r = 0n;

            for (let i = 0; i < 4; i += 1) {
                r = (r << 32n) | BigInt(Math.floor(rnd() * 2 ** 32));
            }
            return r % max;
        };
        let wrong = 0;
        let rejected = 0;
        const firstFailures: string[] = [];

        for (let i = 0; i < CASES; i += 1) {
            const order = BigInt(Math.floor(rnd() * 19));
            const magnitude = randBigInt(10n ** (order + 1n));
            const units = rnd() < 0.5 ? -magnitude : magnitude;
            const text = toDecimal(units);
            const json = `{"amount":${text},"sharingMode":{"type":"EXACT","customShares":{"u1":${text}},"percentageShares":{"u1":33.3333}},"rate":1}`;

            try {
                const body = parseWireJson(json) as Parsed;
                const ok =
                    read(body.amount) === units &&
                    read(body.sharingMode.customShares.u1) === units &&
                    body.sharingMode.percentageShares.u1 === '33.3333' &&
                    body.rate === 1 &&
                    String(stringifyWireJson(body)).startsWith(`{"amount":${text},`);

                if (!ok) {
                    wrong += 1;
                    firstFailures.push(text);
                }
            } catch {
                rejected += 1;
                firstFailures.push(text);
            }
        }

        expect({ wrong, rejected, firstFailures: firstFailures.slice(0, 5) }).toEqual({
            wrong: 0,
            rejected: 0,
            firstFailures: [],
        });
    }, 120_000);
});
