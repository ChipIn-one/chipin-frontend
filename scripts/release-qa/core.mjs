import { impactChecks, smokeChecks, touchesSmokePath } from './impact-rules.mjs';
import { isUiAffecting, uiAffectingFiles } from './ui-paths.mjs';

export const REPOSITORY = 'ChipIn-one/chipin-frontend';
const FULL_SHA = /^[0-9a-f]{40}$/;
const QA_MARKER = /<!-- chipin-release-qa:v1 repo=ChipIn-one\/chipin-frontend sha=([0-9a-f]{40}) deployment=([1-9]\d*) -->/g;
const RESULT_LINE = /^qa\s+(pass|fail|blocked)$/i;
const SLACK_USER_ID = /^U[A-Z0-9]{8,}$/;
export const RELEASE_OWNER = 'syllik';

export function assertFullSha(value, label = 'SHA') {
    if (!FULL_SHA.test(value ?? '')) throw new Error(`${label} must be a full lowercase 40-character SHA.`);
    return value;
}

export function isSlackWebhook(value) {
    return typeof value === 'string' && /^https:\/\/hooks\.slack\.com\/services\/[^\s]+$/.test(value);
}

export function assertConfiguration(env, qaLogin) {
    for (const key of ['CHIPIN_DEV_READ_TOKEN', 'CHIPIN_ISSUE_WRITE_TOKEN', 'SLACK_WEBHOOK_CI', 'SLACK_USER_MAP']) {
        if (!env[key]) throw new Error(`${key} is required before a QA handoff.`);
    }
    if (!isSlackWebhook(env.SLACK_WEBHOOK_CI)) {
        throw new Error('SLACK_WEBHOOK_CI must be a Slack Incoming Webhook URL.');
    }
    let map;
    try { map = JSON.parse(env.SLACK_USER_MAP); } catch { throw new Error('SLACK_USER_MAP must be JSON.'); }
    const slackId = map?.[qaLogin];
    if (typeof slackId !== 'string' || !SLACK_USER_ID.test(slackId)) {
        throw new Error(`SLACK_USER_MAP must map ${qaLogin} to an explicit Slack user ID.`);
    }
    return { slackId };
}

export function validateDeployment(deployment, status, environment, expectedSha = null) {
    if (!Number.isInteger(deployment?.id) || deployment.id <= 0 || deployment.environment !== environment
        || deployment.creator?.login !== 'vercel[bot]') {
        throw new Error(`A trusted vercel[bot] ${environment} deployment is required.`);
    }
    const sha = assertFullSha(deployment.sha, 'Deployment SHA');
    if (expectedSha && sha !== assertFullSha(expectedSha)) throw new Error('Deployment SHA does not match the selected candidate SHA.');
    if (deployment.ref !== sha && deployment.ref !== 'master') throw new Error('Deployment ref is not master or the exact SHA.');
    if (status?.state !== 'success') throw new Error(`${environment} deployment latest status must be success.`);
    const rawUrl = status.environment_url;
    let url;
    try { url = new URL(rawUrl); } catch { throw new Error('Deployment has no valid immutable public URL.'); }
    const previewSlug = /^chipin-frontend-([a-z0-9]+)-sylliks-projects\.vercel\.app$/.exec(url.hostname)?.[1];
    const isPreviewBuild = Boolean(previewSlug) && previewSlug !== 'master';
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash
        || (environment === 'Preview' && !isPreviewBuild)
        || (environment === 'Production' && url.hostname !== 'chipin.one' && !isPreviewBuild)) {
        throw new Error('Deployment URL must be an immutable Vercel build URL, not a moving alias.');
    }
    return { id: deployment.id, sha, url: url.href.replace(/\/$/, ''), statusId: status.id ?? null };
}

function latestEvidence(values, label) {
    if (values.length === 0) return null;
    let latest = values[0];
    for (const value of values.slice(1)) {
        if (!Number.isInteger(value.id) || !Number.isInteger(latest.id) || value.id === latest.id) {
            throw new Error(`Required context ${label} has ambiguous duplicate evidence.`);
        }
        if (value.id > latest.id) latest = value;
    }
    return latest;
}

