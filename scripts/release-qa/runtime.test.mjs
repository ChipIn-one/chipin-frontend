import { expect, test } from 'vitest';
import { assertAncestry, assertRetrySafe, chooseProductionBaseline, prepareReleaseQa, readPackageBuildChanges, readResultAndNotify, resolveCandidate, sendHandoff, validateResultEvent } from './runtime.mjs';

const SHA = 'a'.repeat(40);
const BASE = 'b'.repeat(40);

test('production baseline is latest verified Vercel Production success and precedes candidate', () => {
    const deployments = [
        { id: 7, sha: BASE, environment: 'Production', creator: { login: 'vercel[bot]' }, ref: BASE },
        { id: 6, sha: 'c'.repeat(40), environment: 'Production', creator: { login: 'vercel[bot]' }, ref: 'c'.repeat(40) },
    ];
    const statuses = new Map([[7, [{ state: 'success', environment_url: 'https://chipin-frontend-prod7-sylliks-projects.vercel.app' }]]]);
    return chooseProductionBaseline(deployments, id => Promise.resolve(statuses.get(id) ?? [])).then(value => {
        expect(value).toMatchObject({ sha: BASE, id: 7 });
    });
});

test('candidate must be an ancestor of current master and ahead of Production', () => {
    expect(assertAncestry({ status: 'ahead' }, { status: 'ahead', total_commits: 2 }, SHA, BASE)).toBe(true);
    expect(() => assertAncestry({ status: 'diverged' }, { status: 'ahead', total_commits: 2 }, SHA, BASE)).toThrow(/master ancestry/);
    expect(() => assertAncestry({ status: 'ahead' }, { status: 'behind', total_commits: 0 }, SHA, BASE)).toThrow(/Production baseline/);
});

test('pre-create failure, cancellation, or timeout can retry the same SHA when no Issue exists', () => {
    for (const conclusion of ['failure', 'cancelled', 'timed_out']) {
        expect(assertRetrySafe([
            { id: 99, display_title: `QA prepare ${SHA}`, status: 'completed', conclusion },
        ], 101, SHA, null)).toBe(true);
    }
});

test('in-progress, queued, successful, or create-started same-SHA run without an Issue stays ambiguous', () => {
    const prior = (status, conclusion, extra = {}) => ({ id: 99, display_title: `QA prepare ${SHA}`, status, conclusion, ...extra });
    expect(() => assertRetrySafe([prior('in_progress', null)], 101, SHA, null)).toThrow(/ambiguous/);
    expect(() => assertRetrySafe([prior('queued', null)], 101, SHA, null)).toThrow(/ambiguous/);
    expect(() => assertRetrySafe([prior('completed', 'success')], 101, SHA, null)).toThrow(/ambiguous/);
    expect(() => assertRetrySafe([prior('completed', 'failure', { create_started: true })], 101, SHA, null)).toThrow(/ambiguous/);
    expect(assertRetrySafe([{ id: 100, display_title: `QA prepare ${SHA}`, status: 'in_progress' }], 100, SHA, null)).toBe(true);
});

test('visible same-SHA Issue is reused even when an earlier preparation succeeded', () => {
    expect(assertRetrySafe([
        { id: 99, display_title: `QA prepare ${SHA}`, status: 'completed', conclusion: 'success' },
    ], 101, SHA, { number: 50 })).toBe(true);
});

test('Slack failure leaves admitted Issue intact and reports retryable delivery', () => {
    const issue = { number: 50, html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50' };
    return sendHandoff({ post: () => Promise.reject(new Error('network failed')), webhook: 'https://hooks.slack.com/services/secret', slackId: 'U0C9X8T4R2Q', issue, sha: SHA, url: 'https://chipin-frontend-abc-sylliks-projects.vercel.app' }).then(value => {
        expect(value).toEqual({ delivered: false, reason: 'Slack delivery failed; retry the same SHA after checking webhook/channel.' });
    });
});

test('comment event re-reads Issue and comment before accepting current assigned QA result', () => {
    const body = `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`;
    const issue = { number: 50, state: 'open', title: `Release QA ${SHA}`, body, created_at: '2026-10-23T10:00:00Z', html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50', assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const comment = { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', user: { login: 'SoRawSteak', type: 'User' }, body: 'QA PASS', created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:00:00Z' };
    const event = { action: 'created', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: comment.body } };
    const api = { request: path => Promise.resolve(path.endsWith('/comments/8') ? comment : issue) };
    return validateResultEvent({ event, api }).then(value => {
        expect(value).toMatchObject({ outcome: 'VALID_QA_RESULT', result: { outcome: 'PASS', sha: SHA, qa: 'SoRawSteak' } });
        return validateResultEvent({ event, api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? { ...comment, updated_at: '2026-10-23T11:01:00Z' } : issue) } });
    }).then(() => { throw new Error('Edited result was accepted.'); }, error => {
        expect(error.message).toMatch(/edited/);
    });
});

