import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { afterEach, describe, expect, test } from 'vitest';

import {
    checkRegistry,
    collectModes,
    entryMessages,
    main,
    modeEnv,
    REGISTRY_PATH,
    RESULT_MARKER,
    resolveMode,
} from './check-rule-registry.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const SPEC_PATH = 'docs/superpowers/specs/2026-10-28-frontend-refactor/02-rulebook-tooling.md';

// Temporary directories of the child-process tests, removed after each test.
const tempDirs = [];
const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-rule-registry-'));

    tempDirs.push(dir);
    return dir;
};

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

const check = (registry, rules, blocks = []) =>
    checkRegistry({ registry, resolved: [{ file: 'src/a.tsx', rules }], blocks });

describe('check-rule-registry', () => {
    test('passes registered a/b rules and ignores rules that are off', () => {
        expect(
            check(
                { curly: 'a', 'no-debugger': 'b' },
                { curly: ['error', 'all'], 'no-debugger': 2, x: 'off' },
            ),
        ).toEqual([]);
    });

    test('fails on an enabled rule without an entry', () => {
        expect(check({}, { 'no-debugger': 'error' })).toEqual([
            `no-debugger (src/a.tsx) has no entry in ${REGISTRY_PATH}`,
        ]);
    });

    test('fails on class c and on the warn level', () => {
        expect(check({ 'no-nested-ternary': 'c' }, { 'no-nested-ternary': 'error' })).toEqual([
            'no-nested-ternary: class "c" is not allowed (only a or b; class c is deleted)',
        ]);
        expect(check({ 'no-debugger': 'b' }, { 'no-debugger': 'warn' })).toHaveLength(1);
    });

    test('checks the effective rules of every linted file', () => {
        const resolved = [
            { file: 'src/a.tsx', rules: { curly: 2 } },
            { file: 'scripts/b.js', rules: { 'no-alert': 'warn', 'no-debugger': 2 } },
        ];

        expect(
            checkRegistry({ registry: { curly: 'a', 'no-alert': 'b' }, resolved, blocks: [] }),
        ).toEqual([
            'no-alert is "warn" in scripts/b.js: use error or off',
            `no-debugger (scripts/b.js) has no entry in ${REGISTRY_PATH}`,
        ]);
    });

    test('fails on a key that a raw block enables but a later block turns off for every file', () => {
        const blocks = [{ rules: { 'no-undef': 'error' } }, { rules: { 'no-undef': 'off' } }];

        expect(
            check({ curly: 'a', 'no-undef': 'b' }, { curly: 2, 'no-undef': 'off' }, blocks),
        ).toEqual([`no-undef in ${REGISTRY_PATH} is not effective on any linted file`]);
    });

    test('fails on registry keys that are not effective on any linted file', () => {
        expect(check({ curly: 'a', 'no-restricted-imports#junk': 'b' }, { curly: 2 })).toEqual([
            `no-restricted-imports#junk in ${REGISTRY_PATH} is not effective on any linted file`,
        ]);
    });

    test('reads restricted-entry ids from nested config arrays', () => {
        const blocks = [
            [
                [
                    {
                        rules: {
                            'no-restricted-syntax': ['error', { selector: 'X', message: '[n] m' }],
                        },
                    },
                ],
            ],
        ];

        expect(check({}, {}, blocks)).toEqual([
            `no-restricted-syntax#n (block (unnamed)) has no entry in ${REGISTRY_PATH}`,
        ]);
    });

    test('passes a registered restricted entry scoped to a glob that matches no file yet', () => {
        const money = ['error', { selector: 'X', message: '[money] Use the money helpers.' }];
        const block = { name: 'money', rules: { 'no-restricted-syntax': money } };
        const registry = { curly: 'a', 'no-restricted-syntax#money': 'b' };

        expect(
            check(registry, { curly: 2 }, [{ ...block, pending: ['no-restricted-syntax#money'] }]),
        ).toEqual([]);
    });

    test('fails on a pending restricted entry that is already effective on a linted file', () => {
        const money = ['error', { selector: 'X', message: '[money] Use the money helpers.' }];
        const block = { name: 'money', rules: { 'no-restricted-syntax': money } };
        const registry = { 'no-restricted-syntax#money': 'b' };
        const pending = [{ ...block, pending: ['no-restricted-syntax#money'] }];

        expect(check(registry, { 'no-restricted-syntax': money }, pending)).toEqual([
            'no-restricted-syntax#money is effective; remove `pending: true`',
        ]);
    });

    test('matches pending keys by rule and id, not by the bare id', () => {
        const entry = ['error', { selector: 'X', message: '[money] Use the money helpers.' }];
        const block = { name: 'money', rules: { 'no-restricted-syntax': entry } };
        const registry = { curly: 'a', 'no-restricted-syntax#money': 'b' };
        // The same id under another rule does not mark this entry pending.
        const blocks = [{ ...block, pending: ['no-restricted-imports#money'] }];

        expect(check(registry, { curly: 2 }, blocks)).toEqual([
            `no-restricted-syntax#money in ${REGISTRY_PATH} is not effective on any linted file`,
        ]);
    });

    test('fails on an unmarked restricted entry whose glob matches no linted file', () => {
        const money = ['error', { selector: 'X', message: '[money] Use the money helpers.' }];
        const blocks = [{ name: 'money', rules: { 'no-restricted-syntax': money } }];

        expect(
            check({ curly: 'a', 'no-restricted-syntax#money': 'b' }, { curly: 2 }, blocks),
        ).toEqual([
            `no-restricted-syntax#money in ${REGISTRY_PATH} is not effective on any linted file`,
        ]);
    });

    test('fails on the warn level of a restricted rule in a raw block', () => {
        const blocks = [
            {
                name: 'scoped',
                rules: { 'no-restricted-syntax': ['warn', { selector: 'X', message: '[x] m' }] },
                pending: ['no-restricted-syntax#x'],
            },
        ];

        expect(check({ 'no-restricted-syntax#x': 'b' }, {}, blocks)).toEqual([
            'no-restricted-syntax is "warn" in block scoped: use error or off',
        ]);
    });

    test('checks rules of both lint modes: a full-only rule is required and not dead', async () => {
        const load = async mode => ({
            resolved: [
                {
                    file: 'src/a.tsx',
                    rules:
                        mode.CHIPIN_ESLINT_FULL === '1'
                            ? { curly: 2, 'no-cycle': 2 }
                            : { curly: 2 },
                },
            ],
            blocks: [],
        });
        const { resolved, blocks } = await collectModes(load);

        expect(
            checkRegistry({ registry: { curly: 'a', 'no-cycle': 'b' }, resolved, blocks }),
        ).toEqual([]);
        expect(checkRegistry({ registry: { curly: 'a' }, resolved, blocks })).toEqual([
            `no-cycle (src/a.tsx) has no entry in ${REGISTRY_PATH}`,
        ]);
    });

    test('resolves each lint mode in a child process with its own env', async () => {
        // A stand-in for `check-rule-registry.mjs --resolve`: it reads the mode flag and prints
        // noise before the marked result, as a config module with a console.log would.
        const dir = makeTempDir();
        const script = join(dir, 'resolve.mjs');

        writeFileSync(
            script,
            `const full = process.env.CHIPIN_ESLINT_FULL === '1';
console.log('config noise');
const rules = full ? { curly: 2, 'no-cycle': 2 } : { curly: 2 };
process.stdout.write(${JSON.stringify(RESULT_MARKER)} + JSON.stringify({
    resolved: [{ file: 'src/a.tsx', rules }],
    blocks: [{ rules: {}, pending: [], test: process.env.NODE_ENV ?? null }],
}));
`,
        );
        const { resolved, blocks } = await collectModes(mode => resolveMode(mode, script));

        expect(resolved.map(entry => entry.rules)).toEqual([
            { curly: 2 },
            { curly: 2, 'no-cycle': 2 },
        ]);
        expect(blocks.map(block => block.test)).toEqual([null, null]);
    });

    test('names the mode and the start of stdout when the child result cannot be read', async () => {
        const dir = makeTempDir();
        const script = join(dir, 'resolve.mjs');

        writeFileSync(script, "console.log('config noise');\n");

        await expect(resolveMode({ CHIPIN_ESLINT_FULL: '1' }, script)).rejects.toThrow(
            'Cannot read the rule resolution for mode {"CHIPIN_ESLINT_FULL":"1"}: result marker ' +
                'not found; stdout starts with: "config noise\\n"',
        );
    });

    test('names the mode when the child process exits with an error', async () => {
        const dir = makeTempDir();
        const script = join(dir, 'resolve.mjs');

        writeFileSync(script, "throw new Error('config broke');\n");

        await expect(resolveMode({ CHIPIN_ESLINT_FULL: '1' }, script)).rejects.toThrow(
            /^Rule resolution failed for mode \{"CHIPIN_ESLINT_FULL":"1"\}: Command failed: .*config broke/s,
        );
    });

    test('sets CHIPIN_ESLINT_FULL only for the full lint mode and never CHIPIN_ESLINT_FAST', () => {
        const base = {
            PATH: '/bin',
            CHIPIN_ESLINT_FULL: '1',
            CHIPIN_ESLINT_FAST: '1',
            NODE_ENV: 'test',
            VITEST: 'true',
            VITEST_POOL_ID: '1',
        };

        expect(modeEnv({}, base)).toEqual({ PATH: '/bin' });
        expect(modeEnv({ CHIPIN_ESLINT_FULL: '1' }, { PATH: '/bin' })).toEqual({
            PATH: '/bin',
            CHIPIN_ESLINT_FULL: '1',
        });
    });

    test('fails when a sample file gets no config', () => {
        expect(
            checkRegistry({
                registry: {},
                resolved: [{ file: 'src/a.tsx', rules: {} }],
                blocks: [],
                samples: ['src/gone.tsx'],
            }),
        ).toEqual(['sample file src/gone.tsx is missing, ignored or gets no ESLint config']);
    });

    test('registers restricted-syntax/imports entries by their [id] message prefix', () => {
        const syntax = ['error', { selector: 'X', message: '[no-x] Use Y.' }];
        const imports = [
            'error',
            { paths: [{ name: 'axios', message: '[axios] Use src/api.' }], patterns: [] },
        ];

        expect(
            check(
                { 'no-restricted-syntax#no-x': 'b', 'no-restricted-imports#axios': 'b' },
                { 'no-restricted-syntax': syntax, 'no-restricted-imports': imports },
            ),
        ).toEqual([]);
        expect(check({}, { 'no-restricted-syntax': ['error', 'WithStatement'] })).toHaveLength(1);
        expect(
            check({}, {}, [{ name: 'scoped', rules: { 'no-restricted-syntax': syntax } }]),
        ).toEqual([`no-restricted-syntax#no-x (block scoped) has no entry in ${REGISTRY_PATH}`]);
    });

    test('reads messages from every restricted-imports option shape', () => {
        expect(
            entryMessages('no-restricted-imports', [
                'error',
                'lodash',
                { name: 'axios', message: '[a] m' },
                { paths: ['x', { name: 'y', message: '[b] m' }], patterns: [{ group: ['z'] }] },
            ]),
        ).toEqual([undefined, '[a] m', undefined, '[b] m', undefined]);
    });

    // Resolves the whole repository once per lint mode, each in a child process.
    test('the repository ESLint config passes', { timeout: 60_000 }, async () => {
        expect(await main()).toEqual([]);
    });
});

