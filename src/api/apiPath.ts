// UUID, base64url invite tokens, test fixtures (`group-1`, `activity-parent`). No `.`, `/`, `%`, `\`.
export const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export class InvalidPathSegmentError extends Error {
    constructor() {
        super('Invalid API path segment');
        this.name = 'InvalidPathSegmentError';
    }
}

// Single implementation, reused by the generated-client wrapper `api()` (spec 03 §5.4).
export const encodePathSegment = (segment: string): string => {
    if (!PATH_SEGMENT_PATTERN.test(segment)) {
        throw new InvalidPathSegmentError();
    }
    return encodeURIComponent(segment); // no-op for the allowlist; kept as defense-in-depth
};

// Call only inside `.then` so an invalid segment becomes a rejected Promise, not a sync throw.
export const apiPath = (strings: TemplateStringsArray, ...segments: string[]): string =>
    strings.reduce((path, chunk, index) => {
        if (index >= segments.length) {
            return path + chunk;
        }
        return path + chunk + encodePathSegment(segments[index]);
    }, '');