test('edited-to-PASS, edited-away and deleted QA results invalidate earlier validation', () => {
    const issue = { number: 50, state: 'open', title: `Release QA ${SHA}`, body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`,
        created_at: '2026-10-23T10:00:00Z', html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50', assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const original = 'QA FAIL\nLogin is broken';
    const comment = { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', user: { login: 'SoRawSteak', type: 'User' },
        body: 'QA PASS', created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:01:00Z' };
    const base = { repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: comment.body, user: comment.user } };
    const apiFor = current => ({ request: path => Promise.resolve(path.endsWith('/comments/8') ? current : issue) });
    return validateResultEvent({ event: { ...base, action: 'edited', changes: { body: { from: original } } }, api: apiFor(comment) }).then(edited => {
        expect(edited.outcome).toMatch(/INVALIDATED|REVOKED/);
        return validateResultEvent({ event: { ...base, action: 'edited', comment: { ...base.comment, body: 'No result' }, changes: { body: { from: original } } }, api: apiFor({ ...comment, body: 'No result' }) });
    }).then(away => {
        expect(away.outcome).toMatch(/INVALIDATED|REVOKED/);
        return validateResultEvent({ event: { ...base, action: 'deleted', comment: { id: 8, user: comment.user } }, api: apiFor(null) });
    }).then(deleted => {
        expect(deleted.outcome).toMatch(/INVALIDATED|REVOKED/);
        expect(deleted).not.toHaveProperty('result');
        return validateResultEvent({
            event: { ...base, action: 'deleted', comment: { id: 8, body: comment.body, user: comment.user } },
            api: apiFor(null),
        });
    }).then(deletedWithBody => {
        expect(deletedWithBody.outcome).toMatch(/INVALIDATED|REVOKED/);
        expect(deletedWithBody).not.toMatchObject({ outcome: 'VALID_QA_RESULT' });
        expect(deletedWithBody).not.toHaveProperty('result');
    });
});

test('comment on an Issue without exactly one QA marker is ignored', () => {
    const comment = { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', user: { login: 'SoRawSteak', type: 'User' }, body: 'Please look', created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:00:00Z' };
    const plain = { number: 50, state: 'open', title: `Release QA ${SHA}`, body: 'Not a QA issue', html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50' };
    const doubled = { ...plain, body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->\n<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->` };
    const apiFor = issue => ({ request: path => Promise.resolve(path.endsWith('/comments/8') ? comment : issue) });
    const edited = { action: 'edited', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: comment.body }, changes: { body: { from: 'Earlier note' } } };
    return validateResultEvent({ event: edited, api: apiFor(plain) }).then(value => {
        expect(value).toEqual({ outcome: 'IGNORED' });
        return validateResultEvent({ event: { ...edited, action: 'deleted' }, api: apiFor(plain) });
    }).then(deleted => {
        expect(deleted).toEqual({ outcome: 'IGNORED' });
        return validateResultEvent({ event: edited, api: apiFor(doubled) });
    }).then(ambiguous => {
        expect(ambiguous).toEqual({ outcome: 'IGNORED' });
        const created = { action: 'created', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: 'QA PASS' } };
        const passComment = { ...comment, body: created.comment.body };
        return validateResultEvent({ event: created, api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? passComment : plain) } });
    }).then(created => {
        expect(created).toEqual({ outcome: 'IGNORED' });
        expect(created).not.toMatchObject({ outcome: 'VALID_QA_RESULT' });
    });
});

test('deleting a non-result comment on a QA Issue is ignored when its body is readable', () => {
    const issue = { number: 50, state: 'open', title: `Release QA ${SHA}`, body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`,
        created_at: '2026-10-23T10:00:00Z', html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50', assignees: [{ login: 'SoRawSteak' }] };
    const note = 'Checking the preview now';
    const event = { action: 'deleted', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: note } };
    const readable = { request: path => Promise.resolve(path.endsWith('/comments/8')
        ? { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', body: note }
        : issue) };
    return validateResultEvent({ event, api: readable }).then(value => {
        expect(value).toEqual({ outcome: 'IGNORED' });
        return validateResultEvent({
            event: { ...event, comment: { id: 8, body: 'Not a result' } },
            api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? null : issue) },
        });
    }).then(missingComment => {
        expect(missingComment).toEqual({ outcome: 'IGNORED' });
        return validateResultEvent({
            event: { ...event, comment: { id: 8 } },
            api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? null : issue) },
        });
    }).then(missingBoth => {
        expect(missingBoth.outcome).toBe('QA_RESULT_INVALIDATED');
        expect(missingBoth).not.toHaveProperty('result');
        expect(missingBoth).not.toMatchObject({ outcome: 'VALID_QA_RESULT' });
    });
});

test('unauthorized QA result event cannot become a validated PASS', () => {
    const issue = { number: 50, state: 'open', title: `Release QA ${SHA}`, body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`,
        created_at: '2026-10-23T10:00:00Z', assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const comment = { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', user: { login: 'syllik', type: 'User' },
        body: 'QA PASS', created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:00:00Z' };
    const event = { action: 'created', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: comment.body } };
    return validateResultEvent({ event, api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? comment : issue) } })
        .then(() => { throw new Error('Unauthorized result was accepted.'); }, error => expect(error.message).toMatch(/assigned QA/));
});

