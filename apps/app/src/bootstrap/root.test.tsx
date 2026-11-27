import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The entry `root.tsx` (tested here, in the composition root): importing it boots the page. Its
// dependencies are mocked, so the test sees only how it mounts the app.
const boot = vi.hoisted(() => ({
    createRoot: vi.fn(() => ({ render: vi.fn() })),
    startCacheRestore: vi.fn(),
    startExpenseDraftReload: vi.fn(),
    syncHtmlLang: vi.fn(),
    i18n: {},
    // What the i18n init promise does in a test; a rejection is set per test.
    i18nReady: () => Promise.resolve(),
    captureException: vi.fn(),
}));

vi.mock('react-dom/client', () => ({ createRoot: boot.createRoot }));
vi.mock('main', () => ({ Main: () => null }));
vi.mock('shared/offline/restore', () => ({ startCacheRestore: boot.startCacheRestore }));
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
vi.mock('i18n/htmlLang', () => ({ syncHtmlLang: boot.syncHtmlLang }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }));
vi.mock('app/pwa/ServiceWorkerManager', () => ({ ServiceWorkerManager: () => null }));
vi.mock('app/pwa/expenseDraftReload', () => ({
    startExpenseDraftReload: boot.startExpenseDraftReload,
}));
vi.mock('styles/index.css', () => ({}));

const bootOn = async (url: string): Promise<ReturnType<typeof vi.fn>> => {
    const { hostname, pathname, search, hash } = new URL(url);
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, hostname, pathname, search, hash, replace });
    document.body.innerHTML = '<div id="root"></div>';

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
    'https://app.chipin.one/',
    'https://app.chipin.one/dashboard',
    'https://app-dev.chipin.one/index.html',
    'https://chipin-git-x.vercel.app/group/1',
    'http://localhost/settings',
])('on %s the app mounts', async url => {
    const replace = await bootOn(url);

    await vi.waitFor(() => {
        expect(boot.createRoot).toHaveBeenCalledOnce();
    });
    expect(boot.startCacheRestore).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
});

// R1 L4: the first render waits for the initial language's lazy chunks, so it never shows raw keys.
test('the app renders only after the i18n init settles', async () => {
    let settle: () => void = () => undefined;
    boot.i18nReady = () =>
        new Promise<void>(resolve => {
            settle = resolve;
        });

    try {
        await bootOn('https://app.chipin.one/dashboard');
        // Every other step of the boot (dynamic imports, the cache restore) has had its time.
        await new Promise(resolve => {
            setTimeout(resolve, 20);
        });
        expect(boot.createRoot).not.toHaveBeenCalled();

        settle();
        await vi.waitFor(() => {
            expect(boot.createRoot).toHaveBeenCalledOnce();
        });
    } finally {
        boot.i18nReady = () => Promise.resolve();
    }
});

// A failed i18n init never leaves a blank page: the app mounts anyway.
test('the app still renders when the i18n init rejects', async () => {
    const error = new Error('locale chunk failed');
    boot.i18nReady = () => Promise.reject(error);

    try {
        await bootOn('https://app.chipin.one/dashboard');

        await vi.waitFor(() => {
            expect(boot.createRoot).toHaveBeenCalledOnce();
        });
        expect(boot.captureException).toHaveBeenCalledWith(error);
    } finally {
        boot.i18nReady = () => Promise.resolve();
    }
});

// #708: `<html lang>` follows the i18next language from the boot on.
test('the boot keeps the html lang in step with i18next', async () => {
    await bootOn('https://app.chipin.one/settings');

    expect(boot.syncHtmlLang).toHaveBeenCalledExactlyOnceWith(boot.i18n);
});

// Spec 04 §2.11 item 4 (04-2d): the boot restores a draft saved before a reload and registers its
// save.
test('the boot starts the expense draft reload before it renders', async () => {
    await bootOn('https://app.chipin.one/dashboard');

    await vi.waitFor(() => {
        expect(boot.createRoot).toHaveBeenCalledOnce();
    });
    expect(boot.startExpenseDraftReload).toHaveBeenCalledOnce();
    expect(boot.startExpenseDraftReload.mock.invocationCallOrder[0]).toBeLessThan(
        boot.createRoot.mock.invocationCallOrder[0] ?? 0,
    );
});
