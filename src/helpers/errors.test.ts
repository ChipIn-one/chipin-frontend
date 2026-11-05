import { describe, expect, test, vi } from 'vitest';

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

import { ApiError, ApiResponseFormatError } from 'shared/lib/apiError';

import {
    getApiErrorPayload,
    getApiErrorStatus,
    isLikelyBackendOutageError,
    isUnauthorizedApiError,
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

test.each([
    { response: { status: 500 } },
    { response: { status: 503 } },
    { code: 'ECONNABORTED' },
    {},
])('identifies likely backend outage candidates %#', error => {
    expect(isLikelyBackendOutageError({ isAxiosError: true, ...error })).toBe(true);
});

test.each([400, 401, 403, 404, 429])(
    'does not identify an application %s response as a backend outage candidate',
    status => {
        expect(
            isLikelyBackendOutageError({
                isAxiosError: true,
                response: { status },
            }),
        ).toBe(false);
    },
);

test('does not identify a cancelled request as a backend outage candidate', () => {
    expect(
        isLikelyBackendOutageError({
            isAxiosError: true,
            __CANCEL__: true,
        }),
    ).toBe(false);
});

describe('an ApiError from api()', () => {
    const apiError = (status: number, code?: string, details?: Record<string, unknown>) =>
        new ApiError({
            status,
            payload: { ...(code && { code }), ...(details && { details }) },
            cause: undefined,
        });

    test('produces the localized apiErrors.<code> message with its details', () => {
        const error = apiError(404, 'GROUP.MEMBER_NOT_FOUND', {
            memberId: 'Member no longer belongs to this group',
        });

        expect(resolveApiErrorMessageFromError(error, 'Could not remove member')).toBe(
            'Group member was not found, Member no longer belongs to this group',
        );
        expect(normalizeApiError(error)).toEqual({
            code: 'GROUP.MEMBER_NOT_FOUND',
            details: { memberId: 'Member no longer belongs to this group' },
            message: 'Group member was not found, Member no longer belongs to this group',
        });
    });

    test('reads code, details and status directly', () => {
        expect(getApiErrorPayload(apiError(409, 'LEDGER.VERSION_CONFLICT'))).toEqual({
            code: 'LEDGER.VERSION_CONFLICT',
        });
        expect(getApiErrorPayload(apiError(500))).toBeUndefined();
        expect(getApiErrorStatus(apiError(401))).toBe(401);
        expect(isUnauthorizedApiError(apiError(401))).toBe(true);
        expect(isUnauthorizedApiError(apiError(403))).toBe(false);
        expect(isLikelyBackendOutageError(apiError(502))).toBe(true);
    });

    test('an unknown code falls back to the generic request message, not the ApiError text', () => {
        expect(normalizeApiError(apiError(400, 'NEW.CODE')).message).toBe(
            'toasts:common.requestFailed',
        );
    });

    test('an ApiResponseFormatError maps to the generic localized message, not its English text', () => {
        const error = new ApiResponseFormatError(200);

        expect(error.message).toContain('not valid JSON');
        expect(normalizeApiError(error)).toEqual({ message: 'toasts:common.requestFailed' });
        expect(getApiErrorStatus(error)).toBeUndefined();
    });
});
