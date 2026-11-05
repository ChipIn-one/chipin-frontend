import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';
import { parse, stringify } from 'yaml';

import { generate } from './gen-types.mjs';
import { checkGeneratedTypes, checkWireFields } from './wire-fields.mjs';

const scaled = { type: 'number', multipleOf: 0.0001 };
const map = values => ({ type: 'object', additionalProperties: values });

const spec = (extra = {}) => ({
    openapi: '3.1.1',
    info: { title: 't', version: '1' },
    paths: {},
    components: {
        schemas: {
            Expense: {
                type: 'object',
                required: ['amount'],
                properties: {
                    amount: scaled,
                    netAmount: scaled,
                    netBalance: scaled,
                    shareAmount: scaled,
                },
            },
            SharingMode: {
                oneOf: [
                    { type: 'object', properties: { customShares: map(scaled) } },
                    {
                        type: 'object',
                        properties: { percentageShares: map({ ...scaled, maximum: 100 }) },
                    },
                    { type: 'object', properties: { shares: map(scaled) } },
                ],
            },
            Rates: { type: 'object', properties: { rates: map({ type: 'number' }) } },
            ...extra,
        },
    },
});

const directory = mkdtempSync(join(tmpdir(), 'wire-fields-'));
const write = (name, document) => {
    const path = join(directory, name);

    writeFileSync(path, stringify(document));
    return path;
};

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('checkWireFields', () => {
    test('a fully classified spec passes', () => {
        expect(checkWireFields(spec())).toEqual([]);
    });

    test('(a) an unclassified multipleOf: 0.0001 field is an error', () => {
        const errors = checkWireFields(
            spec({ Fee: { type: 'object', properties: { fee: scaled } } }),
        );

        expect(errors).toEqual([
            expect.stringMatching(/^\(a\) #\/components\/schemas\/Fee\/properties\/fee:/),
        ]);
    });

    test('(b) a money field without multipleOf is an error, in any schema', () => {
        const errors = checkWireFields(
            spec({ Legacy: { type: 'object', properties: { amount: { type: 'number' } } } }),
        );

        expect(errors).toEqual([
            expect.stringMatching(/^\(b\) #\/components\/schemas\/Legacy\/properties\/amount:/),
        ]);
    });

    test('a non-map `shares` (an array) is not a decimal map and not an error', () => {
        const array = { type: 'array', items: { type: 'object' } };

        expect(
            checkWireFields(spec({ Activity: { type: 'object', properties: { shares: array } } })),
        ).toEqual([]);
    });

    test('a registry entry that matches no property is an error', () => {
        const document = spec();

        delete document.components.schemas.Rates;
        expect(checkWireFields(document)).toEqual([
            expect.stringMatching(/^rates .*matches no property/),
        ]);
    });

    test('(c) percentageShares must be Record<string, WireDecimal>', () => {
        expect(checkGeneratedTypes('percentageShares: Record<string, WireDecimal>;')).toEqual([]);
        expect(checkGeneratedTypes('percentageShares: Record<string, WireAmount>;')).toHaveLength(
            1,
        );
        expect(checkGeneratedTypes('')).toHaveLength(1);
    });
});

describe('gen-types', () => {
    test('the generator exits 1 on an unclassified multipleOf: 0.0001 field and writes nothing', () => {
        const specPath = write(
            'bad.yaml',
            spec({ Fee: { type: 'object', properties: { fee: scaled } } }),
        );
        const out = join(directory, 'bad-out');
        const result = spawnSync(
            process.execPath,
            ['scripts/api/gen-types.mjs', '--spec', specPath, '--out', out],
            {
                encoding: 'utf8',
            },
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('/Fee/properties/fee');
        expect(existsSync(out)).toBe(false);
    });

    test('maps the registry onto the generated types', async () => {
        const { schema } = await generate(write('ok.yaml', spec()));

        expect(schema).toContain('amount: WireAmount;');
        expect(schema).toContain('netAmount?: WireAmount;');
        expect(schema).toContain('customShares?: Record<string, WireAmount>;');
        expect(schema).toContain('percentageShares?: Record<string, WireDecimal>;');
        expect(schema).toContain('shares?: Record<string, WireDecimal>;');
        expect(schema).toContain('rates?: Record<string, WireDecimal>;');
        expect(schema).not.toMatch(/\bnumber\b/);
    });

    test('the committed snapshot passes and percentageShares is Record<string, WireDecimal>', () => {
        expect(checkWireFields(parse(readFileSync('openapi/chipin.yaml', 'utf8')))).toEqual([]);
        expect(readFileSync('src/shared/api/generated/schema.d.ts', 'utf8')).toMatch(
            /percentageShares: Record<string, WireDecimal>;/,
        );
    });
});
