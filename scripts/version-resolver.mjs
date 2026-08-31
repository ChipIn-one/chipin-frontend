import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const MAIN_BRANCH = 'main';
const SHORT_SHA_LENGTH = 7;
const BASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const REPOSITORY_ROOT = resolve(process.cwd());

const normalizeValue = value => typeof value === 'string' ? value.trim() : '';

const getFirstValue = values => {
    for (const value of values) {
        const normalizedValue = normalizeValue(value);

        if (normalizedValue) {
            return normalizedValue;
        }
    }

    return '';
};

const readGitValue = args => {
    try {
        return execFileSync('git', args, {
            cwd: REPOSITORY_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return '';
    }
};

const readLocalBranch = () => readGitValue(['branch', '--show-current']);

const readLocalHeadSha = () => readGitValue(['rev-parse', 'HEAD']);

const readPackageVersion = (packagePath = resolve(REPOSITORY_ROOT, 'package.json')) => {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

    if (!packageJson || typeof packageJson.version !== 'string') {
        throw new Error('package.json must contain a version string.');
    }

    return packageJson.version;
};

const resolveBranch = (branch, env) => {
    if (branch !== undefined) {
        return normalizeValue(branch);
    }

    return getFirstValue([
        env.CHIPIN_TASK_BRANCH,
        env.GITHUB_HEAD_REF,
        env.GITHUB_REF_NAME,
        env.VERCEL_GIT_COMMIT_REF,
        readLocalBranch(),
    ]);
};

const resolveTaskHeadSha = ({
    env,
    pullRequestHeadSha,
    taskHeadSha,
    commitSha,
    localHeadSha,
    readLocalHeadSha: readLocalHeadShaFn,
}) => getFirstValue([
    pullRequestHeadSha,
    env.GITHUB_PR_HEAD_SHA,
    taskHeadSha,
    env.CHIPIN_TASK_HEAD_SHA,
    commitSha,
    env.GITHUB_SHA,
    env.VERCEL_GIT_COMMIT_SHA,
    localHeadSha,
    readLocalHeadShaFn(),
]);

export const resolveAppVersion = ({
    baseVersion = readPackageVersion(),
    branch,
    env = process.env,
    pullRequestHeadSha,
    taskHeadSha,
    commitSha,
    localHeadSha,
    readLocalHeadSha: readLocalHeadShaFn = readLocalHeadSha,
} = {}) => {
    if (!BASE_VERSION_PATTERN.test(baseVersion)) {
        throw new Error(`Invalid base application version: ${baseVersion}`);
    }

    const resolvedBranch = resolveBranch(branch, env);

    if (resolvedBranch === MAIN_BRANCH) {
        return baseVersion;
    }

    const resolvedTaskHeadSha = resolveTaskHeadSha({
        env,
        pullRequestHeadSha,
        taskHeadSha,
        commitSha,
        localHeadSha,
        readLocalHeadSha: readLocalHeadShaFn,
    });

    if (!resolvedTaskHeadSha) {
        throw new Error('A task HEAD SHA is required for a non-release application build.');
    }

    return `${baseVersion}-dev-${resolvedTaskHeadSha.slice(0, SHORT_SHA_LENGTH)}`;
};