const OLD = 'c'.repeat(40);
const PREVIEW_URL = 'https://chipin-frontend-abc-sylliks-projects.vercel.app';
const WEBHOOK = 'https://hooks.slack.com/services/T0/B0/secret';
const greenRun = sha => ({ id: 1, head_sha: sha, head_branch: 'master', conclusion: 'success', status: 'completed', event: 'push', path: '.github/workflows/frontend-ci.yml' });
const previewFor = (id, sha) => ({ id, sha, ref: 'master', environment: 'Preview', creator: { login: 'vercel[bot]' } });
const ok = url => [{ state: 'success', environment_url: url }];

function resolverApi({ head = [SHA, OLD], previews = {}, statuses = {}, runs = {}, deployments = {} }) {
    return {
        request: path => {
            if (path.includes('/commits?sha=master')) return Promise.resolve(head.map(sha => ({ sha })));
            const single = /\/deployments\/(\d+)$/.exec(path);
            if (single && deployments[single[1]]) return Promise.resolve(deployments[single[1]]);
            throw new Error(`Unexpected request ${path}`);
        },
        list: path => {
            const preview = /\/deployments\?environment=Preview&sha=([0-9a-f]{40})$/.exec(path);
            if (preview) return Promise.resolve(previews[preview[1]] ?? []);
            const status = /\/deployments\/(\d+)\/statuses$/.exec(path);
            if (status) return Promise.resolve(statuses[status[1]] ?? []);
            throw new Error(`Unexpected list ${path}`);
        },
        listObject: path => Promise.resolve(runs[/head_sha=([0-9a-f]{40})/.exec(path)?.[1]] ?? []),
    };
}

test('zero-input resolver picks the newest successful vercel[bot] Preview of the master head with green frontend-ci', () => {
    const api = resolverApi({ previews: { [SHA]: [previewFor(41, SHA), previewFor(42, SHA)] },
        statuses: { 41: ok('https://chipin-frontend-old-sylliks-projects.vercel.app'), 42: ok(PREVIEW_URL) }, runs: { [SHA]: [greenRun(SHA)] } });
    return resolveCandidate({ api }).then(value => {
        expect(value).toMatchObject({ sha: SHA, deploymentId: 42, url: PREVIEW_URL, head: SHA, fallback: false, skipped: [] });
    });
});

test('zero-input resolver falls back to the newest master SHA with a successful Preview and green frontend-ci', () => {
    const api = resolverApi({ head: [SHA, BASE, OLD],
        previews: { [BASE]: [previewFor(43, BASE)], [OLD]: [previewFor(44, OLD)] },
        statuses: { 43: ok('https://chipin-frontend-mid-sylliks-projects.vercel.app'), 44: ok(PREVIEW_URL) },
        runs: { [BASE]: [{ ...greenRun(BASE), status: 'in_progress', conclusion: null }], [OLD]: [greenRun(OLD)] } });
    return resolveCandidate({ api }).then(value => {
        expect(value).toMatchObject({ sha: OLD, deploymentId: 44, head: SHA, fallback: true });
        expect(value.skipped.map(item => item.sha)).toEqual([SHA, BASE]);
        expect(value.skipped[0].reason).toMatch(/Preview/);
        expect(value.skipped[1].reason).toMatch(/frontend-ci/);
    });
});

test('zero-input resolver ignores a Preview for a non-head SHA, untrusted creators, failed statuses and moving aliases', () => {
    const api = resolverApi({ head: [SHA],
        previews: { [SHA]: [previewFor(45, OLD), { ...previewFor(46, SHA), creator: { login: 'syllik' } }, previewFor(47, SHA), previewFor(48, SHA)] },
        statuses: { 45: ok(PREVIEW_URL), 46: ok(PREVIEW_URL), 47: [{ state: 'failure', environment_url: PREVIEW_URL }],
            48: ok('https://chipin-frontend-git-master-sylliks-projects.vercel.app') },
        runs: { [SHA]: [greenRun(SHA)] } });
    return resolveCandidate({ api }).then(() => { throw new Error('Untrusted Preview was resolved.'); },
        error => expect(error.message).toMatch(/No eligible/));
});

test('zero-input resolver fails closed when no master SHA has an eligible Preview', () => {
    return resolveCandidate({ api: resolverApi({}) }).then(() => { throw new Error('Resolved without a Preview.'); },
        error => expect(error.message).toMatch(/No eligible.*Preview/));
});

