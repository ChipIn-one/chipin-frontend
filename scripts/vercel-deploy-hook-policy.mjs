import process from 'node:process';
import { pathToFileURL } from 'node:url';

const EXPECTED_REPOSITORY = 'ChipIn-one/chipin-frontend';
const FRONTEND_CI = 'Frontend CI';
const MAIN_CI = 'Main CI';
const SHA_PATTERN = /^[0-9a-f]{40}$/u;

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

export const resolveVercelDeployHookPlan = ({
    activationEnabled,
    ciResult,
    ciWorkflow,
    eventName,
    repository,
    sourceRepository,
    baseBranch = '',
    sourceBranch,
    ciSha,
    currentSourceSha,
}) => {
    if (normalize(activationEnabled) !== 'true') {
        throw new Error('Actions-based Vercel deployment is not enabled.');
    }

    if (normalize(ciResult) !== 'success') {
        throw new Error('Only successful CI may trigger a Vercel deployment.');
    }

    const resolvedRepository = requireValue('repository', repository);
    const resolvedSourceRepository = requireValue('sourceRepository', sourceRepository);

    if (resolvedRepository !== EXPECTED_REPOSITORY) {
        throw new Error(`Unexpected repository: ${resolvedRepository}`);
    }

    if (resolvedSourceRepository !== EXPECTED_REPOSITORY) {
        throw new Error(`Deployment source repository must be ${EXPECTED_REPOSITORY}.`);
    }

    const resolvedWorkflow = requireValue('ciWorkflow', ciWorkflow);
    const resolvedEvent = requireValue('eventName', eventName);
    const resolvedBranch = requireValue('sourceBranch', sourceBranch);
    const resolvedBase = normalize(baseBranch);
    const resolvedCiSha = requireSha('ciSha', ciSha);
    const resolvedCurrentSha = requireSha('currentSourceSha', currentSourceSha);

    let channel;
    let environment;

    if (
        resolvedEvent === 'pull_request' &&
        resolvedWorkflow === FRONTEND_CI &&
        resolvedBase === 'dev'
    ) {
        channel = 'preview';
        environment = 'Preview';
    } else if (
        resolvedEvent === 'push' &&
        resolvedWorkflow === FRONTEND_CI &&
        resolvedBranch === 'dev'
    ) {
        channel = 'dev';
        environment = 'Preview';
    } else if (
        resolvedEvent === 'push' &&
        resolvedWorkflow === MAIN_CI &&
        resolvedBranch === 'main'
    ) {
        channel = 'production';
        environment = 'Production';
    } else {
        throw new Error('Unsupported CI event, workflow, and branch deployment combination.');
    }

    if (resolvedCurrentSha !== resolvedCiSha) {
        return {
            action: 'skip',
            channel,
            environment,
            ciSha: resolvedCiSha,
            sourceBranch: resolvedBranch,
            reason: 'stale',
        };
    }

    return {
        action: 'deploy',
        channel,
        environment,
        ciSha: resolvedCiSha,
        sourceBranch: resolvedBranch,
        reason: '',
    };
};

const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isCli) {
    try {
        const plan = resolveVercelDeployHookPlan({
            activationEnabled: process.env.CHIPIN_VERCEL_DEPLOY_ENABLED,
            ciResult: process.env.CHIPIN_CI_RESULT,
            ciWorkflow: process.env.CHIPIN_CI_WORKFLOW,
            eventName: process.env.CHIPIN_EVENT_NAME,
            repository: process.env.CHIPIN_REPOSITORY,
            sourceRepository: process.env.CHIPIN_SOURCE_REPOSITORY,
            baseBranch: process.env.CHIPIN_BASE_BRANCH,
            sourceBranch: process.env.CHIPIN_SOURCE_BRANCH,
            ciSha: process.env.CHIPIN_CI_SHA,
            currentSourceSha: process.env.CHIPIN_CURRENT_SOURCE_SHA,
        });

        process.stdout.write(`action=${plan.action}\n`);
        process.stdout.write(`channel=${plan.channel}\n`);
        process.stdout.write(`environment=${plan.environment}\n`);
        process.stdout.write(`ci_sha=${plan.ciSha}\n`);
        process.stdout.write(`source_branch=${plan.sourceBranch}\n`);
        process.stdout.write(`reason=${plan.reason}\n`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    }
}
