import { posix } from 'node:path';

import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

import { basePlugins, baseRules, TYPE_AWARE_RULES } from './base.js';

/** Astro components, pages and layouts. */
export const ASTRO_FILES = '**/*.astro';

/**
 * `.astro` files of the site (spec 04 §3): `eslint-plugin-astro` recommended rules, plus the JS,
 * typescript-eslint recommended, base and type-aware rules of the `.ts` presets on the
 * frontmatter. Every block is scoped to `siteDir`: the plugin's own rule block has no `files`.
 * @param {{ siteDir: string, appDir: string }} options
 */
export const astroConfig = ({ siteDir, appDir }) => {
    const files = [posix.join(siteDir, ASTRO_FILES)];

    return [
        ...astro.configs['flat/recommended'].map(block => ({
            ...block,
            // Client `<script>` blocks are linted as virtual `<file>.astro/<n>.{js,ts}` children.
            files: block.files
                ? block.files
                      .filter(pattern => pattern.startsWith('**/'))
                      .map(pattern => posix.join(siteDir, pattern))
                : files,
        })),
        {
            name: 'chipin/astro/typescript',
            files,
            plugins: { ...basePlugins, '@typescript-eslint': tseslint.plugin },
            languageOptions: {
                parserOptions: { project: true, extraFileExtensions: ['.astro'] },
            },
            rules: {
                ...js.configs.recommended.rules,
                ...tseslint.configs.eslintRecommended.rules,
                ...Object.assign({}, ...tseslint.configs.recommended.map(block => block.rules)),
                ...baseRules({ appDir }),
                ...TYPE_AWARE_RULES,
            },
        },
        {
            // Client `<script>` blocks are virtual files that no TS program contains: with type
            // information their parse fails and the Astro processor drops that error, so the
            // script would go unlinted. They get every rule except the type-aware ones.
            ...tseslint.configs.disableTypeChecked,
            name: 'chipin/astro/client-scripts',
            files: [posix.join(siteDir, `${ASTRO_FILES}/*.{js,ts}`)],
        },
    ];
};
