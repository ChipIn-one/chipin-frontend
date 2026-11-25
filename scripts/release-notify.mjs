// Builds the Slack message of the `notify` job of release-on-production.yml (chipin-frontend#484).
//
// One message per Promote to Production, from the guard result and the release engine outcome. The rule table is the
// one of #484: RELEASED is the full message (Release link, Included Issues from the Release body, SHA, deployment URL,
// a warning when the redeploy did not succeed); ALREADY_RELEASED of the newest tag is silent (the redeploy's own status
// or a re-posted one); an older tag is a rollback; a guard skip or any other outcome is a short factual line.
//
// Inputs come only from env; every external value is escaped for Slack mrkdwn (`&`, `<`, `>`). Outputs `text` (heredoc
// form with a random delimiter) and `post=true|false` to GITHUB_OUTPUT. The script never fails the job: any error is a
// `::warning::` and `post=false`.
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const TAG = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ISSUE_REF = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#([1-9][0-9]*)\b(.*)$/;
const MAX_ISSUES = 30;

export const escapeMrkdwn = value =>
    String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

// An https URL as a Slack link, or null. `|` and whitespace would break the `<url|label>` syntax.
const safeUrl = value => {
    if (!value) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return null;
        const text = url.href;
        return /[\s|]/u.test(text) ? null : text;
    } catch {
        return null;
    }
};
const link = (url, label) => {
    const safe = safeUrl(url);
    return safe ? `<${escapeMrkdwn(safe)}|${escapeMrkdwn(label)}>` : escapeMrkdwn(label);
};

const parseTag = tag => {
    const match = TAG.exec(tag ?? '');
    return match ? match.slice(1, 4).map(Number) : null;
};
// -1, 0 or 1; null when either is not a vX.Y.Z tag.
export function compareTags(a, b) {
    const left = parseTag(a);
    const right = parseTag(b);
    if (!left || !right) return null;
    for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
    return 0;
}

