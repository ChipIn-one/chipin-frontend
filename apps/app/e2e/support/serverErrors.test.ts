import { describe, expect, it } from 'vitest';

import { formatServerErrors, type ServerErrorRecord, toServerErrorRecord } from './serverErrors';

const NOW = new Date('2026-11-18T21:10:15.432Z');
const APP = 'http://localhost:5173';

describe('toServerErrorRecord', () => {
    it('records a 5xx of the API with method, path, status and time', () => {
        expect(
            toServerErrorRecord(
                { method: 'POST', url: `${APP}/api/auth/refresh`, status: 502 },
                NOW,
            ),
        ).toEqual({
            method: 'POST',
            pathname: '/api/auth/refresh',
            status: 502,
            at: '2026-11-18T21:10:15Z',
        });
        expect(toServerErrorRecord({ method: 'GET', url: `${APP}/api`, status: 503 }, NOW)).toEqual(
            expect.objectContaining({ pathname: '/api', status: 503 }),
        );
    });

    it('drops the query string and the host', () => {
        expect(
            toServerErrorRecord(
                { method: 'GET', url: `${APP}/api/groups?token=secret#x`, status: 500 },
                NOW,
            ),
        ).toEqual(expect.objectContaining({ pathname: '/api/groups' }));
    });

    it.each([200, 204, 401, 404, 499])('ignores status %i', status => {
        expect(
            toServerErrorRecord({ method: 'GET', url: `${APP}/api/groups`, status }, NOW),
        ).toBeUndefined();
    });

    it.each([
        `${APP}/api-docs`,
        `${APP}/src/x.ts`,
        `${APP}/group/x`,
        'https://fonts.example.com/css/api',
        'https://other.example.com/apiary/x',
    ])('ignores a 5xx outside the API: %s', url => {
        expect(toServerErrorRecord({ method: 'GET', url, status: 502 }, NOW)).toBeUndefined();
    });

    it('ignores an unparsable URL', () => {
        expect(
            toServerErrorRecord({ method: 'GET', url: 'not a url', status: 502 }, NOW),
        ).toBeUndefined();
    });
});

describe('formatServerErrors', () => {
    it('returns no message for an empty list', () => {
        expect(formatServerErrors([])).toBeUndefined();
    });

    it('names every recorded error', () => {
        const records: ServerErrorRecord[] = [
            {
                method: 'POST',
                pathname: '/api/auth/refresh',
                status: 502,
                at: '2026-11-18T21:10:15Z',
            },
            { method: 'GET', pathname: '/api/groups', status: 503, at: '2026-11-18T21:10:16Z' },
        ];

        expect(formatServerErrors(records)).toBe(
            "staging API answered 5xx during this test (an outage of the shared staging backend, not this test's assertion): " +
                'POST /api/auth/refresh 502 at 2026-11-18T21:10:15Z, GET /api/groups 503 at 2026-11-18T21:10:16Z',
        );
    });
});
