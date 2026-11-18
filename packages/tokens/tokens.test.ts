// Sync checks of the hand-written tokens (spec 05 "Checks" 1-3, D31: no generator, no tokens:check).
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { BRAND_COLORS, PROP_COLOR, RADIX_PALETTES, RADIX_THEME } from './src/theme';

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(PACKAGE_DIR, '../../apps/app/src');
// `@radix-ui/themes` resolves to dist/cjs/index.js; the scale files are in tokens/colors.
const RADIX_COLORS_DIR = join(
    dirname(createRequire(import.meta.url).resolve('@radix-ui/themes')),
    '../../tokens/colors',
);
const ALL_RADIX_SCALES = readdirSync(RADIX_COLORS_DIR)
    .filter(file => file.endsWith('.css'))
    .map(file => file.slice(0, -'.css'.length));

const read = (path: string): string => readFileSync(path, 'utf8');
const TOKENS_CSS = read(join(PACKAGE_DIR, 'tokens.css'));
const RADIX_COLORS_CSS = read(join(PACKAGE_DIR, 'src/radix-colors.css'));
const scaleCss = (scale: string): string => read(join(RADIX_COLORS_DIR, `${scale}.css`));

const LITERAL_EXCEPTIONS = ['--cp-brand-loader', '--cp-media-on', '--cp-media-scrim'];
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab|color)\(/i;

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const importedScales = (css: string): string[] =>
    [
        ...stripComments(css).matchAll(
            /@import '@radix-ui\/themes\/tokens\/colors\/([a-z]+)\.css';/g,
        ),
    ].map(match => match[1] ?? '');

/** `--cp-*` declarations of the main block (the reduced-motion block repeats some names). */
const cpDeclarations = (css: string): Map<string, string> =>
    new Map(
        [...stripComments(css).matchAll(/(--cp-[a-z0-9-]+):\s*([^;]+);/g)].map(match => [
            match[1] ?? '',
            (match[2] ?? '').replace(/\s+/g, ' ').trim(),
        ]),
    );

/** Palette names that `apps/app/src` uses in `color` props/fields and `var(--<scale>-N)`. */
const paletteLiterals = (source: string): string[] =>
    [
        ...source.matchAll(/[cC]olor\s*[=:]\s*\{?\s*['"]([a-z]+)['"]/g),
        ...source.matchAll(/var\(--([a-z]+)-a?\d+\)/g),
    ]
        .map(match => match[1] ?? '')
        .filter(name => ALL_RADIX_SCALES.includes(name));

const missingPalettes = (sources: string[]): string[] => {
    const used = new Set(sources.flatMap(paletteLiterals));
    return [...used].filter(name => !(RADIX_PALETTES as readonly string[]).includes(name)).sort();
};

/** Violations of the reference and literal rules of tokens.css. */
const tokenViolations = (css: string): string[] => {
    const violations: string[] = [];
    for (const [name, value] of cpDeclarations(css)) {
        for (const [, ref = ''] of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
            if (ref.startsWith('--cp-')) {
                continue;
            }
            const scale = /^--([a-z]+)-a?\d+$/.exec(ref)?.[1];
            const allowed =
                scale !== undefined &&
                scale !== 'gray' &&
                (RADIX_PALETTES as readonly string[]).includes(scale);
            if (!allowed) {
                violations.push(`${name}: ${ref}`);
            }
        }
        if (COLOR_LITERAL.test(value) && !LITERAL_EXCEPTIONS.includes(name)) {
            violations.push(`${name}: literal ${value}`);
        }
    }
    return violations;
};

/** The scale and step a token references, e.g. `var(--grass-9)` → `['grass', '--grass-9']`. */
const scaleStep = (css: string, token: string): [string, string] => {
    const ref = /^var\((--([a-z]+)-\d+)\)$/.exec(cpDeclarations(css).get(token) ?? '');
    return [ref?.[2] ?? '', ref?.[1] ?? ''];
};

/** The light hex of a step, from the first `:root, .light, .light-theme` block of its scale file. */
const lightHex = (scale: string, step: string): string => {
    const lightBlock = /:root, \.light, \.light-theme \{([^}]*)\}/.exec(scaleCss(scale))?.[1] ?? '';
    return new RegExp(`${step}:\\s*(#[0-9a-f]{6});`).exec(lightBlock)?.[1] ?? '';
};

const brandMismatches = (css: string): string[] => {
    const [brandScale, brandStep] = scaleStep(css, '--cp-brand-primary');
    const [surfaceScale, surfaceStep] = scaleStep(css, '--cp-surface-base');
    const mismatches: string[] = [];
    if (brandScale !== RADIX_THEME.accentColor) {
        mismatches.push(`brand scale ${brandScale}`);
    }
    if (lightHex(brandScale, brandStep) !== BRAND_COLORS.themeColor) {
        mismatches.push('themeColor');
    }
    if (surfaceScale !== RADIX_THEME.grayColor) {
        mismatches.push(`surface scale ${surfaceScale}`);
    }
    if (lightHex(surfaceScale, surfaceStep) !== BRAND_COLORS.backgroundColor) {
        mismatches.push('backgroundColor');
    }
    return mismatches;
};

const appSources = (): string[] =>
    readdirSync(APP_SRC, { recursive: true, encoding: 'utf8' })
        .filter(file => /\.(?:tsx?|css)$/.test(file))
        .map(file => read(join(APP_SRC, file)));

describe('1. RADIX_PALETTES', () => {
    test('equals the @imports of radix-colors.css, in order', () => {
        expect(importedScales(RADIX_COLORS_CSS)).toEqual([...RADIX_PALETTES]);
    });

    test('covers the palette literals in apps/app/src and the theme constants', () => {
        expect(missingPalettes(appSources())).toEqual([]);
        expect(missingPalettes([`accentColor: '${RADIX_THEME.accentColor}'`])).toEqual([]);
        expect(missingPalettes([`grayColor: '${RADIX_THEME.grayColor}'`])).toEqual([]);
        for (const color of Object.values(PROP_COLOR)) {
            expect(missingPalettes([`color="${color}"`])).toEqual([]);
        }
    });

    test('negative: a palette that is not imported is reported', () => {
        expect(
            missingPalettes(['<Badge color="lime" />', "{ color: 'ruby' }", 'var(--sage-a3)']),
        ).toEqual(['lime', 'ruby', 'sage']);
        expect(missingPalettes(["{ color: 'transparent' }", '#add-expense'])).toEqual([]);
    });
});

describe('2. tokens.css references', () => {
    test('every color references an imported concrete scale; literals only for the D23 exceptions', () => {
        expect(cpDeclarations(TOKENS_CSS).size).toBeGreaterThan(0);
        expect(tokenViolations(TOKENS_CSS)).toEqual([]);
    });

    test('reduced motion zeroes every duration', () => {
        const durations = [...cpDeclarations(TOKENS_CSS).keys()].filter(name =>
            name.startsWith('--cp-duration-'),
        );
        const reduced =
            /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(TOKENS_CSS)?.[1] ??
            '';
        expect(durations.length).toBeGreaterThan(0);
        for (const name of durations) {
            expect(reduced).toContain(`${name}: 0ms;`);
        }
    });

    test('negative: --accent-*, --gray-*, a missing scale and a stray literal are reported', () => {
        const css = `:root {
            --cp-a: var(--accent-9);
            --cp-b: var(--gray-11);
            --cp-c: var(--lime-9);
            --cp-d: #000;
            --cp-e: 0 1px rgba(0, 0, 0, 0.1);
            --cp-ok: var(--olive-a6);
            --cp-media-on: #ffffff;
        }`;
        expect(tokenViolations(css)).toEqual([
            '--cp-a: --accent-9',
            '--cp-b: --gray-11',
            '--cp-c: --lime-9',
            '--cp-d: literal #000',
            '--cp-e: literal 0 1px rgba(0, 0, 0, 0.1)',
        ]);
    });
});

describe('3. brand colors', () => {
    test('BRAND_COLORS equal the light values of --cp-brand-primary and --cp-surface-base', () => {
        expect(brandMismatches(TOKENS_CSS)).toEqual([]);
    });

    test('negative: a brand step or scale that differs from BRAND_COLORS/RADIX_THEME is reported', () => {
        const surface = '--cp-surface-base: var(--olive-1);';
        expect(brandMismatches(`--cp-brand-primary: var(--grass-10); ${surface}`)).toEqual([
            'themeColor',
        ]);
        expect(brandMismatches(`--cp-brand-primary: var(--green-9); ${surface}`)).toEqual([
            'brand scale green',
            'themeColor',
        ]);
        expect(
            brandMismatches(
                '--cp-brand-primary: var(--grass-9); --cp-surface-base: var(--olive-2);',
            ),
        ).toEqual(['backgroundColor']);
    });
});
