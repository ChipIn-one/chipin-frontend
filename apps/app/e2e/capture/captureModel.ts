// Pure helpers of the CI screen capture (#998, docs/e2e-tests.md "Screen captures"): recipe
// coverage, the row's fixture and path, the scope of the manifest mocks, failure reasons and the
// artifact index. No Playwright, Node or browser API here, so all of it is unit-tested with Vitest.
import {
    type ScreenEntry,
    type ScreenManifest,
    type ScreenMock,
    screenVariants,
} from '../../src/test/screenManifest';
import { STAGING_API_ORIGIN } from '../support/config';

export type CaptureTheme = 'light' | 'dark';
export type CaptureWidth = 390 | 1440;

export interface CaptureVariant {
    theme: CaptureTheme;
    width: CaptureWidth;
}

/** One PNG of a row: `file` is relative to the artifact root. */
export interface CaptureFile extends CaptureVariant {
    file: string;
}

/** The PNG of one variant inside the artifact: `png/<id>__<theme>__<width>.png`. */
export const captureFileName = (id: string, { theme, width }: CaptureVariant): string =>
    `png/${id}__${theme}__${width}.png`;

/** The rows the capture takes automatically (`capture: "manual"` rows are listed, not taken). */
export const autoRows = (manifest: ScreenManifest): ScreenEntry[] =>
    manifest.screens.filter(screen => screen.capture !== 'manual');

export interface RecipeCoverage {
    /** Auto rows without a recipe: they fail the run by name. */
    withoutRecipe: string[];
    /** Recipe ids that name no manifest row (a renamed or deleted row). */
    unknownRecipes: string[];
    /** Recipes of `manual` rows: the row should drop `capture: "manual"`, or the recipe go. */
    manualWithRecipe: string[];
}

export const computeRecipeCoverage = (
    manifest: ScreenManifest,
    recipeIds: readonly string[],
): RecipeCoverage => {
    const recipes = new Set(recipeIds);
    const rows = new Map(manifest.screens.map(screen => [screen.id, screen]));

    return {
        withoutRecipe: autoRows(manifest)
            .map(screen => screen.id)
            .filter(id => !recipes.has(id)),
        unknownRecipes: recipeIds.filter(id => !rows.has(id)),
        manualWithRecipe: recipeIds.filter(id => rows.get(id)?.capture === 'manual'),
    };
};

/** One message per coverage problem, naming the row or recipe; empty when the registry fits. */
export const recipeCoverageProblems = (coverage: RecipeCoverage): string[] => [
    ...coverage.withoutRecipe.map(id => `${id}: no capture recipe for this manifest row`),
    ...coverage.unknownRecipes.map(id => `${id}: a recipe for an id that is not a manifest row`),
    ...coverage.manualWithRecipe.map(id => `${id}: a recipe for a row marked capture: manual`),
];

/** The users a scenario can sign in (`signIn(A)`). */
export type ScenarioUserKey = 'A' | 'B' | 'C';

export type CaptureFixture =
    | { kind: 'anonymous' }
    | { kind: 'signed-in'; user: ScenarioUserKey }
    | { kind: 'user-agent'; userAgent: string };

const SIGN_IN_FIXTURE = /^signIn\(([ABC])\)$/;

/** The context a row opens, from its `setup.fixture` (and `setup.userAgent`). */
export const parseCaptureFixture = (setup: ScreenEntry['setup']): CaptureFixture => {
    const fixture = setup.fixture?.trim() ?? '';

    if (fixture === 'page') {
        return { kind: 'anonymous' };
    }

    const signIn = SIGN_IN_FIXTURE.exec(fixture);
    if (signIn?.[1] === 'A' || signIn?.[1] === 'B' || signIn?.[1] === 'C') {
        return { kind: 'signed-in', user: signIn[1] };
    }

    if (fixture === 'browser.newContext({ userAgent })') {
        if (!setup.userAgent) {
            throw new Error('the fixture browser.newContext({ userAgent }) needs setup.userAgent');
        }

        return { kind: 'user-agent', userAgent: setup.userAgent };
    }

    throw new Error(`unknown capture fixture '${fixture}'`);
};

/**
 * The row's path with its `:params` filled in (`/group/:groupId`). A missing value throws: the
 * scenario or the recipe did not provide it.
 */
