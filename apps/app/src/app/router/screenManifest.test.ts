import type { RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { getOrThrow } from 'test/getOrThrow';
import { createTestQueryClient } from 'test/renderWithQueryClient';
import {
    parseScreenManifest,
    SCREEN_MANIFEST_FILE,
    SCREEN_MANIFEST_URL,
    type ScreenManifest,
    screenManifestSchema,
} from 'test/screenManifest';

import { buildAppRoutes } from './createAppRouter';
import { APP_ROUTES, type AppRouteDef } from './routeManifest';

// The screen map (#997, docs/design-system/screens.md): every app route and every site page has a
// row in the manifest or an `excluded` entry, so a new route without one fails CI.

const MANIFEST_FILES = import.meta.glob<unknown>(
    '../../../../../docs/design-system/screens.manifest.json',
    { eager: true, import: 'default' },
);
// Keys only: the modules are never loaded. Every extension Astro routes from `src/pages`.
const SITE_PAGE_FILES = import.meta.glob(
    '../../../../site/src/pages/**/*.{astro,md,mdx,html,ts,js}',
);
const SITE_PAGES_PREFIX = '../../../../site/src/pages/';

const readManifestJson = (): unknown => {
    const files = Object.values(MANIFEST_FILES);

    expect(files).toHaveLength(1);

    return files[0];
};

const manifest: ScreenManifest = parseScreenManifest(readManifestJson());

const sitePages = Object.keys(SITE_PAGE_FILES).map(file => file.slice(SITE_PAGES_PREFIX.length));

interface RouterLeaf {
    id: string | undefined;
    path: string;
}

const joinPath = (parent: string, path: string): string =>
    path.startsWith('/') ? path : `${parent.replace(/\/$/, '')}/${path}`;

/** The leaves of the real route tree, with their full paths (no rendering, no lazy load). */
const routerLeaves = (routes: readonly RouteObject[], parentPath = ''): RouterLeaf[] =>
    routes.flatMap(route => {
        const path = route.path === undefined ? parentPath : joinPath(parentPath, route.path);

        return route.children?.length
            ? routerLeaves(route.children, path)
            : [{ id: route.id, path: path === '' ? '/' : path }];
    });

const coveredRouteIds = (data: ScreenManifest): Set<string> =>
    new Set([
        ...data.screens.flatMap(screen => (screen.routeId === undefined ? [] : [screen.routeId])),
        ...data.excluded.flatMap(entry => ('routeId' in entry ? [entry.routeId] : [])),
    ]);

const coveredSitePages = (data: ScreenManifest): Set<string> =>
    new Set([
        ...data.screens.flatMap(screen => (screen.sitePage === undefined ? [] : [screen.sitePage])),
        ...data.excluded.flatMap(entry => ('sitePage' in entry ? [entry.sitePage] : [])),
    ]);

const issuesOf = (json: unknown): string[] => {
    const result = screenManifestSchema.safeParse(json);

    return result.success ? [] : result.error.issues.map(issue => issue.message);
};

describe('screen manifest', () => {
    it('parses against the schema', () => {
        expect(issuesOf(readManifestJson())).toEqual([]);
    });

    it('covers every APP_ROUTES entry with a row or an exclusion', () => {
        const covered = coveredRouteIds(manifest);
        const missing = APP_ROUTES.filter(route => !covered.has(route.id)).map(route => route.id);

        expect(missing).toEqual([]);
    });

    it('names only APP_ROUTES ids, with the route path', () => {
        const routes = new Map<string, AppRouteDef>(APP_ROUTES.map(route => [route.id, route]));
        const excludedIds = manifest.excluded.flatMap(entry =>
            'routeId' in entry ? [entry.routeId] : [],
        );

        for (const id of excludedIds) {
            expect(routes.has(id), `excluded ${id}`).toBe(true);
        }
        for (const screen of manifest.screens) {
            if (screen.routeId === undefined) {
                continue;
            }
            const route = routes.get(screen.routeId);

            expect(route, `${screen.id}: routeId ${screen.routeId}`).toBeDefined();
            // A concrete URL (`/group/not-a-uuid`) matches the pattern segment by segment.
            const pattern = `/${route?.path ?? ''}`.split('/');
            const actual = (screen.path.split('?')[0] ?? '').split('/');

            expect(actual.length, `${screen.id}: ${screen.path}`).toBe(pattern.length);
            pattern.forEach((segment, index) => {
                if (!segment.startsWith(':')) {
                    expect(actual[index], `${screen.id}: ${screen.path}`).toBe(segment);
                }
            });
        }
    });

    it('matches the route tree the real router builds', () => {
        const leaves = routerLeaves(buildAppRoutes(createTestQueryClient()));
        const manifestPaths = new Map<string, string>(
            APP_ROUTES.map(route => [route.id, route.path]),
        );
        const covered = coveredRouteIds(manifest);
        const excludedPaths = new Set(
            manifest.excluded.flatMap(entry => ('routePath' in entry ? [entry.routePath] : [])),
        );

        const leafPaths = new Set(leaves.map(leaf => leaf.path.replace(/^\//, '')));

        // A stale exclusion: the router has no such path any more.
        for (const path of excludedPaths) {
            expect(leafPaths.has(path), `excluded routePath ${path}`).toBe(true);
        }
        for (const leaf of leaves) {
            if (leaf.id === undefined || !manifestPaths.has(leaf.id)) {
                // A router leaf outside APP_ROUTES (the `*` redirect) needs its own exclusion.
                expect(excludedPaths.has(leaf.path.replace(/^\//, '')), leaf.path).toBe(true);
                continue;
            }
            expect(covered.has(leaf.id), leaf.id).toBe(true);
            expect(leaf.path).toBe(`/${manifestPaths.get(leaf.id) ?? ''}`);
        }
        expect(leaves.flatMap(leaf => (leaf.id === undefined ? [] : [leaf.id])).sort()).toEqual(
            APP_ROUTES.map(route => route.id).sort(),
        );
    });

    it('covers every apps/site page with a row or an exclusion', () => {
        const covered = coveredSitePages(manifest);

        expect(sitePages).toContain('index.astro');
        expect(sitePages.filter(page => !covered.has(page))).toEqual([]);
        expect([...covered].filter(page => !sitePages.includes(page))).toEqual([]);
    });

    it('rejects duplicate ids and unknown parents or flow steps', () => {
        const valid = parseScreenManifest(readManifestJson());
        const first = getOrThrow(valid.screens, 0);
        const withDuplicate = { ...valid, screens: [...valid.screens, { ...first }] };
        const withUnknownParent = {
            ...valid,
            screens: [
                ...valid.screens,
                { ...first, id: 'e2e.orphan', kind: 'state', parent: 'e2e.missing' },
            ],
        };
        const withUnknownStep = {
            ...valid,
            flows: [{ id: 'broken', title: 'Broken', steps: [first.id, 'e2e.missing'] }],
        };

        expect(issuesOf(withDuplicate)).toContain(`duplicate screen id: ${first.id}`);
        expect(issuesOf(withUnknownParent)).toContain('e2e.orphan: unknown parent e2e.missing');
        expect(issuesOf(withUnknownStep)).toContain('flow broken: unknown step e2e.missing');
        expect(issuesOf({ ...valid, version: 2 })).not.toEqual([]);
    });

    it('rejects parent cycles and a route both mapped and excluded', () => {
        const valid = parseScreenManifest(readManifestJson());
        const withCycle = {
            ...valid,
            screens: [
                ...valid.screens,
                { ...getOrThrow(valid.screens, 0), id: 'e2e.a', kind: 'state', parent: 'e2e.b' },
                { ...getOrThrow(valid.screens, 0), id: 'e2e.b', kind: 'state', parent: 'e2e.a' },
            ],
        };
        const withOverlap = {
            ...valid,
            excluded: [...valid.excluded, { routeId: 'login', reason: 'stale' }],
        };

        expect(issuesOf(withCycle)).toContain('e2e.a: parent cycle through e2e.a');
        expect(issuesOf(withOverlap)).toContain('excluded login also has a row');
    });

    it('resolves the manifest URL from the module to the repository file', () => {
        expect(SCREEN_MANIFEST_URL.protocol).toBe('file:');
        expect(SCREEN_MANIFEST_URL.pathname.endsWith(`/${SCREEN_MANIFEST_FILE}`)).toBe(true);
        expect(SCREEN_MANIFEST_URL.pathname).not.toContain('/apps/app/');
    });
});
