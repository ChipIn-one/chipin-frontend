import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    REPOSITORY, assertConfiguration, assertFullSha, buildChecklist, buildIssueBody, findQaIssue,
    formatInvalidationLine, formatResultLine, hasGreenFrontendCiRun, isNearMissResult, isSlackWebhook, parseQaResult, resultOutcome,
    validateDeployment, verifyCi,
} from './core.mjs';
import { hasPackageFiles, packageBuildChanges } from './ui-paths.mjs';

const API = 'https://api.github.com';
const REPO_PATH = `/repos/${REPOSITORY}`;
const AUTO_RUN_TITLE = 'QA prepare auto';
// How many recent master commits the zero-input resolver inspects before failing closed.
const RESOLVE_DEPTH = 20;
const API_HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };

export class GitHubApi {
    constructor(token, fetchImpl = fetch) {
        if (!token) throw new Error('GitHub token is required.');
        this.token = token;
        this.fetchImpl = fetchImpl;
    }

    request(path, { method = 'GET', body, allow404 = false } = {}) {
        return this.fetchImpl(`${API}${path}`, {
            method,
            headers: { ...API_HEADERS, Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        }).then(response => {
            if (allow404 && response.status === 404) return null;
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

    // Raw file contents at a ref; null when the file does not exist there.
    raw(path) {
        return this.fetchImpl(`${API}${path}`, {
            headers: { ...API_HEADERS, Accept: 'application/vnd.github.raw+json', Authorization: `Bearer ${this.token}` },
        }).then(response => {
            if (response.status === 404) return null;
            if (!response.ok) throw new Error(`GitHub GET ${path} returned HTTP ${response.status}.`);
            return response.text();
        });
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

function priorRunMayHaveStartedCreate(run) {
    if (run?.create_started === true) return true;
    if (run?.conclusion === 'success') return true;
    if (run?.status === 'in_progress' || run?.status === 'queued') return true;
    return false;
}

export function assertRetrySafe(runs, currentRunId, sha, existingIssue) {
    assertFullSha(sha);
    if (existingIssue) return true;
    if (!Number.isInteger(currentRunId) || currentRunId <= 0) throw new Error('Current GitHub run ID is required for create safety.');
    // A zero-input run's title carries no SHA. Treat it as same-SHA while it is still running, or when it
    // was dispatched on this SHA as master head (its usual resolution).
    const ambiguous = runs.some(run => run.id !== currentRunId && priorRunMayHaveStartedCreate(run)
        && (run.display_title === `QA prepare ${sha}`
            || (run.display_title === AUTO_RUN_TITLE && (run.head_sha === sha || run.status !== 'completed'))));
    if (ambiguous) {
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

export function sendHandoff({ post, webhook, slackId, issue, sha, url, missingSteps = [], fallbackNote = '' }) {
    const missing = missingSteps.length
        ? `\nMissing QA steps: ${missingSteps.map(number => `#${number}`).join(', ')} (check against their Acceptance)` : '';
    const payload = { text: `<@${slackId}> Frontend QA candidate ${sha}${fallbackNote}\n${url}\nCanonical QA Issue: ${issue.html_url}${missing}` };
    return post(webhook, payload).then(() => ({ delivered: true })).catch(() => ({
        delivered: false,
        reason: 'Slack delivery failed; retry the same SHA after checking webhook/channel.',
    }));
}

// Posts one presentation-only line. A missing webhook or a failed delivery is reported, never thrown.
function postLine({ post, webhook, text }) {
    if (!isSlackWebhook(webhook)) return Promise.resolve({ delivered: false, reason: 'SLACK_WEBHOOK_CI is not configured; nothing was posted.' });
    return post(webhook, { text }).then(() => ({ delivered: true })).catch(() => ({
        delivered: false, reason: 'Slack delivery failed; check the webhook and channel.',
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

function changedPaths(files) {
    return files.flatMap(item => item.previous_filename ? [item.filename, item.previous_filename] : [item.filename]);
}

// Returns this repository's native closing Issues of a merged master PR. Anything other than exactly one
// is "unlinked": it blocks only when the PR touches UI-affecting paths (decided in buildChecklist).
function pullIssues(api, pull) {
    const query = `query($id: ID!) { node(id: $id) { ... on PullRequest { closingIssuesReferences(first: 100) { totalCount nodes { number repository { nameWithOwner } } } } } }`;
    return api.graphql(query, { id: pull.node_id }).then(data => {
        const refs = data?.node?.closingIssuesReferences;
        if (!refs || !Array.isArray(refs.nodes) || refs.totalCount !== refs.nodes.length) {
            throw new Error(`PR #${pull.number} closing Issue links are unreadable.`);
        }
        if (refs.nodes.some(node => node.repository?.nameWithOwner !== REPOSITORY)) return [];
        return refs.nodes.map(node => node.number);
    });
}

function readCommitFiles(api, sha) {
    return api.request(`${REPO_PATH}/commits/${sha}`).then(commit => {
        if (!Array.isArray(commit?.files) || commit.files.length >= 300) {
            throw new Error(`Commit ${sha} files are unreadable or exceed complete evidence bounds.`);
        }
        return changedPaths(commit.files);
    });
}

const UNREADABLE_PACKAGES = 'package.json/package-lock.json evidence is unreadable; treated as build-affecting';

function readJsonAt(api, file, ref) {
    return api.raw(`${REPO_PATH}/contents/${file}?ref=${ref}`).then(text => (text == null ? null : JSON.parse(text)));
}

// Reads package.json and package-lock.json at the Production baseline and the candidate. Unreadable
// evidence is treated as build-affecting (a QA round), never as a block.
export function readPackageBuildChanges(api, files, baseSha, headSha) {
    if (!hasPackageFiles(files)) return Promise.resolve([]);
    return Promise.resolve().then(() => Promise.all([
        readJsonAt(api, 'package.json', baseSha), readJsonAt(api, 'package-lock.json', baseSha),
        readJsonAt(api, 'package.json', headSha), readJsonAt(api, 'package-lock.json', headSha),
    ])).then(([basePkg, baseLock, headPkg, headLock]) => packageBuildChanges({
        files, base: { pkg: basePkg, lock: baseLock }, head: { pkg: headPkg, lock: headLock },
    })).catch(() => [UNREADABLE_PACKAGES]);
}

function readIncludedWork(api, compared, baseSha, headSha) {
    const commits = compared.commits.map(item => item.sha);
    const files = changedPaths(compared.files);
    const pullMap = new Map();
    const commitFiles = {};
    const nextCommit = index => {
        if (index === commits.length) return Promise.resolve();
        const sha = commits[index];
        return api.list(`${REPO_PATH}/commits/${sha}/pulls`).then(pulls => {
            const merged = pulls.filter(pull => pull.node_id && pull.merged_at && pull.base?.ref === 'master');
            if (merged.length !== 1) {
                return readCommitFiles(api, sha).then(paths => { commitFiles[sha] = paths; });
            }
            const pull = merged[0];
            const current = pullMap.get(pull.number) ?? { ...pull, commits: [] };
            current.commits.push(sha);
            pullMap.set(pull.number, current);
            return undefined;
        }).then(() => nextCommit(index + 1));
    };
    return nextCommit(0).then(() => {
        const pulls = [...pullMap.values()];
        return Promise.all(pulls.map(pull => Promise.all([
            pullIssues(api, pull),
            api.list(`${REPO_PATH}/pulls/${pull.number}/files`),
        ]).then(([issues, changed]) => {
            if (changed.length === 0 || changed.length >= 3000) throw new Error(`PR #${pull.number} files are unreadable.`);
            return { ...pull, issues, files: changedPaths(changed) };
        })));
    }).then(pulls => {
        const issueNumbers = [...new Set(pulls.filter(pull => pull.issues.length === 1).map(pull => pull.issues[0]))];
        return Promise.all(issueNumbers.map(number => api.request(`${REPO_PATH}/issues/${number}`).then(issue => {
            if (issue.pull_request || issue.repository_url !== `${API}${REPO_PATH}`) throw new Error(`Issue #${number} is not a canonical frontend Issue.`);
            return issue;
        }))).then(issues => readPackageBuildChanges(api, files, baseSha, headSha)
            .then(buildChanges => buildChecklist({ files, commits, pulls, issues, commitFiles, buildChanges })));
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

function newestTrustedPreview(api, sha) {
    return api.list(`${REPO_PATH}/deployments?environment=Preview&sha=${sha}`).then(deployments => {
        const trusted = deployments.filter(item => item.sha === sha && item.environment === 'Preview' && item.creator?.login === 'vercel[bot]')
            .sort((a, b) => b.id - a.id);
        const next = index => {
            if (index >= trusted.length) return Promise.resolve(null);
            return api.list(`${REPO_PATH}/deployments/${trusted[index].id}/statuses`).then(statuses => {
                try {
                    return validateDeployment(trusted[index], statuses[0], 'Preview', sha);
                } catch {
                    return next(index + 1);
                }
            });
        };
        return next(0);
    });
}

function readDeploymentSha(api, deploymentId) {
    return api.request(`${REPO_PATH}/deployments/${deploymentId}`).then(deployment => assertFullSha(deployment?.sha, 'Deployment SHA'));
}

function parseDeploymentId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('PREVIEW_DEPLOYMENT_ID must be a positive integer.');
    return id;
}

// Zero-input dispatch: walk master from its head and take the newest SHA that has a successful trusted
// vercel[bot] Preview with an immutable URL and a green frontend-ci push run. Explicit inputs override.
// Every trust check still runs on the result in prepareReleaseQa.
export function resolveCandidate({ api, sha = '', deploymentId = '' }) {
    if (sha && deploymentId) {
        return Promise.resolve().then(() => ({ sha: assertFullSha(sha, 'Candidate SHA'), deploymentId: parseDeploymentId(deploymentId), fallback: false, skipped: [] }));
    }
    if (deploymentId) {
        return Promise.resolve().then(() => parseDeploymentId(deploymentId))
            .then(id => readDeploymentSha(api, id).then(resolved => ({ sha: resolved, deploymentId: id, fallback: false, skipped: [] })));
    }
    if (sha) {
        return Promise.resolve().then(() => assertFullSha(sha, 'Candidate SHA')).then(selected => newestTrustedPreview(api, selected).then(preview => {
            if (!preview) throw new Error(`No eligible successful vercel[bot] Preview with an immutable URL exists for ${selected}.`);
            return { sha: selected, deploymentId: preview.id, url: preview.url, fallback: false, skipped: [] };
        }));
    }
    return api.request(`${REPO_PATH}/commits?sha=master&per_page=${RESOLVE_DEPTH}`).then(commits => {
        if (!Array.isArray(commits) || commits.length === 0) throw new Error('Current master commits are unreadable.');
        const shas = commits.map(commit => assertFullSha(commit.sha, 'Master commit SHA'));
        const skipped = [];
        const next = index => {
            if (index >= shas.length) {
                throw new Error(`No eligible successful vercel[bot] Preview with green frontend-ci in the last ${shas.length} master commits.`);
            }
            const candidate = shas[index];
            return newestTrustedPreview(api, candidate).then(preview => {
                if (!preview) {
                    skipped.push({ sha: candidate, reason: 'No successful vercel[bot] Preview with an immutable URL.' });
                    return next(index + 1);
                }
                return api.listObject(`${REPO_PATH}/actions/workflows/frontend-ci.yml/runs?head_sha=${candidate}&event=push`, 'workflow_runs').then(runs => {
                    if (!hasGreenFrontendCiRun(runs, candidate)) {
                        skipped.push({ sha: candidate, reason: 'No green frontend-ci push run yet.' });
                        return next(index + 1);
                    }
                    return { sha: candidate, deploymentId: preview.id, url: preview.url, head: shas[0], fallback: index > 0, skipped };
                });
            });
        };
        return next(0);
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
        api.list(`${REPO_PATH}/commits/${sha}/statuses`).then(statuses => statuses.map(status => ({ ...status, sha }))),
    ]).then(([rule, checks, runs, statuses]) => verifyCi(rule, checks, runs, sha, statuses));
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

// Labels a zero-input candidate that is not the master head, naming what the head is still missing.
export function fallbackNote(candidate) {
    if (!candidate?.fallback || !candidate.head) return '';
    const headSkip = candidate.skipped?.find(item => item.sha === candidate.head);
    const missing = headSkip?.reason?.includes('frontend-ci') ? 'CI pending' : 'Preview pending';
    return ` (not master head ${candidate.head.slice(0, 7)}: ${missing})`;
}

function runUrl(env) {
    return env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
        ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : 'the workflow run';
}

export function prepareReleaseQa({ env, readApi, writeApi, sharedRoot, post = postSlack, probe = probePublicPreview }) {
    const qaLogin = env.QA_LOGIN || 'SoRawSteak';
    const priority = env.QA_PRIORITY || 'P2';
    if (!['P0', 'P1', 'P2', 'P3'].includes(priority)) throw new Error('QA_PRIORITY must be P0, P1, P2, or P3.');
    if (env.GITHUB_ACTOR !== 'syllik' || env.GITHUB_TRIGGERING_ACTOR !== 'syllik' || env.GITHUB_REF !== 'refs/heads/master') {
        throw new Error('Only release owner syllik may select a candidate from trusted master workflow code.');
    }
    const currentRunId = Number(env.GITHUB_RUN_ID);
    let sha, deploymentId, candidate, preview, baseline, plan;
    return resolveCandidate({ api: readApi, sha: env.CANDIDATE_SHA ?? '', deploymentId: env.PREVIEW_DEPLOYMENT_ID ?? '' }).then(resolved => {
        candidate = resolved;
        sha = resolved.sha;
        deploymentId = resolved.deploymentId;
        return Promise.all([
            readCandidate(readApi, deploymentId, sha, probe),
            readCi(readApi, sha),
            readApi.list(`${REPO_PATH}/deployments?environment=Production`).then(deployments => chooseProductionBaseline(
                deployments, id => readApi.list(`${REPO_PATH}/deployments/${id}/statuses`),
            )),
            compare(readApi, sha, 'master'),
        ]);
    }).then(([selected, , production, candidateToMaster]) => {
        preview = selected;
        baseline = production;
        candidate = { ...candidate, url: preview.url };
        return compare(readApi, baseline.sha, sha, true).then(scope => {
            assertAncestry(candidateToMaster, scope, sha, baseline.sha);
            return readIncludedWork(readApi, scope, baseline.sha, sha);
        });
    }).then(included => {
        plan = included;
        if (plan.kind === 'none') {
            const text = `Frontend release QA: No manual QA needed for ${sha}${fallbackNote(candidate)} (${plan.evidence.length} changed files, none UI-affecting). ${runUrl(env)}`;
            return postLine({ post, webhook: env.SLACK_WEBHOOK_CI, text }).then(slack => ({
                outcome: 'NO_MANUAL_QA_REQUIRED', sha, candidate, baseline, evidence: plan.evidence, included: plan.included, noQa: plan.noQa, slack,
            }));
        }
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
                        .then(() => sendHandoff({ post, webhook: env.SLACK_WEBHOOK_CI, slackId, issue: assigned, sha, url: preview.url, missingSteps: plan.missingSteps, fallbackNote: fallbackNote(candidate) })
                            .then(slack => ({ outcome: 'QA_ISSUE_READY', issue: assigned.html_url, sha, candidate, baseline, preview,
                                missingSteps: plan.missingSteps, noQa: plan.noQa, smoke: plan.smoke, slack }))));
            });
        }));
    });
}

export function validateResultEvent({ event, api }) {
    if (!['created', 'edited', 'deleted'].includes(event?.action) || event.repository?.full_name !== REPOSITORY
        || event.issue?.pull_request || !Number.isInteger(event.comment?.id) || !Number.isInteger(event.issue?.number)) {
        return Promise.resolve({ outcome: 'IGNORED' });
    }
    if (event.action === 'created' && !resultOutcome(event.comment.body) && !isNearMissResult(event.comment.body)) {
        return Promise.resolve({ outcome: 'IGNORED' });
    }
    return Promise.all([
        api.request(`${REPO_PATH}/issues/${event.issue.number}`),
        api.request(`${REPO_PATH}/issues/comments/${event.comment.id}`, { allow404: event.action === 'deleted' }),
    ]).then(([issue, comment]) => {
        const marker = [...(issue.body ?? '').matchAll(/<!-- chipin-release-qa:v1 repo=ChipIn-one\/chipin-frontend sha=([0-9a-f]{40}) deployment=([1-9]\d*) -->/g)];
        // Only an open Issue with the canonical title and a single marker is a QA Issue.
        if (marker.length !== 1 || issue.state !== 'open' || issue.title !== `Release QA ${marker[0][1]}`) return { outcome: 'IGNORED' };
        if (comment && (comment.id !== event.comment.id || comment.issue_url !== `${API}${REPO_PATH}/issues/${issue.number}`)) {
            throw new Error('Comment/QA Issue identity mismatch.');
        }
        const currentQa = (issue.assignees ?? []).filter(user => user.login?.toLowerCase() !== 'syllik');
        if (event.action !== 'created') {
            const isQaResult = value => resultOutcome(value) !== null;
            const eventBody = event.comment?.body;
            const wasResult = isQaResult(event.changes?.body?.from) || isQaResult(eventBody) || isQaResult(comment?.body);
            const deletedBodyMissing = event.action === 'deleted' && !comment && eventBody == null;
            if (!wasResult && !deletedBodyMissing) return { outcome: 'IGNORED' };
            const author = (comment?.user?.login ?? event.comment?.user?.login ?? '').toLowerCase();
            const byCurrentQa = currentQa.length === 1 && author === currentQa[0].login.toLowerCase();
            return { outcome: 'QA_RESULT_INVALIDATED', issue: issue.html_url, sha: marker[0][1], byCurrentQa,
                reason: event.action === 'deleted' || !comment
                    ? 'QA result comment was deleted; prior validation is historical.'
                    : 'QA result comment was edited; submit a new unedited result comment.',
                currentQa: currentQa.length === 1 ? currentQa[0].login : null };
        }
        if (!comment) throw new Error('QA result comment is unreadable.');
        if (!resultOutcome(comment.body)) {
            const login = comment.user?.login?.toLowerCase() ?? '';
            const isSoleQa = currentQa.length === 1 && login !== 'syllik' && login === currentQa[0].login.toLowerCase();
            if (isSoleQa && isNearMissResult(comment.body)) {
                throw new Error('QA result first line must be exactly QA PASS, QA FAIL or QA BLOCKED.');
            }
            return { outcome: 'IGNORED' };
        }
        if (Date.parse(comment.created_at) < Date.parse(issue.created_at)) throw new Error('QA result comment predates the QA Issue.');
        const result = parseQaResult(comment, issue);
        return { outcome: 'VALID_QA_RESULT', issue: issue.html_url, result };
    });
}

// Slack is called only for a validated result from the sole assigned QA, or when that QA edits or deletes
// a result. Lines are built from validated fields only. Slack failure is reported, never changes the outcome.
export function readResultAndNotify({ event, api, env, post = postSlack }) {
    return validateResultEvent({ event, api }).then(value => {
        if (value.outcome === 'QA_RESULT_INVALIDATED' && value.byCurrentQa) {
            const text = formatInvalidationLine({ sha: value.sha, issueUrl: value.issue, userMap: env.SLACK_USER_MAP });
            return postLine({ post, webhook: env.SLACK_WEBHOOK_CI, text }).then(slack => ({ ...value, slack }));
        }
        if (value.outcome !== 'VALID_QA_RESULT') return value;
        const text = formatResultLine({ result: value.result, issueUrl: value.issue, userMap: env.SLACK_USER_MAP });
        return postLine({ post, webhook: env.SLACK_WEBHOOK_CI, text }).then(slack => ({ ...value, slack }));
    });
}
