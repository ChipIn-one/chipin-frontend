import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { createWireAmount, currencyCode, isWireAmount, moneyFromWire } from 'shared/money';
import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';

import type { Body, Op } from './client';
import { api, ApiError, ApiResponseFormatError, InvalidPathSegmentError } from './client';
import { apiInstance, initChipInApiInterceptors } from './http';
import { encodePathSegment } from './pathSegment';
import { parseWireJson, stringifyWireJson } from './wireJson';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

// Used only by the interceptor cases at the end (the interceptors are installed there).
const auth = vi.hoisted(() => {
    const state = { token: 'access-token' };

    return {
        state,
        prepareAuthRequest: vi.fn(() => Promise.resolve(state.token)),
        refreshAuthSession: vi.fn(() => {
            state.token = 'next-access-token';
            return Promise.resolve(state.token);
        }),
        checkBackendHealth: vi.fn(() => Promise.resolve()),
    };
});

vi.mock('helpers/authSession', () => ({
    getAuthSessionVersion: () => 1,
    hasAuthAccessTokenRotated: () => false,
    isAuthSessionCurrent: () => true,
    isAuthSessionSignedOut: () => false,
    prepareAuthRequest: auth.prepareAuthRequest,
    refreshAuthSession: auth.refreshAuthSession,
}));

vi.mock('api/healthApi', () => ({ checkBackendHealth: auth.checkBackendHealth }));

const UUID = '11111111-1111-1111-1111-111111111111';
const USD = currencyCode('USD');

interface Reply {
    status: number;
    data: string;
    contentType?: string;
}

let reply: Reply;
const adapter = vi.fn<AxiosAdapter>();
const originalAdapter = apiInstance.defaults.adapter;

// A stub transport under the real Axios pipeline: request/response transforms run as in the app.
const respond = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const headers = new AxiosHeaders();

    if (reply.contentType) {
        headers.setContentType(reply.contentType);
    }
    const response: AxiosResponse = {
        data: reply.data,
        status: reply.status,
        statusText: '',
        headers,
        config,
    };

    if (reply.status >= 400) {
        return Promise.reject(
            new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, response),
        );
    }
    return Promise.resolve(response);
};

const lastRequest = (): InternalAxiosRequestConfig => {
    const call = adapter.mock.calls[adapter.mock.calls.length - 1];

    if (!call) {
        throw new Error('no request was sent');
    }
    return call[0];
};

beforeEach(() => {
    reply = { status: 200, data: '{}', contentType: 'application/json' };
    adapter.mockImplementation(respond);
    apiInstance.defaults.adapter = adapter;
});

afterEach(() => {
    apiInstance.defaults.adapter = originalAdapter;
});

