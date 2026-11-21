// The landing statistics block of the site home (spec 04 §3.4, §4.1; KB STAT-001, STAT-008): a
// progressive enhancement. The page renders the block hidden; the hero `<script>` fetches
// `/api/stats` (vercel.json rewrites it to the backend `GET /stats`), checks the response shape by
// hand and only then fills in the numbers and shows the block. Any failure leaves it hidden.

/** `GET /stats` (KB STAT-001): three integer counts and the USD total of debts tracked. */
interface LandingStats {
    expensesCount: number;
    debtsTrackedUsd: number;
    activeGroupsCount: number;
    peopleSharingCount: number;
}

type StatField = keyof LandingStats;

/** The four metrics in the approved order of the app landing (chipin-backend#180). */
const STAT_FIELDS = [
    'expensesCount',
    'debtsTrackedUsd',
    'activeGroupsCount',
    'peopleSharingCount',
] as const satisfies readonly StatField[];

/** The same-origin proxy of the backend endpoint (vercel.json, spec 04 §4.1). */
const STATS_URL = '/api/stats';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

// STAT-008: the counts are JSON integers, the debts total a JSON number; none is negative.
const isCount = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isAmount = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** The statistics of a `/api/stats` body, or `null` if its shape is not the expected one. */
const parseLandingStats = (body: unknown): LandingStats | null => {
    if (!isRecord(body)) {
        return null;
    }
    const { expensesCount, debtsTrackedUsd, activeGroupsCount, peopleSharingCount } = body;

    if (
        !isCount(expensesCount) ||
        !isAmount(debtsTrackedUsd) ||
        !isCount(activeGroupsCount) ||
        !isCount(peopleSharingCount)
    ) {
        return null;
    }
    return { expensesCount, debtsTrackedUsd, activeGroupsCount, peopleSharingCount };
};

/** Digits of a non-negative number without an exponent: `1e21` → `1000000000000000000000`. */
const expandedDigits = (value: number): { integer: string; fraction: string } => {
    const [coefficient = '0', exponent] = value.toString().split('e');
    const [integer = '0', fraction = ''] = coefficient.split('.');
    const digits = integer + fraction;
    const point = integer.length + Number(exponent ?? 0);

    if (point <= 0) {
        return { integer: '0', fraction: '0'.repeat(-point) + digits };
    }
    if (point >= digits.length) {
        return { integer: digits + '0'.repeat(point - digits.length), fraction: '' };
    }
    return { integer: digits.slice(0, point), fraction: digits.slice(point) };
};

/** A digit string plus one in its last place: `199` → `200`, `99` → `100`. */
const incremented = (digits: string): string => {
    const result = digits.split('');

    for (let index = result.length - 1; index >= 0; index -= 1) {
        if (result[index] !== '9') {
            result[index] = String(Number(result[index]) + 1);
            return result.join('');
        }
        result[index] = '0';
    }
    return `1${result.join('')}`;
};

/** Half-up rounding of a non-negative number on its decimal digits (the app's `roundHalfUp`). */
const roundHalfUp = (value: number, precision: number): number => {
    const { integer, fraction } = expandedDigits(value);
    const kept = integer + fraction.slice(0, precision).padEnd(precision, '0');
    const digits = (fraction[precision] ?? '0') >= '5' ? incremented(kept) : kept;

    if (precision === 0) {
        return Number(digits);
    }
    const point = digits.length - precision;

    return Number(`${digits.slice(0, point)}.${digits.slice(point)}`);
};

const SCALES = [
    [1e15, 'Q'],
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
] as const;

/**
 * A non-negative amount in the app's "summary" format (`Amount type="summary"`, helpers/numbers.ts
 * `getNumberData` with `isKMB` and `isExternal`): below 1000 up to `precision` decimals (2 by
 * default), from 1000 on two decimals and a K/M/B/T/Q suffix (`1.20K`, `1.25M`); a positive value
 * below the precision is `< 0.01`. The format does not depend on the language, as in the app.
 */
const formatSummary = (value: number, precision?: number): string => {
    const digits = precision ?? (value >= 1000 ? 0 : 2);
    const smallest = 1 / 10 ** digits;
    const tooSmall = value > 0 && value < smallest;
    const rounded = roundHalfUp(tooSmall ? smallest : value, digits);
    const prefix = tooSmall ? '< ' : '';
    const scale = SCALES.find(([size]) => rounded >= size);

    if (rounded >= 1000 && scale !== undefined) {
        const [size, suffix] = scale;

        return `${prefix}${roundHalfUp(rounded / size, 2).toFixed(2)}${suffix}`;
    }
    const [integer = '', fraction = ''] = rounded.toString().split('.');
    const grouped = integer.replace(/(\d)(?=(\d{3})+$)/g, '$1,');
    const decimals = fraction.slice(0, digits);

    return `${prefix}${decimals ? `${grouped}.${decimals}` : grouped}`;
};

/** The text of each metric: counts in the summary format, the debts total with `USD`. */
const formatLandingStats = (stats: LandingStats): Record<StatField, string> => ({
    expensesCount: formatSummary(stats.expensesCount),
    debtsTrackedUsd: `${formatSummary(stats.debtsTrackedUsd)} USD`,
    activeGroupsCount: formatSummary(stats.activeGroupsCount),
    peopleSharingCount: formatSummary(stats.peopleSharingCount),
});

/** The block: `hidden` until the numbers are in, one `[data-stat="<field>"]` per metric. */
interface StatsBlock {
    hidden: boolean;
    querySelector: (selectors: string) => { textContent: string | null } | null;
}

type FetchStats = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Fetches the statistics and shows the block with them. On a network error, a non-OK status, a
 * body that is not JSON, an unexpected shape or a missing metric element the block stays hidden:
 * the statistics are decoration, never an error for the visitor (spec 04 §3.4).
 */
const loadLandingStats = async (
    block: StatsBlock,
    fetchStats: FetchStats = (input, init) => fetch(input, init),
): Promise<boolean> => {
    let body: unknown;

    try {
        // Public data: no cookie (an old host-only session cookie of the origin must not go along).
        const response = await fetchStats(STATS_URL, {
            credentials: 'omit',
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
            return false;
        }
        body = await response.json();
    } catch {
        // Offline, blocked or not JSON: the block stays hidden, which is the whole fallback.
        return false;
    }
    const stats = parseLandingStats(body);

    if (stats === null) {
        return false;
    }
    const texts = formatLandingStats(stats);
    const targets = STAT_FIELDS.map(field => block.querySelector(`[data-stat="${field}"]`));

    if (targets.some(target => target === null)) {
        return false;
    }
    STAT_FIELDS.forEach((field, index) => {
        const target = targets[index];

        if (target) {
            target.textContent = texts[field];
        }
    });
    block.hidden = false;
    return true;
};

export {
    formatLandingStats,
    formatSummary,
    loadLandingStats,
    parseLandingStats,
    STAT_FIELDS,
    STATS_URL,
};
export type { LandingStats, StatField };
