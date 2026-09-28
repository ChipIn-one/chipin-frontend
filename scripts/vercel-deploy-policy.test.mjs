import { expect, test } from 'vitest';

import {
    resolveVercelDeployPlan,
    verifyVercelDeployCheckout,
} from './vercel-deploy-policy.mjs';

const SHA = '1111111111111111111111111111111111111111';

const makeInput = overrides => ({
    activationEnabled: 'true',
    ciResult: 'success',
    ciWorkflow: 'Frontend CI',
    repository: 'ChipIn-one/chipin-frontend',
    sourceRepository: 'ChipIn-one/chipin-frontend',
    currentSourceRepository: 'ChipIn-one/chipin-frontend',
    eventName: 'pull_request',
    baseRef: 'dev',
    currentBaseRef: 'dev',
    sourceBranch: 'luna/vercel-ci-gate',
    currentSourceBranch: 'luna/vercel-ci-gate',
    ciSha: SHA,
    currentSourceSha: SHA,
    ...overrides,
});

test('maps a successful current pull request SHA to preview', () => {
    expect(resolveVercelDeployPlan(makeInput())).toEqual({
        ciSha: SHA,
        sourceBranch: 'luna/vercel-ci-gate',
        target: 'preview',
    });
});

test('maps a successful current dev push SHA to preview', () => {
    expect(resolveVercelDeployPlan(makeInput({
        eventName: 'push',
        baseRef: '',
        currentBaseRef: '',
        sourceBranch: 'dev',
        currentSourceBranch: 'dev',
    }))).toEqual({
        ciSha: SHA,
        sourceBranch: 'dev',
        target: 'preview',
    });
});

test('maps a successful current main push SHA to production', () => {
    expect(resolveVercelDeployPlan(makeInput({
        ciWorkflow: 'Main CI',
        eventName: 'push',
        baseRef: '',
        currentBaseRef: '',
        sourceBranch: 'main',
        currentSourceBranch: 'main',
    }))).toEqual({
        ciSha: SHA,
        sourceBranch: 'main',
        target: 'production',
    });
});

test('maps a successful dev to main release pull request to preview', () => {
    expect(resolveVercelDeployPlan(makeInput({
        ciWorkflow: 'Main CI',
        baseRef: 'main',
        currentBaseRef: 'main',
        sourceBranch: 'dev',
        currentSourceBranch: 'dev',
    }))).toEqual({
        ciSha: SHA,
        sourceBranch: 'dev',
        target: 'preview',
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
        currentSourceRepository: 'someone/chipin-frontend',
    }))).toThrow('Deployment source repository');
});

test('rejects a pull request retargeted after CI', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        currentBaseRef: 'main',
    }))).toThrow('Current base branch no longer matches');
});

test('rejects a replaced source branch after CI', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        currentSourceBranch: 'luna/replaced-branch',
    }))).toThrow('Current source branch no longer matches');
});

test('rejects a release pull request that does not originate from dev', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        ciWorkflow: 'Main CI',
        baseRef: 'main',
        currentBaseRef: 'main',
        sourceBranch: 'luna/not-dev',
        currentSourceBranch: 'luna/not-dev',
    }))).toThrow('Pull request deployment is not allowed');
});

test('rejects frontend CI for a main push to prevent duplicate deployment', () => {
    expect(() => resolveVercelDeployPlan(makeInput({
        eventName: 'push',
        baseRef: '',
        currentBaseRef: '',
        sourceBranch: 'main',
        currentSourceBranch: 'main',
    }))).toThrow('Push deployment is not allowed');
});

test('accepts only an exact checked-out CI SHA', () => {
    expect(verifyVercelDeployCheckout({
        ciSha: SHA,
        checkedOutSha: SHA,
    })).toBe(SHA);
});

test('rejects a checkout that differs from the CI SHA', () => {
    expect(() => verifyVercelDeployCheckout({
        ciSha: SHA,
        checkedOutSha: '3333333333333333333333333333333333333333',
    })).toThrow('Checked-out SHA does not match');
});
