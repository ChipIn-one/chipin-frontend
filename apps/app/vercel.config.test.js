import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { THEME_INIT_SCRIPT_SHA256 } from '@chipin/tokens/theme-init';
import { getTransformedRoutes } from '@vercel/routing-utils';
import { describe, expect, test } from 'vitest';

import { PRIVATE_SPA_NAVIGATION_ALLOWLIST } from './scripts/private-spa-navigation.ts';
import { APP_ROUTES } from './src/app/router/routeManifest.ts';
import { LOCALE_PREFIX } from './src/constants/publicRouteManifest.ts';
import { INVITE_TOKEN_PATTERN } from './src/helpers/inviteToken.ts';
import { TEST_INVITE_TOKEN } from './src/test/fixtures/inviteToken.ts';

const API_SOURCE = '/api/:path*';
const config = JSON.parse(readFileSync(resolve(import.meta.dirname, 'vercel.json'), 'utf8'));
const DIST = resolve(import.meta.dirname, 'dist');

const apiRewrites = config.rewrites.filter(rewrite => rewrite.source === API_SOURCE);

// A host condition is `{ eq: host }` (exact match) or `{ suf: '.vercel.app' }` (previews). A plain
// string value is a regex-like string that Vercel does not document as anchored, so the config must
// not use one for a host (L1 of the 04-4a2 review): `chipin.one` must never match `app.chipin.one`.
const hostConditionMatches = (condition, host) => {
    if (condition.type !== 'host' || !condition.value || typeof condition.value !== 'object') {
        return false;
    }

    if (typeof condition.value.eq === 'string') {
        return condition.value.eq === host;
    }

    return typeof condition.value.suf === 'string' && host.endsWith(condition.value.suf);
};

const resolveApiDestination = host => {
    for (const rewrite of apiRewrites) {
        const hostCondition = rewrite.has?.find(condition => condition.type === 'host');

        if (!hostCondition) {
            continue;
        }

        if (hostConditionMatches(hostCondition, host)) {
            return rewrite.destination;
        }
    }

    return undefined;
};

// The old hosts `chipin.one` and `dev.chipin.one` belong to the site; 04-5a removed every app rule
// for them.
const OLD_HOSTS = ['chipin.one', 'dev.chipin.one'];

describe('Vercel API proxy routing', () => {
    test.each(OLD_HOSTS)('does not route the old host %s to any backend', host => {
        expect(resolveApiDestination(host)).toBeUndefined();
    });

    test('routes the production app host only to the production API', () => {
        expect(resolveApiDestination('app.chipin.one')).toBe('https://api.chipin.one/:path*');
    });

    test('routes the development app host to the development API', () => {
        expect(resolveApiDestination('app-dev.chipin.one')).toBe(
            'https://api-dev.chipin.one/:path*',
        );
    });

    test('routes Vercel preview hostnames to the development API', () => {
        expect(resolveApiDestination('chipin-git-feature-123.vercel.app')).toBe(
            'https://api-dev.chipin.one/:path*',
        );
    });

    test('routes generated Vercel production hostnames to the development API', () => {
        expect(resolveApiDestination('chipin-frontend.vercel.app')).toBe(
            'https://api-dev.chipin.one/:path*',
        );
    });

    test('does not route unsupported custom subdomains to any backend', () => {
        expect(resolveApiDestination('issue-199.dev.chipin.one')).toBeUndefined();
    });

    test('does not route an unknown hostname to any backend', () => {
        expect(resolveApiDestination('example.com')).toBeUndefined();
        expect(apiRewrites.every(rewrite => rewrite.has?.length > 0)).toBe(true);
    });

    test('keeps API rewrites before private SPA routes without capturing public SSG HTML', () => {
        const lastApiRewriteIndex = config.rewrites.reduce(
            (lastIndex, rewrite, index) => (rewrite.source === API_SOURCE ? index : lastIndex),
            -1,
        );
        const appRewrites = config.rewrites
            .map((rewrite, index) => ({ ...rewrite, index }))
            .filter(rewrite => rewrite.destination === '/app.html');

        expect(lastApiRewriteIndex).toBeGreaterThanOrEqual(0);
        expect(appRewrites.length).toBeGreaterThan(0);
        expect(appRewrites.every(rewrite => rewrite.index > lastApiRewriteIndex)).toBe(true);
    });

    test('disables browser and CDN caching for proxied API responses', () => {
        const apiHeadersRule = config.headers.find(rule => rule.source === API_SOURCE);
        const headers = Object.fromEntries(
            apiHeadersRule.headers.map(header => [header.key, header.value]),
        );

        expect(headers['Cache-Control']).toBe('private, no-store, max-age=0');
        expect(headers['CDN-Cache-Control']).toBe('no-store');
        expect(headers['Vercel-CDN-Cache-Control']).toBe('no-store');
        expect(headers['X-Vercel-Enable-Rewrite-Caching']).toBe('0');
    });

    test('disables automatic Vercel Git deployments only for dev and main', () => {
        expect(config.git?.deploymentEnabled).toEqual({ dev: false, main: false });
    });
});

