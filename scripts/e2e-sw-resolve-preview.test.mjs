import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, test, vi } from 'vitest';

import { resolveE2eTarget } from '../apps/app/e2e/support/config.ts';
import {
    assertPreviewOrigin,
    createBranchCheck,
    createGitHubClient,
    main,
    pickPreview,
    readPrHeadSha,
    resolveTargetSha,
    retryTransient,
    TransientGitHubError,
    waitForPreview,
} from './e2e-sw-resolve-preview.mjs';

const SHA = '8f64575641c5dc7ee9764d7181f8a15bb1214e67';
const OTHER_SHA = 'b8d1cd3f87b6d81c78c598fa6b6cc4e337148b03';
const PREVIEW = 'https://chipin-frontend-ap0y7h1ua-sylliks-projects.vercel.app';

const entry = ({
    id = 1,
    sha = SHA,
    login = 'vercel[bot]',
    environment = 'Preview',
    states = [],
    statusLogin = 'vercel[bot]',
}) => ({
    deployment: { id, sha, ref: sha, environment, creator: { login } },
    statuses: states.map(state => ({
        state,
        creator: { login: statusLogin },
        environment_url: state === 'success' || state === 'inactive' ? `${PREVIEW}` : '',
    })),
});

describe('assertPreviewOrigin', () => {
    test('accepts a Preview of this project and returns its origin', () => {
        expect(assertPreviewOrigin(PREVIEW)).toBe(PREVIEW);
        expect(assertPreviewOrigin(`${PREVIEW}/`)).toBe(PREVIEW);
        expect(
            assertPreviewOrigin('https://chipin-frontend-git-test-x-sylliks-projects.vercel.app'),
        ).toBe('https://chipin-frontend-git-test-x-sylliks-projects.vercel.app');
    });

    test.each([
        'https://chipin.one',
        'https://app.chipin.one',
        'http://chipin-frontend-ap0y7h1ua-sylliks-projects.vercel.app',
        'https://chipin-frontend-ap0y7h1ua-sylliks-projects.vercel.app:8443',
        'https://user:pass@chipin-frontend-ap0y7h1ua-sylliks-projects.vercel.app',
        'https://chipin-frontend-ap0y7h1ua-sylliks-projects.vercel.app/dashboard',
        'https://chipin-frontend-ap0y7h1ua-sylliks-projects.vercel.app/?x=1',
        'https://other-ap0y7h1ua-sylliks-projects.vercel.app',
        'https://chipin-frontend-ap0y7h1ua-sylliks-projects.vercel.app.evil.com',
        'http://localhost:4173',
        'not a url',
        '',
    ])('rejects %s', url => {
        expect(() => assertPreviewOrigin(url)).toThrow();
    });

    // The e2e config checks the target again; both must agree on every https Preview candidate.
    test.each([
        PREVIEW,
        'https://chipin-frontend-git-test-x-sylliks-projects.vercel.app',
        'https://chipin-frontend--sylliks-projects.vercel.app',
        'https://chipin-frontend-ABC-sylliks-projects.vercel.app',
        'https://chipin-frontend-a_b-sylliks-projects.vercel.app',
        'https://chipin-frontend-x-other.vercel.app',
        'https://chipin.one',
    ])('agrees with resolveE2eTarget on %s', url => {
        const accepted = (() => {
            try {
                return resolveE2eTarget({ CHIPIN_E2E_BASE_URL: url }).kind === 'vercel-preview';
            } catch {
                return false;
            }
        })();
        if (accepted) {
            expect(assertPreviewOrigin(url)).toBe(new URL(url).origin);
        } else {
            expect(() => assertPreviewOrigin(url)).toThrow();
        }
    });
});

