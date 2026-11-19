// Errors of the API seen by a test's browser contexts (#778): 5xx answers and requests that got no
// answer. A transient staging outage (a 502 from Cloudflare on a cold-start refresh) leaves the
// app signed out or on the backend-down dialog, and the test then times out with a message that
// names nothing; these records let the failure name the requests instead. They reach the public
// CI log, so only the method, a redacted path, the status or error text and the time are kept:
// never headers, bodies, query strings, cookies or path tokens (invariant 13).

/** The part of a Playwright response that decides whether it is an API server error. */
export interface ObservedResponse {
    method: string;
    url: string;
    status: number;
}

/** The part of a failed Playwright request (no response at all). */
export interface ObservedFailedRequest {
    method: string;
    url: string;
    /** `request.failure()?.errorText`, e.g. `net::ERR_CONNECTION_RESET`. */
    errorText: string | undefined;
}

export interface ApiErrorRecord {
    method: string;
    /** The redacted URL path: no host, query string, ids or tokens. */
    pathname: string;
    /** The HTTP status, or `failed (<error text>)` when no response came. */
    result: string;
    /** ISO time, to the second. */
    at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// An allow-shape rule: only short lowercase words are kept, so any id or token (digits, mixed
// case, base64url) is replaced whatever its route.
const STATIC_SEGMENT = /^[a-z][a-z-]{0,23}$/;

/** Replaces every path segment that is not a static word with `{id}` (UUID) or `{token}`. */
export const redactApiPath = (pathname: string): string =>
    pathname
        .split('/')
        .map(segment => {
            if (segment === '' || STATIC_SEGMENT.test(segment)) {
                return segment;
            }

            return UUID.test(segment) ? '{id}' : '{token}';
        })
        .join('/');

/** The redacted API path when `url` is `/api` or `/api/...` on the app origin, else `undefined`. */
const readApiPath = (url: string, appOrigin: string): string | undefined => {
    let parsed: URL;

    try {
        parsed = new URL(url);
    } catch {
        return undefined;
    }

    const { origin, pathname } = parsed;

    if (origin !== appOrigin || (pathname !== '/api' && !pathname.startsWith('/api/'))) {
        return undefined;
    }

    return redactApiPath(pathname);
};

const formatTime = (now: Date): string => now.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** A record when the response is a 5xx of the app origin's API, else `undefined`. */
export const toServerErrorRecord = (
    response: ObservedResponse,
    appOrigin: string,
    now: Date,
): ApiErrorRecord | undefined => {
    const pathname = response.status >= 500 ? readApiPath(response.url, appOrigin) : undefined;

    return pathname === undefined
        ? undefined
        : {
              method: response.method,
              pathname,
              result: String(response.status),
              at: formatTime(now),
          };
};

/** A record when a request to the app origin's API got no response, else `undefined`. */
export const toFailedRequestRecord = (
    request: ObservedFailedRequest,
    appOrigin: string,
    now: Date,
): ApiErrorRecord | undefined => {
    const pathname = readApiPath(request.url, appOrigin);

    return pathname === undefined
        ? undefined
        : {
              method: request.method,
              pathname,
              result: `failed (${request.errorText ?? 'unknown error'})`,
              at: formatTime(now),
          };
};

/** A one-line message listing the records, or `undefined` when nothing was recorded. */
export const formatApiErrors = (records: readonly ApiErrorRecord[]): string | undefined => {
    if (records.length === 0) {
        return undefined;
    }

    const list = records
        .map(record => `${record.method} ${record.pathname} ${record.result} at ${record.at}`)
        .join(', ');

    return `API answered 5xx or failed during this test: ${list}`;
};
