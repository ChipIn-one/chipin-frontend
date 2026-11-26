// Builds the Slack message of the `notify` job of release-on-production.yml (chipin-frontend#484, compact form #908).
//
// One message per Promote to Production, from the guard result and the release engine outcome. The rule table is the
// one of #484: RELEASED is the full message (Release link, Included Issues from the Release body, SHA, deployment URL,
// a warning when the redeploy did not succeed); ALREADY_RELEASED of the newest tag is silent (the redeploy's own status
// or a re-posted one); an older tag is a rollback; a guard skip or any other outcome is a short factual line.
// Included Issues are compact (#908): one line per native Issue Type (`Bug (8): #704 #714 ...`), linked numbers only,
// at most MAX_PER_LINE numbers per line and then `+N more`; PR numbers stay in the Release body. The types come from
// one GraphQL read (`issues: read`); if it fails, one ungrouped `Issues (n):` line is posted instead. GITHUB_TOKEN reads
// only this repository and public ones, so an Issue of a private sibling repository lands under `No type`.
// The same read takes each Issue's state and milestone (#919): one `Milestone:` line shows the progress of the product
// goals (ChipIn-one/.github#300) of the Included Issues, `<title> done/total done`, at most MAX_MILESTONES and then
// `+N more`. Done is the milestone's closed Issues plus the Included Issues still open (the completion run closes them in
// parallel with this job). Milestones of the same title are one goal and are summed. No milestone, no line.
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
// Numbers shown on one Slack line; the rest is `+N more` (the Release notes have the full list).
const MAX_PER_LINE = 15;
// Issues whose type is read in the one GraphQL request; any further ones are listed under NO_TYPE.
const MAX_TYPE_READS = 100;
// Native types in this order, then any other type by name, then Issues without a readable type.
const TYPE_ORDER = ['Feature', 'Bug', 'Task'];
const NO_TYPE = 'No type';
// Milestones shown on the `Milestone:` line; the rest is `+N more`.
const MAX_MILESTONES = 3;
const MAX_INT32 = 2147483647;
// Fields read per Included Issue: type, state, and the milestone with its closed and total Issue counts.
const ISSUE_FIELDS =
    'issueType { name } state milestone { number title url closed: issues(states: [CLOSED]) { totalCount } all: issues { totalCount } }';

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

// The Issue refs of the Included Issues items, deduplicated, in Release order: { key, repo, number } for
// `Owner/repo#N (…)` (the `(#PR)` part is dropped) or { key, text } for an item that is not a ref.
export function issueRefs(items) {
    const seen = new Set();
    const refs = [];
    for (const item of items) {
        const match = ISSUE_REF.exec(item);
        const ref = match
            ? { key: `${match[1]}#${match[2]}`, repo: match[1], number: Number(match[2]) }
            : { key: item, text: item };
        if (seen.has(ref.key)) continue;
        seen.add(ref.key);
        refs.push(ref);
    }
    return refs;
}

// GitHub owner and repository names are case-insensitive.
const sameName = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
// `#N` for an Issue of this repository, `repo#N` for another repository of the same owner, `Owner/repo#N` otherwise.
const refLabel = (ref, repository) => {
    if (sameName(ref.repo, repository)) return `#${ref.number}`;
    const [owner, name] = ref.repo.split('/');
    return REPOSITORY.test(repository ?? '') && sameName(repository.split('/')[0], owner)
        ? `${name}#${ref.number}`
        : ref.key;
};
// Issues of this repository first, then by repository and number; items that are not refs keep their order last.
const refOrder = repository => (a, b) => {
    if (!a.repo || !b.repo) return (a.repo ? 0 : 1) - (b.repo ? 0 : 1);
    const own = (sameName(b.repo, repository) ? 1 : 0) - (sameName(a.repo, repository) ? 1 : 0);
    if (own !== 0) return own;
    const [left, right] = [a.repo.toLowerCase(), b.repo.toLowerCase()];
    if (left !== right) return left < right ? -1 : 1;
    return a.number - b.number;
};
// External text for a single `::warning::` line (no line break can start another workflow command).
const oneLine = value =>
    String(value ?? '')
        .replace(/\s+/gu, ' ')
        .trim();
