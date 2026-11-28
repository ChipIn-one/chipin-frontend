import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, test } from 'vitest';

import {
    PENDING_IDS,
    projectConfig,
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
            ['chipin/no-restricted-syntax/astro/all', []],
            ['chipin/no-restricted-syntax/src/money/**', ['no-restricted-syntax#money']],
            ['chipin/no-restricted-syntax/astro/src/money/**', ['no-restricted-syntax#money']],
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
        ...restrictedSyntax([...projectSyntax({ appDir: '.' }), ...reactSyntax()]),
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
        // Outside src/ the money entries are off (moneyScope).
        ['contract-tests/support/a.tsx', ['money-deep-import', 'i18n-attributes']],
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
            ...reactSyntax(),
        ]),
    ];
    const source = [
        "export * from './x';",
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
        // A double assertion leaf, an assertion combo, `&&` with a new value, a doubly asserted root.
        '    const dbl = useAuthStore(state => state.list ?? ([] as unknown as Item[]));',
        '    const combo = useAuthStore(state => state.list ?? ([] satisfies Item[] as Item[]));',
        '    const and = useAuthStore(state => state.a && { a: state.a });',
        '    const andArr = useStore(authStore, state => (state.a && [state.a]) as Item[]);',
        '    const dblRoot = useAuthStore(state => ({}) as unknown as Item);',
        // The deepest detected chain: 6 value nodes down to the literal.
        '    const deep = useAuthStore(s => s.a ?? (s.b ?? (s.c ?? (s.d ?? (s.e ?? (s.f || []))))));',
        // Fine: a conditional of plain values, Zustand useStore with a value selector or useShallow,
        // derived arrays (not detected: the heuristic covers only literals).
        '    const condValue = useAuthStore(state => (state.c ? state.a : state.b));',
        '    const zOne = useStore(authStore, state => state.a);',
        '    const zShallow = useStore(authStore, useShallow(state => ({ a: state.a })));',
        '    const derived = useAuthStore(state => state.items.map(item => item.id));',
        '    const andValue = useAuthStore(state => state.a && state.b);',
        // Fine: a literal built inside a call or a nested function is not the returned value.
        '    const mapped = useAuthStore(s => s.items.map(i => ({ i })));',
        '    const called = useAuthStore(s => (s.a ? f({}) : s.b));',
        '    const found = useAuthStore(s => s.a ?? s.list.find(x => ({})));',
        '    const calledDeep = useAuthStore(s => (s.a ? s.b : (s.c ?? g([]))));',
        "    const amount = parseFloat('1.5');",
        '    return [all, arrow, fn, literal, one, shallow, named, external, snapshot, nested, arr,',
        '        cond, condOne, fnArr, zAll, zNone, zObj, zArr, dbl, combo, and, andArr, dblRoot, deep,',
        '        condValue, zOne, zShallow, derived, andValue,',
        '        mapped, called, found, calledDeep, amount];',
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
        'export-all',
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
        ...Array(6).fill('store-object-without-shallow'),
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
        // Outside src/ the money entries are off (moneyScope).
        ['scripts/a.tsx', [...PROJECT.filter(id => !id.startsWith('money')), 'i18n-attributes']],
    ])('%s reports exactly %j', async (file, ids) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(source, { filePath: file });

        expect(
            result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]),
        ).toEqual(ids);
    });
});

