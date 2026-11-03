import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, test } from 'vitest';

const text = readFileSync('.github/workflows/release-on-production.yml', 'utf8');
const workflow = parse(text);
const { guard, release } = workflow.jobs;
const guardStep = guard.steps.find(step => step.id === 'guard');

describe('release-on-production workflow', () => {
    test('runs only for a successful vercel[bot] Production deployment, like forward-production-deployment', () => {
        expect(Object.keys(workflow.on)).toEqual(['deployment_status']);
        expect(Object.keys(workflow.jobs)).toEqual(['guard', 'release']);
        expect(guard.if).toContain("github.repository_owner == 'ChipIn-one'");
        expect(guard.if).toContain("github.event.deployment.environment == 'Production'");
        expect(guard.if).toContain("github.event.deployment_status.state == 'success'");
        expect(guard.if).toContain("github.event.deployment.creator.login == 'vercel[bot]'");
        expect(guard.if.split('&&')).toHaveLength(4);
        expect(guard.if).not.toContain('||');
    });

    test('calls the pinned org release workflow with the guarded SHA and job-level permissions', () => {
        expect(workflow.permissions).toEqual({});
        expect(guard.permissions).toEqual({ contents: 'read' });
        expect(release.needs).toBe('guard');
        expect(release.if).toBe("needs.guard.outputs.release == 'true'");
        expect(release.permissions).toEqual({ contents: 'write', 'pull-requests': 'read' });
        expect(release.concurrency).toEqual({ group: 'release-${{ github.repository }}', 'cancel-in-progress': false });
        expect(workflow.concurrency).toBeUndefined();
        expect(release.uses).toMatch(/^ChipIn-one\/\.github\/\.github\/workflows\/release\.yml@[0-9a-f]{40}$/u);
        expect(release.with).toEqual({ ref: '${{ needs.guard.outputs.sha }}', apply: true });
        expect(release.secrets).toEqual({ token: '${{ secrets.GITHUB_TOKEN }}' });
        const checkout = guard.steps.find(step => step.uses?.startsWith('actions/checkout@'));
        expect(checkout.uses).toMatch(/@[0-9a-f]{40}$/u);
        expect(checkout.with).toMatchObject({ ref: 'master', 'fetch-depth': 0, 'persist-credentials': false });
        for (const step of guard.steps) expect(step.run ?? '').not.toContain('${{');
        expect(guardStep.env).toEqual({ DEPLOYED_SHA: '${{ github.event.deployment.sha }}' });
    });
});

describe('release-on-production guard', () => {
    // Isolated from the developer's git config (tag signing, hooks, default branch).
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
    const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env }).trim();
    const repo = mkdtempSync(join(tmpdir(), 'release-guard-'));
    git(repo, 'init', '-q', '-b', 'master');
    git(repo, 'config', 'user.email', 'test@example.com');
    git(repo, 'config', 'user.name', 'test');
    const commit = name => {
        git(repo, 'commit', '-q', '--allow-empty', '-m', name);
        return git(repo, 'rev-parse', 'HEAD');
    };
    const base = commit('base');
    git(repo, 'tag', 'v1.0.8');
    const between = commit('between');
    const tagged = commit('tagged');
    git(repo, 'tag', 'v1.0.9');
    const head = commit('head');
    git(repo, 'checkout', '-q', '-b', 'feature', between);
    const feature = commit('feature');
    git(repo, 'checkout', '-q', 'master');
    git(repo, 'update-ref', 'refs/remotes/origin/master', head);

    const run = sha => {
        const output = join(repo, `output-${sha}`);
        writeFileSync(output, '');
        const result = spawnSync('bash', ['-c', guardStep.run], {
            cwd: repo,
            encoding: 'utf8',
            env: { ...env, DEPLOYED_SHA: sha, GITHUB_OUTPUT: output },
        });
        return { status: result.status, stdout: result.stdout, output: readFileSync(output, 'utf8') };
    };

    test('releases the master head ahead of the newest tag', () => {
        const result = run(head);
        expect(result.status).toBe(0);
        expect(result.output).toBe(`sha=${head}\nrelease=true\n`);
    });

    test('passes an already tagged SHA (rollback promote) to the engine, which answers ALREADY_RELEASED', () => {
        expect(run(tagged).output).toBe(`sha=${tagged}\nrelease=true\n`);
        expect(run(base).output).toBe(`sha=${base}\nrelease=true\n`);
    });

    test('skips an untagged rollback behind the newest tag with a green warning', () => {
        const result = run(between);
        expect(result.status).toBe(0);
        expect(result.output).toBe('release=false\n');
        expect(result.stdout).toContain('rollback to a commit behind the newest tag v1.0.9');
    });

    test('skips a SHA that is not on master or not in the history', () => {
        const offMaster = run(feature);
        expect(offMaster.status).toBe(0);
        expect(offMaster.output).toBe('release=false\n');
        expect(offMaster.stdout).toContain('the commit is not on master');
        const unknown = run('f'.repeat(40));
        expect(unknown.status).toBe(0);
        expect(unknown.output).toBe('release=false\n');
    });

    test('fails on a deployment SHA that is not a full commit SHA', () => {
        const result = run('master');
        expect(result.status).toBe(1);
        expect(result.output).toBe('');
    });
});
