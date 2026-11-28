import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, test, vi } from 'vitest';

import {
    escapeCommand,
    evaluate,
    hasDesignLink,
    isUiFile,
    parseTaskIdentity,
    run,
    uiFiles,
} from './design-gate.mjs';

const IDENTITY = { owner: 'ChipIn-one', repo: 'chipin-frontend', number: 42 };
const GATE_SINCE = '2026-11-28T10:00:00Z';
const UI_FILE = { filename: 'apps/app/src/pages/home/Home.tsx', status: 'modified' };
const DOC_FILE = { filename: 'docs/design-system/process.md', status: 'modified' };
const DESIGN = 'Design: https://claude.ai/artifact/abc123';
const approvedIssue = { labels: [{ name: 'design-approved' }], body: `Goal\n\n${DESIGN}\n` };
const input = (overrides = {}) => ({
    repository: 'ChipIn-one/chipin-frontend',
    prLabels: [],
    prCreatedAt: '2026-11-29T10:00:00Z',
    gateSince: GATE_SINCE,
    files: [UI_FILE],
    identity: IDENTITY,
    issue: approvedIssue,
    ...overrides,
});

describe('escapeCommand', () => {
    test('a file name with a newline cannot start another workflow command', () => {
        expect(escapeCommand('x\n::notice::fake.module.css 100%\r')).toBe(
            'x%0A::notice::fake.module.css 100%25%0D',
        );
    });
});

describe('isUiFile', () => {
    test.each([
        'apps/app/src/pages/home/Home.tsx',
        'apps/app/src/basics/numbers/amount/Amount.module.css',
        'apps/site/src/components/Hero.module.css',
        'apps/site/src/pages/index.astro',
        'apps/site/src/i18n/locales/en/common.json',
        'apps/app/src/i18n/locales/ru/common.json',
        'apps/app/src/index.css',
        'apps/app/src/features/landing/cta-section/styled.ts',
        'apps/site/src/components/hero/styled.tsx',
        'packages/ui/Button.module.css',
        'packages/i18n-content/common/en.json',
    ])('%s is UI', path => expect(isUiFile(path)).toBe(true));

    test.each([
        'apps/app/src/pages/home/Home.test.tsx',
        'apps/app/src/pages/home/Home.spec.tsx',
        'apps/app/src/pages/home/Home.stories.tsx',
        'apps/app/src/pages/home/__tests__/Home.tsx',
        'apps/app/src/test/renderWithProviders.tsx',
        'apps/site/src/components/Hero.test.ts',
        'apps/app/src/helpers/numbers.ts',
        'apps/app/e2e/specs/money/flow.tsx',
        'packages/tokens/tokens.css',
        'packages/i18n-content/src/locales.ts',
        'apps/app/src/test/styles.css',
        'apps/app/src/pages/home/Home.module.test.css',
        'docs/design-system/process.md',
        '',
        undefined,
    ])('%s is not UI', path => expect(isUiFile(path)).toBe(false));

    test('a rename counts when either side is UI, and a removed file counts', () => {
        expect(
            uiFiles([
                {
                    filename: 'apps/app/src/helpers/old.ts',
                    previous_filename: 'apps/app/src/pages/Old.tsx',
                    status: 'renamed',
                },
                { filename: 'apps/app/src/pages/Gone.module.css', status: 'removed' },
                DOC_FILE,
            ]),
        ).toEqual(['apps/app/src/pages/Old.tsx', 'apps/app/src/pages/Gone.module.css']);
    });
});

