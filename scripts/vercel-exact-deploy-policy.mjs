import process from 'node:process';
import { pathToFileURL } from 'node:url';

const EXPECTED_REPOSITORY = 'ChipIn-one/chipin-frontend';
const TRUSTED_WORKFLOW_REF = 'refs/heads/main';
const EXPECTED_DISPATCH_TYPE = 'vercel-exact-deploy';
const SHA_PATTERN = /^[0-9a-f]{40}$/u;

const CHANNELS = Object.freeze({
    development: Object.freeze({
        sourceBranch: 'dev',
        environment: 'development',
        target: 'preview',
        requiresMainCi: false,
        promotes: false,
    }),
    production: Object.freeze({
        sourceBranch: 'main',
        environment: 'production',
        target: 'production',
        requiresMainCi: true,
        promotes: true,
    }),
});

const normalize = value => typeof value === 'string' ? value.trim() : '';

const requireValue = (name, value) => {
    const normalized = normalize(value);

    if (!normalized) {
        throw new Error(`${name} is required.`);
    }

    return normalized;
};

const requireSha = (name, value) => {
    const normalized = requireValue(name, value).toLowerCase();

    if (!SHA_PATTERN.test(normalized)) {
        throw new Error(`${name} must be a full 40-character Git SHA.`);
    }

    return normalized;
};

const requireSuccessfulCheck = (name, value) => {
    if (normalize(value) !== 'success') {
        throw new Error(`${name} must be successful for the selected SHA.`);
    }
};

export const resolveExactDeploymentPlan = ({
    activationEnabled,
    productionEnabled,
    repository,
    eventName,
    dispatchType,
    workflowRef,
    selectedSha,
    channel,
    sourceBranch,
    compareStatus,
    frontendCiConclusion,
    mainCiConclusion,
    checkoutSha,
}) => {
    if (normalize(activationEnabled) !== 'true') {
        throw new Error('Exact-commit Vercel deployment is not enabled.');
    }

    const resolvedRepository = requireValue('repository', repository);

    if (resolvedRepository !== EXPECTED_REPOSITORY) {
        throw new Error(`Unexpected repository: ${resolvedRepository}`);
    }

    if (normalize(eventName) !== 'repository_dispatch') {
        throw new Error('Exact-commit deployment accepts only repository_dispatch.');
    }

    if (normalize(dispatchType) !== EXPECTED_DISPATCH_TYPE) {
        throw new Error(`Unexpected repository dispatch type: ${normalize(dispatchType) || 'missing'}`);
    }

    if (normalize(workflowRef) !== TRUSTED_WORKFLOW_REF) {
        throw new Error(`Exact-commit deployment must run from ${TRUSTED_WORKFLOW_REF}.`);
    }

    const resolvedSelectedSha = requireSha('selectedSha', selectedSha);
    const resolvedChannel = requireValue('channel', channel);
    const channelPolicy = CHANNELS[resolvedChannel];

    if (!channelPolicy) {
        throw new Error(`Unsupported deployment channel: ${resolvedChannel}`);
    }

    const resolvedSourceBranch = requireValue('sourceBranch', sourceBranch);

    if (resolvedSourceBranch !== channelPolicy.sourceBranch) {
        throw new Error(
            `${resolvedChannel} deployments must select a commit contained in ${channelPolicy.sourceBranch}.`,
        );
    }

    const resolvedCompareStatus = requireValue('compareStatus', compareStatus);

    if (resolvedCompareStatus !== 'ahead' && resolvedCompareStatus !== 'identical') {
        throw new Error(
            `Selected SHA is not contained in ${resolvedSourceBranch}; compare status is ${resolvedCompareStatus}.`,
        );
    }

    requireSuccessfulCheck('frontend-ci', frontendCiConclusion);

    if (channelPolicy.requiresMainCi) {
        requireSuccessfulCheck('main-ci', mainCiConclusion);

        if (normalize(productionEnabled) !== 'true') {
            throw new Error('Exact-commit production promotion is not enabled.');
        }
    }

    const resolvedCheckoutSha = requireSha('checkoutSha', checkoutSha);

    if (resolvedCheckoutSha !== resolvedSelectedSha) {
        throw new Error('Checked out SHA does not match the selected deployment SHA.');
    }

    return {
        action: 'deploy',
        channel: resolvedChannel,
        environment: channelPolicy.environment,
        target: channelPolicy.target,
        sourceBranch: resolvedSourceBranch,
        selectedSha: resolvedSelectedSha,
        promotes: channelPolicy.promotes,
    };
};

const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isCli) {
    try {
        const plan = resolveExactDeploymentPlan({
            activationEnabled: process.env.CHIPIN_EXACT_DEPLOY_ENABLED,
            productionEnabled: process.env.CHIPIN_EXACT_PRODUCTION_ENABLED,
            repository: process.env.CHIPIN_REPOSITORY,
            eventName: process.env.CHIPIN_EVENT_NAME,
            dispatchType: process.env.CHIPIN_DISPATCH_TYPE,
            workflowRef: process.env.CHIPIN_WORKFLOW_REF,
            selectedSha: process.env.CHIPIN_SELECTED_SHA,
            channel: process.env.CHIPIN_CHANNEL,
            sourceBranch: process.env.CHIPIN_SOURCE_BRANCH,
            compareStatus: process.env.CHIPIN_COMPARE_STATUS,
            frontendCiConclusion: process.env.CHIPIN_FRONTEND_CI_CONCLUSION,
            mainCiConclusion: process.env.CHIPIN_MAIN_CI_CONCLUSION,
            checkoutSha: process.env.CHIPIN_CHECKOUT_SHA,
        });

        process.stdout.write(`action=${plan.action}\n`);
        process.stdout.write(`channel=${plan.channel}\n`);
        process.stdout.write(`environment=${plan.environment}\n`);
        process.stdout.write(`target=${plan.target}\n`);
        process.stdout.write(`source_branch=${plan.sourceBranch}\n`);
        process.stdout.write(`selected_sha=${plan.selectedSha}\n`);
        process.stdout.write(`promotes=${plan.promotes}\n`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    }
}
