// Design gate (D35, chipin-frontend#995): a PR that changes UI files needs an approved Claude Design mockup.
//
// The PR body names its Issue with one `Task identity: Owner/repo#N` line. That Issue must carry the owner's
// `design-approved` label and a `Design: <https link>` line pointing at the approved artifact. The owner's
// `no-design-needed` PR label exempts a change that touches UI files but changes nothing visible. A PR opened before
// this script landed on master is exempt. Any GitHub API error fails the check (fail closed).
//
// The workflow (.github/workflows/design-gate.yml) runs on `pull_request_target`: the workflow file and this script
// both come from master and no PR code is checked out or run, so a PR cannot weaken its own gate. The PR that adds
// the gate does not run it (master has no workflow yet). This script only reads; it writes nothing on GitHub.
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const APPROVED_LABEL = 'design-approved';
export const EXEMPT_LABEL = 'no-design-needed';
// The exemption date is the first master commit of this path: renaming the script moves that date, so do not rename
// it without hard-coding the date.
export const GATE_PATH = 'scripts/design-gate.mjs';
const DEFAULT_API_URL = 'https://api.github.com';
const PER_PAGE = 100;
const MAX_PAGES = 30;
const SHOWN_FILES = 5;

// packages/tokens/** is deliberately not UI here: code owns token values, a mockup never sets them (D17, D35).
const UI_PATTERNS = [
    /^apps\/app\/src\/.+\.(?:tsx|css)$/u,
    /\.module\.css$/u,
    /^apps\/.+\/styled\.tsx?$/u,
    /^apps\/site\/src\//u,
    /^apps\/app\/src\/i18n\/locales\//u,
    /^packages\/i18n-content\/common\//u, // shared UI copy the app and the site bundle
];
const NOT_UI_PATTERNS = [
    /\.(?:test|spec|stories)\.[^/]+$/u,
    /(?:^|\/)__tests__\//u,
    /^apps\/app\/src\/test\//u, // test support (render helpers, fixtures)
];

// True for a path whose change can alter what a user sees: app TSX and CSS, CSS Modules, legacy styled.ts files,
// site sources, locale files. Tests, test support and stories are not UI.
export function isUiFile(path) {
    if (typeof path !== 'string' || path.length === 0) return false;
    if (NOT_UI_PATTERNS.some(pattern => pattern.test(path))) return false;
    return UI_PATTERNS.some(pattern => pattern.test(path));
}

// The UI paths of a list of GitHub PR files. A rename counts when either side is UI; a removed file counts.
export function uiFiles(files) {
    const matches = [];
    for (const file of files) {
        for (const path of [file.filename, file.previous_filename]) {
            if (isUiFile(path) && !matches.includes(path)) matches.push(path);
        }
    }
    return matches;
}

const IDENTITY_LINE = /^Task identity:[ \t]*(\S+)[ \t]*\r?$/gmu;
const IDENTITY_VALUE = /^([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9._-]+)#([1-9]\d*)$/u;

// `Task identity: Owner/repo#N` (as written by scripts/create-pr.mjs) → { owner, repo, number }; null when the
// line is missing, malformed, or appears with conflicting values.
export function parseTaskIdentity(prBody) {
    const values = new Set(
        [...String(prBody ?? '').matchAll(IDENTITY_LINE)].map(([, value]) => value),
    );
    if (values.size !== 1) return null;
    const match = IDENTITY_VALUE.exec([...values][0]);
    if (!match) return null;
    return { owner: match[1], repo: match[2], number: Number(match[3]) };
}

const DESIGN_LINE =
    /^[ \t]*Design:[ \t]*(?:<?https:\/\/[^\s<>]+>?|\[[^\]\n]*\]\(https:\/\/[^\s)]+\))[ \t]*\r?$/mu;

// True when the Issue body has a line `Design: https://...` (also `<https://...>` or `[text](https://...)`). A line
// inside a code block also counts (accepted: only the owner approves, through the label).
export function hasDesignLink(issueBody) {
    return DESIGN_LINE.test(String(issueBody ?? ''));
}

const labelNames = labels =>
    (labels ?? []).map(label => (typeof label === 'string' ? label : label?.name));

const listFiles = paths => {
    const shown = paths
        .slice(0, SHOWN_FILES)
        .map(path => `\`${path}\``)
        .join(', ');
    return paths.length > SHOWN_FILES ? `${shown} and ${paths.length - SHOWN_FILES} more` : shown;
};

const AFTER_CHANGE =
    'After the Issue or the labels change, re-run this check or push a commit (an Issue edit does not retrigger it).';
const EXEMPT_HINT = `If the change touches UI files but changes nothing visible, the owner adds \`${EXEMPT_LABEL}\` to this PR.`;

