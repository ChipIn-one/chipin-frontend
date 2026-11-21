export const FRIEND_INVITE_ROUTE_PATTERN = /\/friends\/join\/[^/]+/;
export const GROUP_INVITE_ROUTE_PATTERN = /\/group\/join\/[^/]+/;
export const GROUP_INVITE_API_PATTERN = /\/groups\/invite\/[^/?#]+/;
export const USER_INVITE_API_PATTERN = /\/users\/invite\/[^/]+/;
export const VERCEL_DOMAIN_SUFFIX = '.vercel.app';

// Generic capability-token redaction (FU-1, #538). A URL path segment of 20+ base64url characters
// (optional `=` padding) that is not followed by another segment character or a file extension,
// so `index-AbC123.js` and other asset names never match, while a sentence-final `.` does not hide
// a token. The candidate is redacted only when it passes
// `isOpaqueTokenSegment` in helpers/telemetry.ts.
export const TOKEN_SEGMENT_PATTERN =
    /\/([A-Za-z0-9_-]{20,}={0,2})(?![A-Za-z0-9_~%+=-]|\.[A-Za-z0-9])/g;
// A JWT anywhere in the string (`header.payload.signature`, the header always starts with `eyJ`).
export const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
// Hex with optional dashes: UUIDs with and without dashes, content hashes, commit SHAs.
export const HEX_IDENTIFIER_PATTERN = /^[0-9a-f-]+$/i;
// Lowercase words joined by `-` or `_` (`notification-preferences-v2`): a readable slug.
export const WORD_SLUG_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/;
