import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const INTEGRATION_BRANCH = 'dev';
const REMOTE_NAME = 'origin';
const TASK_BRANCH_PATTERN = /^[a-z][a-z0-9-]*\/issue-\d+-[a-z0-9][a-z0-9-]*$/u;
const CANONICAL_ADMISSION_COMMIT = 'ae17f444753d7630eefc1d55edb51aa0fc96d3dc';
const CANONICAL_ADMISSION_REMOTE = 'https://github.com/ChipIn-one/.github.git';

export const validateTaskBranch = branch => {
    if (branch.length === 0) {
        return 'Cannot create a task PR from detached HEAD.';
    }

    if (branch === INTEGRATION_BRANCH || branch === 'main') {
        return `Cannot create a task PR from protected branch ${branch}.`;
    }

    if (!TASK_BRANCH_PATTERN.test(branch)) {
        return 'Task branches must use <type>/issue-<number>-<slug>.';
    }

    return null;
};

export const validateTaskIdentity = (branch, identity) => {
    const match = /\/issue-([1-9]\d*)-/.exec(branch);
    if (!match || identity !== `ChipIn-one/chipin-frontend#${match[1]}`) {
        return 'CHIPIN_TASK_IDENTITY must explicitly match the exact FE Issue and task branch number.';
    }
    return null;
};

export const buildCreatePullRequestArgs = (branch, identity, commitDescription = '') => {
    const markers = [...commitDescription.matchAll(/^Task identity:\s*(\S+)\s*$/gmu)];
    if (markers.some(([, value]) => value !== identity)) {
        throw new Error('Commit description has a conflicting Task identity; refusing PR creation.');
    }
    const description = commitDescription.replace(/^Task identity:\s*\S+\s*$/gmu, '').trim();
    // Preserve human commit notes and ensure each standard heading appears once.
    let body = `Task identity: ${identity}\n\n`
        + (/^## Summary\s*$/mu.test(description) ? description
            : `## Summary\n${description || '<!-- Describe verified change -->'}`);
    for (const heading of ['Tests', 'Version impact', 'Dependencies']) {
        if (!new RegExp(`^## ${heading}\\s*$`, 'mu').test(body)) {
            body += `\n\n## ${heading}\n<!-- Add verified evidence or explicitly say none -->`;
        }
    }
    return [
        'pr', 'create',
        '--base', INTEGRATION_BRANCH,
        '--head', branch,
        '--fill',
        // --body takes precedence over --fill, so carry forward commit notes.
        '--body',
        body.trim(),
    ];
};

export const getOpenPullRequestAction = pullRequests => {
    if (pullRequests.length === 0) {
        return { kind: 'create' };
    }

    if (pullRequests.length > 1) {
        throw new Error('Multiple open PRs found for the current task branch.');
    }

    const [pullRequest] = pullRequests;

    if (pullRequest.baseRefName === INTEGRATION_BRANCH) {
        return { kind: 'existing', url: pullRequest.url };
    }

    return {
        kind: 'retarget',
        number: pullRequest.number,
        url: pullRequest.url,
    };
};

export const extractPullRequestUrl = output => {
    const pullRequestUrl = output
        .trim()
        .split(/\s+/u)
        .find(token => /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/u.test(token));

    if (!pullRequestUrl) {
        throw new Error('Expected gh to return an existing PR URL.');
    }

    return pullRequestUrl;
};

const runCommand = (command, args, env = process.env) => {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        env,
    });

    return {
        status: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        error: result.error,
    };
};

const getCommandFailure = result => {
    if (result.error instanceof Error) {
        return result.error.message;
    }

    return result.stderr.trim() || result.stdout.trim() || `Command exited with status ${result.status}.`;
};

const parsePullRequests = output => {
    const parsed = JSON.parse(output);

    if (!Array.isArray(parsed)) {
        throw new Error('gh returned an invalid open PR list.');
    }

    return parsed;
};

// Use the immutable shared canonical reader, never a locally reimplemented metadata gate.
export const requireCurrentAdmission = (identity, token, {
    run = runCommand,
    createDirectory = () => mkdtempSync(join(tmpdir(), 'chipin-issue-admission-')),
    removeDirectory = directory => rmSync(directory, { recursive: true, force: true }),
    environment = process.env,
} = {}) => {
    const directory = createDirectory();
    try {
        for (const args of [
            ['-C', directory, 'init', '-q'],
            ['-C', directory, 'remote', 'add', 'origin', CANONICAL_ADMISSION_REMOTE],
            ['-C', directory, 'fetch', '--quiet', '--depth=1', 'origin', CANONICAL_ADMISSION_COMMIT],
            ['-C', directory, 'checkout', '--quiet', '--detach', 'FETCH_HEAD'],
        ]) {
            const step = run('git', args);
            if (step.status !== 0) throw new Error(`Could not load immutable admission reader: ${getCommandFailure(step)}`);
        }
        const result = run('node', [
            join(directory, 'automation/issue-admission.mjs'),
            '--issue', identity,
            '--config', join(directory, 'automation/metadata-migration.config.json'),
        ], { ...environment, GITHUB_TOKEN: token });
        if (result.status !== 0) throw new Error(`Canonical admission denied: ${getCommandFailure(result)}`);
        const receipt = JSON.parse(result.stdout);
        if (receipt.contractVersion !== 'chipin-issue-admission/v1' ||
            receipt.status !== 'INTAKE_COMPLETE' || receipt.issue !== identity ||
            typeof receipt.revision !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.revision) ||
            !Number.isFinite(Date.parse(receipt.checkedAt)) ||
            Date.now() - Date.parse(receipt.checkedAt) > 120_000 ||
            Date.parse(receipt.checkedAt) > Date.now() || receipt.blockers?.length) {
            throw new Error('Canonical reader did not return exact current INTAKE_COMPLETE revision.');
        }
    } finally {
        removeDirectory(directory);
    }
};

