import { impactChecks } from './impact-rules.mjs';

export const REPOSITORY = 'ChipIn-one/chipin-frontend';
const FULL_SHA = /^[0-9a-f]{40}$/;
const QA_MARKER = /<!-- chipin-release-qa:v1 repo=ChipIn-one\/chipin-frontend sha=([0-9a-f]{40}) deployment=([1-9]\d*) -->/g;

export function assertFullSha(value, label = 'SHA') {
    if (!FULL_SHA.test(value ?? '')) throw new Error(`${label} must be a full lowercase 40-character SHA.`);
    return value;
}

export function assertConfiguration(env, qaLogin) {
    for (const key of ['CHIPIN_DEV_READ_TOKEN', 'CHIPIN_ISSUE_WRITE_TOKEN', 'SLACK_WEBHOOK_CI', 'SLACK_USER_MAP']) {
        if (!env[key]) throw new Error(`${key} is required before a QA handoff.`);
    }
    if (!/^https:\/\/hooks\.slack\.com\/services\/[^\s]+$/.test(env.SLACK_WEBHOOK_CI)) {
        throw new Error('SLACK_WEBHOOK_CI must be a Slack Incoming Webhook URL.');
    }
    let map;
    try { map = JSON.parse(env.SLACK_USER_MAP); } catch { throw new Error('SLACK_USER_MAP must be JSON.'); }
    const slackId = map?.[qaLogin];
    if (typeof slackId !== 'string' || !/^U[A-Z0-9]{8,}$/.test(slackId)) {
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
    const run = latestEvidence(runs.filter(item => item.head_sha === sha && item.head_branch === 'master'
        && item.path === '.github/workflows/frontend-ci.yml' && item.event === 'push'), 'frontend-ci workflow');
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
        throw new Error('No current successful master push frontend-ci workflow run for exact SHA.');
    }
    return true;
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

export function buildChecklist({ files, commits, pulls, issues }) {
    if (!Array.isArray(files) || files.length === 0 || !Array.isArray(commits) || commits.length === 0) {
        throw new Error('Complete compare files and commits are required.');
    }
    const docsOnly = files.every(file => /^docs\/[^\s]+\.md$/.test(file) || file === 'README.md');
    const byIssue = new Map(issues.map(issue => [issue.number, issue]));
    const included = new Map();
    const seenCommits = new Set();
    for (const pull of pulls) {
        if (!Number.isInteger(pull.number) || !Array.isArray(pull.issues) || pull.issues.length !== 1) {
            throw new Error('PR has missing or ambiguous canonical Issue link.');
        }
        const issueNumber = pull.issues[0];
        if (!byIssue.has(issueNumber)) throw new Error(`Canonical Issue #${issueNumber} is unreadable.`);
        const linked = included.get(issueNumber) ?? { pulls: new Set(), needsManualQa: false, paths: new Set() };
        linked.pulls.add(pull.number);
        if (!pull.docsOnly) linked.needsManualQa = true;
        for (const path of pull.files ?? []) linked.paths.add(path);
        included.set(issueNumber, linked);
        for (const commit of pull.commits ?? []) seenCommits.add(commit);
    }
    for (const commit of commits) {
        if (!seenCommits.has(commit)) throw new Error(`Candidate contains unlinked commit ${commit}.`);
    }
    const checks = [];
    const includedList = [];
    for (const [issueNumber, linked] of included) {
        if (linked.needsManualQa) {
            const steps = qaSteps(byIssue.get(issueNumber).body, issueNumber);
            if (steps.length === 0) throw new Error(`Issue #${issueNumber} lacks explicit QA step => expected notes.`);
            checks.push(...steps);
            checks.push(...impactChecks([...linked.paths], issueNumber));
        }
        includedList.push({ issue: issueNumber, pulls: [...linked.pulls].sort((a, b) => a - b) });
    }
    includedList.sort((a, b) => a.issue - b.issue);
    if (docsOnly) {
        if ([...included.values()].some(item => item.needsManualQa)) throw new Error('Docs-only compare conflicts with PR file evidence.');
        return { kind: 'none', reason: 'NO_MANUAL_QA_REQUIRED', evidence: files, included: includedList };
    }
    if (checks.length === 0) throw new Error('User-facing work has no justified manual checks.');
    return { kind: 'checks', checks, included: includedList };
}

export function buildIssueBody({ sha, baselineSha, deploymentId, url, plan }) {
    assertFullSha(sha);
    assertFullSha(baselineSha, 'Production baseline SHA');
    if (plan.kind !== 'checks') throw new Error('A QA Issue requires explicit checks.');
    const marker = `<!-- chipin-release-qa:v1 repo=${REPOSITORY} sha=${sha} deployment=${deploymentId} -->`;
    const included = plan.included.map(item => `- #${item.issue} via ${item.pulls.map(number => `PR #${number}`).join(', ')}`).join('\n');
    const checks = plan.checks.map(item => `- [ ] #${item.issue}: ${item.step} → ${item.expected}${item.source ? ` ([${item.source}](${item.sourceUrl}))` : ''}`).join('\n');
    return `${marker}\n## Problem\nRelease candidate ${sha} needs manual frontend QA.\n\n## Outcome\nOwner reviews this Issue before deciding whether to manually Promote the selected deployment.\n\n## Acceptance\n- Candidate SHA: ${sha}\n- Previous verified Production SHA: ${baselineSha}\n- Preview deployment: ${deploymentId}\n- Immutable Preview URL: ${url}\n\n### Included work\n${included}\n\n### Checks (step → expected)\n${checks}\n\n### QA result\nThe currently assigned QA comments using the documented SHA-bound format. Checkboxes alone are not acceptance.\n\n### Defects and retest\n- Defect links: add canonical Bug Issues here.\n- Approximate total time: report once in the result comment.\n\n## Dependencies\n- Manual owner Promote only after owner review.\n\n## References\n- https://github.com/${REPOSITORY}/issues/438\n`;
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

export function parseQaResult(comment, issue, sha) {
    assertFullSha(sha);
    const markers = [...(issue?.body ?? '').matchAll(QA_MARKER)];
    if (markers.length !== 1 || markers[0][1] !== sha) throw new Error('QA Issue/candidate SHA identity mismatch.');
    if (!comment?.created_at || comment.updated_at !== comment.created_at) throw new Error('QA result comment was edited or has ambiguous timestamps.');
    if (comment.user?.type !== 'User') throw new Error('QA result author must be a human user.');
    const assignees = (issue.assignees ?? []).map(item => item.login).filter(login => login !== 'syllik');
    if (assignees.length !== 1 || comment.user.login.toLowerCase() !== assignees[0].toLowerCase()) {
        throw new Error('QA result author is not the sole currently assigned QA.');
    }
    const body = comment.body ?? '';
    const resultLines = [...body.matchAll(/^QA RESULT:\s*(PASS|FAIL|BLOCKED)\s*$/gm)];
    if (resultLines.length !== 1 || (body.match(/QA RESULT:/g) ?? []).length !== 1) throw new Error('QA result is missing or ambiguous.');
    const shaLines = [...body.matchAll(/^SHA:\s*([0-9a-f]{40})\s*$/gm)];
    if (shaLines.length !== 1 || shaLines[0][1] !== sha || (body.match(/SHA:/g) ?? []).length !== 1) throw new Error('QA result SHA mismatch or ambiguous.');
    const timeLines = [...body.matchAll(/^TOTAL TIME:\s*([1-9]\d*)m\s*$/gm)];
    if (timeLines.length !== 1 || (body.match(/TOTAL TIME:/g) ?? []).length !== 1) throw new Error('QA result requires one approximate total time in minutes.');
    return { outcome: resultLines[0][1], sha, minutes: Number(timeLines[0][1]), qa: comment.user.login };
}
