import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, test } from 'vitest';

import {
    PENDING_IDS,
    projectImports,
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
        // Not money fields or not a direct operand: not reported.
        '    Number(row.count),',
        '    row.amount.length > 0,',
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
