import { execFile } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

// The `resolve` job of e2e-sw.yml (docs/e2e-tests.md "Service worker suite"). It runs from the
// workflow's own ref (`github.sha`; on a pull request that is its merge commit), never from a
// dispatched commit, and is the only place that holds the GitHub token. It picks the commit to test and finds the Vercel Preview built from it, then
// writes both as the step outputs `sha` and `url`:
// - `pull_request`: the pull request head, read from the event payload (`GITHUB_EVENT_PATH`), not
//   passed in through a workflow expression.
// - `workflow_dispatch`: a pull request number (its head must be in this repository) or a full SHA
//   (it must be reachable from a branch of this repository, so a fork's commit is refused, and have
//   a Preview: every pull request branch and `master` commit gets one).
// Vercel's Git integration creates a GitHub Deployment for the commit (environment `Preview`,
// creator `vercel[bot]`) whose `success` status, also posted by `vercel[bot]`, carries the
// immutable Preview URL. The step waits while the build runs or GitHub answers with a transient
// error, and fails on a failed, errored or cancelled build, on any other GitHub error, or when the
// wait runs out.

const API = 'https://api.github.com';
const API_HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
const VERCEL_BOT = 'vercel[bot]';

/** Vercel finishes a Preview in about 2 to 5 minutes; the wait stops well before the job limit. */
export const DEFAULT_TIMEOUT_MS = 15 * 60_000;
export const DEFAULT_INTERVAL_MS = 20_000;
/** One GitHub request; a slower answer counts as a transient error. */
export const REQUEST_TIMEOUT_MS = 30_000;

const FULL_SHA = /^[0-9a-f]{40}$/;
const PULL_NUMBER = /^[1-9][0-9]{0,6}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
// The same hosts as `resolveE2eTarget` (apps/app/e2e/support/config.ts) allows for a Vercel Preview;
// e2e-sw-resolve-preview.test.mjs checks that both agree.
const VERCEL_PREVIEW_HOSTNAME =
    /^chipin-frontend-[a-z0-9]+(?:-[a-z0-9]+)*-sylliks-projects\.vercel\.app$/;
const WAITING_STATES = new Set(['pending', 'queued', 'in_progress']);

/** A GitHub answer worth retrying at the next interval: a network error, a timeout, 429 or 5xx. */
export class TransientGitHubError extends Error {}

/** How long a single read (the dispatched pull request) is retried after transient errors. */
export const READ_RETRY_TIMEOUT_MS = 2 * 60_000;

/** Runs `read`, retrying a `TransientGitHubError` every `intervalMs` until `timeoutMs` has passed. */
export const retryTransient = async (
    read,
    {
        timeoutMs = READ_RETRY_TIMEOUT_MS,
        intervalMs = DEFAULT_INTERVAL_MS,
        now = Date.now,
        sleep = delay,
        log = () => undefined,
    } = {},
) => {
    const deadline = now() + timeoutMs;
    for (;;) {
        try {
            return await read();
        } catch (error) {
            if (!(error instanceof TransientGitHubError) || now() + intervalMs > deadline) {
                throw error;
            }
            log(`Retrying: ${error.message}`);
            await sleep(intervalMs);
        }
    }
};

export const assertFullSha = (value, name = 'The commit SHA') => {
    if (typeof value !== 'string' || !FULL_SHA.test(value)) {
        throw new Error(`${name} must be a full 40-character lowercase commit SHA.`);
    }
    return value;
};

/** The Preview origin, or an error when the URL is not a Vercel Preview of this project. */
export const assertPreviewOrigin = value => {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error('The Preview URL is not an absolute URL.');
    }
    if (
        url.protocol !== 'https:' ||
        url.port !== '' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        !VERCEL_PREVIEW_HOSTNAME.test(url.hostname)
    ) {
        throw new Error(
            'The Preview URL is not allowlisted (https://chipin-frontend-*-sylliks-projects.vercel.app/).',
        );
    }
    return url.origin;
};

/**
 * Decides from the commit's deployments, each with its statuses (newest first, as GitHub lists
 * them): `ready` with the newest successful trusted Preview, `waiting` while none succeeded and one
 * is still building (or none exists yet), else `failed`. Only deployments and statuses created by
 * `vercel[bot]` count.
 * @param {Array<{ deployment: object, statuses: Array<object> }>} entries
 * @param {string} sha
 */
