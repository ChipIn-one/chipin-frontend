// The SW navigation fallback to the app shell: the private route prefixes of the route manifest,
// hand-written (spec 04 §2.9). It is deliberately narrower than the app-host catch-all in
// vercel.json: exact public SSG routes stay served by their own precache entries, and asset-like or
// unknown URLs never get the shell offline. `vercel.config.test.js` checks it against the manifest.
const PRIVATE_SPA_NAVIGATION_ALLOWLIST: RegExp[] = [
    /^\/(?:dashboard|solo|group|activity|friends|settings|oauth)(?:\/|$)/,
    /^\/not-found$/,
];

export { PRIVATE_SPA_NAVIGATION_ALLOWLIST };