export const main = ({ run = runCommand, admission = requireCurrentAdmission,
    env = process.env, log = console.log, logError = console.error } = {}) => {
    const branchResult = run('git', ['branch', '--show-current']);

    if (branchResult.status !== 0) {
        logError(`PR CREATION BLOCKED: unable to read current branch. ${getCommandFailure(branchResult)}`);
        return 1;
    }

    const branch = branchResult.stdout.trim();
    const branchError = validateTaskBranch(branch);

    if (branchError) {
        logError(`PR CREATION BLOCKED: ${branchError}`);
        return 1;
    }

    const identity = env.CHIPIN_TASK_IDENTITY ?? '';
    const identityError = validateTaskIdentity(branch, identity);
    if (identityError) {
        logError(`PR CREATION BLOCKED: ${identityError}`);
        return 1;
    }

    const remoteBranchResult = run('git', [
        'ls-remote',
        '--exit-code',
        '--heads',
        REMOTE_NAME,
        branch,
    ]);

    if (remoteBranchResult.status !== 0) {
        logError(
            `PR CREATION BLOCKED: task branch ${branch} is not available on ${REMOTE_NAME}. `
            + getCommandFailure(remoteBranchResult),
        );
        return 1;
    }

    const authResult = run('gh', ['auth', 'status']);

    if (authResult.status !== 0) {
        logError('PR CREATION BLOCKED: GitHub authentication unavailable');
        logError(getCommandFailure(authResult));
        return 1;
    }

    const tokenResult = run('gh', ['auth', 'token']);
    if (tokenResult.status !== 0 || !tokenResult.stdout.trim()) {
        logError('PR CREATION BLOCKED: cannot obtain GitHub credential for admission.');
        return 1;
    }
    try {
        admission(identity, tokenResult.stdout.trim());
    } catch (error) {
        logError(`PR CREATION BLOCKED: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }

    const listResult = run('gh', [
        'pr',
        'list',
        '--state',
        'open',
        '--head',
        branch,
        '--json',
        'number,url,baseRefName',
    ]);

    if (listResult.status !== 0) {
        logError(`PR CREATION FAILED: unable to list open PRs. ${getCommandFailure(listResult)}`);
        return 1;
    }

    let pullRequests;

    try {
        pullRequests = parsePullRequests(listResult.stdout);
    } catch (error) {
        logError(`PR CREATION FAILED: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }

    let action;

    try {
        action = getOpenPullRequestAction(pullRequests);
    } catch (error) {
        logError(`PR CREATION FAILED: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }

    if (action.kind === 'existing') {
        log(action.url);
        return 0;
    }

    if (action.kind === 'retarget') {
        const editResult = run('gh', [
            'pr',
            'edit',
            String(action.number),
            '--base',
            INTEGRATION_BRANCH,
        ]);

        if (editResult.status !== 0) {
            logError(`PR CREATION FAILED: unable to retarget PR ${action.number}. ${getCommandFailure(editResult)}`);
            return 1;
        }

        log(action.url);
        return 0;
    }

    // Keep the human-written commit description that --fill would otherwise
    // generate; an explicit --body takes precedence over gh's automatic fill.
    const descriptionResult = run('git', [
        'log', '--no-merges', '--format=%B', `${REMOTE_NAME}/${INTEGRATION_BRANCH}..HEAD`,
    ]);
    if (descriptionResult.status !== 0) {
        logError(`PR CREATION BLOCKED: unable to read commit description. ${getCommandFailure(descriptionResult)}`);
        return 1;
    }
    let createArgs;
    try {
        createArgs = buildCreatePullRequestArgs(branch, identity, descriptionResult.stdout);
    } catch (error) {
        logError(`PR CREATION BLOCKED: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
    const createResult = run('gh', createArgs);

    if (createResult.status !== 0) {
        logError(`PR CREATION FAILED: unable to create PR. ${getCommandFailure(createResult)}`);
        return 1;
    }

    try {
        log(extractPullRequestUrl(createResult.stdout));
    } catch (error) {
        logError(`PR CREATION FAILED: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }

    return 0;
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    process.exitCode = main();
}
