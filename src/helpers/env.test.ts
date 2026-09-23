import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ENV_DEV, ENV_PROD } from 'constants/env';

import { getChipInApiUrl, getEnv } from './env';

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
        setWindowLocation('https://chipin.one');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_PROD);

        expect(getEnv()).toBe(ENV_PROD);
        expect(getChipInApiUrl()).toBe('https://chipin.one/api/');
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
        setWindowLocation('https://dev.chipin.one');

        expect(getEnv()).toBe(ENV_DEV);
    });

    test('rejects unsupported development subdomains without explicit configuration', () => {
        setWindowLocation('https://preview.dev.chipin.one');

        expect(() => getEnv()).toThrowError(/environment configuration/i);
    });

    test('rejects the production hostname without explicit configuration', () => {
        setWindowLocation('https://chipin.one');

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