test('explicit overrides: SHA only resolves its Preview, deployment ID only takes its SHA, both pass through', () => {
    const api = resolverApi({ previews: { [OLD]: [previewFor(44, OLD)] }, statuses: { 44: ok(PREVIEW_URL) },
        deployments: { 44: previewFor(44, OLD) } });
    return resolveCandidate({ api, sha: OLD }).then(bySha => {
        expect(bySha).toMatchObject({ sha: OLD, deploymentId: 44, fallback: false });
        return resolveCandidate({ api, deploymentId: '44' });
    }).then(byId => {
        expect(byId).toMatchObject({ sha: OLD, deploymentId: 44 });
        return resolveCandidate({ api, sha: SHA, deploymentId: '42' });
    }).then(both => {
        expect(both).toMatchObject({ sha: SHA, deploymentId: 42 });
        return resolveCandidate({ api, sha: 'abc' });
    }).then(() => { throw new Error('Short SHA accepted.'); }, error => expect(error.message).toMatch(/40-character/));
});

test('zero-input runs: an auto run in progress or a successful auto run for the same head SHA stays ambiguous', () => {
    const auto = (status, conclusion, headSha) => ({ id: 99, display_title: 'QA prepare auto', status, conclusion, head_sha: headSha });
    expect(() => assertRetrySafe([auto('in_progress', null, OLD)], 101, SHA, null)).toThrow(/ambiguous/);
    expect(() => assertRetrySafe([auto('completed', 'success', SHA)], 101, SHA, null)).toThrow(/ambiguous/);
    expect(assertRetrySafe([auto('completed', 'success', OLD)], 101, SHA, null)).toBe(true);
    expect(assertRetrySafe([auto('completed', 'failure', SHA)], 101, SHA, null)).toBe(true);
});

