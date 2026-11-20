import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

import { isDocsOnlyChange, resolveCiGateMode } from './ci-gate-policy.mjs';
import { GATE_JOB_NAME, GATE_PASSED_STEP, GATE_STEPS } from './ci-gate-reuse.mjs';

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
            'docs/superpowers/specs/2026-10-28-frontend-refactor/02-rulebook-tooling.md',
            'docs/superpowers/specs/any/other.md',
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

    describe('workspace modes (spec 04 §1.4)', () => {
        const mode = changedFiles =>
            resolveCiGateMode({ workflow: 'frontend-ci', targetBranch: 'master', changedFiles });

        test('only apps/app changes give app', () => {
            expect(mode(['apps/app/src/main.tsx', 'apps/app/package.json'])).toBe('app');
        });

        test('only apps/site changes give site', () => {
            expect(mode(['apps/site/src/pages/index.astro', 'apps/site/package.json'])).toBe(
                'site',
            );
        });

        test('app and site together give full', () => {
            expect(mode(['apps/app/src/main.tsx', 'apps/site/src/pages/index.astro'])).toBe('full');
        });

        test('safe docs mixed into an app or site change keep the workspace mode', () => {
            expect(mode(['apps/app/src/main.tsx', 'docs/api-notes/activity.md'])).toBe('app');
            expect(mode(['README.md', 'apps/site/src/pages/index.astro'])).toBe('site');
        });

        test('only safe docs still give docs-only', () => {
            expect(mode(['README.md', 'docs/api-notes/activity.md'])).toBe('docs-only');
        });

        test('every shared or repo-level path gives full, alone or mixed with a workspace', () => {
            for (const path of [
                'packages/tokens/tokens.css',
                'packages/i18n-content/src/locales.ts',
                'package-lock.json',
                'package.json',
                'tsconfig.base.json',
                'eslint.config.js',
                'config/eslint/app.mjs',
                'scripts/ci-gate-policy.mjs',
                '.github/workflows/frontend-ci.yml',
            ]) {
                expect(mode([path])).toBe('full');
                expect(mode(['apps/app/src/main.tsx', path])).toBe('full');
                expect(mode(['apps/site/src/pages/index.astro', path])).toBe('full');
            }
        });

        test('unclassified paths fail safe to full', () => {
            for (const path of [
                'prettier.config.js',
                'AGENTS.md',
                'docs/engineering/rules/00-foundation.md',
                'apps/other/src/main.ts',
                'apps/README.md',
                'src/main.tsx',
            ]) {
                expect(mode([path])).toBe('full');
                expect(mode(['apps/app/src/main.tsx', path])).toBe('full');
            }
        });

        test('prefix lookalikes do not count as a workspace', () => {
            for (const path of [
                'apps/application/x.ts',
                'apps/app.ts',
                'apps/appendix/x.ts',
                'apps/sites/x.ts',
                'apps/site-old/x.ts',
                'xapps/app/x.ts',
                'apps/apps/app/x.ts',
            ]) {
                expect(mode([path])).toBe('full');
            }
        });

        test('spec docs read by gate tests widen a docs or workspace change to full', () => {
            const spec =
                'docs/superpowers/specs/2026-10-28-frontend-refactor/02-rulebook-tooling.md';

            expect(mode([spec])).toBe('full');
            expect(mode(['README.md', spec])).toBe('full');
            expect(mode(['apps/site/src/pages/index.astro', spec])).toBe('full');
            expect(mode(['docs/superpowers/plans/x.md'])).toBe('docs-only');
        });

        test('an empty change list fails closed to full', () => {
            expect(mode([])).toBe('full');
        });
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

    test('an apps/app-only list written slowly gives app', async () => {
        const paths = Array.from({ length: 5000 }, (_, index) => `apps/app/src/file-${index}.ts`);
        const chunks = Array.from({ length: 10 }, (_, index) =>
            nulList(paths.slice(index * 500, (index + 1) * 500)),
        );

        expect(await runCli(chunks)).toEqual({ code: 0, stdout: 'app\n', stderr: '' });
    });

    test('a list with a repo-level file written slowly gives full', async () => {
        expect(
            await runCli([nulList(['apps/app/src/main.tsx']), nulList(['package-lock.json'])]),
        ).toEqual({ code: 0, stdout: 'full\n', stderr: '' });
    });

    test('a docs-only list written slowly gives docs-only', async () => {
        expect(
            await runCli([nulList(['README.md']), nulList(['docs/api-notes/activity.md'])]),
        ).toEqual({ code: 0, stdout: 'docs-only\n', stderr: '' });
    });
});