describe('pickPreview', () => {
    test('waits while there is no deployment yet', () => {
        expect(pickPreview([], SHA).status).toBe('waiting');
    });

    test('takes the success URL of a vercel[bot] Preview of the commit', () => {
        expect(pickPreview([entry({ states: ['success'] })], SHA)).toEqual({
            status: 'ready',
            url: PREVIEW,
        });
    });

    test('ignores other creators, environments and commits', () => {
        const untrusted = [
            entry({ id: 5, login: 'someone', states: ['success'] }),
            entry({ id: 6, environment: 'Production', states: ['success'] }),
            entry({ id: 7, sha: OTHER_SHA, states: ['success'] }),
            entry({ id: 8, environment: 'Preview \u2013 chipin-site', states: ['success'] }),
            entry({ id: 9, environment: 'Production \u2013 chipin-frontend', states: ['success'] }),
        ];
        expect(pickPreview(untrusted, SHA).status).toBe('waiting');
    });

    // chipin-frontend#801: a second Vercel project suffixes the environment with the project name.
    test('takes the app Preview under its per-project name', () => {
        expect(
            pickPreview(
                [entry({ environment: 'Preview \u2013 chipin-frontend', states: ['success'] })],
                SHA,
            ),
        ).toEqual({ status: 'ready', url: PREVIEW });
    });

    test('counts only statuses posted by vercel[bot]', () => {
        expect(pickPreview([entry({ states: ['success'], statusLogin: 'someone' })], SHA)).toEqual({
            status: 'waiting',
            reason: 'Preview build none',
        });
        const forged = entry({ states: ['success'] });
        forged.statuses.unshift({
            state: 'success',
            creator: { login: 'someone' },
            environment_url: 'https://chipin-frontend-forged-sylliks-projects.vercel.app',
        });
        expect(pickPreview([forged], SHA)).toEqual({ status: 'ready', url: PREVIEW });
        const failedThenForged = entry({ states: ['failure'] });
        failedThenForged.statuses.unshift({
            state: 'success',
            creator: { login: 'someone' },
            environment_url: PREVIEW,
        });
        expect(pickPreview([failedThenForged], SHA).status).toBe('failed');
    });

    test.each(['pending', 'queued', 'in_progress'])('waits while the build is %s', state => {
        expect(pickPreview([entry({ states: [state] })], SHA).status).toBe('waiting');
    });

    test('waits for a deployment without a status', () => {
        expect(pickPreview([entry({ states: [] })], SHA).status).toBe('waiting');
    });

    test.each(['failure', 'error', 'inactive'])('fails on a build that ended as %s', state => {
        expect(pickPreview([entry({ states: [state] })], SHA)).toMatchObject({
            status: 'failed',
        });
    });

    test('keeps the URL of a success that a newer deployment made inactive', () => {
        expect(pickPreview([entry({ states: ['inactive', 'success'] })], SHA)).toEqual({
            status: 'ready',
            url: PREVIEW,
        });
    });

    test('a redeploy that still builds waits only when nothing succeeded', () => {
        const older = entry({ id: 1, states: ['failure'] });
        const newer = entry({ id: 2, states: ['in_progress'] });
        expect(pickPreview([older, newer], SHA).status).toBe('waiting');
        expect(pickPreview([entry({ id: 1, states: ['success'] }), newer], SHA).status).toBe(
            'ready',
        );
    });

    test('rejects a success URL outside the allowlist', () => {
        const moved = entry({ states: ['success'] });
        moved.statuses[0].environment_url = 'https://chipin.one';
        expect(() => pickPreview([moved], SHA)).toThrow(/not allowlisted/);
    });
});

describe('waitForPreview', () => {
    test('polls until the Preview is ready', async () => {
        const readDeployments = vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([entry({ states: ['in_progress'] })])
            .mockResolvedValueOnce([entry({ states: ['success'] })]);
        const sleep = vi.fn(() => Promise.resolve());

        await expect(
            waitForPreview({ sha: SHA, readDeployments, sleep, now: () => 0 }),
        ).resolves.toBe(PREVIEW);
        expect(readDeployments).toHaveBeenCalledTimes(3);
        expect(sleep).toHaveBeenCalledTimes(2);
    });

    test('fails at once on a failed build', async () => {
        const readDeployments = vi.fn().mockResolvedValue([entry({ states: ['error'] })]);
        await expect(
            waitForPreview({ sha: SHA, readDeployments, sleep: vi.fn(), now: () => 0 }),
        ).rejects.toThrow(/did not build: Preview build error/);
    });

    test('stops when the wait runs out', async () => {
        let time = 0;
        const sleep = vi.fn(ms => {
            time += ms;
            return Promise.resolve();
        });
        const readDeployments = vi.fn().mockResolvedValue([]);
        await expect(
            waitForPreview({
                sha: SHA,
                readDeployments,
                sleep,
                now: () => time,
                timeoutMs: 60_000,
                intervalMs: 20_000,
            }),
        ).rejects.toThrow(/No successful Vercel Preview .* after 1 min/);
        // Reads at 0, 20, 40 and 60 s; one more wait would pass the deadline.
        expect(readDeployments).toHaveBeenCalledTimes(4);
    });

    test('keeps waiting through a transient GitHub error', async () => {
        const readDeployments = vi
            .fn()
            .mockRejectedValueOnce(new TransientGitHubError('GitHub GET /x returned HTTP 502.'))
            .mockResolvedValueOnce([entry({ states: ['success'] })]);
        const log = vi.fn();
        await expect(
            waitForPreview({ sha: SHA, readDeployments, sleep: vi.fn(), now: () => 0, log }),
        ).resolves.toBe(PREVIEW);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('HTTP 502'));
    });

    test('fails at once on any other error', async () => {
        const readDeployments = vi
            .fn()
            .mockRejectedValue(new Error('GitHub GET /x returned HTTP 403.'));
        const sleep = vi.fn();
        await expect(
            waitForPreview({ sha: SHA, readDeployments, sleep, now: () => 0 }),
        ).rejects.toThrow(/HTTP 403/);
        expect(sleep).not.toHaveBeenCalled();
    });

    test('rejects a short or uppercase SHA', async () => {
        const readDeployments = vi.fn();
        await expect(waitForPreview({ sha: 'abc123', readDeployments })).rejects.toThrow(
            /full 40-character/,
        );
        await expect(waitForPreview({ sha: SHA.toUpperCase(), readDeployments })).rejects.toThrow(
            /full 40-character/,
        );
        expect(readDeployments).not.toHaveBeenCalled();
    });
});

