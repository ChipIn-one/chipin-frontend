// Sync checks of the hand-written tokens (spec 05 "Checks" 1-3, D31: no generator, no tokens:check).
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
    BRAND_COLORS,
    BREAKPOINTS,
    CATEGORY_PALETTE,
    ICON_SIZE,
    LEGACY_PALETTES,
    PROP_COLOR,
    RADIX_PALETTES,
    RADIX_THEME,
    ROLE_SCALES,
    TYPE_ROLES,
} from './src/theme';

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(PACKAGE_DIR, '../../apps/app/src');
const SITE_SRC = join(PACKAGE_DIR, '../../apps/site/src');
const CATEGORY_UI = join(APP_SRC, 'constants/category-ui.ts');
const SHELL_CONSTANTS = join(APP_SRC, 'components/nav-bars/desktop-sidebar/constants.ts');
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
const NON_COLOR =
    /^--cp-(?:(?:space|radius|font|line-height|type|width|icon|shadow|elevation|z|duration|easing)-|gutter$|touch-target$|focus-ring-(?:width|offset)$)/;
// The component block holds only these tokens (one component each); the roles block none.
const COMPONENT_TOKEN =
    /^--cp-(?:logo-mode-|invite-glow$|subevents-divider$|nav-highlight|fab-border|avatar-placeholder-|auth-illustration-glow$)/;
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

/** The bodies of the main blocks: the top-level rules whose selector starts with `:root`. */
const mainBlocks = (css: string): string[] =>
    [...stripComments(css).matchAll(/^:root[^{]*\{([^}]*)\}/gm)].map(match => match[1] ?? '');