export function verifyCi(rule, checks, runs, sha, statuses = []) {
    assertFullSha(sha);
    const required = rule?.required_status_checks;
    if (!Array.isArray(required) || required.length === 0) throw new Error('Active master ruleset has no readable required-check policy.');
    const checkRule = required.find(item => item.context === 'frontend-ci');
    if (!checkRule || !Number.isInteger(checkRule.integration_id)) throw new Error('Active policy does not require trusted frontend-ci.');
    for (const entry of required) {
        if (!entry?.context || (entry.integration_id != null && !Number.isInteger(entry.integration_id))) {
            throw new Error('Active required-check policy contains unreadable context/integration.');
        }
        const contextChecks = checks.filter(item => item.name === entry.context && item.head_sha === sha);
        const latestCheck = latestEvidence(contextChecks, entry.context);
        const latestStatus = entry.integration_id == null
            ? latestEvidence(statuses.filter(item => item.context === entry.context && item.sha === sha), entry.context)
            : null;
        if (latestCheck && latestStatus) throw new Error(`Required context ${entry.context} has ambiguous Check and commit-status producers.`);
        if (latestCheck) {
            if (latestCheck.status !== 'completed' || latestCheck.conclusion !== 'success'
                || (entry.integration_id != null && latestCheck.app?.id !== entry.integration_id)
                || (entry.context === 'frontend-ci' && latestCheck.app?.slug !== 'github-actions')) {
                throw new Error(`Required context ${entry.context} is not successful at exact SHA from the required producer.`);
            }
            continue;
        }
        if (!latestStatus || latestStatus.state !== 'success') {
            throw new Error(`Required context ${entry.context} has no current successful exact SHA evidence.`);
        }
    }
    const run = latestEvidence(masterPushRuns(runs, sha), 'frontend-ci workflow');
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
        throw new Error('No current successful master push frontend-ci workflow run for exact SHA.');
    }
    return true;
}

function masterPushRuns(runs, sha) {
    return runs.filter(item => item.head_sha === sha && item.head_branch === 'master'
        && item.path === '.github/workflows/frontend-ci.yml' && item.event === 'push');
}

// Cheap candidate filter for zero-input resolution; verifyCi stays the full trust check.
export function hasGreenFrontendCiRun(runs, sha) {
    let latest = null;
    for (const run of masterPushRuns(runs, sha)) {
        if (!latest || (Number.isInteger(run.id) && run.id > latest.id)) latest = run;
    }
    return Boolean(latest) && latest.status === 'completed' && latest.conclusion === 'success';
}

function qaSteps(body, issueNumber) {
    const checks = [];
    for (const line of (body ?? '').split('\n')) {
        const qaNote = /^\s*-\s*\[[ xX]\]\s*QA:\s*(.+?)\s*=>\s*(.+?)\s*$/.exec(line);
        const criterion = /^\s*-\s*\[[ xX]\]\s*(?:Given .+?,\s*)?When\s+(.+?),\s*then\s+(.+?)\s*$/i.exec(line);
        const match = qaNote ?? criterion;
        if (match) checks.push({ issue: issueNumber, step: match[1], expected: match[2] });
    }
    return checks;
}

function issueUrl(issue) {
    return issue.html_url ?? `https://github.com/${REPOSITORY}/issues/${issue.number}`;
}

