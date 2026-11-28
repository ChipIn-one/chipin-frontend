import { describe, expect, it } from 'vitest';

import { parseScreenManifest, type ScreenManifest } from '../../src/test/screenManifest';
import { STAGING_API_ORIGIN } from '../support/config';

import {
    buildCaptureIndex,
    CAPTURE_SITE_ORIGIN,
    captureFileName,
    computeRecipeCoverage,
    fixedTimeText,
    isMockableApiRequest,
    isPastCaptureDeadline,
    mockMatchesMethod,
    parseCaptureAttachment,
    parseCaptureDeadline,
    parseCaptureFixture,
    recipeCoverageProblems,
    resolveCapturePath,
    type RowCaptureResult,
    rowTimeoutMs,
    sanitizeReason,
    siteJoinRewrite,
} from './captureModel';

const APP_ORIGIN = 'http://localhost:5173';
const INVITE_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const GROUP_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const manifest: ScreenManifest = parseScreenManifest({
    version: 1,
    themes: ['light', 'dark'],
    widths: [390, 1440],
    scenarios: [
        { id: 'new-user', description: 'One user', provisioning: ["A = register('E2E A')"] },
    ],
    screens: [
        {
            id: 'login',
            app: 'app',
            routeId: 'login',
            path: '/login',
            kind: 'screen',
            auth: 'anonymous',
            setup: { fixture: 'page' },
        },
        {
            id: 'login.narrow',
            app: 'app',
            routeId: 'login',
            path: '/login',
            kind: 'state',
            parent: 'login',
            auth: 'anonymous',
            widths: [390],
            setup: { fixture: 'page' },
        },
        {
            id: 'dashboard',
            app: 'app',
            routeId: 'dashboard',
            path: '/dashboard',
            kind: 'screen',
            auth: 'signed-in',
            setup: { scenario: 'new-user', fixture: 'signIn(A)' },
        },
        {
            id: 'dashboard.offline-no-data',
            app: 'app',
            routeId: 'dashboard',
            path: '/dashboard',
            kind: 'state',
            parent: 'dashboard',
            auth: 'signed-in',
            capture: 'manual',
            setup: { scenario: 'new-user', fixture: 'signIn(A)', offline: true },
            notes: 'Needs the service worker build',
        },
    ],
    excluded: [],
    flows: [{ id: 'sign-in', title: 'Sign in', steps: ['login', 'dashboard', 'login'] }],
});

const allVariants = (id: string) => [
    {
        theme: 'light' as const,
        width: 390 as const,
        file: captureFileName(id, { theme: 'light', width: 390 }),
    },
    {
        theme: 'light' as const,
        width: 1440 as const,
        file: captureFileName(id, { theme: 'light', width: 1440 }),
    },
    {
        theme: 'dark' as const,
        width: 390 as const,
        file: captureFileName(id, { theme: 'dark', width: 390 }),
    },
    {
        theme: 'dark' as const,
        width: 1440 as const,
        file: captureFileName(id, { theme: 'dark', width: 1440 }),
    },
];

const indexOf = (results: Map<string, RowCaptureResult>, recipeIds: string[]) =>
    buildCaptureIndex({
        manifest,
        results,
        recipeIds,
        commit: 'a'.repeat(40),
        ref: 'refs/heads/master',
        runId: '123',
        generatedAt: '2026-11-28T00:00:00.000Z',
        playwrightVersion: '1.65.1',
    });

describe('captureFileName', () => {
    it('names the PNG by id, theme and width under png/', () => {
        expect(captureFileName('modal.add-expense.group', { theme: 'dark', width: 390 })).toBe(
            'png/modal.add-expense.group__dark__390.png',
        );
    });
});

describe('computeRecipeCoverage', () => {
    it('accepts a registry with exactly the non-manual rows', () => {
        const coverage = computeRecipeCoverage(manifest, ['login', 'login.narrow', 'dashboard']);

        expect(recipeCoverageProblems(coverage)).toEqual([]);
    });

    it('names rows without a recipe, unknown recipes and recipes of manual rows', () => {
        const coverage = computeRecipeCoverage(manifest, [
            'login',
            'login.renamed',
            'dashboard.offline-no-data',
        ]);

        expect(coverage).toEqual({
            withoutRecipe: ['login.narrow', 'dashboard'],
            unknownRecipes: ['login.renamed'],
            manualWithRecipe: ['dashboard.offline-no-data'],
        });
        expect(recipeCoverageProblems(coverage)).toEqual([
            'login.narrow: no capture recipe for this manifest row',
            'dashboard: no capture recipe for this manifest row',
            'login.renamed: a recipe for an id that is not a manifest row',
            'dashboard.offline-no-data: a recipe for a row marked capture: manual',
        ]);
    });
});

