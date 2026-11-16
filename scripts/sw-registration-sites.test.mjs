// 04-4a1 (spec 04 §2.11): every service worker registration call site registers `/sw.js` with
// scope `/` and is gated by `shouldRegisterServiceWorker`. The scan fails when a new call site
// appears, when one loses its gate, or when one registers another URL or scope.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const SOURCE_ROOT = 'src';
const IS_SOURCE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const IS_TEST = /\.test\.[cm]?[jt]sx?$/;

const listSourceFiles = directory =>
    readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const entryPath = path.posix.join(directory, entry.name);

        if (entry.isDirectory()) {
            return listSourceFiles(entryPath);
        }

        return IS_SOURCE.test(entry.name) && !IS_TEST.test(entry.name) ? [entryPath] : [];
    });

// A registration API: the manual `navigator.serviceWorker.register(` (any receiver named
// `serviceWorker`, also optional-chained) and the vite-plugin-pwa entry points.
const REGISTRATION_PATTERNS = [
    /serviceWorker\s*\??\.\s*register\s*\(/,
    /\buseRegisterSW\b/,
    /\bregisterSW\b/,
    /virtual:pwa-register/,
    /\bnew\s+Workbox\s*\(/,
];

const EXPECTED_CALL_SITES = {
    // `virtual:pwa-register`: the URL is VitePWA buildBase + filename, checked below via vite.config.ts.
    'src/basics/PWABadge.tsx': 'virtual',
    'src/helpers/swUpdates.tsx': 'manual',
};

const sources = Object.fromEntries(
    listSourceFiles(SOURCE_ROOT).map(file => [file, readFileSync(file, 'utf8')]),
);

const callSites = Object.keys(sources).filter(file =>
    REGISTRATION_PATTERNS.some(pattern => pattern.test(sources[file])),
);

describe('service worker registration call sites', () => {
    test('are exactly the known ones', () => {
        expect(callSites.sort()).toEqual(Object.keys(EXPECTED_CALL_SITES).sort());
    });

    test.each(Object.keys(EXPECTED_CALL_SITES))('%s is gated by the legacy-host check', file => {
        const source = sources[file];

        expect(source).toMatch(
            /import\s*\{[^}]*\bshouldRegisterServiceWorker\b[^}]*\}\s*from\s*'helpers\/serviceWorkerHost'/,
        );
        expect(source).toMatch(
            /if\s*\(\s*!shouldRegisterServiceWorker\(\s*window\.location\.hostname\s*\)\s*\)\s*\{\s*return;?\s*\}/,
        );

        const gateIndex = source.search(/!shouldRegisterServiceWorker\(/);
        // Registration calls, not the import lines that name them.
        const calls = REGISTRATION_PATTERNS.flatMap(pattern =>
            Array.from(source.matchAll(new RegExp(pattern.source, 'g')), match => match.index),
        ).filter(index => !/^\s*import\b/.test(source.slice(source.lastIndexOf('\n', index) + 1)));

        expect(calls.length).toBeGreaterThan(0);
        expect(calls.every(index => index > gateIndex)).toBe(true);
    });

    test('the manual registration uses /sw.js with scope /', () => {
        const manualCalls = Object.entries(EXPECTED_CALL_SITES)
            .filter(([, kind]) => kind === 'manual')
            .flatMap(([file]) =>
                Array.from(
                    sources[file].matchAll(/serviceWorker\s*\??\.\s*register\s*\(([^)]*)\)/g),
                    match => match[1].replace(/\s+/g, ' ').trim(),
                ),
            );

        expect(manualCalls).toEqual(["'/sw.js', { scope: '/' }"]);
    });

    test('virtual:pwa-register resolves to /sw.js with scope / (VitePWA defaults)', () => {
        const viteConfig = readFileSync('vite.config.ts', 'utf8');
        const pwaIndex = viteConfig.indexOf('VitePWA({');
        const renameIndex = viteConfig.indexOf('swAppPlugin()');

        // filename defaults to sw.js, buildBase and scope to the Vite base `/`.
        expect(viteConfig).not.toMatch(/\b(?:filename|buildBase|base|srcDir|strategies)\s*:/);
        // The only `scope:` is the web manifest's `scope: '/'`.
        expect(Array.from(viteConfig.matchAll(/\bscope\s*:\s*([^,\n]+)/g), m => m[1])).toEqual([
            "'/'",
        ]);
        // The rename plugin comes after VitePWA (spec 04 §2.11 option (a)).
        expect(pwaIndex).toBeGreaterThan(-1);
        expect(renameIndex).toBeGreaterThan(pwaIndex);
    });
});