test('handoff mentions included UI Issues that have no QA steps', () => {
    const posted = [];
    const issue = { number: 50, html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50' };
    return sendHandoff({ post: (url, payload) => { posted.push(payload.text); return Promise.resolve(true); }, webhook: WEBHOOK,
        slackId: 'U0C9X8T4R2Q', issue, sha: SHA, url: PREVIEW_URL, missingSteps: [13, 14] }).then(value => {
        expect(value).toEqual({ delivered: true });
        expect(posted[0]).toMatch(/Missing QA steps: #13, #14/);
    });
});

function evidenceApi({ files = ['docs/help.md'], pulls = 'linked', prFiles = ['docs/help.md'], commitFiles = files, head = null, raw = {} } = {}) {
    const merged = { number: 20, node_id: 'PR_20', merged_at: '2026-10-23T10:00:00Z', base: { ref: 'master' } };
    return {
        request: path => {
            if (path.includes('/commits?sha=master')) return Promise.resolve(head ? [{ sha: head.sha }, { sha: SHA }] : [{ sha: SHA }]);
            if (path.endsWith('/deployments/42')) return Promise.resolve({ id: 42, sha: SHA, ref: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' } });
            if (path.includes('/rules/branches/master')) return Promise.resolve([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'frontend-ci', integration_id: 15368 }] } }]);
            if (path.includes(`/compare/${SHA}...master`)) return Promise.resolve({ status: 'identical' });
            if (path.includes(`/compare/${BASE}...${SHA}`)) return Promise.resolve({ status: 'ahead', total_commits: 1, commits: [{ sha: SHA }], files: files.map(filename => ({ filename })) });
            if (path.endsWith(`/commits/${SHA}`)) return Promise.resolve({ sha: SHA, files: commitFiles.map(filename => ({ filename })) });
            if (path.endsWith('/issues/12')) return Promise.resolve({ number: 12, repository_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend', body: '## Acceptance\n- [ ] Documentation updated' });
            throw new Error(`Unexpected request ${path}`);
        },
        list: path => {
            if (path.endsWith(`/deployments?environment=Preview&sha=${SHA}`)) return Promise.resolve([previewFor(42, SHA)]);
            if (head && path.endsWith(`/deployments?environment=Preview&sha=${head.sha}`)) return Promise.resolve(head.preview ? [previewFor(90, head.sha)] : []);
            if (head && path.endsWith('/deployments/90/statuses')) return Promise.resolve(ok('https://chipin-frontend-head-sylliks-projects.vercel.app'));
            if (path.endsWith('/deployments/42/statuses')) return Promise.resolve(ok(PREVIEW_URL));
            if (path.endsWith('/deployments?environment=Production')) return Promise.resolve([{ id: 7, sha: BASE, ref: BASE, environment: 'Production', creator: { login: 'vercel[bot]' } }]);
            if (path.endsWith('/deployments/7/statuses')) return Promise.resolve([{ state: 'success', environment_url: 'https://chipin.one' }]);
            if (path.endsWith(`/commits/${SHA}/statuses`)) return Promise.resolve([]);
            if (path.endsWith(`/commits/${SHA}/pulls`)) return Promise.resolve(pulls ? [merged] : []);
            if (path.endsWith('/pulls/20/files')) return Promise.resolve(prFiles.map(filename => ({ filename })));
            throw new Error(`Unexpected list ${path}`);
        },
        listObject: (path, key) => Promise.resolve(key === 'check_runs'
            ? [{ name: 'frontend-ci', head_sha: SHA, conclusion: 'success', status: 'completed', app: { id: 15368, slug: 'github-actions' } }]
            : [greenRun(SHA)]),
        raw: path => {
            if (Object.hasOwn(raw, path)) return raw[path] instanceof Error ? Promise.reject(raw[path]) : Promise.resolve(raw[path]);
            throw new Error(`Unexpected raw ${path}`);
        },
        graphql: () => Promise.resolve({ node: { closingIssuesReferences: pulls === 'dependabot'
            ? { totalCount: 0, nodes: [] }
            : { totalCount: 1, nodes: [{ number: 12, repository: { nameWithOwner: 'ChipIn-one/chipin-frontend' } }] } } }),
    };
}

const ownerEnv = { CHIPIN_DEV_READ_TOKEN: 'read', GITHUB_ACTOR: 'syllik', GITHUB_TRIGGERING_ACTOR: 'syllik', GITHUB_REF: 'refs/heads/master',
    GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'ChipIn-one/chipin-frontend', GITHUB_RUN_ID: '777' };

test('zero-input dispatch on a non-UI compare resolves the candidate, records no manual QA and posts one Slack line', () => {
    const posted = [];
    const post = (url, payload) => { posted.push({ url, text: payload.text }); return Promise.resolve(true); };
    const env = { ...ownerEnv, CANDIDATE_SHA: '', PREVIEW_DEPLOYMENT_ID: '', QA_PRIORITY: '', SLACK_WEBHOOK_CI: WEBHOOK };
    return prepareReleaseQa({ env, readApi: evidenceApi(), writeApi: null, post, probe: () => Promise.resolve() }).then(value => {
        expect(value).toMatchObject({ outcome: 'NO_MANUAL_QA_REQUIRED', sha: SHA, evidence: ['docs/help.md'], included: [{ issue: 12, pulls: [20] }],
            candidate: { sha: SHA, deploymentId: 42, url: PREVIEW_URL, fallback: false }, slack: { delivered: true } });
        expect(posted).toHaveLength(1);
        expect(posted[0].url).toBe(WEBHOOK);
        expect(posted[0].text).not.toContain('\n');
        expect(posted[0].text).toMatch(new RegExp(`No manual QA needed for ${SHA}.*actions/runs/777`));
    });
});

test('an unlinked docs-only commit and a Dependabot PR without an Issue no longer block', () => {
    const env = { ...ownerEnv, CANDIDATE_SHA: SHA, PREVIEW_DEPLOYMENT_ID: '42', QA_PRIORITY: 'P2' };
    return prepareReleaseQa({ env, readApi: evidenceApi({ pulls: null }), writeApi: null, probe: () => Promise.resolve() }).then(value => {
        expect(value).toMatchObject({ outcome: 'NO_MANUAL_QA_REQUIRED', noQa: [{ commit: SHA }], slack: { delivered: false } });
        expect(value.slack.reason).toMatch(/SLACK_WEBHOOK_CI/);
        const dependabot = evidenceApi({ pulls: 'dependabot', files: ['package.json', 'package-lock.json'], prFiles: ['package.json', 'package-lock.json'],
            raw: packageRaw({ dev: { eslint: '^9.1.0' }, lockPackages: { 'node_modules/i18next': { version: '26.4.2' }, 'node_modules/eslint': { version: '9.1.0', dev: true } } }) });
        return prepareReleaseQa({ env, readApi: dependabot, writeApi: null, probe: () => Promise.resolve() });
    }).then(value => {
        expect(value).toMatchObject({ outcome: 'NO_MANUAL_QA_REQUIRED', noQa: [{ pull: 20, commits: [SHA] }] });
    });
});

test('an unlinked commit under src/ still blocks the handoff', () => {
    const env = { ...ownerEnv, CANDIDATE_SHA: SHA, PREVIEW_DEPLOYMENT_ID: '42', QA_PRIORITY: 'P2' };
    return prepareReleaseQa({ env, readApi: evidenceApi({ pulls: null, files: ['src/App.tsx'] }), writeApi: null, probe: () => Promise.resolve() })
        .then(() => { throw new Error('Unlinked UI commit was accepted.'); }, error => expect(error.message).toMatch(/unlinked commit.*UI-affecting/));
});

test('a Slack failure on the no-QA line does not change the outcome', () => {
    const env = { ...ownerEnv, CANDIDATE_SHA: SHA, PREVIEW_DEPLOYMENT_ID: '42', QA_PRIORITY: 'P2', SLACK_WEBHOOK_CI: WEBHOOK };
    return prepareReleaseQa({ env, readApi: evidenceApi(), writeApi: null, post: () => Promise.reject(new Error('down')), probe: () => Promise.resolve() })
        .then(value => expect(value).toMatchObject({ outcome: 'NO_MANUAL_QA_REQUIRED', slack: { delivered: false } }));
});

test('dispatch outside the owner or with an invalid explicit priority is rejected before any read', () => {
    const env = { ...ownerEnv, CANDIDATE_SHA: '', PREVIEW_DEPLOYMENT_ID: '', QA_PRIORITY: 'P9' };
    expect(() => prepareReleaseQa({ env, readApi: evidenceApi(), writeApi: null })).toThrow(/QA_PRIORITY/);
    expect(() => prepareReleaseQa({ env: { ...env, QA_PRIORITY: '', GITHUB_ACTOR: 'someone' }, readApi: evidenceApi(), writeApi: null })).toThrow(/syllik/);
});

function resultFixture({ body = 'QA PASS', user = { login: 'SoRawSteak', type: 'User' }, updatedAt = '2026-10-23T11:00:00Z', state = 'open', title = `Release QA ${SHA}` } = {}) {
    const issue = { number: 50, state, title, body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`, created_at: '2026-10-23T10:00:00Z',
        html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50', assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const comment = { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', user, body, created_at: '2026-10-23T11:00:00Z', updated_at: updatedAt };
    const event = { action: 'created', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body } };
    return { event, api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? comment : issue) } };
}

test('a valid result with a leading space and notes posts one Slack line mentioning the mapped owner', () => {
    const posted = [];
    const { event, api } = resultFixture({ body: ' qa pass \nAll checks done' });
    const env = { SLACK_WEBHOOK_CI: WEBHOOK, SLACK_USER_MAP: '{"syllik":"U0OWNER123"}' };
    return readResultAndNotify({ event, api, env, post: (url, payload) => { posted.push(payload.text); return Promise.resolve(true); } }).then(value => {
        expect(value).toMatchObject({ outcome: 'VALID_QA_RESULT', result: { outcome: 'PASS', sha: SHA, qa: 'SoRawSteak' }, slack: { delivered: true } });
        expect(posted).toEqual([`<@U0OWNER123> Frontend QA PASS by SoRawSteak for ${SHA}: https://github.com/ChipIn-one/chipin-frontend/issues/50`]);
        expect(posted[0]).not.toContain('All checks done');
    });
});

