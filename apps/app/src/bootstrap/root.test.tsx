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
    { publicSsg, standalone = false }: { publicSsg: boolean; standalone?: boolean },
): Promise<ReturnType<typeof vi.fn>> => {
    const { hostname, pathname, search, hash } = new URL(url);
    const replace = vi.fn();
    vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
            matches: standalone && query === '(display-mode: standalone)',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    );
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

// #758: the shared HTML loses its web-app head on a legacy host before anything renders.
const WEB_APP_HEAD = `
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="manifest" href="/manifest.webmanifest">
`;
const WEB_APP_SELECTOR =
    'link[rel="manifest"], meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-status-bar-style"]';

test.each(['https://chipin.one/', 'https://dev.chipin.one/ru/'])(
    'booting %s strips the manifest links and the web-app metas, keeping the icon',
    async url => {
        document.head.innerHTML = WEB_APP_HEAD;

        await bootOn(url, { publicSsg: true });

        expect(document.head.querySelectorAll(WEB_APP_SELECTOR)).toHaveLength(0);
        expect(document.head.querySelector('link[rel="apple-touch-icon"]')).not.toBeNull();
    },
);

test.each(['https://app.chipin.one/', 'https://chipin-git-x.vercel.app/'])(
    'booting %s keeps the manifest links and the web-app metas',
    async url => {
        document.head.innerHTML = WEB_APP_HEAD;

        await bootOn(url, { publicSsg: true });

        expect(document.head.querySelectorAll(WEB_APP_SELECTOR)).toHaveLength(4);
    },
);

// #758: an icon installed from a legacy host never opens the app host (an in-app sheet); the SPA
// shell there goes to the landing of the same host, which shows the reinstall notice.
test.each(['https://chipin.one/estonia', 'https://dev.chipin.one/index.html?a=1'])(
    'in standalone mode the app branch of %s goes to / on the same host',
    async url => {
        const replace = await bootOn(url, { publicSsg: false, standalone: true });

        expect(replace).toHaveBeenCalledExactlyOnceWith('/');
        await new Promise(resolve => {
            setTimeout(resolve, 20);
        });
        expect(boot.createRoot).not.toHaveBeenCalled();
        expect(boot.hydrateRoot).not.toHaveBeenCalled();
    },
);

test('in standalone mode the SPA shell at / of a legacy host neither loops nor boots', async () => {
    const replace = await bootOn('https://chipin.one/', { publicSsg: false, standalone: true });

    await new Promise(resolve => {
        setTimeout(resolve, 20);
    });
    expect(replace).not.toHaveBeenCalled();
    expect(boot.createRoot).not.toHaveBeenCalled();
    expect(boot.startCacheRestore).not.toHaveBeenCalled();
});

test('in a browser tab the app branch of a legacy host still goes to the app host', async () => {
    const replace = await bootOn('https://chipin.one/estonia', { publicSsg: false });

    expect(replace).toHaveBeenCalledExactlyOnceWith('https://app.chipin.one/estonia');
});

test.each(['https://app.chipin.one/dashboard', 'https://chipin-git-x.vercel.app/group/1'])(
    'in standalone mode %s mounts the app as before',
    async url => {
        const replace = await bootOn(url, { publicSsg: false, standalone: true });

        await vi.waitFor(() => {
            expect(boot.createRoot).toHaveBeenCalledOnce();
        });
        expect(replace).not.toHaveBeenCalled();
    },
);