// The Production-to-candidate compare decides whether manual QA is needed at all: only UI-affecting
// paths (scripts/release-qa/ui-paths.mjs) do. Work without one canonical Issue link blocks only when
// it touches those paths; an included UI Issue without QA lines gets a check-against-Acceptance line.
export function buildChecklist({ files, commits, pulls, issues, commitFiles = {} }) {
    if (!Array.isArray(files) || files.length === 0 || !Array.isArray(commits) || commits.length === 0) {
        throw new Error('Complete compare files and commits are required.');
    }
    const byIssue = new Map(issues.map(issue => [issue.number, issue]));
    const included = new Map();
    const noQa = [];
    const seenCommits = new Set();
    for (const pull of pulls) {
        if (!Number.isInteger(pull.number) || !Array.isArray(pull.issues)) throw new Error('PR evidence is unreadable.');
        if (!Array.isArray(pull.files)) throw new Error(`PR #${pull.number} files are unreadable.`);
        const pullCommits = pull.commits ?? [];
        for (const commit of pullCommits) seenCommits.add(commit);
        const touchesUi = pull.files.some(isUiAffecting);
        if (pull.issues.length !== 1) {
            if (touchesUi) throw new Error(`PR #${pull.number} touches UI-affecting paths without one canonical Issue link.`);
            noQa.push({ pull: pull.number, commits: [...pullCommits] });
            continue;
        }
        const issueNumber = pull.issues[0];
        if (!byIssue.has(issueNumber)) throw new Error(`Canonical Issue #${issueNumber} is unreadable.`);
        const linked = included.get(issueNumber) ?? { pulls: new Set(), needsManualQa: false, paths: new Set() };
        linked.pulls.add(pull.number);
        if (touchesUi) linked.needsManualQa = true;
        for (const path of pull.files) linked.paths.add(path);
        included.set(issueNumber, linked);
    }
    for (const commit of commits) {
        if (seenCommits.has(commit)) continue;
        const changed = Object.hasOwn(commitFiles, commit) ? commitFiles[commit] : null;
        if (!Array.isArray(changed)) throw new Error(`Candidate contains unlinked commit ${commit} with unreadable files.`);
        if (changed.some(isUiAffecting)) throw new Error(`Candidate contains unlinked commit ${commit} that touches UI-affecting paths.`);
        noQa.push({ commit });
    }
    const includedList = [];
    for (const [issueNumber, linked] of included) {
        includedList.push({ issue: issueNumber, pulls: [...linked.pulls].sort((a, b) => a - b) });
    }
    includedList.sort((a, b) => a.issue - b.issue);
    if (uiAffectingFiles(files).length === 0) {
        return { kind: 'none', reason: 'NO_MANUAL_QA_REQUIRED', evidence: files, included: includedList, noQa };
    }
    const smoke = touchesSmokePath(files);
    const checks = [];
    const missingSteps = [];
    for (const [issueNumber, linked] of included) {
        if (!linked.needsManualQa) continue;
        const issue = byIssue.get(issueNumber);
        const steps = qaSteps(issue.body, issueNumber);
        if (steps.length === 0) {
            missingSteps.push(issueNumber);
            checks.push({ issue: issueNumber, step: `check against the Acceptance of #${issueNumber}`, expected: issueUrl(issue), missing: true });
        } else {
            checks.push(...steps);
        }
        // SMOKE-SHORT already ends with AUTH-041; never add the same check twice.
        if (!smoke) checks.push(...impactChecks([...linked.paths], issueNumber));
    }
    if (smoke) checks.push(...smokeChecks());
    if (checks.length === 0) throw new Error('UI-affecting compare has no included UI Issue or smoke checks.');
    missingSteps.sort((a, b) => a - b);
    return { kind: 'checks', checks, included: includedList, missingSteps, noQa, smoke };
}

function renderCheck(item) {
    const label = item.smoke ? 'SMOKE-SHORT' : `#${item.issue}`;
    const source = item.source && item.source !== 'SMOKE-SHORT' ? ` ([${item.source}](${item.sourceUrl}))` : '';
    return `- [ ] ${label}: ${item.step} => ${item.expected}${source}`;
}

function renderNoQa(item) {
    return item.pull ? `- PR #${item.pull} (no canonical Issue, no UI-affecting paths)` : `- ${item.commit} (no PR, no UI-affecting paths)`;
}

