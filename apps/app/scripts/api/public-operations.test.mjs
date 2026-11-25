import { expect, test } from 'vitest';

import { publicOperations, renderPublicOperations } from './public-operations.mjs';

const spec = {
    security: [{ bearerAuth: [] }],
    paths: {
        '/stats': { get: { security: [] } },
        '/auth/refresh': { post: { security: [] } },
        '/groups': { get: {}, post: { security: [{ bearerAuth: [] }] } },
        '/mixed': { get: { security: [] }, delete: {}, parameters: [] },
    },
};

test('lists only the operations with an empty security requirement, sorted', () => {
    expect(publicOperations(spec)).toEqual({
        '/auth/refresh': ['post'],
        '/mixed': ['get'],
        '/stats': ['get'],
    });
});

test('fails closed when the document has no top-level security array', () => {
    expect(() => publicOperations({ paths: { '/open': { get: {} } } })).toThrow(
        /top-level `security`/,
    );
    expect(() =>
        publicOperations({ security: { bearerAuth: [] }, paths: { '/open': { get: {} } } }),
    ).toThrow(/top-level `security`/);
});

test('an operation is public only with an empty security array', () => {
    expect(
        publicOperations({
            security: [],
            paths: {
                '/inherits': { get: {} },
                '/object': { get: { security: {} } },
                '/auth': { get: { security: [{ bearerAuth: [] }] } },
            },
        }),
    ).toEqual({ '/inherits': ['get'] });
});

test('a path item that is an unresolved $ref fails generation', () => {
    expect(() =>
        publicOperations({
            ...spec,
            paths: { '/ref': { $ref: '#/components/pathItems/Open' } },
        }),
    ).toThrow(/\/ref.*\$ref/);
});

test('renders the PublicOperations interface', () => {
    expect(renderPublicOperations(spec, '// header\n')).toBe(
        [
            '// header',
            '// The operations without authentication (`security: []`); see publicApi().',
            'export interface PublicOperations {',
            `    "/auth/refresh": 'post';`,
            `    "/mixed": 'get';`,
            `    "/stats": 'get';`,
            '}',
            '',
        ].join('\n'),
    );
});
