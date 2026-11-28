import { defineConfig, devices } from '@playwright/test';

import {
    CAPTURE_DEADLINE_VARIABLE,
    CAPTURE_SITE_ORIGIN,
    CAPTURE_SITE_PORT,
    CAPTURE_TIME_BUDGET_MS,
    parseCaptureDeadline,
} from './e2e/capture/captureModel';
import {
    LOCAL_DEV_SERVER_ORIGIN,
    LOCAL_DEV_SERVER_PORT,
    readE2eEnvironment,
    resolveE2eTarget,
} from './e2e/support/config';

// The CI screen capture (#998, docs/e2e-tests.md "Screen captures"): every manifest row in both
// themes at 390 and 1440 px, run by .github/workflows/screen-capture.yml. Separate from
// playwright.config.ts, whose `testDir` (e2e/specs) never reaches e2e/capture. No npm script runs
// it, and it refuses to run outside CI: it registers staging users and writes ~400 PNGs.
if (process.env.CI !== 'true') {
    throw new Error(
        'The screen capture runs only in CI (.github/workflows/screen-capture.yml); never on a developer machine',
    );
}

// The same target guard as the e2e suite: a production or non-allowlisted target throws here,
// before the web servers, the global setup or any request.
const target = resolveE2eTarget(readE2eEnvironment());

// The soft time budget (e2e/capture/capture.spec.ts): rows that would start after it fail at once as
// "not reached", so the run ends normally and the teardown purges. The workflow sets it when the
// capture step starts; set here only if missing, in the main process, before the workers start
// (they inherit it).
if (parseCaptureDeadline(process.env[CAPTURE_DEADLINE_VARIABLE]) === null) {
    process.env[CAPTURE_DEADLINE_VARIABLE] = String(Date.now() + CAPTURE_TIME_BUDGET_MS);
}

export default defineConfig({
    testDir: './e2e/capture',
    testMatch: 'capture.spec.ts',
    outputDir: './test-results/capture',
    // Run id, staging pre-flight, and the verified purge with its marker, as in the e2e suite.
    globalSetup: './e2e/support/global-setup.ts',
    // Each row provisions its own users, so rows share no state.
    fullyParallel: true,
    forbidOnly: true,
    // One retry, with fresh users: a staging hiccup should not leave master without a baseline.
    retries: 1,
    workers: 3,
    // The default; each row sets its own from its variant count (captureModel.ts rowTimeoutMs): it
    // provisions its scenario (long-content: about 60 API calls), then opens its state once per
    // variant (four for most rows).
    timeout: 300_000,
    // Only a backstop: when it expires Playwright 1.65 cuts the teardown short, so the purge and
    // its marker would not happen. The soft budget (27 min) plus the longest row timeout ends the
    // run before it; the workflow's final purge step covers the rest.
    globalTimeout: 35 * 60_000,
    expect: { timeout: 15_000 },
    reporter: [['list'], ['./e2e/capture/indexReporter.ts']],
    use: {
        baseURL: target.baseUrl,
        locale: 'en-US',
        // Every capture sets its own colour scheme and viewport (e2e/capture/capture.spec.ts).
        colorScheme: 'light',
        serviceWorkers: 'block',
        // Traces and failure screenshots would hold the run users' sessions; nothing but the
        // masked PNGs and the index leaves the job.
        trace: 'off',
        screenshot: 'off',
    },
    projects: [{ name: 'capture', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        // The commit's app on the Vite dev server, which proxies `/api` to the staging API.
        ...(target.kind === 'local-dev-server'
            ? [
                  {
                      command: `npm run dev -- --port ${LOCAL_DEV_SERVER_PORT} --strictPort`,
                      url: LOCAL_DEV_SERVER_ORIGIN,
                      reuseExistingServer: false,
                      timeout: 120_000,
                      stdout: 'ignore' as const,
                      stderr: 'pipe' as const,
                  },
              ]
            : []),
        // The commit's site, built and served by `astro preview` (no dev toolbar). The capture spec
        // adds what vercel.json does on a deployment: the `/join/<kind>/<token>` rewrite and
        // `/api/stats` (fixed numbers).
        {
            command: `npm run build && npm run preview -- --host localhost --port ${CAPTURE_SITE_PORT}`,
            cwd: '../site',
            url: CAPTURE_SITE_ORIGIN,
            reuseExistingServer: false,
            timeout: 240_000,
            stdout: 'ignore',
            stderr: 'pipe',
        },
    ],
});
