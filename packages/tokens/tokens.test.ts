// Sync checks of the hand-written tokens (spec 05 "Checks" 1-3, D31: no generator, no tokens:check).
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { BRAND_COLORS, PROP_COLOR, RADIX_PALETTES, RADIX_THEME } from './src/theme';

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(PACKAGE_DIR, '../../apps/app/src');
// The scale files are in `@radix-ui/themes/tokens/colors`; gray.css locates the directory.
const RADIX_COLORS_DIR = dirname(
    createRequire(import.meta.url).resolve('@radix-ui/themes/tokens/colors/gray.css'),
);
const ALL_RADIX_SCALES = readdirSync(RADIX_COLORS_DIR)
    .filter(file => file.endsWith('.css'))
    .map(file => file.slice(0, -'.css'.length));

const read = (path: string): string => readFileSync(path, 'utf8');
const TOKENS_CSS = read(join(PACKAGE_DIR, 'tokens.css'));
const RADIX_COLORS_CSS = read(join(PACKAGE_DIR, 'src/radix-colors.css'));
const scaleCss = (scale: string): string => read(join(RADIX_COLORS_DIR, `${scale}.css`));

const LITERAL_EXCEPTIONS = ['--cp-brand-loader', '--cp-media-on', '--cp-media-scrim'];
const HEX_LITERAL = /^#[0-9a-f]{6}$/i;
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab|color)\(/i;
// Tokens that are not colors; every other `--cp-*` is a color role.
const NON_COLOR = /^--cp-(?:space|radius|font|shadow|z|duration|easing)-/;
// A color role is exactly one scale step (or another `--cp-*` token).
const COLOR_ROLE_VALUE = /^var\(--(?:cp-[a-z0-9-]+|[a-z]+-a?\d+)\)$/;

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const importedScales = (css: string): string[] =>
    [
        ...stripComments(css).matchAll(
            /@import '@radix-ui\/themes\/tokens\/colors\/([a-z]+)\.css';/g,
        ),
    ].map(match => match[1] ?? '');

/** Every `--cp-*` declaration in order, duplicates included (e.g. a later `.dark` override). */
const cpEntries = (css: string): [string, string][] =>
    [...stripComments(css).matchAll(/(--cp-[a-z0-9-]+):\s*([^;]+);/g)].map(match => [
        match[1] ?? '',
        (match[2] ?? '').replace(/\s+/g, ' ').trim(),
    ]);

/** The declarations of the main block, the first rule whose selector starts with `:root`. */
const mainDeclarations = (css: string): Map<string, string> =>
    new Map(cpEntries(/^:root[^{]*\{([^}]*)\}/m.exec(stripComments(css))?.[1] ?? ''));

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

/** A reference that is not a step of an imported scale other than gray, or `undefined`. */
const badScaleRef = (ref: string): string | undefined => {
    if (ref.startsWith('--cp-')) {
        return undefined;
    }
    const scale = /^--([a-z]+)-a?\d+$/.exec(ref)?.[1];
    const imported =
        scale !== undefined &&
        scale !== 'gray' &&
        (RADIX_PALETTES as readonly string[]).includes(scale);
    if (!imported) {
        return ref;
    }
    return scaleCss(scale).includes(`${ref}:`) ? undefined : `${ref} (no such step)`;
};

/** Violations of the reference and literal rules of tokens.css, over every declaration. */
const tokenViolations = (css: string): string[] => {
    const violations: string[] = [];
    for (const [name, value] of cpEntries(css)) {
        for (const [, ref = ''] of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
            const bad = badScaleRef(ref);
            if (bad !== undefined) {
                violations.push(`${name}: ${bad}`);
            }
        }
        if (LITERAL_EXCEPTIONS.includes(name)) {
            if (!HEX_LITERAL.test(value)) {
                violations.push(`${name}: not a hex literal ${value}`);
            }
        } else if (COLOR_LITERAL.test(value)) {
            violations.push(`${name}: literal ${value}`);
        } else if (!NON_COLOR.test(name) && !COLOR_ROLE_VALUE.test(value)) {
            violations.push(`${name}: not a scale step ${value}`);
        }
    }
    return violations;
};

/** The scale and step a main-block token references: `var(--grass-9)` → `['grass', '--grass-9']`. */
const scaleStep = (css: string, token: string): [string, string] => {
    const ref = /^var\((--([a-z]+)-a?\d+)\)$/.exec(mainDeclarations(css).get(token) ?? '');
    return [ref?.[2] ?? '', ref?.[1] ?? ''];
};

/** The light hex of a step, from the first `:root, .light, .light-theme` block of its scale file. */
const lightHex = (scale: string, step: string): string => {
    if (!ALL_RADIX_SCALES.includes(scale)) {
        return '';
    }
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

/** Accent tokens (`--cp-accent-*`, `--cp-focus-ring`) whose scale is not the theme accent. */
const accentMismatches = (css: string): string[] =>
    [...mainDeclarations(css).keys()]
        .filter(name => name.startsWith('--cp-accent-') || name === '--cp-focus-ring')
        .filter(name => scaleStep(css, name)[0] !== RADIX_THEME.accentColor);

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
        expect(mainDeclarations(TOKENS_CSS).size).toBeGreaterThan(0);
        expect(tokenViolations(TOKENS_CSS)).toEqual([]);
    });

    test('reduced motion zeroes every duration', () => {
        const durations = [...mainDeclarations(TOKENS_CSS).keys()].filter(name =>
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

    test('negative: --accent-*, --gray-*, a missing scale or step, literals and duplicates are reported', () => {
        const css = `:root {
            --cp-a: var(--accent-9);
            --cp-b: var(--gray-11);
            --cp-c: var(--lime-9);
            --cp-d: #000;
            --cp-e: 0 1px rgba(0, 0, 0, 0.1);
            --cp-f: white;
            --cp-g: transparent;
            --cp-h: var(--olive-13);
            --cp-shadow-x: 0 1px var(--olive-a6);
            --cp-ok: var(--olive-a6);
            --cp-media-on: #ffffff;
            --cp-media-scrim: black;
            --cp-x: var(--accent-9);
        }
        .dark {
            --cp-ok: var(--gray-1);
            --cp-x: var(--olive-9);
        }`;
        expect(tokenViolations(css)).toEqual([
            '--cp-a: --accent-9',
            '--cp-b: --gray-11',
            '--cp-c: --lime-9',
            '--cp-d: literal #000',
            '--cp-e: literal 0 1px rgba(0, 0, 0, 0.1)',
            '--cp-f: not a scale step white',
            '--cp-g: not a scale step transparent',
            '--cp-h: --olive-13 (no such step)',
            '--cp-media-scrim: not a hex literal black',
            '--cp-x: --accent-9',
            '--cp-ok: --gray-1',
        ]);
    });
});

describe('3. brand colors', () => {
    test('BRAND_COLORS equal the light values of --cp-brand-primary and --cp-surface-base', () => {
        expect(brandMismatches(TOKENS_CSS)).toEqual([]);
    });

    test('the --cp-accent-* and --cp-focus-ring scales are RADIX_THEME.accentColor', () => {
        expect(accentMismatches(TOKENS_CSS)).toEqual([]);
        expect(PROP_COLOR.accent).toBe(RADIX_THEME.accentColor);
    });

    test('negative: a brand step or scale that differs from BRAND_COLORS/RADIX_THEME is reported', () => {
        const root = (brand: string, surface = 'olive-1'): string =>
            `:root { --cp-brand-primary: var(--${brand}); --cp-surface-base: var(--${surface}); }`;
        expect(brandMismatches(root('grass-10'))).toEqual(['themeColor']);
        expect(brandMismatches(root('green-9'))).toEqual(['brand scale green', 'themeColor']);
        expect(brandMismatches(root('grass-9', 'olive-2'))).toEqual(['backgroundColor']);
        // Only the main block counts: a later override does not hide or replace it.
        expect(
            brandMismatches(`${root('grass-10')} .dark { --cp-brand-primary: var(--grass-9); }`),
        ).toEqual(['themeColor']);
        expect(
            accentMismatches(
                ':root { --cp-accent-solid: var(--green-9); --cp-focus-ring: var(--grass-a8); }',
            ),
        ).toEqual(['--cp-accent-solid']);
    });
});

describe('4. z-index scale', () => {
    // #714: the top layer (offline status, toasts, the update-required screen) sits above Radix
    // dialog content (1) on small steps of this scale, so the order must hold.
    test('content < raised < floating < toast < blocking, all small integers', () => {
        const steps = ['content', 'raised', 'floating', 'toast', 'blocking'].map(name => {
            const match = new RegExp(`--cp-z-${name}:\\s*(\\d+);`).exec(TOKENS_CSS);

            expect(match, `--cp-z-${name}`).not.toBeNull();
            return Number(match?.[1]);
        });

        expect(steps).toEqual([...steps].sort((a, b) => a - b));
        expect(new Set(steps).size).toBe(steps.length);
        expect(steps[1]).toBe(1);
        expect(Math.max(...steps)).toBeLessThan(10);
    });
});
