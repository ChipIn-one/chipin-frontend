// Stylelint for the app CSS and the `<style>` blocks of the Astro site (spec 05 §3, D23):
// colors only through `var(--cp-*)` from @chipin/tokens; packages/tokens holds the raw values.
// Site files that predate 05-5 and still use raw Radix palette variables in their `<style>`.
// Frozen: the list only shrinks (config/stylelint.test.mjs); a file leaves it when the design
// phase migrates it to `--cp-*` (ChipIn-one/chipin-frontend#535). Hex, rgb(), named colors and
// `.rt-*` stay banned in them.
export const SITE_PALETTE_VAR_FILES = [
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

export default {
    plugins: ['stylelint-value-no-unknown-custom-properties'],
    reportDescriptionlessDisables: true,
    ignoreFiles: ['packages/tokens/**', '**/node_modules/**', '**/dist/**'],
    rules: {
        'color-no-hex': true,
        'color-named': 'never',
        'function-disallowed-list': [
            'rgb',
            'rgba',
            'hsl',
            'hsla',
            'hwb',
            'lab',
            'lch',
            'oklch',
            'color',
        ],
        // Only `--cp-*` tokens and local `--_*` custom properties.
        'declaration-property-value-disallowed-list': { '/.*/': ['/var\\(--(?!cp-|_)/'] },
        // Catches typos in token names.
        'csstools/value-no-unknown-custom-properties': [
            true,
            { importFrom: ['packages/tokens/tokens.css'] },
        ],
        // `.rt-*` (Radix internals) only in radixStylesOverwrite.css (override below).
        'selector-disallowed-list': ['/\\.rt-/'],
    },
    overrides: [
        {
            files: ['**/*.astro'],
            customSyntax: 'postcss-html',
        },
        {
            files: ['apps/app/src/styles/radixStylesOverwrite.css'],
            rules: { 'selector-disallowed-list': null },
        },
        {
            files: SITE_PALETTE_VAR_FILES,
            rules: {
                'declaration-property-value-disallowed-list': null,
                'csstools/value-no-unknown-custom-properties': null,
            },
        },
        {
            // D23 exception: renders without the app CSS, so it keeps system colors and hex
            // fallbacks.
            files: ['apps/app/src/components/global-error-boundary/styles.css'],
            rules: {
                'color-no-hex': null,
                'color-named': null,
                'function-disallowed-list': null,
                'declaration-property-value-disallowed-list': null,
                'csstools/value-no-unknown-custom-properties': null,
            },
        },
    ],
};