describe('parseCaptureFixture', () => {
    it('reads the anonymous page, a scenario user and a custom user agent', () => {
        expect(parseCaptureFixture({ fixture: 'page' })).toEqual({ kind: 'anonymous' });
        expect(parseCaptureFixture({ fixture: 'signIn(B)' })).toEqual({
            kind: 'signed-in',
            user: 'B',
        });
        expect(
            parseCaptureFixture({
                fixture: 'browser.newContext({ userAgent })',
                userAgent: 'Instagram',
            }),
        ).toEqual({ kind: 'user-agent', userAgent: 'Instagram' });
    });

    it('rejects an unknown fixture and a user agent fixture without a user agent', () => {
        expect(() => parseCaptureFixture({ fixture: 'signIn(D)' })).toThrow(
            "unknown capture fixture 'signIn(D)'",
        );
        expect(() => parseCaptureFixture({})).toThrow("unknown capture fixture ''");
        expect(() => parseCaptureFixture({ fixture: 'browser.newContext({ userAgent })' })).toThrow(
            'needs setup.userAgent',
        );
    });
});

describe('resolveCapturePath', () => {
    it('fills every param and keeps the query', () => {
        expect(resolveCapturePath('/group/:groupId?tab=1', { groupId: GROUP_ID })).toBe(
            `/group/${GROUP_ID}?tab=1`,
        );
        expect(resolveCapturePath('/login?returnTo=%2Fsettings', {})).toBe(
            '/login?returnTo=%2Fsettings',
        );
    });

    it('encodes a value and fails on a missing one', () => {
        expect(resolveCapturePath('/group/join/:inviteToken', { inviteToken: 'a/b' })).toBe(
            '/group/join/a%2Fb',
        );
        expect(() => resolveCapturePath('/activity/:parentActivityId', {})).toThrow(
            'needs :parentActivityId',
        );
    });
});

describe('isMockableApiRequest', () => {
    it('allows the app proxy and the staging API only', () => {
        expect(isMockableApiRequest(`${APP_ORIGIN}/api/groups?limit=20`, APP_ORIGIN)).toBe(true);
        expect(isMockableApiRequest(`${STAGING_API_ORIGIN}/groups/1`, APP_ORIGIN)).toBe(true);
    });

    it('never answers source modules, pages or other hosts', () => {
        expect(
            isMockableApiRequest(`${APP_ORIGIN}/src/entities/groups/api/queries.ts`, APP_ORIGIN),
        ).toBe(false);
        expect(isMockableApiRequest(`${APP_ORIGIN}/group/${GROUP_ID}`, APP_ORIGIN)).toBe(false);
        expect(isMockableApiRequest(`${APP_ORIGIN}/apix/groups`, APP_ORIGIN)).toBe(false);
        expect(isMockableApiRequest('https://example.com/api/groups', APP_ORIGIN)).toBe(false);
        expect(isMockableApiRequest('not a url', APP_ORIGIN)).toBe(false);
    });
});

describe('mockMatchesMethod', () => {
    it('matches the method or any method', () => {
        const get = { method: 'GET', url: '**/x', action: 'hang' } as const;
        const any = { method: 'ANY', url: '**/x', action: 'hang' } as const;

        expect(mockMatchesMethod(get, 'get')).toBe(true);
        expect(mockMatchesMethod(get, 'POST')).toBe(false);
        expect(mockMatchesMethod(any, 'DELETE')).toBe(true);
    });
});