describe('Vercel production security headers', () => {
    test('keeps script-src free of unsafe-inline while preserving connect-src', () => {
        const appHeadersRule = config.headers.find(rule => rule.source === '/(.*)');
        const headers = Object.fromEntries(
            appHeadersRule.headers.map(header => [header.key, header.value]),
        );
        const directives = Object.fromEntries(
            headers['Content-Security-Policy']
                .split(';')
                .map(directive => directive.trim())
                .filter(Boolean)
                .map(directive => {
                    const [name, ...values] = directive.split(/\s+/);
                    return [name, values.join(' ')];
                }),
        );

        // The one inline script allowed: the anti-FOUC theme script of app.html (spec 05 §2).
        expect(directives['script-src']).toBe(`'self' '${THEME_INIT_SCRIPT_SHA256}'`);
        expect(directives['script-src']).not.toContain("'unsafe-inline'");
        expect(directives['connect-src']).toBe("'self' https://*.sentry.io");
        expect(directives['object-src']).toBe("'none'");
        expect(directives['base-uri']).toBe("'self'");
        expect(directives['form-action']).toBe("'self'");
        expect(directives['frame-ancestors']).toBe("'none'");
        expect(directives['worker-src']).toBe("'self' blob:");
        expect(headers['Content-Security-Policy']).not.toContain('googleapis');
        expect(headers['Content-Security-Policy']).not.toContain('gstatic');
        expect(headers['X-Frame-Options']).toBe('DENY');
    });

    test('denies camera, microphone, geolocation, payment and usb via Permissions-Policy', () => {
        const appHeadersRule = config.headers.find(rule => rule.source === '/(.*)');
        const headers = Object.fromEntries(
            appHeadersRule.headers.map(header => [header.key, header.value]),
        );

        expect(headers['Permissions-Policy']).toBe(
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        );
    });
});

// Vercel compiles `redirects` into routes with `getTransformedRoutes` from
// `@vercel/routing-utils` (path-to-regexp v6, strict and case-sensitive), so the test
// uses the same compiler. The edge then substitutes the numbered capture groups (`$1`,
// `$2`, ...) into the `Location` template; an unmatched optional group becomes empty.
// That substitution is done here by hand. The first matching route wins. The only redirects are the
// host-agnostic locale rows.
const redirectRoutes = (() => {
    const { routes, error } = getTransformedRoutes({
        redirects: (config.redirects ?? []).filter(redirect => !redirect.has),
    });

    if (error) {
        throw new Error(error.message);
    }

    return routes ?? [];
})();

const resolveRedirect = pathname => {
    for (const route of redirectRoutes) {
        const match = new RegExp(route.src).exec(pathname);

        if (match) {
            return {
                destination: route.headers.Location.replace(
                    /\$(\d+)/g,
                    (_, index) => match[Number(index)] ?? '',
                ),
                statusCode: route.status,
            };
        }
    }

    return undefined;
};

describe('Vercel redirects for removed public locales (#609)', () => {
    test.each([
        ['/es', '/'],
        ['/es/', '/'],
        ['/es/privacy', '/privacy'],
        ['/es/privacy/', '/privacy'],
        ['/pt-br', '/'],
        ['/pt-br/', '/'],
        ['/pt-br/privacy', '/privacy'],
        ['/pt-br/privacy/', '/privacy'],
        ['/pt-pt', '/'],
        ['/pt-pt/', '/'],
        ['/pt-pt/privacy', '/privacy'],
        ['/pt-pt/privacy/', '/privacy'],
        ['/pt-BR', '/'],
        ['/pt-BR/', '/'],
        ['/pt-BR/privacy', '/privacy'],
        ['/pt-BR/privacy/', '/privacy'],
        ['/pt-PT', '/'],
        ['/pt-PT/', '/'],
        ['/pt-PT/privacy', '/privacy'],
        ['/pt-PT/privacy/', '/privacy'],
        ['/es/terms', '/terms'],
    ])('permanently redirects %s to the English page %s', (source, destination) => {
        expect(resolveRedirect(source)).toEqual({ destination, statusCode: 301 });
    });

    test.each([
        '/',
        '/ru/',
        '/ru/privacy',
        '/privacy',
        '/estonia',
        '/pt',
        '/dashboard/es',
        '/ES/',
        // Never emit a protocol-relative Location (open redirect).
        '/es//',
        '/es//example.com',
    ])('leaves %s untouched', pathname => {
        expect(resolveRedirect(pathname)).toBeUndefined();
    });
});

