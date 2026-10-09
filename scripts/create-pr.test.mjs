import { expect, test } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    buildCreatePullRequestArgs,
    extractPullRequestUrl,
    getOpenPullRequestAction,
    validateTaskBranch,
    validateTaskIdentity,
    requireCurrentAdmission,
    main,
} from './create-pr.mjs';

test('accepts canonical vendor-neutral Issue-backed task branches', () => {
    expect(validateTaskBranch('feat/issue-356-provider-neutral-roles')).toBeNull();
    expect(validateTaskBranch('fix/issue-12-scroll')).toBeNull();
    expect(validateTaskBranch('policy/issue-357-role-contract')).toBeNull();
});

test('rejects dev and main as task branches', () => {
    expect(validateTaskBranch('dev')).toContain('dev');
    expect(validateTaskBranch('main')).toContain('main');
});

test('rejects detached HEAD as a task branch', () => {
    expect(validateTaskBranch('')).toContain('detached');
});

test('rejects arbitrary branches outside the canonical task format', () => {
    expect(validateTaskBranch('feature/no-issue-prefix')).toContain('issue-<number>');
    expect(validateTaskBranch('Feature/issue-12-uppercase-type')).toContain('issue-<number>');
    expect(validateTaskBranch('feat/issue-12-bad_slug')).toContain('issue-<number>');
    expect(validateTaskBranch('feat/issue-12-extra/path')).toContain('issue-<number>');
});

test('creates task PR commands with an explicit dev base', () => {
    expect(buildCreatePullRequestArgs('feat/issue-356-provider-neutral-roles')).toEqual([
        'pr',
        'create',
        '--base',
        'dev',
        '--head',
        'feat/issue-356-provider-neutral-roles',
        '--fill',
    ]);
});

test('reuses an existing PR and retargets it when its base is not dev', () => {
    expect(getOpenPullRequestAction([{
        number: 42,
        url: 'https://github.com/ChipIn-one/chipin-frontend/pull/42',
        baseRefName: 'main',
    }])).toEqual({
        kind: 'retarget',
        number: 42,
        url: 'https://github.com/ChipIn-one/chipin-frontend/pull/42',
    });
});

test('returns an existing dev PR without creating a duplicate', () => {
    expect(getOpenPullRequestAction([{
        number: 43,
        url: 'https://github.com/ChipIn-one/chipin-frontend/pull/43',
        baseRefName: 'dev',
    }])).toEqual({
        kind: 'existing',
        url: 'https://github.com/ChipIn-one/chipin-frontend/pull/43',
    });
});

test('rejects pull/new links as PR URLs', () => {
    expect(() => extractPullRequestUrl(
        'https://github.com/ChipIn-one/chipin-frontend/pull/new/feature/not-a-pr-url',
    )).toThrow('existing PR URL');
});


test('frontend admission bypass is restricted to trusted Dependabot dev PRs', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/frontend-ci.yml'), 'utf8');
    expect(workflow).toContain("github.base_ref == 'dev' && github.event.pull_request.user.login == 'dependabot[bot]' && github.actor == 'dependabot[bot]'");
    expect(workflow).toContain("github.event_name == 'pull_request' && !(");
});

test('requires explicit exact task identity before PR publication', () => {
    expect(validateTaskIdentity('feat/issue-71-admission', 'ChipIn-one/chipin-frontend#71')).toBeNull();
    expect(validateTaskIdentity('feat/issue-71-admission', '')).toContain('CHIPIN_TASK_IDENTITY');
    expect(validateTaskIdentity('feat/issue-71-admission', 'ChipIn-one/chipin-frontend#72')).toContain('CHIPIN_TASK_IDENTITY');
    expect(validateTaskIdentity('feat/issue-71-admission', 'ChipIn-one/chipin-backend#71')).toContain('CHIPIN_TASK_IDENTITY');
});

