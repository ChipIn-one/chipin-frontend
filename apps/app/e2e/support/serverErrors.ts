// Server errors of the staging API seen by a test's browser contexts (#778). A transient staging
// outage (a 5xx from Cloudflare on a cold-start refresh) leaves the app signed out or on the
// backend-down dialog, and the test then times out with a message that names nothing; these
// records let the failure name the outage instead. Only the method, path and status are kept:
// never headers, bodies, query strings or cookies.

/** The part of a Playwright response that decides whether it is a server error of the API. */
export interface ObservedResponse {
    method: string;
    url: string;
    status: number;
}

export interface ServerErrorRecord {
    method: string;
    /** The URL path without host and query string. */
    pathname: string;
    status: number;
    /** ISO time, to the second. */
    at: string;
}

const isApiPath = (pathname: string): boolean =>
    pathname === '/api' || pathname.startsWith('/api/');

/** A record when the response is a 5xx of the API (`/api` or `/api/...`), else `undefined`. */
export const toServerErrorRecord = (
    response: ObservedResponse,
    now: Date,
): ServerErrorRecord | undefined => {
    if (response.status < 500) {
        return undefined;
    }

    let pathname: string;

    try {
        ({ pathname } = new URL(response.url));
    } catch {
        return undefined;
    }

    if (!isApiPath(pathname)) {
        return undefined;
    }

    return {
        method: response.method,
        pathname,
        status: response.status,
        at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
};

/** A one-line message naming the outage, or `undefined` when nothing was recorded. */
export const formatServerErrors = (records: readonly ServerErrorRecord[]): string | undefined => {
    if (records.length === 0) {
        return undefined;
    }

    const list = records
        .map(record => `${record.method} ${record.pathname} ${record.status} at ${record.at}`)
        .join(', ');

    return `staging API answered 5xx during this test (an outage of the shared staging backend, not this test's assertion): ${list}`;
};
