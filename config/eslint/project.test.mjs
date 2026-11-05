import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, test } from 'vitest';

import {
    PENDING_IDS,
    projectImports,
    projectRules,
    projectSyntax,
    restrictedImports,
    restrictedSyntax,
} from './project.js';
import { reactSyntax } from './react.js';

const resolvedIds = async (config, file, rule) => {
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
    const value = (await eslint.calculateConfigForFile(file)).rules[rule];

    if (value === undefined || value[0] === 0) {
        return [];
    }
    const options = value.slice(1);
    const messages =
        rule === 'no-restricted-syntax'
            ? options.map(option => option.message)
            : options.flatMap(option => [...option.paths, ...option.patterns].map(e => e.message));

    return messages.map(message => message.match(/^\[([^\]]+)\]/)[1]).sort();
};

describe('restrictedSyntax()', () => {
    const config = restrictedSyntax([
        { id: 'everywhere', selector: 'WithStatement', message: 'Remove it.' },
        { id: 'not-in-money', selector: 'X', message: 'Use money.', ignores: ['src/money/**'] },
        { id: 'only-ui', selector: 'Y', message: 'Use Z.', files: ['src/ui/**'] },
        { id: 'not-in-tests', selector: 'T', message: 'Fix.', ignores: ['**/*.test.ts'] },
    ]);

    test.each([
        ['src/store/a.ts', ['everywhere', 'not-in-money', 'not-in-tests']],
        ['src/money/a.ts', ['everywhere', 'not-in-tests']],
        ['src/money/a.test.ts', ['everywhere']],
        ['src/ui/a.ts', ['everywhere', 'not-in-money', 'not-in-tests', 'only-ui']],
        ['src/ui/a.test.ts', ['everywhere', 'not-in-money', 'only-ui']],
    ])('%s gets exactly the entries that apply to it', async (file, ids) => {
        expect(await resolvedIds(config, file, 'no-restricted-syntax')).toEqual(ids);
    });

    test('prefixes messages with the id and rejects entries without id or message', () => {
        expect(restrictedSyntax([])).toEqual([]);
        expect(restrictedSyntax([{ id: 'a', selector: 'X', message: 'Fix.' }])[0].rules).toEqual({
            'no-restricted-syntax': ['error', { selector: 'X', message: '[a] Fix.' }],
        });
        expect(() => restrictedSyntax([{ selector: 'X', message: 'Fix.' }])).toThrow(/id/);
        expect(() => restrictedSyntax([{ id: 'a', selector: 'X' }])).toThrow(/message/);
    });
});

describe('restrictedImports()', () => {
    const config = restrictedImports([
        { id: 'axios', path: 'axios', message: 'Use src/api.', ignores: ['src/api/**'] },
        {
            id: 'api-in-ui',
            pattern: { regex: '^api/', allowTypeImports: true },
            files: ['src/ui/**'],
            message: 'Call a store.',
        },
    ]);

    test.each([
        ['src/ui/a.tsx', ['api-in-ui', 'axios']],
        ['src/api/a.ts', []],
        ['src/store/a.ts', ['axios']],
    ])('%s gets exactly the entries that apply to it', async (file, ids) => {
        expect(await resolvedIds(config, file, 'no-restricted-imports')).toEqual(ids);
    });
});

describe('pending entries', () => {
    test('list the keys marked pending on every block where the entry is active', () => {
        const blocks = restrictedSyntax([
            { id: 'everywhere', selector: 'WithStatement', message: 'Remove it.' },
            {
                id: 'money',
                selector: 'X',
                message: 'Use money.',
                files: ['src/money/**'],
                pending: true,
            },
        ]);

        expect(blocks.map(block => [block.name, block[PENDING_IDS]])).toEqual([
            ['chipin/no-restricted-syntax/all', []],
            ['chipin/no-restricted-syntax/src/money/**', ['no-restricted-syntax#money']],
        ]);
    });
});