/** The selector list of each top-level rule (inside a media block: of its rule), in order. */
const topLevelSelectors = (css: string): string[] =>
    [
        ...stripComments(css).matchAll(
            /^(?:@media [^{]*\{\s*([^{]*?)\s*\{|([^\s@}][^{]*?)\s*\{)/gm,
        ),
    ].map(match => (match[1] ?? match[2] ?? '').replace(/\s+/g, ' '));

/** The top-level at-rule preludes and rule selectors in order: `@media (min-width: 768px)`. */
const topLevelHeads = (css: string): string[] =>
    [...stripComments(css).matchAll(/^(@media [^{]*?|[^\s@}][^{]*?)\s*\{/gm)].map(
        match => match[1] ?? '',
    );

/** The declarations of every main block: primitives and roles, then component tokens. */
const mainDeclarations = (css: string): Map<string, string> =>
    new Map(mainBlocks(css).flatMap(cpEntries));

/** The declarations of the first main block (primitives and roles). */
const roleDeclarations = (css: string): Map<string, string> =>
    new Map(cpEntries(mainBlocks(css)[0] ?? ''));

/** The declarations of the second main block (component tokens). */
const componentDeclarations = (css: string): Map<string, string> =>
    new Map(cpEntries(mainBlocks(css)[1] ?? ''));

/** Names declared more than once across the main blocks. */
const duplicateTokens = (css: string): string[] => {
    const names = mainBlocks(css)
        .flatMap(cpEntries)
        .map(([name]) => name);
    return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
};

/** Component-block misplacements and component tokens that repeat a role value. */
const blockViolations = (css: string): string[] => {
    const roles = roleDeclarations(css);
    const roleValues = new Map([...roles].map(([name, value]) => [value, name]));
    const violations = [...roles.keys()]
        .filter(name => COMPONENT_TOKEN.test(name))
        .map(name => `${name}: component token in the roles block`);
    for (const [name, value] of componentDeclarations(css)) {
        if (!COMPONENT_TOKEN.test(name)) {
            violations.push(`${name}: not a component token`);
        }
        const role = roleValues.get(value);
        if (role !== undefined) {
            violations.push(`${name}: use var(${role})`);
        }
    }
    return violations;
};

/** The scales referenced by a set of declarations, sorted. */
const referencedScales = (declarations: Map<string, string>): string[] =>
    [
        ...new Set(
            [...declarations.values()].flatMap(value =>
                [...value.matchAll(/var\(--([a-z]+)-a?\d+\)/g)].map(match => match[1] ?? ''),
            ),
        ),
    ].sort();

/** Palette names used in `color` props/fields and `var(--<scale>-N)` (apps/app/src, apps/site/src). */
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
    const declared = new Set(cpEntries(css).map(([name]) => name));
    for (const [name, value] of cpEntries(css)) {
        for (const [, ref = ''] of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
            const bad =
                ref.startsWith('--cp-') && !declared.has(ref)
                    ? `${ref} (not declared)`
                    : badScaleRef(ref);
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

const sourcesIn = (dir: string): string[] =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter(file => /\.(?:tsx?|css|astro)$/.test(file))
        .map(file => read(join(dir, file)));

const appSources = (): string[] => [...sourcesIn(APP_SRC), ...sourcesIn(SITE_SRC)];

/** `title1` → `title-1`, `amountHero` → `amount-hero`. */
const kebab = (name: string): string =>
    name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`).replace(/(\d+)/g, '-$1');

/** TYPE_ROLES entries whose `--cp-type-<role>` is not built from the same steps, or is missing. */
const typeRoleMismatches = (css: string): string[] => {
    const declarations = mainDeclarations(css);
    const mismatches = Object.entries(TYPE_ROLES)
        .filter(
            ([role, { size, weight }]) =>
                declarations.get(`--cp-type-${kebab(role)}`) !==
                `var(--cp-font-weight-${weight}) var(--cp-font-size-${size}) / var(--cp-line-height-${size}) var(--cp-font-sans)`,
        )
        .map(([role]) => role);
    const roles = new Set(Object.keys(TYPE_ROLES).map(kebab));
    const extra = [...declarations.keys()]
        .filter(name => name.startsWith('--cp-type-') && !name.endsWith('-tracking'))
        .filter(name => !roles.has(name.slice('--cp-type-'.length)));
    return [...mismatches, ...extra];
};

describe('1. RADIX_PALETTES', () => {
    test('equals the @imports of radix-colors.css, in order', () => {
        expect(importedScales(RADIX_COLORS_CSS)).toEqual([...RADIX_PALETTES]);
    });

    test('covers the palette literals in apps/app/src, apps/site/src and the theme constants', () => {
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

describe('1b. RADIX_PALETTES composition', () => {
    test('equals the role scales, the category palette and the legacy palettes', () => {
        const union = new Set<string>([...ROLE_SCALES, ...CATEGORY_PALETTE, ...LEGACY_PALETTES]);
        expect([...union].sort()).toEqual([...RADIX_PALETTES].sort());
    });

    test('ROLE_SCALES equal the scales of the roles block', () => {
        expect(referencedScales(roleDeclarations(TOKENS_CSS))).toEqual([...ROLE_SCALES].sort());
    });

    test('CATEGORY_PALETTE equals the colors of constants/category-ui.ts', () => {
        const colors = [...read(CATEGORY_UI).matchAll(/color: '([a-z]+)'/g)].map(
            match => match[1] ?? '',
        );
        expect([...new Set(colors)].sort()).toEqual([...CATEGORY_PALETTE].sort());
    });

    test('a legacy palette is still used and is no role or category scale', () => {
        const used = new Set(appSources().flatMap(paletteLiterals));
        for (const name of LEGACY_PALETTES) {
            expect(used.has(name), name).toBe(true);
            expect([...ROLE_SCALES, ...CATEGORY_PALETTE] as string[]).not.toContain(name);
        }
    });
});

describe('2. tokens.css references', () => {
    test('every color references an imported concrete scale; literals only for the D23 exceptions', () => {
        expect(roleDeclarations(TOKENS_CSS).size).toBeGreaterThan(0);
        expect(componentDeclarations(TOKENS_CSS).size).toBeGreaterThan(0);
        expect(tokenViolations(TOKENS_CSS)).toEqual([]);
    });

    test('no duplicates across the main blocks; component tokens only in their block', () => {
        expect(duplicateTokens(TOKENS_CSS)).toEqual([]);
        expect(blockViolations(TOKENS_CSS)).toEqual([]);
    });

    test('no --cp-selection-* tokens and no jade in the roles block (merged into grass)', () => {
        expect(
            [...mainDeclarations(TOKENS_CSS).keys()].filter(name =>
                name.startsWith('--cp-selection-'),
            ),
        ).toEqual([]);
        expect(referencedScales(roleDeclarations(TOKENS_CSS))).not.toContain('jade');
    });

    test('negative: duplicates, misplaced component tokens and repeated role values are reported', () => {
        const css = `:root {
            --cp-a: var(--grass-7);
            --cp-fab-border: var(--grass-7);
        }
        .dark { --cp-a: var(--grass-8); }
:root {
            --cp-a: var(--grass-9);
            --cp-nav-highlight: var(--grass-7);
            --cp-other: var(--olive-1);
        }`;
        expect(duplicateTokens(css)).toEqual(['--cp-a']);
        expect(blockViolations(css)).toEqual([
            '--cp-fab-border: component token in the roles block',
            '--cp-a: not a component token',
            '--cp-nav-highlight: use var(--cp-fab-border)',
            '--cp-other: not a component token',
        ]);
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
            --cp-y: var(--cp-missing);
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
            '--cp-y: --cp-missing (not declared)',
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

describe('3b. theme.ts constants', () => {
    test('each PROP_COLOR role is the scale of its --cp-* tokens', () => {
        const ROLE_TOKENS: Partial<Record<keyof typeof PROP_COLOR, string>> = {
            accent: '--cp-accent-',
            success: '--cp-status-success-',
            danger: '--cp-status-danger-',
            warning: '--cp-status-warning-',
            info: '--cp-status-info-',
            solo: '--cp-mode-solo-',
            debtOwed: '--cp-debt-owed',
            debtOwing: '--cp-debt-owing',
            debtSettled: '--cp-debt-settled',
        };
        // Inside `<Theme>` the prop color `gray` is the olive gray of RADIX_THEME.grayColor.
        const scaleOf = (color: string): string =>
            color === 'gray' ? RADIX_THEME.grayColor : color;
        const names = [...mainDeclarations(TOKENS_CSS).keys()];
        for (const [role, prefix] of Object.entries(ROLE_TOKENS)) {
            const tokens = names.filter(name => name.startsWith(prefix));
            expect(tokens.length, role).toBeGreaterThan(0);
            for (const name of tokens) {
                expect(scaleStep(TOKENS_CSS, name)[0], name).toBe(
                    scaleOf(PROP_COLOR[role as keyof typeof PROP_COLOR]),
                );
            }
        }
    });

    test('TYPE_ROLES match the --cp-type-* roles; every font size has a line height', () => {
        expect(typeRoleMismatches(TOKENS_CSS)).toEqual([]);
        const declarations = mainDeclarations(TOKENS_CSS);
        for (let step = 1; step <= 9; step += 1) {
            expect(declarations.has(`--cp-font-size-${step}`), `size ${step}`).toBe(true);
            expect(declarations.has(`--cp-line-height-${step}`), `line ${step}`).toBe(true);
        }
    });

    test('negative: a type role built from other steps, or one TYPE_ROLES lacks, is reported', () => {
        const css = `:root {
            --cp-type-display: var(--cp-font-weight-bold) var(--cp-font-size-8) / var(--cp-line-height-7) var(--cp-font-sans);
            --cp-type-display-tracking: -0.02em;
            --cp-type-extra: none;
        }`;
        const roles = Object.keys(TYPE_ROLES);
        expect(typeRoleMismatches(css)).toEqual([...roles, '--cp-type-extra']);
    });

    test('ICON_SIZE equals the --cp-icon-* tokens', () => {
        const icons = [...mainDeclarations(TOKENS_CSS)]
            .filter(([name]) => name.startsWith('--cp-icon-'))
            .map(([name, value]) => [name.slice('--cp-icon-'.length), value]);
        expect(Object.fromEntries(icons)).toEqual(
            Object.fromEntries(Object.entries(ICON_SIZE).map(([key, px]) => [key, `${px}px`])),
        );
    });

    test('--cp-gutter grows at BREAKPOINTS.sm', () => {
        const fromSm =
            new RegExp(`@media \\(min-width: ${BREAKPOINTS.sm}px\\) \\{([^}]*)\\}`).exec(
                stripComments(TOKENS_CSS),
            )?.[1] ?? '';
        expect(mainDeclarations(TOKENS_CSS).get('--cp-gutter')).toBe('16px');
        expect(new Map(cpEntries(fromSm)).get('--cp-gutter')).toBe('24px');
    });
});

describe('3c. layout and blocks', () => {
    test('--cp-width-shell equals DESKTOP_SHELL_MAX_WIDTH of the desktop sidebar', () => {
        const source = read(SHELL_CONSTANTS);
        const sidebar = /DESKTOP_SIDEBAR_WIDTH = '([^']+)'/.exec(source)?.[1];
        const shell = /DESKTOP_SHELL_MAX_WIDTH = `([^`]+)`/.exec(source)?.[1];
        expect(sidebar).toBeDefined();
        expect(shell).toBeDefined();
        expect(mainDeclarations(TOKENS_CSS).get('--cp-width-shell')).toBe(
            (shell ?? '').replace('${DESKTOP_SIDEBAR_WIDTH}', sidebar ?? ''),
        );
    });

    test('every top-level block has the selector list of the first; the gutter block follows the main blocks', () => {
        const selectors = topLevelSelectors(TOKENS_CSS);
        expect(selectors.length).toBe(4);
        expect(new Set(selectors).size).toBe(1);
        const heads = topLevelHeads(TOKENS_CSS);
        const gutter = heads.findIndex(head => head.startsWith('@media (min-width:'));
        const lastMain = heads.map(head => head.startsWith(':root')).lastIndexOf(true);
        expect(gutter).toBeGreaterThan(lastMain);
        expect(lastMain).toBe(1);
    });

    test('negative: a block with another selector list is reported', () => {
        const css = `:root,
.dark {
    --cp-a: 1px;
}
:root {
    --cp-b: 1px;
}
@media (min-width: 768px) {
    :root,
    .dark {
        --cp-a: 2px;
    }
}`;
        expect(new Set(topLevelSelectors(css)).size).toBe(2);
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