// 04-4a1 (spec 04 §2.11 option (a)): `dist` has no file at `/sw.js`, so a rewrite serves the app
// worker `/sw-app.js` there. All routes (redirects, then rewrites after `handle: filesystem`)
// come from `getTransformedRoutes`; a route applies when its `has` host condition holds. Routes
// with `continue` (headers) do not end the match. The first matching route wins.
const compileRoutes = vercelConfig => {
    const { routes, error } = getTransformedRoutes({
        redirects: vercelConfig.redirects ?? [],
        rewrites: vercelConfig.rewrites ?? [],
    });

    if (error) {
        throw new Error(error.message);
    }

    return (routes ?? []).filter(route => route.src && !route.continue);
};

const allRoutes = compileRoutes(config);

const hostMatches = (route, host) =>
    (route.has ?? []).every(condition => hostConditionMatches(condition, host));

// A route matches the pathname only. A redirect's `Location` gets the numbered capture groups
// substituted (as in `resolveRedirect` above), and Vercel appends the request's query string to a
// destination that has none, so `url` may carry a query and the redirect keeps it. The helper
// assumes that runtime behaviour (L2 of the 04-4a2 review).
const resolveRouteIn = (routes, host, url) => {
    const queryIndex = url.indexOf('?');
    const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : url.slice(queryIndex);
    const route = routes.find(
        candidate => hostMatches(candidate, host) && new RegExp(candidate.src).test(pathname),
    );

    if (!route) {
        return undefined;
    }

    if (!route.status) {
        return { rewrite: route.dest.split('?')[0] };
    }

    const match = new RegExp(route.src).exec(pathname);
    const location = route.headers.Location.replace(
        /\$(\d+)/g,
        (_, index) => match[Number(index)] ?? '',
    );

    return {
        redirect: location.includes('?') ? location : location + query,
        statusCode: route.status,
    };
};

const resolveRoute = (host, url) => resolveRouteIn(allRoutes, host, url);

const APP_HOSTS = ['app.chipin.one', 'app-dev.chipin.one'];
const PREVIEW_HOSTS = ['chipin-git-feature-123.vercel.app', 'chipin-frontend.vercel.app'];
const APP_WORKER_HOSTS = [...APP_HOSTS, ...PREVIEW_HOSTS, 'localhost'];

describe('Vercel /sw.js (04-4a1)', () => {
    test.each(APP_WORKER_HOSTS)('serves the app worker /sw-app.js at /sw.js on %s', host => {
        expect(resolveRoute(host, '/sw.js')).toEqual({ rewrite: '/sw-app.js' });
    });

    test.each(APP_WORKER_HOSTS)(
        'leaves the worker file on %s to the filesystem (no redirect, no SPA rewrite)',
        host => {
            expect(resolveRoute(host, '/sw-app.js')).toBeUndefined();
        },
    );

    test('has one /sw.js rewrite, after the last /api rewrite and before the SPA rewrites', () => {
        const indexes = config.rewrites.map((rewrite, index) => ({ ...rewrite, index }));
        const lastApiIndex = Math.max(
            ...indexes.filter(rewrite => rewrite.source === API_SOURCE).map(({ index }) => index),
        );
        const swRewrites = indexes.filter(rewrite => rewrite.source === '/sw.js');
        const firstSpaIndex = Math.min(
            ...indexes
                .filter(rewrite => rewrite.destination === '/app.html')
                .map(({ index }) => index),
        );

        expect(swRewrites.map(({ destination }) => destination)).toEqual(['/sw-app.js']);
        expect(swRewrites.every(({ index }) => index > lastApiIndex && index < firstSpaIndex)).toBe(
            true,
        );
    });
});

// The private app paths and the paths that are never redirected, on every host.
const APP_PATHS = [
    '/dashboard',
    '/dashboard/',
    '/dashboard/x',
    '/solo',
    '/solo/x',
    '/activity',
    '/activity/1',
    '/settings',
    '/settings/profile',
    '/group',
    '/group/1',
    '/group/join/token',
    '/friends',
    '/friends/join/token',
    '/oauth/callback',
    '/oauth/callback?code=x&returnTo=%2Fgroup%2F1',
    '/not-found',
];

