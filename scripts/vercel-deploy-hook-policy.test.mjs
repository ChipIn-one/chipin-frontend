import { expect, test } from 'vitest';

import { resolveVercelDeployHookPlan } from './vercel-deploy-hook-policy.mjs';

const SHA = '1111111111111111111111111111111111111111';

const makeInput = overrides => ({
    activationEnabled: 'true',
    ciResult: 'success',
    ciWorkflow: 'Frontend CI',
    eventName: 'push',
    repository: 'ChipIn-one/chipin-frontend',
    sourceRepository: 'ChipIn-one/chipin-frontend',
    sourceBranch: 'dev',
    ciSha: SHA,
    currentSourceSha: SHA,
    ...overrides,
});

test('allows current dev push after Frontend CI', () => {
    expect(resolveVercelDeployHookPlan(makeInput())).toEqual({
        action: 'deploy',
        channel: 'dev',
        environment: 'Preview',
        ciSha: SHA,
        sourceBranch: 'dev',
        reason: '',
    });
});

test('allows current main push after Main CI', () => {
    expect(resolveVercelDeployHookPlan(makeInput({
        ciWorkflow: 'Main CI',
        sourceBranch: 'main',
    }))).toEqual({
        action: 'deploy',
        channel: 'production',
        environment: 'Production',
        ciSha: SHA,
        sourceBranch: 'main',
        reason: '',
    });
});

test('skips a stale successful CI run', () => {
    expect(resolveVercelDeployHookPlan(makeInput({
        currentSourceSha: '2222222222222222222222222222222222222222',
    }))).toMatchObject({
        action: 'skip',
        channel: 'dev',
        reason: 'stale',
    });
});

test('rejects failed CI', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        ciResult: 'failure',
    }))).toThrow('Only successful CI');
});

test('rejects cancelled CI', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        ciResult: 'cancelled',
    }))).toThrow('Only successful CI');
});

test('rejects pull request CI', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        eventName: 'pull_request',
    }))).toThrow('Only push CI runs');
});

test('rejects the wrong repository', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        repository: 'someone/chipin-frontend',
    }))).toThrow('Unexpected repository');
});

test('rejects a fork source repository', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        sourceRepository: 'someone/chipin-frontend',
    }))).toThrow('Deployment source repository');
});

test('rejects Frontend CI on main to avoid duplicate production trigger', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        sourceBranch: 'main',
    }))).toThrow('Unsupported CI workflow and branch');
});

test('rejects Main CI on dev', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        ciWorkflow: 'Main CI',
    }))).toThrow('Unsupported CI workflow and branch');
});

test('rejects malformed CI SHAs', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        ciSha: 'not-a-sha',
    }))).toThrow('ciSha must be a full 40-character Git SHA');
});