const REPO = 'ChipIn-one/chipin-frontend';
const ok = body => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const deploymentsApi = (
    statuses = [{ state: 'success', creator: { login: 'vercel[bot]' }, environment_url: PREVIEW }],
) =>
    vi.fn(url =>
        url.includes('/statuses')
            ? ok(statuses)
            : ok([
                  {
                      id: 7913122560,
                      sha: SHA,
                      environment: 'Preview',
                      creator: { login: 'vercel[bot]' },
                  },
              ]),
    );

describe('createGitHubClient', () => {
    const client = fetchImpl =>
        createGitHubClient({ repository: REPO, token: 'test-token', fetchImpl });

    test('reads the commit Preview deployments and their statuses with the token and a timeout', async () => {
        const fetchImpl = deploymentsApi();
        await expect(client(fetchImpl).readDeployments(SHA)).resolves.toHaveLength(1);
        expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
            `https://api.github.com/repos/${REPO}/deployments?sha=${SHA}&per_page=100`,
            `https://api.github.com/repos/${REPO}/deployments/7913122560/statuses?per_page=100`,
        ]);
        const [, init] = fetchImpl.mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer test-token');
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    test.each([429, 500, 502, 503])('HTTP %i is transient', async status => {
        const fetchImpl = vi.fn(() => Promise.resolve({ ok: false, status }));
        const error = await client(fetchImpl)
            .readDeployments(SHA)
            .catch(caught => caught);
        expect(error).toBeInstanceOf(TransientGitHubError);
        expect(error.message).toContain(`HTTP ${status}`);
    });

    test.each([
        ['a network error', new TypeError('fetch failed')],
        ['a timeout', new DOMException('The operation timed out.', 'TimeoutError')],
    ])('%s is transient', async (_, failure) => {
        const fetchImpl = vi.fn(() => Promise.reject(failure));
        await expect(client(fetchImpl).readDeployments(SHA)).rejects.toBeInstanceOf(
            TransientGitHubError,
        );
    });

    test.each([401, 403, 404, 422])(
        'HTTP %i fails for good, without echoing the body',
        async status => {
            const fetchImpl = vi.fn(() =>
                Promise.resolve({ ok: false, status, text: () => 'secret' }),
            );
            const error = await client(fetchImpl)
                .readDeployments(SHA)
                .catch(caught => caught);
            expect(error).not.toBeInstanceOf(TransientGitHubError);
            expect(error.message).toBe(
                `GitHub GET /deployments?sha=${SHA}&per_page=100 returned HTTP ${status}.`,
            );
        },
    );

    test('requires a repository and a token', () => {
        expect(() => createGitHubClient({ repository: 'x', token: 't' })).toThrow();
        expect(() => createGitHubClient({ repository: 'a/b', token: '' })).toThrow();
    });
});