// Rules of the presets that spec 02 §D0 registers as one row (class b).
const presetRules = new Set([
    ...Object.keys(js.configs.recommended.rules),
    ...tseslint.configs.recommended.flatMap(config => Object.keys(config.rules ?? {})),
    ...Object.keys(reactHooks.configs.recommended.rules),
    ...pluginQuery.configs['flat/recommended'].flatMap(config => Object.keys(config.rules ?? {})),
]);

// Backticked rule tokens of the §D0 registry tables with the class of their row.
// The §D0 row of the six jsx-a11y rules; only it registers their bare names.
const A11Y_ROW = /^jsx-a11y —/;

const registryTokens = section => {
    const rows = section
        .split('\n')
        .filter(line => line.startsWith('|') && !line.includes('~~'))
        .map(line => line.split('|').map(cell => cell.trim()));

    return rows.flatMap(([, rule = '', cls = '']) =>
        [...rule.matchAll(/`([^`]+)`/g)].flatMap(([, token]) => {
            if (!token.endsWith('-*')) {
                return [{ token, cls, a11yRow: A11Y_ROW.test(rule) }];
            }
            // A family row lists its members in parentheses: `no-unsafe-*` (assignment, …; tests off).
            // Members are typescript-eslint rules.
            const members = rule.match(/\(([^;)]*)/)?.[1].split(',') ?? [];

            return members.map(member => ({
                token: `@typescript-eslint/${token.slice(0, -1)}${member.trim()}`,
                cls,
                family: true,
            }));
        }),
    );
};

const specRegistry = () => {
    const spec = readFileSync(resolve(repoRoot, SPEC_PATH), 'utf8');

    return registryTokens(spec.slice(spec.indexOf('## D0'), spec.indexOf('## Context')));
};

// Rows of the §D0 tables that register `rule`. The tables name typescript-eslint and jsx-a11y
// rules without the plugin prefix; family members are expanded to full names by `specRegistry`
// and match only the full `@typescript-eslint/` name, never an unprefixed (core) rule of the same
// name. A bare jsx-a11y name matches only in the jsx-a11y row.
const rowsFor = (rule, tokens) => {
    const a11y = rule.startsWith('jsx-a11y/');
    const bare = rule.replace(/^(?:@typescript-eslint|jsx-a11y)\//, '');

    return tokens.filter(({ token, family, a11yRow }) => {
        const names = a11y && !a11yRow ? [rule] : [rule, bare];

        return family
            ? token === rule
            : names.some(
                  name =>
                      token === name ||
                      token.startsWith(`${name}:`) ||
                      token.startsWith(`${name} `),
              );
    });
};

describe('rule-classes.json matches the spec 02 §D0 registry', () => {
    const registry = JSON.parse(readFileSync(resolve(repoRoot, REGISTRY_PATH), 'utf8'));
    const tokens = specRegistry();

    test.each(Object.entries(registry))('%s is registered with class %s', (key, cls) => {
        const rule = key.split('#')[0];
        const rows = rowsFor(rule, tokens);

        if (rows.length > 0) {
            expect(rows.map(row => row.cls)).toContain(cls);
        } else {
            expect(presetRules.has(rule) && cls).toBe('b');
        }
    });

    test('the no-unsafe-* row covers only its listed typescript-eslint members', () => {
        expect(rowsFor('@typescript-eslint/no-unsafe-call', tokens).map(row => row.cls)).toEqual([
            'b',
        ]);
        expect(rowsFor('@typescript-eslint/no-unsafe-type-assertion', tokens)).toEqual([]);
        expect(rowsFor('no-unsafe-finally', tokens)).toEqual([]);
        // A hypothetical core rule with a family member's unprefixed name is not covered.
        expect(rowsFor('no-unsafe-call', tokens)).toEqual([]);
    });

    test('the jsx-a11y row covers only its six rules', () => {
        expect(rowsFor('jsx-a11y/alt-text', tokens).map(row => row.cls)).toEqual(['b']);
        expect(rowsFor('jsx-a11y/no-static-element-interactions', tokens)).toHaveLength(1);
        expect(rowsFor('jsx-a11y/no-autofocus', tokens)).toEqual([]);
    });

    test('a bare jsx-a11y rule name outside the jsx-a11y row registers nothing', () => {
        const fake = registryTokens('| `alt-text` | a | not the jsx-a11y row |');

        expect(rowsFor('jsx-a11y/alt-text', fake)).toEqual([]);
        expect(rowsFor('alt-text', fake).map(row => row.cls)).toEqual(['a']);
    });
});
