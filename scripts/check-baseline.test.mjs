import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { findBaselineGrowth, main, messageId, parseBase, resolveBase } from './check-baseline.mjs';

const SHA = 'a'.repeat(40);
const entry = count => ({ count });

describe('check-baseline growth', () => {
    const registry = { 'no-debugger': 'b' };

    test('passes a new key for a rule this change adds to the registry', async () => {
        expect(
            await findBaselineGrowth({
                base: {},
                head: { 'src/a.ts': { 'no-alert': entry(3) } },
                baseRegistry: registry,
                headRegistry: { ...registry, 'no-alert': 'b' },
            }),
        ).toEqual([]);
    });

    test('fails when the count of an existing key grows', async () => {
        expect(
            await findBaselineGrowth({
                base: { 'src/a.ts': { 'no-debugger': entry(1) } },
                head: { 'src/a.ts': { 'no-debugger': entry(2) } },
                baseRegistry: registry,
                headRegistry: registry,
                file: 'eslint-suppressions.json',
            }),
        ).toEqual(['eslint-suppressions.json: src/a.ts no-debugger 1 -> 2']);
    });

    test('fails on a new key for a rule that is already registered', async () => {
        expect(
            await findBaselineGrowth({
                base: {},
                head: { 'src/b.ts': { 'no-debugger': entry(1) } },
                baseRegistry: registry,
                headRegistry: registry,
            }),
        ).toHaveLength(1);
    });

    describe('a new entry id of an already registered rule (03-1 money)', () => {
        const baseRegistry = {
            'no-restricted-imports#axios-in-ui': 'b',
            'no-restricted-syntax#i18n-attributes': 'b',
        };
        const headRegistry = { ...baseRegistry, 'no-restricted-syntax#money-to-fixed': 'b' };
        const counter = newIdMessages => {
            const calls = [];
            const count = async (path, rule, ids) => {
                calls.push([path, rule, [...ids]]);
                return newIdMessages;
            };

            return { calls, count };
        };

        test('passes growth up to the messages of the new id', async () => {
            const { calls, count } = counter(3);

            expect(
                await findBaselineGrowth({
                    base: { 'src/a.ts': { 'no-restricted-syntax': entry(1) } },
                    head: { 'src/a.ts': { 'no-restricted-syntax': entry(4) } },
                    baseRegistry,
                    headRegistry,
                    countNewIdMessages: count,
                }),
            ).toEqual([]);
            expect(calls).toEqual([['src/a.ts', 'no-restricted-syntax', ['money-to-fixed']]]);
        });

        test('fails growth that comes from an old id of the same rule', async () => {
            // 3 new suppressions, only 1 message carries the new id: 2 are old-entry violations.
            expect(
                await findBaselineGrowth({
                    base: {},
                    head: { 'src/a.tsx': { 'no-restricted-syntax': entry(3) } },
                    baseRegistry,
                    headRegistry,
                    countNewIdMessages: counter(1).count,
                    file: 'eslint-suppressions.json',
                }),
            ).toEqual([
                'eslint-suppressions.json: src/a.tsx no-restricted-syntax 0 -> 3 (new entries money-to-fixed allow 1)',
            ]);
        });

        test('fails growth of a registered selector rule when no entry id is added', async () => {
            const { calls, count } = counter(5);

            expect(
                await findBaselineGrowth({
                    base: {},
                    head: { 'src/ui/a.tsx': { 'no-restricted-imports': entry(1) } },
                    baseRegistry,
                    headRegistry: baseRegistry,
                    countNewIdMessages: count,
                }),
            ).toHaveLength(1);
            expect(calls).toEqual([]);
        });

        test('a new id of one rule does not open another rule', async () => {
            const { calls, count } = counter(5);

            expect(
                await findBaselineGrowth({
                    base: {},
                    head: { 'src/ui/a.tsx': { 'no-restricted-imports': entry(1) } },
                    baseRegistry,
                    headRegistry,
                    countNewIdMessages: count,
                }),
            ).toHaveLength(1);
            expect(calls).toEqual([]);
        });
    });

    test.each([
        ['[money-to-fixed] Money: use formatMoney.', 'money-to-fixed'],
        [
            "'shared/money/split' import is restricted from being used by a pattern. [money-deep-import] Import from shared/money only.",
            'money-deep-import',
        ],
        ['Unexpected debugger statement.', undefined],
    ])('messageId(%j) → %s', (message, id) => {
        expect(messageId(message)).toBe(id);
    });

    test('passes suppressions of a selector rule registered for the first time', async () => {
        expect(
            await findBaselineGrowth({
                base: {},
                head: { 'src/a.ts': { 'no-restricted-syntax': entry(29) } },
                baseRegistry: registry,
                headRegistry: { ...registry, 'no-restricted-syntax#money-number': 'b' },
            }),
        ).toEqual([]);
    });

    test.each([[-1], [1.5], ['2'], [null], [undefined]])(
        'fails on an invalid count %s at base or head',
        async count => {
            const bad = { 'src/a.ts': { 'no-debugger': { count } } };
            const good = { 'src/a.ts': { 'no-debugger': entry(1) } };
            const args = { baseRegistry: registry, headRegistry: registry, file: 'f.json' };
            const message = side => [`f.json: src/a.ts no-debugger has invalid count at ${side}`];

            expect(await findBaselineGrowth({ ...args, base: bad, head: good })).toEqual(
                message('base'),
            );
            expect(await findBaselineGrowth({ ...args, base: good, head: bad })).toEqual(
                message('head'),
            );
        },
    );

    test('passes when the baseline shrinks', async () => {
        expect(
            await findBaselineGrowth({
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

    test('main exits 1 on a well-formed SHA that is not an available commit', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(
            await main(['--base', `${'0'.repeat(39)}1`], {
                CI: 'true',
                GITHUB_EVENT_NAME: 'pull_request',
            }),
        ).toBe(1);
    });

    test('main exits 1 on an empty base in a CI pull_request', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(await main(['--base', ''], { CI: 'true', GITHUB_EVENT_NAME: 'pull_request' })).toBe(
            1,
        );
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