describe('resolveTargetSha', () => {
    const base = {
        repository: REPO,
        readPull: vi.fn(),
        isOnBranch: vi.fn(),
    };

    test('takes the pull request head on pull_request', async () => {
        await expect(
            resolveTargetSha({ ...base, eventName: 'pull_request', prHeadSha: SHA }),
        ).resolves.toBe(SHA);
        await expect(
            resolveTargetSha({ ...base, eventName: 'pull_request', prHeadSha: 'main' }),
        ).rejects.toThrow(/full 40-character/);
    });

    test('takes the head of a dispatched pull request of this repository', async () => {
        const readPull = vi.fn(() =>
            Promise.resolve({ head: { sha: SHA, repo: { full_name: REPO } } }),
        );
        await expect(
            resolveTargetSha({
                ...base,
                readPull,
                eventName: 'workflow_dispatch',
                target: ' 780 ',
            }),
        ).resolves.toBe(SHA);
        expect(readPull).toHaveBeenCalledWith('780');
    });

    test('refuses a dispatched pull request from a fork', async () => {
        const readPull = vi.fn(() =>
            Promise.resolve({ head: { sha: SHA, repo: { full_name: 'someone/chipin-frontend' } } }),
        );
        await expect(
            resolveTargetSha({ ...base, readPull, eventName: 'workflow_dispatch', target: '780' }),
        ).rejects.toThrow(/does not come from ChipIn-one\/chipin-frontend/);
    });

    test('takes a dispatched SHA only when a branch contains it', async () => {
        const dispatch = isOnBranch =>
            resolveTargetSha({ ...base, isOnBranch, eventName: 'workflow_dispatch', target: SHA });
        await expect(dispatch(vi.fn(() => Promise.resolve(true)))).resolves.toBe(SHA);
        await expect(dispatch(vi.fn(() => Promise.resolve(false)))).rejects.toThrow(
            /not reachable from a branch/,
        );
    });

    test.each(['', 'abc123', SHA.toUpperCase(), '0', '#780', '780; rm -rf /'])(
        'refuses the dispatch target %j',
        async target => {
            await expect(
                resolveTargetSha({ ...base, eventName: 'workflow_dispatch', target }),
            ).rejects.toThrow(/pull request number or a full/);
        },
    );

    test('refuses other events', async () => {
        await expect(resolveTargetSha({ ...base, eventName: 'push' })).rejects.toThrow(
            /Unsupported event/,
        );
    });
});

describe('retryTransient', () => {
    test('retries transient errors and returns the first answer', async () => {
        const read = vi
            .fn()
            .mockRejectedValueOnce(new TransientGitHubError('HTTP 503'))
            .mockResolvedValueOnce('pull');
        const sleep = vi.fn(() => Promise.resolve());
        await expect(retryTransient(read, { sleep, now: () => 0 })).resolves.toBe('pull');
        expect(read).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledTimes(1);
    });

    test('rethrows any other error at once', async () => {
        const read = vi.fn().mockRejectedValue(new Error('HTTP 404'));
        const sleep = vi.fn();
        await expect(retryTransient(read, { sleep, now: () => 0 })).rejects.toThrow('HTTP 404');
        expect(sleep).not.toHaveBeenCalled();
    });

    test('gives up after its time limit', async () => {
        let time = 0;
        const sleep = vi.fn(ms => {
            time += ms;
            return Promise.resolve();
        });
        const read = vi.fn().mockRejectedValue(new TransientGitHubError('HTTP 502'));
        await expect(
            retryTransient(read, { sleep, now: () => time, timeoutMs: 40_000, intervalMs: 20_000 }),
        ).rejects.toBeInstanceOf(TransientGitHubError);
        expect(read).toHaveBeenCalledTimes(3);
    });
});

describe('createBranchCheck', () => {
    test('asks git which remote branches contain the commit', async () => {
        const git = vi.fn(() => Promise.resolve('  origin/master\n'));
        await expect(createBranchCheck(git)(SHA)).resolves.toBe(true);
        expect(git).toHaveBeenCalledWith(['branch', '--remotes', '--contains', SHA]);
    });

    test('is false when no branch contains it or git does not know it', async () => {
        await expect(createBranchCheck(() => Promise.resolve(''))(SHA)).resolves.toBe(false);
        await expect(
            createBranchCheck(() => Promise.reject(new Error('malformed object name')))(SHA),
        ).resolves.toBe(false);
    });
});

