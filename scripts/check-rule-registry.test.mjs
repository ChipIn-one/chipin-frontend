import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { describe, expect, test } from 'vitest';

import { checkRegistry, entryMessages, main, REGISTRY_PATH } from './check-rule-registry.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const SPEC_PATH = 'docs/superpowers/specs/2026-10-28-frontend-refactor/02-rulebook-tooling.md';

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

    test('the repository ESLint config passes', async () => {
        expect(await main()).toEqual([]);
    });
});

// Rules of the presets that spec 02 §D0 registers as one row (class b).
const presetRules = new Set([
    ...Object.keys(js.configs.recommended.rules),
    ...tseslint.configs.recommended.flatMap(config => Object.keys(config.rules ?? {})),
    ...Object.keys(reactHooks.configs.recommended.rules),
]);

// Backticked rule tokens of the §D0 registry tables with the class of their row.
const specRegistry = () => {
    const spec = readFileSync(resolve(repoRoot, SPEC_PATH), 'utf8');
    const section = spec.slice(spec.indexOf('## Д0'), spec.indexOf('## Контекст'));
    const rows = section
        .split('\n')
        .filter(line => line.startsWith('|') && !line.includes('~~'))
        .map(line => line.split('|').map(cell => cell.trim()));

    return rows.flatMap(([, rule = '', cls = '']) =>
        [...rule.matchAll(/`([^`]+)`/g)].map(([, token]) => ({ token, cls })),
    );
};

describe('rule-classes.json matches the spec 02 §D0 registry', () => {
    const registry = JSON.parse(readFileSync(resolve(repoRoot, REGISTRY_PATH), 'utf8'));
    const tokens = specRegistry();

    test.each(Object.entries(registry))('%s is registered with class %s', (key, cls) => {
        const rule = key.split('#')[0];
        const rows = tokens.filter(
            ({ token }) =>
                token === rule || token.startsWith(`${rule}:`) || token.startsWith(`${rule} `),
        );

        if (rows.length > 0) {
            expect(rows.map(row => row.cls)).toContain(cls);
        } else {
            expect(presetRules.has(rule) && cls).toBe('b');
        }
    });
});
