import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The entry `root.tsx` (tested here, in the composition root): importing it boots the page. Every
// branch it can take is mocked, so the test sees only which one it picks for a host and a path.
const boot = vi.hoisted(() => ({
    createRoot: vi.fn(() => ({ render: vi.fn() })),
    hydrateRoot: vi.fn(),
    startCacheRestore: vi.fn(),
    syncHtmlLang: vi.fn(),
    i18n: { changeLanguage: () => Promise.resolve() },
}));

vi.mock('react-dom/client', () => ({
    createRoot: boot.createRoot,
    hydrateRoot: boot.hydrateRoot,
}));
vi.mock('main', () => ({ default: () => null }));
vi.mock('shared/offline/restore', () => ({ startCacheRestore: boot.startCacheRestore }));
vi.mock('public-routes', () => ({ PublicApp: () => null }));
vi.mock('bootstrap/initializeApi', () => ({ initializeApi: vi.fn() }));
vi.mock('bootstrap/initializeSentry', () => ({ initializeSentry: vi.fn() }));
vi.mock('i18n', () => ({ default: boot.i18n }));
vi.mock('i18n/htmlLang', () => ({ syncHtmlLang: boot.syncHtmlLang }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }));
vi.mock('basics/PWABadge', () => ({ default: () => null }));
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
});

// M1 of the 04-4a2 review (spec 04 §4.1, §4.5 step 1): no path on a legacy host boots the full app
// (no session check, no refresh, no `Set-Cookie` there); the same URL opens on the app host.
test.each([
    [
        'https://chipin.one/index.html?utm_source=x#top',
        'https://app.chipin.one/index.html?utm_source=x#top',
    ],
    ['https://chipin.one/privacy//', 'https://app.chipin.one/privacy//'],
    ['https://dev.chipin.one/ru/index.html', 'https://app-dev.chipin.one/ru/index.html'],
])('on a legacy host the app branch of %s goes to %s and mounts nothing', async (url, target) => {
    const replace = await bootOn(url, { publicSsg: true });

    expect(replace).toHaveBeenCalledExactlyOnceWith(target);
    // Give a dynamic import of either branch the time to resolve, had one started.
    await new Promise(resolve => {
        setTimeout(resolve, 20);
    });
    expect(boot.startCacheRestore).not.toHaveBeenCalled();
    expect(boot.createRoot).not.toHaveBeenCalled();
    expect(boot.hydrateRoot).not.toHaveBeenCalled();
});

test('on a legacy host the plain SPA shell at an unknown path goes to the app host', async () => {
    const replace = await bootOn('https://chipin.one/estonia', { publicSsg: false });

    expect(replace).toHaveBeenCalledExactlyOnceWith('https://app.chipin.one/estonia');
    await new Promise(resolve => {
        setTimeout(resolve, 20);
    });
    expect(boot.startCacheRestore).not.toHaveBeenCalled();
    expect(boot.createRoot).not.toHaveBeenCalled();
});

test('on a legacy host a known public page hydrates as before', async () => {
    const replace = await bootOn('https://chipin.one/privacy', { publicSsg: true });

    await vi.waitFor(() => {
        expect(boot.hydrateRoot).toHaveBeenCalledOnce();
    });
    expect(replace).not.toHaveBeenCalled();
    expect(boot.createRoot).not.toHaveBeenCalled();
});

test.each([
    'https://app.chipin.one/dashboard',
    'https://app-dev.chipin.one/index.html',
    'https://chipin-git-x.vercel.app/group/1',
    'http://localhost/settings',
])('on %s the app branch mounts the app as before', async url => {
    const replace = await bootOn(url, { publicSsg: false });

    await vi.waitFor(() => {
        expect(boot.createRoot).toHaveBeenCalledOnce();
    });
    expect(boot.startCacheRestore).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
});

// #708: `<html lang>` follows the i18next language from the boot on, on the app and public pages.
test.each([
    ['https://app.chipin.one/settings', false],
    ['https://app.chipin.one/ru/privacy', true],
])('the boot of %s keeps the html lang in step with i18next', async (url, publicSsg) => {
    await bootOn(url, { publicSsg });

    expect(boot.syncHtmlLang).toHaveBeenCalledExactlyOnceWith(boot.i18n);
});
