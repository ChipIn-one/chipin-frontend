import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import stylelint from 'stylelint';
import { describe, expect, test } from 'vitest';

import { SITE_PALETTE_VAR_FILES } from '../stylelint.config.js';

// The root stylelint config (spec 05 §3, D23), resolved as `npm run lint:css` does.
const repoRoot = resolve(import.meta.dirname, '..');

const lint = async (code, file) => {
    const { results } = await stylelint.lint({
        code,
        codeFilename: resolve(repoRoot, file),
        cwd: repoRoot,
    });

    return results[0].warnings
        .map(({ line, rule }) => ({ line, rule }))
        .sort((left, right) => left.line - right.line);
};

describe('stylelint (05-5 acceptance item 6)', () => {
    test('a CSS Module: raw hex, a palette variable and a token typo fail; px padding passes', async () => {
        const code = [
            '.root {',
            '    color: #fff;',
            '    background: var(--gray-11);',
            '    border-color: var(--cp-text-secndary);',
            '    padding: 16px;',
            '    margin: var(--cp-space-4);',
            '}',
        ].join('\n');

        const warnings = await lint(code, 'apps/app/src/components/x/X.module.css');

        // Three declarations fail (a palette variable is both disallowed and unknown).
        expect([...new Set(warnings.map(({ line }) => line))]).toEqual([2, 3, 4]);
        expect(warnings).toEqual(
            expect.arrayContaining([
                { line: 2, rule: 'color-no-hex' },
                { line: 3, rule: 'declaration-property-value-disallowed-list' },
                { line: 4, rule: 'csstools/value-no-unknown-custom-properties' },
            ]),
        );
    });

    test('color functions, named colors and .rt-* selectors fail; local --_* variables pass', async () => {
        const code = [
            '.root {',
            '    --_gap: var(--cp-space-2);',
            '    gap: var(--_gap);',
            '    color: rgb(0 0 0);',
            '    outline-color: red;',
            '}',
            '.root .rt-Button {',
            '    color: var(--cp-text-primary);',
            '}',
        ].join('\n');

        expect(await lint(code, 'apps/app/src/components/x/X.module.css')).toEqual([
            { line: 4, rule: 'function-disallowed-list' },
            { line: 5, rule: 'color-named' },
            { line: 7, rule: 'selector-disallowed-list' },
        ]);
    });

    test('.rt-* selectors are allowed only in radixStylesOverwrite.css', async () => {
        expect(
            await lint(
                '.rt-Button { color: var(--cp-text-primary); }',
                'apps/app/src/styles/radixStylesOverwrite.css',
            ),
        ).toEqual([]);
    });

    test('the <style> of an .astro file is checked', async () => {
        const code = [
            '---',
            '---',
            '<p>x</p>',
            '<style>',
            '    p { color: #000; }',
            '</style>',
        ].join('\n');

        expect(await lint(code, 'apps/site/src/components/X.astro')).toEqual([
            { line: 5, rule: 'color-no-hex' },
        ]);
    });

    // The 10 site files frozen by 05-5 (ChipIn-one/chipin-frontend#535). The list only shrinks:
    // remove a file from both lists when it is migrated to `--cp-*`; never add one.
    const FROZEN_SITE_FILES = [
        'apps/site/src/components/SiteFooter.astro',
        'apps/site/src/components/SiteHeader.astro',
        'apps/site/src/components/landing/Cta.astro',
        'apps/site/src/components/landing/Features.astro',
        'apps/site/src/components/landing/GroupPreview.astro',
        'apps/site/src/components/landing/Hero.astro',
        'apps/site/src/components/landing/HomePage.astro',
        'apps/site/src/components/landing/HowItWorks.astro',
        'apps/site/src/components/landing/LandingStats.astro',
        'apps/site/src/components/landing/Showcase.astro',
    ];

    test('the site palette-variable exemption only shrinks and lists existing files', () => {
        expect(FROZEN_SITE_FILES).toHaveLength(10);
        for (const file of SITE_PALETTE_VAR_FILES) {
            expect(FROZEN_SITE_FILES).toContain(file);
            expect(existsSync(resolve(repoRoot, file))).toBe(true);
        }
    });

    test('an exempt site file still fails on hex and allows palette variables', async () => {
        const code = [
            '<style>',
            '    p { color: #000; background: var(--green-3); }',
            '</style>',
        ].join('\n');

        expect(await lint(code, 'apps/site/src/components/landing/Hero.astro')).toEqual([
            { line: 2, rule: 'color-no-hex' },
        ]);
    });
});
