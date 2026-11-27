import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ENV_DEV, ENV_PROD, ENV_URLS } from 'constants/env';

import { getChipInApiUrl, getChipInAppUrl, getEnv, getSiteOrigin } from './env';

const setWindowLocation = (origin: string): void => {
    const { hostname } = new URL(origin);
    vi.stubGlobal('window', { location: { hostname, origin } });
};

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('getEnv', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_CHIPIN_ENV', undefined);
    });

    test('uses explicit production configuration', () => {
        setWindowLocation('https://app.chipin.one');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_PROD);

        expect(getEnv()).toBe(ENV_PROD);
        expect(getChipInApiUrl()).toBe('https://app.chipin.one/api/');
    });

    test('uses explicit development configuration on a Vercel Preview hostname', () => {
        setWindowLocation('https://chipin-git-feature-123.vercel.app');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_DEV);

        expect(getEnv()).toBe(ENV_DEV);
        expect(getChipInApiUrl()).toBe('https://chipin-git-feature-123.vercel.app/api/');
    });

    test('keeps generated Vercel production domains on the development environment', () => {
        setWindowLocation('https://chipin-frontend.vercel.app');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_PROD);

        expect(getEnv()).toBe(ENV_DEV);
        expect(getChipInApiUrl()).toBe('https://chipin-frontend.vercel.app/api/');
    });

    test('uses development on localhost without explicit configuration', () => {
        setWindowLocation('http://localhost:5173');

        expect(getEnv()).toBe(ENV_DEV);
        expect(getChipInApiUrl()).toBe('http://localhost:5173/api/');
    });

    test('uses development on the known development hostname without explicit configuration', () => {
        setWindowLocation('https://app-dev.chipin.one');

        expect(getEnv()).toBe(ENV_DEV);
    });

    test('rejects unsupported development subdomains without explicit configuration', () => {
        setWindowLocation('https://preview.app-dev.chipin.one');

        expect(() => getEnv()).toThrowError(/environment configuration/i);
    });

    test('rejects a Vercel hostname without explicit configuration', () => {
        setWindowLocation('https://chipin-git-feature-123.vercel.app');

        expect(() => getChipInApiUrl()).toThrowError(/environment configuration/i);
    });

    test('rejects an arbitrary unknown hostname instead of selecting production', () => {
        setWindowLocation('https://example.com');

        expect(() => getChipInApiUrl()).toThrowError(/environment configuration/i);
    });

    test('rejects an invalid explicit environment instead of falling back by hostname', () => {
        setWindowLocation('http://localhost:5173');
        vi.stubEnv('VITE_CHIPIN_ENV', 'staging');

        expect(() => getEnv()).toThrowError(/environment configuration/i);
    });

    test('rejects a missing environment during server-side execution instead of selecting production', () => {
        vi.stubGlobal('window', undefined);

        expect(() => getEnv()).toThrowError(/environment configuration/i);
    });
});

// Spec 04 §2.1 (04-2g): every app host of `ENV_URLS` resolves to its environment without
// `VITE_CHIPIN_ENV` (local runs), and `getSiteOrigin()` is that environment's site origin.
describe('app hosts and the site origin', () => {
    const SITE_ORIGINS = {
        [ENV_PROD]: 'https://chipin.one',
        [ENV_DEV]: 'https://site-dev.chipin.one',
    };

    beforeEach(() => {
        vi.stubEnv('VITE_CHIPIN_ENV', undefined);
    });

    test('lists the app hosts and site origins of the spec', () => {
        expect(ENV_URLS[ENV_PROD].appHostnames).toEqual(['app.chipin.one']);
        expect(ENV_URLS[ENV_DEV].appHostnames).toEqual(['app-dev.chipin.one']);
        expect(ENV_URLS[ENV_PROD].siteOrigin).toBe(SITE_ORIGINS[ENV_PROD]);
        expect(ENV_URLS[ENV_DEV].siteOrigin).toBe(SITE_ORIGINS[ENV_DEV]);
    });

    test.each(
        [ENV_PROD, ENV_DEV].flatMap(env =>
            ENV_URLS[env].appHostnames.map(hostname => [hostname, env] as const),
        ),
    )('%s resolves to %s and its site origin', (hostname, env) => {
        setWindowLocation(`https://${hostname}`);

        expect(getEnv()).toBe(env);
        expect(getSiteOrigin()).toBe(SITE_ORIGINS[env]);
        // The app URL stays the current origin, never the site.
        expect(getChipInAppUrl()).toBe(`https://${hostname}`);
    });

    test('localhost resolves to development and the development site', () => {
        setWindowLocation('http://localhost:5173');

        expect(getSiteOrigin()).toBe('https://site-dev.chipin.one');
    });

    test('a preview with VITE_CHIPIN_ENV=dev links to the development site', () => {
        setWindowLocation('https://chipin-git-feature-123.vercel.app');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_DEV);

        expect(getSiteOrigin()).toBe('https://site-dev.chipin.one');
    });

    test('a preview with VITE_CHIPIN_ENV=prod still links to the development site', () => {
        setWindowLocation('https://chipin-frontend.vercel.app');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_PROD);

        expect(getSiteOrigin()).toBe('https://site-dev.chipin.one');
    });

    test('explicit production links to the production site on any app host', () => {
        setWindowLocation('https://app.chipin.one');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_PROD);

        expect(getSiteOrigin()).toBe('https://chipin.one');
    });

    test('VITE_CHIPIN_ENV wins over the hostname', () => {
        setWindowLocation('https://app.chipin.one');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_DEV);

        expect(getEnv()).toBe(ENV_DEV);
        expect(getSiteOrigin()).toBe('https://site-dev.chipin.one');
    });

    // The old hosts `chipin.one` / `dev.chipin.one` are no app hosts (04-5a).
    test.each([
        'chipin.one',
        'dev.chipin.one',
        'app.chipin.one.example.com',
        'xchipin.one',
        'evil-chipin.one',
    ])('a host %s that is no app host fails closed', hostname => {
        setWindowLocation(`https://${hostname}`);

        expect(() => getEnv()).toThrowError(/environment configuration/i);
        expect(() => getSiteOrigin()).toThrowError(/environment configuration/i);
    });

    test('the site origin has no trailing slash', () => {
        for (const env of [ENV_PROD, ENV_DEV]) {
            expect(ENV_URLS[env].siteOrigin.endsWith('/')).toBe(false);
        }
    });
});