describe('sanitizeReason', () => {
    it('replaces the row values, UUIDs, run ids and invite tokens', () => {
        const message =
            `\u001b[31mTimeout\u001b[39m waiting for /group/join/${INVITE_TOKEN} in group ${GROUP_ID} ` +
            `of run fe-e2e-1764288000000-0123456789ab, page /join/group/x`;

        expect(sanitizeReason(message, [INVITE_TOKEN])).toBe(
            'Timeout waiting for /group/join/{token} in group {id} of run {run}, page /join/group/{token}',
        );
        expect(sanitizeReason(`see /join/${INVITE_TOKEN}`)).toBe('see /join/{token}');
        expect(sanitizeReason('the page /join/friend loaded')).toBe('the page /join/friend loaded');
    });

    it('keeps the first lines, each cut to 300 characters', () => {
        const message = `\n\nfirst\n  second\n${'x'.repeat(400)}\nfourth`;

        expect(sanitizeReason(message)).toBe('first');
        const three = sanitizeReason(message, [], 3).split('\n');
        expect(three).toHaveLength(3);
        expect(three[1]).toBe('  second');
        expect(three[2]).toHaveLength(300);
        expect(sanitizeReason('   ')).toBe('unknown error');
    });
});

describe('parseCaptureAttachment', () => {
    it('reads a capture and rejects anything else', () => {
        expect(
            parseCaptureAttachment('{"theme":"dark","width":390,"file":"png/a__dark__390.png"}'),
        ).toEqual({
            theme: 'dark',
            width: 390,
            file: 'png/a__dark__390.png',
        });
        expect(parseCaptureAttachment('{"theme":"dim","width":390,"file":"x"}')).toBeNull();
        expect(parseCaptureAttachment('{"theme":"dark","width":800,"file":"x"}')).toBeNull();
        expect(parseCaptureAttachment('not json')).toBeNull();
    });
});

describe('siteJoinRewrite', () => {
    it('serves /join/<kind>/<token> from the page of its kind', () => {
        expect(siteJoinRewrite(`${CAPTURE_SITE_ORIGIN}/join/friend/e2eFakeInviteToken0001`)).toBe(
            `${CAPTURE_SITE_ORIGIN}/join/friend`,
        );
        expect(siteJoinRewrite(`${CAPTURE_SITE_ORIGIN}/join/group/x/`)).toBe(
            `${CAPTURE_SITE_ORIGIN}/join/group`,
        );
    });

    it('leaves other pages, kinds and hosts alone', () => {
        expect(siteJoinRewrite(`${CAPTURE_SITE_ORIGIN}/join/friend`)).toBeNull();
        expect(siteJoinRewrite(`${CAPTURE_SITE_ORIGIN}/join/team/x`)).toBeNull();
        expect(siteJoinRewrite(`${CAPTURE_SITE_ORIGIN}/join/group/x/y`)).toBeNull();
        expect(siteJoinRewrite(`${APP_ORIGIN}/join/group/x`)).toBeNull();
    });
});

describe('buildCaptureIndex', () => {
    it('lists flows in order, ungrouped and manual rows, with every capture', () => {
        const results = new Map<string, RowCaptureResult>([
            ['login', { captures: allVariants('login'), error: null }],
            [
                'login.narrow',
                {
                    captures: allVariants('login.narrow').filter(capture => capture.width === 390),
                    error: null,
                },
            ],
            ['dashboard', { captures: allVariants('dashboard'), error: null }],
        ]);
        const index = indexOf(results, ['login', 'login.narrow', 'dashboard']);

        expect(index).toMatchObject({
            schemaVersion: 1,
            commit: 'a'.repeat(40),
            ref: 'refs/heads/master',
            runId: '123',
            manifestVersion: 1,
            playwrightVersion: '1.65.1',
            missing: [],
            manual: [{ id: 'dashboard.offline-no-data', note: 'Needs the service worker build' }],
        });
        expect(index.flows).toHaveLength(1);
        expect(index.flows[0]?.screens.map(screen => screen.id)).toEqual([
            'login',
            'dashboard',
            'login',
        ]);
        expect(index.flows[0]?.screens[0]).toEqual({
            id: 'login',
            app: 'app',
            kind: 'screen',
            parent: null,
            path: '/login',
            capture: 'auto',
            // In the manifest's variant order: themes, then widths.
            captures: [
                { theme: 'light', width: 390, file: 'png/login__light__390.png' },
                { theme: 'light', width: 1440, file: 'png/login__light__1440.png' },
                { theme: 'dark', width: 390, file: 'png/login__dark__390.png' },
                { theme: 'dark', width: 1440, file: 'png/login__dark__1440.png' },
            ],
        });
        expect(index.ungrouped.map(screen => [screen.id, screen.captures.length])).toEqual([
            ['login.narrow', 2],
            ['dashboard.offline-no-data', 0],
        ]);
    });

    it('names every missing variant with its reason', () => {
        const results = new Map<string, RowCaptureResult>([
            [
                'login',
                {
                    captures: allVariants('login').slice(0, 2),
                    error: `Timeout in group ${GROUP_ID}\ncall log`,
                },
            ],
            // A capture of a variant the row does not have is ignored.
            ['login.narrow', { captures: allVariants('login.narrow'), error: null }],
        ]);
        const index = indexOf(results, ['login', 'login.narrow', 'ghost']);

        expect(index.missing).toEqual([
            {
                id: 'login',
                variant: { theme: 'dark', width: 390 },
                reason: 'Timeout in group {id}',
            },
            {
                id: 'login',
                variant: { theme: 'dark', width: 1440 },
                reason: 'Timeout in group {id}',
            },
            ...['light', 'dark'].flatMap(theme =>
                [390, 1440].map(width => ({
                    id: 'dashboard',
                    variant: { theme, width },
                    reason: 'no capture recipe for this manifest row',
                })),
            ),
            {
                id: 'ghost',
                variant: null,
                reason: 'a recipe for an id that is not a manifest row',
            },
        ]);
        expect(index.ungrouped[0]?.captures).toHaveLength(2);
    });

    it('reports a row with a recipe that did not run', () => {
        const index = indexOf(new Map(), ['login', 'login.narrow', 'dashboard']);

        expect(index.missing.filter(entry => entry.id === 'login.narrow')).toEqual([
            {
                id: 'login.narrow',
                variant: { theme: 'light', width: 390 },
                reason: 'the row was not run: the run ended first (global timeout, a cancel or a crash)',
            },
            {
                id: 'login.narrow',
                variant: { theme: 'dark', width: 390 },
                reason: 'the row was not run: the run ended first (global timeout, a cancel or a crash)',
            },
        ]);
        expect(index.missing).toHaveLength(10);
    });
});

