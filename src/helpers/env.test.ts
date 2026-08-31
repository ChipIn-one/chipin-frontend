import { afterEach, describe, expect, test, vi } from 'vitest';

import { ENV_DEV, ENV_PROD } from 'constants/env';

import { getChipInApiUrl, getEnv } from './env';

const setWindowHostname = (hostname: string): void => {
    vi.stubGlobal('window', { location: { hostname } });
};

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('getEnv', () => {
    test('uses explicit production configuration', () => {
        setWindowHostname('preview.chipin.one');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_PROD);

        expect(getEnv()).toBe(ENV_PROD);
        expect(getChipInApiUrl()).toBe('https://api.chipin.one/');
    });

    test('uses explicit development configuration', () => {
        setWindowHostname('preview.chipin.one');
        vi.stubEnv('VITE_CHIPIN_ENV', ENV_DEV);

        expect(getEnv()).toBe(ENV_DEV);
        expect(getChipInApiUrl()).toBe('https://api-dev.chipin.one/');
    });

    test('uses development on localhost without explicit configuration', () => {
        setWindowHostname('localhost');

        expect(getEnv()).toBe(ENV_DEV);
    });

    test('uses development on the known development hostname without explicit configuration', () => {
        setWindowHostname('dev.chipin.one');

        expect(getEnv()).toBe(ENV_DEV);
    });

    test('rejects a Vercel-like preview hostname instead of selecting production', () => {
        setWindowHostname('chipin-git-feature-123.vercel.app');

        expect(() => getChipInApiUrl()).toThrowError(/environment configuration/i);
    });

    test('rejects an arbitrary unknown hostname instead of selecting production', () => {
        setWindowHostname('example.com');

        expect(() => getChipInApiUrl()).toThrowError(/environment configuration/i);
    });

    test('rejects an invalid explicit environment instead of falling back by hostname', () => {
        setWindowHostname('localhost');
        vi.stubEnv('VITE_CHIPIN_ENV', 'staging');

        expect(() => getEnv()).toThrowError(/environment configuration/i);
    });

    test('rejects a missing environment during server-side execution instead of selecting production', () => {
        vi.stubGlobal('window', undefined);

        expect(() => getEnv()).toThrowError(/environment configuration/i);
    });
});