// Escapes a message for a GitHub workflow command, so a file name with a newline cannot start another command.
export function escapeCommand(message) {
    return message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

// Decides the gate. `files` are GitHub PR file objects; `identity` is parseTaskIdentity's result; `issue` is the
// GitHub Issue ({ labels, body, pull_request }), or undefined when not read yet: then the result is
// `{ needsIssue: true }` once the decision depends on it. `repository` is GITHUB_REPOSITORY; dates are ISO strings;
// `gateSince` is null until the gate is on master.
export function evaluate({ repository, prLabels, prCreatedAt, gateSince, files, identity, issue }) {
    const ui = uiFiles(files ?? []);
    if (ui.length === 0) return { ok: true, reason: 'No UI files changed; no design needed.' };
    if (gateSince == null)
        return { ok: true, reason: 'The design gate is not on master yet; the check passes.' };
    if (Date.parse(prCreatedAt) < Date.parse(gateSince))
        return {
            ok: true,
            reason: `The PR was opened before the design gate landed (${gateSince}); it is exempt.`,
        };
    if (labelNames(prLabels).includes(EXEMPT_LABEL))
        return { ok: true, reason: `The owner marked this PR \`${EXEMPT_LABEL}\`.` };
    const changed = `This PR changes UI files (${listFiles(ui)}), so it needs an approved design (AGENTS.md rule 21, D35).`;
    if (!identity)
        return {
            ok: false,
            reason: `${changed} The PR body has no single \`Task identity: Owner/repo#N\` line, so the Issue cannot be checked: add it. ${EXEMPT_HINT}`,
        };
    const ref = `${identity.owner}/${identity.repo}#${identity.number}`;
    if (`${identity.owner}/${identity.repo}`.toLowerCase() !== String(repository).toLowerCase())
        return {
            ok: false,
            reason: `${changed} The Task identity ${ref} is not an Issue of ${repository}: name this repository's Issue. ${EXEMPT_HINT}`,
        };
    if (issue === undefined)
        return { ok: false, needsIssue: true, reason: `Issue ${ref} has not been read.` };
    if (issue?.pull_request)
        return {
            ok: false,
            reason: `${changed} The Task identity ${ref} is a pull request, not an Issue: name the Issue.`,
        };
    const askOwner = `Ask the owner to review the Claude Design mockup and, when approved, add the \`${APPROVED_LABEL}\` label and a \`Design: <https link to the approved artifact>\` line to ${ref}.`;
    if (!labelNames(issue?.labels).includes(APPROVED_LABEL))
        return {
            ok: false,
            reason: `${changed} Issue ${ref} has no \`${APPROVED_LABEL}\` label. ${askOwner} ${EXEMPT_HINT} ${AFTER_CHANGE}`,
        };
    if (!hasDesignLink(issue?.body))
        return {
            ok: false,
            reason: `${changed} Issue ${ref} has \`${APPROVED_LABEL}\` but no \`Design: <https link>\` line. ${askOwner} ${AFTER_CHANGE}`,
        };
    return { ok: true, reason: `Issue ${ref} has an approved design.` };
}

const requireEnv = (env, name) => {
    const value = env[name];
    if (!value) throw new Error(`${name} is required.`);
    return value;
};

// Reads the PR, its files, the gate's first master commit and the Issue, then evaluates. Returns the exit code.
export async function run({
    env = process.env,
    fetch = globalThis.fetch,
    log = text => process.stdout.write(`${text}\n`),
} = {}) {
    const repository = requireEnv(env, 'GITHUB_REPOSITORY');
    const prNumber = requireEnv(env, 'PR_NUMBER');
    const token = requireEnv(env, 'GITHUB_TOKEN');
    const apiUrl = (env.GITHUB_API_URL || DEFAULT_API_URL).replace(/\/+$/u, '');

    const getJson = async path => {
        const response = await fetch(`${apiUrl}${path}`, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
        if (!response.ok) throw new Error(`GitHub API ${path} returned HTTP ${response.status}.`);
        return response.json();
    };
    const getPages = async path => {
        const items = [];
        for (let page = 1; page <= MAX_PAGES; page += 1) {
            const separator = path.includes('?') ? '&' : '?';
            const batch = await getJson(`${path}${separator}per_page=${PER_PAGE}&page=${page}`);
            if (!Array.isArray(batch)) throw new Error(`GitHub API ${path} did not return a list.`);
            items.push(...batch);
            if (batch.length < PER_PAGE) return items;
        }
        throw new Error(
            `GitHub API ${path} has more than ${MAX_PAGES} pages; the gate fails closed.`,
        );
    };

    const pr = await getJson(`/repos/${repository}/pulls/${prNumber}`);
    const files = await getPages(`/repos/${repository}/pulls/${prNumber}/files`);
    // Commits are listed newest first, so the last one is the commit that added the gate to master.
    const gateCommits = await getPages(
        `/repos/${repository}/commits?sha=master&path=${encodeURIComponent(GATE_PATH)}`,
    );
    const gateSince = gateCommits.at(-1)?.commit?.committer?.date ?? null;
    const identity = parseTaskIdentity(pr.body);
    const facts = {
        repository,
        prLabels: pr.labels,
        prCreatedAt: pr.created_at,
        gateSince,
        files,
        identity,
    };
    // The Issue is read only when the decision depends on it, so an exempt PR never fails on that request.
    let result = evaluate(facts);
    if (result.needsIssue) {
        const issue = await getJson(
            `/repos/${identity.owner}/${identity.repo}/issues/${identity.number}`,
        );
        result = evaluate({ ...facts, issue: issue ?? null });
    }
    log(result.ok ? result.reason : `::error::${escapeCommand(result.reason)}`);
    if (env.GITHUB_STEP_SUMMARY) {
        await appendFile(
            env.GITHUB_STEP_SUMMARY,
            `## Design gate: ${result.ok ? 'passed' : 'failed'}\n\n${result.reason}\n`,
        );
    }
    return result.ok ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    run().then(
        code => process.exit(code),
        error => {
            process.stdout.write(
                `::error::${escapeCommand(error instanceof Error ? error.message : 'The design gate failed.')}\n`,
            );
            process.exit(1);
        },
    );
}
