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

// Registration calls: the vite-plugin-pwa entry points anywhere, and any `.register(` in a file that
// mentions `serviceWorker` (catches `navigator.serviceWorker.register(`, optional chaining and a
// `serviceWorker` reference kept in a variable). Import lines are not calls.
const PWA_CALL_PATTERNS = [/\buseRegisterSW\s*\(/g, /\bregisterSW\s*\(/g, /\bnew\s+Workbox\s*\(/g];
const ANY_REGISTER_CALL = /\.\s*register\s*\(/g;
const MENTIONS_SERVICE_WORKER = /serviceWorker|virtual:pwa-register|workbox-window/;
const GATE =
    /if\s*\(\s*!shouldRegisterServiceWorker\(\s*window\.location\.hostname\s*\)\s*\)\s*\{\s*return;?\s*\}/g;
const CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return']);

const isImportLine = (source, index) =>
    /^\s*import\b/.test(source.slice(source.lastIndexOf('\n', index) + 1));

const findRegistrationCalls = source => {
    const patterns = MENTIONS_SERVICE_WORKER.test(source)
        ? [...PWA_CALL_PATTERNS, ANY_REGISTER_CALL]
        : PWA_CALL_PATTERNS;

    return [
        ...new Set(
            patterns.flatMap(pattern => Array.from(source.matchAll(pattern), match => match.index)),
        ),
    ]
        .filter(index => !isImportLine(source, index))
        .sort((left, right) => left - right);
};

// Start of the innermost function body before `index`: an arrow body `=> {`, a `function … {`, or a
// method shorthand `name(…) {` (control statements such as `if (…) {` are not functions).
const enclosingFunctionStart = (source, index) => {
    const head = source.slice(0, index);
    const starts = [
        ...Array.from(head.matchAll(/=>\s*\{/g), match => match.index),
        ...Array.from(head.matchAll(/\bfunction\b[^{]*\{/g), match => match.index),
        ...Array.from(head.matchAll(/\b(\w+)\s*\([^()]*\)\s*\{/g))
            .filter(match => !CONTROL_KEYWORDS.has(match[1]))
            .map(match => match.index),
    ];

    return Math.max(-1, ...starts);
};

const EXPECTED_CALL_SITES = {
    // `virtual:pwa-register`: the URL is VitePWA buildBase + filename, checked below via vite.config.ts.
    'src/basics/PWABadge.tsx': 'virtual',
    'src/helpers/swUpdates.tsx': 'manual',
};

const sources = Object.fromEntries(
    listSourceFiles(SOURCE_ROOT).map(file => [file, readFileSync(file, 'utf8')]),
);

const callSites = Object.keys(sources).filter(
    file => findRegistrationCalls(sources[file]).length > 0,
);

describe('service worker registration call sites', () => {
    test('are exactly the known ones', () => {
        expect(callSites.sort()).toEqual(Object.keys(EXPECTED_CALL_SITES).sort());
    });

    test.each(Object.keys(EXPECTED_CALL_SITES))(
        '%s has one registration call, gated inside the same function',
        file => {
            const source = sources[file];

            expect(source).toMatch(
                /import\s*\{[^}]*\bshouldRegisterServiceWorker\b[^}]*\}\s*from\s*'helpers\/serviceWorkerHost'/,
            );

            const calls = findRegistrationCalls(source);

            expect(calls).toHaveLength(1);

            for (const callIndex of calls) {
                const functionStart = enclosingFunctionStart(source, callIndex);
                const gates = Array.from(source.matchAll(GATE), match => match.index);

                expect(functionStart).toBeGreaterThanOrEqual(0);
                expect(gates.some(gate => gate > functionStart && gate < callIndex)).toBe(true);
            }
        },
    );

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
