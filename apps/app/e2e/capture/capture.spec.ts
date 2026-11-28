// The CI screen capture (#998, docs/e2e-tests.md "Screen captures"): one test per non-manual row of
// the screen manifest. Each test provisions its row's scenario under the run id (purged by the
// global teardown), opens the row's context, installs its mocks, then for every width opens the
// row's state with its recipe and takes a full-page PNG per theme. Runs only through
// playwright.capture.config.ts, which refuses to run outside CI.
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

import type { ScreenEntry, ScreenMock } from '../../src/test/screenManifest';
import { screenVariants } from '../../src/test/screenManifest';
import { expect, test } from '../support/fixtures';
import type { ProvisionedUser, ProvisioningClient } from '../support/provisioning';
import { visibleOne } from '../support/ui';

import { CAPTURE_OUTPUT_DIR, readScreenManifest } from './captureFiles';
import {
    autoRows,
    CAPTURE_ATTACHMENT,
    CAPTURE_DEADLINE_VARIABLE,
    CAPTURE_NOT_REACHED,
    CAPTURE_SITE_ORIGIN,
    captureFileName,
    type CaptureTheme,
    type CaptureWidth,
    computeRecipeCoverage,
    isMockableApiRequest,
    isPastCaptureDeadline,
    mockMatchesMethod,
    parseCaptureDeadline,
    parseCaptureFixture,
    recipeCoverageProblems,
    resolveCapturePath,
    rowTimeoutMs,
    sanitizeReason,
    SCREEN_ID_ANNOTATION,
    SITE_STATS_BODY,
    siteJoinRewrite,
    TIME_TEXT_RULES,
} from './captureModel';
import { type CaptureContext, RECIPES } from './recipes';
import { type ScenarioData, SCENARIOS } from './scenarios';

const manifest = readScreenManifest();