describe('money entries (spec 03 §4.3) merged with the existing selector entries', () => {
    // The same single helper call as eslint.config.js: money entries and the i18n entry share one
    // `no-restricted-syntax` rule key, so a later block must not drop the other's selectors.
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: {
                parser: tseslint.parser,
                parserOptions: { ecmaFeatures: { jsx: true } },
            },
        },
        ...restrictedSyntax([...projectSyntax({ appDir: '.' }), ...reactSyntax({ appDir: '.' })]),
        ...restrictedImports(projectImports()),
    ];
    const tsSource = [
        "import { split } from 'shared/money/split';",
        'export const a = (row: { amount: number; minor: number }, b: number) => [',
        "    parseFloat('1.5'),",
        "    Number.parseFloat('1.5'),",
        '    Number(row.amount),',
        '    Number(row?.netAmount),',
        '    Number(row.shareAmount!),',
        '    b.toFixed(2),',
        '    Math.round(b * 100),',
        "    new Intl.NumberFormat('en'),",
        '    row.minor > 0,',
        '    row?.amount >= 0,',
        '    row.amount! < b,',
        '    (row?.amount ?? 0) > 1,',
        '    b <= (row.minor || 0),',
        // Not money fields or not a direct operand: not reported.
        '    Number(row.count),',
        '    row.amount.length > 0,',
        '    (row.count ?? 0) > 1,',
        '    (b && row.amount) > 1,',
        '    split,',
        '];',
    ].join('\n');
    const tsxSource = `${tsSource}\nexport const C = () => <input placeholder="Type here" />;`;
    const MONEY = [
        'money-parse-float',
        'money-parse-float',
        'money-number-field',
        'money-number-field',
        'money-number-field',
        'money-to-fixed',
        'money-math-round',
        'money-intl-number-format',
        'money-compare-field',
        'money-compare-field',
        'money-compare-field',
        'money-compare-field',
        'money-compare-field',
    ];

    test.each([
        ['src/components/A.tsx', ['money-deep-import', ...MONEY, 'i18n-attributes']],
        ['src/store/a.ts', ['money-deep-import', ...MONEY]],
        ['src/shared/money/format.tsx', ['money-deep-import', 'i18n-attributes']],
        ['src/shared/lib/formatNumber.ts', ['money-deep-import']],
        ['src/components/A.test.tsx', ['money-deep-import']],
        ['ds-gallery/gallery.tsx', ['money-deep-import']],
    ])('%s reports exactly %j', async (file, ids) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const source = file.endsWith('.tsx') ? tsxSource : tsSource;
        const [result] = await eslint.lintText(source, { filePath: file });

        expect(
            result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]),
        ).toEqual(ids);
    });
});