const NEVER_REDIRECTED_PATHS = [
    '/',
    '/?utm_source=x',
    '/privacy',
    '/terms',
    '/ru',
    '/ru/',
    '/ru/privacy',
    '/ru/terms',
    '/index.html',
    '/privacy/index.html',
    '/ru/index.html',
    '/app.html',
    '/manifest.webmanifest',
    '/join/group/token',
    '/join/friend/token',
    '/api/auth/refresh',
    '/api/stats',
    '/assets/index-abc123.js',
    '/sw.js',
    '/sw-app.js',
    '/favicon.ico',
    '/pwa-192x192.png',
    '/apple-touch-icon-180x180.png',
    '/.well-known/assetlinks.json',
    '/robots.txt',
    '/sitemap.xml',
    '/dashboardx',
    '/Dashboard',
    '/not-found/x',
];

describe('Vercel redirects by host (04-5a)', () => {
    test.each([...OLD_HOSTS, ...APP_HOSTS, ...PREVIEW_HOSTS, 'localhost'])(
        'has no redirect on %s except the locale 301 rows',
        host => {
            const hostRedirects = allRoutes.filter(
                route => route.status && hostMatches(route, host),
            );

            expect(hostRedirects.length).toBeGreaterThan(0);
            expect(hostRedirects.every(route => route.status === 301 && !route.has)).toBe(true);
            for (const path of [...APP_PATHS, ...NEVER_REDIRECTED_PATHS]) {
                expect(resolveRoute(host, path)?.redirect).toBeUndefined();
            }
        },
    );

    // L1 of the 04-4a2 review: an unanchored host condition would match a look-alike host.
    test.each(APP_HOSTS)('serves %s/dashboard with no redirect (no loop)', host => {
        expect(resolveRoute(host, '/dashboard')).toEqual({ rewrite: '/app.html' });
    });

    test('writes every named host condition as an exact { eq } match', () => {
        const hostConditions = ['redirects', 'rewrites', 'headers'].flatMap(key =>
            config[key].flatMap(rule =>
                (rule.has ?? []).filter(condition => condition.type === 'host'),
            ),
        );

        expect(hostConditions.length).toBeGreaterThan(0);
        for (const condition of hostConditions) {
            expect(typeof condition.value).toBe('object');
            expect(Object.keys(condition.value)).toHaveLength(1);
            if (condition.value.eq !== undefined) {
                expect(condition.value.eq).toMatch(/^[a-z-]+(\.[a-z-]+)+$/);
            } else {
                expect(condition.value).toEqual({ suf: '.vercel.app' });
            }
        }
    });
});

// 04-5a: the old hosts `chipin.one` and `dev.chipin.one` get no app rule: no host condition names
// them, and no app path, invite path, manifest or API call is redirected or rewritten there.
describe('Vercel has no app rules for the old hosts (04-5a)', () => {
    test('no rule has a host condition that matches an old host', () => {
        const oldHostRules = ['redirects', 'rewrites', 'headers'].flatMap(key =>
            config[key].filter(rule =>
                (rule.has ?? []).some(condition =>
                    OLD_HOSTS.some(host => hostConditionMatches(condition, host)),
                ),
            ),
        );

        expect(oldHostRules).toEqual([]);
    });

    test.each(
        OLD_HOSTS.flatMap(host =>
            [
                ...APP_PATHS,
                '/unknown',
                '/app.html',
                '/index.html',
                '/ru/privacy/index.html',
                '/manifest.webmanifest',
                '/join/group/token',
                '/join/friend/token',
                '/api/x',
            ].map(path => [host, path]),
        ),
    )('on %s leaves %s unrouted', (host, path) => {
        expect(resolveRoute(host, path)).toBeUndefined();
    });
});

