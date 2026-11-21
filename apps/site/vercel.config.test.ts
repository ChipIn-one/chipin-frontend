import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getTransformedRoutes } from '@vercel/routing-utils';
import { describe, expect, test } from 'vitest';

import { APP_ROUTES } from '../app/src/app/router/routeManifest';

import { cspScriptHashes } from './integrations/seoGuard';
import { localizedPath, NON_DEFAULT_LOCALES, SUPPORTED_LOCALES } from './src/i18n/locales';

// Reads the committed, hand-written apps/site/vercel.json and evaluates it with Vercel's own
// route transformer (spec 04 §1.5a, §2.9), with the §4.2 step-2 redirects of 04-3d.
const config: unknown = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const transformed = getTransformedRoutes(config as Parameters<typeof getTransformedRoutes>[0]);

/** The fields of a transformed route this test evaluates. */
interface EvaluatedRoute {
    src?: string;
    has?: unknown[];
    headers?: Record<string, string>;
    status?: number;
}

// The package's `Route` union references types it does not ship (they resolve to error types);
// the transformer output is plain JSON with the fields above.
const routes = (transformed.routes ?? []) as unknown as EvaluatedRoute[];

type HostCondition = { type: 'host'; value: { eq?: string; suf?: string } };

const conditionMatches = (condition: unknown, host: string): boolean => {
    const { type, value } = condition as Partial<HostCondition>;

    if (type !== 'host' || typeof value !== 'object') {
        // Only host conditions are used; any other one would need its own evaluation here.
        throw new Error(`unexpected condition ${JSON.stringify(condition)}`);
    }
    if (typeof value.eq === 'string') {
        return value.eq === host;
    }
    return typeof value.suf === 'string' && host.endsWith(value.suf);
};

interface Response {
    status: number;
    location?: string;
    headers: Record<string, string>;
}

/**
 * What the routes do with a request: the first redirect wins, `continue` routes add headers.
 * Vercel substitutes the numbered capture groups (`$1`, ...) into `Location` (an unmatched optional
 * group becomes empty) and appends the request's query string to a destination that has none.
 */
const request = (url: string, host: string): Response => {
    const queryIndex = url.indexOf('?');
    const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : url.slice(queryIndex);
    const headers: Record<string, string> = {};

    for (const route of routes) {
        const match = route.src === undefined ? null : new RegExp(route.src).exec(path);

        if (match === null) {
            continue;
        }
        if (!(route.has ?? []).every(condition => conditionMatches(condition, host))) {
            continue;
        }
        if (route.status !== undefined) {
            const template = route.headers?.Location ?? '';
            const location = template.replace(
                /\$(\d+)/g,
                (_, index: string) => match[Number(index)] ?? '',
            );

            return {
                status: route.status,
                location: location.includes('?') ? location : location + query,
                headers,
            };
        }
        Object.assign(headers, route.headers);
    }
    return { status: 200, headers };
};

const PROD = 'chipin.one';
const NOINDEX_HOSTS = ['site-dev.chipin.one', 'dev.chipin.one', 'chipin-site-git-x.vercel.app'];

