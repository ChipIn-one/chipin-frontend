import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { APP_ROUTES } from './routeManifest';
import { ROUTE_MODULES } from './routeModules';

// Loading a page module pulls its whole import graph on a cold transform.
const PAGE_IMPORT_TIMEOUT = 20_000;

/** A React element type: a function component, or a memo/forwardRef/lazy object. */
const isElementType = (value: unknown) =>
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value);

describe('route modules', () => {
    // The PWA store reads the display mode when its module loads; jsdom has no `matchMedia`.
    beforeAll(() => {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: false,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }));
    });
    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('has a module for every manifest id and no other', () => {
        expect(Object.keys(ROUTE_MODULES).sort()).toEqual(APP_ROUTES.map(route => route.id).sort());
    });

    it.each(APP_ROUTES.map(route => route.id))(
        '%s resolves to a module with a Component',
        async id => {
            const module = await ROUTE_MODULES[id]();

            expect(isElementType(module.Component)).toBe(true);
        },
        PAGE_IMPORT_TIMEOUT,
    );

    // The transitional public ids render the real public pages: a swapped module fails here.
    it.each([
        ['publicHome', () => import('pages/HomePage')],
        ['publicPrivacy', () => import('pages/PrivacyPage')],
        ['publicTerms', () => import('pages/TermsPage')],
    ] as const)(
        '%s renders its public page component',
        async (id, page) => {
            const [module, pageModule] = await Promise.all([ROUTE_MODULES[id](), page()]);

            expect(module.Component).toBe(pageModule.default);
        },
        PAGE_IMPORT_TIMEOUT,
    );
});
