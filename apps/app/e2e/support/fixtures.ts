// Test fixtures of the Playwright smoke (docs/e2e-tests.md). Each test registers its own users under
// the run's id (a refresh cookie rotates on first use, so users are not shared between tests) and
// opens each of them in its own browser context with a working session, without the sign-in UI.
import { rm } from 'node:fs/promises';

import {
    type BrowserContext,
    type BrowserContextOptions,
    type Page,
    test as base,
} from '@playwright/test';

import { LS_KEY_AUTH_SESSION_HINT } from '../../src/constants/localstorage';

import { E2E_RUN_ID_VARIABLE, readE2eEnvironment, resolveE2eBasicAuth } from './config';
import {
    createProvisioningClient,
    type ProvisionedUser,
    type ProvisioningClient,
    REFRESH_COOKIE_NAME,
} from './provisioning';

type StorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>;

/**
 * The browser state of a signed-in user: the refresh cookie on the app origin (the app reaches the
 * API through its own `/api` proxy, so the cookie is host-only there) and the session hint that
 * makes the app restore the session with a cookie refresh (helpers/authSession.ts).
 */
export const buildSessionStorageState = (baseUrl: string, user: ProvisionedUser): StorageState => ({
    cookies: [
        {
            name: REFRESH_COOKIE_NAME,
            value: user.refreshCookieValue,
            domain: new URL(baseUrl).hostname,
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
        },
    ],
    origins: [
        {
            origin: new URL(baseUrl).origin,
            localStorage: [{ name: LS_KEY_AUTH_SESSION_HINT, value: 'true' }],
        },
    ],
});

interface E2eFixtures {
    /** Staging provisioning bound to this run (Node fetch: nothing reaches traces). */
    provisioning: ProvisioningClient;
    /** Opens a new browser context signed in as `user` and returns its page. */
    signIn: (user: ProvisionedUser) => Promise<Page>;
}

const requireRunId = (): string => {
    const runId = process.env[E2E_RUN_ID_VARIABLE];

    if (!runId) {
        throw new Error('The e2e run id is missing: run the suite through playwright.config.ts');
    }

    return runId;
};

// Fixture bodies name their callback `provide`: `use` reads as a React hook to the lint rules.
export const test = base.extend<E2eFixtures>({
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the object pattern.
    provisioning: async ({}, provide) => {
        await provide(
            createProvisioningClient(resolveE2eBasicAuth(readE2eEnvironment()), requireRunId()),
        );
    },
    // `use.video` covers only Playwright's own `context` fixture, so these contexts record their
    // video themselves; it is kept, and attached to the report, only when the test fails.
    signIn: async ({ browser, baseURL }, provide, testInfo) => {
        if (!baseURL) {
            throw new Error('baseURL is not configured');
        }

        const videoDir = testInfo.outputPath('video');
        const contexts: BrowserContext[] = [];
        const pages: Page[] = [];

        await provide(async user => {
            const context = await browser.newContext({
                storageState: buildSessionStorageState(baseURL, user),
                recordVideo: { dir: videoDir },
            });
            contexts.push(context);
            const page = await context.newPage();
            pages.push(page);

            return page;
        });

        // A video is complete only after its context is closed.
        await Promise.all(contexts.map(context => context.close()));

        if (testInfo.status === testInfo.expectedStatus) {
            await rm(videoDir, { recursive: true, force: true });

            return;
        }

        const videoPaths = await Promise.all(pages.map(page => page.video()?.path()));
        await Promise.all(
            videoPaths.map((videoPath, index) =>
                videoPath
                    ? testInfo.attach(`video-${index + 1}`, {
                          path: videoPath,
                          contentType: 'video/webm',
                      })
                    : undefined,
            ),
        );
    },
});

export { expect } from '@playwright/test';
