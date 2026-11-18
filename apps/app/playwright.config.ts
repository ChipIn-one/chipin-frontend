import { defineConfig, devices } from '@playwright/test';

import {
    LOCAL_DEV_SERVER_ORIGIN,
    LOCAL_DEV_SERVER_PORT,
    readE2eEnvironment,
    resolveE2eTarget,
} from './e2e/support/config';

// Resolved while the config loads: a production or non-allowlisted target throws here, before the
// web server, the global setup or any request (docs/e2e-tests.md).
const target = resolveE2eTarget(readE2eEnvironment());
const isCi = process.env.CI === 'true';
// The release browser matrix (prepare-release-qa.yml) reads its per-profile counts from this report.
const jsonReport = process.env.CHIPIN_E2E_JSON_REPORT?.trim();

export default defineConfig({
    testDir: './e2e/specs',
    testMatch: '**/*.spec.ts',
    outputDir: './test-results',
    globalSetup: './e2e/support/global-setup.ts',
    // Each test registers its own users, so tests share no state and run in parallel.
    fullyParallel: true,
    forbidOnly: isCi,
    retries: 0,
    workers: isCi ? 2 : undefined,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: './playwright-report' }],
        ...(jsonReport ? [['json', { outputFile: jsonReport }] as const] : []),
    ],
    use: {
        baseURL: target.baseUrl,
        locale: 'en-US',
        colorScheme: 'light',
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        // Video: recorded by the `signIn` fixture (e2e/support/fixtures.ts) and kept only on failure.
    },
    // `chromium` runs on pull requests (e2e-smoke.yml selects it); all five run against the release
    // candidate's Preview (prepare-release-qa.yml, docs/e2e-tests.md#release-browser-matrix). The
    // phone profiles emulate a phone viewport, touch and a mobile user agent.
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'pixel', use: { ...devices['Pixel 7'] } },
        { name: 'iphone', use: { ...devices['iPhone 15'] } },
    ],
    // Without CHIPIN_E2E_BASE_URL the suite runs the commit's code on the Vite dev server, which
    // proxies `/api` to the staging API (vite.config.ts).
    webServer:
        target.kind === 'local-dev-server'
            ? {
                  command: `npm run dev -- --port ${LOCAL_DEV_SERVER_PORT} --strictPort`,
                  url: LOCAL_DEV_SERVER_ORIGIN,
                  reuseExistingServer: !isCi,
                  timeout: 120_000,
                  stdout: 'ignore',
                  stderr: 'pipe',
              }
            : undefined,
});