describe('restrictedSyntax() on `.astro` files (#829)', () => {
    const config = restrictedSyntax([
        { id: 'everywhere', selector: 'WithStatement', message: 'Remove it.' },
        { id: 'react-only', selector: 'JSXOpeningElement', message: 'Fix.', astro: false },
        { id: 'only-ui', selector: 'Y', message: 'Use Z.', files: ['src/ui/**'] },
    ]);

    test.each([
        ['src/a.astro', ['everywhere']],
        ['src/ui/a.astro', ['everywhere', 'only-ui']],
        ['src/a.tsx', ['everywhere', 'react-only']],
        // A client `<script>` of an `.astro` file is a virtual `.ts` child: the LINT_FILES blocks.
        ['src/a.astro/0.ts', ['everywhere', 'react-only']],
    ])('%s gets %j', async (file, ids) => {
        expect(await resolvedIds(config, file, 'no-restricted-syntax')).toEqual(ids.sort());
    });

    test('the app-only JSX entries (img-element, i18n-attributes) skip site `.astro` files', async () => {
        const syntax = restrictedSyntax([
            ...projectSyntax({ appDir: 'apps/app' }),
            ...projectRules({ appDir: 'apps/app' }),
            ...reactSyntax(),
        ]);
        const astro = await resolvedIds(
            syntax,
            'apps/site/src/pages/a.astro',
            'no-restricted-syntax',
        );
        const app = await resolvedIds(
            syntax,
            'apps/app/src/components/A.tsx',
            'no-restricted-syntax',
        );

        expect(astro).not.toContain('img-element');
        expect(astro).not.toContain('i18n-attributes');
        expect(astro).toContain('export-all');
        expect(app).toEqual(expect.arrayContaining(['img-element', 'i18n-attributes']));
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

describe('store-object-without-shallow stays fast on long chains', () => {
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: { parser: tseslint.parser },
        },
        ...restrictedSyntax(projectRules({ appDir: '.' })),
    ];
    const terms = Array.from({ length: 30 }, (_, index) => `s.a${index}`);
    const ternary = terms.reduceRight((rest, term) => `${term} ? ${term}v : ${rest}`, 's.z');

    test.each([
        ['a 30-term || chain', terms.join(' || ')],
        ['a 30-deep ternary chain', ternary],
    ])('%s lints within the time budget, with no report', async (_, body) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const started = performance.now();
        const [result] = await eslint.lintText(`export const v = useAuthStore(s => ${body});`, {
            filePath: 'src/components/A.tsx',
        });

        expect(performance.now() - started).toBeLessThan(3000);
        expect(result.messages).toEqual([]);
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
            ...reactSyntax(),
        ]),
    ];
    const source = [
        "export const a = useQuery({ queryKey: ['stats'], queryFn });",
        "export const b = queryOptions({ queryKey: ['groups', id] as const, queryFn });",
        "export const c = client.invalidateQueries({ queryKey: ['groups'] satisfies unknown[] });",
        "export const f = client.getQueryData(['stats']);",
        "export const g = client.setQueryData(['stats'] as const, data);",
        "export const h = client.getQueryState(['stats']);",
        // A conditional key with a literal branch (bare, asserted, or the whole conditional asserted).
        "export const j = useQuery({ queryKey: c ? ['a'] : statsKeys.all, queryFn });",
        "export const k = useQuery({ queryKey: c ? statsKeys.all : (['b'] as const), queryFn });",
        "export const l = useQuery({ queryKey: (c ? ['a'] : ['b']) as const, queryFn });",
        // Fine: keys from a factory (property and argument), an array in another property or
        // in a later argument.
        'export const d = useQuery({ queryKey: statsKeys.all, queryFn });',
        "export const e = useQuery({ queryKey: groupKeys.detail(id), meta: { tags: ['x'] } });",
        "export const i = client.setQueryData(statsKeys.all, ['x']);",
        'export const m = useQuery({ queryKey: c ? statsKeys.all : groupKeys.all, queryFn });',
    ].join('\n');

    test.each([
        ['src/features/activity/A.tsx', Array(9).fill('query-key-literal')],
        ['src/entities/dashboard/A.test.tsx', Array(9).fill('query-key-literal')],
        // The key factories themselves.
        ['src/entities/dashboard/api/queries.ts', []],
    ])('%s reports exactly %j', async (file, ids) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(source, { filePath: file });

        expect(
            result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]),
        ).toEqual(ids);
    });
});

describe('pure-query-fn (#669, 50-api-data.md §Query Functions)', () => {
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: { parser: tseslint.parser },
        },
        ...restrictedSyntax([
            ...projectSyntax({ appDir: '.' }),
            ...projectRules({ appDir: '.' }),
            ...reactSyntax(),
        ]),
    ];
    const source = [
        // `client` from the context: destructured (arrow, method, in the body) or read.
        'export const a = queryOptions({ queryKey: k, queryFn: ({ client, signal }) => read(client, signal) });',
        'export const b = queryOptions({ queryKey: k, queryFn({ client }) { return read(client); } });',
        'export const c = queryOptions({ queryKey: k, queryFn: context => { const { client } = context; return read(client); } });',
        'export const d = queryOptions({ queryKey: k, queryFn: context => read(context.client) });',
        // A cache call inside an inline query function.
        'export const e = queryOptions({ queryKey: k, queryFn: () => read().then(data => { other.setQueryData(k2, data); return data; }) });',
        'export const f = queryOptions({ queryKey: k, queryFn: async () => { await qc.invalidateQueries({ queryKey: k2 }); return read(); } });',
        'export const g = queryOptions({ queryKey: k, queryFn: () => qc.fetchQuery(other) });',
        // Fine: a pure read; a cache call around (not inside) a query function; a mutation's
        // `onSuccess` with the client; a seed that only reads (`initialData`).
        'export const h = queryOptions({ queryKey: k, queryFn: ({ signal, pageParam }) => read(pageParam, signal) });',
        'export const i = qc.prefetchQuery({ queryKey: k, queryFn: () => read() });',
        'export const j = mutationOptions({ mutationFn: write, onSuccess: (_d, _v, _c, { client }) => client.invalidateQueries({ queryKey: k }) });',
        'export const l = queryOptions({ queryKey: k, initialData: () => qc.getQueryData(k2), queryFn: () => read() });',
    ].join('\n');

    test.each([['src/entities/groups/api/queries.ts'], ['src/store/sessionUser.ts']])(
        '%s reports each impure query function once (lines 1-7), nothing else',
        async file => {
            const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
            const [result] = await eslint.lintText(source, { filePath: file });

            expect(
                result.messages.map(
                    message => `${message.message.match(/\[([a-z0-9-]+)\]/)?.[1]}:${message.line}`,
                ),
            ).toEqual([1, 2, 3, 4, 5, 6, 7].map(line => `pure-query-fn:${line}`));
        },
    );
});

