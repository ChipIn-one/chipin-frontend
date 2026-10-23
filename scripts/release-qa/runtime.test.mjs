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

test('earlier same-SHA run with no Issue blocks an ambiguous create retry', () => {
    expect(assertRetrySafe([{ id: 100, display_title: `QA prepare ${SHA}` }], 100, SHA, null)).toBe(true);
    expect(() => assertRetrySafe([{ id: 99, display_title: `QA prepare ${SHA}` }], 101, SHA, null)).toThrow(/ambiguous/);
    expect(assertRetrySafe([{ id: 99, display_title: `QA prepare ${SHA}` }], 101, SHA, { number: 50 })).toBe(true);
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

test('proven docs-only candidate records no manual QA without Issue-write or Slack credentials', () => {
    const readApi = {
        request: path => {
            if (path.endsWith('/deployments/42')) return Promise.resolve({ id: 42, sha: SHA, ref: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' } });
            if (path.includes('/rules/branches/master')) return Promise.resolve([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'frontend-ci', integration_id: 15368 }] } }]);
            if (path.includes(`/compare/${SHA}...master`)) return Promise.resolve({ status: 'identical' });
            if (path.includes(`/compare/${BASE}...${SHA}`)) return Promise.resolve({ status: 'ahead', total_commits: 1, commits: [{ sha: SHA }], files: [{ filename: 'docs/help.md' }] });
            throw new Error(`Unexpected request ${path}`);
        },
        list: path => {
            if (path.endsWith('/deployments/42/statuses')) return Promise.resolve([{ state: 'success', environment_url: 'https://chipin-frontend-abc-sylliks-projects.vercel.app' }]);
            if (path.endsWith('/deployments?environment=Production')) return Promise.resolve([{ id: 7, sha: BASE, ref: BASE, environment: 'Production', creator: { login: 'vercel[bot]' } }]);
            if (path.endsWith('/deployments/7/statuses')) return Promise.resolve([{ state: 'success', environment_url: 'https://chipin.one' }]);
            throw new Error(`Unexpected list ${path}`);
        },
        listObject: (path, key) => Promise.resolve(key === 'check_runs'
            ? [{ name: 'frontend-ci', head_sha: SHA, conclusion: 'success', status: 'completed', app: { id: 15368, slug: 'github-actions' } }]
            : [{ head_sha: SHA, conclusion: 'success', status: 'completed', event: 'push', path: '.github/workflows/frontend-ci.yml' }]),
    };
    const env = { CHIPIN_DEV_READ_TOKEN: 'read', CANDIDATE_SHA: SHA, PREVIEW_DEPLOYMENT_ID: '42', QA_PRIORITY: 'P2', GITHUB_ACTOR: 'syllik', GITHUB_TRIGGERING_ACTOR: 'syllik', GITHUB_REF: 'refs/heads/master' };
    return prepareReleaseQa({ env, readApi, writeApi: null, probe: () => Promise.resolve() }).then(value => {
        expect(value).toMatchObject({ outcome: 'NO_MANUAL_QA_REQUIRED', sha: SHA, evidence: ['docs/help.md'] });
    });
});
