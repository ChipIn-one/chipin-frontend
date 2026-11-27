// Spec 04 §2.11 (04-4a1, 04-2d): there is a single service worker registration call site,
// `useRegisterSW` in `src/app/pwa/ServiceWorkerManager.tsx`, and it registers `/sw.js` with scope
// `/` (the VitePWA options of `pwa.config.ts`). The scan fails when a new call site appears or when
// it would register another URL or scope.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { buildPwaOptions } from '../pwa.config.ts';

const APP_ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_ROOT = 'src';
const IS_SOURCE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const IS_TEST = /\.test\.[cm]?[jt]sx?$/;

const listSourceFiles = directory =>
    readdirSync(path.join(APP_ROOT, directory), { withFileTypes: true }).flatMap(entry => {
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

const CALL_SITE = 'src/app/pwa/ServiceWorkerManager.tsx';

const sources = Object.fromEntries(
    listSourceFiles(SOURCE_ROOT).map(file => [
        file,
        readFileSync(path.join(APP_ROOT, file), 'utf8'),
    ]),
);

const callSites = Object.keys(sources).filter(
    file => findRegistrationCalls(sources[file]).length > 0,
);

describe('service worker registration call sites', () => {
    test('there is exactly one, in ServiceWorkerManager', () => {
        expect(callSites).toEqual([CALL_SITE]);
    });

    test('it is one useRegisterSW call of virtual:pwa-register/react', () => {
        const source = sources[CALL_SITE];

        expect(source).toMatch(
            /import\s*\{\s*useRegisterSW\s*\}\s*from\s*'virtual:pwa-register\/react'/,
        );

        const calls = findRegistrationCalls(source);

        expect(calls).toHaveLength(1);
        expect(source.slice(calls[0])).toMatch(/^useRegisterSW\s*\(/);
        // No scope or URL is passed at the call site: both come from the VitePWA options.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

        expect(code).not.toMatch(/\bscope\s*:/);
        expect(code).not.toMatch(/['"`]\/sw\.js['"`]/);
    });

    test('the registration is /sw.js with scope / (pwa.config.ts)', () => {
        const options = buildPwaOptions({ appName: 'ChipIn' });

        // vite-plugin-pwa registers `buildBase + filename` with `scope`.
        expect(`${options.buildBase}${options.filename}`).toBe('/sw.js');
        expect(options.scope).toBe('/');
        expect(options.strategies).toBeUndefined();
    });

    test('vite.config.ts uses buildPwaOptions, and nothing renames the worker (04-5b)', () => {
        const viteConfig = readFileSync(path.join(APP_ROOT, 'vite.config.ts'), 'utf8');

        // No PWA option is set beside the pure function, and the base stays `/`.
        expect(viteConfig).not.toMatch(/\b(?:filename|buildBase|srcDir|strategies|scope)\s*:/);
        expect(Array.from(viteConfig.matchAll(/\bbase\s*:\s*([^,\n]+)/g), m => m[1])).toEqual([
            "'/'",
        ]);
        expect(viteConfig).toContain('VitePWA(buildPwaOptions(');
        // The worker stays `dist/sw.js`, served at its registration URL `/sw.js` (spec 04 §2.11).
        expect(viteConfig).not.toMatch(/\brename/);
    });
});