describe('apps/site/vercel.json', () => {
    test('is valid for Vercel', () => {
        expect(transformed.error).toBeNull();
    });

    // Release model (§1.5): Production Branch `main` never deploys; prod changes only by Promote.
    test('disables Git deployments of the main branch', () => {
        expect(config).toMatchObject({ git: { deploymentEnabled: { main: false } } });
    });

    test.each([PROD, ...NOINDEX_HOSTS])('sends the security headers on %s', host => {
        for (const path of ['/', '/ru/', '/missing']) {
            const { headers } = request(path, host);

            expect(headers['Content-Security-Policy']).toBeDefined();
            expect(headers['X-Frame-Options']).toBe('DENY');
            expect(headers['X-Content-Type-Options']).toBe('nosniff');
            expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
        }
    });

    // §3.6, A-02: base directives of the app CSP, no inline code except hashed scripts.
    test('the CSP allows only same-origin code', () => {
        const csp = request('/', PROD).headers['Content-Security-Policy'] ?? '';
        const directives = new Map(
            csp.split(';').map(part => {
                const [name = '', ...sources] = part.trim().split(/\s+/);

                return [name, sources] as const;
            }),
        );

        expect(directives.get('object-src')).toEqual(["'none'"]);
        expect(directives.get('base-uri')).toEqual(["'self'"]);
        expect(directives.get('form-action')).toEqual(["'self'"]);
        expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
        expect(directives.get('connect-src')).toEqual(["'self'"]);
        expect(directives.get('style-src')).toEqual(["'self'"]);
        expect(directives.get('script-src')).toEqual(["'self'", ...cspScriptHashes(config).sort()]);
        expect(csp).not.toMatch(/unsafe-|https?:|\*/);
    });

    // §4.3: dev and preview hosts are noindex, chipin.one is not.
    test.each(NOINDEX_HOSTS)('%s is noindex', host => {
        expect(request('/', host).headers['X-Robots-Tag']).toBe('noindex, nofollow');
        expect(request('/ru/', host).headers['X-Robots-Tag']).toBe('noindex, nofollow');
    });

    test.each([PROD, 'www.chipin.one', 'app.chipin.one', 'evil-dev.chipin.one.example'])(
        '%s has no X-Robots-Tag',
        host => {
            expect(request('/', host).headers['X-Robots-Tag']).toBeUndefined();
        },
    );

    // §3.2: one URL form per page.
    test.each(NON_DEFAULT_LOCALES.map(locale => [`/${locale}`, `/${locale}/`]))(
        '%s is a 301 to %s',
        (path, location) => {
            expect(request(path, PROD)).toMatchObject({ status: 301, location });
        },
    );

    test.each(['/', '/ru/', '/sitemap-index.xml', '/robots.txt', '/rus', '/ru/x'])(
        '%s is not redirected',
        path => {
            expect(request(path, PROD).status).toBe(200);
        },
    );
});

// ---- 04-3d: the compatibility layer for chipin.one (spec 04 §2.9, §3.6, §4.2 step 2) ----

const SITE_DIR = fileURLToPath(new URL('.', import.meta.url));

interface Redirect {
    source: string;
    destination: string;
    statusCode?: number;
    has?: HostCondition[];
}

const redirects = (config as { redirects?: Redirect[] }).redirects ?? [];

/** The app origin of each site host's environment (§4.2 step 2). */
const SITE_HOST_APP_ORIGINS: Record<string, string> = {
    'chipin.one': 'https://app.chipin.one',
    'dev.chipin.one': 'https://app-dev.chipin.one',
    'site-dev.chipin.one': 'https://app-dev.chipin.one',
};
const SITE_HOSTS = Object.keys(SITE_HOST_APP_ORIGINS);
const APP_ORIGINS = [...new Set(Object.values(SITE_HOST_APP_ORIGINS))];
// The site preview and hosts that never belong to the site: only the host-agnostic rows apply.
const OTHER_HOSTS = [
    'chipin-site-git-x.vercel.app',
    'app.chipin.one',
    'app-dev.chipin.one',
    'www.chipin.one',
    'evil.example',
    'chipin.one.evil.example',
];
const ALL_HOSTS = [...SITE_HOSTS, ...OTHER_HOSTS];

// Invite tokens are base64url (backend InviteTokenGenerator), as the app's TEST_INVITE_TOKEN.
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const PARAM_VALUES: Record<string, string> = {
    groupId: '0b6f6a9e-3c1d-4f2a-9b7e-5d8c2a1f4e3b',
    parentActivityId: '7d2e9c4a-1b3f-4e5d-8a6c-9f0b1e2d3c4a',
    inviteToken: TOKEN,
};

const substituteParams = (path: string): string =>
    path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
        const value = PARAM_VALUES[name];

        if (value === undefined) {
            throw new Error(`No test value for the route parameter :${name}`);
        }
        return value;
    });

