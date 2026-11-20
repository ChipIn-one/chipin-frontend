// The app service worker on one build (docs/e2e-tests.md "Service worker suite"), run only by
// playwright.sw.config.ts against a Vercel Preview or a local `vite preview`: spec 04 criterion 5
// scenario (a) and what the 04-2d update policy (§2.11) shows without a second deploy. No user is
// signed in: the checks are on the document, the worker and its registration.
// Scenarios (b), (c) and (d) of criterion 5 need the site preview (04-3d) and the legacy hosts
// (04-4a1), not an app preview, and are not here yet.
import { expect, type Page, type Request, test } from '@playwright/test';

const APP_SHELL_PATH = '/app.html';
const PRIVATE_PATH = '/dashboard';
const UPDATE_TOAST_TEXT = 'New version available';
const SIGNED_OUT_DIALOG_NAME = 'Welcome to ChipIn';

interface RegistrationSnapshot {
    scope: string;
    active: string | null;
    waiting: string | null;
    installing: string | null;
}

const readRegistrations = (page: Page): Promise<RegistrationSnapshot[]> =>
    page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();

        return registrations.map(registration => ({
            scope: registration.scope,
            active: registration.active?.scriptURL ?? null,
            waiting: registration.waiting?.scriptURL ?? null,
            installing: registration.installing?.scriptURL ?? null,
        }));
    });

// The worker is active (its install precached the build) and controls the page (`clientsClaim`).
const waitForControllingWorker = async (page: Page, origin: string): Promise<void> => {
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
    });
    await expect
        .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
        .toBe(`${origin}/sw.js`);
};

const originOf = (page: Page): string => new URL(page.url()).origin;

interface UpdateChecks {
    started: number;
    settled: number;
}

// Counts `registration.update()` calls (the app's update checks) and their settling; the original
// `update()` still runs.
const countUpdateChecks = async (page: Page): Promise<void> => {
    await page.addInitScript(() => {
        const checks = { started: 0, settled: 0 };
        const original = ServiceWorkerRegistration.prototype.update;
        Object.defineProperty(window, '__swUpdateChecks', { value: checks });
        ServiceWorkerRegistration.prototype.update = function update(
            this: ServiceWorkerRegistration,
        ) {
            checks.started += 1;
            const result = original.call(this);
            const settle = (): void => {
                checks.settled += 1;
            };
            // A separate chain: the app's own handling of `result` is unchanged.
            result.then(settle, settle);
            return result;
        };
    });
};

const readUpdateChecks = (page: Page): Promise<UpdateChecks> =>
    page.evaluate(() => {
        const checks: unknown = Reflect.get(window, '__swUpdateChecks');
        if (
            typeof checks !== 'object' ||
            checks === null ||
            !('started' in checks) ||
            !('settled' in checks) ||
            typeof checks.started !== 'number' ||
            typeof checks.settled !== 'number'
        ) {
            throw new Error('The update check counter is missing');
        }
        return { started: checks.started, settled: checks.settled };
    });

// Headless pages are always visible, so the event alone drives the app's listener. It is repeated
// until the app has its registration (`onRegisteredSW` runs after the window load) and the listener
// has started a check.
const checkOnVisible = async (page: Page, startedBefore: number): Promise<void> => {
    await expect
        .poll(async () => {
            await page.evaluate(() => {
                document.dispatchEvent(new Event('visibilitychange'));
            });
            return (await readUpdateChecks(page)).started;
        })
        .toBeGreaterThan(startedBefore);
};

