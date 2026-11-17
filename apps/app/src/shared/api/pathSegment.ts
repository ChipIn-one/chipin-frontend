// `{param}` substitution of `api()` (spec 03 §5.4, spec 01-1.1): an allowlist plus
// `encodeURIComponent`. The implementation stays in `api/apiPath.ts` while the legacy `src/api/*`
// modules use it (the `api` layer cannot import `shared-api`); it moves here when they retire.
export { encodePathSegment, InvalidPathSegmentError, PATH_SEGMENT_PATTERN } from 'api/apiPath';
