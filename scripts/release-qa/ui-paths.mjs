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

// Build-affecting: changes the shipped bundle or service worker without a UI path. It never blocks a
// candidate; it only forces a QA Issue with SMOKE-SHORT. Lint/test/types devDependencies stay out.
const BUILD_PATH_FILES = new Set([
    'scripts/version-resolver.mjs', // imported by vite.config.ts
]);
const TSCONFIG = /^tsconfig[^/]*\.json$/; // module resolution and compile targets
const TOOLCHAIN = /^(?:vite|vite-plugin-pwa|workbox-.+|@vitejs\/.+)$/;
const PACKAGE_JSON = 'package.json';
const PACKAGE_LOCK = 'package-lock.json';

export function isBuildToolchainPackage(name) {
    return TOOLCHAIN.test(name);
}

export function buildAffectingFiles(files) {
    const matches = [];
    for (const file of files) {
        if (BUILD_PATH_FILES.has(file) || TSCONFIG.test(file)) matches.push(file);
    }
    return matches;
}

export function hasPackageFiles(files) {
    return files.includes(PACKAGE_JSON) || files.includes(PACKAGE_LOCK);
}

function changedKeys(before = {}, after = {}) {
    const keys = [];
    for (const key in after) {
        if (Object.hasOwn(after, key) && before[key] !== after[key]) keys.push(key);
    }
    for (const key in before) {
        if (Object.hasOwn(before, key) && !Object.hasOwn(after, key)) keys.push(key);
    }
    return keys;
}

function lockEntryChanged(before, after) {
    if (!before || !after) return true;
    return before.version !== after.version || before.resolved !== after.resolved || before.integrity !== after.integrity;
}

function lockPackageName(path) {
    const index = path.lastIndexOf('node_modules/');
    return index === -1 ? path : path.slice(index + 'node_modules/'.length);
}

function lockChanges(beforeLock, afterLock) {
    const before = beforeLock?.packages ?? {};
    const after = afterLock?.packages ?? {};
    const names = new Set();
    const visit = (path, previous, next) => {
        // '' is the project itself; our own version bump changes only that entry.
        if (path === '' || !lockEntryChanged(previous, next)) return;
        const name = lockPackageName(path);
        // An absent side is neutral; a present entry without `dev: true` ships in the production tree.
        const isDevOnly = (!previous || previous.dev === true) && (!next || next.dev === true);
        if (!isDevOnly || isBuildToolchainPackage(name)) names.add(name);
    };
    for (const path in after) {
        if (Object.hasOwn(after, path)) visit(path, before[path], after[path]);
    }
    for (const path in before) {
        if (Object.hasOwn(before, path) && !Object.hasOwn(after, path)) visit(path, before[path], undefined);
    }
    return [...names];
}

// base/head hold the parsed package.json and package-lock.json at the Production baseline and the
// candidate (null when the file is absent). Only files present in the compare are inspected.
export function packageBuildChanges({ files, base, head }) {
    const reasons = [];
    if (files.includes(PACKAGE_JSON)) {
        for (const name of changedKeys(base.pkg?.dependencies, head.pkg?.dependencies)) reasons.push(`package.json dependencies: ${name}`);
        for (const name of changedKeys(base.pkg?.devDependencies, head.pkg?.devDependencies)) {
            if (isBuildToolchainPackage(name)) reasons.push(`package.json devDependencies: ${name}`);
        }
    }
    if (files.includes(PACKAGE_LOCK)) {
        for (const name of lockChanges(base.lock, head.lock)) reasons.push(`package-lock.json: ${name}`);
    }
    return reasons;
}
