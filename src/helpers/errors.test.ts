import { expect, test, vi } from 'vitest';

const i18nMock = vi.hoisted(() => ({
    exists: vi.fn((key: string) => key === 'errors:apiErrors.GROUP.MEMBER_NOT_FOUND'),
    t: vi.fn((key: string) => {
        if (key === 'errors:apiErrors.GROUP.MEMBER_NOT_FOUND') {
            return 'Group member was not found';
        }

        return key;
    }),
}));

vi.mock('i18next', () => ({ default: i18nMock }));

import {
    normalizeApiError,
    resolveApiErrorMessage,
    resolveApiErrorMessageFromError,
} from './errors';

test('resolves a backend error code and appends field details', () => {
    const error = {
        isAxiosError: true,
        response: {
            data: {
                code: 'GROUP.MEMBER_NOT_FOUND',
                details: { memberId: 'Member no longer belongs to this group' },
            },
        },
    };

    expect(resolveApiErrorMessageFromError(error, 'Could not remove member')).toBe(
        'Group member was not found, Member no longer belongs to this group',
    );
});

test('uses the contextual fallback for an unknown backend error code', () => {
    const error = {
        isAxiosError: true,
        response: {
            data: {
                code: 'GROUP.NEW_CODE',
                details: { groupId: 'Group is unavailable' },
            },
        },
    };

    expect(resolveApiErrorMessageFromError(error, 'Could not load group')).toBe(
        'Could not load group, Group is unavailable',
    );
});

test('keeps the fallback key behavior for payload-less errors', () => {
    expect(resolveApiErrorMessage(undefined, 'oauth.missing_code')).toBe(
        'errors:oauth.missing_code',
    );
});

test('normalizes backend payload details into a serializable request error', () => {
    const error = {
        response: {
            data: {
                code: 'GROUP.MEMBER_NOT_FOUND',
                details: { memberId: 'Member no longer belongs to this group' },
            },
        },
    };

    expect(normalizeApiError(error)).toEqual({
        code: 'GROUP.MEMBER_NOT_FOUND',
        details: { memberId: 'Member no longer belongs to this group' },
        message: 'Group member was not found, Member no longer belongs to this group',
    });
});

test('keeps a useful message for payload-less request failures', () => {
    expect(normalizeApiError(new Error('Network unavailable'))).toEqual({
        message: 'Network unavailable',
    });
});
