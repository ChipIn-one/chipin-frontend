import { describe, expect, test } from 'vitest';

import { resolveExactDeploymentPlan } from './vercel-exact-deploy-policy.mjs';

const SHA = '1111111111111111111111111111111111111111';

const makeInput = overrides => ({
    activationEnabled: 'true',
    productionEnabled: 'false',
    repository: 'ChipIn-one/chipin-frontend',
    eventName: 'repository_dispatch',
    dispatchType: 'vercel-exact-deploy',
    workflowRef: 'refs/heads/main',
    selectedSha: SHA,
    channel: 'development',
    sourceBranch: 'dev',
    compareStatus: 'ahead',
    frontendCiConclusion: 'success',
    mainCiConclusion: 'missing',
    checkoutSha: SHA,
    ...overrides,
});

describe('exact Vercel deployment policy', () => {
    test('allows a tested dev commit for development deployment', () => {
        expect(resolveExactDeploymentPlan(makeInput())).toEqual({
            action: 'deploy',
            channel: 'development',
            environment: 'development',
            target: 'preview',
            sourceBranch: 'dev',
            selectedSha: SHA,
            promotes: false,
        });
    });

    test('allows a tested main commit for explicit production promotion', () => {
        expect(resolveExactDeploymentPlan(makeInput({
            productionEnabled: 'true',
            channel: 'production',
            sourceBranch: 'main',
            compareStatus: 'identical',
            mainCiConclusion: 'success',
        }))).toMatchObject({
            channel: 'production',
            sourceBranch: 'main',
            target: 'production',
            selectedSha: SHA,
            promotes: true,
        });
    });

    test('fails closed while the exact deployment path is disabled', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            activationEnabled: 'false',
        }))).toThrow('not enabled');
    });

    test('rejects an unexpected repository', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            repository: 'someone/chipin-frontend',
        }))).toThrow('Unexpected repository');
    });

    test('rejects events that do not use the default-branch repository dispatch path', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            eventName: 'workflow_dispatch',
        }))).toThrow('repository_dispatch');
    });

    test('rejects an unexpected repository dispatch type', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            dispatchType: 'other-deploy',
        }))).toThrow('Unexpected repository dispatch type');
    });

    test('rejects execution from an untrusted workflow ref', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            workflowRef: 'refs/heads/luna/malicious-workflow',
        }))).toThrow('refs/heads/main');
    });

    test('rejects malformed selected SHAs', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            selectedSha: 'not-a-sha',
        }))).toThrow('selectedSha must be a full 40-character Git SHA');
    });

    test('rejects the wrong source branch for a channel', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            sourceBranch: 'main',
        }))).toThrow('development deployments must select a commit contained in dev');
    });

    test('rejects a selected SHA that is not contained in the source branch', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            compareStatus: 'diverged',
        }))).toThrow('not contained in dev');
    });

    test('rejects a selected SHA without successful frontend-ci', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            frontendCiConclusion: 'missing',
        }))).toThrow('frontend-ci must be successful');
    });

    test('rejects production without successful main-ci', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            productionEnabled: 'true',
            channel: 'production',
            sourceBranch: 'main',
            mainCiConclusion: 'missing',
        }))).toThrow('main-ci must be successful');
    });

    test('rejects production while production promotion is disabled', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            channel: 'production',
            sourceBranch: 'main',
            mainCiConclusion: 'success',
        }))).toThrow('production promotion is not enabled');
    });

    test('rejects a checkout that does not match the selected SHA', () => {
        expect(() => resolveExactDeploymentPlan(makeInput({
            checkoutSha: '2222222222222222222222222222222222222222',
        }))).toThrow('Checked out SHA does not match');
    });
});