describe('{param} substitution through encodePathSegment (cases of api/apiPath.test.ts)', () => {
    test.each([UUID, TEST_INVITE_TOKEN, 'group-1', 'activity-parent'])(
        'keeps legitimate segment %s unchanged',
        async segment => {
            expect(encodePathSegment(segment)).toBe(segment);
            await api('get', '/groups/{groupId}/activities', { params: { groupId: segment } });
            expect(lastRequest().url).toBe(`/groups/${segment}/activities`);
        },
    );

    test.each(['..', '.', '', '/', '%', 'a/b', '../x', 'a%2Fb', 'a.b', 'a\\b', 'a b'])(
        'rejects unsafe segment %j with a rejected InvalidPathSegmentError and no request',
        async segment => {
            let result: Promise<unknown> | undefined;

            expect(() => {
                result = api('get', '/groups/{groupId}/activities', {
                    params: { groupId: segment },
                });
            }).not.toThrow();
            await expect(result).rejects.toBeInstanceOf(InvalidPathSegmentError);
            expect(adapter).not.toHaveBeenCalled();
        },
    );

    test('rejects a missing parameter instead of sending the segment "undefined"', async () => {
        await expect(
            api('get', '/groups/{groupId}/activities', {
                params: {} as { groupId: string },
            }),
        ).rejects.toBeInstanceOf(InvalidPathSegmentError);
        expect(adapter).not.toHaveBeenCalled();
    });

    test('a safe integer param is accepted; other numbers and inherited keys are rejected', async () => {
        await api('get', '/groups/{groupId}/activities', {
            params: { groupId: 42 } as unknown as { groupId: string },
        });
        expect(lastRequest().url).toBe('/groups/42/activities');

        for (const params of [
            { groupId: 1.5 },
            { groupId: 2 ** 53 },
            Object.create({ groupId: 'g' }),
        ]) {
            await expect(
                api('get', '/groups/{groupId}/activities', {
                    params: params as { groupId: string },
                }),
            ).rejects.toBeInstanceOf(InvalidPathSegmentError);
        }
        expect(adapter).toHaveBeenCalledTimes(1);
    });

    test('does not leak the rejected segment value in the error message', async () => {
        const secret = '../secret-token/members';
        const error: unknown = await api('get', '/groups/{groupId}/activities', {
            params: { groupId: secret },
        }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(InvalidPathSegmentError);
        expect(String(error)).toBe('InvalidPathSegmentError: Invalid API path segment');
    });

    test('builds multi-segment paths and passes the query', async () => {
        await api('get', '/groups/{groupId}/activities/{parentActivityId}/children', {
            params: { groupId: UUID, parentActivityId: 'activity-parent' },
        });
        expect(lastRequest().url).toBe(`/groups/${UUID}/activities/activity-parent/children`);

        await api('get', '/groups/{groupId}/activities', {
            params: { groupId: UUID },
            query: { limit: 10, category: 'expense' },
        });
        expect(lastRequest().params).toEqual({ limit: 10, category: 'expense' });
    });
});

describe('the lossless transport per request', () => {
    test('a JSON response is parsed from text: money becomes a WireAmount, not a number', async () => {
        reply.data = '{"items":[{"id":"e1","amount":899999999999.9997}],"nextCursor":null}';
        const page = await api('get', '/groups/{groupId}/activities', {
            params: { groupId: UUID },
        });
        const [item] = (page as unknown as { items: { amount: unknown }[] }).items;

        expect(isWireAmount(item?.amount)).toBe(true);
        expect(isWireAmount(item?.amount) ? moneyFromWire(item.amount, USD).minor : undefined).toBe(
            8999999999999997n,
        );
    });

    test('a JSON body is written with the WireAmount literal and the JSON content type', async () => {
        reply = { status: 201, data: '{"id":"e1"}', contentType: 'application/json' };
        const body = {
            amount: createWireAmount('899999999999.9997'),
            sharingMode: { type: 'PERCENTAGE', percentageShares: { u1: '100' } },
        } as unknown as Body<Op<'/ledger/entries', 'post'>>;

        await expect(api('post', '/ledger/entries', { body })).resolves.toEqual({ id: 'e1' });
        const request = lastRequest();

        expect(request.data).toBe(
            '{"amount":899999999999.9997,"sharingMode":{"type":"PERCENTAGE","percentageShares":{"u1":100}}}',
        );
        expect(request.headers.getContentType()).toBe('application/json');
    });

    test('a 204 response passes through as is', async () => {
        reply = { status: 204, data: '' };

        await expect(api('delete', '/ledger/entries/{id}', { params: { id: UUID } })).resolves.toBe(
            '',
        );
    });

    test.each([
        ['a non-JSON 2xx body', '<html>ok</html>', 'text/html'],
        ['a malformed JSON 2xx body', '{"items":', 'application/json'],
    ])('%s is rejected with ApiResponseFormatError', async (_name, data, contentType) => {
        reply = { status: 200, data, contentType };

        await expect(
            api('get', '/groups/{groupId}/activities', { params: { groupId: UUID } }),
        ).rejects.toMatchObject({ name: 'ApiResponseFormatError', status: 200 });
        await expect(
            api('get', '/groups/{groupId}/activities', { params: { groupId: UUID } }),
        ).rejects.toBeInstanceOf(ApiResponseFormatError);
    });

    test.each(['', '  \n'])(
        'a 2xx with an empty or whitespace body %j resolves (kick: 200, no content)',
        async data => {
            reply = { status: 200, data, contentType: 'application/json' };

            await expect(
                api('post', '/groups/{id}/members/{userId}/kick', {
                    params: { id: UUID, userId: UUID },
                }),
            ).resolves.toBe(data);
        },
    );

    test('an application/*+json body is parsed losslessly too', async () => {
        reply = { status: 200, data: '{"amount":1.5}', contentType: 'application/vnd.api+json' };
        const page: unknown = await api('get', '/groups/{groupId}/activities', {
            params: { groupId: UUID },
        });

        expect(page).toEqual({ amount: createWireAmount('1.5') });
    });

    test('a FormData body reaches the adapter as FormData with the multipart header', async () => {
        const form = new FormData();

        form.append('file', new Blob(['x']), 'a.png');
        reply.data = '{"id":"g1"}';
        await api('put', '/groups/{id}/cover', { params: { id: UUID }, body: form });
        const request = lastRequest();

        expect(request.data).toBe(form);
        expect(request.headers.getContentType()).toBe('multipart/form-data');
    });

    test('a caller-supplied Content-Type overrides the multipart default', async () => {
        const form = new FormData();

        form.append('file', new Blob(['x']), 'a.png');
        reply.data = '{"id":"g1"}';
        await api('put', '/groups/{id}/cover', {
            params: { id: UUID },
            body: form,
            headers: { 'Content-Type': 'multipart/form-data; boundary=custom' },
        });
        const request = lastRequest();

        expect(request.data).toBe(form);
        expect(request.headers.getContentType()).toBe('multipart/form-data; boundary=custom');
    });

    test('the legacy apiInstance without api() still parses with JSON.parse into numbers', async () => {
        reply.data = '{"amount":85.5}';
        const response = await apiInstance.get<{ amount: unknown }>('/legacy');

        expect(response.data.amount).toBe(85.5);
        expect(apiInstance.defaults.transformResponse).not.toContain(parseWireJson);
        expect(apiInstance.defaults.transformRequest).not.toContain(stringifyWireJson);
    });
});

describe('ApiError', () => {
    test('an error response becomes ApiError { status, code, details }', async () => {
        reply = {
            status: 400,
            data: '{"code":"VALIDATION.FAILED","details":{"amount":"too large"}}',
            contentType: 'application/json',
        };
        const error: unknown = await api('post', '/ledger/entries', {
            body: {} as Body<Op<'/ledger/entries', 'post'>>,
        }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({
            status: 400,
            code: 'VALIDATION.FAILED',
            details: { amount: 'too large' },
            current: undefined,
        });
    });

    test('a 409 version conflict carries current with WireAmount money (error body is lossless)', async () => {
        reply = {
            status: 409,
            data: '{"code":"LEDGER.VERSION_CONFLICT","current":{"id":"e1","amount":365963032346.3555,"version":4}}',
            contentType: 'application/json',
        };
        const error: unknown = await api('get', '/ledger/entries/{id}', {
            params: { id: UUID },
        }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiError);
        const current = (error as ApiError).current as { amount: unknown; version: unknown };

        expect(current.version).toBe(4);
        expect(
            isWireAmount(current.amount) ? moneyFromWire(current.amount, USD).minor : undefined,
        ).toBe(3659630323463555n);
    });

    test('an HTML 502 keeps its status; a network error is rejected as Axios gives it', async () => {
        reply = { status: 502, data: '<html>Bad gateway</html>', contentType: 'text/html' };
        await expect(
            api('get', '/ledger/entries/{id}', { params: { id: UUID } }),
        ).rejects.toMatchObject({ status: 502, code: undefined });

        const network = new AxiosError('Network Error', AxiosError.ERR_NETWORK);

        adapter.mockRejectedValueOnce(network);
        await expect(api('get', '/ledger/entries/{id}', { params: { id: UUID } })).rejects.toBe(
            network,
        );
    });
});

describe('through the installed interceptors (auth refresh, outage detection)', () => {
    beforeAll(() => {
        initChipInApiInterceptors(vi.fn());
    });

    afterAll(() => {
        apiInstance.interceptors.request.clear();
        apiInstance.interceptors.response.clear();
    });

    test('401 then 200: the retry resends the identical body and the result keeps WireAmount', async () => {
        const replies: Reply[] = [
            { status: 401, data: '{"code":"AUTH.UNAUTHORIZED"}', contentType: 'application/json' },
            {
                status: 201,
                data: '{"id":"e1","amount":899999999999.9997}',
                contentType: 'application/json',
            },
        ];

        adapter.mockImplementation(config => {
            reply = replies.shift() ?? reply;
            return respond(config);
        });
        const body = { amount: createWireAmount('899999999999.9997') } as unknown as Body<
            Op<'/ledger/entries', 'post'>
        >;
        const result: unknown = await api('post', '/ledger/entries', { body });
        const [first, second] = adapter.mock.calls.map(([config]) => config);

        expect(auth.refreshAuthSession).toHaveBeenCalledOnce();
        expect(adapter).toHaveBeenCalledTimes(2);
        expect(first?.data).toBe('{"amount":899999999999.9997}');
        expect(second?.data).toBe(first?.data);
        expect(second?.headers.Authorization).toBe('Bearer next-access-token');
        expect(result).toEqual({ id: 'e1', amount: createWireAmount('899999999999.9997') });
    });

    test('an HTML 502 goes through the health check and is rejected as ApiError 502', async () => {
        auth.checkBackendHealth.mockRejectedValueOnce(new Error('health unavailable'));
        reply = { status: 502, data: '<html>Bad gateway</html>', contentType: 'text/html' };

        await expect(
            api('get', '/ledger/entries/{id}', { params: { id: UUID } }),
        ).rejects.toMatchObject({ name: 'ApiError', status: 502, code: undefined });
        expect(auth.checkBackendHealth).toHaveBeenCalledOnce();
    });
});

// Type-level checks: never called, only compiled by `tsc -b` (tsconfig.app.json includes the
// tests). Each `@ts-expect-error` fails the typecheck if its line stops being an error.
export const typeChecks = (): void => {
    // @ts-expect-error -- /health defines no PUT (`put?: never`).
    void api('put', '/health');
    // @ts-expect-error -- the required path param is missing (no opts).
    void api('get', '/groups/{groupId}/activities');
    // @ts-expect-error -- the required path param is missing (empty opts).
    void api('get', '/groups/{groupId}/activities', {});
    // @ts-expect-error -- the required body is missing (no opts).
    void api('post', '/ledger/entries');
    // @ts-expect-error -- the required body is missing (empty opts).
    void api('post', '/ledger/entries', { headers: {} });
    // A GET without params compiles without opts.
    void api('get', '/health');
    void api('get', '/dashboard', { signal: new AbortController().signal });
};

test('the type-level checks are compiled', () => {
    expect(typeChecks).toBeTypeOf('function');
});
