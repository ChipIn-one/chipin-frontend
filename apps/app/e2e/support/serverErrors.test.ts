import { describe, expect, it } from 'vitest';

import {
    type ApiErrorRecord,
    formatApiErrors,
    redactApiPath,
    toFailedRequestRecord,
    toServerErrorRecord,
} from './serverErrors';

const NOW = new Date('2026-11-18T21:10:15.432Z');
const APP = 'http://localhost:5173';
const UUID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const TOKEN = 'Xy9_kQ2-abcDEF0123456789zz';

describe('redactApiPath', () => {
    it.each([
        ['/api/auth/refresh', '/api/auth/refresh'],
        [`/api/groups/invite/${TOKEN}`, '/api/groups/invite/{token}'],
        [`/api/users/invite/${TOKEN}`, '/api/users/invite/{token}'],
        ['/api/users/invite/abc123', '/api/users/invite/{token}'],
        [`/api/groups/${UUID}/members`, '/api/groups/{id}/members'],
        [`/api/ledger/entries/${UUID}`, '/api/ledger/entries/{id}'],
        ['/api/groups/42', '/api/groups/{token}'],
        [`/api/x/${'a'.repeat(40)}`, '/api/x/{token}'],
    ])('%s → %s', (pathname, expected) => {
        expect(redactApiPath(pathname)).toBe(expected);
    });
});

describe('toServerErrorRecord', () => {
    it('records a 5xx of the API with method, path, status and time', () => {
        expect(
            toServerErrorRecord(
                { method: 'POST', url: `${APP}/api/auth/refresh`, status: 502 },
                APP,
                NOW,
            ),
        ).toEqual({
            method: 'POST',
            pathname: '/api/auth/refresh',
            result: '502',
            at: '2026-11-18T21:10:15Z',
        });
        expect(
            toServerErrorRecord({ method: 'GET', url: `${APP}/api`, status: 503 }, APP, NOW),
        ).toEqual(expect.objectContaining({ pathname: '/api', result: '503' }));
    });

    it('drops the query string and redacts tokens', () => {
        expect(
            toServerErrorRecord(
                {
                    method: 'POST',
                    url: `${APP}/api/groups/invite/${TOKEN}?t=secret#x`,
                    status: 500,
                },
                APP,
                NOW,
            ),
        ).toEqual(expect.objectContaining({ pathname: '/api/groups/invite/{token}' }));
    });

    it.each([200, 204, 401, 404, 499])('ignores status %i', status => {
        expect(
            toServerErrorRecord({ method: 'GET', url: `${APP}/api/groups`, status }, APP, NOW),
        ).toBeUndefined();
    });

    it.each([
        `${APP}/api-docs`,
        `${APP}/src/x.ts`,
        `${APP}/group/x`,
        'https://other.example.com/api/x',
        'https://other.example.com/apiary/x',
        'not a url',
    ])('ignores a 5xx outside the app origin API: %s', url => {
        expect(toServerErrorRecord({ method: 'GET', url, status: 502 }, APP, NOW)).toBeUndefined();
    });
});

describe('toFailedRequestRecord', () => {
    it('records an API request that got no response, with its error text', () => {
        expect(
            toFailedRequestRecord(
                {
                    method: 'GET',
                    url: `${APP}/api/groups/${UUID}`,
                    errorText: 'net::ERR_CONNECTION_RESET',
                },
                APP,
                NOW,
            ),
        ).toEqual({
            method: 'GET',
            pathname: '/api/groups/{id}',
            result: 'failed (net::ERR_CONNECTION_RESET)',
            at: '2026-11-18T21:10:15Z',
        });
    });

    it('names a missing error text', () => {
        expect(
            toFailedRequestRecord(
                { method: 'GET', url: `${APP}/api/groups`, errorText: undefined },
                APP,
                NOW,
            ),
        ).toEqual(expect.objectContaining({ result: 'failed (unknown error)' }));
    });

    it.each([`${APP}/src/x.ts`, 'https://other.example.com/api/x'])('ignores %s', url => {
        expect(
            toFailedRequestRecord({ method: 'GET', url, errorText: 'net::ERR_FAILED' }, APP, NOW),
        ).toBeUndefined();
    });
});

describe('formatApiErrors', () => {
    it('returns no message for an empty list', () => {
        expect(formatApiErrors([])).toBeUndefined();
    });

    it('names every recorded error', () => {
        const records: ApiErrorRecord[] = [
            {
                method: 'POST',
                pathname: '/api/auth/refresh',
                result: '502',
                at: '2026-11-18T21:10:15Z',
            },
            {
                method: 'GET',
                pathname: '/api/groups',
                result: 'failed (net::ERR_FAILED)',
                at: '2026-11-18T21:10:16Z',
            },
        ];

        expect(formatApiErrors(records)).toBe(
            'API answered 5xx or failed during this test: ' +
                'POST /api/auth/refresh 502 at 2026-11-18T21:10:15Z, ' +
                'GET /api/groups failed (net::ERR_FAILED) at 2026-11-18T21:10:16Z',
        );
    });
});