// #821 (the app twin of the site fix in #814): a capture that starts the redirect path must not
// start with `\`, tab, CR or LF. Browsers read `/\evil.example` as `//evil.example`, and the URL
// parser drops tab, CR and LF anywhere, so `/<tab>/evil.example` is `//evil.example` too. Each
// crafted URL is tried raw (in case Vercel decodes the path before matching) and percent-encoded
// (in case it does not). The oracle is the WHATWG URL parser, as in a browser: a `Location` is
// resolved against the request host and must stay on that host.
const OPEN_REDIRECT_URLS = [
    '/es/\\evil.example',
    '/es/%5Cevil.example',
    '/es/\\\\evil.example',
    '/es/%5C%5Cevil.example',
    '/es/\t/evil.example',
    '/es/%09/evil.example',
    '/es/\r/evil.example',
    '/es/%0D/evil.example',
    '/es/\n/evil.example',
    '/es/%0A/evil.example',
    '/es//evil.example',
    '/es/%2F%2Fevil.example',
    '/pt-BR/\\evil.example',
    '/pt-pt/\t/evil.example',
    '/\\evil.example/index.html',
    '/%5Cevil.example/index.html',
    '/\t/evil.example/index.html',
    '/%09/evil.example/index.html',
    '/\r/evil.example/index.html',
    '/\n/evil.example/index.html',
    '//evil.example/index.html',
    '/%2F%2Fevil.example/index.html',
];
const OPEN_REDIRECT_HOSTS = [...OLD_HOSTS, ...APP_HOSTS, ...PREVIEW_HOSTS, 'localhost'];

// The crafted URLs whose redirect leaves the request host.
const offSiteRedirects = routes =>
    OPEN_REDIRECT_HOSTS.flatMap(host =>
        OPEN_REDIRECT_URLS.flatMap(url => {
            const redirect = resolveRouteIn(routes, host, url)?.redirect;

            if (redirect === undefined) {
                return [];
            }
            const target = new URL(redirect, `https://${host}`);

            return target.host === host ? [] : [{ host, url, redirect }];
        }),
    );

describe('Vercel redirects are not open redirects (#821)', () => {
    test('no crafted URL redirects off the request host', () => {
        expect(offSiteRedirects(allRoutes)).toEqual([]);
    });

    // Pins that the cases and the oracle above catch the capture class before #821 (`[^/]`).
    test('the check fails on the old capture class', () => {
        const oldConfig = {
            ...config,
            redirects: config.redirects.map(redirect => ({
                ...redirect,
                source: redirect.source.replaceAll('[^/\\\\\\t\\n\\r]', '[^/]'),
            })),
        };

        expect(oldConfig.redirects).not.toEqual(config.redirects);
        expect(offSiteRedirects(compileRoutes(oldConfig)).map(({ url }) => url)).toEqual(
            expect.arrayContaining(['/es/\\evil.example', '/es/\t/evil.example']),
        );
    });

    test.each([
        ['app.chipin.one', '/es/privacy', '/privacy', 301],
        ['app-dev.chipin.one', '/pt-BR/terms/', '/terms', 301],
    ])('on %s still redirects %s to %s', (host, url, redirect, statusCode) => {
        expect(resolveRoute(host, url)).toEqual({ redirect, statusCode });
    });
});

// 04-2b (spec 04 §2.9, D31): one host-scoped catch-all to the shell per app host group, at the end
// of the rewrites. It skips `api/`, `assets/`, `_vercel/`, `.well-known/` and any path whose last
// segment has a file extension, so a missing chunk or icon stays a 404 and never gets the shell.
// The filesystem is checked before the rewrites (§4.1), so `dist` files and the transitional
// prerender pages are served as files; the route table below models only the rules. 04-5a removed
// the enumerated host-agnostic rewrites: the catch-all alone serves the shell.
const CATCH_ALL_SOURCE = '/((?!api/|assets/|_vercel/|\\.well-known/)(?!.*\\.[^/]+$).*)';
const APP_HOST_CONDITIONS = [
    { eq: 'app.chipin.one' },
    { eq: 'app-dev.chipin.one' },
    { suf: '.vercel.app' },
];
const SHELL = { rewrite: '/app.html' };

// Invite tokens are base64url (`INVITE_TOKEN_PATTERN`, backend InviteTokenGenerator): no `.`, so a
// join link never looks like a file and the catch-all serves it the shell.
const PARAM_VALUES = {
    groupId: '0b6f6a9e-3c1d-4f2a-9b7e-5d8c2a1f4e3b',
    parentActivityId: '7d2e9c4a-1b3f-4e5d-8a6c-9f0b1e2d3c4a',
    inviteToken: TEST_INVITE_TOKEN,
};

const substituteParams = path =>
    path.replace(/:([A-Za-z]+)/g, (_, name) => {
        if (!(name in PARAM_VALUES)) {
            throw new Error(`No test value for the route parameter :${name}`);
        }

        return PARAM_VALUES[name];
    });

/** A manifest `path` (relative, no leading slash) as a URL path. */
const manifestUrlPath = route => `/${substituteParams(route.path)}`;

const regularRoutes = APP_ROUTES.filter(route => !route.transitional);
const transitionalRoutes = APP_ROUTES.filter(route => route.transitional);

