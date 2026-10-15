// Match Vercel's enumerated private SPA rewrite prefixes, not arbitrary URLs.
// Exact public SSG routes remain served by their own precache entries.
const PRIVATE_SPA_NAVIGATION_ALLOWLIST: RegExp[] = [
    /^\/(?:dashboard|solo|group|activity|friends|settings|oauth)(?:\/|$)/,
    /^\/not-found$/,
];

export { PRIVATE_SPA_NAVIGATION_ALLOWLIST };