export function buildIssueBody({ sha, baselineSha, deploymentId, url, plan }) {
    assertFullSha(sha);
    assertFullSha(baselineSha, 'Production baseline SHA');
    if (plan.kind !== 'checks') throw new Error('A QA Issue requires explicit checks.');
    const marker = `<!-- chipin-release-qa:v1 repo=${REPOSITORY} sha=${sha} deployment=${deploymentId} -->`;
    const included = plan.included.map(item => `- #${item.issue} via ${item.pulls.map(number => `PR #${number}`).join(', ')}`).join('\n') || '- None';
    const checks = plan.checks.map(renderCheck).join('\n');
    const missing = plan.missingSteps?.length
        ? `\n\n### Missing QA steps\n${plan.missingSteps.map(number => `- #${number} has no \`- [ ] QA:\` lines; check it against its Acceptance.`).join('\n')}`
        : '';
    const noQa = plan.noQa?.length ? `\n\n### No QA needed\n${plan.noQa.map(renderNoQa).join('\n')}` : '';
    return `${marker}\n## Problem\nRelease candidate ${sha} needs manual frontend QA.\n\n## Outcome\nOwner reviews this Issue before deciding whether to manually Promote the selected deployment.\n\n## Acceptance\n- Candidate SHA: ${sha}\n- Previous verified Production SHA: ${baselineSha}\n- Preview deployment: ${deploymentId}\n- Immutable Preview URL: ${url}\n\n### Included work\n${included}\n\n### Checks (step => expected)\n${checks}${missing}${noQa}\n\n### QA result\nPost a new comment whose first line is \`QA PASS\`, \`QA FAIL\` or \`QA BLOCKED\`; notes may follow on the next lines. Only the assigned QA counts. Checkboxes alone are not acceptance.\n\n### Defects and retest\n- Defect links: add canonical Bug Issues here.\n\n## Dependencies\n- Manual owner Promote only after owner review.\n\n## References\n- https://github.com/${REPOSITORY}/blob/master/docs/engineering/release-qa.md\n`;
}

export function findQaIssue(issues, sha, deploymentId, url) {
    assertFullSha(sha);
    const matches = [];
    for (const issue of issues) {
        const markers = [...(issue.body ?? '').matchAll(QA_MARKER)];
        if (markers.length > 1) throw new Error(`Issue #${issue.number} has ambiguous QA markers.`);
        if (markers.length === 1 && markers[0][1] === sha) matches.push({ issue, marker: markers[0] });
    }
    if (matches.length > 1) throw new Error(`duplicate QA Issues for ${sha}; resolve manually.`);
    if (matches.length === 0) return null;
    const match = matches[0];
    if (Number(match.marker[2]) !== deploymentId || !match.issue.body.includes(`- Immutable Preview URL: ${url}\n`)) {
        throw new Error('Same-SHA QA Issue has conflicting deployment identity or URL.');
    }
    return match.issue;
}

// The first non-empty line, trimmed and case-insensitive, is the result. Notes may follow.
export function resultOutcome(body) {
    if (typeof body !== 'string') return null;
    for (const line of body.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        return RESULT_LINE.exec(trimmed)?.[1].toUpperCase() ?? null;
    }
    return null;
}

export function parseQaResult(comment, issue) {
    const markers = [...(issue?.body ?? '').matchAll(QA_MARKER)];
    if (markers.length !== 1) throw new Error('QA Issue has no single candidate SHA marker.');
    if (!comment?.created_at || comment.updated_at !== comment.created_at) throw new Error('QA result comment was edited or has ambiguous timestamps.');
    const login = comment.user?.login ?? '';
    if (comment.user?.type !== 'User' || /\[bot\]$/i.test(login)) throw new Error('QA result author must be a human user.');
    const assignees = (issue.assignees ?? []).map(item => item.login).filter(name => name.toLowerCase() !== RELEASE_OWNER);
    if (assignees.length !== 1) throw new Error('QA Issue has no sole currently assigned QA.');
    if (login.toLowerCase() === RELEASE_OWNER || login.toLowerCase() !== assignees[0].toLowerCase()) {
        throw new Error('QA result author is not the sole currently assigned QA.');
    }
    const outcome = resultOutcome(comment.body);
    if (!outcome) throw new Error('QA result must start with QA PASS, QA FAIL or QA BLOCKED.');
    return { outcome, sha: markers[0][1], qa: login };
}

// Builds the Slack line from validated values only; comment text never reaches Slack.
export function formatResultLine({ result, issueUrl, userMap }) {
    let map = null;
    try { map = JSON.parse(userMap ?? ''); } catch { map = null; }
    const ownerId = map?.[RELEASE_OWNER];
    const mention = typeof ownerId === 'string' && SLACK_USER_ID.test(ownerId) ? `<@${ownerId}>` : RELEASE_OWNER;
    return `${mention} Frontend QA ${result.outcome} by ${result.qa} for ${result.sha}: ${issueUrl}`;
}
