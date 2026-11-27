import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The entry `root.tsx` (tested here, in the composition root): importing it boots the page. Every
// branch it can take is mocked, so the test sees only which one it picks for a host and a path.
const boot = vi.hoisted(() => ({
    createRoot: vi.fn(() => ({ render: vi.fn() })),
    hydrateRoot: vi.fn(),
    startCacheRestore: vi.fn(),
    startExpenseDraftReload: vi.fn(),
    syncHtmlLang: vi.fn(),
    i18n: {},
    // What the i18n init promise does in a test; a rejection is set per test.
    i18nReady: () => Promise.resolve(),
    captureException: vi.fn(),
    applyLanguage: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-dom/client', () => ({
    createRoot: boot.createRoot,
    hydrateRoot: boot.hydrateRoot,
}));
vi.mock('main', () => ({ Main: () => null }));
vi.mock('shared/offline/restore', () => ({ startCacheRestore: boot.startCacheRestore }));
vi.mock('public-routes', () => ({ PublicApp: () => null }));
vi.mock('bootstrap/initializeApi', () => ({ initializeApi: vi.fn() }));
vi.mock('bootstrap/initializeSentry', () => ({ initializeSentry: vi.fn() }));
vi.mock('i18n', () => ({
    i18n: boot.i18n,
    // Read on each boot: `root.tsx` is imported afresh per test.
    get i18nReady() {
        return boot.i18nReady();
    },
}));
vi.mock('@sentry/react', async importOriginal => ({
    ...(await importOriginal<typeof import('@sentry/react')>()),
    captureException: boot.captureException,
}));
vi.mock('helpers/setAppLanguage', () => ({ applyLanguage: boot.applyLanguage }));
vi.mock('i18n/htmlLang', () => ({ syncHtmlLang: boot.syncHtmlLang }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }));
vi.mock('app/pwa/ServiceWorkerManager', () => ({ ServiceWorkerManager: () => null }));
vi.mock('app/pwa/expenseDraftReload', () => ({
    startExpenseDraftReload: boot.startExpenseDraftReload,
}));
vi.mock('styles/index.css', () => ({}));

const bootOn = async (
    url: string,
    { publicSsg }: { publicSsg: boolean },
): Promise<ReturnType<typeof vi.fn>> => {
    const { hostname, pathname, search, hash } = new URL(url);
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, hostname, pathname, search, hash, replace });
    document.body.innerHTML = publicSsg
        ? '<div id="root" data-public-ssg="true"></div>'
        : '<div id="root"></div>';

    await import('../root');
    return replace;
};

beforeEach(() => {
    vi.resetModules();
    // The API client resolves its environment when imported; a build always sets it.
    vi.stubEnv('VITE_CHIPIN_ENV', 'prod');
});
afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
});

test.each([
    'https://app.chipin.one/dashboard',
    'https://app-dev.chipin.one/index.html',
    'https://chipin-git-x.vercel.app/group/1',
    'http://localhost/settings',
])('on %s the app branch mounts the app', async url => {
    const replace = await bootOn(url, { publicSsg: false });

    await vi.waitFor(() => {
        expect(boot.createRoot).toHaveBeenCalledOnce();
    });
    expect(boot.startCacheRestore).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
});

// Spec 04 §2.10: the locale chunks are lazy; a public page hydrates only once its route language
// is loaded and applied (not saved as the user's preference).
test('a public page hydrates after its route language is applied', async () => {
    await bootOn('https://app.chipin.one/ru/privacy', { publicSsg: true });

    await vi.waitFor(() => {
        expect(boot.hydrateRoot).toHaveBeenCalledOnce();
    });
    expect(boot.applyLanguage).toHaveBeenCalledExactlyOnceWith('ru');
    expect(boot.applyLanguage.mock.invocationCallOrder[0]).toBeLessThan(
        boot.hydrateRoot.mock.invocationCallOrder[0] ?? 0,
    );
});

// R1 L4: the first render waits for the initial language's lazy chunks, so it never shows raw keys.
test.each([
    ['https://app.chipin.one/dashboard', false],
    ['https://app.chipin.one/ru/privacy', true],
])('%s renders only after the i18n init settles', async (url, publicSsg) => {
    let settle: () => void = () => undefined;
    boot.i18nReady = () =>
        new Promise<void>(resolve => {
            settle = resolve;
        });
    const mount = publicSsg ? boot.hydrateRoot : boot.createRoot;

    try {
        await bootOn(url, { publicSsg });
        // Every other step of the boot (dynamic imports, the cache restore) has had its time.
        await new Promise(resolve => {
            setTimeout(resolve, 20);
        });
        expect(mount).not.toHaveBeenCalled();

        settle();
        await vi.waitFor(() => {
            expect(mount).toHaveBeenCalledOnce();
        });
    } finally {
        boot.i18nReady = () => Promise.resolve();
    }
});

// R2-M1: a prerendered page whose route language fails to load still hydrates.
test('a public page hydrates when its route language fails to load', async () => {
    const error = new Error('Locale ru not loaded');
    boot.applyLanguage.mockRejectedValueOnce(error);

    await bootOn('https://app.chipin.one/ru/privacy', { publicSsg: true });

    await vi.waitFor(() => {
        expect(boot.hydrateRoot).toHaveBeenCalledOnce();
    });
    expect(boot.captureException).toHaveBeenCalledWith(error);
});

// A failed i18n init never leaves a blank page: the app mounts and the public page hydrates anyway.
test.each([
    ['https://app.chipin.one/dashboard', false],
    ['https://app.chipin.one/ru/privacy', true],
])('%s still renders when the i18n init rejects', async (url, publicSsg) => {
    const error = new Error('locale chunk failed');
    boot.i18nReady = () => Promise.reject(error);

    try {
        await bootOn(url, { publicSsg });

        await vi.waitFor(() => {
            expect(publicSsg ? boot.hydrateRoot : boot.createRoot).toHaveBeenCalledOnce();
        });
        expect(boot.captureException).toHaveBeenCalledWith(error);
    } finally {
        boot.i18nReady = () => Promise.resolve();
    }
});

// #708: `<html lang>` follows the i18next language from the boot on, on the app and public pages.
test.each([
    ['https://app.chipin.one/settings', false],
    ['https://app.chipin.one/ru/privacy', true],
])('the boot of %s keeps the html lang in step with i18next', async (url, publicSsg) => {
    await bootOn(url, { publicSsg });

    expect(boot.syncHtmlLang).toHaveBeenCalledExactlyOnceWith(boot.i18n);
});

// Spec 04 §2.11 item 4 (04-2d): the app branch restores a draft saved before a reload and registers
// its save; the public pages have no expense modal and never touch it.
test('the app branch starts the expense draft reload before it renders, the public branch does not', async () => {
    await bootOn('https://app.chipin.one/dashboard', { publicSsg: false });

    await vi.waitFor(() => {
        expect(boot.createRoot).toHaveBeenCalledOnce();
    });
    expect(boot.startExpenseDraftReload).toHaveBeenCalledOnce();

    vi.resetModules();
    boot.startExpenseDraftReload.mockClear();
    await bootOn('https://app.chipin.one/ru/privacy', { publicSsg: true });

    await vi.waitFor(() => {
        expect(boot.hydrateRoot).toHaveBeenCalledOnce();
    });
    expect(boot.startExpenseDraftReload).not.toHaveBeenCalled();
});