describe('main', () => {
    const outputFile = () => join(mkdtempSync(join(tmpdir(), 'e2e-sw-')), 'output');
    const env = overrides => ({
        GITHUB_OUTPUT: outputFile(),
        GITHUB_REPOSITORY: REPO,
        GITHUB_TOKEN: 'test-token',
        ...overrides,
    });
    const prEvent = (sha = SHA) => {
        const path = join(mkdtempSync(join(tmpdir(), 'e2e-sw-event-')), 'event.json');
        writeFileSync(path, JSON.stringify({ pull_request: { head: { sha } } }));
        return path;
    };

    test('reads the pull request head from the event payload, only on pull_request', async () => {
        await expect(
            readPrHeadSha({ EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: prEvent() }),
        ).resolves.toBe(SHA);
        await expect(readPrHeadSha({ EVENT_NAME: 'pull_request' })).rejects.toThrow(
            /GITHUB_EVENT_PATH/,
        );
        const readEvent = vi.fn();
        await expect(
            readPrHeadSha({ EVENT_NAME: 'workflow_dispatch', GITHUB_EVENT_PATH: 'x' }, readEvent),
        ).resolves.toBeUndefined();
        expect(readEvent).not.toHaveBeenCalled();
    });

    test('the workflow passes no pull request head expression to the resolver', () => {
        expect(readFileSync('.github/workflows/e2e-sw.yml', 'utf8')).not.toMatch(
            /PR_HEAD_SHA|pull_request\.head\.sha/,
        );
    });

    test('resolves the pull request head and its Preview through the GitHub API', async () => {
        const vars = env({ EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: prEvent() });
        await expect(main({ env: vars, fetchImpl: deploymentsApi() })).resolves.toEqual({
            sha: SHA,
            url: PREVIEW,
        });
        expect(readFileSync(vars.GITHUB_OUTPUT, 'utf8')).toBe(`revision=${SHA}\nurl=${PREVIEW}\n`);
    });

    test('a dispatch override is allowlisted, warned about and skips the deployment lookup', async () => {
        const vars = env({
            EVENT_NAME: 'workflow_dispatch',
            INPUT_TARGET: SHA,
            PREVIEW_URL: ` ${PREVIEW}/ `,
        });
        const fetchImpl = vi.fn();
        const log = vi.fn();
        await main({ env: vars, fetchImpl, git: () => Promise.resolve('origin/master'), log });
        expect(readFileSync(vars.GITHUB_OUTPUT, 'utf8')).toBe(`revision=${SHA}\nurl=${PREVIEW}\n`);
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(expect.stringMatching(/^::warning .*not checked against/));
    });

    test('refuses an override outside the allowlist', async () => {
        await expect(
            main({
                env: env({
                    EVENT_NAME: 'workflow_dispatch',
                    INPUT_TARGET: SHA,
                    PREVIEW_URL: 'https://app.chipin.one',
                }),
                git: () => Promise.resolve('origin/master'),
            }),
        ).rejects.toThrow(/not allowlisted/);
    });

    test('retries a transient error while reading a dispatched pull request', async () => {
        const vars = env({ EVENT_NAME: 'workflow_dispatch', INPUT_TARGET: '780' });
        let pullReads = 0;
        const api = deploymentsApi();
        const fetchImpl = vi.fn((url, init) => {
            if (url.endsWith('/pulls/780')) {
                pullReads += 1;
                return pullReads === 1
                    ? Promise.resolve({ ok: false, status: 502 })
                    : ok({ head: { sha: SHA, repo: { full_name: REPO } } });
            }
            return api(url, init);
        });
        const sleep = vi.fn(() => Promise.resolve());
        await expect(main({ env: vars, fetchImpl, sleep })).resolves.toEqual({
            sha: SHA,
            url: PREVIEW,
        });
        expect(pullReads).toBe(2);
        expect(sleep).toHaveBeenCalledTimes(1);
    });

    test('ignores PREVIEW_URL on pull_request', async () => {
        const vars = env({
            EVENT_NAME: 'pull_request',
            GITHUB_EVENT_PATH: prEvent(),
            PREVIEW_URL: 'https://app.chipin.one',
        });
        await expect(main({ env: vars, fetchImpl: deploymentsApi() })).resolves.toEqual({
            sha: SHA,
            url: PREVIEW,
        });
    });
});