// The policy only picks a mode; these pin how frontend-ci.yml acts on it.
describe('frontend-ci.yml runs the gates its mode requires', () => {
    const workflow = parse(
        readFileSync(resolve(import.meta.dirname, '../.github/workflows/frontend-ci.yml'), 'utf8'),
    );
    const job = workflow.jobs['frontend-ci'];
    const step = name => {
        const matches = job.steps.filter(candidate => candidate.name === name);

        expect(matches, name).toHaveLength(1);
        return matches[0];
    };
    const APP_OR_FULL = "steps.gate.outputs.mode == 'app' || steps.gate.outputs.mode == 'full'";
    const PR_ONLY = "github.event_name == 'pull_request' && ";

    test('stays one required job named frontend-ci', () => {
        expect(job.name).toBe('frontend-ci');
        expect(Object.values(workflow.jobs).filter(other => other.name === 'frontend-ci')).toEqual([
            job,
        ]);
    });

    test('master pushes never share a concurrency group; only a new PR head or base cancels a run', () => {
        expect(workflow.concurrency).toEqual({
            group: 'frontend-ci-${{ github.event.pull_request.number || github.sha }}',
            'cancel-in-progress':
                "${{ github.event_name == 'pull_request' && ((github.event.action != 'edited' && github.event.action != 'ready_for_review') || github.event.changes.base != null) }}",
        });
    });

    test('runs on every PR event that can change the head, the base or the bodies', () => {
        expect(workflow.on.pull_request.types).toEqual([
            'opened',
            'reopened',
            'synchronize',
            'ready_for_review',
            'edited',
        ]);
        expect(workflow.permissions).toEqual({ contents: 'read', actions: 'read' });
    });

    test('the gate steps known to ci-gate-reuse.mjs follow admission in workflow order', () => {
        expect(job.name).toBe(GATE_JOB_NAME);
        const names = job.steps.map(candidate => candidate.name);
        const admission = job.steps.findIndex(candidate =>
            String(candidate.uses).startsWith(
                'ChipIn-one/.github/automation/issue-admission-action@',
            ),
        );

        expect(names.slice(admission + 1)).toEqual(GATE_STEPS);
        // The pass marker runs only after every earlier step succeeded.
        expect(step(GATE_PASSED_STEP)).not.toHaveProperty('if');
        expect(names.at(-1)).toBe(GATE_PASSED_STEP);
    });

    test('only edited and ready_for_review without a base change may reuse a passed gate', () => {
        const reuse = step('Resolve gate reuse');

        expect(reuse.id).toBe('reuse');
        expect(reuse.if).toBe(
            "github.event_name == 'pull_request' && (github.event.action == 'ready_for_review' || (github.event.action == 'edited' && !github.event.changes.base))",
        );
        expect(reuse.run).toContain('node scripts/ci-gate-reuse.mjs');
        // Without the script (a head from before #792) the gate runs in full.
        expect(reuse.run).toMatch(/else\s+echo "reuse=false" >> "\$GITHUB_OUTPUT"/u);
        expect(reuse.env).toEqual({
            GH_TOKEN: '${{ github.token }}',
            HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
        });
        expect(step('Resolve verification mode').env.REUSE).toBe(
            '${{ steps.reuse.outputs.reuse }}',
        );
        expect(step('Resolve verification mode').run).toMatch(
            /if \[\[ "\$REUSE" == true \]\]; then\s+mode="reused"/u,
        );
    });

    test('no gate can fail open through continue-on-error', () => {
        expect(job).not.toHaveProperty('continue-on-error');
        for (const candidate of job.steps) {
            expect(candidate, candidate.name).not.toHaveProperty('continue-on-error');
        }
    });

    test('admission runs once and is not gated on the mode', () => {
        const admission = job.steps.filter(candidate =>
            String(candidate.uses).startsWith(
                'ChipIn-one/.github/automation/issue-admission-action@',
            ),
        );

        expect(admission).toHaveLength(1);
        expect(String(admission[0].if)).not.toContain('steps.gate');
        expect(job.steps.indexOf(admission[0])).toBeLessThan(
            job.steps.indexOf(step('Resolve verification mode')),
        );
    });

    test('the mode step rejects an unknown mode', () => {
        // A skipped mode step leaves the mode empty, and every gate step would skip with it.
        expect(step('Resolve verification mode')).not.toHaveProperty('if');
        expect(step('Resolve verification mode').run).toMatch(
            /case "\$mode" in\s+docs-only \| app \| site \| full \| reused\) ;;\s+\*\)[\s\S]*?exit 1/u,
        );
    });

    test('npm ci runs once, for every mode but docs-only and reused', () => {
        expect(job.steps.filter(candidate => candidate.run === 'npm ci')).toHaveLength(1);
        expect(step('Install dependencies').if).toBe(
            "steps.gate.outputs.mode != 'docs-only' && steps.gate.outputs.mode != 'reused'",
        );
    });

    test('app gates run in exactly app and full mode', () => {
        expect(step('Check lint baseline does not grow').if).toBe(`${PR_ONLY}(${APP_OR_FULL})`);
        expect(step('Check file layout baseline does not grow').if).toBe(
            `${PR_ONLY}(${APP_OR_FULL})`,
        );
        expect(step('Check generated API types').if).toBe(APP_OR_FULL);
        expect(step('Verify frontend').if).toBe(APP_OR_FULL);
        expect(step('Verify frontend').run).toBe('npm run verify:full');
    });

    test('the site gate runs in exactly site and full mode and fails closed', () => {
        const site = step('Verify site');

        expect(site.if).toBe(
            "steps.gate.outputs.mode == 'site' || steps.gate.outputs.mode == 'full'",
        );
        expect(site.env).toEqual({
            MODE: '${{ steps.gate.outputs.mode }}',
            BASE_SHA: '${{ steps.gate.outputs.base_sha }}',
        });
        expect(site.run).toContain('git cat-file -e "$BASE_SHA^{commit}"');
        expect(site.run).toContain('git cat-file -e "$BASE_SHA:apps/site/package.json"');
        expect(site.run.indexOf('^{commit}')).toBeLessThan(
            site.run.indexOf(':apps/site/package.json"'),
        );
        expect(site.run).toContain('CHIPIN_ESLINT_FULL=1 npx --no-install eslint apps/site');
        expect(site.run).not.toContain('--pass-on-unpruned-suppressions');
        expect(site.run).toContain('npm run test -w @chipin/site --if-present');
    });
});

describe('pr-metadata.yml', () => {
    const workflow = parse(
        readFileSync(resolve(import.meta.dirname, '../.github/workflows/pr-metadata.yml'), 'utf8'),
    );

    test('leaves ready_for_review to the Frontend CI workflow_run', () => {
        expect(workflow.on.pull_request.types).toEqual([
            'opened',
            'reopened',
            'edited',
            'synchronize',
        ]);
        expect(workflow.on.workflow_run).toEqual({
            workflows: ['Frontend CI'],
            types: ['completed'],
        });
    });
});