const legacyPaths = APP_ROUTES.flatMap(route => route.legacyPaths.map(substituteParams));
const hostsOf = (redirect: Redirect): string[] =>
    (redirect.has ?? []).flatMap(condition => (condition.value.eq ? [condition.value.eq] : []));
const isAppRedirect = (redirect: Redirect): boolean =>
    APP_ORIGINS.some(origin => redirect.destination.startsWith(`${origin}/`));
// The removed public locales (#609): a permanent rule of the site project (§4.2), as in the app.
const isRemovedLocaleRedirect = (redirect: Redirect): boolean =>
    redirect.source.startsWith('/:locale(');

/** Site files a redirect must never shadow: a Vercel redirect fires before a file (§4.1). */
const listFiles = (dir: string): string[] =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => `/${relative(dir, join(entry.parentPath, entry.name))}`);

describe('step-2 redirects of old app URLs (§4.2, §2.9)', () => {
    test('the manifest has legacy paths to check', () => {
        expect(legacyPaths.length).toBeGreaterThan(0);
    });

    test.each(SITE_HOSTS.flatMap(host => legacyPaths.map(path => [host, path])))(
        'on %s redirects the legacy path %s to the app origin with 302',
        (host, path) => {
            expect(request(path, host)).toMatchObject({
                status: 302,
                location: `${SITE_HOST_APP_ORIGINS[host]}${path}`,
            });
        },
    );

    test.each(SITE_HOSTS)('on %s keeps the path and the query of the OAuth callback', host => {
        const url = '/oauth/callback?code=x&returnTo=%2Fgroup%2F1';

        expect(request(url, host)).toMatchObject({
            status: 302,
            location: `${SITE_HOST_APP_ORIGINS[host]}${url}`,
        });
    });

    test.each(SITE_HOSTS)('on %s redirects deeper app paths and bare prefixes', host => {
        for (const path of ['/dashboard/x', '/solo/', '/group', '/friends/1', '/settings/a/b']) {
            expect(request(path, host).location).toBe(`${SITE_HOST_APP_ORIGINS[host]}${path}`);
        }
    });

    test('the app redirects run on exactly the site hosts, one row per host', () => {
        const appRedirects = redirects.filter(isAppRedirect);

        expect(appRedirects.flatMap(hostsOf).sort()).toEqual([...SITE_HOSTS].sort());
        for (const redirect of appRedirects) {
            const [host = ''] = hostsOf(redirect);

            expect(redirect.has).toHaveLength(1);
            expect(redirect.destination).toBe(`${SITE_HOST_APP_ORIGINS[host]}/:path`);
        }
    });

    // No redirect points outside the manifest or the site: the app rows name exactly the first
    // segments of the manifest legacy paths, every other row stays on the site.
    test('app redirects cover exactly the manifest legacy prefixes', () => {
        const manifestPrefixes = [
            ...new Set(legacyPaths.map(path => path.split('/')[1] ?? '')),
        ].sort();

        for (const redirect of redirects.filter(isAppRedirect)) {
            const prefixes = /^\/:path\(\(\?:([a-z|-]+)\)\(\?:\/\.\*\)\?\)$/.exec(redirect.source);

            expect(prefixes?.[1]?.split('|').sort()).toEqual(manifestPrefixes);
        }
    });

    test('every other redirect stays on the site', () => {
        for (const redirect of redirects.filter(row => !isAppRedirect(row))) {
            expect(redirect.destination).toMatch(/^\/(?![/\\])/);
        }
    });

    test.each(ALL_HOSTS)('on %s sends old invite links to the site landing', host => {
        expect(request(`/group/join/${TOKEN}`, host)).toMatchObject({
            status: 302,
            location: `/join/group/${TOKEN}`,
        });
        expect(request(`/friends/join/${TOKEN}`, host)).toMatchObject({
            status: 302,
            location: `/join/friend/${TOKEN}`,
        });
    });

    test('the join rows come before the /group and /friends rows', () => {
        const index = (predicate: (redirect: Redirect) => boolean) =>
            redirects.findIndex(predicate);
        const lastJoin = Math.max(
            index(redirect => redirect.source === '/group/join/:token'),
            index(redirect => redirect.source === '/friends/join/:token'),
        );
        const firstApp = index(isAppRedirect);

        expect(index(redirect => redirect.source === '/group/join/:token')).toBeGreaterThanOrEqual(
            0,
        );
        expect(
            index(redirect => redirect.source === '/friends/join/:token'),
        ).toBeGreaterThanOrEqual(0);
        expect(lastJoin).toBeLessThan(firstApp);
    });

    test.each([
        ['/sitemap.xml', '/sitemap-index.xml'],
        ['/index.html', '/'],
        ['/app.html', '/'],
        ['/es', '/'],
        ['/es/privacy', '/privacy'],
        ['/pt-br/', '/'],
        ['/pt-PT/terms/', '/terms'],
    ])('on every host %s redirects to %s', (path, location) => {
        for (const host of ALL_HOSTS) {
            expect(request(path, host).location).toBe(location);
        }
    });

    // 302 until 04-5a: a 301 would be cached and break a step-2 rollback (§4.2). Only the removed
    // locales (#609) and the trailing-slash rows (§3.2) are permanent.
    test('every step-2 redirect is a 302', () => {
        const permanent = redirects.filter(redirect => redirect.statusCode !== 302);

        expect(redirects.length).toBeGreaterThan(permanent.length);
        for (const redirect of permanent) {
            expect(redirect.statusCode).toBe(301);
            expect(redirect.has).toBeUndefined();
        }
        expect(permanent.filter(isRemovedLocaleRedirect)).toHaveLength(1);
    });

    // §3.2: `/<locale>` → `/<locale>/` for locale homes and `/<page>/` → `/<page>` for other pages.
    test('the trailing-slash 301 rows are LOCALE_PATH × pages', () => {
        const pageFiles = readdirSync(join(SITE_DIR, 'src/pages')).filter(
            file => file.endsWith('.astro') && file !== '404.astro',
        );
        const slugs = pageFiles.map(file => file.replace(/\.astro$/, '').replace(/^index$/, ''));
        const expected = SUPPORTED_LOCALES.flatMap(locale =>
            slugs.flatMap(slug => {
                const path = localizedPath(locale, slug);

                if (path === '/') {
                    return [];
                }
                return slug === ''
                    ? [{ source: path.slice(0, -1), destination: path }]
                    : [{ source: `${path}/`, destination: path }];
            }),
        );
        const trailingSlashRows = redirects
            .filter(redirect => redirect.statusCode === 301 && !isRemovedLocaleRedirect(redirect))
            .map(({ source, destination }) => ({ source, destination }));

        expect(slugs).toContain('');
        expect(trailingSlashRows).toEqual(expected);
    });
});

