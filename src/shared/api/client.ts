// The typed `api()` wrapper over the generated OpenAPI types (spec 03 §5.4). It runs on the
// configured `apiInstance` (interceptors: auth refresh, outage detection) and adds, per request,
// the lossless transport (wireJson.ts); the instance's global defaults are not changed, so the
// legacy `src/api/*` modules keep `JSON.parse`. `api()` never converts money to `Money`: the
// `entities/*/model` mappers do that.
import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios';
import { isAxiosError } from 'axios';

import type { paths } from 'shared/api/generated/schema';
import { getApiErrorPayload } from 'shared/lib/apiErrorPayload';

import { apiInstance } from './http';
import { encodePathSegment, InvalidPathSegmentError } from './pathSegment';
import { parseWireJson, stringifyWireJson } from './wireJson';

export { InvalidPathSegmentError };

export type Method = 'get' | 'put' | 'post' | 'delete' | 'patch';

export type Op<P extends keyof paths, M extends Method & keyof paths[P]> = NonNullable<paths[P][M]>;

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

export interface ApiOptions<O> {
    params?: PathParams<O>;
    query?: Query<O>;
    body?: Body<O>;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    onUploadProgress?: (event: AxiosProgressEvent) => void;
}

/** A backend error response. `details` and `current` keep the wire shape (`WireAmount` money). */
export class ApiError extends Error {
    override readonly name = 'ApiError';
    readonly status: number;
    readonly code: string | undefined;
    readonly details: Record<string, unknown> | undefined;
    /** Only for a 409 `LEDGER.VERSION_CONFLICT`: the body's `current` (zod schema: BE-03-1). */
    readonly current?: unknown;
    /** The Axios error (the ES2022 `cause`, which the target lib does not type yet). */
    readonly cause: unknown;

    constructor(status: number, error: unknown) {
        super(`API request failed with status ${status}`);
        this.cause = error;
        const payload = getApiErrorPayload(error);

        this.status = status;
        this.code = payload?.code;
        this.details = payload?.details;

        const data: unknown = isAxiosError(error) ? error.response?.data : undefined;

        if (
            status === 409 &&
            payload?.code === 'LEDGER.VERSION_CONFLICT' &&
            typeof data === 'object' &&
            data !== null &&
            'current' in data
        ) {
            this.current = data.current;
        }
    }
}

const PATH_PARAM = /\{([^}]+)\}/g;
const MULTIPART_HEADERS = { 'Content-Type': 'multipart/form-data' };

const buildPath = (path: string, params: unknown): string =>
    path.replace(PATH_PARAM, (_match, name: string) => {
        const value: unknown =
            typeof params === 'object' && params !== null ? Reflect.get(params, name) : undefined;

        // A missing or non-scalar value must not become the segment "undefined".
        if (typeof value !== 'string' && typeof value !== 'number') {
            throw new InvalidPathSegmentError();
        }
        return encodePathSegment(String(value));
    });

const toApiError = (error: unknown): unknown =>
    isAxiosError(error) && error.response ? new ApiError(error.response.status, error) : error;

/**
 * Calls `method path` with typed params, query, body and response. An invalid `{param}` gives a
 * rejected `InvalidPathSegmentError` (no request); an HTTP error response gives `ApiError`;
 * network errors and cancellations are rejected as Axios gives them.
 */
export async function api<P extends keyof paths, M extends Method & keyof paths[P]>(
    method: M,
    path: P,
    opts: ApiOptions<Op<P, M>> = {},
): Promise<Success<Op<P, M>>> {
    const url = buildPath(path, opts.params);
    const body: unknown = opts.body;
    const isMultipart = body instanceof FormData;
    const config: AxiosRequestConfig = {
        method,
        url,
        params: opts.query,
        data: body,
        // Like the legacy uploads (usersApi/groupsApi): the multipart header with the Axios
        // default request transform; a caller-supplied header wins.
        headers: isMultipart ? { ...MULTIPART_HEADERS, ...opts.headers } : opts.headers,
        signal: opts.signal,
        onUploadProgress: opts.onUploadProgress,
        transformResponse: [parseWireJson],
        // A multipart upload keeps the Axios default request transform.
        ...(isMultipart ? {} : { transformRequest: [stringifyWireJson] }),
    };

    try {
        const response = await apiInstance.request<Success<Op<P, M>>>(config);

        return response.data;
    } catch (error) {
        throw toApiError(error);
    }
}
