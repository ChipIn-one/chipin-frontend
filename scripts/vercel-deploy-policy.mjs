import process from 'node:process';
import { pathToFileURL } from 'node:url';

const EXPECTED_REPOSITORY = 'ChipIn-one/chipin-frontend';
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

const resolveTarget = ({ eventName, baseRef, sourceBranch }) => {
    if (eventName === 'pull_request') {
        if (baseRef === 'dev') {
            return 'preview';
        }

        if (baseRef === 'main' && sourceBranch === 'dev') {
            return 'preview';
        }

        throw new Error('Pull request deployment is not allowed for this base/source branch pair.');
    }

    if (eventName === 'push') {
        if (sourceBranch === 'dev') {
            return 'staging';
        }

        if (sourceBranch === 'main') {
            return 'production';
        }

        throw new Error('Push deployment is allowed only from dev or main.');
    }

    throw new Error(`Unsupported deployment event: ${eventName}`);
};

export const resolveVercelDeployPlan = ({
    activationEnabled,
    ciResult,
    repository,
    sourceRepository,
    eventName,
    baseRef,
    sourceBranch,
    ciSha,
    checkedOutSha,
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

    if (resolvedRepository !== EXPECTED_REPOSITORY) {
        throw new Error(`Unexpected deployment repository: ${resolvedRepository}`);
    }

    if (resolvedSourceRepository !== EXPECTED_REPOSITORY) {
        throw new Error(`Deployment source repository must be ${EXPECTED_REPOSITORY}.`);
    }

    const resolvedEventName = requireValue('eventName', eventName);
    const resolvedBaseRef = normalizeValue(baseRef);
    const resolvedSourceBranch = requireValue('sourceBranch', sourceBranch);
    const resolvedCiSha = requireSha('ciSha', ciSha);
    const resolvedCheckedOutSha = requireSha('checkedOutSha', checkedOutSha);
    const resolvedCurrentSourceSha = requireSha('currentSourceSha', currentSourceSha);

    if (resolvedCheckedOutSha !== resolvedCiSha) {
        throw new Error('Checked-out SHA does not match the CI SHA.');
    }

    if (resolvedCurrentSourceSha !== resolvedCiSha) {
        throw new Error('CI SHA is stale relative to the current source branch.');
    }

    return {
        sourceBranch: resolvedSourceBranch,
        target: resolveTarget({
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
            repository: process.env.CHIPIN_REPOSITORY,
            sourceRepository: process.env.CHIPIN_SOURCE_REPOSITORY,
            eventName: process.env.CHIPIN_EVENT_NAME,
            baseRef: process.env.CHIPIN_BASE_REF,
            sourceBranch: process.env.CHIPIN_SOURCE_BRANCH,
            ciSha: process.env.CHIPIN_CI_SHA,
            checkedOutSha: process.env.CHIPIN_CHECKED_OUT_SHA,
            currentSourceSha: process.env.CHIPIN_CURRENT_SOURCE_SHA,
        });

        process.stdout.write(`target=${plan.target}\nsource_branch=${plan.sourceBranch}\n`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    }
}