// Every form of a transitional path: `/privacy`, `/ru/privacy`, `/ru/privacy/`, `/`, `/ru`, `/ru/`.
const transitionalUrlPaths = transitionalRoutes.flatMap(route =>
    Object.values(LOCALE_PREFIX).flatMap(prefix => {
        const path = route.path ? `${prefix}/${route.path}` : `${prefix}/`;

        return [...new Set([path, `${path.replace(/\/$/, '')}/`, path.replace(/(.)\/$/, '$1')])];
    }),
);

const NOT_SHELL_PATHS = [
    '/assets/x.js',
    '/assets/missing-chunk.js',
    '/assets/x',
    '/_vercel/insights/script.js',
    '/_vercel/speed-insights/script.js',
    '/_vercel/insights/view',
    '/_vercel/speed-insights/vitals',
    '/.well-known/assetlinks.json',
    '/.well-known/other',
    '/sw.js',
    '/sw-app.js',
    '/manifest.webmanifest',
    '/pwa-192x192.png',
    '/robots.txt',
    '/sitemap.xml',
    '/app.html',
    '/favicon.ico',
    '/group/x.json',
    '/dashboard/x.js',
];

const ASSET_PATHS = [
    '/assets/x.js',
    '/sw.js',
    '/manifest.webmanifest',
    '/robots.txt',
    '/.well-known/assetlinks.json',
    '/api/x',
];

const allowsPrivateFallback = pathname =>
    PRIVATE_SPA_NAVIGATION_ALLOWLIST.some(pattern => pattern.test(pathname));

const isCatchAllSource = rewrite => rewrite.destination === '/app.html';

// The same config with the catch-all removed: the baseline of the differential check below.
const routesWithoutCatchAll = compileRoutes({
    ...config,
    rewrites: config.rewrites.filter(rewrite => !isCatchAllSource(rewrite)),
});

const APP_SHELL_HOSTS = [...APP_HOSTS, ...PREVIEW_HOSTS];
const OTHER_HOSTS = [
    ...OLD_HOSTS,
    'localhost',
    'example.com',
    'issue-199.dev.chipin.one',
    'chipin.one.evil.com',
    'evilchipin.one',
    'app.chipin.one.evil.com',
];
const DIFFERENTIAL_PATHS = [
    ...new Set([
        '/',
        '/unknown',
        '/unknown/x',
        '/login',
        '/privacy',
        '/ru/',
        '/dashboard',
        '/group/join/x',
        `/group/${PARAM_VALUES.groupId}`,
        `/group/${PARAM_VALUES.groupId}/x`,
        '/oauth/callback?code=x',
        '/app.html',
        '/index.html',
        ...NEVER_REDIRECTED_PATHS,
        ...NOT_SHELL_PATHS,
        ...APP_PATHS,
        ...APP_ROUTES.map(manifestUrlPath),
        ...transitionalUrlPaths,
        '/api/x',
    ]),
];

