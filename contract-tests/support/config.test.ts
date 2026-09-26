import { describe, expect, it } from 'vitest';

import { resolveContractConfig } from './config';

describe('resolveContractConfig', () => {
    it('accepts and normalizes the staging origin when Basic credentials are present', () => {
        expect(
            resolveContractConfig({
                CHIPIN_CONTRACT_BASE_URL: 'https://api-dev.chipin.one/',
                CHIPIN_CONTRACT_SWAGGER_USER: 'contract-user',
                CHIPIN_CONTRACT_SWAGGER_PASSWORD: 'contract-password',
            }),
        ).toEqual({
            baseUrl: 'https://api-dev.chipin.one',
            basicAuth: {
                password: 'contract-password',
                username: 'contract-user',
            },
            target: 'staging',
        });
    });

    it.each(['http://localhost:8080', 'http://127.0.0.1:8080/'])(
        'allows the local development target %s without Basic credentials',
        (baseUrl) => {
            expect(
                resolveContractConfig({
                    CHIPIN_CONTRACT_BASE_URL: baseUrl,
                }),
            ).toEqual({
                baseUrl: baseUrl.replace(/\/$/, ''),
                basicAuth: null,
                target: 'local',
            });
        },
    );

    it('rejects the production API origin', () => {
        expect(() =>
            resolveContractConfig({
                CHIPIN_CONTRACT_BASE_URL: 'https://api.chipin.one',
            }),
        ).toThrow('Production contract target is forbidden');
    });

    it.each([
        '',
        'not-a-url',
        'http://api-dev.chipin.one',
        'https://api-dev.chipin.one:8443',
        'https://user:password@api-dev.chipin.one',
        'https://api-dev.chipin.one/path',
        'https://api-dev.chipin.one?query=1',
        'https://api-dev.chipin.one#hash',
        'http://localhost:3000',
        'https://localhost:8080',
        'http://127.0.0.1:3000',
    ])('rejects a non-allowlisted or malformed target: %s', (baseUrl) => {
        expect(() =>
            resolveContractConfig({
                CHIPIN_CONTRACT_BASE_URL: baseUrl,
            }),
        ).toThrow();
    });

    it.each([
        {
            CHIPIN_CONTRACT_SWAGGER_PASSWORD: 'contract-password',
            CHIPIN_CONTRACT_SWAGGER_USER: undefined,
        },
        {
            CHIPIN_CONTRACT_SWAGGER_PASSWORD: undefined,
            CHIPIN_CONTRACT_SWAGGER_USER: 'contract-user',
        },
        {
            CHIPIN_CONTRACT_SWAGGER_PASSWORD: '',
            CHIPIN_CONTRACT_SWAGGER_USER: 'contract-user',
        },
        {
            CHIPIN_CONTRACT_SWAGGER_PASSWORD: 'contract-password',
            CHIPIN_CONTRACT_SWAGGER_USER: '',
        },
    ])('requires both Basic credentials for staging', (credentials) => {
        expect(() =>
            resolveContractConfig({
                CHIPIN_CONTRACT_BASE_URL: 'https://api-dev.chipin.one',
                ...credentials,
            }),
        ).toThrow('Staging contract tests require Basic credentials');
    });
});
