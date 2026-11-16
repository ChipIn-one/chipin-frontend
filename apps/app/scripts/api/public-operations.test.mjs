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

test('an operation without security is public when the document has no default', () => {
    expect(publicOperations({ paths: { '/open': { get: {} } } })).toEqual({ '/open': ['get'] });
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
