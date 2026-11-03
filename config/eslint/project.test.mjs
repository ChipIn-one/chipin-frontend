import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

import { restrictedImports, restrictedSyntax } from './project.js';

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