describe('site-paths (04-2f, spec 04 §2.1)', () => {
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: { parser: tseslint.parser },
        },
        ...restrictedSyntax([
            ...projectSyntax({ appDir: '.' }),
            ...projectRules({ appDir: '.' }),
            ...reactSyntax(),
        ]),
    ];
    const source = [
        'export const a = ROUTES.HOME;',
        'export const b = ROUTES.PRIVACY;',
        'export const c = navigate(ROUTES.TERMS, { replace: true });',
        // Fine: app routes, SITE_PATHS, a HOME of another object.
        'export const d = ROUTES.DASHBOARD;',
        'export const e = SITE_PATHS.home;',
        'export const f = KEYS.HOME;',
    ].join('\n');

    test.each([
        ['src/components/Header.tsx', Array(3).fill('site-paths')],
        ['src/helpers/url.test.ts', Array(3).fill('site-paths')],
    ])('04-2f lint: %s reports exactly %j', async (file, ids) => {
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
            ...reactSyntax(),
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
        'useAuthStore(s => s.list ?? ([] as Item[]))',
        'useAuthStore(s => (s.list ?? []) as Item[])',
        'useAuthStore(s => (s.c ? s.a : ({} satisfies Partial<Item>)))',
        'useAuthStore(s => ({}) as Item)',
        'useAuthStore(s => { return (s.list || []) as Item[]; })',
    ];
    const fine = [
        'useAuthStore(s => s.list ?? EMPTY)',
        'useAuthStore(s => s.a && s.b)',
        'useAuthStore(s => s.a ?? 0)',
        'useAuthStore(useShallow(s => s.list ?? []))',
        'useAuthStore(s => (s.c ? (s.d ? s.a : s.e) : s.b))',
        'useAuthStore(s => { const f = () => { if (s.c) { return []; } return null; }; return f; })',
        'useAuthStore(s => { if (s.c) { return s.a; } return s.b; })',
        'useAuthStore(s => s.list as Item[])',
        'useAuthStore(s => (s.list ?? EMPTY) as Item[])',
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

describe('import-x/no-default-export (02-C13): on everywhere except the spec 02 §D5 exceptions', () => {
    const config = projectConfig({ appDir: '.' });

    test.each([
        ['src/components/A.tsx', 2],
        ['src/basics/numbers/amount/index.ts', 2],
        ['scripts/sentry-sourcemaps.ts', 2],
        ['vite.config.ts', undefined],
        ['vitest.contract.config.ts', undefined],
        ['eslint.config.js', undefined],
        ['prettier.config.js', undefined],
        ['pwa-assets.config.ts', undefined],
        ['src/types/global.d.ts', undefined],
    ])('%s resolves the rule to %s', async (file, severity) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const rule = (await eslint.calculateConfigForFile(file)).rules[
            'import-x/no-default-export'
        ];

        expect(rule?.[0]).toBe(severity);
    });
});

describe('storage boundary (#675): storage only through helpers/localStorage.ts', () => {
    const config = projectConfig({ appDir: '.' });
    const lint = async (code, filePath) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(code, { filePath });

        return result.messages.map(message => message.ruleId);
    };
    const access = [
        'localStorage.getItem("k");',
        'sessionStorage.getItem("k");',
        'window.localStorage.getItem("k");',
        'window.sessionStorage.getItem("k");',
        'globalThis.sessionStorage.getItem("k");',
        'self.localStorage.getItem("k");',
    ];

    test.each(access)('rejects %s in app code and in shared/offline', async code => {
        expect(await lint(code, 'src/helpers/locale.ts')).toHaveLength(1);
        expect(await lint(code, 'src/shared/offline/network.ts')).toHaveLength(1);
    });

    test.each(access)('accepts %s in the helper, tests and test support', async code => {
        expect(await lint(code, 'src/helpers/localStorage.ts')).toEqual([]);
        expect(await lint(code, 'src/components/Header.test.tsx')).toEqual([]);
        expect(await lint(code, 'src/test/setup.ts')).toEqual([]);
        expect(await lint(code, 'src/shared/offline/network.test.ts')).toEqual([]);
    });

    test('navigator.onLine stays restricted outside shared/offline, tests included', async () => {
        const code = 'export const online = navigator.onLine;';

        expect(await lint(code, 'src/components/A.tsx')).toEqual(['no-restricted-properties']);
        expect(await lint(code, 'src/components/A.test.tsx')).toEqual(['no-restricted-properties']);
        expect(await lint(code, 'src/helpers/localStorage.ts')).toEqual([
            'no-restricted-properties',
        ]);
        expect(await lint(code, 'src/shared/offline/network.ts')).toEqual([]);
        expect(await lint(code, 'src/shared/offline/network.test.ts')).toEqual([]);
    });
});

