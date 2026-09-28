import process from 'node:process';
import { pathToFileURL } from 'node:url';

const EXPECTED_REPOSITORY = 'ChipIn-one/chipin-frontend';
const FRONTEND_CI = 'Frontend CI';
const MAIN_CI = 'Main CI';
const SHA_PATTERN = /^[0-9a-f]{40}$/u;

const normalizeValue = value => typeof value === 'string' ? value.trim() : '';

const requireValue = (name, value) => {
    const normalizedValue = normalizeValue(value);

    if (!normalizedValue) {
        throw new Error(`${name} is required.`);
    }

    return normalizedValue;
};

const requireSha = (name, value) => {
    const normalizedValue = requireValue(name, value).toLowerCase();

    if (!SHA_PATTERN.test(normalizedValue)) {
        throw new Error(`${name} must be a full 40-character Git SHA.`);
    }

    return normalizedValue;
};

const resolveTarget = ({ ciWorkflow, eventName, baseRef, sourceBranch }) => {
    if (eventName === 'pull_request') {
        if (ciWorkflow === FRONTEND_CI && baseRef === 'dev') {
            return 'preview';
        }

        if (ciWorkflow === MAIN_CI && baseRef === 'main' && sourceBranch === 'dev') {
            return 'preview';
        }

        throw new Error(
            'Pull request deployment is not allowed for this CI/base/source combination.',
        );
    }

    if (eventName === 'push') {
        if (ciWorkflow === FRONTEND_CI && sourceBranch === 'dev') {
            return 'preview';
        }

        if (ciWorkflow === MAIN_CI && sourceBranch === 'main') {
            return 'production';
        }

        throw new Error('Push deployment is not allowed for this CI/source branch combination.');
    }

    throw new Error(`Unsupported deployment event: ${eventName}`);
};

export const verifyVercelDeployCheckout = ({ ciSha, checkedOutSha }) => {
    const resolvedCiSha = requireSha('ciSha', ciSha);
    const resolvedCheckedOutSha = requireSha('checkedOutSha', checkedOutSha);

    if (resolvedCheckedOutSha !== resolvedCiSha) {
        throw new Error('Checked-out SHA does not match the CI SHA.');
    }

    return resolvedCiSha;
};

export const resolveVercelDeployPlan = ({
    activationEnabled,
    ciResult,
    ciWorkflow,
    repository,
    sourceRepository,
    currentSourceRepository,
    eventName,
    baseRef,
    currentBaseRef,
    sourceBranch,
    currentSourceBranch,
    ciSha,
    currentSourceSha,
}) => {
    if (normalizeValue(activationEnabled) !== 'true') {
        throw new Error('Actions-based Vercel deployment is not enabled.');
    }

    if (normalizeValue(ciResult) !== 'success') {
        throw new Error('Only a successful CI result may deploy.');
    }

    const resolvedRepository = requireValue('repository', repository);
    const resolvedSourceRepository = requireValue('sourceRepository', sourceRepository);
    const resolvedCurrentSourceRepository = requireValue(
        'currentSourceRepository',
        currentSourceRepository,
    );

    if (resolvedRepository !== EXPECTED_REPOSITORY) {
        throw new Error(`Unexpected deployment repository: ${resolvedRepository}`);
    }

    if (
        resolvedSourceRepository !== EXPECTED_REPOSITORY ||
        resolvedCurrentSourceRepository !== EXPECTED_REPOSITORY
    ) {
        throw new Error(`Deployment source repository must be ${EXPECTED_REPOSITORY}.`);
    }

    if (resolvedCurrentSourceRepository !== resolvedSourceRepository) {
        throw new Error('Current source repository no longer matches the CI source repository.');
    }

    const resolvedCiWorkflow = requireValue('ciWorkflow', ciWorkflow);
    const resolvedEventName = requireValue('eventName', eventName);
    const resolvedBaseRef = normalizeValue(baseRef);
    const resolvedCurrentBaseRef = normalizeValue(currentBaseRef);
    const resolvedSourceBranch = requireValue('sourceBranch', sourceBranch);
    const resolvedCurrentSourceBranch = requireValue(
        'currentSourceBranch',
        currentSourceBranch,
    );
    const resolvedCiSha = requireSha('ciSha', ciSha);
    const resolvedCurrentSourceSha = requireSha('currentSourceSha', currentSourceSha);

    if (resolvedCurrentBaseRef !== resolvedBaseRef) {
        throw new Error('Current base branch no longer matches the CI base branch.');
    }

    if (resolvedCurrentSourceBranch !== resolvedSourceBranch) {
        throw new Error('Current source branch no longer matches the CI source branch.');
    }

    if (resolvedCurrentSourceSha !== resolvedCiSha) {
        throw new Error('CI SHA is stale relative to the current source branch.');
    }

    return {
        ciSha: resolvedCiSha,
        sourceBranch: resolvedSourceBranch,
        target: resolveTarget({
            ciWorkflow: resolvedCiWorkflow,
            eventName: resolvedEventName,
            baseRef: resolvedBaseRef,
            sourceBranch: resolvedSourceBranch,
        }),
    };
};

const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isCli) {
    try {
        const plan = resolveVercelDeployPlan({
            activationEnabled: process.env.CHIPIN_VERCEL_DEPLOY_ENABLED,
            ciResult: process.env.CHIPIN_CI_RESULT,
            ciWorkflow: process.env.CHIPIN_CI_WORKFLOW,
            repository: process.env.CHIPIN_REPOSITORY,
            sourceRepository: process.env.CHIPIN_SOURCE_REPOSITORY,
            currentSourceRepository: process.env.CHIPIN_CURRENT_SOURCE_REPOSITORY,
            eventName: process.env.CHIPIN_EVENT_NAME,
            baseRef: process.env.CHIPIN_BASE_REF,
            currentBaseRef: process.env.CHIPIN_CURRENT_BASE_REF,
            sourceBranch: process.env.CHIPIN_SOURCE_BRANCH,
            currentSourceBranch: process.env.CHIPIN_CURRENT_SOURCE_BRANCH,
            ciSha: process.env.CHIPIN_CI_SHA,
            currentSourceSha: process.env.CHIPIN_CURRENT_SOURCE_SHA,
        });

        if (normalizeValue(process.env.CHIPIN_CHECKED_OUT_SHA)) {
            verifyVercelDeployCheckout({
                ciSha: plan.ciSha,
                checkedOutSha: process.env.CHIPIN_CHECKED_OUT_SHA,
            });
        }

        process.stdout.write(`ci_sha=${plan.ciSha}\n`);
        process.stdout.write(`target=${plan.target}\n`);
        process.stdout.write(`source_branch=${plan.sourceBranch}\n`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    }
}