export const resolveCapturePath = (
    path: string,
    params: Readonly<Record<string, string | undefined>>,
): string =>
    path.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
        const value = params[name];

        if (!value) {
            throw new Error(`the path ${path} needs :${name}, which the setup did not provide`);
        }

        return encodeURIComponent(value);
    });

/**
 * Whether a request may be answered by a manifest mock: only API reads, through the app's own `/api`
 * proxy or straight to the staging API. A manifest glob such as `groups/*` would otherwise also match
 * the dev server's source modules (`/src/entities/groups/...`) and the page itself.
 */
export const isMockableApiRequest = (url: string, appOrigin: string): boolean => {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    if (parsed.origin === STAGING_API_ORIGIN) {
        return true;
    }

    return (
        parsed.origin === appOrigin &&
        (parsed.pathname === '/api' || parsed.pathname.startsWith('/api/'))
    );
};

export const mockMatchesMethod = (mock: ScreenMock, method: string): boolean =>
    mock.method === 'ANY' || mock.method === method.toUpperCase();

// SGR colour codes of Playwright's error messages.
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const RUN_ID = /\bfe-e2e-\d{13}-[0-9a-f]{12}\b/g;
// `/group/join/<token>`, `/friends/join/<token>` (app) and `/join/<kind>/<token>` (site).
const INVITE_PATH = /\/join\/(?:(group|friend)\/)?([^/\s?#'"`]+)/g;
const MAX_REASON_LENGTH = 300;

/**
 * A failure reason that may leave CI (the log, the index and the job summary): the first
 * `maxLines` non-empty lines of the error, without colour codes, with the row's own values
 * (`secrets`: invite tokens, ids) and every UUID, run id and invite path segment replaced, each line
 * at most 300 characters.
 */
export const sanitizeReason = (
    message: string,
    secrets: readonly string[] = [],
    maxLines = 1,
): string => {
    let text = message.replace(ANSI_ESCAPE, '');

    for (const secret of secrets) {
        if (secret) {
            text = text.split(secret).join('{secret}');
        }
    }

    text = text
        .replace(RUN_ID, '{run}')
        .replace(UUID, '{id}')
        .replace(INVITE_PATH, (match: string, kind: string | undefined, segment: string) => {
            if (kind) {
                return `/join/${kind}/{token}`;
            }

            // The site's join page itself (`/join/group`) holds no token.
            return segment === 'group' || segment === 'friend' ? match : '/join/{token}';
        });

    const lines = text
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => line.trim().length > 0)
        .slice(0, maxLines)
        .map(line =>
            line.length > MAX_REASON_LENGTH ? `${line.slice(0, MAX_REASON_LENGTH - 1)}…` : line,
        );

    return lines.length > 0 ? lines.join('\n').trim() : 'unknown error';
};

/** What one row's test produced: its PNGs and, when it failed, why. */
export interface RowCaptureResult {
    captures: CaptureFile[];
    /** Null when the test passed. */
    error: string | null;
}

export interface CaptureIndexScreen {
    id: string;
    app: ScreenEntry['app'];
    kind: ScreenEntry['kind'];
    parent: string | null;
    path: string;
    capture: 'auto' | 'manual';
    captures: CaptureFile[];
}

export interface CaptureIndexMissing {
    id: string;
    /** Null when the entry is not a row variant (a recipe without a row). */
    variant: CaptureVariant | null;
    reason: string;
}

/** `index.json` of the `screen-captures` artifact, schema version 1 (docs/design-system/screens.md). */
export interface CaptureIndex {
    schemaVersion: 1;
    commit: string;
    ref: string;
    /** The GitHub Actions run id (`GITHUB_RUN_ID`). */
    runId: string;
    generatedAt: string;
    manifestVersion: number;
    /** The pinned `@playwright/test` version: its Chromium renders and encodes the PNGs. */
    playwrightVersion: string;
    flows: { id: string; title: string; screens: CaptureIndexScreen[] }[];
    ungrouped: CaptureIndexScreen[];
    manual: { id: string; note: string }[];
    missing: CaptureIndexMissing[];
}

export interface CaptureIndexInput {
    manifest: ScreenManifest;
    /** By row id; an auto row without an entry was not run. */
    results: ReadonlyMap<string, RowCaptureResult>;
    recipeIds: readonly string[];
    commit: string;
    ref: string;
    runId: string;
    generatedAt: string;
    playwrightVersion: string;
}

const sameVariant = (a: CaptureVariant, b: CaptureVariant): boolean =>
    a.theme === b.theme && a.width === b.width;

export const buildCaptureIndex = (input: CaptureIndexInput): CaptureIndex => {
    const { manifest, results } = input;
    const coverage = computeRecipeCoverage(manifest, input.recipeIds);
    const withoutRecipe = new Set(coverage.withoutRecipe);
    const missing: CaptureIndexMissing[] = [];
    const capturesById = new Map<string, CaptureFile[]>();

    for (const screen of manifest.screens) {
        if (screen.capture === 'manual') {
            capturesById.set(screen.id, []);
            continue;
        }

        const result = results.get(screen.id);
        const expected = screenVariants(manifest, screen);
        // Only expected variants count, each once, in the manifest's order.
        const taken = expected.flatMap(variant => {
            const file = result?.captures.find(capture => sameVariant(capture, variant));

            return file ? [{ theme: variant.theme, width: variant.width, file: file.file }] : [];
        });
        capturesById.set(screen.id, taken);

        const reason = withoutRecipe.has(screen.id)
            ? 'no capture recipe for this manifest row'
            : result === undefined
              ? 'the row was not run: the run ended first (global timeout, a cancel or a crash)'
              : sanitizeReason(result.error ?? 'the variant was not captured');

        for (const variant of expected) {
            if (!taken.some(capture => sameVariant(capture, variant))) {
                missing.push({ id: screen.id, variant, reason });
            }
        }
    }

    for (const id of coverage.unknownRecipes) {
        missing.push({
            id,
            variant: null,
            reason: 'a recipe for an id that is not a manifest row',
        });
    }
    for (const id of coverage.manualWithRecipe) {
        missing.push({ id, variant: null, reason: 'a recipe for a row marked capture: manual' });
    }

    const summary = (screen: ScreenEntry): CaptureIndexScreen => ({
        id: screen.id,
        app: screen.app,
        kind: screen.kind,
        parent: screen.parent ?? null,
        path: screen.path,
        capture: screen.capture,
        captures: capturesById.get(screen.id) ?? [],
    });
    const rows = new Map(manifest.screens.map(screen => [screen.id, screen]));
    const inFlow = new Set(manifest.flows.flatMap(flow => flow.steps));

    return {
        schemaVersion: 1,
        commit: input.commit,
        ref: input.ref,
        runId: input.runId,
        generatedAt: input.generatedAt,
        manifestVersion: manifest.version,
        playwrightVersion: input.playwrightVersion,
        flows: manifest.flows.map(flow => ({
            id: flow.id,
            title: flow.title,
            // The schema guarantees every step names a row.
            screens: flow.steps.flatMap(step => {
                const screen = rows.get(step);

                return screen ? [summary(screen)] : [];
            }),
        })),
        ungrouped: manifest.screens.filter(screen => !inFlow.has(screen.id)).map(summary),
        manual: manifest.screens
            .filter(screen => screen.capture === 'manual')
            .map(screen => ({ id: screen.id, note: screen.notes ?? '' })),
        missing,
    };
};

/** The test annotation that names a row test's screen id (read by the index reporter). */
export const SCREEN_ID_ANNOTATION = 'screen-id';
/** The test attachment of one PNG taken: a JSON {@link CaptureFile}. */
export const CAPTURE_ATTACHMENT = 'screen-capture';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** A {@link CAPTURE_ATTACHMENT} body, or null when it is not one. */
export const parseCaptureAttachment = (text: string): CaptureFile | null => {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return null;
    }

    if (
        !isRecord(value) ||
        (value.theme !== 'light' && value.theme !== 'dark') ||
        (value.width !== 390 && value.width !== 1440) ||
        typeof value.file !== 'string'
    ) {
        return null;
    }

    return { theme: value.theme, width: value.width, file: value.file };
};

