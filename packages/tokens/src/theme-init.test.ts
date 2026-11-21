import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { THEME_INIT_SCRIPT, THEME_INIT_SCRIPT_SHA256 } from './theme-init';

const APP_CONSTANTS = new URL('../../../apps/app/src/constants/', import.meta.url);
const APP_VERCEL_JSON = new URL('../../../apps/app/vercel.json', import.meta.url);

interface VercelHeaders {
    headers?: { headers?: { key: string; value: string }[] }[];
}

/** Every `script-src` directive of every Content-Security-Policy header of the app. */
const appScriptSources = (): string[] => {
    const config = JSON.parse(readFileSync(APP_VERCEL_JSON, 'utf8')) as VercelHeaders;

    return (config.headers ?? [])
        .flatMap(rule => rule.headers ?? [])
        .filter(header => header.key.toLowerCase() === 'content-security-policy')
        .flatMap(header => header.value.split(';'))
        .map(directive => directive.trim())
        .filter(directive => directive.startsWith('script-src '));
};

interface FakeEnv {
    saved: string | null;
    systemDark: boolean;
    storageThrows?: boolean;
}

/** Runs the script against a fake `<html>`, `localStorage` and `matchMedia`; returns the theme. */
const run = ({ saved, systemDark, storageThrows = false }: FakeEnv): string[] => {
    const classes = new Set<string>();
    const root = {
        classList: { add: (name: string) => classes.add(name) },
        style: { colorScheme: '' },
    };
    const localStorage = {
        getItem: (key: string) => {
            if (storageThrows) {
                throw new Error('SecurityError');
            }
            return key === 'Chipin_theme' ? saved : null;
        },
    };
    const matchMedia = (query: string) => ({
        matches: query === '(prefers-color-scheme: dark)' && systemDark,
    });
    // The script is a string inlined into HTML; the test evaluates it with fake globals.
    const script = new Function('localStorage', 'matchMedia', 'document', THEME_INIT_SCRIPT) as (
        storage: typeof localStorage,
        media: typeof matchMedia,
        doc: object,
    ) => void;
    script(localStorage, matchMedia, { documentElement: root });
    return [...classes, root.style.colorScheme];
};

describe('THEME_INIT_SCRIPT', () => {
    test('THEME_INIT_SCRIPT_SHA256 is the CSP hash of the script', () => {
        const expected = `sha256-${createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64')}`;
        expect(THEME_INIT_SCRIPT_SHA256, `set THEME_INIT_SCRIPT_SHA256 to '${expected}'`).toBe(
            expected,
        );
    });

    test('the script-src of the app CSP allows the script by its hash', () => {
        const expected = `'sha256-${createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64')}'`;
        const sources = appScriptSources();

        expect(sources.length).toBeGreaterThan(0);
        for (const source of sources) {
            expect(
                source.split(/\s+/),
                `add ${expected} to script-src of apps/app/vercel.json`,
            ).toContain(expected);
        }
    });

    test('reads the app LS_KEY_THEME key', () => {
        const projectName = /PROJECT_NAME = '([^']+)'/.exec(
            readFileSync(new URL('chipin.ts', APP_CONSTANTS), 'utf8'),
        )?.[1];
        const themeKey = readFileSync(new URL('localstorage.ts', APP_CONSTANTS), 'utf8');
        expect(themeKey).toContain('LS_KEY_THEME = `${PROJECT_NAME}_theme`');
        expect(THEME_INIT_SCRIPT).toContain(`localStorage.getItem('${projectName}_theme')`);
    });

    test.each([
        [{ saved: 'dark', systemDark: false }, 'dark'],
        [{ saved: 'light', systemDark: true }, 'light'],
        [{ saved: 'system', systemDark: true }, 'dark'],
        [{ saved: 'system', systemDark: false }, 'light'],
        [{ saved: null, systemDark: true }, 'dark'],
        [{ saved: null, systemDark: false }, 'light'],
        [{ saved: 'unexpected', systemDark: true }, 'light'],
        [{ saved: 'dark', systemDark: true, storageThrows: true }, 'light'],
    ])('%o → %s', (env, theme) => {
        expect(run(env)).toEqual([theme, theme]);
    });
});
