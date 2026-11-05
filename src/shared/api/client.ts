// The typed `api()` wrapper over the generated OpenAPI types (spec 03 §5.4). It runs on the
// configured `apiInstance` (interceptors: auth refresh, outage detection) and adds, per request,
// the lossless transport (wireJson.ts); the instance's global defaults are not changed, so the
// legacy `src/api/*` modules keep `JSON.parse`. `api()` never converts money to `Money`: the
// `entities/*/model` mappers do that.
import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios';
import { isAxiosError } from 'axios';

import type { paths } from 'shared/api/generated/schema';
import { ApiError, ApiResponseFormatError, getApiErrorPayload } from 'shared/lib/apiError';

import { apiInstance } from './http';
import { encodePathSegment, InvalidPathSegmentError } from './pathSegment';
import { parseWireJson, stringifyWireJson } from './wireJson';

export { ApiError, ApiResponseFormatError, InvalidPathSegmentError };

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

const toApiError = (error: unknown): unknown => {
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

/**
 * Calls `method path` with typed params, query, body and response. An invalid `{param}` gives a
 * rejected `InvalidPathSegmentError` (no request); an HTTP error response gives `ApiError`; a 2xx
 * body that is not JSON gives `ApiResponseFormatError`; network errors and cancellations are
 * rejected as Axios gives them.
 */
export async function api<P extends keyof paths, M extends MethodOf<P>>(
    method: M,
    path: P,
    ...args: ApiArgs<Op<P, M>>
): Promise<Success<Op<P, M>>> {
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
    let response;

    try {
        response = await apiInstance.request<Success<Op<P, M>>>(config);
    } catch (error) {
        throw toApiError(error);
    }
    const data: unknown = response.data;

    if (typeof data === 'string' && data.trim() !== '') {
        throw new ApiResponseFormatError(response.status);
    }
    return response.data;
}