export const pickPreview = (entries, sha) => {
    const trusted = entries
        .filter(
            ({ deployment }) =>
                deployment?.environment === 'Preview' &&
                deployment?.creator?.login === VERCEL_BOT &&
                deployment?.sha === sha &&
                Number.isInteger(deployment?.id),
        )
        .map(({ deployment, statuses }) => ({
            deployment,
            statuses: statuses.filter(status => status?.creator?.login === VERCEL_BOT),
        }))
        .sort((left, right) => right.deployment.id - left.deployment.id);

    if (trusted.length === 0) {
        return { status: 'waiting', reason: 'no vercel[bot] Preview deployment yet' };
    }

    for (const { statuses } of trusted) {
        const latest = statuses[0]?.state;
        // `inactive` after a success: a newer deployment replaced it, its immutable URL still serves.
        const success =
            latest === 'success' || latest === 'inactive'
                ? statuses.find(status => status.state === 'success')
                : undefined;
        if (success) {
            return { status: 'ready', url: assertPreviewOrigin(success.environment_url) };
        }
    }

    const states = trusted.map(({ statuses }) => statuses[0]?.state ?? 'none');
    if (states.some(state => state === 'none' || WAITING_STATES.has(state))) {
        return { status: 'waiting', reason: `Preview build ${states.join(', ')}` };
    }
    return { status: 'failed', reason: `Preview build ${states.join(', ')}` };
};

export const createGitHubClient = ({ repository, token, fetchImpl = fetch }) => {
    if (typeof repository !== 'string' || !REPOSITORY.test(repository)) {
        throw new Error('GITHUB_REPOSITORY must be <owner>/<repo>.');
    }
    if (!token) {
        throw new Error('GITHUB_TOKEN is required.');
    }
    const get = path =>
        Promise.resolve()
            .then(() =>
                fetchImpl(`${API}/repos/${repository}${path}`, {
                    headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                }),
            )
            .catch(error => {
                // A network error or the request timeout; the message never holds the token.
                throw new TransientGitHubError(
                    `GitHub GET ${path} failed: ${error instanceof Error ? error.name : 'error'}.`,
                );
            })
            .then(response => {
                if (response.status === 429 || response.status >= 500) {
                    throw new TransientGitHubError(
                        `GitHub GET ${path} returned HTTP ${response.status}.`,
                    );
                }
                if (!response.ok) {
                    throw new Error(`GitHub GET ${path} returned HTTP ${response.status}.`);
                }
                return response.json();
            });
    const list = path =>
        get(path).then(value => {
            if (!Array.isArray(value)) {
                throw new Error(`GitHub GET ${path} did not return a list.`);
            }
            return value;
        });

    return {
        repository,
        readPull: number => get(`/pulls/${number}`),
        readDeployments: sha =>
            list(`/deployments?sha=${assertFullSha(sha)}&environment=Preview&per_page=100`).then(
                deployments =>
                    Promise.all(
                        deployments.map(deployment =>
                            list(
                                `/deployments/${Number(deployment?.id)}/statuses?per_page=100`,
                            ).then(statuses => ({ deployment, statuses })),
                        ),
                    ),
            ),
    };
};

/**
 * The commit to test.
 * @param {object} options
 * @param {string} options.eventName `pull_request` or `workflow_dispatch`
 * @param {string} [options.prHeadSha] the pull request head (`pull_request`)
 * @param {string} [options.target] the dispatch input: a pull request number or a full SHA
 * @param {string} options.repository `<owner>/<repo>`
 * @param {(number: string) => Promise<object>} options.readPull
 * @param {(sha: string) => Promise<boolean>} options.isOnBranch
 */
export const resolveTargetSha = async ({
    eventName,
    prHeadSha,
    target,
    repository,
    readPull,
    isOnBranch,
}) => {
    if (eventName === 'pull_request') {
        return assertFullSha(prHeadSha, 'The pull request head');
    }
    if (eventName !== 'workflow_dispatch') {
        throw new Error(`Unsupported event ${String(eventName)}.`);
    }
    const value = typeof target === 'string' ? target.trim() : '';
    if (PULL_NUMBER.test(value)) {
        const pull = await readPull(value);
        if (pull?.head?.repo?.full_name !== repository) {
            throw new Error(`Pull request #${value} does not come from ${repository}.`);
        }
        return assertFullSha(pull.head.sha, `The head of pull request #${value}`);
    }
    if (FULL_SHA.test(value)) {
        if (!(await isOnBranch(value))) {
            throw new Error(`Commit ${value} is not reachable from a branch of ${repository}.`);
        }
        return value;
    }
    throw new Error(
        'target must be a pull request number or a full 40-character lowercase commit SHA.',
    );
};