describe('project entries (02-C12) merged with the money and i18n entries', () => {
    // The same single helper call as eslint.config.js: the project, money and i18n entries share
    // one `no-restricted-syntax` rule key, so no block may drop another module's selectors.
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: {
                parser: tseslint.parser,
                parserOptions: { ecmaFeatures: { jsx: true } },
            },
        },
        ...restrictedSyntax([
            ...projectSyntax({ appDir: '.' }),
            ...projectRules({ appDir: '.' }),
            ...reactSyntax({ appDir: '.' }),
        ]),
    ];
    const source = [
        'export const C = () => {',
        '    const all = useAuthStore();',
        '    const arrow = useAuthStore(state => ({ user: state.user }));',
        '    const fn = useAuthStore(function (state) { return { user: state.user }; });',
        '    const literal = useAuthStore({ user: 1 });',
        // Selectors that are fine: one value, useShallow-wrapped object, React's own hook,
        // getState, an object built by a nested function, an object nested in an array.
        '    const one = useAuthStore(state => state.user);',
        '    const shallow = useAuthStore(useShallow(state => ({ user: state.user })));',
        '    const named = useAuthStore(useShallow(selectUser));',
        '    const external = useSyncExternalStore(subscribe, () => ({}));',
        '    const snapshot = useAuthStore.getState();',
        '    const nested = useAuthStore(state => { const f = () => ({ a: 1 }); return f(); });',
        '    const arr = useAuthStore(state => [state.a, state.b]);',
        '    const cond = useAuthStore(state => (state.c ? { a: 1 } : { b: 2 }));',
        '    const condOne = useAuthStore(state => (state.c ? state.a : [state.b]));',
        '    const fnArr = useAuthStore(function (state) { return state.c ? [] : null; });',
        '    const zAll = useStore(authStore);',
        '    const zNone = useStore();',
        '    const zObj = useStore(authStore, state => ({ a: state.a }));',
        '    const zArr = useStore(authStore, state => [state.a]);',
        // Fine: a conditional of plain values, Zustand useStore with a value selector or useShallow,
        // derived arrays (not detected: the heuristic covers only literals).
        '    const condValue = useAuthStore(state => (state.c ? state.a : state.b));',
        '    const zOne = useStore(authStore, state => state.a);',
        '    const zShallow = useStore(authStore, useShallow(state => ({ a: state.a })));',
        '    const derived = useAuthStore(state => state.items.map(item => item.id));',
        "    const amount = parseFloat('1.5');",
        '    return [all, arrow, fn, literal, one, shallow, named, external, snapshot, nested, arr,',
        '        cond, condOne, fnArr, zAll, zNone, zObj, zArr, condValue, zOne, zShallow, derived, amount];',
        '};',
        'const Picture = styled.img``;',
        "const Avatar = styled('img')``;",
        "const Created = createElement('img', { src: 'a.png' });",
        "const ReactCreated = React.createElement('img', { src: 'a.png' });",
        "const Div = React.createElement('div');",
        'export const D = () => <img src="a.png" alt="" placeholder="Type here" />;',
        'export { Avatar, Created, Div, Picture, ReactCreated };',
    ].join('\n');
    const PROJECT = [
        'store-without-selector',
        'store-object-without-shallow',
        'store-object-without-shallow',
        'store-object-without-shallow',
        'store-object-without-shallow',
        'store-object-without-shallow',
        'store-object-without-shallow',
        'store-object-without-shallow',
        'store-without-selector',
        'store-without-selector',
        'store-object-without-shallow',
        'store-object-without-shallow',
        'money-parse-float',
        'img-element',
        'img-element',
        'img-element',
        'img-element',
        'img-element',
    ];

    test.each([
        ['src/components/A.tsx', [...PROJECT, 'i18n-attributes']],
        // basics/Image is the one place that renders <img>.
        [
            'src/basics/Image.tsx',
            [...PROJECT.filter(id => id !== 'img-element'), 'i18n-attributes'],
        ],
        // Tests keep the project entries; money and i18n attributes are exempt there.
        ['src/components/A.test.tsx', PROJECT.filter(id => !id.startsWith('money'))],
        ['ds-gallery/gallery.tsx', PROJECT.filter(id => !id.startsWith('money'))],
    ])('%s reports exactly %j', async (file, ids) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(source, { filePath: file });

        expect(
            result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]),
        ).toEqual(ids);
    });
});

describe('money-wire-conversion (spec 03 §4.3, C1-11) merged with the other import entries', () => {
    // One `no-restricted-imports` rule key: the new entry must not drop the older ones.
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: { parser: tseslint.parser },
        },
        ...restrictedImports(projectImports({ appDir: '.' })),
    ];
    const source = [
        "import { moneyFromWire, moneyToWire, sum } from 'shared/money';",
        "import { moneyFromWire as read } from '../../shared/money';",
        "import { moneyToWire as write } from '../../../shared/money/index';",
        "import { moneyFromWire as deep } from '../../../shared/money/wireMoney';",
        "import { split } from 'shared/money/split';",
        "import { Users } from 'lucide-react';",
        'export { deep, moneyFromWire, moneyToWire, read, split, sum, Users, write };',
    ].join('\n');
    const OTHERS = ['money-deep-import', 'lucide-icon-names'];
    const WIRE = Array(5).fill('money-wire-conversion');

    test.each([
        ['src/shared/api/client.ts', [...WIRE, ...OTHERS]],
        ['src/entities/balance/api/queries.ts', [...WIRE, ...OTHERS]],
        ['src/store/a.ts', [...WIRE, ...OTHERS]],
        ['src/entities/balance/model/toBalance.ts', OTHERS],
        ['src/entities/ledger/model/deep/toEntryWire.ts', OTHERS],
        ['src/shared/money/wireMoney.ts', OTHERS],
        ['src/shared/api/client.test.ts', OTHERS],
    ])('%s reports exactly %j', async (file, ids) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(source, { filePath: file });

        expect(
            result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]),
        ).toEqual(ids);
    });
});

