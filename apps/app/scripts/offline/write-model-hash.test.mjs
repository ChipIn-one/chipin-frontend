import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { modelShapeHash, modelShapeInputs, modelTypeFiles } from './write-model-hash.mjs';

const tsconfig = JSON.stringify({
    compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'bundler',
        target: 'ES2020',
        lib: ['ES2020'],
        types: [],
        strict: true,
        noEmit: true,
        paths: { 'shared/*': ['./src/shared/*'], 'entities/*': ['./src/entities/*'] },
    },
});
const groupPath = 'src/entities/group/model/types.ts';
const userPath = 'src/entities/user/model/types.ts';
const group = 'export interface Group {\n    id: string;\n    name: string;\n}\n';
const withCurrency =
    'export interface Group {\n    id: string;\n    name: string;\n    currency: string;\n}\n';
const currency = "export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };\n";
const money =
    "import type { CurrencyCode } from './currency';\n\n" +
    'export interface Money {\n    minor: bigint;\n    currency: CurrencyCode;\n}\n\n' +
    'export const isZero = (value: Money): boolean => value.minor === 0n;\n';
const moneyIndex = "export type { Money } from './money';\nexport { isZero } from './money';\n";
const balance =
    "import type { Money } from 'shared/money';\n\nexport interface Balance {\n    total: Money;\n}\n";

let root;
const file = (relative, text = '') => {
    mkdirSync(dirname(join(root, relative)), { recursive: true });
    writeFileSync(join(root, relative), text);
};
const hash = (files = [groupPath, userPath]) => modelShapeHash({ root, files });

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'model-hash-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('MODEL_SHAPE_HASH', () => {
    beforeEach(() => {
        file('tsconfig.app.json', tsconfig);
        file('src/shared/money/currency.ts', currency);
        file('src/shared/money/money.ts', money);
        file('src/shared/money/index.ts', moneyIndex);
        file('src/entities/user/model/types.ts', balance);
        file('src/entities/user/index.ts', "export type { Balance } from './model/types';\n");
        file(
            groupPath,
            "import type { Balance } from 'entities/user';\n\n" +
                'export interface Group {\n    id: string;\n    name: string;\n    balance: Balance;\n}\n',
        );
    });

    test('is 12 hex characters and deterministic', () => {
        expect(hash()).toMatch(/^[0-9a-f]{12}$/);
        expect(hash()).toBe(hash());
    });

    test('a comment or formatting change does not change it', () => {
        file(groupPath, group);
        const before = hash([groupPath]);

        file(
            groupPath,
            '// The group.\nexport interface Group {\n    /** Id. */ id: string;\n\n    name:   string\n}\n',
        );
        expect(hash([groupPath])).toBe(before);
    });

    test('a new field changes it', () => {
        file(groupPath, group);
        const before = hash([groupPath]);

        file(groupPath, withCurrency);
        expect(hash([groupPath])).not.toBe(before);
    });

    test('does not depend on the order of the files', () => {
        expect(modelShapeHash({ root, files: [groupPath, userPath] })).toBe(
            modelShapeHash({ root, files: [userPath, groupPath] }),
        );
    });

    test('a field change of an imported type changes it (through the alias and the barrel)', () => {
        const before = hash([groupPath]);

        file('src/shared/money/money.ts', money.replace('minor: bigint', 'minor: number'));
        expect(hash([groupPath])).not.toBe(before);
    });

    test('a change of a type two hops away changes it', () => {
        const before = hash([groupPath]);

        file('src/shared/money/currency.ts', 'export type CurrencyCode = string;\n');
        expect(hash([groupPath])).not.toBe(before);
    });

    test('a function body or an unrelated export of the imported module does not change it', () => {
        const before = hash();

        file(
            'src/shared/money/money.ts',
            money.replace('value.minor === 0n', 'value.minor <= 0n') +
                '\nexport interface Unused {\n    id: string;\n}\n' +
                'export const ZERO = 0;\n',
        );
        expect(hash()).toBe(before);
    });

    test('comments and formatting in an imported file do not change it', () => {
        const before = hash();

        file(
            'src/shared/money/money.ts',
            "// Money.\nimport type {CurrencyCode} from './currency'\n" +
                '/** Ledger units. */\nexport interface Money { minor: bigint; // scale 4\n' +
                '  currency: CurrencyCode }\n' +
                'export const isZero = (value: Money): boolean => value.minor === 0n;\n',
        );
        expect(hash()).toBe(before);
    });

    test('an unresolvable import fails', () => {
        file(
            groupPath,
            "import type { Missing } from 'shared/missing';\n\nexport interface Group {\n    m: Missing;\n}\n",
        );

        expect(() => hash([groupPath])).toThrow(/cannot resolve module 'shared\/missing'/);
    });

    test('an unresolvable type name in a reachable declaration fails', () => {
        file('src/shared/money/currency.ts', 'export type CurrencyCode = string & Brand;\n');

        expect(() => hash([groupPath])).toThrow(/currency\.ts:1: cannot resolve type Brand/);
    });
});

