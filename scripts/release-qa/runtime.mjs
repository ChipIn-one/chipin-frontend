import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    REPOSITORY, assertConfiguration, assertFullSha, buildChecklist,
    buildIssueBody, findQaIssue, parseQaResult, validateDeployment, verifyCi,
} from './core.mjs';

const API = 'https://api.github.com';
const REPO_PATH = `/repos/${REPOSITORY}`;
const API_HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };

export class GitHubApi {
    constructor(token, fetchImpl = fetch) {
        if (!token) throw new Error('GitHub token is required.');
        this.token = token;
        this.fetchImpl = fetchImpl;
    }

    request(path, { method = 'GET', body } = {}) {
        return this.fetchImpl(`${API}${path}`, {
            method,
            headers: { ...API_HEADERS, Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        }).then(response => {
            if (!response.ok) throw new Error(`GitHub ${method} ${path} returned HTTP ${response.status}.`);
            return response.status === 204 ? null : response.json();
        });
    }

    list(path) {
        const collected = [];
        const separator = path.includes('?') ? '&' : '?';
        const next = page => this.request(`${path}${separator}per_page=100&page=${page}`).then(batch => {
            if (!Array.isArray(batch)) throw new Error(`GitHub ${path} did not return a list.`);
            collected.push(...batch);
            return batch.length === 100 ? next(page + 1) : collected;
        });
        return next(1);
    }

    listObject(path, key) {
        const collected = [];
        const separator = path.includes('?') ? '&' : '?';
        const next = page => this.request(`${path}${separator}per_page=100&page=${page}`).then(data => {
            if (!Array.isArray(data?.[key]) || !Number.isInteger(data.total_count)) throw new Error(`GitHub ${path} pagination is incomplete.`);
            collected.push(...data[key]);
            if (collected.length >= data.total_count) return collected;
            if (data[key].length !== 100) throw new Error(`GitHub ${path} returned only ${collected.length}/${data.total_count}.`);
            return next(page + 1);
        });
        return next(1);
    }

    graphql(query, variables) {
        return this.request('/graphql', { method: 'POST', body: { query, variables } }).then(data => {
            if (data.errors?.length) throw new Error(`GitHub GraphQL returned ${data.errors.length} error(s).`);
            return data.data;
        });
    }
}

export function assertAncestry(candidateToMaster, baselineToCandidate, candidateSha, baselineSha) {
    assertFullSha(candidateSha);
    assertFullSha(baselineSha, 'Production baseline SHA');
    if (!['ahead', 'identical'].includes(candidateToMaster?.status)) throw new Error('Candidate is outside current master ancestry.');
    if (!['ahead', 'identical'].includes(baselineToCandidate?.status)) throw new Error('Candidate does not contain the verified Production baseline.');
    return true;
}

export function assertRetrySafe(runs, currentRunId, sha, existingIssue) {
    assertFullSha(sha);
    if (existingIssue) return true;
    if (!Number.isInteger(currentRunId) || currentRunId <= 0) throw new Error('Current GitHub run ID is required for create safety.');
    if (runs.some(run => run.id !== currentRunId && run.display_title === `QA prepare ${sha}`)) {
        throw new Error('Earlier same-SHA QA preparation has ambiguous create outcome; locate its Issue/checkpoint manually before retrying.');
    }
    return true;
}

export function chooseProductionBaseline(deployments, statusesFor) {
    const candidates = deployments.filter(item => item.environment === 'Production' && item.creator?.login === 'vercel[bot]');
    const next = index => {
        if (index >= candidates.length) throw new Error('No verified previous Production deployment exists.');
        const deployment = candidates[index];
        return statusesFor(deployment.id).then(statuses => {
            if (!Array.isArray(statuses) || statuses.length === 0 || statuses[0]?.state !== 'success') return next(index + 1);
            const value = validateDeployment(deployment, statuses[0], 'Production');
            return value;
        });
    };
    return next(0);
}

export function sendHandoff({ post, webhook, slackId, issue, sha, url }) {
    const payload = { text: `<@${slackId}> Frontend QA candidate ${sha}\n${url}\nCanonical QA Issue: ${issue.html_url}` };
    return post(webhook, payload).then(() => ({ delivered: true })).catch(() => ({
        delivered: false,
        reason: 'Slack delivery failed; retry the same SHA after checking webhook/channel.',
    }));
}

export function postSlack(webhook, payload, fetchImpl = fetch) {
    return fetchImpl(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(response => {
            if (!response.ok) throw new Error('Slack webhook returned a non-success status.');
            return true;
        });
}

export function probePublicPreview(url, fetchImpl = fetch) {
    return fetchImpl(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000) }).then(response => {
        if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') ?? '')) {
            throw new Error('Selected Preview URL is not publicly accessible as an HTML page.');
        }
        return true;
    }).catch(() => { throw new Error('Selected Preview URL is not publicly accessible as an HTML page.'); });
}