describe('paths the site never redirects (§4.2)', () => {
    const NEVER_REDIRECTED = [
        '/',
        '/privacy',
        '/terms',
        '/ru/',
        '/ru/privacy',
        '/ru/terms',
        '/api/stats',
        '/sw.js',
        '/.well-known/assetlinks.json',
        '/_astro/index.Ab12Cd34.css',
        '/_astro/hoisted.Ab12Cd34.js',
        '/_vercel/insights/script.js',
        '/_vercel/speed-insights/script.js',
        '/favicon.svg',
        '/favicon.ico',
        '/robots.txt',
        '/not-found',
        '/manifest.webmanifest',
        '/pwa-192x192.png',
        '/pwa-512x512.png',
        '/sitemap-index.xml',
        `/join/group/${TOKEN}`,
        `/join/friend/${TOKEN}`,
    ];

    test.each(ALL_HOSTS)('on %s none of them is redirected', host => {
        for (const path of NEVER_REDIRECTED) {
            expect([path, request(path, host).status]).toEqual([path, 200]);
        }
    });

    // A Vercel redirect fires before a file (§4.1; C1-19, C3-11): no source may shadow a site
    // file. HTML entries are excluded: `/index.html` and `/<page>/index.html` are intended (A-33).
    test.each(ALL_HOSTS)('on %s no redirect shadows a public or emitted file', host => {
        const dist = join(SITE_DIR, 'dist');
        const built = existsSync(join(dist, 'index.html'));
        // CI builds the site before its tests (frontend-ci.yml), so a missing dist there is a bug.
        expect(built || process.env.CI !== 'true').toBe(true);
        const files = [
            ...listFiles(join(SITE_DIR, 'public')),
            ...(built ? listFiles(dist) : []),
        ].filter(file => !file.endsWith('.html'));

        expect(files).toContain('/sw.js');
        expect(files).toContain('/.well-known/assetlinks.json');
        for (const file of files) {
            expect([file, request(file, host).status]).toEqual([file, 200]);
        }
    });

    test.each(OTHER_HOSTS)('on %s no old app path leaves the site', host => {
        for (const path of [...legacyPaths, '/oauth/callback?code=x', '/dashboard/x']) {
            expect([path, request(path, host).status]).toEqual([path, 200]);
        }
    });

    // Host-agnostic rows only normalize site URLs (§3.2, A-33, #609) and send old invite links to
    // the site landing; they are safe on the site preview, which gets no app redirects.
    test('the host-agnostic rows are the same-site ones', () => {
        expect(
            redirects.filter(redirect => redirect.has === undefined).map(({ source }) => source),
        ).toEqual([
            '/group/join/:token',
            '/friends/join/:token',
            '/sitemap.xml',
            '/index.html',
            '/app.html',
            '/:path([^/\\\\].*?)/index.html',
            '/:locale(es|pt-br|pt-pt|pt-BR|pt-PT){/:path([^/\\\\].*?)}?{/}?',
            // The trailing-slash 301 rows, pinned by "the trailing-slash 301 rows are LOCALE_PATH × pages".
            ...redirects
                .filter(
                    redirect => redirect.statusCode === 301 && !isRemovedLocaleRedirect(redirect),
                )
                .map(({ source }) => source),
        ]);
    });
});