describe('parseTaskIdentity', () => {
    test('reads the create-pr.mjs line', () => {
        expect(
            parseTaskIdentity('Task identity: ChipIn-one/chipin-frontend#42\n\n## Summary'),
        ).toEqual(IDENTITY);
    });

    test('accepts the same line twice and CRLF bodies', () => {
        expect(
            parseTaskIdentity(
                'Task identity: ChipIn-one/chipin-frontend#42\r\ntext\r\nTask identity: ChipIn-one/chipin-frontend#42\r\n',
            ),
        ).toEqual(IDENTITY);
    });

    test.each([
        ['missing', '## Summary\nnothing'],
        ['empty body', null],
        [
            'conflicting',
            'Task identity: ChipIn-one/chipin-frontend#42\nTask identity: ChipIn-one/chipin-frontend#43',
        ],
        ['malformed', 'Task identity: chipin-frontend#42'],
        ['zero', 'Task identity: ChipIn-one/chipin-frontend#0'],
        ['not at line start', 'See Task identity: ChipIn-one/chipin-frontend#42'],
        ['value on the next line', 'Task identity:\nChipIn-one/chipin-frontend#42'],
    ])('%s → null', (_, body) => expect(parseTaskIdentity(body)).toBeNull());
});

describe('hasDesignLink', () => {
    test.each([
        DESIGN,
        'Design: <https://claude.ai/artifact/abc123>',
        'Design: [ChipIn home](https://claude.ai/artifact/abc123)',
        `Goal\r\n${DESIGN}\r\nMore`,
    ])('%s has a link', body => expect(hasDesignLink(body)).toBe(true));

    test.each([
        'Design: http://claude.ai/artifact/abc123',
        'Design: pending',
        'Design:',
        'The Design: https://claude.ai/artifact/abc123',
        'design: https://claude.ai/artifact/abc123',
        null,
    ])('%s has no link', body => expect(hasDesignLink(body)).toBe(false));
});

describe('evaluate', () => {
    test('a UI change whose Issue lacks design-approved fails and says what to do', () => {
        const result = evaluate(input({ issue: { labels: [], body: DESIGN } }));
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('`design-approved`');
        expect(result.reason).toContain('ChipIn-one/chipin-frontend#42');
        expect(result.reason).toContain('no-design-needed');
        expect(result.reason).toContain('re-run this check or push');
    });

    test('design-approved without a Design line fails', () => {
        const result = evaluate(input({ issue: { labels: ['design-approved'], body: 'Goal' } }));
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('no `Design: <https link>` line');
    });

    test('design-approved with a Design line passes', () => {
        expect(evaluate(input()).ok).toBe(true);
    });

    test('the owner label no-design-needed passes without an Issue', () => {
        expect(
            evaluate(
                input({ prLabels: [{ name: 'no-design-needed' }], identity: null, issue: null }),
            ).ok,
        ).toBe(true);
    });

    test('a PR without UI files passes', () => {
        expect(evaluate(input({ files: [DOC_FILE], identity: null, issue: null })).ok).toBe(true);
    });

    test('a PR opened before the gate landed passes', () => {
        const result = evaluate(
            input({ prCreatedAt: '2026-11-27T10:00:00Z', identity: null, issue: null }),
        );
        expect(result).toEqual({ ok: true, reason: expect.stringContaining('exempt') });
    });

    test('no gate on master yet passes', () => {
        expect(evaluate(input({ gateSince: null, identity: null, issue: null })).ok).toBe(true);
    });

    test('a Task identity of another repository fails (case-insensitive match passes)', () => {
        const foreign = evaluate(input({ identity: { ...IDENTITY, repo: 'chipin-backend' } }));
        expect(foreign.ok).toBe(false);
        expect(foreign.reason).toContain('not an Issue of ChipIn-one/chipin-frontend');
        expect(evaluate(input({ repository: 'chipin-one/CHIPIN-frontend' })).ok).toBe(true);
    });

    test('a Task identity that is a pull request fails', () => {
        const result = evaluate(input({ issue: { ...approvedIssue, pull_request: { url: 'x' } } }));
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('is a pull request');
    });

    test('asks for the Issue only when the decision depends on it', () => {
        expect(evaluate(input({ issue: undefined }))).toMatchObject({ needsIssue: true });
        expect(evaluate(input({ issue: undefined, gateSince: null })).needsIssue).toBeUndefined();
    });

    test('a UI change without a Task identity fails', () => {
        const result = evaluate(input({ identity: null, issue: null }));
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('Task identity');
    });
});

