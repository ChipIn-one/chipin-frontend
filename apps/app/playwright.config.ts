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
    reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],
    use: {
        baseURL: target.baseUrl,
        locale: 'en-US',
        colorScheme: 'light',
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        // Video: recorded by the `signIn` fixture (e2e/support/fixtures.ts) and kept only on failure.
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
