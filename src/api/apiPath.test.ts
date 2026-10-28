import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { describe, expect, test, vi } from 'vitest';

import { apiPath, encodePathSegment, InvalidPathSegmentError } from './apiPath';
import { inviteApiUserToGroup } from './chipin';
import { apiInstance } from './chipin.instance';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        post: vi.fn(),
    },
}));

const UUID = '11111111-1111-1111-1111-111111111111';

describe('apiPath', () => {
    test.each([UUID, TEST_INVITE_TOKEN, 'group-1', 'activity-parent'])(
        'keeps legitimate segment %s unchanged',
        segment => {
            expect(encodePathSegment(segment)).toBe(segment);
            expect(apiPath`/groups/${segment}/leave`).toBe(`/groups/${segment}/leave`);
        },
    );

    test.each(['..', '.', '', 'a/b', '../x', 'a%2Fb', 'a.b', 'a\\b', 'a b'])(
        'rejects unsafe segment %j',
        segment => {
            expect(() => apiPath`/groups/${segment}`).toThrow(InvalidPathSegmentError);
        },
    );

    test('does not leak the rejected segment value in the error message', () => {
        const secret = '../secret-token/members';

        expect(() => encodePathSegment(secret)).toThrow('Invalid API path segment');

        try {
            encodePathSegment(secret);
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidPathSegmentError);
            expect(String(error)).not.toContain('secret-token');
        }
    });

    test('builds multi-segment paths', () => {
        expect(apiPath`/groups/${UUID}/members/${'user-1'}/kick`).toBe(
            `/groups/${UUID}/members/user-1/kick`,
        );
    });

    test('an API function with ".." returns a rejected Promise instead of throwing', () => {
        let result: Promise<unknown> | undefined;

        expect(() => {
            result = inviteApiUserToGroup({ inviteToken: '..' });
        }).not.toThrow();

        return expect(result).rejects.toBeInstanceOf(InvalidPathSegmentError).then(() => {
            expect(apiInstance.post).not.toHaveBeenCalled();
        });
    });
});