describe('fixedTimeText', () => {
    it('fixes relative times, dates and clock times', () => {
        expect(fixedTimeText('now')).toBe('5 minutes ago');
        expect(fixedTimeText(' 3 minutes ago ')).toBe('5 minutes ago');
        expect(fixedTimeText('in 1 hour')).toBe('5 minutes ago');
        expect(fixedTimeText('28 November, 08:30 PM')).toBe('1 January, 12:00 PM');
        expect(fixedTimeText('November 28, 2026')).toBe('1 January, 12:00 PM');
        expect(fixedTimeText('28 November 2026 at 20:30')).toBe('1 January, 12:00 PM');
        expect(fixedTimeText('20:30')).toBe('12:00 PM');
        expect(fixedTimeText('8:05 AM')).toBe('12:00 PM');
    });

    it('leaves other texts, and the stable day dividers, alone', () => {
        expect(fixedTimeText('Today')).toBeNull();
        expect(fixedTimeText('Yesterday')).toBeNull();
        expect(fixedTimeText('E2E dinner')).toBeNull();
        expect(fixedTimeText('30 USD')).toBeNull();
        expect(fixedTimeText('Paid 28 November for dinner')).toBeNull();
    });
});

describe('the capture time budget', () => {
    it('reads a deadline and rejects anything else', () => {
        expect(parseCaptureDeadline(' 1764288000000 ')).toBe(1764288000000);
        expect(parseCaptureDeadline(undefined)).toBeNull();
        expect(parseCaptureDeadline('')).toBeNull();
        expect(parseCaptureDeadline('0')).toBeNull();
        expect(parseCaptureDeadline('-5')).toBeNull();
        expect(parseCaptureDeadline('soon')).toBeNull();
    });

    it('is past only at or after a set deadline', () => {
        expect(isPastCaptureDeadline(1000, 999)).toBe(false);
        expect(isPastCaptureDeadline(1000, 1000)).toBe(true);
        expect(isPastCaptureDeadline(null, Number.MAX_SAFE_INTEGER)).toBe(false);
    });

    it('scales the row timeout with its variants, under the backstop', () => {
        expect(rowTimeoutMs(4)).toBe(290_000);
        expect(rowTimeoutMs(2)).toBe(190_000);
        expect(rowTimeoutMs(0)).toBe(140_000);
        // 27-minute budget plus the longest row stays under the 35-minute globalTimeout.
        expect(27 * 60_000 + rowTimeoutMs(4)).toBeLessThan(35 * 60_000);
    });
});