function compare(api, base, head, full = false) {
    return api.request(`${REPO_PATH}/compare/${base}...${head}?per_page=${full ? 100 : 1}&page=1`).then(first => {
        if (!full) return first;
        if (!Array.isArray(first.commits) || !Array.isArray(first.files) || first.files.length >= 300
            || !Number.isInteger(first.total_commits)) {
            throw new Error('Compare files/commits exceed complete GitHub evidence bounds; manual scope review required.');
        }
        const commits = [...first.commits];
        const next = page => {
            if (commits.length >= first.total_commits) return { ...first, commits };
            return api.request(`${REPO_PATH}/compare/${base}...${head}?per_page=100&page=${page}`).then(data => {
                if (!Array.isArray(data.commits) || data.commits.length === 0) throw new Error('Compare commit pagination incomplete.');
                commits.push(...data.commits);
                return next(page + 1);
            });
        };
        return next(2);
    });
}

function pullIssues(api, pull) {
    if (!pull.node_id || !pull.merged_at || pull.base?.ref !== 'master') throw new Error(`PR #${pull.number} is not a verified merged master PR.`);
    const query = `query($id: ID!) { node(id: $id) { ... on PullRequest { closingIssuesReferences(first: 100) { totalCount nodes { number repository { nameWithOwner } } } } } }`;
    return api.graphql(query, { id: pull.node_id }).then(data => {
        const refs = data?.node?.closingIssuesReferences;
        if (!refs || refs.totalCount !== refs.nodes?.length || refs.totalCount !== 1
            || refs.nodes[0].repository?.nameWithOwner !== REPOSITORY) {
            throw new Error(`PR #${pull.number} lacks one unambiguous native closing Issue link.`);
        }
        return refs.nodes[0].number;
    });
}

