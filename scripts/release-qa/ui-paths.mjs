// The one maintained list of paths that can change what a tester sees on a Preview.
// A Production-to-candidate compare with none of these paths needs no manual QA.
// Keep it in sync with the real tree: entry HTML, PWA/service-worker build inputs and Vercel routing.
export const UI_PATH_PREFIXES = Object.freeze([
    'src/', // application code, styles and src/i18n/locales/** translations
    'public/', // static assets, icons, robots.txt and sitemap.xml
]);

export const UI_PATH_FILES = new Set([
    'index.html', // public entry HTML
    'app.html', // private SPA shell and service-worker navigate fallback
    'vercel.json', // routing, headers and rewrites
    'vite.config.ts', // build, VitePWA and workbox configuration
    'pwa-assets.config.ts', // PWA icon generation
    'scripts/prerender-before-workbox.mjs', // prerender step that runs before workbox precache
    'scripts/prerender-public.mjs', // public page prerender
    'scripts/private-spa-navigation.ts', // service-worker navigate fallback allowlist
]);

const TEST_FILE = /\.test\.[^/]+$/;

export function isUiAffecting(path) {
    if (typeof path !== 'string' || path.length === 0) return false;
    if (UI_PATH_FILES.has(path)) return true;
    if (!UI_PATH_PREFIXES.some(prefix => path.startsWith(prefix))) return false;
    if (path.startsWith('src/') && (path.startsWith('src/test/') || TEST_FILE.test(path))) return false;
    return true;
}

export function uiAffectingFiles(files) {
    const matches = [];
    for (const file of files) {
        if (isUiAffecting(file)) matches.push(file);
    }
    return matches;
}