describe('e2e-sw workflow', () => {
    const text = readFileSync('.github/workflows/e2e-sw.yml', 'utf8');
    const workflow = parse(text);
    const { resolve, 'e2e-sw': e2e } = workflow.jobs;
    const allSteps = [...resolve.steps, ...e2e.steps];
    const minutes = job => job.steps.reduce((sum, step) => sum + step['timeout-minutes'], 0);

    test('runs on pull requests into master for the service worker paths and by hand', () => {
        expect(Object.keys(workflow.on)).toEqual(['pull_request', 'workflow_dispatch']);
        expect(workflow.on.pull_request.branches).toEqual(['master']);
        expect(workflow.on.pull_request.paths).toEqual([
            'apps/app/src/app/pwa/**',
            'apps/app/pwa.config.ts',
            'apps/app/vercel.json',
            'apps/app/vite.config.ts',
            'apps/app/scripts/private-spa-navigation.ts',
            'apps/app/index.html',
            'apps/app/src/helpers/appUpdate.ts',
            'apps/app/src/shared/offline/network.ts',
            'apps/app/package.json',
            'package-lock.json',
            'apps/app/e2e/sw.spec.ts',
            'apps/app/playwright.sw.config.ts',
            'apps/app/e2e/support/config.ts',
            'scripts/e2e-sw-resolve-preview.mjs',
            'scripts/deployment-environments.mjs',
            '.github/workflows/e2e-sw.yml',
        ]);
        expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual([
            'target',
            'preview_url',
        ]);
    });

    test('has read-only permissions, the pull request and deployment reads only in resolve, and no secret', () => {
        expect(workflow.permissions).toEqual({});
        expect(resolve.permissions).toEqual({
            contents: 'read',
            deployments: 'read',
            'pull-requests': 'read',
        });
        expect(e2e.permissions).toEqual({ contents: 'read' });
        expect(text).not.toContain('secrets.');
        expect(text).not.toContain('pull_request_target');
    });

    test('runs the resolver from the workflow ref and the tests from the resolved commit', () => {
        const [trusted] = resolve.steps;
        expect(trusted.uses).toMatch(/^actions\/checkout@/);
        expect(trusted.with.ref).toBe('${{ github.sha }}');
        expect(trusted.with['fetch-depth']).toBe(0);
        // The sparse checkout writes the resolver and every local module it imports, nothing else; a
        // missing import fails the job with ERR_MODULE_NOT_FOUND (#801).
        const localImports = [
            ...readFileSync('scripts/e2e-sw-resolve-preview.mjs', 'utf8').matchAll(
                /from '\.\/([^']+)'/gu,
            ),
        ].map(([, file]) => `scripts/${file}`);
        expect(localImports).toEqual(['scripts/deployment-environments.mjs']);
        expect(trusted.with['sparse-checkout'].trim().split('\n')).toEqual([
            'scripts/e2e-sw-resolve-preview.mjs',
            ...localImports,
        ]);
        expect(workflow.on.pull_request.paths).toEqual(expect.arrayContaining(localImports));
        expect(
            readFileSync('scripts/deployment-environments.mjs', 'utf8').match(/^import /mu),
        ).toBeNull();
        expect(resolve.steps.map(step => step.run).filter(Boolean)).toEqual([
            'node scripts/e2e-sw-resolve-preview.mjs',
        ]);
        expect(e2e.needs).toBe('resolve');
        expect(e2e.steps[0].with.ref).toBe('${{ needs.resolve.outputs.revision }}');
        const verify = e2e.steps[1];
        expect(verify.name).toBe('Verify the checked-out commit');
        expect(verify.env.RESOLVED_SHA).toBe('${{ needs.resolve.outputs.revision }}');
        expect(verify.run).toContain('git rev-parse HEAD');
        const names = e2e.steps.map(step => step.name);
        expect(names.indexOf('Verify the checked-out commit')).toBeLessThan(
            names.indexOf('Install dependencies'),
        );
    });

    test('hands the token only to the resolver step', () => {
        const withToken = allSteps.filter(step => JSON.stringify(step).includes('github.token'));
        expect(withToken.map(step => step.name)).toEqual(['Resolve the commit and its Preview']);
    });

    test('pins every action by full SHA and caps every step inside its job', () => {
        for (const step of allSteps) {
            expect(step['timeout-minutes']).toBeGreaterThan(0);
            if (step.uses) {
                expect(step.uses).toMatch(/@[0-9a-f]{40}(?:$| )/);
            }
            if (step.uses?.startsWith('actions/checkout')) {
                expect(step.with['persist-credentials']).toBe(false);
            }
            if (step.uses?.startsWith('actions/setup-node')) {
                expect(step.with['package-manager-cache']).toBe(false);
            }
        }
        expect(minutes(resolve)).toBeLessThanOrEqual(resolve['timeout-minutes']);
        expect(minutes(e2e)).toBeLessThanOrEqual(e2e['timeout-minutes']);
    });

    test('never interpolates an expression into a run script', () => {
        expect(allSteps.map(step => step.run ?? '').join('\n')).not.toContain('${{');
    });
});