// A phone and a desktop window; the PNG is full-page, so only the width shapes the layout.
const VIEWPORT_HEIGHT: Record<CaptureWidth, number> = { 390: 844, 1440: 900 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Enough of a Playwright error (message and call log) to debug from the CI log.
const ERROR_LINES = 15;

const provisionScenario = (
    id: string | undefined,
    client: ProvisioningClient,
): Promise<ScenarioData> => {
    if (id === undefined) {
        return Promise.resolve({ users: {} });
    }

    const provision = SCENARIOS[id];
    if (!provision) {
        throw new Error(`no provisioning for scenario '${id}'`);
    }

    return provision(client);
};

/** The row's page: anonymous, signed in as a scenario user, or with its own user agent. */
const openRowPage = async (
    row: ScreenEntry,
    scenario: ScenarioData,
    browser: Browser,
    signIn: (user: ProvisionedUser) => Promise<Page>,
    ownContexts: BrowserContext[],
): Promise<Page> => {
    const fixture = parseCaptureFixture(row.setup);

    if (fixture.kind === 'signed-in') {
        const user = scenario.users[fixture.user];
        if (!user) {
            throw new Error(`scenario '${row.setup.scenario ?? ''}' has no user ${fixture.user}`);
        }

        return signIn(user);
    }

    // `browser.newContext` takes the config's `use` options (baseURL, locale, service workers).
    const context = await browser.newContext(
        fixture.kind === 'user-agent' ? { userAgent: fixture.userAgent } : {},
    );
    ownContexts.push(context);

    return context.newPage();
};

/** Counts requests that a `hang` mock holds, so a loading state is taken only once it shows. */
class HeldRequests {
    private count = 0;

    hold(): void {
        this.count += 1;
    }

    reset(): void {
        this.count = 0;
    }

    async waitForAny(): Promise<void> {
        await expect
            .poll(() => this.count, { message: 'a hang mock held a request' })
            .toBeGreaterThan(0);
    }
}

/** The manifest mocks of a row, on the whole context and only for API requests. */
const installMocks = async (
    context: BrowserContext,
    mocks: readonly ScreenMock[],
    appOrigin: string,
    held: HeldRequests,
): Promise<void> => {
    for (const mock of mocks) {
        await context.route(mock.url, async route => {
            const request = route.request();
            if (
                !mockMatchesMethod(mock, request.method()) ||
                !isMockableApiRequest(request.url(), appOrigin)
            ) {
                await route.fallback();

                return;
            }

            switch (mock.action) {
                case 'hang':
                    // Never answered: the request stays pending until the context closes.
                    held.hold();

                    return;
                case 'abort':
                    await route.abort();

                    return;
                case 'fulfill':
                    await route.fulfill({
                        status: mock.status ?? 200,
                        headers: mock.headers,
                        contentType: 'application/json',
                        body: mock.body === undefined ? '' : JSON.stringify(mock.body),
                    });
            }
        });
    }
};

/** The site's `vercel.json` behaviour that `astro preview` lacks: the join rewrite and `/api/stats`. */
const installSiteRoutes = async (context: BrowserContext): Promise<void> => {
    await context.route(`${CAPTURE_SITE_ORIGIN}/api/stats`, route =>
        route.fulfill({ status: 200, json: SITE_STATS_BODY }),
    );
    await context.route(`${CAPTURE_SITE_ORIGIN}/join/**`, async route => {
        const rewritten = siteJoinRewrite(route.request().url());
        if (!rewritten) {
            await route.fallback();

            return;
        }

        await route.fulfill({ response: await route.fetch({ url: rewritten }) });
    });
};

// The theme class is set at load (packages/tokens theme-init script); the app also follows later
// changes, the site does not. The scheme is emulated before the page opens, so this is quick.
const THEME_TIMEOUT = 10_000;

/** Waits until the page shows the emulated colour scheme: `<html class="light|dark">`. */
const waitForTheme = async (page: Page, theme: CaptureTheme): Promise<void> => {
    try {
        await page.waitForFunction(
            expected => document.documentElement.classList.contains(expected),
            theme,
            { timeout: THEME_TIMEOUT },
        );
    } catch {
        throw new Error(
            `the page did not apply the ${theme} theme within ${THEME_TIMEOUT / 1000} s (no '${theme}' class on <html>)`,
        );
    }
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
};

/**
 * Replaces date and time texts (relative times, dates, clock times) with fixed ones
 * (captureModel.ts `TIME_TEXT_RULES`), so a PNG does not change from run to run because of the
 * date. Whole text nodes only; the next render may put the real text back, after the PNG.
 */
const fixTimeTexts = (page: Page): Promise<void> =>
    page.evaluate(rules => {
        const patterns = rules.map(rule => ({
            pattern: new RegExp(rule.source, rule.flags),
            replacement: rule.replacement,
        }));
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.nodeValue?.trim() ?? '';
            const rule = patterns.find(candidate => candidate.pattern.test(text));
            if (rule) {
                node.nodeValue = rule.replacement;
            }
        }
    }, TIME_TEXT_RULES);

/** Deletes the row's PNGs of an earlier attempt, so a retry never leaves a stale one behind. */
const removeRowPngs = async (id: string): Promise<void> => {
    const folder = path.join(CAPTURE_OUTPUT_DIR, 'png');
    const prefix = `${id}__`;
    const files = await readdir(folder).catch(() => []);
    await Promise.all(
        files
            .filter(file => file.startsWith(prefix))
            .map(file => rm(path.join(folder, file), { force: true })),
    );
};

/**
 * Lets late reads settle before a PNG. With a held request the network never goes idle, and a page
 * polling in the background may not either: the idle wait is best effort, the recipe has already
 * waited for its state.
 */
const settle = async (page: Page, holdsRequests: boolean): Promise<void> => {
    if (holdsRequests) {
        return;
    }

    try {
        await page.waitForLoadState('networkidle', { timeout: 5_000 });
    } catch {
        // Best effort only (see above): the state is already on screen.
    }
};