describe('MODEL_SHAPE_HASH walk', () => {
    const typesPath = 'src/entities/x/model/types.ts';
    const shapes = (types, lib) => {
        file('tsconfig.app.json', tsconfig);
        file(typesPath, types);
        for (const [path, text] of Object.entries(lib)) {
            file(`src/shared/${path}`, text);
        }
        return hash([typesPath]);
    };
    /** The hash before and after `edit` replaces some of the `lib` files. */
    const beforeAfter = (types, lib, edit) => {
        const before = shapes(types, lib);

        return [before, shapes(types, { ...lib, ...edit })];
    };

    test('heritage: a change of an extended interface changes it', () => {
        const [before, after] = beforeAfter(
            "import type { Base } from 'shared/m';\n\nexport interface A extends Base {\n    a: string;\n}\n",
            { 'm.ts': 'export interface Base {\n    b: string;\n}\n' },
            { 'm.ts': 'export interface Base {\n    b: number;\n}\n' },
        );

        expect(after).not.toBe(before);
    });

    test('heritage: a change of an interface a reached class implements changes it', () => {
        const base = 'export interface Shape {\n    b: string;\n}\n';
        const [before, after] = beforeAfter(
            "import type { C } from 'shared/c';\n\nexport interface A {\n    c: C;\n}\n",
            {
                'c.ts': "import type { Shape } from './shape';\n\nexport class C implements Shape {\n    b = 'x';\n}\n",
                'shape.ts': base,
            },
            { 'shape.ts': base.replace('b: string', 'b: string;\n    d?: number') },
        );

        expect(after).not.toBe(before);
    });

    test('TypeQuery: a change of the annotation of `typeof x` changes it', () => {
        const [before, after] = beforeAfter(
            "import type { x } from 'shared/m';\n\nexport type X = typeof x;\n",
            { 'm.ts': 'export declare const x: { a: string };\n' },
            { 'm.ts': 'export declare const x: { a: number };\n' },
        );

        expect(after).not.toBe(before);
    });

    test("ImportType: a change of `import('...').T` changes it", () => {
        const [before, after] = beforeAfter(
            "export type T = import('shared/m').T;\n",
            { 'm.ts': 'export interface T {\n    a: string;\n}\n' },
            { 'm.ts': 'export interface T {\n    a: number;\n}\n' },
        );

        expect(after).not.toBe(before);
    });

    test("ImportType: a change of an export of `typeof import('...')` changes it", () => {
        const [before, after] = beforeAfter(
            "export type M = typeof import('shared/m');\n",
            { 'm.ts': 'export declare const a: string;\n' },
            { 'm.ts': 'export declare const a: number;\n' },
        );

        expect(after).not.toBe(before);
    });

    test('`as const` in a types.ts and in a reached initializer does not fail, and its values count', () => {
        const [before, after] = beforeAfter(
            "import type { LEVELS } from 'shared/m';\n\n" +
                "export const KINDS = ['a', 'b'] as const;\n" +
                'export type Level = (typeof LEVELS)[number];\n',
            { 'm.ts': "export const LEVELS = ['low', { high: -1 }] as const;\n" },
            { 'm.ts': "export const LEVELS = ['low', { high: -2 }] as const;\n" },
        );

        expect(after).not.toBe(before);
    });

    test('`typeof r.a` of a mapped member falls back to `r`, `typeof globalThis` is skipped', () => {
        const [before, after] = beforeAfter(
            "import type { r } from 'shared/m';\n\nexport type A = typeof r.a;\nexport type G = typeof globalThis;\n",
            { 'm.ts': "export declare const r: Record<'a', number>;\n" },
            { 'm.ts': "export declare const r: Record<'a', string>;\n" },
        );

        expect(after).not.toBe(before);
    });

    test('a computed property name follows its constant', () => {
        const [before, after] = beforeAfter(
            "import type { KEY } from 'shared/m';\n\nexport interface A {\n    [KEY]: string;\n}\n",
            { 'm.ts': "export const KEY = 'k';\n" },
            { 'm.ts': "export const KEY = 'j';\n" },
        );

        expect(after).not.toBe(before);
    });

    test('fails on a reached function without a return type', () => {
        expect(() =>
            shapes(
                "import type { f } from 'shared/m';\n\nexport type R = ReturnType<typeof f>;\n",
                {
                    'm.ts': 'export function f(x: number) {\n    return x;\n}\n',
                },
            ),
        ).toThrow(/m\.ts:1: the type of f is inferred from its value.*add an explicit return type/);
    });

    test('fails on a reached const arrow without a return type', () => {
        expect(() =>
            shapes("import type { f } from 'shared/m';\n\nexport type F = typeof f;\n", {
                'm.ts': 'export const f = (x: number) => x > 0;\n',
            }),
        ).toThrow(/add an explicit return type/);
    });

    test('fails on a reached unannotated const with a non-literal initializer', () => {
        expect(() =>
            shapes("import type { v } from 'shared/m';\n\nexport type V = typeof v;\n", {
                'm.ts': "const make = (): { a: string } => ({ a: 'x' });\n\nexport const v = make();\n",
            }),
        ).toThrow(/the type of v is inferred from its value.*add an explicit type annotation/);
    });

    test('fails on a reached class property typed by a non-literal initializer', () => {
        expect(() =>
            shapes("import type { C } from 'shared/m';\n\nexport type X = C;\n", {
                'm.ts': 'export class C {\n    at = new Date();\n}\n',
            }),
        ).toThrow(/the type of at is inferred from its value/);
    });

    test('the initializer of an annotated value and the body of a typed arrow do not count', () => {
        const lib = text => ({
            'm.ts':
                `export const f: (x: number) => boolean = x => x > ${text};\n` +
                `export const g = (x: number): boolean => x < ${text};\n` +
                `export class C {\n    count: number = ${text};\n}\n`,
        });
        const [before, after] = beforeAfter(
            "import type { C, f, g } from 'shared/m';\n\nexport type F = typeof f | typeof g | C;\n",
            lib('0'),
            lib('1'),
        );

        expect(after).toBe(before);
    });

    test('hashes a workspace package linked into node_modules by its real path, not an npm package', () => {
        const app = 'apps/app';
        const workspace = text => `export interface Label {\n    text: ${text};\n}\n`;
        const npm = text => `export interface Remote {\n    id: ${text};\n}\n`;
        const setup = (workspaceText, npmText) => {
            file(
                `${app}/tsconfig.app.json`,
                JSON.stringify({
                    compilerOptions: {
                        module: 'ESNext',
                        moduleResolution: 'bundler',
                        lib: ['ES2020'],
                        types: [],
                        strict: true,
                        noEmit: true,
                    },
                }),
            );
            file(
                `${app}/${typesPath}`,
                "import type { Label } from '@x/pkg';\nimport type { Remote } from 'remote';\n\nexport interface A {\n    l: Label;\n    r: Remote;\n}\n",
            );
            file(
                'packages/pkg/package.json',
                JSON.stringify({ name: '@x/pkg', types: './index.ts' }),
            );
            file('packages/pkg/index.ts', workspace(workspaceText));
            file(
                'node_modules/remote/package.json',
                JSON.stringify({ name: 'remote', types: './index.d.ts' }),
            );
            file('node_modules/remote/index.d.ts', npm(npmText));
            if (!existsSync(join(root, 'node_modules/@x/pkg'))) {
                mkdirSync(join(root, 'node_modules/@x'), { recursive: true });
                symlinkSync('../../packages/pkg', join(root, 'node_modules/@x/pkg'), 'dir');
            }
            const options = { root: join(root, app), files: [typesPath] };

            return { inputs: modelShapeInputs(options), hash: modelShapeHash(options) };
        };
        const before = setup('string', 'string');

        expect(before.inputs).toContain(
            `../../packages/pkg/index.ts\0${workspace('string').trimEnd()}`,
        );
        expect(setup('string', 'number').hash).toBe(before.hash);
        expect(setup('number', 'number').hash).not.toBe(before.hash);
    });

    test.each([
        ['a function', 'export function f(x = make()): void {}\n', 'Parameters<typeof f>'],
        ['an arrow', 'export const f = (x = make()): void => {};\n', 'Parameters<typeof f>'],
        [
            'a constructor parameter property',
            'export class f {\n    constructor(public x = make()) {}\n}\n',
            'f',
        ],
    ])('fails on a reached parameter of %s typed by a non-literal default', (_, code, type) => {
        expect(() =>
            shapes(`import type { f } from 'shared/m';\n\nexport type P = ${type};\n`, {
                'm.ts': `const make = (): number => 1;\n\n${code}`,
            }),
        ).toThrow(/the type of x is inferred from its value.*add an explicit type annotation/);
    });

    test('a setter parameter and a literal default need no annotation', () => {
        expect(() =>
            shapes("import type { C } from 'shared/m';\n\nexport type X = C;\n", {
                'm.ts':
                    'export class C {\n    get v(): number {\n        return 1;\n    }\n' +
                    '    set v(x) {}\n    m(y = 1): number {\n        return y;\n    }\n}\n',
            }),
        ).not.toThrow();
    });

    test('`typeof r.m` of a lib member also hashes `r`', () => {
        const [before, after] = beforeAfter(
            "import type { r } from 'shared/m';\n\nexport type T = typeof r.indexOf;\n",
            { 'm.ts': 'export declare const r: string[];\n' },
            { 'm.ts': 'export declare const r: number[];\n' },
        );

        expect(after).not.toBe(before);
    });

    test('a value in a types.ts is checked like a reached one', () => {
        expect(() =>
            shapes(
                "import { make } from 'shared/m';\n\nexport const v = make();\nexport type V = typeof v;\n",
                { 'm.ts': 'export const make = (): number => 1;\n' },
            ),
        ).toThrow(/types\.ts:3: the type of v is inferred from its value/);
    });

    test('an enum initializer follows its constant, a computed one fails', () => {
        const types = "import type { E } from 'shared/m';\n\nexport type X = E;\n";
        const lib = base => ({
            'm.ts': `export const BASE = ${base};\n\nexport enum E {\n    A = BASE,\n}\n`,
        });
        const [before, after] = beforeAfter(types, lib(1), lib(2));

        expect(after).not.toBe(before);
        expect(() =>
            shapes(types, { 'm.ts': "export enum E {\n    A = 'x'.length,\n}\n" }),
        ).toThrow(/the value of A = 'x'\.length is computed/);
    });

    test('a default export follows its identifier, an expression fails', () => {
        const types = "export type M = typeof import('shared/m');\n";
        const [before, after] = beforeAfter(
            types,
            { 'm.ts': "const impl: { a: string } = { a: 'x' };\n\nexport default impl;\n" },
            { 'm.ts': 'const impl: { a: number } = { a: 1 };\n\nexport default impl;\n' },
        );

        expect(after).not.toBe(before);
        expect(() => shapes(types, { 'm.ts': 'export default [1, 2];\n' })).toThrow(
            /the value of export default \[1, 2\]; is computed/,
        );
    });

    test.each([
        ['element access', "[KEYS['a']]"],
        ['property access', '[KEYS.a]'],
    ])('a computed name by %s follows its constant', (_, key) => {
        const types = `import type { KEYS } from 'shared/m';\n\nexport interface A {\n    ${key}: string;\n}\n`;
        const [before, after] = beforeAfter(
            types,
            { 'm.ts': "export const KEYS = { a: 'k' } as const;\n" },
            { 'm.ts': "export const KEYS = { a: 'j' } as const;\n" },
        );

        expect(after).not.toBe(before);
    });

    test('a namespace re-export cycle does not loop', () => {
        expect(() =>
            shapes("export type M = typeof import('shared/a');\n", {
                'a.ts': "export * as b from './b';\nexport interface A {\n    x: string;\n}\n",
                'b.ts': "export * as a from './a';\n",
            }),
        ).not.toThrow();
    });

    test('a repository under a node_modules folder is still hashed', () => {
        const parent = root;

        root = join(parent, 'node_modules/app');
        try {
            const [before, after] = beforeAfter(
                "import type { T } from 'shared/m';\n\nexport type X = T;\n",
                { 'm.ts': 'export type T = string;\n' },
                { 'm.ts': 'export type T = number;\n' },
            );

            expect(after).not.toBe(before);
        } finally {
            root = parent;
        }
    });
});

describe('modelTypeFiles', () => {
    test('finds every slice types.ts, sorted, and skips slices without model/', () => {
        file('src/entities/user/model/types.ts', 'export type A = 1;\n');
        file('src/entities/group/model/types.ts', group);
        file('src/entities/group/model/other.ts');
        file('src/entities/session/index.ts');

        expect(modelTypeFiles(root)).toEqual([
            { path: 'src/entities/group/model/types.ts', text: group },
            { path: 'src/entities/user/model/types.ts', text: 'export type A = 1;\n' },
        ]);
    });

    test('fails when no types.ts exists at all', () => {
        mkdirSync(join(root, 'src/entities'), { recursive: true });

        expect(() => modelTypeFiles(root)).toThrow(/would hash nothing/);
    });

    test('fails when a model/ folder has no types.ts', () => {
        file('src/entities/group/model/types.ts', group);
        file('src/entities/balance/model/balance.ts');

        expect(() => modelTypeFiles(root)).toThrow(
            /missing: src\/entities\/balance\/model\/types\.ts/,
        );
    });
});
