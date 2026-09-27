import { expect, test } from 'vitest';

import { resolveVercelDeployPlan } from './vercel-deploy-policy.mjs';

const SHA = '1111111111111111111111111111111111111111';

const makeInput = overrides => ({
    activationEnabled: 'true',
    ciResult: 'success',
    repository: 'ChipIn-one/chipin-frontend',
    sourceRepository: 'ChipIn-one/chipin-frontend',
    eventName: 'pull_request',
    baseRef: 'dev',
    sourceBranch: 'luna/vercel-ci-gate',
    ciSha: SHA,
    checkedOutSha: SHA,
    currentSourceSha: SHA,
    ...overrides,
});

test('maps a successful current pull request SHA to preview', () => {
    expect(resolveVercelDeployPlan(makeInput())).toEqual({
        sourceBranch: 'luna/vercel-ci-gate',
        target: 'preview',
    });
});

test('maps a successful current dev push SHA to staging', () => {
    expect(resolveVercelDeployPlan(makeInput({
        eventName: 'push',
        baseRef: '',
        sourceBranch: 'dev',
    }))).toEqual({
        sourceBranch: 'dev',
        target: 'staging',
    });
});

test('maps a successful current main push SHA to production', () => {
    expect(resolveVercelDeployPlan(makeInput({
        eventName: 'push',
        baseRef: '',
        sourceBranch: 'main',
    }))).toEqual({
        sourceBranch: 'main',
        target: 'production',
    });
});

test('rejects failed CI', () => {
    expect(() => resolveVercelDeployPlan(makeInput({ ciResult: 'failure' }))).toThrow(
        'Only a successful CI result may deploy',
    );
});

test('rejects cancelled CI', () => {
    expect(() => resolveVercelDeployPlan(makeInput({ ciResult: 'cancelled' }))).toThrow(
        'Only a successful CI result may deploy',
    );
});

test('rejects a stale CI SHA', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        currentSourceSha: '2222222222222222222222222222222222222222',
    }))).toThrow('CI SHA is stale');
});

test('rejects the wrong repository', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        repository: 'someone/chipin-frontend',
    }))).toThrow('Unexpected deployment repository');
});

test('rejects a fork source repository', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        sourceRepository: 'someone/chipin-frontend',
    }))).toThrow('Deployment source repository');
});

test('rejects a checkout that differs from the CI SHA', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        checkedOutSha: '3333333333333333333333333333333333333333',
    }))).toThrow('Checked-out SHA does not match');
});

test('rejects a release pull request that does not originate from dev', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        baseRef: 'main',
        sourceBranch: 'luna/not-dev',
    }))).toThrow('Pull request deployment is not allowed');
});
