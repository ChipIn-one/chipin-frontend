// The typed `api()` wrapper over the generated OpenAPI types (spec 03 §5.4). It runs on the
// configured `apiInstance` (interceptors: auth refresh, connectivity classification) and adds, per request,
// the lossless transport (wireJson.ts); the instance's global defaults are not changed, so the
// legacy `src/api/*` modules keep `JSON.parse`. `api()` never converts money to `Money`: the
// `entities/*/model` mappers do that.
import type { AxiosError, AxiosInstance, AxiosProgressEvent, AxiosRequestConfig } from 'axios';
import { isAxiosError, isCancel } from 'axios';

import type { PublicOperations } from 'shared/api/generated/publicOperations';
import type { paths } from 'shared/api/generated/schema';
import { ApiError, ApiResponseFormatError, getApiErrorPayload } from 'shared/lib/apiError';

import {
    apiInstance,
    AuthRequestCancelledError,
    EXPECTED_TOKEN_SUBJECT_CONFIG_KEY,
    publicApiInstance,
} from './http';
import { encodePathSegment, InvalidPathSegmentError } from './pathSegment';
import { parseWireJson, stringifyWireJson } from './wireJson';

export { ApiError, ApiResponseFormatError, AuthRequestCancelledError, InvalidPathSegmentError };

export type Method = 'get' | 'put' | 'post' | 'delete' | 'patch';

/** The methods a path really defines (openapi-typescript writes `put?: never` for the others). */
export type MethodOf<P extends keyof paths> = {
    [K in Method]: K extends keyof paths[P]
        ? [NonNullable<paths[P][K]>] extends [never]
            ? never
            : K
        : never;
}[Method];

export type Op<P extends keyof paths, M extends MethodOf<P>> = NonNullable<
    paths[P][M & keyof paths[P]]
>;

type Parameters<O> = O extends { parameters: infer X } ? X : never;
type Part<O, K extends string> = Parameters<O> extends { [Q in K]?: infer X } ? X : never;
type JsonOf<C> = C extends { content: { 'application/json': infer J } } ? J : never;

export type PathParams<O> = Part<O, 'path'>;
export type Query<O> = Part<O, 'query'>;
/** The request body: the `application/json` schema, or `FormData` for a multipart upload. */
export type Body<O> = O extends { requestBody?: infer B }
    ? NonNullable<B> extends { content: infer C }
        ? C extends { 'application/json': infer J }
            ? J
            : C extends { 'multipart/form-data': unknown }
              ? FormData
              : never
        : never
    : never;
/** The 200/201 JSON body, otherwise `void`. */
export type Success<O> = O extends { responses: infer R }
    ? R extends { 200: infer S }
        ? [JsonOf<S>] extends [never]
            ? void
            : JsonOf<S>
        : R extends { 201: infer S }
          ? [JsonOf<S>] extends [never]
              ? void
              : JsonOf<S>
          : void
    : void;

// A part is required exactly when the operation requires it (`path: {...}`, `requestBody: {...}`).
type ParamsPart<O> = Parameters<O> extends { path: infer X } ? { params: X } : { params?: never };
type QueryPart<O> = Parameters<O> extends { query: infer X } ? { query: X } : { query?: Query<O> };
type BodyPart<O> = O extends { requestBody: unknown } ? { body: Body<O> } : { body?: Body<O> };
type IsRequired<O> =
    Parameters<O> extends { path: unknown }
        ? true
        : Parameters<O> extends { query: unknown }
          ? true
          : O extends { requestBody: unknown }
            ? true
            : false;

export type ApiOptions<O> = ParamsPart<O> &
    QueryPart<O> &
    BodyPart<O> & {
        headers?: Record<string, string>;
        signal?: AbortSignal;
        onUploadProgress?: (event: AxiosProgressEvent) => void;
        /** The `sub` the attached access token must have, else the request is not sent (C3-07). */
        expectedTokenSubject?: string;
    };

/** `opts` is required when the operation has a required path param, query or body. */
export type ApiArgs<O> =
    IsRequired<O> extends true ? [opts: ApiOptions<O>] : [opts?: ApiOptions<O>];

// The runtime view of the options; the public types above have already checked them.
interface LooseOptions {
    params?: unknown;
    query?: unknown;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    onUploadProgress?: (event: AxiosProgressEvent) => void;
    expectedTokenSubject?: string;
}

const isLooseOptions = (value: unknown): value is LooseOptions =>
    typeof value === 'object' && value !== null;

const PATH_PARAM = /\{([^}]+)\}/g;
const MULTIPART_HEADERS = { 'Content-Type': 'multipart/form-data' };

const buildPath = (path: string, params: unknown): string =>
    path.replace(PATH_PARAM, (_match, name: string) => {
        const value: unknown =
            typeof params === 'object' &&
            params !== null &&
            Object.prototype.hasOwnProperty.call(params, name)
                ? Reflect.get(params, name)
                : undefined;

        // Only a string or a safe integer; a missing value must not become "undefined".
        if (typeof value === 'string') {
            return encodePathSegment(value);
        }
        if (typeof value === 'number' && Number.isSafeInteger(value)) {
            return encodePathSegment(String(value));
        }
        throw new InvalidPathSegmentError();
    });

/** An Axios error with a response as an `ApiError`; anything else as is (also for the legacy layer). */
export const toApiError = (error: unknown): unknown => {
    if (!isAxiosError(error) || !error.response) {
        return error;
    }
    const { status } = error.response;
    const data: unknown = error.response.data;
    const payload = getApiErrorPayload(error);
    const current: unknown =
        status === 409 &&
        payload?.code === 'LEDGER.VERSION_CONFLICT' &&
        typeof data === 'object' &&
        data !== null &&
        'current' in data
            ? data.current
            : undefined;

    return new ApiError({ status, payload, current, cause: error });
};