/** Polls until the commit's Preview is ready, failed, or `timeoutMs` has passed. */
export const waitForPreview = async ({
    sha,
    readDeployments,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    intervalMs = DEFAULT_INTERVAL_MS,
    now = Date.now,
    sleep = delay,
    log = () => undefined,
}) => {
    assertFullSha(sha);
    const deadline = now() + timeoutMs;

    for (;;) {
        let result;
        try {
            result = pickPreview(await readDeployments(sha), sha);
        } catch (error) {
            if (!(error instanceof TransientGitHubError)) {
                throw error;
            }
            result = { status: 'waiting', reason: error.message };
        }
        if (result.status === 'ready') {
            return result.url;
        }
        if (result.status === 'failed') {
            throw new Error(`The Vercel Preview of ${sha} did not build: ${result.reason}.`);
        }
        if (now() + intervalMs > deadline) {
            throw new Error(
                `No successful Vercel Preview of ${sha} after ${Math.round(timeoutMs / 60_000)} min (${result.reason}).`,
            );
        }
        log(`Waiting for the Vercel Preview of ${sha}: ${result.reason}`);
        await sleep(intervalMs);
    }
};

const execFileAsync = promisify(execFile);
const runGit = args => execFileAsync('git', args).then(({ stdout }) => stdout);

/**
 * True when a branch of the repository contains the commit. The workflow's own checkout has every
 * branch (`fetch-depth: 0`, history only); a commit that is on no branch, a fork's included, is
 * unknown there and makes `--contains` fail.
 */
export const createBranchCheck =
    (git = runGit) =>
    sha =>
        git(['branch', '--remotes', '--contains', assertFullSha(sha)]).then(
            branches => branches.trim() !== '',
            () => false,
        );

const readEventFile = async path => JSON.parse(await readFile(path, 'utf8'));

/** The pull request head SHA from the event payload of a `pull_request` run, else undefined. */
export const readPrHeadSha = async (env, readEvent = readEventFile) => {
    if (env.EVENT_NAME !== 'pull_request') {
        return undefined;
    }
    if (!env.GITHUB_EVENT_PATH) {
        throw new Error('GITHUB_EVENT_PATH is required on pull_request.');
    }
    const event = await readEvent(env.GITHUB_EVENT_PATH);
    const sha = event?.pull_request?.head?.sha;
    return typeof sha === 'string' ? sha : undefined;
};

export const main = async ({
    env = process.env,
    readEvent = readEventFile,
    fetchImpl = fetch,
    sleep = delay,
    git = runGit,
    log = () => undefined,
} = {}) => {
    if (!env.GITHUB_OUTPUT) {
        throw new Error('GITHUB_OUTPUT is required.');
    }
    const github = createGitHubClient({
        repository: env.GITHUB_REPOSITORY,
        token: env.GITHUB_TOKEN,
        fetchImpl,
    });
    const sha = await resolveTargetSha({
        eventName: env.EVENT_NAME,
        prHeadSha: await readPrHeadSha(env, readEvent),
        target: env.INPUT_TARGET,
        repository: github.repository,
        readPull: number => retryTransient(() => github.readPull(number), { sleep, log }),
        isOnBranch: createBranchCheck(git),
    });
    log(`Commit: ${sha}`);

    // A manual override, only on workflow_dispatch: allowlisted, but not tied to the commit.
    const override = env.EVENT_NAME === 'workflow_dispatch' ? env.PREVIEW_URL?.trim() : '';
    let url;
    if (override) {
        url = assertPreviewOrigin(override);
        log(
            `::warning title=Preview not verified::${url} was given by hand and is not checked against ${sha}; the tests of ${sha} run against it.`,
        );
    } else {
        url = await waitForPreview({ sha, readDeployments: github.readDeployments, sleep, log });
    }
    await appendFile(env.GITHUB_OUTPUT, `sha=${sha}\nurl=${url}\n`);
    return { sha, url };
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main({ log: message => process.stdout.write(`${message}\n`) })
        .then(({ url }) => {
            process.stdout.write(`Preview: ${url}\n`);
        })
        .catch(error => {
            process.stderr.write(
                `::error title=Preview not resolved::${error instanceof Error ? error.message : 'Preview resolution failed.'}\n`,
            );
            process.exitCode = 1;
        });
}