/** `astro preview` of the built site (playwright.capture.config.ts), for the `site` rows. */
export const CAPTURE_SITE_PORT = 4321;
export const CAPTURE_SITE_ORIGIN = `http://localhost:${CAPTURE_SITE_PORT}`;

const SITE_JOIN_PATH = /^\/join\/(group|friend)\/[^/]+\/?$/;

/**
 * The page a site URL is served from under the `vercel.json` rewrite
 * `/join/:kind(group|friend)/:token` → `/join/:kind`, which `astro preview` does not apply; null for
 * every other URL. The browser keeps the original URL, so the page still reads the token from it.
 */
export const siteJoinRewrite = (url: string): string | null => {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    const match = SITE_JOIN_PATH.exec(parsed.pathname);
    if (parsed.origin !== CAPTURE_SITE_ORIGIN || !match) {
        return null;
    }

    return `${CAPTURE_SITE_ORIGIN}/join/${match[1]}`;
};

/**
 * Fixed landing statistics for `/api/stats` (in production a rewrite to the backend): the block
 * then always shows, with the same numbers in every capture.
 */
export const SITE_STATS_BODY = {
    expensesCount: 12_345,
    debtsTrackedUsd: 678_900,
    activeGroupsCount: 1_234,
    peopleSharingCount: 5_678,
};