const issue = 'ChipIn-one/chipin-frontend#71';
const acceptedReceipt = overrides => JSON.stringify({
    contractVersion: 'chipin-issue-admission/v1',
    status: 'INTAKE_COMPLETE',
    issue,
    revision: 'f'.repeat(64),
    checkedAt: new Date().toISOString(),
    blockers: [],
    ...overrides,
});
const canonicalRunner = nodeResult => (command, args) => {
    if (command === 'git') return { status: 0, stdout: '', stderr: '' };
    if (command === 'node' && args.some(arg => arg.endsWith('/automation/issue-admission.mjs'))) {
        return nodeResult;
    }
    throw new Error('unexpected command ' + command + ' ' + args.join(' '));
};
const admitWith = result => requireCurrentAdmission(issue, 'scoped-test-token', {
    run: canonicalRunner(result),
    createDirectory: () => '/unused/canonical-admission-fixture',
    removeDirectory: () => {},
    environment: {},
});

test('canonical reader admits only exact, fresh versioned positive receipt', () => {
    expect(() => admitWith({ status: 0, stdout: acceptedReceipt(), stderr: '' })).not.toThrow();
    for (const invalid of [
        { status: 2, stdout: acceptedReceipt(), stderr: 'Priority missing' },
        { status: 0, stdout: '{bad', stderr: '' },
        { status: 0, stdout: acceptedReceipt({ status: 'QUEUED' }), stderr: '' },
        { status: 0, stdout: acceptedReceipt({ issue: 'ChipIn-one/chipin-frontend#72' }), stderr: '' },
        { status: 0, stdout: acceptedReceipt({ contractVersion: 'legacy' }), stderr: '' },
        { status: 0, stdout: acceptedReceipt({ revision: '' }), stderr: '' },
        { status: 0, stdout: acceptedReceipt({ checkedAt: new Date(Date.now() - 180_000).toISOString() }), stderr: '' },
        { status: 0, stdout: acceptedReceipt({ blockers: ['Project unreadable'] }), stderr: '' },
    ]) {
        expect(() => admitWith(invalid)).toThrow();
    }
});

const publicationRunner = calls => (command, args) => {
    calls.push([command, ...args]);
    if (command === 'git' && args[0] === 'branch') {
        return { status: 0, stdout: 'feat/issue-71-test\\n', stderr: '' };
    }
    if (command === 'git' && args[0] === 'ls-remote') return { status: 0, stdout: 'remote', stderr: '' };
    if (command === 'gh' && args[0] === 'auth' && args[1] === 'status') return { status: 0, stdout: '', stderr: '' };
    if (command === 'gh' && args[0] === 'auth' && args[1] === 'token') return { status: 0, stdout: 'test-token\\n', stderr: '' };
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'list') return { status: 0, stdout: '[]', stderr: '' };
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'create') {
        return { status: 0, stdout: 'https://github.com/ChipIn-one/chipin-frontend/pull/900', stderr: '' };
    }
    throw new Error('Unexpected command ' + command + ': ' + args.join(' '));
};

test('publication stops before gh pr mutation when canonical admission is denied', () => {
    const calls = [], errors = [], admitted = [];
    const code = main({
        run: publicationRunner(calls),
        admission: (identity, token) => {
            admitted.push([identity, token]);
            throw new Error('BLOCKED: Project #5 membership missing');
        },
        env: { CHIPIN_TASK_IDENTITY: issue },
        log: () => {},
        logError: line => errors.push(line),
    });
    expect(code).toBe(1);
    expect(admitted).toEqual([[issue, 'test-token']]);
    expect(errors.join(' ')).toContain('Project #5 membership missing');
    expect(calls.some(row => row[0] === 'gh' && row[1] === 'pr')).toBe(false);
});

test('publication invokes reader before creating one PR after positive admission', () => {
    const calls = [], events = [], urls = [];
    const code = main({
        run: (command, args) => {
            events.push(command + ':' + args.join(' '));
            return publicationRunner(calls)(command, args);
        },
        admission: (identity, token) => {
            expect(identity).toBe(issue);
            expect(token).toBe('test-token');
            events.push('ADMISSION_OK');
        },
        env: { CHIPIN_TASK_IDENTITY: issue },
        log: line => urls.push(line),
        logError: line => { throw new Error(line); },
    });
    expect(code).toBe(0);
    expect(urls).toEqual(['https://github.com/ChipIn-one/chipin-frontend/pull/900']);
    expect(events.indexOf('ADMISSION_OK')).toBeLessThan(events.findIndex(x => x.startsWith('gh:pr create')));
    expect(calls.filter(row => row[0] === 'gh' && row[1] === 'pr' && row[2] === 'create')).toHaveLength(1);
});
