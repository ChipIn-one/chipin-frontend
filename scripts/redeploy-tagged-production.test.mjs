import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, test, vi } from 'vitest';

import {
    API,
    deploymentRef,
    main,
    readConfig,
    redact,
    redeploy,
    validateSource,
} from './redeploy-tagged-production.mjs';

const SHA = '6f21103aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TOKEN = 'secret-vercel-token';
const ENV = {
    VERCEL_TOKEN: TOKEN,
    VERCEL_TEAM_ID: 'team_abc',
    VERCEL_PROJECT_ID: 'prj_front',
    DEPLOYED_SHA: SHA,
    RELEASE_TAG: 'v1.4.0',
    DEPLOYMENT_TARGET_URL: 'https://chipin-frontend-x1y2-chipin.vercel.app',
};
const SOURCE = {
    id: 'dpl_source',
    name: 'chipin-frontend',
    projectId: 'prj_front',
    target: 'production',
    gitSource: { type: 'github', sha: SHA },
};
const reply = (status, body) =>
    Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    });
const vercel = ({
    source = SOURCE,
    project = [200, { id: 'prj_front', targets: { production: { id: 'dpl_source' } } }],
    list = [200, { deployments: [{ uid: 'dpl_source' }] }],
    post = [200, { id: 'dpl_new', url: 'chipin-frontend-new.vercel.app', gitSource: { sha: SHA } }],
} = {}) =>
    vi.fn((url, init) => {
        if (init.method === 'POST') return reply(...post);
        if (url.includes('/v9/projects/')) return reply(...project);
        if (url.includes('/v6/deployments?')) return reply(...list);
        return reply(200, source);
    });
const posts = fetchImpl => fetchImpl.mock.calls.filter(([, init]) => init.method === 'POST');

describe('redeploy-tagged-production workflow job', () => {
    const text = readFileSync('.github/workflows/release-on-production.yml', 'utf8');
    const job = parse(text).jobs.redeploy;

    test('runs only after a fresh tag, pinned, with event fields only in env', () => {
        expect(job.needs).toEqual(['guard', 'release']);
        expect(job.if).toBe("needs.release.outputs.outcome == 'RELEASED'");
        expect(job.permissions).toEqual({ contents: 'read' });
        expect(job['timeout-minutes']).toBe(10);
        for (const step of job.steps) {
            if (step.uses) expect(step.uses).toMatch(/@[0-9a-f]{40}$/u);
            expect(step.run ?? '').not.toContain('${{');
        }
        const run = job.steps.at(-1);
        expect(run.run).toBe('node scripts/redeploy-tagged-production.mjs');
        expect(run.env).toEqual({
            DEPLOYED_SHA: '${{ needs.guard.outputs.sha }}',
            RELEASE_TAG: '${{ needs.release.outputs.tag }}',
            DEPLOYMENT_TARGET_URL: '${{ github.event.deployment_status.target_url }}',
            DEPLOYMENT_ENVIRONMENT_URL: '${{ github.event.deployment_status.environment_url }}',
            VERCEL_TOKEN: '${{ secrets.VERCEL_TOKEN }}',
            VERCEL_TEAM_ID: '${{ vars.VERCEL_TEAM_ID }}',
            VERCEL_PROJECT_ID: '${{ vars.VERCEL_PROJECT_ID }}',
        });
    });
});

