import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const INTEGRATION_BRANCH = 'dev';
const REMOTE_NAME = 'origin';

export const validateTaskBranch = branch => {
    if (branch.length === 0) {
        return 'Cannot create a task PR from detached HEAD.';
    }

    if (branch === INTEGRATION_BRANCH || branch === 'main') {
        return `Cannot create a task PR from protected branch ${branch}.`;
    }

    return null;
};

export const buildCreatePullRequestArgs = branch => [
    'pr',
    'create',
    '--base',
    INTEGRATION_BRANCH,
    '--head',
    branch,
    '--fill',
];

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

const runCommand = (command, args) => {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
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

const main = () => {
    const branchResult = runCommand('git', ['branch', '--show-current']);

    if (branchResult.status !== 0) {
        console.error(`PR CREATION BLOCKED: unable to read current branch. ${getCommandFailure(branchResult)}`);
        return 1;
    }

    const branch = branchResult.stdout.trim();
    const branchError = validateTaskBranch(branch);

    if (branchError) {
        console.error(`PR CREATION BLOCKED: ${branchError}`);
        return 1;
    }

    const remoteBranchResult = runCommand('git', [
        'ls-remote',
        '--exit-code',
        '--heads',
        REMOTE_NAME,
        branch,
    ]);

    if (remoteBranchResult.status !== 0) {
        console.error(
            `PR CREATION BLOCKED: task branch ${branch} is not available on ${REMOTE_NAME}. `
            + getCommandFailure(remoteBranchResult),
        );
        return 1;
    }

    const authResult = runCommand('gh', ['auth', 'status']);

    if (authResult.status !== 0) {
        console.error('PR CREATION BLOCKED: GitHub authentication unavailable');
        console.error(getCommandFailure(authResult));
        return 1;
    }

    const listResult = runCommand('gh', [
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
        console.error(`PR CREATION FAILED: unable to list open PRs. ${getCommandFailure(listResult)}`);
        return 1;
    }

    let action;

    try {
        action = getOpenPullRequestAction(parsePullRequests(listResult.stdout));
    } catch (error) {
        console.error(`PR CREATION FAILED: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }

    if (action.kind === 'existing') {
        console.log(action.url);
        return 0;
    }

    if (action.kind === 'retarget') {
        const editResult = runCommand('gh', [
            'pr',
            'edit',
            String(action.number),
            '--base',
            INTEGRATION_BRANCH,
        ]);

        if (editResult.status !== 0) {
            console.error(`PR CREATION FAILED: unable to retarget PR ${action.number}. ${getCommandFailure(editResult)}`);
            return 1;
        }

        console.log(action.url);
        return 0;
    }

    const createResult = runCommand('gh', buildCreatePullRequestArgs(branch));

    if (createResult.status !== 0) {
        console.error(`PR CREATION FAILED: unable to create PR. ${getCommandFailure(createResult)}`);
        return 1;
    }

    try {
        console.log(extractPullRequestUrl(createResult.stdout));
    } catch (error) {
        console.error(`PR CREATION FAILED: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }

    return 0;
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    process.exitCode = main();
}