test.describe('app service worker (spec 04 §2.11)', () => {
    test('criterion 5 (a): one registration of /sw.js with scope / and an offline load of /dashboard serves the shell from precache', async ({
        context,
        page,
    }) => {
        const online = await page.goto(PRIVATE_PATH);
        expect(online?.ok()).toBe(true);
        expect(online?.fromServiceWorker()).toBe(false);
        const origin = originOf(page);

        await waitForControllingWorker(page, origin);
        expect(await readRegistrations(page)).toEqual([
            { scope: `${origin}/`, active: `${origin}/sw.js`, waiting: null, installing: null },
        ]);

        // The worker precached what the host serves at /app.html: the same bytes come back offline.
        const shellResponse = await page.request.get(APP_SHELL_PATH);
        expect(shellResponse.ok()).toBe(true);
        const shell = await shellResponse.text();
        expect(shell).toContain('<div id="root"></div>');

        // Offline, an asset missing from precache could only fail: none may.
        const assetFailures: string[] = [];
        page.on('requestfailed', request => {
            if (new URL(request.url()).pathname.startsWith('/assets/')) {
                assetFailures.push(request.url());
            }
        });

        await context.setOffline(true);
        // A fresh navigation to the private path, not a reload of wherever the app went meanwhile.
        const offline = await page.goto(PRIVATE_PATH);

        expect(offline?.url()).toBe(`${origin}${PRIVATE_PATH}`);
        expect(offline?.fromServiceWorker()).toBe(true);
        expect(offline?.status()).toBe(200);
        expect(await offline?.text()).toBe(shell);
        // The shell's scripts also come from precache, so the app mounts offline and shows its
        // signed-out screen (no user is signed in).
        await expect(page.getByRole('dialog', { name: SIGNED_OUT_DIALOG_NAME })).toBeVisible();
        expect(assetFailures).toEqual([]);
        expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(
            `${origin}/sw.js`,
        );
        expect(await readRegistrations(page)).toEqual([
            { scope: `${origin}/`, active: `${origin}/sw.js`, waiting: null, installing: null },
        ]);
    });

    test('04-2d: the Workbox runtime is inlined, no workbox-*.js is requested', async ({
        context,
        page,
    }) => {
        const requested: string[] = [];
        // Chromium reports the worker's own requests (its precache) on the context too.
        context.on('request', (request: Request) => {
            requested.push(request.url());
        });

        await page.goto(PRIVATE_PATH);
        const origin = originOf(page);
        await waitForControllingWorker(page, origin);

        const worker = await page.request.get('/sw.js');
        expect(worker.ok()).toBe(true);
        // `inlineWorkboxRuntime`: the worker loads no other script.
        expect(await worker.text()).not.toContain('importScripts(');
        // The precache was fetched by the worker, so its requests are in the list.
        expect(requested).toContain(`${origin}${APP_SHELL_PATH}`);
        // A Workbox runtime file would sit next to the worker (`/workbox-<hash>.js`). The page's
        // registration library is a hashed chunk under `/assets/` and is not one.
        const isRuntimeFile = (url: string): boolean => {
            const { origin: urlOrigin, pathname } = new URL(url);
            return urlOrigin === origin && /^\/workbox-[^/]*\.js$/.test(pathname);
        };
        expect(requested.filter(isRuntimeFile)).toEqual([]);
    });

    test('04-2d: visibilitychange to visible runs registration.update(); without a waiting worker there is no prompt and no reload', async ({
        page,
    }) => {
        await countUpdateChecks(page);

        // Full document loads only (a client-side redirect such as the sign-in one is not a load).
        let documentLoads = 0;
        page.on('load', () => {
            documentLoads += 1;
        });

        await page.goto(PRIVATE_PATH);
        const origin = originOf(page);
        await waitForControllingWorker(page, origin);
        const before = await readUpdateChecks(page);

        await checkOnVisible(page, before.started);
        await expect
            .poll(async () => {
                const calls = await readUpdateChecks(page);
                return calls.started > before.started && calls.settled === calls.started;
            })
            .toBe(true);
        // The check settled (Chromium reports the browser's own fetch of the worker script to no
        // Playwright event): the same build, so no new worker installs or waits.
        expect(await readRegistrations(page)).toEqual([
            { scope: `${origin}/`, active: `${origin}/sw.js`, waiting: null, installing: null },
        ]);
        // `registerType: 'prompt'`, `skipWaiting: false`: taking control on the first install
        // (`clientsClaim`) reloads nothing, and no prompt shows without a waiting worker.
        expect(documentLoads).toBe(1);
        await expect(page.getByText(UPDATE_TOAST_TEXT)).toHaveCount(0);
    });

    test('04-2d: the hourly check runs registration.update() while online and skips it offline', async ({
        context,
        page,
    }) => {
        // The page clock still runs in real time; `fastForward` only jumps it, firing due timers.
        await page.clock.install();
        await countUpdateChecks(page);
        // Counts `offline` events. All listeners of one event run in one task, so once the count
        // rises the app's TanStack `onlineManager` (which `isNetworkUsable` reads) has handled it.
        await page.addInitScript(() => {
            const events = { offline: 0 };
            Object.defineProperty(window, '__swOfflineEvents', { value: events });
            window.addEventListener('offline', () => {
                events.offline += 1;
            });
        });
        const readOfflineEvents = (): Promise<unknown> =>
            page.evaluate((): unknown => Reflect.get(window, '__swOfflineEvents'));

        await page.goto(PRIVATE_PATH);
        await waitForControllingWorker(page, originOf(page));
        // The app has its registration once a `visible` check has started.
        await checkOnVisible(page, 0);
        await expect
            .poll(async () => {
                const checks = await readUpdateChecks(page);
                return checks.settled === checks.started;
            })
            .toBe(true);
        const before = await readUpdateChecks(page);
        expect(
            // The test reads the browser's state in the page; it cannot import the app's helper.
            // eslint-disable-next-line no-restricted-properties -- browser precondition, not app code
            await page.evaluate(() => navigator.onLine),
            'the page must be online before the hourly check (the app checks only while online)',
        ).toBe(true);
        expect(await readOfflineEvents(), 'no offline event may have reached the app').toEqual({
            offline: 0,
        });

        await page.clock.fastForward('01:00:00');

        await expect
            .poll(async () => (await readUpdateChecks(page)).started, {
                message:
                    "the hourly tick should start one update() check; none may mean the app's TanStack onlineManager considers itself offline",
            })
            .toBe(before.started + 1);

        // Offline: the next hourly tick starts no check.
        await context.setOffline(true);
        await expect.poll(readOfflineEvents).toEqual({ offline: 1 });
        const offlineBefore = await readUpdateChecks(page);

        // `fastForward` fires the due interval before it resolves.
        await page.clock.fastForward('01:00:00');

        expect((await readUpdateChecks(page)).started).toBe(offlineBefore.started);
    });
});