describe('no open redirect', () => {
    const CRAFTED = [
        '/dashboard//evil.example',
        '/dashboard/@evil.example',
        '/oauth/callback?returnTo=https://evil.example',
        '/group/join/%2F%2Fevil.example',
        '/friends/join/%5C%5Cevil.example',
        '//evil.example/index.html',
        '/%2F%2Fevil.example/index.html',
        '/es//evil.example',
        '/es/%2F%2Fevil.example',
        '/ru?x=//evil.example',
        '/es/%5Cevil.example',
        '/es/\\evil.example',
        '/%5Cevil.example/index.html',
        '/\\evil.example/index.html',
    ];

    test.each(ALL_HOSTS)('on %s every Location is a fixed origin or a same-site path', host => {
        for (const url of CRAFTED) {
            const { status, location } = request(url, host);

            if (status === 200) {
                continue;
            }
            const sameSite = location !== undefined && /^\/(?![/\\])/.test(location);
            const appOrigin = APP_ORIGINS.some(origin => location?.startsWith(`${origin}/`));

            expect([url, sameSite || appOrigin]).toEqual([url, true]);
        }
    });
});

describe('kill-switch and assetlinks (§3.6, §4.6)', () => {
    test.each(ALL_HOSTS)('on %s /sw.js is served with Cache-Control: no-cache', host => {
        expect(request('/sw.js', host)).toMatchObject({
            status: 200,
            headers: { 'Cache-Control': 'no-cache' },
        });
    });

    test('pages are not sent with the kill-switch Cache-Control', () => {
        expect(request('/', PROD).headers['Cache-Control']).toBeUndefined();
    });

    test('the site assetlinks.json is byte-identical to the app one', () => {
        const site = readFileSync(join(SITE_DIR, 'public/.well-known/assetlinks.json'));
        const app = readFileSync(join(SITE_DIR, '../app/public/.well-known/assetlinks.json'));

        expect(site.equals(app)).toBe(true);
    });
});