function readIncludedWork(api, compared) {
    const commits = compared.commits.map(item => item.sha);
    const files = compared.files.flatMap(item => item.previous_filename ? [item.filename, item.previous_filename] : [item.filename]);
    if (files.every(file => /^docs\/[^\s]+\.md$/.test(file) || file === 'README.md')) {
        return Promise.resolve(buildChecklist({ files, commits, pulls: [], issues: [] }));
    }
    const pullMap = new Map();
    const nextCommit = index => {
        if (index === commits.length) return Promise.resolve();
        const sha = commits[index];
        return api.list(`${REPO_PATH}/commits/${sha}/pulls`).then(pulls => {
            if (pulls.length !== 1) throw new Error(`Commit ${sha} has missing or ambiguous PR evidence.`);
            const pull = pulls[0];
            const current = pullMap.get(pull.number) ?? { ...pull, commits: [] };
            current.commits.push(sha);
            pullMap.set(pull.number, current);
            return nextCommit(index + 1);
        });
    };
    return nextCommit(0).then(() => {
        const pulls = [...pullMap.values()];
        return Promise.all(pulls.map(pull => Promise.all([
            pullIssues(api, pull),
            api.list(`${REPO_PATH}/pulls/${pull.number}/files`),
        ]).then(([number, changed]) => {
            if (changed.length === 0) throw new Error(`PR #${pull.number} files are unreadable.`);
            const docsOnly = changed.every(file => {
                const names = file.previous_filename ? [file.filename, file.previous_filename] : [file.filename];
                return names.every(name => /^docs\/[^\s]+\.md$/.test(name) || name === 'README.md');
            });
            return { ...pull, issues: [number], docsOnly };
        })));
    }).then(pulls => {
        const issueNumbers = [...new Set(pulls.map(pull => pull.issues[0]))];
        return Promise.all(issueNumbers.map(number => api.request(`${REPO_PATH}/issues/${number}`).then(issue => {
            if (issue.pull_request || issue.repository_url !== `${API}${REPO_PATH}`) throw new Error(`Issue #${number} is not a canonical frontend Issue.`);
            return issue;
        }))).then(issues => buildChecklist({ files, commits, pulls, issues }));
    });
}

function activeCiRule(api) {
    return api.request(`${REPO_PATH}/rules/branches/master`).then(rules => {
        if (!Array.isArray(rules)) throw new Error('Active master ruleset is unreadable.');
        const values = [];
        for (const rule of rules) {
            if (rule.type === 'required_status_checks') values.push(...(rule.parameters?.required_status_checks ?? []));
        }
        return { required_status_checks: values };
    });
}

function readDeploymentEvidence(api, id, sha) {
    return api.request(`${REPO_PATH}/deployments/${id}`).then(deployment => api.list(`${REPO_PATH}/deployments/${id}/statuses`)
        .then(statuses => ({ deployment, statuses }))).then(({ deployment, statuses }) => {
        if (statuses.length === 0) throw new Error('Preview deployment has no status.');
        return validateDeployment(deployment, statuses[0], 'Preview', sha);
    });
}

function readCandidate(api, id, sha, probe) {
    return readDeploymentEvidence(api, id, sha).then(preview => probe(preview.url).then(() => preview));
}

function readCi(api, sha) {
    return Promise.all([
        activeCiRule(api),
        api.listObject(`${REPO_PATH}/commits/${sha}/check-runs`, 'check_runs'),
        api.listObject(`${REPO_PATH}/actions/workflows/frontend-ci.yml/runs?head_sha=${sha}&event=push`, 'workflow_runs'),
    ]).then(([rule, checks, runs]) => verifyCi(rule, checks, runs, sha));
}

function loadShared(root) {
    const dir = resolve(root, 'automation');
    return Promise.all([
        import(pathToFileURL(join(dir, 'issue-intake.mjs')).href),
        import(pathToFileURL(join(dir, 'issue-admission.mjs')).href),
        import(pathToFileURL(join(dir, 'github-metadata.mjs')).href),
        readFile(join(dir, 'metadata-migration.config.json'), 'utf8').then(JSON.parse),
    ]).then(([intake, admission, metadata, config]) => ({ intake, admission, metadata, config, configPath: join(dir, 'metadata-migration.config.json') }));
}

function admitQaIssue(shared, token, issueNumber) {
    return shared.admission.readAdmission({
        client: new shared.metadata.GitHubClient(token), config: shared.config,
        repository: REPOSITORY, number: issueNumber,
    }).then(result => {
        shared.admission.assertFreshReceipt(result.receipt, { issue: `${REPOSITORY}#${issueNumber}` });
        return result.receipt;
    });
}

