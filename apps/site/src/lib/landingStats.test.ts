import { describe, expect, test, vi } from 'vitest';

import {
    formatLandingStats,
    formatSummary,
    loadLandingStats,
    parseLandingStats,
    STAT_FIELDS,
    STATS_URL,
} from './landingStats';

// Spec 04 §3.4, §4.1 (row 04-3b1): the landing statistics of the site home. The response shape is
// KB STAT-001/STAT-008; the number format is the app's `Amount type="summary"`.
const VALID = {
    expensesCount: 25_300_000,
    debtsTrackedUsd: 1_250_000.5,
    activeGroupsCount: 1800,
    peopleSharingCount: 42,
};

describe('parseLandingStats', () => {
    test('STAT-001 STAT-008 accepts the four metrics', () => {
        expect(parseLandingStats(VALID)).toEqual(VALID);
    });

    test('STAT-001 ignores fields it does not show', () => {
        expect(parseLandingStats({ ...VALID, extra: 'x' })).toEqual(VALID);
    });

    test.each([
        ['null', null],
        ['an array', [VALID]],
        ['a string', JSON.stringify(VALID)],
        ['a missing count', { ...VALID, activeGroupsCount: undefined }],
        ['a missing total', { ...VALID, debtsTrackedUsd: undefined }],
        ['a string count', { ...VALID, expensesCount: '25300000' }],
        ['a fractional count', { ...VALID, peopleSharingCount: 1.5 }],
        ['a negative count', { ...VALID, activeGroupsCount: -1 }],
        ['an unsafe integer', { ...VALID, expensesCount: 2 ** 53 }],
        ['a negative total', { ...VALID, debtsTrackedUsd: -0.5 }],
        ['a string total', { ...VALID, debtsTrackedUsd: '1250000.5000' }],
        ['the old response shape', { usersCount: 1, groupsCount: 2, expensesCount: 3 }],
    ])('STAT-008 rejects %s', (_, body) => {
        expect(parseLandingStats(body)).toBeNull();
    });
});

/** The part of the app's `getNumberData` (helpers/numbers.ts) the comparison uses. */
type NumberDataFormatter = (args: {
    value: number;
    precision?: number;
    isKMB: boolean;
    isExternal: boolean;
}) => { numberFormatted: string; isValueTooSmall: boolean };

const isNumberDataFormatter = (value: unknown): value is NumberDataFormatter =>
    typeof value === 'function';

describe('formatSummary (the app summary format)', () => {
    test.each([
        [0, '0'],
        [5, '5'],
        [12.5, '12.5'],
        [12.345, '12.35'],
        [999, '999'],
        [999.996, '1.00K'],
        [1000, '1.00K'],
        [1200, '1.20K'],
        [1234.4, '1.23K'],
        [1234.5, '1.24K'],
        [999_999, '1000.00K'],
        [1_250_000.5, '1.25M'],
        [25_300_000, '25.30M'],
        [3e9, '3.00B'],
        [4.5e12, '4.50T'],
        [2e15, '2.00Q'],
        [0.004, '< 0.01'],
    ])('%s → %s', (value, text) => {
        expect(formatSummary(value)).toBe(text);
    });

    // The app formatter itself, loaded at run time: helpers/numbers.ts relies on the app's global
    // types, so a static import would pull it into the site type check. 04-5a removes the app
    // landing and must rework this comparison with it.
    test('matches the app getNumberData for the landing values', async () => {
        const appModule: unknown = await import(
            /* @vite-ignore */ new URL('../../../app/src/helpers/numbers.ts', import.meta.url).href
        );
        const getNumberData =
            typeof appModule === 'object' && appModule !== null && 'getNumberData' in appModule
                ? appModule.getNumberData
                : undefined;

        expect(isNumberDataFormatter(getNumberData)).toBe(true);
        if (!isNumberDataFormatter(getNumberData)) {
            return;
        }
        const appSummary = (value: number, precision?: number): string => {
            const data = getNumberData({ value, precision, isKMB: true, isExternal: true });

            return `${data.isValueTooSmall ? '< ' : ''}${data.numberFormatted}`;
        };
        const values = [
            0, 0.004, 0.005, 0.5, 5, 12.5, 12.345, 99.999, 999, 999.994, 999.996, 1000, 1004.9,
            1005, 1234.5, 999_999, 1_250_000.5, 25_300_000, 123_456_789.1234, 3e9, 4.5e12, 2e15,
        ];

        for (const value of values) {
            expect([value, formatSummary(value)]).toEqual([value, appSummary(value)]);
            expect([value, formatSummary(value, 0)]).toEqual([value, appSummary(value, 0)]);
            expect([value, formatSummary(value, 2)]).toEqual([value, appSummary(value, 2)]);
        }
    });

    test('takes an explicit precision', () => {
        expect(formatSummary(227, 0)).toBe('227');
        expect(formatSummary(42.6, 0)).toBe('43');
        expect(formatSummary(0.3, 0)).toBe('< 1');
        expect(formatSummary(227, 2)).toBe('227');
    });

    test('formats each metric, the debts total in USD', () => {
        expect(formatLandingStats(VALID)).toEqual({
            expensesCount: '25.30M',
            debtsTrackedUsd: '1.25M USD',
            activeGroupsCount: '1.80K',
            peopleSharingCount: '42',
        });
    });
});