// The bullet lines of the `## Included Issues` section of a Release body, without the bullet marker.
export function includedIssues(body) {
    const lines = String(body ?? '').split(/\r?\n/u);
    const start = lines.findIndex(line => /^##\s+Included Issues\s*$/iu.test(line.trim()));
    if (start === -1) return [];
    const items = [];
    for (const line of lines.slice(start + 1)) {
        if (/^#{1,2}\s/u.test(line.trim())) break;
        const item = /^\s*[-*]\s+(.+?)\s*$/u.exec(line);
        if (item) items.push(item[1]);
    }
    return items;
}

// `Owner/repo#N (…)` becomes a link to the Issue; anything else is escaped text.
const issueLine = (item, serverUrl) => {
    const match = ISSUE_REF.exec(item);
    if (!match) return `• ${escapeMrkdwn(item)}`;
    const [, repo, number, rest] = match;
    return `• ${link(`${serverUrl}/${repo}/issues/${number}`, `${repo}#${number}`)}${escapeMrkdwn(rest)}`;
};

const shaText = ({ sha, repository, serverUrl }) => {
    if (!SHA.test(sha ?? ''))
        return `\`${escapeMrkdwn(String(sha ?? 'unknown').replaceAll('`', ''))}\``;
    if (!REPOSITORY.test(repository ?? '')) return `\`${sha.slice(0, 7)}\``;
    return link(`${serverUrl}/${repository}/commit/${sha}`, sha.slice(0, 7));
};
const deploymentLine = deploymentUrl => {
    const safe = safeUrl(deploymentUrl);
    return safe ? `Deployment: ${link(safe, safe)}` : null;
};

/**
 * Pure rule table of #484. Input fields (all strings, possibly empty):
 * guardRelease, skipReason, sha, newestTag, releaseResult, outcome, tag, redeployResult, repository, serverUrl,
 * deploymentUrl, releaseUrl, releaseBody. Returns { post: boolean, text: string }.
 */
export function decideMessage(input) {
    const serverUrl = safeUrl(input.serverUrl)
        ? input.serverUrl.replace(/\/+$/u, '')
        : 'https://github.com';
    const ctx = { ...input, serverUrl };
    const app = REPOSITORY.test(input.repository ?? '')
        ? escapeMrkdwn(input.repository.split('/')[1])
        : 'frontend';
    const sha = shaText(ctx);
    const deployment = deploymentLine(input.deploymentUrl);
    const lines = (...items) => items.filter(Boolean).join('\n');

    if (input.guardRelease !== 'true') {
        if (input.skipReason === 'rollback-untagged') {
            const newest = TAG.test(input.newestTag ?? '')
                ? ` (behind the newest tag ${escapeMrkdwn(input.newestTag)})`
                : '';
            return {
                post: true,
                text: lines(
                    `:rewind: *${app}: Rollback to an untagged commit* ${sha}${newest}. No release.`,
                    deployment,
                ),
            };
        }
        if (input.skipReason === 'not-on-master')
            return {
                post: true,
                text: lines(
                    `:information_source: *${app}: not released* - Production runs ${sha}, which is not on master.`,
                    deployment,
                ),
            };
        if (input.skipReason === 'not-in-history')
            return {
                post: true,
                text: lines(
                    `:information_source: *${app}: not released* - Production runs ${sha}, which is not in the repository history.`,
                    deployment,
                ),
            };
        return {
            post: true,
            text: `:information_source: *${app}: not released* - Production runs ${sha} (guard: ${escapeMrkdwn(input.skipReason || 'no reason')}).`,
        };
    }

    if (input.outcome === 'RELEASED') {
        const tag = escapeMrkdwn(input.tag || 'unknown tag');
        const releaseUrl =
            safeUrl(input.releaseUrl) ??
            (REPOSITORY.test(input.repository ?? '') && TAG.test(input.tag ?? '')
                ? `${serverUrl}/${input.repository}/releases/tag/${input.tag}`
                : null);
        const issues = includedIssues(input.releaseBody);
        const shown = issues.slice(0, MAX_ISSUES).map(item => issueLine(item, serverUrl));
        if (issues.length > MAX_ISSUES) shown.push(`• and ${issues.length - MAX_ISSUES} more`);
        const redeployWarning =
            input.redeployResult === 'success'
                ? null
                : `:warning: The redeploy of the tagged build did not succeed (${escapeMrkdwn(input.redeployResult || 'unknown')}): the live build still shows the untagged label. Redeploy it by hand in Vercel.`;
        return {
            post: true,
            text: lines(
                `:rocket: *${app} ${tag} released*${releaseUrl ? ` - ${link(releaseUrl, 'Release notes')}` : ''}`,
                issues.length > 0
                    ? `*Included Issues*\n${shown.join('\n')}`
                    : typeof input.releaseBody === 'string'
                      ? 'Included Issues: none listed in the Release'
                      : 'Included Issues: the Release could not be read, see the Release notes',
                `SHA: ${sha}`,
                deployment,
                redeployWarning,
            ),
        };
    }

    if (input.outcome === 'ALREADY_RELEASED') {
        const order = compareTags(input.tag, input.newestTag);
        if (order === 0) return { post: false, text: '' };
        if (order === -1)
            return {
                post: true,
                text: lines(
                    `:rewind: *${app}: Rollback to ${escapeMrkdwn(input.tag)}* - Production runs ${sha}.`,
                    deployment,
                ),
            };
    }

    const outcome = input.outcome
        ? escapeMrkdwn(input.outcome)
        : `no outcome (release job ${escapeMrkdwn(input.releaseResult || 'unknown')})`;
    const tag = input.tag ? `, tag ${escapeMrkdwn(input.tag)}` : '';
    return {
        post: true,
        text: `:information_source: *${app}: release ${outcome}*${tag} - Production runs ${sha}.`,
    };
}

export function readInput(env) {
    return {
        guardRelease: env.GUARD_RELEASE ?? '',
        skipReason: env.GUARD_SKIP_REASON ?? '',
        sha: env.DEPLOYED_SHA ?? '',
        newestTag: env.NEWEST_TAG ?? '',
        releaseResult: env.RELEASE_RESULT ?? '',
        outcome: env.RELEASE_OUTCOME ?? '',
        tag: env.RELEASE_TAG ?? '',
        redeployResult: env.REDEPLOY_RESULT ?? '',
        repository: env.GITHUB_REPOSITORY ?? '',
        serverUrl: env.GITHUB_SERVER_URL ?? '',
        deploymentUrl: env.DEPLOYMENT_ENVIRONMENT_URL || env.DEPLOYMENT_TARGET_URL || '',
    };
}

// GET /repos/{repo}/releases/tags/{tag}; { url, body } or throws.
export async function fetchRelease({ env, fetchImpl, timeoutMs }) {
    const api = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/u, '');
    const url = `${api}/repos/${env.GITHUB_REPOSITORY}/releases/tags/${encodeURIComponent(env.RELEASE_TAG)}`;
    const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok)
        throw new Error(`GET the Release ${env.RELEASE_TAG} returned HTTP ${response.status}`);
    const release = await response.json();
    return { url: release?.html_url ?? '', body: release?.body ?? '' };
}

export const outputBlock = (name, value, delimiter = `ghadelimiter_${randomUUID()}`) => {
    if (String(value).includes(delimiter))
        throw new Error('The output value contains the delimiter.');
    return `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
};

const message = error => (error instanceof Error ? error.message : String(error));

export async function main(
    env = process.env,
    {
        fetchImpl = globalThis.fetch,
        write = text => process.stdout.write(text),
        output = text => appendFileSync(env.GITHUB_OUTPUT, text),
        timeoutMs = 10000,
    } = {},
) {
    try {
        const input = readInput(env);
        if (input.guardRelease === 'true' && input.outcome === 'RELEASED' && TAG.test(input.tag)) {
            if (!REPOSITORY.test(input.repository) || !env.GITHUB_TOKEN) {
                write(
                    '::warning::Cannot read the GitHub Release: GITHUB_REPOSITORY or GITHUB_TOKEN is missing.\n',
                );
            } else {
                try {
                    const release = await fetchRelease({ env, fetchImpl, timeoutMs });
                    input.releaseUrl = release.url;
                    input.releaseBody = release.body;
                } catch (error) {
                    write(`::warning::Posting without Included Issues: ${message(error)}.\n`);
                }
            }
        }
        const result = decideMessage(input);
        output(`${outputBlock('text', result.text)}post=${result.post}\n`);
        write(
            result.post ? `Slack message:\n${result.text}\n` : 'No Slack message for this run.\n',
        );
        return result;
    } catch (error) {
        write(`::warning::No Slack release message: ${message(error)}.\n`);
        try {
            output('post=false\n');
        } catch (outputError) {
            write(`::warning::Could not write GITHUB_OUTPUT: ${message(outputError)}.\n`);
        }
        return { post: false, text: '' };
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main()
        .catch(() => undefined)
        .finally(() => {
            process.exitCode = 0;
        });
}