function assignQa(readApi, writeApi, issue, qaLogin, reassign) {
    return readApi.request(`${REPO_PATH}/assignees/${encodeURIComponent(qaLogin)}`).then(() => {
        const current = (issue.assignees ?? []).map(user => user.login);
        if (!current.includes('syllik')) throw new Error('Canonical QA Issue is missing required owner syllik.');
        const other = current.filter(login => login !== 'syllik' && login.toLowerCase() !== qaLogin.toLowerCase());
        if (other.length && !reassign) throw new Error('QA assignment changed; explicit owner reassignment is required.');
        const remove = other.length ? writeApi.request(`${REPO_PATH}/issues/${issue.number}/assignees`, { method: 'DELETE', body: { assignees: other } }) : Promise.resolve();
        return remove.then(() => current.some(login => login.toLowerCase() === qaLogin.toLowerCase())
            ? null : writeApi.request(`${REPO_PATH}/issues/${issue.number}/assignees`, { method: 'POST', body: { assignees: [qaLogin] } }));
    }).then(() => readApi.request(`${REPO_PATH}/issues/${issue.number}`)).then(fresh => {
        const names = (fresh.assignees ?? []).map(user => user.login.toLowerCase());
        if (!names.includes('syllik') || names.filter(name => name !== 'syllik').length !== 1 || !names.includes(qaLogin.toLowerCase())) {
            throw new Error('QA assignment read-back did not confirm owner and one configured QA.');
        }
        return fresh;
    });
}

function createCanonicalIssue(shared, env, body, sha, priority) {
    return mkdtemp(join(tmpdir(), 'chipin-release-qa-')).then(dir => {
        const bodyPath = join(dir, 'body.md');
        const args = [
            'apply', 'create', REPOSITORY, '--title', `Release QA ${sha}`,
            '--body-file', bodyPath, '--type', 'Task', '--priority', priority,
            '--severity', 'none', '--state', join(dir, 'create-state.json'),
            '--output', join(dir, 'intake-result.json'), '--config', shared.configPath,
            '--activate', 'issue-intake-v1',
        ];
        return writeFile(bodyPath, body, { mode: 0o600 }).then(() => shared.intake.run(args, {
            ...env, GITHUB_TOKEN: env.CHIPIN_ISSUE_WRITE_TOKEN, CHIPIN_ISSUE_WRITE: '1',
        })).then(result => {
            if (result.action !== 'complete' || result.receipt?.status !== 'INTAKE_COMPLETE') {
                throw new Error(`Canonical intake incomplete for ${sha}: ${result.blockers?.join('; ') || result.pending?.code || 'unknown read-back'}`);
            }
            return Number(result.issue.split('#')[1]);
        });
    });
}