test('a Slack failure is reported and does not change a valid result', () => {
    const { event, api } = resultFixture({ body: 'QA FAIL\nSettle up is broken' });
    return readResultAndNotify({ event, api, env: { SLACK_WEBHOOK_CI: WEBHOOK, SLACK_USER_MAP: '{}' }, post: () => Promise.reject(new Error('down')) }).then(value => {
        expect(value).toMatchObject({ outcome: 'VALID_QA_RESULT', result: { outcome: 'FAIL' }, slack: { delivered: false } });
        expect(value.slack.reason).toMatch(/Slack/);
    });
});

test('owner, non-assigned, bot and edited results are rejected and never reach Slack; other comments are ignored', () => {
    let posts = 0;
    const post = () => { posts += 1; return Promise.resolve(true); };
    const env = { SLACK_WEBHOOK_CI: WEBHOOK, SLACK_USER_MAP: '{}' };
    const rejected = [
        resultFixture({ user: { login: 'syllik', type: 'User' } }),
        resultFixture({ user: { login: 'stranger', type: 'User' } }),
        resultFixture({ user: { login: 'github-actions[bot]', type: 'Bot' } }),
        resultFixture({ updatedAt: '2026-10-23T11:05:00Z' }),
    ];
    const next = index => {
        if (index === rejected.length) return Promise.resolve();
        return readResultAndNotify({ ...rejected[index], env, post })
            .then(() => { throw new Error(`Rejected case ${index} was accepted.`); }, error => expect(error.message).toMatch(/assigned QA|human|edited/))
            .then(() => next(index + 1));
    };
    return next(0).then(() => readResultAndNotify({ ...resultFixture({ body: 'Starting now, QA PASS later' }), env, post })).then(value => {
        expect(value).toEqual({ outcome: 'IGNORED' });
        expect(posts).toBe(0);
    });
});

const HEAD = 'd'.repeat(40);
const contentsPath = (file, ref) => `/repos/ChipIn-one/chipin-frontend/contents/${file}?ref=${ref}`;
const pkgText = (dependencies, devDependencies, version = '1.0.8') => JSON.stringify({ name: 'chipin-frontend', version, dependencies, devDependencies });
const lockText = (packages, version = '1.0.8') => JSON.stringify({ lockfileVersion: 3, version, packages: { '': { version }, ...packages } });

function packageRaw({ deps = { i18next: '^26.4.2' }, dev = { eslint: '^9.0.0' }, lockPackages = { 'node_modules/i18next': { version: '26.4.2' }, 'node_modules/eslint': { version: '9.0.0', dev: true } } } = {}) {
    const basePackages = { 'node_modules/i18next': { version: '26.4.2' }, 'node_modules/eslint': { version: '9.0.0', dev: true } };
    return {
        [contentsPath('package.json', BASE)]: pkgText({ i18next: '^26.4.2' }, { eslint: '^9.0.0' }),
        [contentsPath('package-lock.json', BASE)]: lockText(basePackages),
        [contentsPath('package.json', SHA)]: pkgText(deps, dev),
        [contentsPath('package-lock.json', SHA)]: lockText(lockPackages),
    };
}

