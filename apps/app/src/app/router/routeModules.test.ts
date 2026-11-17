import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { APP_ROUTES } from './routeManifest';
import { ROUTE_MODULES } from './routeModules';

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

            expect(typeof module.Component).toBe('function');
        },
    );
});
