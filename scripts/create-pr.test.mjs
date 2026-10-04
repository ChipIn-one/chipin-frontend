import { expect, test } from 'vitest';

import {
    buildCreatePullRequestArgs,
    extractPullRequestUrl,
    getOpenPullRequestAction,
    isLegacyBranchForPullRequest,
    validateTaskBranch,
} from './create-pr.mjs';

test('accepts canonical and existing luna task branches', () => {
    expect(validateTaskBranch('feat/issue-356-provider-neutral-roles')).toBeNull();
    expect(validateTaskBranch('fix/issue-12-scroll')).toBeNull();
    expect(validateTaskBranch('luna/foo')).toBeNull();
});

test('rejects dev and main as task branches', () => {
    expect(validateTaskBranch('dev')).toContain('dev');
    expect(validateTaskBranch('main')).toContain('main');
});

test('rejects detached HEAD as a task branch', () => {
    expect(validateTaskBranch('')).toContain('detached');
});

test('rejects arbitrary branches outside the canonical or legacy task formats', () => {
    expect(validateTaskBranch('codex/foo')).toContain('issue-<number>');
    expect(validateTaskBranch('feat/no-issue-prefix')).toContain('issue-<number>');
});

test('creates task PR commands with an explicit dev base', () => {
    expect(buildCreatePullRequestArgs('luna/foo')).toEqual([
        'pr',
        'create',
        '--base',
        'dev',
        '--head',
        'luna/foo',
        '--fill',
    ]);
});

test('recognizes the current legacy branch only for open PR 109', () => {
    expect(isLegacyBranchForPullRequest('codex/fix-ci-development-flow', [{ number: 109 }])).toBe(true);
    expect(isLegacyBranchForPullRequest('codex/fix-ci-development-flow', [{ number: 110 }])).toBe(false);
    expect(isLegacyBranchForPullRequest('codex/other-branch', [{ number: 109 }])).toBe(false);
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
        'https://github.com/ChipIn-one/chipin-frontend/pull/new/codex/fix-pr-flow',
    )).toThrow('existing PR URL');
});
