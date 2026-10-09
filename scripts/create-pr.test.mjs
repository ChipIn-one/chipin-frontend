import { expect, test } from 'vitest';

import {
    buildCreatePullRequestArgs,
    extractPullRequestUrl,
    getOpenPullRequestAction,
    validateTaskBranch,
    validateTaskIdentity,
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


test('requires explicit exact task identity before PR publication', () => {
    expect(validateTaskIdentity('feat/issue-71-admission', 'ChipIn-one/chipin-frontend#71')).toBeNull();
    expect(validateTaskIdentity('feat/issue-71-admission', '')).toContain('CHIPIN_TASK_IDENTITY');
    expect(validateTaskIdentity('feat/issue-71-admission', 'ChipIn-one/chipin-frontend#72')).toContain('CHIPIN_TASK_IDENTITY');
    expect(validateTaskIdentity('feat/issue-71-admission', 'ChipIn-one/chipin-backend#71')).toContain('CHIPIN_TASK_IDENTITY');
});