// A type name as one plain word group: no line breaks and no mrkdwn markers that would break the bold label.
const typeName = name =>
    typeof name === 'string' ? name.replace(/[\s*_~`]+/gu, ' ').trim() || null : null;
const typeRank = type => {
    const index = TYPE_ORDER.indexOf(type);
    if (index !== -1) return [0, index, ''];
    return type === NO_TYPE ? [2, 0, ''] : [1, 0, type];
};
const typeOrder = (a, b) => {
    const [left, right] = [typeRank(a), typeRank(b)];
    for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
    return 0;
};

// One line `*Label (count):* #N #N ... +N more` with every number a link to its Issue.
const refsLine = (label, refs, { serverUrl, repository }) => {
    const sorted = [...refs].sort(refOrder(repository));
    const shown = sorted
        .slice(0, MAX_PER_LINE)
        .map(ref =>
            ref.repo
                ? link(`${serverUrl}/${ref.repo}/issues/${ref.number}`, refLabel(ref, repository))
                : escapeMrkdwn(ref.text),
        );
    if (sorted.length > MAX_PER_LINE) shown.push(`+${sorted.length - MAX_PER_LINE} more`);
    return `*${escapeMrkdwn(label)} (${refs.length}):* ${shown.join(' ')}`;
};

// The Included Issues lines: grouped by type when `issueTypes` (a Map of ref key to type name or null) is given,
// otherwise one ungrouped `Issues (n):` line.
const issueLines = (refs, issueTypes, ctx) => {
    if (!(issueTypes instanceof Map)) return [refsLine('Issues', refs, ctx)];
    const groups = new Map();
    for (const ref of refs) {
        const type = (ref.repo && typeName(issueTypes.get(ref.key))) || NO_TYPE;
        if (!groups.has(type)) groups.set(type, []);
        groups.get(type).push(ref);
    }
    return [...groups.keys()].sort(typeOrder).map(type => refsLine(type, groups.get(type), ctx));
};

const count = value => (Number.isSafeInteger(value) && value >= 0 ? value : null);

// The `Milestone:` line, or null. `issueMilestones` is a Map of ref key to { repo, number, title, url, closed, total,
// open } (`open`: this Included Issue is still open) or null. Milestones of the same title are one product goal: their
// counts are summed and the link goes to this repository's milestone when it has one. Goals with more Included Issues
// come first.
const milestoneLine = (refs, issueMilestones, { repository }) => {
    if (!(issueMilestones instanceof Map)) return null;
    const goals = new Map();
    for (const ref of refs) {
        const milestone = ref.repo ? issueMilestones.get(ref.key) : null;
        const title = typeName(milestone?.title);
        const closed = count(milestone?.closed);
        const total = count(milestone?.total);
        if (!title || closed === null || total === null || !Number.isSafeInteger(milestone.number))
            continue;
        const name = title.toLowerCase();
        if (!goals.has(name))
            goals.set(name, { title, url: null, milestones: new Map(), open: 0, included: 0 });
        const goal = goals.get(name);
        goal.milestones.set(`${String(milestone.repo).toLowerCase()}#${milestone.number}`, {
            closed,
            total,
        });
        if (safeUrl(milestone.url) && (!goal.url || sameName(milestone.repo, repository)))
            goal.url = milestone.url;
        goal.included += 1;
        if (milestone.open === true) goal.open += 1;
    }
    if (goals.size === 0) return null;
    const sorted = [...goals.values()].sort(
        (a, b) => b.included - a.included || a.title.localeCompare(b.title, 'en'),
    );
    const shown = sorted.slice(0, MAX_MILESTONES).map(goal => {
        const sums = [...goal.milestones.values()];
        const total = sums.reduce((sum, item) => sum + item.total, 0);
        const done = Math.min(total, sums.reduce((sum, item) => sum + item.closed, 0) + goal.open);
        return `${link(goal.url, goal.title)} ${done}/${total} done`;
    });
    const more = sorted.length > MAX_MILESTONES ? `, +${sorted.length - MAX_MILESTONES} more` : '';
    return `*${sorted.length === 1 ? 'Milestone' : 'Milestones'}:* ${shown.join(', ')}${more}`;
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
 * deploymentUrl, releaseUrl, releaseBody; issueTypes is a Map of `Owner/repo#N` to type name or null (absent when
 * the type read failed); issueMilestones is a Map of `Owner/repo#N` to a milestone (see milestoneLine) or null (absent
 * when the read failed). Returns { post: boolean, text: string }.
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
        const refs = issueRefs(includedIssues(input.releaseBody));
        const redeployWarning =
            input.redeployResult === 'success'
                ? null
                : `:warning: The redeploy of the tagged build did not succeed (${escapeMrkdwn(input.redeployResult || 'unknown')}): the live build still shows the untagged label. Redeploy it by hand in Vercel.`;
        return {
            post: true,
            text: lines(
                `:rocket: *${app} ${tag} released*${releaseUrl ? ` - ${link(releaseUrl, 'Release notes')}` : ''}`,
                refs.length > 0
                    ? [
                          ...issueLines(refs, input.issueTypes, ctx),
                          milestoneLine(refs, input.issueMilestones, ctx),
                      ]
                          .filter(Boolean)
                          .join('\n')
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

// One GraphQL read of the native Issue Type, state and milestone of each ref (at most MAX_TYPE_READS). Returns
// { types, milestones }: Maps of ref key to type name and to { repo, number, title, url, closed, total, open }, each
// null for an Issue without one or one the token cannot read; throws when the request itself fails or when it answers
// only errors. Partial GraphQL errors (an unreadable repository or Issue) go to `warn`.
export async function fetchIssueDetails({
    env,
    fetchImpl,
    timeoutMs,
    refs,
    warn = () => undefined,
}) {
    const api = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/u, '');
    const url = env.GITHUB_GRAPHQL_URL || `${api}/graphql`;
    const byRepo = new Map();
    const readable = refs.filter(
        item => item.repo && Number.isSafeInteger(item.number) && item.number <= MAX_INT32,
    );
    for (const ref of readable.slice(0, MAX_TYPE_READS)) {
        if (!byRepo.has(ref.repo)) byRepo.set(ref.repo, []);
        byRepo.get(ref.repo).push(ref);
    }
    const types = new Map();
    const milestones = new Map();
    if (byRepo.size === 0) return { types, milestones };
    const variables = {};
    const params = [];
    const fields = [...byRepo.entries()].map(([repo, items], r) => {
        const [owner, name] = repo.split('/');
        variables[`o${r}`] = owner;
        variables[`n${r}`] = name;
        params.push(`$o${r}: String!`, `$n${r}: String!`);
        const issues = items
            .map((ref, i) => `i${i}: issue(number: ${ref.number}) { ${ISSUE_FIELDS} }`)
            .join(' ');
        return `r${r}: repository(owner: $o${r}, name: $n${r}) { ${issues} }`;
    });
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: `query(${params.join(', ')}) { ${fields.join(' ')} }`,
            variables,
        }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`the Issue Type read returned HTTP ${response.status}`);
    const result = await response.json();
    const data = result?.data;
    if (!data || typeof data !== 'object') throw new Error('the Issue Type read returned no data');
    [...byRepo.values()].forEach((items, r) =>
        items.forEach((ref, i) => {
            const issue = data[`r${r}`]?.[`i${i}`];
            types.set(ref.key, typeName(issue?.issueType?.name));
            const milestone = issue?.milestone;
            milestones.set(
                ref.key,
                milestone && typeof milestone === 'object'
                    ? {
                          repo: ref.repo,
                          number: milestone.number,
                          title: milestone.title,
                          url: milestone.url,
                          closed: milestone.closed?.totalCount,
                          total: milestone.all?.totalCount,
                          open: issue.state === 'OPEN',
                      }
                    : null,
            );
        }),
    );
    const errors = Array.isArray(result?.errors) ? result.errors : [];
    if (errors.length > 0) {
        if (
            [...types.values()].every(name => name === null) &&
            [...milestones.values()].every(milestone => milestone === null)
        )
            throw new Error(`the Issue Type read returned ${errors.length} error(s) and no type`);
        const first = errors[0];
        warn(
            `${errors.length} Issue(s) without a readable type (${oneLine(first?.type ?? 'error')}: ${oneLine(first?.message).slice(0, 200)})`,
        );
    }
    return { types, milestones };
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
                const refs = issueRefs(includedIssues(input.releaseBody));
                if (refs.some(ref => ref.repo)) {
                    try {
                        const details = await fetchIssueDetails({
                            env,
                            fetchImpl,
                            timeoutMs,
                            refs,
                            warn: text => write(`::warning::${text}.\n`),
                        });
                        input.issueTypes = details.types;
                        input.issueMilestones = details.milestones;
                    } catch (error) {
                        write(
                            `::warning::Posting the Issues without Issue Types and milestones: ${message(error)}.\n`,
                        );
                    }
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
