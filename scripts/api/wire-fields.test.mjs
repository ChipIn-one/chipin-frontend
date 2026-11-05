import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';
import { parse, stringify } from 'yaml';

import { generate } from './gen-types.mjs';
import { checkGeneratedTypes, checkWireFields, REGISTRY } from './wire-fields.mjs';

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

        expect(errors).toContainEqual(
            expect.stringMatching(/^\(a\) #\/components\/schemas\/Fee\/properties\/fee:/),
        );
    });

    test('(a) any unclassified non-integer number, map or array of numbers is an error', () => {
        const fields = {
            fee: { type: 'number' },
            fees: map({ type: 'number' }),
            weights: { type: 'array', items: { type: 'number' } },
            count: { type: 'integer' },
        };
        const errors = checkWireFields(spec({ Fee: { type: 'object', properties: fields } }));

        expect(errors).toEqual(
            ['fee', 'fees/additionalProperties', 'weights/items'].map(path =>
                expect.stringContaining(`(a) #/components/schemas/Fee/properties/${path}:`),
            ),
        );
    });

    test.each([
        ['oneOf [number, null]', { oneOf: [{ type: 'number' }, { type: 'null' }] }, 'oneOf/0'],
        ['anyOf', { anyOf: [{ type: 'number' }, { type: 'string' }] }, 'anyOf/0'],
        ['allOf', { allOf: [{ type: 'number' }] }, 'allOf/0'],
        [
            'a map of number arrays',
            map({ type: 'array', items: { type: 'number' } }),
            'additionalProperties/items',
        ],
        [
            'an array of number arrays',
            { type: 'array', items: { type: 'array', items: { type: 'number' } } },
            'items/items',
        ],
    ])('(a) a number nested in %s fails', (_, fee, at) => {
        const errors = checkWireFields(spec({ Fee: { type: 'object', properties: { fee } } }));

        expect(errors).toEqual([
            expect.stringContaining(`(a) #/components/schemas/Fee/properties/fee/${at}:`),
        ]);
    });

    test('(a) a $ref to a numeric component fails at the component', () => {
        const errors = checkWireFields(
            spec({
                Decimal: { type: 'number' },
                Fee: {
                    type: 'object',
                    properties: { fee: { $ref: '#/components/schemas/Decimal' } },
                },
            }),
        );

        expect(errors).toEqual([expect.stringContaining('(a) #/components/schemas/Decimal:')]);
    });

    test('(a) a field on the non-money allowlist stays a number', () => {
        const registry = { ...REGISTRY, nonMoney: ['fee'] };
        const document = spec({ Fee: { type: 'object', properties: { fee: { type: 'number' } } } });

        expect(checkWireFields(document, registry)).toEqual([]);
    });

    test('a number union with string fails, for money and for maps', () => {
        const mixed = { type: ['number', 'string'], multipleOf: 0.0001 };
        const errors = checkWireFields(
            spec({ Mixed: { type: 'object', properties: { amount: mixed, rates: map(mixed) } } }),
        );

        expect(errors).toContainEqual(expect.stringMatching(/^\(b\) .*Mixed\/properties\/amount:/));
        expect(errors).toContainEqual(
            expect.stringMatching(/^\(a\) .*Mixed\/properties\/rates\/additionalProperties:/),
        );
    });

    test.each([
        ['$ref', { $ref: '#/components/schemas/Money' }],
        ['oneOf', { oneOf: [scaled] }],
        ['allOf', { allOf: [scaled] }],
        ['an array', { type: 'array', items: scaled }],
    ])('a money field written as %s fails', (_, amount) => {
        const errors = checkWireFields(
            spec({
                Money: scaled,
                Wrapped: { type: 'object', properties: { amount } },
            }),
        );

        expect(errors).toContainEqual(
            expect.stringMatching(/^\(b\) #\/components\/schemas\/Wrapped\/properties\/amount:/),
        );
    });

    test('a money map with unscaled values fails', () => {
        const errors = checkWireFields(
            spec({
                Exact: { type: 'object', properties: { customShares: map({ type: 'number' }) } },
            }),
        );

        expect(errors).toEqual([
            expect.stringMatching(
                /^\(b\) #\/components\/schemas\/Exact\/properties\/customShares:/,
            ),
        ]);
    });

    test('a field in two lists fails', () => {
        const registry = { ...REGISTRY, decimalMap: [...REGISTRY.decimalMap, 'customShares'] };

        expect(checkWireFields(spec(), registry)).toContainEqual(
            'customShares is in more than one list of scripts/api/wire-fields.mjs',
        );
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

    test('(c) a registered field generated as number fails', () => {
        const ok = 'percentageShares: Record<string, WireDecimal>;\n';

        expect(checkGeneratedTypes(`${ok}amount?: number;`)).toEqual([
            expect.stringContaining('(c) amount is generated as "number"'),
        ]);
        expect(checkGeneratedTypes(`${ok}customShares: Record<string, number>;`)).toHaveLength(1);
        expect(checkGeneratedTypes(`${ok}rates: {\n    [key: string]: number;\n};`)).toHaveLength(
            1,
        );
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

    test('a nullable money field or map value generates | null', async () => {
        const nullable = { type: ['number', 'null'], multipleOf: 0.0001 };
        const { schema } = await generate(
            write(
                'nullable.yaml',
                spec({
                    Nullable: {
                        type: 'object',
                        properties: { amount: nullable, customShares: map(nullable) },
                    },
                }),
            ),
        );

        expect(schema).toContain('amount?: WireAmount | null;');
        expect(schema).toContain('customShares?: Record<string, WireAmount | null>;');
    });

    test('the committed snapshot passes and percentageShares is Record<string, WireDecimal>', () => {
        expect(checkWireFields(parse(readFileSync('openapi/chipin.yaml', 'utf8')))).toEqual([]);
        expect(readFileSync('src/shared/api/generated/schema.d.ts', 'utf8')).toMatch(
            /percentageShares: Record<string, WireDecimal>;/,
        );
    });
});