describe('no-raw-colors and inline-style (spec 05 §3, 05-5)', () => {
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
            ...reactSyntax(),
        ]),
    ];
    const lintIds = async (source, file) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(source, { filePath: file });

        return result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]);
    };
    const colors = [
        "export const a = '#fff';",
        'export const b = `color: rgb(0 0 0)`;',
        'export const c = `border: 1px solid #ddd`;',
        "export const d = 'var(--gray-11)';",
        // Fine: a token, anchors and ids that are not a whole hex string.
        "export const e = 'var(--cp-text-primary)';",
        "export const f = '#add-expense';",
        "export const g = '#feedback';",
    ].join('\n');

    test.each([
        ['src/components/A.tsx', Array(4).fill('no-raw-colors')],
        ['src/components/A.test.tsx', Array(4).fill('no-raw-colors')],
        ['vite.config.ts', Array(4).fill('no-raw-colors')],
        // The token package holds the raw values.
        ['packages/tokens/src/theme.ts', []],
    ])('%s reports exactly %j', async (file, ids) => {
        expect(await lintIds(colors, file)).toEqual(ids);
    });

    test('the message says where the colors come from', async () => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText("export const a = '#fff';", {
            filePath: 'src/A.ts',
        });

        expect(result.messages[0].message).toBe(
            '[no-raw-colors] use var(--cp-*) from @chipin/tokens',
        );
    });

    test('style objects take only custom properties', async () => {
        const source = [
            'export const A = () => <div style={{ width: 1, maxWidth: 2 }} />;',
            "export const B = () => <div style={{ '--cover-url': url }} />;",
            'export const C = () => <div style={STYLE} />;',
            "export const D = () => <div style={{ 'maxWidth': 2 }} />;",
        ].join('\n');

        expect(await lintIds(source, 'src/components/A.tsx')).toEqual([
            'inline-style',
            'inline-style',
            'inline-style',
        ]);
    });
});