describe('redeploy-tagged-production', () => {
    test('resolves the source deployment and redeploys it to Production with the tag', async () => {
        const fetchImpl = vercel();
        const lines = [];
        const result = await main(ENV, { fetchImpl, write: line => lines.push(line) });

        expect(fetchImpl).toHaveBeenCalledTimes(3);
        const [getUrl, get] = fetchImpl.mock.calls[0];
        expect(getUrl).toBe(
            `${API}/v13/deployments/chipin-frontend-x1y2-chipin.vercel.app?teamId=team_abc`,
        );
        expect(get.method).toBe('GET');
        expect(get.headers.Authorization).toBe(`Bearer ${TOKEN}`);
        expect(get.body).toBeUndefined();

        const [projectUrl, projectGet] = fetchImpl.mock.calls[1];
        expect(projectUrl).toBe(`${API}/v9/projects/prj_front?teamId=team_abc`);
        expect(projectGet.headers.Authorization).toBe(`Bearer ${TOKEN}`);

        const [postUrl, post] = fetchImpl.mock.calls[2];
        expect(postUrl).toBe(`${API}/v13/deployments?teamId=team_abc&forceNew=1`);
        expect(post.method).toBe('POST');
        expect(post.headers).toMatchObject({
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        });
        expect(JSON.parse(post.body)).toEqual({
            name: 'chipin-frontend',
            project: 'prj_front',
            deploymentId: 'dpl_source',
            target: 'production',
        });

        expect(result).toEqual({
            status: 'redeployed',
            confirmed: true,
            source: 'dpl_source',
            id: 'dpl_new',
            url: 'chipin-frontend-new.vercel.app',
            tag: 'v1.4.0',
        });
        expect(lines.join('')).toContain('dpl_new');
        expect(lines.join('')).toContain('::notice::');
        expect(lines.join('')).toContain('v1.4.0');
        expect(lines.join('')).not.toContain(TOKEN);
        expect(lines.join('')).not.toContain('could not be confirmed');
    });

    test('skips with a green warning and no POST when Production moved to another deployment', async () => {
        const fetchImpl = vercel({
            project: [200, { targets: { production: { id: 'dpl_newer' } } }],
        });
        const lines = [];
        const result = await main(ENV, { fetchImpl, write: line => lines.push(line) });
        expect(result.status).toBe('skipped');
        expect(posts(fetchImpl)).toHaveLength(0);
        expect(lines.join('')).toBe(
            '::warning::Skipping redeploy: Production moved to dpl_newer since dpl_source was promoted (a newer Promote or a rollback); v1.4.0 stays without an in-app version until its next Promote.\n',
        );
    });

    test('falls back to the newest READY production deployment when targets.production is absent', async () => {
        const fetchImpl = vercel({ project: [200, { id: 'prj_front' }] });
        const result = await redeploy({ env: ENV, fetchImpl });
        expect(result.status).toBe('redeployed');
        expect(fetchImpl.mock.calls[2][0]).toBe(
            `${API}/v6/deployments?projectId=prj_front&target=production&state=READY&limit=1&teamId=team_abc`,
        );
        expect(posts(fetchImpl)).toHaveLength(1);

        const moved = vercel({
            project: [200, {}],
            list: [200, { deployments: [{ uid: 'dpl_rollback' }] }],
        });
        expect((await redeploy({ env: ENV, fetchImpl: moved })).status).toBe('skipped');
        expect(posts(moved)).toHaveLength(0);
    });

    test('fails without a POST when the current Production cannot be read', async () => {
        const failed = vercel({ project: [500, 'upstream error'] });
        await expect(redeploy({ env: ENV, fetchImpl: failed })).rejects.toThrow(
            /GET .*\/v9\/projects\/prj_front.* HTTP 500/u,
        );
        expect(posts(failed)).toHaveLength(0);

        const empty = vercel({ project: [200, {}], list: [200, { deployments: [] }] });
        await expect(redeploy({ env: ENV, fetchImpl: empty })).rejects.toThrow(
            /current Production deployment/u,
        );
        expect(posts(empty)).toHaveLength(0);
    });

    test('fails naming the new deployment when the redeploy builds another commit', async () => {
        const fetchImpl = vercel({
            post: [200, { id: 'dpl_new', meta: { githubCommitSha: 'c'.repeat(40) } }],
        });
        await expect(redeploy({ env: ENV, fetchImpl })).rejects.toThrow(
            /redeploy dpl_new builds commit c{40}, not the released .*cancel it/u,
        );
    });

    test('notes an unconfirmed commit when the redeploy response has no SHA', async () => {
        const fetchImpl = vercel({ post: [200, { id: 'dpl_new' }] });
        const lines = [];
        const result = await main(ENV, { fetchImpl, write: line => lines.push(line) });
        expect(result.confirmed).toBe(false);
        expect(lines.join('')).toContain(
            '::notice::The Vercel response has no commit SHA, so the commit of dpl_new could not be confirmed.',
        );
    });

    test('accepts the commit SHA from meta.githubCommitSha and falls back to environment_url', async () => {
        const fetchImpl = vercel({
            source: { ...SOURCE, gitSource: undefined, meta: { githubCommitSha: SHA } },
        });
        await redeploy({
            env: {
                ...ENV,
                DEPLOYMENT_TARGET_URL: '',
                DEPLOYMENT_ENVIRONMENT_URL: 'https://chipin-frontend-x1y2-chipin.vercel.app/',
            },
            fetchImpl,
        });
        expect(fetchImpl.mock.calls[0][0]).toContain(
            '/v13/deployments/chipin-frontend-x1y2-chipin.vercel.app?',
        );
    });

    test('maps a vercel.com inspector URL to a dpl_ id', () => {
        expect(deploymentRef(['https://vercel.com/chipin/chipin-frontend/AbC123'])).toBe(
            'dpl_AbC123',
        );
        expect(() => deploymentRef(['not a url', 'http://plain.example'])).toThrow(/No usable/u);
    });

    test('fails with what to configure when the Vercel secret or variables are missing', async () => {
        const fetchImpl = vercel();
        const env = { ...ENV, VERCEL_TOKEN: '', VERCEL_PROJECT_ID: undefined };
        await expect(redeploy({ env, fetchImpl })).rejects.toThrow(
            /repository secret VERCEL_TOKEN.*repository variable VERCEL_PROJECT_ID/u,
        );
        expect(() => readConfig({ ...ENV, VERCEL_TEAM_ID: '' })).toThrow(/VERCEL_TEAM_ID/u);
        expect(() => readConfig({ ...ENV, RELEASE_TAG: '1.4.0' })).toThrow(/RELEASE_TAG/u);
        expect(() => readConfig({ ...ENV, DEPLOYED_SHA: 'master' })).toThrow(/DEPLOYED_SHA/u);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    test('refuses a source built from another commit', async () => {
        const fetchImpl = vercel({ source: { ...SOURCE, gitSource: { sha: 'b'.repeat(40) } } });
        await expect(redeploy({ env: ENV, fetchImpl })).rejects.toThrow(/is not the released/u);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    test('refuses a source of another project', async () => {
        const fetchImpl = vercel({ source: { ...SOURCE, projectId: 'prj_other' } });
        await expect(redeploy({ env: ENV, fetchImpl })).rejects.toThrow(
            /project prj_other is not VERCEL_PROJECT_ID/u,
        );
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    test('refuses a non-production source', () => {
        expect(() =>
            validateSource({ ...SOURCE, target: null }, { projectId: 'prj_front', sha: SHA }),
        ).toThrow(/target missing is not production/u);
        expect(() =>
            validateSource({ ...SOURCE, target: 'preview' }, { projectId: 'prj_front', sha: SHA }),
        ).toThrow(/target preview is not production/u);
    });

    test('fails on a non-2xx response with the body, token redacted', async () => {
        const fetchImpl = vercel({
            post: [403, { error: { code: 'forbidden', message: `token ${TOKEN} lacks scope` } }],
        });
        const error = await redeploy({ env: ENV, fetchImpl }).catch(e => e);
        expect(error.message).toContain('HTTP 403');
        expect(error.message).toContain('forbidden');
        expect(error.message).toContain('[REDACTED]');
        expect(error.message).not.toContain(TOKEN);
    });

    test('fails when the source lookup errors', async () => {
        const fetchImpl = vi.fn(() => reply(404, { error: { code: 'not_found' } }));
        await expect(redeploy({ env: ENV, fetchImpl })).rejects.toThrow(
            /GET .* HTTP 404.*not_found/u,
        );
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    test('redact replaces every occurrence of the token', () => {
        expect(redact(`a ${TOKEN} b ${TOKEN}`, TOKEN)).toBe('a [REDACTED] b [REDACTED]');
        expect(redact('plain', '')).toBe('plain');
    });
});
