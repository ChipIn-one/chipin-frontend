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
// KB STAT-001/STAT-008; the number format is the one of the app's `Amount type="summary"`.
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

    // Rounding edges in the default, 0 and 2 decimals. The values were taken from the app's
    // `getNumberData` (helpers/numbers.ts) before 04-5b removed the app landing; the site keeps them.
    test.each([
        [0.005, ['< 0.01', '< 1', '< 0.01']],
        [0.5, ['0.5', '< 1', '0.5']],
        [99.999, ['100', '100', '100']],
        [999.994, ['999.99', '1.00K', '999.99']],
        [1004.9, ['1.01K', '1.01K', '1.00K']],
        [1005, ['1.01K', '1.01K', '1.01K']],
        [123_456_789.1234, ['123.46M', '123.46M', '123.46M']],
    ] as const)('%s keeps the summary rounding at each precision', (value, [auto, zero, two]) => {
        expect([formatSummary(value), formatSummary(value, 0), formatSummary(value, 2)]).toEqual([
            auto,
            zero,
            two,
        ]);
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