describe('Vercel app-host catch-all to the shell (04-2b)', () => {
    const catchAll = config.rewrites
        .map((rewrite, index) => ({ ...rewrite, index }))
        .filter(isCatchAllSource);

    test('has one catch-all per app host group, each scoped by exactly that host', () => {
        expect(catchAll.map(rewrite => rewrite.source)).toEqual(
            APP_HOST_CONDITIONS.map(() => CATCH_ALL_SOURCE),
        );
        for (const rewrite of catchAll) {
            expect(rewrite.has).toHaveLength(1);
            expect(rewrite.has[0].type).toBe('host');
        }
        expect(catchAll.map(rewrite => rewrite.has[0].value)).toEqual(APP_HOST_CONDITIONS);
    });

    test('places the catch-all at the end, after the last /api rewrite and every other rewrite', () => {
        const lastApiIndex = config.rewrites.findLastIndex(
            rewrite => rewrite.source === API_SOURCE,
        );
        const lastOtherIndex = config.rewrites.findLastIndex(rewrite => !isCatchAllSource(rewrite));

        expect(lastApiIndex).toBeGreaterThanOrEqual(0);
        expect(catchAll.every(rewrite => rewrite.index > lastApiIndex)).toBe(true);
        expect(catchAll.every(rewrite => rewrite.index > lastOtherIndex)).toBe(true);
    });

    test('has no host-agnostic shell rewrite (04-5a)', () => {
        expect(
            config.rewrites.filter(rewrite => rewrite.destination === '/app.html' && !rewrite.has),
        ).toEqual([]);
    });

    test('compiles the catch-all source', () => {
        const compiled = allRoutes.filter(route => route.dest === '/app.html' && route.has);

        expect(compiled).toHaveLength(APP_HOST_CONDITIONS.length);
        for (const route of compiled) {
            expect(route.src).toBe(`^(?:${CATCH_ALL_SOURCE})$`);
            for (const path of [...NOT_SHELL_PATHS, '/api/x']) {
                expect(new RegExp(route.src).test(path)).toBe(false);
            }
        }
    });

    test.each(
        APP_SHELL_HOSTS.flatMap(host =>
            regularRoutes.map(manifestUrlPath).map(path => [host, path]),
        ),
    )('on %s routes the manifest path %s to the shell', (host, path) => {
        expect(resolveRoute(host, path)).toEqual(SHELL);
    });

    // The rule table gives the shell only where no file matches: on Vercel the filesystem is
    // checked before the rewrites (§4.1), so the prerender files of these pages are served first.
    test.each(APP_SHELL_HOSTS.flatMap(host => transitionalUrlPaths.map(path => [host, path])))(
        'on %s routes the transitional path %s to the shell only when no prerender file matches',
        (host, path) => {
            expect(resolveRoute(host, path)).toEqual(SHELL);
        },
    );

    test.each(
        APP_SHELL_HOSTS.flatMap(host =>
            [
                '/unknown',
                '/unknown/x',
                '/login',
                `/group/${PARAM_VALUES.groupId}/x`,
                '/oauth/callback?code=x',
                '/a.b/c',
            ].map(path => [host, path]),
        ),
    )('on %s serves the shell at the nested or unknown path %s', (host, path) => {
        expect(resolveRoute(host, path)).toEqual(SHELL);
    });

    test.each(APP_SHELL_HOSTS)(
        'on %s sends /api/x and /api to the backend, not the shell',
        host => {
            expect(resolveRoute(host, '/api/x')?.rewrite).toMatch(
                /^https:\/\/api(?:-dev)?\.chipin\.one\//,
            );
            expect(resolveRoute(host, '/api')?.rewrite).toMatch(
                /^https:\/\/api(?:-dev)?\.chipin\.one\//,
            );
            expect(resolveRoute(host, '/api/')).not.toEqual(SHELL);
        },
    );

    test.each(APP_SHELL_HOSTS.flatMap(host => NOT_SHELL_PATHS.map(path => [host, path])))(
        'on %s never rewrites %s to the shell',
        (host, path) => {
            expect(resolveRoute(host, path)).not.toEqual(SHELL);
        },
    );

    test.each(OLD_HOSTS)('on %s leaves /unknown and /dashboard to the filesystem (a 404)', host => {
        expect(resolveRoute(host, '/unknown')).toBeUndefined();
        expect(resolveRoute(host, '/dashboard')).toBeUndefined();
    });

    test.each(OTHER_HOSTS.flatMap(host => DIFFERENTIAL_PATHS.map(path => [host, path])))(
        'on %s resolves %s exactly as without the catch-all',
        (host, path) => {
            expect(resolveRoute(host, path)).toEqual(
                resolveRouteIn(routesWithoutCatchAll, host, path),
            );
        },
    );

    test.each(APP_SHELL_HOSTS.flatMap(host => DIFFERENTIAL_PATHS.map(path => [host, path])))(
        'on %s changes %s at most from unrouted to the shell',
        (host, path) => {
            const before = resolveRouteIn(routesWithoutCatchAll, host, path);
            const after = resolveRoute(host, path);

            if (before === undefined) {
                expect([undefined, SHELL]).toContainEqual(after);
            } else {
                expect(after).toEqual(before);
            }
        },
    );

    test('the invite token shape has no dot', () => {
        expect(INVITE_TOKEN_PATTERN.test(TEST_INVITE_TOKEN)).toBe(true);
        expect(INVITE_TOKEN_PATTERN.test(`${TEST_INVITE_TOKEN}.js`)).toBe(false);
    });
});