const API = 'https://api.github.com';
const REPO = 'ChipIn-one/chipin-frontend';
const ok = body => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fakeFetch = routes =>
    vi.fn(url => {
        const key = url.slice(API.length);
        if (!(key in routes)) return Promise.resolve({ ok: false, status: 404 });
        return ok(routes[key]);
    });
const prRoute = `/repos/${REPO}/pulls/7`;
const filesRoute = page => `/repos/${REPO}/pulls/7/files?per_page=100&page=${page}`;
const commitsRoute = page =>
    `/repos/${REPO}/commits?sha=master&path=scripts%2Fdesign-gate.mjs&per_page=100&page=${page}`;
const issueRoute = `/repos/${REPO}/issues/42`;
const gateCommits = [
    { commit: { committer: { date: '2026-11-30T10:00:00Z' } } },
    { commit: { committer: { date: GATE_SINCE } } },
];
const pr = (overrides = {}) => ({
    body: 'Task identity: ChipIn-one/chipin-frontend#42\n\n## Summary',
    labels: [],
    created_at: '2026-11-29T10:00:00Z',
    ...overrides,
});
const env = extra => ({
    GITHUB_REPOSITORY: REPO,
    PR_NUMBER: '7',
    GITHUB_TOKEN: 'test-token',
    ...extra,
});

