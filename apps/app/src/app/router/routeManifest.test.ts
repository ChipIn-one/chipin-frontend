import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from 'constants/locales';
import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import { ROUTE_META } from 'constants/routes';

import { APP_ROUTES } from './routeManifest';

// The node-importability of the manifest (§2.2) is checked by scripts/routeManifest.node.test.mjs.

const PUBLIC_PATHS = new Set(PUBLIC_ROUTE_ENTRIES.map(route => route.path));

const META_FILES = import.meta.glob('../../i18n/locales/*/meta.json', {
    eager: true,
    import: 'default',
});

// The `home` index only redirects (04-5a): it has no page and no ROUTE_META row.
const withPage = APP_ROUTES.filter(route => route.id !== 'home');
const sorted = (values: readonly string[]) => [...values].sort();

/** The value at a dotted key path of parsed JSON, or undefined. */
const valueAt = (json: unknown, path: string): unknown =>
    path
        .split('.')
        .reduce<unknown>(
            (node, key) =>
                typeof node === 'object' && node !== null
                    ? Object.entries(node).find(([name]) => name === key)?.[1]
                    : undefined,
            json,
        );

describe('route manifest', () => {
    it('has unique ids and unique paths', () => {
        const ids = APP_ROUTES.map(route => route.id);
        const paths = APP_ROUTES.map(route => route.path);

        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(paths).size).toBe(paths.length);
    });

    it('has the protected `home` index of 04-5a', () => {
        expect(APP_ROUTES.find(route => route.path === '')).toMatchObject({
            id: 'home',
            access: 'protected',
            layout: 'internal',
        });
    });

    it('uses relative paths', () => {
        for (const route of APP_ROUTES) {
            expect(route.path.startsWith('/')).toBe(false);
        }
    });

    it('lists exactly the non-public ROUTE_META routes, with their title keys', () => {
        const privateMeta = ROUTE_META.filter(meta => !PUBLIC_PATHS.has(meta.path));

        expect(sorted(withPage.map(route => '/' + route.path))).toEqual(
            sorted(privateMeta.map(meta => meta.path)),
        );
        for (const route of withPage) {
            const meta = privateMeta.find(item => item.path === '/' + route.path);

            expect(route.meta.titleKey).toBe(meta?.titleKey);
            expect(route.meta.entityTitleKey).toBe(meta?.groupTitleKey);
        }
    });

    it('has every title key in the meta namespace of every locale', () => {
        expect(sorted(Object.keys(META_FILES))).toEqual(
            sorted(SUPPORTED_LOCALES.map(locale => `../../i18n/locales/${locale}/meta.json`)),
        );
        for (const [file, json] of Object.entries(META_FILES)) {
            for (const route of APP_ROUTES) {
                for (const key of [route.meta.titleKey, route.meta.entityTitleKey]) {
                    if (key !== undefined) {
                        expect(typeof valueAt(json, key), `${file}: ${key}`).toBe('string');
                    }
                }
            }
        }
    });
});