describe('query-key-literal (spec 03 §1.3)', () => {
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: { parser: tseslint.parser },
        },
        ...restrictedSyntax([
            ...projectSyntax({ appDir: '.' }),
            ...projectRules({ appDir: '.' }),
            ...reactSyntax({ appDir: '.' }),
        ]),
    ];
    const source = [
        "export const a = useQuery({ queryKey: ['stats'], queryFn });",
        "export const b = queryOptions({ queryKey: ['groups', id] as const, queryFn });",
        "export const c = client.invalidateQueries({ queryKey: ['groups'] satisfies unknown[] });",
        // Fine: keys from a factory, a spread of a factory key, another property's array.
        'export const d = useQuery({ queryKey: statsKeys.all, queryFn });',
        "export const e = useQuery({ queryKey: groupKeys.detail(id), meta: { tags: ['x'] } });",
    ].join('\n');

    test.each([
        [
            'src/features/landing/A.tsx',
            ['query-key-literal', 'query-key-literal', 'query-key-literal'],
        ],
        [
            'src/entities/stats/A.test.tsx',
            ['query-key-literal', 'query-key-literal', 'query-key-literal'],
        ],
        // The key factories themselves.
        ['src/entities/stats/api/queries.ts', []],
    ])('%s reports exactly %j', async (file, ids) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(source, { filePath: file });

        expect(
            result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]),
        ).toEqual(ids);
    });
});

describe('store-object-without-shallow: fallbacks, nested conditionals, returns in if (#625)', () => {
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: { parser: tseslint.parser },
        },
        ...restrictedSyntax([
            ...projectSyntax({ appDir: '.' }),
            ...projectRules({ appDir: '.' }),
            ...reactSyntax({ appDir: '.' }),
        ]),
    ];
    const flagged = [
        'useAuthStore(s => s.list ?? [])',
        'useAuthStore(s => s.x || {})',
        'useAuthStore(s => s.a ?? s.b ?? [])',
        'useAuthStore(s => (s.c ? (s.d ? s.a : {}) : s.b))',
        'useAuthStore(s => (s.c ? s.a : s.list ?? []))',
        'useAuthStore(s => (s.c ? s.a : s.d ? s.b : s.e ? s.f : []))',
        'useStore(authStore, s => s.list || [])',
        'useAuthStore(s => { if (s.c) { return []; } return s.a; })',
        'useAuthStore(s => { if (s.c) return {}; return s.a; })',
        'useAuthStore(function (s) { if (s.c) { return s.a; } else { return s.list ?? []; } })',
        'useAuthStore(s => { if (s.c) { return s.a; } else if (s.d) { return []; } return s.b; })',
    ];
    const fine = [
        'useAuthStore(s => s.list ?? EMPTY)',
        'useAuthStore(s => s.a && s.b)',
        'useAuthStore(s => s.a ?? 0)',
        'useAuthStore(useShallow(s => s.list ?? []))',
        'useAuthStore(s => (s.c ? (s.d ? s.a : s.e) : s.b))',
        'useAuthStore(s => { const f = () => { if (s.c) { return []; } return null; }; return f; })',
        'useAuthStore(s => { if (s.c) { return s.a; } return s.b; })',
    ];

    test.each(flagged)('flags %s', async expression => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(`export const v = ${expression};`, {
            filePath: 'src/components/A.tsx',
        });

        expect(result.messages.map(message => message.message.slice(0, 30))).toEqual([
            '[store-object-without-shallow]',
        ]);
    });

    test.each(fine)('accepts %s', async expression => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(`export const v = ${expression};`, {
            filePath: 'src/components/A.tsx',
        });

        expect(result.messages).toEqual([]);
    });
});
