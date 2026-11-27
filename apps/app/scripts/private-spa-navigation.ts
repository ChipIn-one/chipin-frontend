// The SW navigation fallback to the app shell: the route paths of the route manifest, hand-written
// (spec 04 §2.9). It is deliberately narrower than the app-host catch-all in vercel.json: asset-like
// or unknown URLs never get the shell offline. `vercel.config.test.js` checks it against the
// manifest.
const PRIVATE_SPA_NAVIGATION_ALLOWLIST: RegExp[] = [
    // The `home` index (04-5a): its loader redirects to the preferred mode.
    /^\/$/,
    /^\/(?:dashboard|solo|group|activity|friends|settings|oauth)(?:\/|$)/,
    /^\/not-found$/,
    /^\/login$/,
];

export { PRIVATE_SPA_NAVIGATION_ALLOWLIST };