/** What leaves CI masked: QR codes (canvas), invite tokens and links, emails. */
const masks = (page: Page, scenario: ScenarioData): Locator[] => [
    page.locator('canvas'),
    // A date and time field shows today's date: a fixed text cannot replace an input's value.
    page.locator('input[type="datetime-local"]'),
    page.getByText(/\/join\//),
    page.getByText(EMAIL),
    ...(scenario.inviteToken ? [page.getByText(scenario.inviteToken)] : []),
];

const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

test.describe('screen capture', () => {
    // The registry is checked as one named test, so a row added without a recipe (or a recipe left
    // for a renamed row) fails the run by name before any PNG; the row's own test fails too.
    test('every manifest row has a capture recipe', () => {
        expect(
            recipeCoverageProblems(computeRecipeCoverage(manifest, Object.keys(RECIPES))),
        ).toEqual([]);
    });

    for (const row of autoRows(manifest)) {
        test(
            row.id,
            { annotation: { type: SCREEN_ID_ANNOTATION, description: row.id } },
            async ({ browser, baseURL, provisioning, signIn }, testInfo) => {
                const recipe = RECIPES[row.id];
                const secrets: string[] = [];
                const ownContexts: BrowserContext[] = [];

                testInfo.setTimeout(rowTimeoutMs(screenVariants(manifest, row).length));

                try {
                    await removeRowPngs(row.id);
                    // A row that starts after the soft budget fails at once, so the run ends in
                    // time for the teardown's purge (playwright.capture.config.ts).
                    if (
                        isPastCaptureDeadline(
                            parseCaptureDeadline(process.env[CAPTURE_DEADLINE_VARIABLE]),
                            Date.now(),
                        )
                    ) {
                        throw new Error(CAPTURE_NOT_REACHED);
                    }
                    if (!recipe) {
                        throw new Error('no capture recipe for this manifest row');
                    }
                    if (!baseURL) {
                        throw new Error('baseURL is not configured');
                    }

                    const scenario = await provisionScenario(row.setup.scenario, provisioning);
                    secrets.push(
                        ...[scenario.inviteToken, scenario.groupId].filter(
                            (value): value is string => Boolean(value),
                        ),
                        ...Object.values(scenario.users).map(user => user.id),
                    );

                    const page = await openRowPage(row, scenario, browser, signIn, ownContexts);
                    const context = page.context();
                    const held = new HeldRequests();
                    const params: Record<string, string> = {};
                    const origin = row.app === 'site' ? CAPTURE_SITE_ORIGIN : '';
                    const captureContext: CaptureContext = {
                        page,
                        row,
                        scenario,
                        params,
                        path: () =>
                            origin +
                            resolveCapturePath(row.path, {
                                groupId: scenario.groupId,
                                inviteToken: scenario.inviteToken,
                                ...params,
                            }),
                        waitForHeldRequest: () => held.waitForAny(),
                    };
                    if (row.app === 'site') {
                        await installSiteRoutes(context);
                    }

                    await recipe.prepare?.(captureContext);
                    const mocks = row.setup.mocks ?? [];
                    await installMocks(context, mocks, new URL(baseURL).origin, held);
                    const holdsRequests = mocks.some(mock => mock.action === 'hang');

                    // Every variant is opened on its own, with its width and colour scheme set
                    // first: the site applies the theme only at load, and layouts swap controls
                    // between phone and desktop. Steps that write run once, in `prepare`.
                    for (const { theme, width } of screenVariants(manifest, row)) {
                        await context.setOffline(false);
                        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT[width] });
                        await page.emulateMedia({ colorScheme: theme });
                        held.reset();
                        await recipe.open(captureContext);
                        if (row.setup.offline) {
                            await context.setOffline(true);
                            await expect(visibleOne(page.getByText(/^No network/))).toBeVisible();
                        }
                        // The page's own values (the details id) leave CI only as placeholders.
                        secrets.push(...Object.values(params));

                        await waitForTheme(page, theme);
                        await settle(page, holdsRequests);
                        await fixTimeTexts(page);
                        const file = captureFileName(row.id, { theme, width });
                        await page.screenshot({
                            path: path.join(CAPTURE_OUTPUT_DIR, file),
                            fullPage: true,
                            animations: 'disabled',
                            caret: 'hide',
                            mask: masks(page, scenario),
                        });
                        await testInfo.attach(CAPTURE_ATTACHMENT, {
                            body: JSON.stringify({ theme, width, file }),
                            contentType: 'application/json',
                        });
                    }
                } catch (error) {
                    // The message reaches the log, the index and the job summary: no token or id.
                    // eslint-disable-next-line preserve-caught-error -- a cause would print the unsanitized message.
                    throw new Error(sanitizeReason(errorMessage(error), secrets, ERROR_LINES));
                } finally {
                    await Promise.all(ownContexts.map(context => context.close()));
                }
            },
        );
    }
});
