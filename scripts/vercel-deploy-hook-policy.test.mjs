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
    expect(resolveVercelDeployHookPlan(makeInput())).toMatchObject({
        action: 'deploy',
        channel: 'dev',
        ciSha: SHA,
    });
});

test('allows current main push after Main CI', () => {
    expect(resolveVercelDeployHookPlan(makeInput({
        ciWorkflow: 'Main CI',
        sourceBranch: 'main',
    }))).toMatchObject({
        action: 'deploy',
        channel: 'production',
        ciSha: SHA,
    });
});

test('allows current same-repository pull request to dev after Frontend CI', () => {
    expect(resolveVercelDeployHookPlan(makeInput({
        eventName: 'pull_request',
        baseBranch: 'dev',
        sourceBranch: 'luna/example',
    }))).toMatchObject({
        action: 'deploy',
        channel: 'preview',
        ciSha: SHA,
    });
});

test('skips a stale successful CI run', () => {
    expect(resolveVercelDeployHookPlan(makeInput({
        currentSourceSha: '2222222222222222222222222222222222222222',
    }))).toMatchObject({
        action: 'skip',
        reason: 'stale',
    });
});

test('rejects failed or cancelled CI', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        ciResult: 'failure',
    }))).toThrow('Only successful CI');

    expect(() => resolveVercelDeployHookPlan(makeInput({
        ciResult: 'cancelled',
    }))).toThrow('Only successful CI');
});

test('rejects unexpected or fork repositories', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        repository: 'someone/chipin-frontend',
    }))).toThrow('Unexpected repository');

    expect(() => resolveVercelDeployHookPlan(makeInput({
        sourceRepository: 'someone/chipin-frontend',
    }))).toThrow('Deployment source repository');
});

test('rejects unsupported event/workflow/branch combinations', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        eventName: 'pull_request',
        baseBranch: 'main',
    }))).toThrow('Unsupported CI event');

    expect(() => resolveVercelDeployHookPlan(makeInput({
        sourceBranch: 'main',
    }))).toThrow('Unsupported CI event');
});

test('rejects malformed CI SHAs', () => {
    expect(() => resolveVercelDeployHookPlan(makeInput({
        ciSha: 'not-a-sha',
    }))).toThrow('ciSha must be a full 40-character Git SHA');
});