export function prepareReleaseQa({ env, readApi, writeApi, sharedRoot, post = postSlack, probe = probePublicPreview }) {
    const sha = assertFullSha(env.CANDIDATE_SHA, 'Candidate SHA');
    const deploymentId = Number(env.PREVIEW_DEPLOYMENT_ID);
    const qaLogin = env.QA_LOGIN || 'SoRawSteak';
    const priority = env.QA_PRIORITY;
    if (!Number.isSafeInteger(deploymentId) || deploymentId <= 0) throw new Error('PREVIEW_DEPLOYMENT_ID must be a positive integer.');
    if (!['P0', 'P1', 'P2', 'P3'].includes(priority)) throw new Error('QA_PRIORITY must explicitly be P0, P1, P2, or P3.');
    if (env.GITHUB_ACTOR !== 'syllik' || env.GITHUB_TRIGGERING_ACTOR !== 'syllik' || env.GITHUB_REF !== 'refs/heads/master') {
        throw new Error('Only release owner syllik may select a candidate from trusted master workflow code.');
    }
    const currentRunId = Number(env.GITHUB_RUN_ID);
    let preview, baseline, plan;
    return Promise.all([
        readCandidate(readApi, deploymentId, sha, probe),
        readCi(readApi, sha),
        readApi.list(`${REPO_PATH}/deployments?environment=Production`).then(deployments => chooseProductionBaseline(
            deployments, id => readApi.list(`${REPO_PATH}/deployments/${id}/statuses`),
        )),
        compare(readApi, sha, 'master'),
    ]).then(([selected, , production, candidateToMaster]) => {
        preview = selected;
        baseline = production;
        return compare(readApi, baseline.sha, sha, true).then(scope => {
            assertAncestry(candidateToMaster, scope, sha, baseline.sha);
            return readIncludedWork(readApi, scope);
        });
    }).then(included => {
        plan = included;
        if (plan.kind === 'none') return { outcome: 'NO_MANUAL_QA_REQUIRED', sha, baseline, evidence: plan.evidence };
        const { slackId } = assertConfiguration(env, qaLogin);
        if (!writeApi) throw new Error('CHIPIN_ISSUE_WRITE_TOKEN transport is required.');
        return Promise.all([
            readApi.list(`${REPO_PATH}/issues?state=all`),
            readApi.listObject(`${REPO_PATH}/actions/workflows/prepare-release-qa.yml/runs?event=workflow_dispatch`, 'workflow_runs'),
            loadShared(sharedRoot),
        ]).then(([issues, runs, shared]) => Promise.all(plan.included.map(item =>
            admitQaIssue(shared, env.CHIPIN_DEV_READ_TOKEN, item.issue))).then(() => {
            const existing = findQaIssue(issues.filter(item => !item.pull_request), sha, deploymentId, preview.url);
            assertRetrySafe(runs, currentRunId, sha, existing);
            const body = buildIssueBody({ sha, baselineSha: baseline.sha, deploymentId, url: preview.url, plan });
            const obtain = existing ? Promise.resolve(existing) : createCanonicalIssue(shared, env, body, sha, priority)
                .then(number => readApi.request(`${REPO_PATH}/issues/${number}`));
            return obtain.then(issue => {
                return admitQaIssue(shared, env.CHIPIN_ISSUE_WRITE_TOKEN, issue.number)
                    .then(() => assignQa(readApi, writeApi, issue, qaLogin, env.QA_REASSIGN === 'true'))
                    .then(assigned => admitQaIssue(shared, env.CHIPIN_ISSUE_WRITE_TOKEN, assigned.number)
                        .then(() => sendHandoff({ post, webhook: env.SLACK_WEBHOOK_CI, slackId, issue: assigned, sha, url: preview.url })
                            .then(slack => ({ outcome: 'QA_ISSUE_READY', issue: assigned.html_url, sha, baseline, preview, slack }))));
            });
        }));
    });
}

export function validateResultEvent({ event, api }) {
    if (event?.action !== 'created' || event.repository?.full_name !== REPOSITORY
        || event.issue?.pull_request || !Number.isInteger(event.comment?.id) || !Number.isInteger(event.issue?.number)) {
        return Promise.resolve({ outcome: 'IGNORED' });
    }
    if (!/^QA RESULT:/.test(event.comment.body ?? '')) return Promise.resolve({ outcome: 'IGNORED' });
    return Promise.all([
        api.request(`${REPO_PATH}/issues/${event.issue.number}`),
        api.request(`${REPO_PATH}/issues/comments/${event.comment.id}`),
    ]).then(([issue, comment]) => {
        if (comment.id !== event.comment.id || comment.issue_url !== `${API}${REPO_PATH}/issues/${issue.number}`
            || !issue.body?.includes('<!-- chipin-release-qa:v1 repo=')) throw new Error('Comment/QA Issue identity mismatch.');
        const sha = /^SHA:\s*([0-9a-f]{40})\s*$/m.exec(comment.body ?? '')?.[1];
        if (!sha || Date.parse(comment.created_at) < Date.parse(issue.created_at)) throw new Error('QA result has stale or missing candidate SHA.');
        const result = parseQaResult(comment, issue, sha);
        return { outcome: 'VALID_QA_RESULT', issue: issue.html_url, result };
    });
}