test('package evidence is read at the Production baseline and the candidate', () => {
    const files = ['package.json', 'package-lock.json'];
    const bump = evidenceApi({ raw: packageRaw({ deps: { i18next: '^26.5.0' }, lockPackages: { 'node_modules/i18next': { version: '26.5.0' }, 'node_modules/eslint': { version: '9.0.0', dev: true } } }) });
    return readPackageBuildChanges(bump, files, BASE, SHA).then(changes => {
        expect(changes).toEqual(['package.json dependencies: i18next', 'package-lock.json: i18next']);
        const lint = evidenceApi({ raw: packageRaw({ dev: { eslint: '^9.1.0' }, lockPackages: { 'node_modules/i18next': { version: '26.4.2' }, 'node_modules/eslint': { version: '9.1.0', dev: true } } }) });
        return readPackageBuildChanges(lint, files, BASE, SHA);
    }).then(changes => {
        expect(changes).toEqual([]);
        return readPackageBuildChanges(evidenceApi(), ['src/App.tsx'], BASE, SHA);
    }).then(changes => {
        expect(changes).toEqual([]);
        const broken = evidenceApi({ raw: { ...packageRaw(), [contentsPath('package-lock.json', SHA)]: new Error('HTTP 500') } });
        return readPackageBuildChanges(broken, files, BASE, SHA);
    }).then(changes => expect(changes).toEqual(['package.json/package-lock.json evidence is unreadable; treated as build-affecting']));
});

test('an unlinked Dependabot dependencies bump goes to a QA Issue instead of blocking or skipping QA', () => {
    const files = ['package.json', 'package-lock.json'];
    const readApi = evidenceApi({ pulls: null, files, raw: packageRaw({ deps: { i18next: '^26.5.0' } }) });
    const env = { ...ownerEnv, CANDIDATE_SHA: SHA, PREVIEW_DEPLOYMENT_ID: '42', QA_PRIORITY: 'P2' };
    // Reaching the handoff configuration check proves the plan needs a QA Issue and nothing blocked before it.
    return prepareReleaseQa({ env, readApi, writeApi: null, probe: () => Promise.resolve() })
        .then(() => { throw new Error('Build-affecting bump skipped QA.'); }, error => expect(error.message).toMatch(/CHIPIN_ISSUE_WRITE_TOKEN/));
});

test('an unlinked lint devDependency bump stays NO_MANUAL_QA_REQUIRED', () => {
    const files = ['package.json', 'package-lock.json'];
    const readApi = evidenceApi({ pulls: null, files, raw: packageRaw({ dev: { eslint: '^9.1.0' },
        lockPackages: { 'node_modules/i18next': { version: '26.4.2' }, 'node_modules/eslint': { version: '9.1.0', dev: true } } }) });
    const env = { ...ownerEnv, CANDIDATE_SHA: SHA, PREVIEW_DEPLOYMENT_ID: '42', QA_PRIORITY: 'P2' };
    return prepareReleaseQa({ env, readApi, writeApi: null, probe: () => Promise.resolve() })
        .then(value => expect(value).toMatchObject({ outcome: 'NO_MANUAL_QA_REQUIRED', noQa: [{ commit: SHA }] }));
});

test('a fallback candidate is labelled as not the master head on the no-QA line', () => {
    const posted = [];
    const post = (url, payload) => { posted.push(payload.text); return Promise.resolve(true); };
    const env = { ...ownerEnv, CANDIDATE_SHA: '', PREVIEW_DEPLOYMENT_ID: '', SLACK_WEBHOOK_CI: WEBHOOK };
    return prepareReleaseQa({ env, readApi: evidenceApi({ head: { sha: HEAD, preview: true } }), writeApi: null, post, probe: () => Promise.resolve() }).then(value => {
        expect(value.candidate).toMatchObject({ sha: SHA, head: HEAD, fallback: true });
        expect(posted[0]).toContain(`(not master head ${HEAD.slice(0, 7)}: CI pending)`);
        posted.length = 0;
        return prepareReleaseQa({ env, readApi: evidenceApi({ head: { sha: HEAD, preview: false } }), writeApi: null, post, probe: () => Promise.resolve() });
    }).then(() => {
        expect(posted[0]).toContain(`(not master head ${HEAD.slice(0, 7)}: Preview pending)`);
        posted.length = 0;
        return prepareReleaseQa({ env, readApi: evidenceApi(), writeApi: null, post, probe: () => Promise.resolve() });
    }).then(() => expect(posted[0]).not.toContain('not master head'));
});