/** A date or time text of the `en` app and the fixed text a capture shows instead. */
export interface TimeTextRule {
    source: string;
    flags: string;
    replacement: string;
}

const MONTH =
    '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const CLOCK = '\\d{1,2}:\\d{2}(?:\\s?[AP]M)?';

/**
 * Whole-text rules, first match wins: relative times (helpers/time.ts `formatRelativeTime`,
 * `Intl.RelativeTimeFormat` with `numeric: 'auto'`), dates with an optional year and time
 * (`28 November, 08:30 PM`, `November 28, 2026`), and clock times. "Today" and "Yesterday" date
 * dividers stay: they do not change between runs.
 */
export const TIME_TEXT_RULES: readonly TimeTextRule[] = [
    {
        source: '^(?:now|in \\d+ (?:second|minute|hour)s?|\\d+ (?:second|minute|hour)s? ago)$',
        flags: 'i',
        replacement: '5 minutes ago',
    },
    {
        source: `^(?:\\d{1,2} ${MONTH}|${MONTH} \\d{1,2})(?:,? \\d{4})?(?:,? (?:at )?${CLOCK})?$`,
        flags: 'i',
        replacement: '1 January, 12:00 PM',
    },
    { source: `^${CLOCK}$`, flags: 'i', replacement: '12:00 PM' },
];

/** The fixed text for a date or time text, or null when `text` is none (as the capture applies it). */
export const fixedTimeText = (text: string): string | null => {
    const trimmed = text.trim();
    const rule = TIME_TEXT_RULES.find(candidate =>
        new RegExp(candidate.source, candidate.flags).test(trimmed),
    );

    return rule ? rule.replacement : null;
};

/** Epoch milliseconds after which no further row starts (set by the workflow or the config). */
export const CAPTURE_DEADLINE_VARIABLE = 'CHIPIN_CAPTURE_DEADLINE';
/** The soft time budget of the rows: 27 minutes from the start of the capture. */
export const CAPTURE_TIME_BUDGET_MS = 27 * 60_000;
/** The failure reason of a row that starts after the budget. */
export const CAPTURE_NOT_REACHED = "not reached: the run's time budget ended";

/** The deadline from its variable, or null when it is not a positive integer. */
export const parseCaptureDeadline = (value: string | undefined): number | null => {
    const trimmed = value?.trim() ?? '';
    if (!/^\d{1,16}$/.test(trimmed)) {
        return null;
    }
    const deadline = Number(trimmed);

    return deadline > 0 ? deadline : null;
};

export const isPastCaptureDeadline = (deadline: number | null, now: number): boolean =>
    deadline !== null && now >= deadline;

// Per row: provisioning (long-content: about 60 API calls) plus one open and PNG per variant.
const ROW_SETUP_BUDGET_MS = 90_000;
const VARIANT_BUDGET_MS = 50_000;

/**
 * A row's test timeout: 290 s for the usual four variants, 190 s for two. Budget plus the longest
 * row stays under the config's globalTimeout backstop.
 */
export const rowTimeoutMs = (variantCount: number): number =>
    ROW_SETUP_BUDGET_MS + Math.max(1, variantCount) * VARIANT_BUDGET_MS;