// The SW navigation allowlist is hand-written (§2.9): a new manifest route must be added to it, and
// it must stay narrower than the catch-all (no transitional page, no asset).
describe('PRIVATE_SPA_NAVIGATION_ALLOWLIST against the route manifest (04-2b)', () => {
    test('has regular and transitional routes to check', () => {
        expect(regularRoutes.length).toBeGreaterThan(0);
        expect(transitionalUrlPaths).toEqual(expect.arrayContaining(['/', '/ru/', '/ru/privacy']));
    });

    test.each(regularRoutes.map(route => [route.id, manifestUrlPath(route)]))(
        'allows the %s path %s',
        (_, path) => {
            expect(allowsPrivateFallback(path)).toBe(true);
        },
    );

    test.each(transitionalUrlPaths)('does not allow the transitional path %s', path => {
        expect(allowsPrivateFallback(path)).toBe(false);
    });

    test.each(ASSET_PATHS)('does not allow the asset path %s', path => {
        expect(allowsPrivateFallback(path)).toBe(false);
    });

    // Self-check: a manifest route the allowlist does not know fails the check above.
    test('does not allow a path no allowlist entry names', () => {
        expect(allowsPrivateFallback('/brand-new')).toBe(false);
    });
});

const headerRoutes = (() => {
    const { routes, error } = getTransformedRoutes({ headers: config.headers ?? [] });

    if (error) {
        throw new Error(error.message);
    }

    return routes ?? [];
})();

const resolveHeaders = (host, pathname) =>
    Object.assign(
        {},
        ...headerRoutes
            .filter(route => hostMatches(route, host) && new RegExp(route.src).test(pathname))
            .map(route => route.headers),
    );

// The manifest is a plain file with its own headers on every app host.
describe('Vercel /manifest.webmanifest', () => {
    test.each(APP_WORKER_HOSTS)(
        'on %s serves the manifest file itself (no redirect, no rewrite)',
        host => {
            expect(resolveRoute(host, '/manifest.webmanifest')).toBeUndefined();
        },
    );

    test.each(APP_WORKER_HOSTS)('keeps the manifest headers on %s', host => {
        expect(resolveHeaders(host, '/manifest.webmanifest')).toMatchObject({
            'Content-Type': 'application/manifest+json',
            'Cache-Control': 'public, max-age=3600, immutable',
        });
    });
});

describe('Vercel headers by host (04-4a2)', () => {
    test.each(
        [...APP_HOSTS, ...PREVIEW_HOSTS].flatMap(host =>
            ['/', '/dashboard', '/group/1', '/api/health', '/sw.js'].map(path => [host, path]),
        ),
    )('marks %s%s noindex, nofollow', (host, path) => {
        expect(resolveHeaders(host, path)['X-Robots-Tag']).toBe('noindex, nofollow');
    });

    test.each([...APP_HOSTS, ...PREVIEW_HOSTS])(
        'serves /sw.js on %s with Cache-Control: no-cache',
        host => {
            expect(resolveHeaders(host, '/sw.js')['Cache-Control']).toBe('no-cache');
        },
    );

    test('keeps the security headers on every host', () => {
        for (const host of [...OLD_HOSTS, ...APP_HOSTS, ...PREVIEW_HOSTS]) {
            expect(resolveHeaders(host, '/')['X-Frame-Options']).toBe('DENY');
        }
    });
});

const ASSET_LINK_SITES = [
    'https://app-dev.chipin.one',
    'https://app.chipin.one',
    'https://chipin.one',
    'https://dev.chipin.one',
];

const readAssetLinkSites = path =>
    JSON.parse(readFileSync(path, 'utf8'))
        .map(entry => entry.target.site)
        .sort();

test('assetlinks.json lists the site and the app hosts (04-4a2)', () => {
    expect(
        readAssetLinkSites(resolve(import.meta.dirname, 'public/.well-known/assetlinks.json')),
    ).toEqual(ASSET_LINK_SITES);
});

// Runs against a built `dist` only (`npm run build` runs `verify:public-precache`, which checks
// the same files on every build, including Vercel's).
describe.runIf(existsSync(resolve(DIST, 'index.html')))('built dist worker files (04-4a1)', () => {
    test('has sw-app.js and no sw.js', () => {
        expect(existsSync(resolve(DIST, 'sw-app.js'))).toBe(true);
        expect(existsSync(resolve(DIST, 'sw.js'))).toBe(false);
    });

    test('has the manifest', () => {
        expect(existsSync(resolve(DIST, 'manifest.webmanifest'))).toBe(true);
    });

    test('copies assetlinks.json with the site and the app hosts (04-4a2)', () => {
        expect(readAssetLinkSites(resolve(DIST, '.well-known/assetlinks.json'))).toEqual(
            ASSET_LINK_SITES,
        );
    });
});

// 04-0a: Vercel builds with Root Directory apps/app; the install runs at the workspace root from
// the root lockfile, like CI (a workspace-scoped install misses the root tooling, husky fails).
test('installs from the workspace root lockfile', () => {
    expect(config.installCommand).toBe('cd ../.. && npm ci');
});