describe('run', () => {
    test('fails a UI PR whose Issue has no approved design, and writes the step summary', async () => {
        const summary = join(mkdtempSync(join(tmpdir(), 'design-gate-')), 'summary.md');
        const fetch = fakeFetch({
            [prRoute]: pr(),
            [filesRoute(1)]: [UI_FILE],
            [commitsRoute(1)]: gateCommits,
            [issueRoute]: { labels: [], body: 'Goal' },
        });
        const log = vi.fn();
        await expect(run({ env: env({ GITHUB_STEP_SUMMARY: summary }), fetch, log })).resolves.toBe(
            1,
        );
        expect(log).toHaveBeenCalledWith(expect.stringMatching(/^::error::.*design-approved/u));
        expect(readFileSync(summary, 'utf8')).toMatch(/^## Design gate: failed\n/u);
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
    });

    test('passes a no-design-needed PR without reading the Issue', async () => {
        const fetch = fakeFetch({
            [prRoute]: pr({ labels: [{ name: 'no-design-needed' }] }),
            [filesRoute(1)]: [UI_FILE],
            [commitsRoute(1)]: gateCommits,
        });
        await expect(run({ env: env(), fetch, log: vi.fn() })).resolves.toBe(0);
        expect(fetch.mock.calls.map(([url]) => url)).not.toContain(`${API}${issueRoute}`);
    });

    test('reads every page of PR files', async () => {
        const docs = Array.from({ length: 100 }, (_, index) => ({ filename: `docs/${index}.md` }));
        const fetch = fakeFetch({
            [prRoute]: pr(),
            [filesRoute(1)]: docs,
            [filesRoute(2)]: [UI_FILE],
            [commitsRoute(1)]: gateCommits,
            [issueRoute]: { labels: [], body: DESIGN },
        });
        await expect(run({ env: env(), fetch, log: vi.fn() })).resolves.toBe(1);
        expect(fetch.mock.calls.map(([url]) => url)).toContain(`${API}${filesRoute(2)}`);
    });

    test('a PR opened before the gate passes without reading the Issue', async () => {
        const fetch = fakeFetch({
            [prRoute]: pr({ created_at: '2026-11-27T10:00:00Z' }),
            [filesRoute(1)]: [UI_FILE],
            [commitsRoute(1)]: gateCommits,
        });
        await expect(run({ env: env(), fetch, log: vi.fn() })).resolves.toBe(0);
        expect(fetch.mock.calls.map(([url]) => url)).not.toContain(`${API}${issueRoute}`);
    });

    test('no gate commits on master passes', async () => {
        const fetch = fakeFetch({
            [prRoute]: pr(),
            [filesRoute(1)]: [UI_FILE],
            [commitsRoute(1)]: [],
        });
        await expect(run({ env: env(), fetch, log: vi.fn() })).resolves.toBe(0);
    });

    test('a foreign Task identity fails without reading the Issue', async () => {
        const fetch = fakeFetch({
            [prRoute]: pr({ body: 'Task identity: ChipIn-one/chipin-backend#42' }),
            [filesRoute(1)]: [UI_FILE],
            [commitsRoute(1)]: gateCommits,
        });
        const log = vi.fn();
        await expect(run({ env: env(), fetch, log })).resolves.toBe(1);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('not an Issue of'));
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    test('passes a UI PR whose Issue has an approved design', async () => {
        const fetch = fakeFetch({
            [prRoute]: pr(),
            [filesRoute(1)]: [UI_FILE],
            [commitsRoute(1)]: gateCommits,
            [issueRoute]: approvedIssue,
        });
        await expect(run({ env: env(), fetch, log: vi.fn() })).resolves.toBe(0);
    });

    test('a 30th full page of files fails closed', async () => {
        const page = Array.from({ length: 100 }, (_, index) => ({ filename: `docs/${index}.md` }));
        const fetch = vi.fn(url =>
            url.includes('/files?') ? ok(page) : ok(url.endsWith('/pulls/7') ? pr() : []),
        );
        await expect(run({ env: env(), fetch, log: vi.fn() })).rejects.toThrow(
            /more than 30 pages/u,
        );
    });

    test('a GitHub API error throws (fail closed)', async () => {
        const fetch = fakeFetch({ [prRoute]: pr() });
        await expect(run({ env: env(), fetch, log: vi.fn() })).rejects.toThrow(/HTTP 404/u);
    });
});

describe('design-gate workflow', () => {
    const text = readFileSync('.github/workflows/design-gate.yml', 'utf8');
    const workflow = parse(text);
    const ci = parse(readFileSync('.github/workflows/frontend-ci.yml', 'utf8'));
    const job = workflow.jobs['design-gate'];
    const ciUses = Object.values(ci.jobs)
        .flatMap(item => item.steps ?? [])
        .map(step => step.uses)
        .filter(Boolean);

    test('runs on pull_request_target to master with read-only permissions and no secrets', () => {
        expect(Object.keys(workflow.on)).toEqual(['pull_request_target']);
        expect(workflow.on.pull_request_target.branches).toEqual(['master']);
        expect(workflow.on.pull_request_target.types).toEqual(
            expect.arrayContaining(['opened', 'edited', 'synchronize', 'labeled', 'unlabeled']),
        );
        expect(workflow.permissions).toEqual({
            contents: 'read',
            'pull-requests': 'read',
            issues: 'read',
        });
        expect(job.name).toBe('design-gate');
        expect(job.if).toBe("github.event.pull_request.user.login != 'dependabot[bot]'");
        expect(text).not.toContain('secrets.');
        expect(text).not.toMatch(/github\.event\.pull_request\.head\./u);
    });

    test('runs master code with the same pinned actions as frontend-ci', () => {
        const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'));
        expect(checkout.with).toEqual({
            ref: '${{ github.event.pull_request.base.ref }}',
            'persist-credentials': false,
        });
        for (const step of job.steps.filter(item => item.uses)) expect(ciUses).toContain(step.uses);
        const runStep = job.steps.find(step => step.run);
        expect(runStep.run).toContain('node scripts/design-gate.mjs');
        expect(runStep.env.GITHUB_TOKEN).toBe('${{ github.token }}');
    });
});
