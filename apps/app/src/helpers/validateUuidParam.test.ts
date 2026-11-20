import { data } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { loaderArgs } from 'test/loaderArgs';

import { isUuid, validateUuidParam } from './validateUuidParam';

const UUID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';

const run = (name: string, params: Record<string, string | undefined>) =>
    validateUuidParam(name)(loaderArgs(params));

describe('validateUuidParam (04-2a3, spec 04 §2.4)', () => {
    test('04-2a3: a UUID passes and the loader returns no data', () => {
        expect(run('groupId', { groupId: UUID })).toBeNull();
        expect(run('groupId', { groupId: UUID.toUpperCase() })).toBeNull();
    });

    test.each(['123', 'not-a-uuid', `${UUID}x`, '', ' '])(
        '04-2a3: %j throws a 404 response',
        value => {
            let thrown: unknown;

            try {
                run('groupId', { groupId: value });
            } catch (error: unknown) {
                thrown = error;
            }

            expect(thrown).toEqual(data(null, { status: 404 }));
        },
    );

    test('04-2a3: a missing parameter is a 404 too', () => {
        expect(() => run('groupId', {})).toThrow(
            expect.objectContaining({ init: { status: 404 } }),
        );
    });

    test('04-2a3: isUuid accepts only UUID strings', () => {
        expect(isUuid(UUID)).toBe(true);
        expect(isUuid(undefined)).toBe(false);
    });
});