describe('prop-color-roles (#1007): Radix color props take PROP_COLOR roles', () => {
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
            ...reactSyntax(),
        ]),
    ];
    const lintIds = async (source, file) => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText(source, { filePath: file });

        return result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]);
    };
    const source = [
        'export const A = () => <Text color="tomato" />;',
        "export const B = ({ on }) => <Text color={on ? 'green' : 'gray'} />;",
        'export const C = () => <EmptyState iconColor="cyan" />;',
        // Fine: a role, a value from data (the category palette), a CSS variable, other props.
        'export const D = () => <Text color={PROP_COLOR.danger} />;',
        'export const E = ({ item }) => <Badge color={item.color} variant="soft" />;',
        'export const F = () => <SearchIcon color="var(--cp-text-muted)" />;',
        'export const G = ({ on }) => <Badge color={on ? PROP_COLOR.accent : PROP_COLOR.neutral} />;',
    ].join('\n');
    const RULE = Array(4).fill('prop-color-roles');

    test.each([
        ['src/components/A.tsx', RULE],
        ['src/components/A.test.tsx', RULE],
        // Only the app sources: config, scripts and packages are not checked.
        ['scripts/a.tsx', []],
    ])('%s reports exactly %j', async (file, ids) => {
        expect(await lintIds(source, file)).toEqual(ids);
    });

    test.each([
        // JSX attribute values.
        ["<Text color={'red'} />", 1],
        ["<Text color={x ?? 'gray'} />", 1],
        ["<Text color={'red' as const} />", 1],
        ['<Text color={`red`} />', 1],
        // An object field, also asserted, conditional or a template literal.
        ["const item = { color: 'red' as const };", 1],
        ["const item = { iconColor: on ? 'green' : 'violet' };", 2],
        ['const item = { color: `tomato` };', 1],
        // A default parameter.
        ["const Avatar = ({ color = 'mint' }) => color;", 1],
        // A variable, a reassignment and a `get<X>Color` helper.
        ["const activeColor = isSolo ? 'violet' : 'green';", 2],
        ["let amountColor; amountColor = 'red';", 1],
        ["const getIconColor = on => (on ? 'green' : 'red');", 2],
        // TS types: a property signature (with a union) and a `<X>Color` type alias.
        ["interface P { color: 'green' | 'red'; }", 2],
        ["type ShareColor = 'gray' | 'jade';", 2],
        // Fine: roles, non-palette strings, a palette name outside a color context.
        ['const item = { color: PROP_COLOR.danger };', 0],
        ['const activeColor = isSolo ? PROP_COLOR.solo : PROP_COLOR.accent;', 0],
        ["const item = { variant: 'soft', tone: 'red' };", 0],
        ["const direction = 'owed'; const textColor = direction === 'owed' ? x : y;", 0],
        ["interface P { color: (typeof PROP_COLOR)['debtOwed']; }", 0],
    ])('%s reports %i', async (code, count) => {
        expect(await lintIds(code, 'src/components/A.tsx')).toEqual(
            Array(count).fill('prop-color-roles'),
        );
    });

    test('only the category palette file may hold palette names (its ignore glob)', async () => {
        const categoryUi =
            "export const CATEGORY_UI = { food: { icon: 'utensils', color: 'teal' } };";

        expect(await lintIds(categoryUi, 'src/constants/category-ui.ts')).toEqual([]);
        expect(await lintIds(categoryUi, 'src/constants/other-ui.ts')).toEqual([
            'prop-color-roles',
        ]);
    });

    test('the message names the fix and the site `.astro` files are not checked', async () => {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
        const [result] = await eslint.lintText('export const A = () => <Text color="red" />;', {
            filePath: 'src/A.tsx',
        });

        expect(result.messages[0].message).toBe(
            '[prop-color-roles] A Radix color prop takes a role: `color={PROP_COLOR.danger}` from @chipin/tokens/theme, not a palette name (docs/design-system/tokens.md).',
        );
        expect(
            await resolvedIds(config, 'src/pages/a.astro', 'no-restricted-syntax'),
        ).not.toContain('prop-color-roles');
    });
});

describe('styled-components, @radix-ui/colors and svgr imports (spec 05 §3, §6) keep the other import entries', () => {
    const config = [
        {
            files: ['**/*.{ts,tsx}'],
            languageOptions: { parser: tseslint.parser },
        },
        ...restrictedImports(projectImports({ appDir: '.' })),
    ];
    const source = [
        "import styled from 'styled-components';",
        "import 'styled-components/macro';",
        "import { grass } from '@radix-ui/colors';",
        "import '@radix-ui/colors/grass.css';",
        "import Logo from '@chipin/tokens/assets/logo.svg?react';",
        "import Google from 'assets/google-icon.svg?react';",
        "import Other from 'assets/other.svg?react';",
        "import url from 'assets/other.svg?url';",
        "import { split } from 'shared/money/split';",
        'export { Google, grass, Logo, Other, split, styled, url };',
    ].join('\n');

    // styled-components was removed (#901): no allowlist, the import is reported in every file.
    test.each(['src/components/New.tsx', 'src/a/styled.ts', 'src/b/B.test.tsx'])(
        '%s reports styled-components and the other entries',
        async file => {
            const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });
            const [result] = await eslint.lintText(source, { filePath: file });

            expect(
                result.messages.map(message => message.message.match(/\[([a-z0-9-]+)\]/)?.[1]),
            ).toEqual([
                'styled-components',
                'styled-components',
                'radix-colors',
                'radix-colors',
                'svgr-react',
                'money-deep-import',
            ]);
        },
    );

    test('the styled-components entry is a plain ban without ignores', () => {
        const entry = projectImports().find(({ id }) => id === 'styled-components');

        expect(entry).toMatchObject({ pattern: { regex: '^styled-components(?:/|$)' } });
        expect(entry.files).toBeUndefined();
        expect(entry.ignores).toBeUndefined();
    });
});