const request = async <P extends keyof paths, M extends MethodOf<P>>(
    instance: AxiosInstance,
    method: M,
    path: P,
    args: ApiArgs<Op<P, M>>,
): Promise<Success<Op<P, M>>> => {
    const [first]: readonly unknown[] = args;
    const opts: LooseOptions = isLooseOptions(first) ? first : {};
    const url = buildPath(path, opts.params);
    const isMultipart = opts.body instanceof FormData;
    const config: AxiosRequestConfig = {
        method,
        url,
        params: opts.query,
        data: opts.body,
        // Like the legacy uploads (usersApi/groupsApi): the multipart header with the Axios
        // default request transform; a caller-supplied header wins.
        headers: isMultipart ? { ...MULTIPART_HEADERS, ...opts.headers } : opts.headers,
        signal: opts.signal,
        onUploadProgress: opts.onUploadProgress,
        transformResponse: [parseWireJson],
        // A multipart upload keeps the Axios default request transform.
        ...(isMultipart ? {} : { transformRequest: [stringifyWireJson] }),
    };

    if (opts.expectedTokenSubject !== undefined) {
        Reflect.set(config, EXPECTED_TOKEN_SUBJECT_CONFIG_KEY, opts.expectedTokenSubject);
    }
    let response;

    try {
        response = await instance.request<Success<Op<P, M>>>(config);
    } catch (error) {
        throw toApiError(error);
    }
    const data: unknown = response.data;

    if (typeof data === 'string' && data.trim() !== '') {
        throw new ApiResponseFormatError(response.status);
    }
    return response.data;
};

/**
 * Calls `method path` with typed params, query, body and response. An invalid `{param}` gives a
 * rejected `InvalidPathSegmentError` (no request); an HTTP error response gives `ApiError`; a 2xx
 * body that is not JSON gives `ApiResponseFormatError`; network errors and cancellations are
 * rejected as Axios gives them.
 */
export function api<P extends keyof paths, M extends MethodOf<P>>(
    method: M,
    path: P,
    ...args: ApiArgs<Op<P, M>>
): Promise<Success<Op<P, M>>> {
    return request(apiInstance, method, path, args);
}

/** The paths with at least one operation without authentication (`security: []`). */
export type PublicPath = keyof PublicOperations & keyof paths;
/** The methods of `P` that need no authentication. */
export type PublicMethodOf<P extends PublicPath> = PublicOperations[P] & MethodOf<P>;

/**
 * `api()` for the public operations only (`security: []` in the OpenAPI snapshot, e.g.
 * `GET /stats`): the same typing and transport, on the instance without the auth interceptors (no
 * token, no refresh, no sign-out on 401), so an anonymous visitor's request is sent; `api()`
 * cancels it. Connectivity classification still applies. A secured operation is a type error.
 */
export function publicApi<P extends PublicPath, M extends PublicMethodOf<P>>(
    method: M,
    path: P,
    ...args: ApiArgs<Op<P, M>>
): Promise<Success<Op<P, M>>> {
    return request(publicApiInstance, method, path, args);
}

// Axios codes of a request that was never sent: option validation, URL building, an unsupported
// protocol or adapter, a body refused before sending (axios 1.x `AxiosError`).
const NOT_SENT_CODES: ReadonlySet<string> = new Set([
    'ERR_BAD_OPTION',
    'ERR_BAD_OPTION_VALUE',
    'ERR_INVALID_URL',
    'ERR_NOT_SUPPORT',
    'ERR_DEPRECATED',
    'ERR_FORM_DATA_DEPTH_EXCEEDED',
    // Without a response only a client-side refusal (unsupported protocol, body too large).
    'ERR_BAD_REQUEST',
]);

// Transport failures; the fetch adapter may raise them without a request object.
const TRANSPORT_CODES: ReadonlySet<string> = new Set(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT']);

/** An Axios error without a response that is not a cancellation (network or never sent). */
const isUnansweredAxiosError = (error: unknown): error is AxiosError =>
    isAxiosError(error) && error.response === undefined && !isCancel(error);

/**
 * A sent request that got no HTTP response (offline, DNS, CORS, timeout); a cancellation is not
 * one, nor an Axios error raised before sending (a setup error: it has a code but no `request`,
 * or a {@link NOT_SENT_CODES} code), which a query retry cannot fix. A setup error without a code
 * (e.g. axios' "Unknown adapter") still counts as network: the safe direction, it is retried.
 * Only `api()`/`publicApi()` errors are classified: an `ApiError` has a response.
 */
export const isNetworkError = (error: unknown): boolean => {
    if (!isUnansweredAxiosError(error)) {
        return false;
    }
    const { code } = error;

    if (code === undefined) {
        return true;
    }
    if (NOT_SENT_CODES.has(code)) {
        return false;
    }
    return error.request !== undefined || TRANSPORT_CODES.has(code);
};

/**
 * An Axios error of a request that was never sent (a setup error: bad option, invalid URL, an
 * unsupported protocol or adapter), e.g. a misconfigured API URL. Not a network error, yet the
 * outbox keeps such a queued write rather than rejecting it (spec 03 §2.5).
 */
export const isRequestNotSent = (error: unknown): boolean =>
    isUnansweredAxiosError(error) && !isNetworkError(error);

/** A request cancelled through its `AbortSignal` (Axios `CanceledError`). */
export const isRequestCancelled = (error: unknown): boolean => isCancel(error);