test('a fallback candidate is labelled as not the master head on the handoff line', () => {
    const posted = [];
    const issue = { number: 50, html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50' };
    return sendHandoff({ post: (url, payload) => { posted.push(payload.text); return Promise.resolve(true); }, webhook: WEBHOOK, slackId: 'U0C9X8T4R2Q',
        issue, sha: SHA, url: PREVIEW_URL, fallbackNote: ` (not master head ${HEAD.slice(0, 7)}: CI pending)` }).then(() => {
        expect(posted[0].split('\n')[0]).toBe(`<@U0C9X8T4R2Q> Frontend QA candidate ${SHA} (not master head ddddddd: CI pending)`);
    });
});

function editedFixture({ action = 'edited', user = { login: 'SoRawSteak', type: 'User' } } = {}) {
    const { api } = resultFixture({ updatedAt: '2026-10-23T11:05:00Z', body: 'QA FAIL', user });
    const event = { action, repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 },
        comment: { id: 8, body: action === 'deleted' ? 'QA PASS' : 'QA FAIL', user }, changes: action === 'edited' ? { body: { from: 'QA PASS' } } : undefined };
    if (action === 'deleted') return { event, api: { request: path => (path.endsWith('/comments/8') ? Promise.resolve(null) : api.request(path)) } };
    return { event, api };
}

test('editing or deleting a result from the assigned QA posts one "no longer valid" line', () => {
    const posted = [];
    const post = (url, payload) => { posted.push(payload.text); return Promise.resolve(true); };
    const env = { SLACK_WEBHOOK_CI: WEBHOOK, SLACK_USER_MAP: '{"syllik":"U0OWNER123"}' };
    return readResultAndNotify({ ...editedFixture(), env, post }).then(value => {
        expect(value).toMatchObject({ outcome: 'QA_RESULT_INVALIDATED', slack: { delivered: true } });
        expect(posted).toEqual([`<@U0OWNER123> Frontend QA result for ${SHA} was edited or deleted and is no longer valid: https://github.com/ChipIn-one/chipin-frontend/issues/50`]);
        return readResultAndNotify({ ...editedFixture({ action: 'deleted' }), env, post });
    }).then(value => {
        expect(value).toMatchObject({ outcome: 'QA_RESULT_INVALIDATED', slack: { delivered: true } });
        expect(posted).toHaveLength(2);
        return readResultAndNotify({ ...editedFixture(), env, post: () => Promise.reject(new Error('down')) });
    }).then(value => {
        expect(value).toMatchObject({ outcome: 'QA_RESULT_INVALIDATED', slack: { delivered: false } });
        return readResultAndNotify({ ...editedFixture({ user: { login: 'stranger', type: 'User' } }), env, post });
    }).then(value => {
        expect(value.outcome).toBe('QA_RESULT_INVALIDATED');
        expect(value).not.toHaveProperty('slack');
        expect(posted).toHaveLength(2);
    });
});

test('a near-miss first line from the assigned QA fails with the allowed lines; from anyone else it is ignored', () => {
    let posts = 0;
    const post = () => { posts += 1; return Promise.resolve(true); };
    const env = { SLACK_WEBHOOK_CI: WEBHOOK, SLACK_USER_MAP: '{}' };
    const next = bodies => {
        if (bodies.length === 0) return Promise.resolve();
        return readResultAndNotify({ ...resultFixture({ body: bodies[0] }), env, post })
            .then(() => { throw new Error(`Near miss ${bodies[0]} passed.`); },
                error => expect(error.message).toBe('QA result first line must be exactly QA PASS, QA FAIL or QA BLOCKED.'))
            .then(() => next(bodies.slice(1)));
    };
    return next(['QA PASSED', '**QA PASS**', 'QA PASS.']).then(() => Promise.all([
        readResultAndNotify({ ...resultFixture({ body: 'QA PASSED', user: { login: 'stranger', type: 'User' } }), env, post }),
        readResultAndNotify({ ...resultFixture({ body: 'QA PASSED', user: { login: 'syllik', type: 'User' } }), env, post }),
    ])).then(values => {
        expect(values).toEqual([{ outcome: 'IGNORED' }, { outcome: 'IGNORED' }]);
        expect(posts).toBe(0);
    });
});

test('a marker in a closed Issue or in an Issue with another title is not accepted', () => {
    const env = { SLACK_WEBHOOK_CI: WEBHOOK, SLACK_USER_MAP: '{}' };
    let posts = 0;
    const post = () => { posts += 1; return Promise.resolve(true); };
    return Promise.all([
        readResultAndNotify({ ...resultFixture({ state: 'closed' }), env, post }),
        readResultAndNotify({ ...resultFixture({ title: 'My own QA notes' }), env, post }),
        readResultAndNotify({ ...resultFixture({ title: `Release QA ${BASE}` }), env, post }),
        readResultAndNotify({ ...editedFixture(), api: resultFixture({ state: 'closed', updatedAt: '2026-10-23T11:05:00Z' }).api, env, post }),
    ]).then(values => {
        expect(values).toEqual([{ outcome: 'IGNORED' }, { outcome: 'IGNORED' }, { outcome: 'IGNORED' }, { outcome: 'IGNORED' }]);
        expect(posts).toBe(0);
    });
});
