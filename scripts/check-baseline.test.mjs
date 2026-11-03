import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { findBaselineGrowth, main, parseBase, resolveBase } from './check-baseline.mjs';

const SHA = 'a'.repeat(40);
const entry = count => ({ count });

describe('check-baseline growth', () => {
    const registry = { 'no-debugger': 'b' };

    test('passes a new key for a rule this change adds to the registry', () => {
        expect(
            findBaselineGrowth({
                base: {},
                head: { 'src/a.ts': { 'no-alert': entry(3) } },
                baseRegistry: registry,
                headRegistry: { ...registry, 'no-alert': 'b' },
            }),
        ).toEqual([]);
    });

    test('fails when the count of an existing key grows', () => {
        expect(
            findBaselineGrowth({
                base: { 'src/a.ts': { 'no-debugger': entry(1) } },
                head: { 'src/a.ts': { 'no-debugger': entry(2) } },
                baseRegistry: registry,
                headRegistry: registry,
                file: 'eslint-suppressions.json',
            }),
        ).toEqual(['eslint-suppressions.json: src/a.ts no-debugger 1 -> 2']);
    });

    test('fails on a new key for a rule that is already registered', () => {
        expect(
            findBaselineGrowth({
                base: {},
                head: { 'src/b.ts': { 'no-debugger': entry(1) } },
                baseRegistry: registry,
                headRegistry: registry,
            }),
        ).toHaveLength(1);
    });

    test('fails when a junk id is added for an already registered rule', () => {
        expect(
            findBaselineGrowth({
                base: {},
                head: { 'src/ui/a.tsx': { 'no-restricted-imports': entry(1) } },
                baseRegistry: { 'no-restricted-imports#axios-in-ui': 'b' },
                headRegistry: {
                    'no-restricted-imports#axios-in-ui': 'b',
                    'no-restricted-imports#junk': 'b',
                },
            }),
        ).toHaveLength(1);
    });

    test('passes suppressions of a selector rule registered for the first time', () => {
        expect(
            findBaselineGrowth({
                base: {},
                head: { 'src/a.ts': { 'no-restricted-syntax': entry(29) } },
                baseRegistry: registry,
                headRegistry: { ...registry, 'no-restricted-syntax#money-number': 'b' },
            }),
        ).toEqual([]);
    });

    test.each([[-1], [1.5], ['2'], [null], [undefined]])(
        'fails on an invalid count %s at base or head',
        count => {
            const bad = { 'src/a.ts': { 'no-debugger': { count } } };
            const good = { 'src/a.ts': { 'no-debugger': entry(1) } };
            const args = { baseRegistry: registry, headRegistry: registry, file: 'f.json' };
            const message = side => [`f.json: src/a.ts no-debugger has invalid count at ${side}`];

            expect(findBaselineGrowth({ ...args, base: bad, head: good })).toEqual(message('base'));
            expect(findBaselineGrowth({ ...args, base: good, head: bad })).toEqual(message('head'));
        },
    );

    test('passes when the baseline shrinks', () => {
        expect(
            findBaselineGrowth({
                base: { 'src/a.ts': { 'no-debugger': entry(2) } },
                head: { 'src/a.ts': { 'no-debugger': entry(1) } },
                baseRegistry: registry,
                headRegistry: registry,
            }),
        ).toEqual([]);
    });
});

describe('check-baseline base resolution', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('parses --base in both forms', () => {
        expect(parseBase(['--base', SHA])).toBe(SHA);
        expect(parseBase([`--base=${SHA}`])).toBe(SHA);
        expect(parseBase(['--base'])).toBe('');
        expect(parseBase([])).toBeUndefined();
    });

    test('fails closed on an empty or non-SHA base in a CI pull_request', () => {
        const env = { CI: 'true', GITHUB_EVENT_NAME: 'pull_request' };

        expect(resolveBase('', env).exit).toBe(1);
        expect(resolveBase(undefined, env).exit).toBe(1);
        expect(resolveBase('master', env).exit).toBe(1);
        expect(resolveBase('0'.repeat(40), env).exit).toBe(1);
        expect(resolveBase(SHA, env)).toEqual({ base: SHA });
    });

    test('skips with a notice on a CI push without a base', () => {
        expect(resolveBase('', { CI: 'true', GITHUB_EVENT_NAME: 'push' })).toMatchObject({
            exit: 0,
            message: expect.stringContaining('::notice::'),
        });
    });

    test('main exits 1 on a well-formed SHA that is not an available commit', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(
            main(['--base', `${'0'.repeat(39)}1`], {
                CI: 'true',
                GITHUB_EVENT_NAME: 'pull_request',
            }),
        ).toBe(1);
    });

    test('main exits 1 on an empty base in a CI pull_request', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(main(['--base', ''], { CI: 'true', GITHUB_EVENT_NAME: 'pull_request' })).toBe(1);
    });
});

describe('ESLint native suppressions', () => {
    const eslintBin = resolve(import.meta.dirname, '../node_modules/eslint/bin/eslint.js');
    let dir;

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    const lintWithSuppressions = count => {
        dir = mkdtempSync(join(tmpdir(), 'chipin-suppressions-'));
        writeFileSync(
            join(dir, 'eslint.config.mjs'),
            "export default [{ rules: { 'no-debugger': 'error' } }];\n",
        );
        writeFileSync(join(dir, 'a.js'), 'debugger;\ndebugger;\n');
        writeFileSync(
            join(dir, 'eslint-suppressions.json'),
            JSON.stringify({ 'a.js': { 'no-debugger': { count } } }),
        );

        return spawnSync(process.execPath, [eslintBin, 'a.js'], { cwd: dir, encoding: 'utf8' });
    };

    test('a second violation in a file with one suppressed entry fails eslint', () => {
        expect(lintWithSuppressions(1).status).toBe(1);
    });

    test('violations within the suppressed count pass', () => {
        expect(lintWithSuppressions(2).status).toBe(0);
    });
});
