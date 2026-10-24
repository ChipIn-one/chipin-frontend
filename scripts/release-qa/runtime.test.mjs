import { expect, test } from 'vitest';
import { assertAncestry, assertRetrySafe, chooseProductionBaseline, prepareReleaseQa, sendHandoff, validateResultEvent } from './runtime.mjs';

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
    const issue = { number: 50, body, created_at: '2026-10-23T10:00:00Z', html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50', assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const comment = { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', user: { login: 'SoRawSteak', type: 'User' }, body: `QA RESULT: PASS\nSHA: ${SHA}\nTOTAL TIME: 30m`, created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:00:00Z' };
    const event = { action: 'created', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: comment.body } };
    const api = { request: path => Promise.resolve(path.endsWith('/comments/8') ? comment : issue) };
    return validateResultEvent({ event, api }).then(value => {
        expect(value).toMatchObject({ outcome: 'VALID_QA_RESULT', result: { sha: SHA, qa: 'SoRawSteak' } });
        return validateResultEvent({ event, api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? { ...comment, updated_at: '2026-10-23T11:01:00Z' } : issue) } });
    }).then(() => { throw new Error('Edited result was accepted.'); }, error => {
        expect(error.message).toMatch(/edited/);
    });
});

test('edited-to-PASS, edited-away and deleted QA results invalidate earlier validation', () => {
    const issue = { number: 50, body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`,
        created_at: '2026-10-23T10:00:00Z', html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50', assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const original = `QA RESULT: FAIL\nSHA: ${SHA}\nTOTAL TIME: 30m`;
    const comment = { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', user: { login: 'SoRawSteak', type: 'User' },
        body: `QA RESULT: PASS\nSHA: ${SHA}\nTOTAL TIME: 30m`, created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:01:00Z' };
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
    const plain = { number: 50, body: 'Not a QA issue', html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/50' };
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
        const created = { action: 'created', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: `QA RESULT: PASS\nSHA: ${SHA}\nTOTAL TIME: 30m` } };
        const passComment = { ...comment, body: created.comment.body };
        return validateResultEvent({ event: created, api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? passComment : plain) } });
    }).then(created => {
        expect(created).toEqual({ outcome: 'IGNORED' });
        expect(created).not.toMatchObject({ outcome: 'VALID_QA_RESULT' });
    });
});

test('deleting a non-result comment on a QA Issue is ignored when its body is readable', () => {
    const issue = { number: 50, body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`,
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
    const issue = { number: 50, body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`,
        created_at: '2026-10-23T10:00:00Z', assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const comment = { id: 8, issue_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend/issues/50', user: { login: 'syllik', type: 'User' },
        body: `QA RESULT: PASS\nSHA: ${SHA}\nTOTAL TIME: 30m`, created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:00:00Z' };
    const event = { action: 'created', repository: { full_name: 'ChipIn-one/chipin-frontend' }, issue: { number: 50 }, comment: { id: 8, body: comment.body } };
    return validateResultEvent({ event, api: { request: path => Promise.resolve(path.endsWith('/comments/8') ? comment : issue) } })
        .then(() => { throw new Error('Unauthorized result was accepted.'); }, error => expect(error.message).toMatch(/assigned QA/));
});

function docsEvidenceApi(linked) {
    const readApi = {
        request: path => {
            if (path.endsWith('/deployments/42')) return Promise.resolve({ id: 42, sha: SHA, ref: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' } });
            if (path.includes('/rules/branches/master')) return Promise.resolve([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'frontend-ci', integration_id: 15368 }] } }]);
            if (path.includes(`/compare/${SHA}...master`)) return Promise.resolve({ status: 'identical' });
            if (path.includes(`/compare/${BASE}...${SHA}`)) return Promise.resolve({ status: 'ahead', total_commits: 1, commits: [{ sha: SHA }], files: [{ filename: 'docs/help.md' }] });
            if (path.endsWith('/issues/12')) return Promise.resolve({ number: 12, repository_url: 'https://api.github.com/repos/ChipIn-one/chipin-frontend', body: '## Acceptance\n- [ ] Documentation updated' });
            throw new Error(`Unexpected request ${path}`);
        },
        list: path => {
            if (path.endsWith('/deployments/42/statuses')) return Promise.resolve([{ state: 'success', environment_url: 'https://chipin-frontend-abc-sylliks-projects.vercel.app' }]);
            if (path.endsWith('/deployments?environment=Production')) return Promise.resolve([{ id: 7, sha: BASE, ref: BASE, environment: 'Production', creator: { login: 'vercel[bot]' } }]);
            if (path.endsWith('/deployments/7/statuses')) return Promise.resolve([{ state: 'success', environment_url: 'https://chipin.one' }]);
            if (path.endsWith(`/commits/${SHA}/statuses`)) return Promise.resolve([]);
            if (path.endsWith(`/commits/${SHA}/pulls`)) return Promise.resolve(linked ? [{ number: 20, node_id: 'PR_20', merged_at: '2026-10-23T10:00:00Z', base: { ref: 'master' } }] : []);
            if (path.endsWith('/pulls/20/files')) return Promise.resolve([{ filename: 'docs/help.md' }]);
            throw new Error(`Unexpected list ${path}`);
        },
        listObject: (path, key) => Promise.resolve(key === 'check_runs'
            ? [{ name: 'frontend-ci', head_sha: SHA, conclusion: 'success', status: 'completed', app: { id: 15368, slug: 'github-actions' } }]
            : [{ head_sha: SHA, head_branch: 'master', conclusion: 'success', status: 'completed', event: 'push', path: '.github/workflows/frontend-ci.yml' }]),
        graphql: () => Promise.resolve({ node: { closingIssuesReferences: { totalCount: 1, nodes: [{ number: 12, repository: { nameWithOwner: 'ChipIn-one/chipin-frontend' } }] } } }),
    };
    return readApi;
}

test('proven linked docs-only candidate records no manual QA without Issue-write or Slack credentials', () => {
    const env = { CHIPIN_DEV_READ_TOKEN: 'read', CANDIDATE_SHA: SHA, PREVIEW_DEPLOYMENT_ID: '42', QA_PRIORITY: 'P2', GITHUB_ACTOR: 'syllik', GITHUB_TRIGGERING_ACTOR: 'syllik', GITHUB_REF: 'refs/heads/master' };
    return prepareReleaseQa({ env, readApi: docsEvidenceApi(true), writeApi: null, probe: () => Promise.resolve() }).then(value => {
        expect(value).toMatchObject({ outcome: 'NO_MANUAL_QA_REQUIRED', sha: SHA, evidence: ['docs/help.md'], included: [{ issue: 12, pulls: [20] }] });
    });
});

test('unlinked docs-only candidate is blocked before NO_MANUAL_QA_REQUIRED', () => {
    const env = { CHIPIN_DEV_READ_TOKEN: 'read', CANDIDATE_SHA: SHA, PREVIEW_DEPLOYMENT_ID: '42', QA_PRIORITY: 'P2', GITHUB_ACTOR: 'syllik', GITHUB_TRIGGERING_ACTOR: 'syllik', GITHUB_REF: 'refs/heads/master' };
    return prepareReleaseQa({ env, readApi: docsEvidenceApi(false), writeApi: null, probe: () => Promise.resolve() })
        .then(() => { throw new Error('Unlinked docs were accepted.'); }, error => expect(error.message).toMatch(/missing or ambiguous PR|unlinked/));
});
