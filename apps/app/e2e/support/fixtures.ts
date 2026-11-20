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

import {
    E2E_RUN_ID_VARIABLE,
    previewBypassHeaders,
    readE2eEnvironment,
    resolveE2eBasicAuth,
    resolveE2eTarget,
    resolvePreviewBypass,
} from './config';
import {
    createProvisioningClient,
    type ProvisionedUser,
    type ProvisioningClient,
    REFRESH_COOKIE_NAME,
} from './provisioning';
import {
    type ApiErrorRecord,
    formatApiErrors,
    toFailedRequestRecord,
    toServerErrorRecord,
} from './serverErrors';

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
    // Each context also records the API's 5xx answers and requests that got no answer: a failed
    // test then names them instead of timing out on a closed page with no cause (#778).
    signIn: async ({ browser, baseURL }, provide, testInfo) => {
        if (!baseURL) {
            throw new Error('baseURL is not configured');
        }

        const videoDir = testInfo.outputPath('video');
        const environment = readE2eEnvironment();
        const bypass = resolvePreviewBypass(environment, resolveE2eTarget(environment));
        const contexts: BrowserContext[] = [];
        const pages: Page[] = [];
        const appOrigin = new URL(baseURL).origin;
        const apiErrors: ApiErrorRecord[] = [];
        const recordApiError = (record: ApiErrorRecord | undefined): void => {
            if (record) {
                apiErrors.push(record);
            }
        };

        await provide(async user => {
            const context = await browser.newContext({
                storageState: buildSessionStorageState(baseURL, user),
                recordVideo: { dir: videoDir },
            });
            contexts.push(context);
            // The context's listeners see the requests of all its pages.
            context.on('response', response => {
                recordApiError(
                    toServerErrorRecord(
                        {
                            method: response.request().method(),
                            url: response.url(),
                            status: response.status(),
                        },
                        appOrigin,
                        new Date(),
                    ),
                );
            });
            context.on('requestfailed', request => {
                recordApiError(
                    toFailedRequestRecord(
                        {
                            method: request.method(),
                            url: request.url(),
                            errorText: request.failure()?.errorText,
                        },
                        appOrigin,
                        new Date(),
                    ),
                );
            });
            if (bypass) {
                // Only the Preview origin is routed; every other request is left untouched.
                await context.route(
                    url => url.origin === bypass.origin,
                    route => {
                        const request = route.request();
                        const headers = previewBypassHeaders(bypass, {
                            url: request.url(),
                            isNavigation: request.isNavigationRequest(),
                        });

                        return headers
                            ? route.continue({ headers: { ...request.headers(), ...headers } })
                            : route.continue();
                    },
                );
            }
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

        const apiErrorMessage = formatApiErrors(apiErrors);
        if (apiErrorMessage) {
            testInfo.annotations.push({ type: 'api-errors', description: apiErrorMessage });
            await testInfo.attach('api-errors.txt', {
                body: apiErrorMessage,
                contentType: 'text/plain',
            });
            console.warn(`[e2e] ${apiErrorMessage}`);
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
