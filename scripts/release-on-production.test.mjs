import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { afterAll, describe, expect, test } from 'vitest';

import { appEnvironmentCondition } from './deployment-environments.mjs';

const text = readFileSync('.github/workflows/release-on-production.yml', 'utf8');
const workflow = parse(text);
const { guard, release } = workflow.jobs;
const guardStep = guard.steps.find(step => step.id === 'guard');

describe('release-on-production workflow', () => {
    test('runs only for a successful vercel[bot] status on a vercel[bot] Production deployment', () => {
        expect(Object.keys(workflow.on)).toEqual(['deployment_status']);
        expect(Object.keys(workflow.jobs)).toEqual(['guard', 'release', 'redeploy']);
        expect(guard.if).toContain("github.repository_owner == 'ChipIn-one'");
        expect(guard.if).toContain(appEnvironmentCondition('Production'));
        expect(guard.if).toContain("github.event.deployment_status.state == 'success'");
        expect(guard.if).toContain("github.event.deployment.creator.login == 'vercel[bot]'");
        expect(guard.if).toContain("github.event.deployment_status.creator.login == 'vercel[bot]'");
        expect(guard.if.split('&&')).toHaveLength(5);
        expect(guard.if).not.toContain('||');
    });

    test('calls the pinned org release workflow with the guarded SHA and job-level permissions', () => {
        expect(workflow.permissions).toEqual({});
        expect(guard.permissions).toEqual({ contents: 'read' });
        expect(release.needs).toBe('guard');
        expect(release.if).toBe("needs.guard.outputs.release == 'true'");
        expect(release.permissions).toEqual({ contents: 'write', 'pull-requests': 'read' });
        expect(release.uses).toMatch(
            /^ChipIn-one\/\.github\/\.github\/workflows\/release\.yml@[0-9a-f]{40}$/u,
        );
        expect(release.with).toEqual({ ref: '${{ needs.guard.outputs.sha }}', apply: true });
        expect(release.secrets).toEqual({ token: '${{ secrets.GITHUB_TOKEN }}' });
        const checkout = guard.steps.find(step => step.uses?.startsWith('actions/checkout@'));
        expect(checkout.uses).toMatch(/@[0-9a-f]{40}$/u);
        expect(text).toMatch(/uses: actions\/checkout@[0-9a-f]{40} # v\d+\.\d+\.\d+\n/u);
        expect(checkout.with).toMatchObject({
            ref: 'master',
            'fetch-depth': 0,
            'persist-credentials': false,
        });
        for (const step of guard.steps) expect(step.run ?? '').not.toContain('${{');
        expect(guardStep.env).toEqual({ DEPLOYED_SHA: '${{ github.event.deployment.sha }}' });
    });

    test('serializes guard and release of Production successes in one workflow-level group, never cancelled', () => {
        expect(workflow.concurrency).toEqual({
            group: `\${{ (github.repository_owner == 'ChipIn-one' && ${appEnvironmentCondition('Production')} && github.event.deployment_status.state == 'success' && github.event.deployment.creator.login == 'vercel[bot]' && github.event.deployment_status.creator.login == 'vercel[bot]') && format('release-{0}', github.repository) || format('no-release-{0}', github.run_id) }}`,
            'cancel-in-progress': false,
        });
        expect(guard.concurrency).toBeUndefined();
        expect(release.concurrency).toBeUndefined();
    });
});

// Git subprocesses must never see the caller's repository. Inside a git hook (husky pre-push runs
// verify:full) git exports GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE and friends; inherited, they make
// `git init`/`git config` act on the real repository instead of the temp one. Drop every GIT_* key,
// then isolate from the developer's git config (tag signing, hooks, default branch).
const isolatedGitEnv = (base = process.env) => ({
    ...Object.fromEntries(Object.entries(base).filter(([key]) => !/^GIT_/u.test(key))),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
});
const runGit = (env, cwd, ...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', env }).trim();
const initTestRepo = (env, repo) => {
    runGit(env, repo, 'init', '-q', '-b', 'master');
    runGit(env, repo, 'config', 'user.email', 'test@example.com');
    runGit(env, repo, 'config', 'user.name', 'test');
};

describe('release-on-production guard git isolation', () => {
    test('ignores an inherited hook GIT_DIR/GIT_WORK_TREE and configures only the temp repo', () => {
        const root = mkdtempSync(join(tmpdir(), 'release-guard-isolation-'));
        try {
            const decoy = join(root, 'decoy');
            const repo = join(root, 'repo');
            mkdirSync(decoy);
            mkdirSync(repo);
            runGit(isolatedGitEnv(), decoy, 'init', '-q', '-b', 'master');
            const decoyConfig = join(decoy, '.git', 'config');
            const before = readFileSync(decoyConfig, 'utf8');
            const hookEnv = {
                ...process.env,
                GIT_DIR: join(decoy, '.git'),
                GIT_WORK_TREE: decoy,
                GIT_INDEX_FILE: join(decoy, '.git', 'index'),
                GIT_PREFIX: '',
            };
            const env = isolatedGitEnv(hookEnv);
            expect(
                Object.keys(env)
                    .filter(key => key.startsWith('GIT_'))
                    .sort(),
            ).toEqual(['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM']);

            initTestRepo(env, repo);

            expect(readFileSync(decoyConfig, 'utf8')).toBe(before);
            expect(runGit(env, repo, 'rev-parse', '--absolute-git-dir')).toBe(
                realpathSync(join(repo, '.git')),
            );
            expect(runGit(env, repo, 'config', '--local', '--get', 'user.name')).toBe('test');
            expect(runGit(env, repo, 'config', '--local', '--get', 'core.bare')).toBe('false');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('release-on-production guard', () => {
    const env = isolatedGitEnv();
    const git = (cwd, ...args) => runGit(env, cwd, ...args);
    const repo = mkdtempSync(join(tmpdir(), 'release-guard-'));
    initTestRepo(env, repo);
    const commit = name => {
        git(repo, 'commit', '-q', '--allow-empty', '-m', name);
        return git(repo, 'rev-parse', 'HEAD');
    };
    // base v1.0.8 - between (v2.0.0-rc.1) - tagged v1.0.9 - afterNine - ten v1.0.10 (annotated) - head on master,
    // feature (vnext) off master. v1.0.10 after v1.0.9 fails a lexical tag sort; the non-semver tags must be ignored.
    const base = commit('base');
    git(repo, 'tag', 'v1.0.8');
    const between = commit('between');
    git(repo, 'tag', 'v2.0.0-rc.1');
    const tagged = commit('tagged');
    git(repo, 'tag', 'v1.0.9');
    const afterNine = commit('after nine');
    const ten = commit('ten');
    git(repo, 'tag', '-a', '-m', 'v1.0.10', 'v1.0.10');
    const head = commit('head');
    git(repo, 'checkout', '-q', '-b', 'feature', between);
    const feature = commit('feature');
    git(repo, 'tag', 'vnext');
    git(repo, 'checkout', '-q', 'master');
    git(repo, 'update-ref', 'refs/remotes/origin/master', head);
    afterAll(() => rmSync(repo, { recursive: true, force: true }));

    const run = sha => {
        const output = join(repo, `output-${sha}`);
        writeFileSync(output, '');
        const result = spawnSync('bash', ['-c', guardStep.run], {
            cwd: repo,
            encoding: 'utf8',
            env: { ...env, DEPLOYED_SHA: sha, GITHUB_OUTPUT: output },
        });
        return {
            status: result.status,
            stdout: result.stdout,
            output: readFileSync(output, 'utf8'),
        };
    };

    test('releases the master head ahead of the newest tag, ignoring non-semver v* tags', () => {
        const result = run(head);
        expect(result.status).toBe(0);
        expect(result.output).toBe(`sha=${head}\nrelease=true\n`);
    });

    test('passes an already tagged SHA (rollback promote) to the engine, which answers ALREADY_RELEASED', () => {
        expect(run(tagged).output).toBe(`sha=${tagged}\nrelease=true\n`);
        expect(run(base).output).toBe(`sha=${base}\nrelease=true\n`);
        expect(run(ten).output).toBe(`sha=${ten}\nrelease=true\n`);
    });

    test('skips an untagged rollback behind the newest tag (by version order) with a green warning', () => {
        for (const sha of [afterNine, between]) {
            const result = run(sha);
            expect(result.status).toBe(0);
            expect(result.output).toBe('release=false\n');
            expect(result.stdout).toContain('rollback to a commit behind the newest tag v1.0.10');
        }
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

describe('release-on-production guard: workflow files of the promoted SHA (#838)', () => {
    const env = isolatedGitEnv();
    const git = (cwd, ...args) => runGit(env, cwd, ...args);
    const repo = mkdtempSync(join(tmpdir(), 'release-guard-workflows-'));
    initTestRepo(env, repo);
    mkdirSync(join(repo, '.github', 'workflows'), { recursive: true });
    const commit = (name, workflowText) => {
        if (workflowText !== undefined) {
            writeFileSync(join(repo, '.github', 'workflows', 'ci.yml'), workflowText);
            git(repo, 'add', '.github/workflows/ci.yml');
        } else {
            writeFileSync(join(repo, `${name}.txt`), name);
            git(repo, 'add', `${name}.txt`);
        }
        git(repo, 'commit', '-q', '-m', name);
        return git(repo, 'rev-parse', 'HEAD');
    };
    // base v1.0.0 (ci v1) - taggedOld v1.0.1 - oldWorkflows - workflowChange (ci v2) - sameWorkflows - head on master.
    commit('base', 'v1\n');
    git(repo, 'tag', 'v1.0.0');
    const taggedOld = commit('tagged-old');
    git(repo, 'tag', 'v1.0.1');
    const oldWorkflows = commit('old-workflows');
    commit('workflow-change', 'v2\n');
    const sameWorkflows = commit('same-workflows');
    const head = commit('head');
    git(repo, 'update-ref', 'refs/remotes/origin/master', head);
    afterAll(() => rmSync(repo, { recursive: true, force: true }));

    const run = sha => {
        const output = join(repo, '.git', `output-${sha}`);
        writeFileSync(output, '');
        const result = spawnSync('bash', ['-c', guardStep.run], {
            cwd: repo,
            encoding: 'utf8',
            env: { ...env, DEPLOYED_SHA: sha, GITHUB_OUTPUT: output },
        });
        return {
            status: result.status,
            stdout: result.stdout,
            output: readFileSync(output, 'utf8'),
        };
    };

    test('fails an untagged SHA whose .github/workflows differs from the master tip, naming the cause and the files', () => {
        const result = run(oldWorkflows);
        expect(result.status).toBe(1);
        expect(result.output).toBe('');
        expect(result.stdout).toContain(
            `::error::No release for ${oldWorkflows}: its .github/workflows differs from the master tip`,
        );
        expect(result.stdout).toContain('GITHUB_TOKEN cannot create a tag on such a commit (#838)');
        expect(result.stdout).toContain('Promote to Production the master tip build');
        expect(result.stdout).toContain('.github/workflows/ci.yml');
    });

    test('passes an already tagged SHA with different workflow files (engine no-op, no ref created)', () => {
        const result = run(taggedOld);
        expect(result.status).toBe(0);
        expect(result.output).toBe(`sha=${taggedOld}\nrelease=true\n`);
    });

    test('passes an untagged SHA whose workflow files equal the master tip', () => {
        for (const sha of [sameWorkflows, head]) {
            const result = run(sha);
            expect(result.status).toBe(0);
            expect(result.output).toBe(`sha=${sha}\nrelease=true\n`);
        }
    });

    test('runs the comparison with git diff-tree on tree OIDs only (no lazy blob fetch in the blob:none clone)', () => {
        expect(guardStep.run).toContain(
            'git diff-tree --quiet -r "$DEPLOYED_SHA" origin/master -- .github/workflows || differs=$?',
        );
        expect(guardStep.run).not.toMatch(/git diff (?!-tree)/u);
    });
});
