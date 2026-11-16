import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { isDocsOnlyChange, resolveCiGateMode } from './ci-gate-policy.mjs';

describe('CI gate policy', () => {
    test('treats ordinary Markdown documentation as docs-only', () => {
        expect(
            isDocsOnlyChange([
                'README.md',
                'docs/api-notes/activity.md',
                'docs/engineering/code-review.md',
            ]),
        ).toBe(true);
    });

    test('fails closed for empty or mixed change sets', () => {
        expect(isDocsOnlyChange([])).toBe(false);
        expect(isDocsOnlyChange(['docs/api-notes/activity.md', 'src/main.tsx'])).toBe(false);
    });

    test('does not fast-path repository rules, security policy, AI context, or workflow changes', () => {
        for (const path of [
            'docs/engineering/rules/00-foundation.md',
            'docs/dependabot-security-updates.md',
            'AGENTS.md',
            '.ai/context.md',
            '.github/workflows/frontend-ci.yml',
        ]) {
            expect(isDocsOnlyChange([path])).toBe(false);
        }
    });

    test('keeps frontend-ci as the heavy gate for code changes targeting master', () => {
        expect(
            resolveCiGateMode({
                workflow: 'frontend-ci',
                targetBranch: 'master',
                changedFiles: ['src/main.tsx'],
            }),
        ).toBe('full');
    });

    test('fast-paths docs-only master events without dropping the required check', () => {
        expect(
            resolveCiGateMode({
                workflow: 'frontend-ci',
                targetBranch: 'master',
                changedFiles: ['docs/api-notes/activity.md'],
            }),
        ).toBe('docs-only');
    });

    test('rejects unsupported workflows and the retired dev/main branches', () => {
        expect(() =>
            resolveCiGateMode({
                workflow: 'main-ci',
                targetBranch: 'master',
                changedFiles: ['src/main.tsx'],
            }),
        ).toThrow('Unsupported CI workflow');
        for (const targetBranch of ['dev', 'main']) {
            expect(() =>
                resolveCiGateMode({
                    workflow: 'frontend-ci',
                    targetBranch,
                    changedFiles: ['src/main.tsx'],
                }),
            ).toThrow('Unsupported CI target branch');
        }
    });
});

// frontend-ci.yml pipes `git diff --name-only -z` into the CLI; the writer may still be running when
// the CLI starts reading, so stdin must be read as a stream (a sync read of a pipe throws EAGAIN).
describe('CLI reads the changed-file list from a pipe', () => {
    const CLI = resolve(import.meta.dirname, 'ci-gate-policy.mjs');

    const runCli = async chunks => {
        const child = spawn(process.execPath, [CLI], {
            env: {
                ...process.env,
                CHIPIN_CI_WORKFLOW: 'frontend-ci',
                CHIPIN_TARGET_BRANCH: 'master',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', chunk => (stdout += chunk));
        child.stderr.on('data', chunk => (stderr += chunk));
        const exit = new Promise(resolveExit => child.on('close', resolveExit));

        // Slow writer: the CLI starts reading before the first chunk arrives.
        for (const chunk of chunks) {
            await new Promise(resolveDelay => setTimeout(resolveDelay, 50));
            child.stdin.write(chunk);
        }
        child.stdin.end();

        return { code: await exit, stdout, stderr };
    };

    const nulList = paths => paths.map(path => `${path}\0`).join('');

    test('a large list written slowly in chunks gives full', async () => {
        const paths = Array.from({ length: 5000 }, (_, index) => `apps/app/src/file-${index}.ts`);
        const chunks = Array.from({ length: 10 }, (_, index) =>
            nulList(paths.slice(index * 500, (index + 1) * 500)),
        );

        expect(await runCli(chunks)).toEqual({ code: 0, stdout: 'full\n', stderr: '' });
    });

    test('a docs-only list written slowly gives docs-only', async () => {
        expect(
            await runCli([nulList(['README.md']), nulList(['docs/api-notes/activity.md'])]),
        ).toEqual({ code: 0, stdout: 'docs-only\n', stderr: '' });
    });
});