/** A block with one element per metric, as LandingStats.astro renders it. */
const fakeBlock = (fields: readonly string[] = STAT_FIELDS) => {
    const elements = new Map(fields.map(field => [field, { textContent: '' }]));

    return {
        hidden: true,
        elements,
        querySelector: (selector: string) => {
            const field = /^\[data-stat="(\w+)"\]$/.exec(selector)?.[1];

            return field === undefined ? null : (elements.get(field) ?? null);
        },
    };
};

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

describe('loadLandingStats', () => {
    test('fills in the numbers and shows the block', async () => {
        const block = fakeBlock();
        const fetchStats = vi.fn(() => Promise.resolve(jsonResponse(VALID)));

        await expect(loadLandingStats(block, fetchStats)).resolves.toBe(true);
        expect(block.hidden).toBe(false);
        expect(Object.fromEntries([...block.elements].map(([k, v]) => [k, v.textContent]))).toEqual(
            formatLandingStats(VALID),
        );
    });

    test('asks the same-origin proxy without credentials', async () => {
        const fetchStats = vi.fn(() => Promise.resolve(jsonResponse(VALID)));

        await loadLandingStats(fakeBlock(), fetchStats);
        expect(STATS_URL).toBe('/api/stats');
        expect(fetchStats).toHaveBeenCalledWith('/api/stats', {
            credentials: 'omit',
            headers: { Accept: 'application/json' },
        });
    });

    test.each([
        ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
        ['a 503', () => Promise.resolve(jsonResponse({ code: 'SYSTEM.SERVICE_UNAVAILABLE' }, 503))],
        ['a 404', () => Promise.resolve(new Response('Not found', { status: 404 }))],
        ['a body that is not JSON', () => Promise.resolve(new Response('<html>', { status: 200 }))],
        ['an invalid shape', () => Promise.resolve(jsonResponse({ ...VALID, expensesCount: -1 }))],
    ])('keeps the block hidden on %s', async (_, fetchStats) => {
        const block = fakeBlock();

        await expect(loadLandingStats(block, fetchStats)).resolves.toBe(false);
        expect(block.hidden).toBe(true);
        expect([...block.elements.values()].every(({ textContent }) => textContent === '')).toBe(
            true,
        );
    });

    test('keeps the block hidden when a metric has no element', async () => {
        const block = fakeBlock(STAT_FIELDS.slice(1));

        await expect(
            loadLandingStats(block, () => Promise.resolve(jsonResponse(VALID))),
        ).resolves.toBe(false);
        expect(block.hidden).toBe(true);
    });
});
