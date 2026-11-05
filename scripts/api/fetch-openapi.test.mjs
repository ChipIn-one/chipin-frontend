import { describe, expect, test, vi } from 'vitest';

import { fetchStaging, normalizeOpenApiYaml, STAGING_URL } from './fetch-openapi.mjs';

describe('normalizeOpenApiYaml', () => {
    test('sorts keys at every depth, keeps array order, resolves anchors', () => {
        const text = [
            'paths: {}',
            'openapi: 3.1.0',
            'components:',
            '  schemas:',
            '    B: &b { type: object, required: [z, a] }',
            '    A: *b',
        ].join('\n');

        expect(normalizeOpenApiYaml(text)).toBe(
            [
                'components:',
                '  schemas:',
                '    A:',
                '      required:',
                '        - z',
                '        - a',
                '      type: object',
                '    B:',
                '      required:',
                '        - z',
                '        - a',
                '      type: object',
                'openapi: 3.1.0',
                'paths: {}',
                '',
            ].join('\n'),
        );
    });

    test('is idempotent', () => {
        const once = normalizeOpenApiYaml('openapi: 3.1.0\ninfo: { version: "1", title: t }\n');

        expect(normalizeOpenApiYaml(once)).toBe(once);
    });

    test('rejects a body that is not an OpenAPI document', () => {
        expect(() => normalizeOpenApiYaml('<html></html>')).toThrow(/not an OpenAPI document/);
    });
});

describe('fetchStaging', () => {
    const env = { CHIPIN_CONTRACT_SWAGGER_USER: 'u', CHIPIN_CONTRACT_SWAGGER_PASSWORD: 'p' };

    test('requires both credentials', async () => {
        await expect(fetchStaging({ env: {}, fetchImpl: vi.fn() })).rejects.toThrow(
            /CHIPIN_CONTRACT_SWAGGER_USER/,
        );
    });

    test('sends Basic auth to the staging swagger URL', async () => {
        const fetchImpl = vi.fn(async () => new Response('openapi: 3.1.0\n'));

        await expect(fetchStaging({ env, fetchImpl })).resolves.toBe('openapi: 3.1.0\n');
        expect(fetchImpl).toHaveBeenCalledWith(STAGING_URL, {
            headers: { authorization: `Basic ${btoa('u:p')}` },
        });
    });

    test('fails on a non-2xx status without echoing credentials', async () => {
        const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));

        await expect(fetchStaging({ env, fetchImpl })).rejects.toThrow(/^GET .+ failed: HTTP 401$/);
    });
});
