import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, test, vi } from 'vitest';

import { DISPATCH_URL, EVENT_TYPE, forward, main, readHint } from './forward-production-deployment.mjs';

const SHA = '6f21103aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const event = (overrides = {}) => ({
    deployment: { id: 7390928173, sha: SHA, environment: 'Production', creator: { login: 'vercel[bot]' }, ...overrides.deployment },
    deployment_status: { state: 'success', ...overrides.deployment_status },
});
const respond = status => vi.fn(() => Promise.resolve({ status }));
const TOKEN = { CHIPIN_COMPLETION_DISPATCH_TOKEN: 'test-token' };

describe('forward-production-deployment workflow', () => {
    const text = readFileSync('.github/workflows/forward-production-deployment.yml', 'utf8');
    const workflow = parse(text);
    const job = workflow.jobs.forward;

    test('runs only on deployment_status, guarded to a successful vercel[bot] Production deployment', () => {
        expect(Object.keys(workflow.on)).toEqual(['deployment_status']);
        expect(Object.keys(workflow.jobs)).toEqual(['forward']);
        expect(job.if).toContain("github.event.deployment.environment == 'Production'");
        expect(job.if).toContain("github.event.deployment_status.state == 'success'");
        expect(job.if).toContain("github.event.deployment.creator.login == 'vercel[bot]'");
        expect(job.if.split('&&')).toHaveLength(3);
        expect(job.if).not.toContain('||');
    });

    test('has minimal permissions and passes only the dispatch secret through env', () => {
        expect(workflow.permissions).toEqual({ contents: 'read' });
        expect(job.permissions).toBeUndefined();
        const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'));
        expect(checkout.with['persist-credentials']).toBe(false);
        for (const step of job.steps.filter(item => item.uses)) expect(step.uses).toMatch(/@[0-9a-f]{40}$/);
        const send = job.steps.find(step => step.run);
        expect(send.run).toBe('node scripts/forward-production-deployment.mjs');
        expect(send.env).toEqual({ CHIPIN_COMPLETION_DISPATCH_TOKEN: '${{ secrets.CHIPIN_COMPLETION_DISPATCH_TOKEN }}' });
        for (const step of job.steps) expect(step.run ?? '').not.toContain('${{');
        expect(text).not.toContain('github.token');
        expect(text).not.toMatch(/github\.event\.deployment(?:_status)?\.(?:sha|id|payload|description|ref)\b/u);
    });
});

describe('readHint', () => {
    test('returns only the deployment id and SHA of a successful vercel[bot] Production deployment', () => {
        expect(readHint(event())).toEqual({ deployment_id: 7390928173, sha: SHA });
    });

    test('ignores Preview, unsuccessful and foreign-creator deployments', () => {
        expect(readHint(event({ deployment: { environment: 'Preview' } }))).toBeNull();
        for (const state of ['failure', 'error', 'in_progress', 'pending', 'queued', 'inactive']) {
            expect(readHint(event({ deployment_status: { state } })), state).toBeNull();
        }
        expect(readHint(event({ deployment: { creator: { login: 'syllik' } } }))).toBeNull();
        expect(readHint(event({ deployment: { creator: null } }))).toBeNull();
        expect(readHint({})).toBeNull();
    });

    test('rejects a malformed deployment id or SHA', () => {
        for (const id of [0, -1, 1.5, '7390928173', null, 2 ** 53]) {
            expect(() => readHint(event({ deployment: { id } })), String(id)).toThrow(/deployment\.id/u);
        }
        for (const sha of ['6f21103', SHA.toUpperCase(), `${SHA}0`, `${SHA.slice(0, 39)}$`, null, 123]) {
            expect(() => readHint(event({ deployment: { sha } })), String(sha)).toThrow(/deployment\.sha/u);
        }
    });
});

describe('forward', () => {
    test('sends exactly one repository_dispatch with the hint', () => {
        const fetchImpl = respond(204);
        return forward({ env: TOKEN, event: event(), fetchImpl }).then(result => {
            expect(result.status).toBe('sent');
            expect(fetchImpl).toHaveBeenCalledTimes(1);
            const [url, init] = fetchImpl.mock.calls[0];
            expect(url).toBe(DISPATCH_URL);
            expect(url).toBe('https://api.github.com/repos/ChipIn-one/.github/dispatches');
            expect(init.method).toBe('POST');
            expect(init.headers.Authorization).toBe('Bearer test-token');
            expect(JSON.parse(init.body)).toEqual({
                event_type: EVENT_TYPE, client_payload: { deployment_id: 7390928173, sha: SHA },
            });
            expect(EVENT_TYPE).toBe('frontend-production-deployed');
        });
    });

    test('sends nothing for an event the guard should have filtered', () => {
        const fetchImpl = respond(204);
        return forward({ env: TOKEN, event: event({ deployment: { environment: 'Preview' } }), fetchImpl }).then(result => {
            expect(result.status).toBe('skipped');
            expect(fetchImpl).not.toHaveBeenCalled();
        });
    });

    test('warns without sending when the token is missing', () => {
        const fetchImpl = respond(204);
        return forward({ env: {}, event: event(), fetchImpl }).then(result => {
            expect(result.status).toBe('warning');
            expect(result.reason).toMatch(/CHIPIN_COMPLETION_DISPATCH_TOKEN is not set/u);
            expect(fetchImpl).not.toHaveBeenCalled();
        });
    });

    test('turns an HTTP or network failure into a warning', () => {
        const rejected = vi.fn(() => Promise.reject(new TypeError('fetch failed')));
        return Promise.all([
            forward({ env: TOKEN, event: event(), fetchImpl: respond(404) }),
            forward({ env: TOKEN, event: event(), fetchImpl: rejected }),
        ]).then(([http, network]) => {
            expect(http).toMatchObject({ status: 'warning' });
            expect(http.reason).toMatch(/HTTP 404/u);
            expect(network).toMatchObject({ status: 'warning' });
            expect(network.reason).toMatch(/TypeError/u);
            expect(network.reason).not.toContain('test-token');
        });
    });

    test('rejects a malformed SHA without sending', () => {
        const fetchImpl = respond(204);
        return expect(forward({ env: TOKEN, event: event({ deployment: { sha: 'abc' } }), fetchImpl }))
            .rejects.toThrow(/deployment\.sha/u)
            .then(() => expect(fetchImpl).not.toHaveBeenCalled());
    });
});

describe('main', () => {
    const eventFile = body => {
        const path = join(mkdtempSync(join(tmpdir(), 'forward-deploy-')), 'event.json');
        writeFileSync(path, JSON.stringify(body));
        return path;
    };

    test('reads the event file and writes a ::warning:: line when the token is missing', () => {
        const write = vi.fn();
        return main({ GITHUB_EVENT_PATH: eventFile(event()) }, { fetchImpl: respond(204), write }).then(result => {
            expect(result.status).toBe('warning');
            expect(write).toHaveBeenCalledWith(expect.stringMatching(/^::warning::CHIPIN_COMPLETION_DISPATCH_TOKEN is not set/u));
        });
    });

    test('requires the event file', () => expect(main({}, { fetchImpl: respond(204), write: vi.fn() })).rejects.toThrow(/GITHUB_EVENT_PATH/u));
});
