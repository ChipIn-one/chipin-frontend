import { defineConfig, devices } from '@playwright/test';

import { readE2eEnvironment, resolveE2eTarget } from './e2e/support/config';

// The service worker suite (spec 04 criterion 5 (a) and the 04-2d update policy, docs/e2e-tests.md
// "Service worker suite"). Separate from playwright.config.ts on purpose: service workers are
// allowed here, and there is no global setup, no staging provisioning and no secret.
const target = resolveE2eTarget(readE2eEnvironment());

// The Vite dev server registers no worker (`devOptions.enabled: false`): the suite needs a built
// app, a Vercel Preview or a local `vite preview` of a production build.
if (target.kind === 'local-dev-server') {
    throw new Error(
        'The service worker suite needs CHIPIN_E2E_BASE_URL: a Vercel Preview of this project or a local `vite preview` origin (the dev server has no service worker)',
    );
}

const isCi = process.env.CI === 'true';

export default defineConfig({
    testDir: './e2e',
    testMatch: 'sw.spec.ts',
    outputDir: './test-results/sw',
    fullyParallel: true,
    forbidOnly: isCi,
    retries: 0,
    workers: isCi ? 2 : undefined,
    // Each test starts in a fresh context, so the worker installs and precaches the whole build
    // (about 125 files, fetched one after another by Workbox) before any check: a few seconds in
    // CI, up to two minutes on a slow link to the Preview.
    timeout: 240_000,
    expect: { timeout: 15_000 },
    reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report/sw' }]],
    use: {
        baseURL: target.baseUrl,
        locale: 'en-US',
        colorScheme: 'light',
        serviceWorkers: 'allow',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    // Playwright sees and controls the network of service workers only in Chromium.
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
