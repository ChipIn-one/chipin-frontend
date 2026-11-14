import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

// The application version comes from git release tags `vX.Y.Z` (ChipIn-one/.github#172).
// A release tag is created by a workflow after a Vercel Production build succeeds, and the
// same commit is then redeployed: that second build sees the tag and becomes the release.
// Every other build is labelled `<latest release>-dev-<sha7>` and is never a release.

const SHORT_SHA_LENGTH = 7;
const LS_REMOTE_TIMEOUT_MS = 15_000;
const DEFAULT_REPO_OWNER = 'ChipIn-one';
const DEFAULT_REPO_SLUG = 'chipin-frontend';
const NO_RELEASE_VERSION = '0.0.0';
// Same shape as the tag filter in .github/workflows/release-on-production.yml: no leading zeros.
const RELEASE_TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const REPO_NAME_PART_PATTERN = /^[A-Za-z0-9._-]+$/u;
const TAG_REF_PREFIX = 'refs/tags/';
const PEELED_SUFFIX = '^{}';
const REPOSITORY_ROOT = resolve(process.cwd());

const normalizeValue = value => (typeof value === 'string' ? value.trim() : '');

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

const splitLines = output =>
    output
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

const readLocalHeadSha = () => readGitValue(['rev-parse', 'HEAD']);

// Local and CI builds: tags come from the local clone. A missing repository means no tags.
const readLocalTags = sha => ({
    pointsAt: splitLines(readGitValue(['tag', '--points-at', sha])),
    all: splitLines(readGitValue(['tag', '--list', 'v*'])),
});

// Vercel builds use a shallow clone without tags, so ask the public GitHub remote directly.
// Throws on a network error or timeout; the caller turns that into a warning.
const readRemoteTagRefs = repositoryUrl =>
    execFileSync('git', ['ls-remote', '--tags', repositoryUrl], {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: LS_REMOTE_TIMEOUT_MS,
    });

const writeWarning = message => {
    process.stderr.write(`${message}\n`);
};

const parseReleaseTag = tag => {
    const match = RELEASE_TAG_PATTERN.exec(tag);

    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

const compareReleaseTags = (left, right) => {
    const leftParts = parseReleaseTag(left);
    const rightParts = parseReleaseTag(right);

    for (let index = 0; index < leftParts.length; index += 1) {
        if (leftParts[index] !== rightParts[index]) {
            return leftParts[index] - rightParts[index];
        }
    }

    return 0;
};

const findHighestReleaseTag = tags => {
    const releaseTags = tags.filter(tag => parseReleaseTag(tag) !== null);

    if (releaseTags.length === 0) {
        return null;
    }

    return releaseTags.reduce((highest, tag) =>
        compareReleaseTags(tag, highest) > 0 ? tag : highest,
    );
};

// Parses `git ls-remote --tags` output. Annotated tags list the tag object first and the
// peeled commit as `<tag>^{}`; the peeled commit wins so both tag kinds map to a commit.
export const parseRemoteTagRefs = output => {
    const commitByTag = new Map();
    const peeledTags = new Set();

    for (const line of splitLines(output)) {
        const [objectSha, ref] = line.split(/\s+/u);

        if (!objectSha || !ref?.startsWith(TAG_REF_PREFIX)) {
            continue;
        }

        const refName = ref.slice(TAG_REF_PREFIX.length);
        const isPeeled = refName.endsWith(PEELED_SUFFIX);
        const tag = isPeeled ? refName.slice(0, -PEELED_SUFFIX.length) : refName;

        if (isPeeled) {
            commitByTag.set(tag, objectSha.toLowerCase());
            peeledTags.add(tag);
        } else if (!peeledTags.has(tag)) {
            commitByTag.set(tag, objectSha.toLowerCase());
        }
    }

    return commitByTag;
};

const resolveRepositoryUrl = env => {
    const owner = normalizeValue(env.VERCEL_GIT_REPO_OWNER);
    const slug = normalizeValue(env.VERCEL_GIT_REPO_SLUG);
    const useEnvRepository =
        REPO_NAME_PART_PATTERN.test(owner) && REPO_NAME_PART_PATTERN.test(slug);

    return useEnvRepository
        ? `https://github.com/${owner}/${slug}.git`
        : `https://github.com/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_SLUG}.git`;
};

const resolveCommitSha = ({
    env,
    pullRequestHeadSha,
    taskHeadSha,
    commitSha,
    localHeadSha,
    readLocalHeadSha: readLocalHeadShaFn,
}) =>
    getFirstValue([
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

// Returns { pointsAt, all } tag lists, or null when the remote lookup failed.
const lookupTags = ({ sha, env, readLocalTagsFn, readRemoteTagRefsFn, warn }) => {
    if (env.VERCEL !== '1') {
        return readLocalTagsFn(sha);
    }

    const repositoryUrl = resolveRepositoryUrl(env);

    try {
        const commitByTag = parseRemoteTagRefs(readRemoteTagRefsFn(repositoryUrl));
        const all = [...commitByTag.keys()];

        return { pointsAt: all.filter(tag => commitByTag.get(tag) === sha), all };
    } catch (error) {
        const reason = normalizeValue(error?.message) || String(error);

        warn(
            `[version-resolver] WARNING: could not read release tags from ${repositoryUrl} ` +
                `(${reason}). Building as ${NO_RELEASE_VERSION}-dev-${sha.slice(0, SHORT_SHA_LENGTH)}, ` +
                'not a release: no Sentry release or source map upload.',
        );

        return null;
    }
};

export const resolveAppVersionInfo = ({
    env = process.env,
    pullRequestHeadSha,
    taskHeadSha,
    commitSha,
    localHeadSha,
    readLocalHeadSha: readLocalHeadShaFn = readLocalHeadSha,
    readLocalTags: readLocalTagsFn = readLocalTags,
    readRemoteTagRefs: readRemoteTagRefsFn = readRemoteTagRefs,
    warn = writeWarning,
} = {}) => {
    const resolvedSha = resolveCommitSha({
        env,
        pullRequestHeadSha,
        taskHeadSha,
        commitSha,
        localHeadSha,
        readLocalHeadSha: readLocalHeadShaFn,
    }).toLowerCase();

    if (!resolvedSha) {
        throw new Error('A commit HEAD SHA is required to resolve the application version.');
    }

    const shortSha = resolvedSha.slice(0, SHORT_SHA_LENGTH);
    const tags = lookupTags({ sha: resolvedSha, env, readLocalTagsFn, readRemoteTagRefsFn, warn });
    const releaseTag = tags ? findHighestReleaseTag(tags.pointsAt) : null;

    if (releaseTag) {
        return { version: releaseTag.slice(1), isRelease: true, tag: releaseTag };
    }

    const latestReleaseTag = tags ? findHighestReleaseTag(tags.all) : null;
    const baseVersion = latestReleaseTag ? latestReleaseTag.slice(1) : NO_RELEASE_VERSION;

    return { version: `${baseVersion}-dev-${shortSha}`, isRelease: false, tag: null };
};

export const resolveAppVersion = options => resolveAppVersionInfo(options).version;
